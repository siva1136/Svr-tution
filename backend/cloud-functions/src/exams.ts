import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  COL,
  EXAM_SUBMIT_GRACE_SECONDS,
  attemptId as makeAttemptId,
  computeRanks,
  evaluateExam,
  gradeSubjectiveSchema,
  submitExamSchema,
  type AnswerKey,
  type Attempt,
  type EvaluableQuestion,
  type Exam,
  type Question,
  type QuestionResult,
  type StudentAnswer,
} from '@svr/shared';
import { FieldValue, audit, caller, db, parse, requirePerm, requireRole } from './core';

interface LoadedQuestion {
  id: string;
  q: Question;
  key: AnswerKey;
}

async function loadExam(examId: string): Promise<Exam> {
  const snap = await db.collection(COL.exams).doc(examId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Exam not found');
  return snap.data() as Exam;
}

async function loadQuestions(examId: string, withKeys: boolean): Promise<LoadedQuestion[]> {
  const qs = await db.collection(COL.exams).doc(examId).collection(COL.questions).orderBy('order').get();
  const keys = new Map<string, AnswerKey>();
  if (withKeys) {
    const ks = await db.collection(COL.examKeys).doc(examId).collection(COL.questions).get();
    ks.forEach((d) => keys.set(d.id, d.data() as AnswerKey));
  }
  return qs.docs.map((d) => ({ id: d.id, q: d.data() as Question, key: keys.get(d.id) ?? {} }));
}

function toEvaluable(list: LoadedQuestion[]): EvaluableQuestion[] {
  return list.map(({ id, q, key }) => ({ id, question: { type: q.type, marks: q.marks, negativeMarks: q.negativeMarks }, key }));
}

/** Student-visible question payload (answer keys never leave the server). */
function publicQuestion({ id, q }: LoadedQuestion) {
  return { id, order: q.order, type: q.type, text: q.text, imageUrl: q.imageUrl ?? null, options: q.options ?? [], marks: q.marks, negativeMarks: q.negativeMarks };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function assertEnrolled(studentId: string, courseId: string) {
  const s = await db.collection(COL.students).doc(studentId).get();
  if (!s.exists || s.get('status') !== 'active') throw new HttpsError('permission-denied', 'Student account inactive.');
  if (!((s.get('enrolledCourseIds') as string[] | undefined) ?? []).includes(courseId)) {
    throw new HttpsError('permission-denied', 'You are not enrolled in this course.');
  }
  return s;
}

/**
 * Starts (or resumes) an exam attempt. The server fixes the start time and
 * deadline, so the client timer is only a display.
 */
export const startExam = onCall(async (req) => {
  const c = requireRole(req, 'student');
  const { examId } = parse(z.object({ examId: z.string().min(1).max(128) }), req.data);
  const exam = await loadExam(examId);
  if (!exam.published) throw new HttpsError('failed-precondition', 'This exam is not available.');
  await assertEnrolled(c.uid, exam.courseId);

  const now = Date.now();
  const startAt = exam.startAt ? (exam.startAt as Timestamp).toMillis() : undefined;
  const endAt = exam.endAt ? (exam.endAt as Timestamp).toMillis() : undefined;

  const ref = db.collection(COL.attempts).doc(makeAttemptId(examId, c.uid));
  const questions = await loadQuestions(examId, false);
  if (questions.length === 0) throw new HttpsError('failed-precondition', 'This exam has no questions yet.');

  const attempt = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const a = snap.data() as Attempt;
      if (a.status !== 'in_progress') throw new HttpsError('already-exists', 'You have already submitted this exam.');
      return a;
    }
    if (startAt && now < startAt) throw new HttpsError('failed-precondition', 'This exam has not started yet.');
    if (endAt && now > endAt) throw new HttpsError('failed-precondition', 'This exam window has closed.');
    const deadline = Math.min(now + exam.durationMin * 60_000, endAt ?? Number.POSITIVE_INFINITY);
    const ids = questions.map((q) => q.id);
    const a: Attempt = {
      examId,
      studentId: c.uid,
      courseId: exam.courseId,
      status: 'in_progress',
      startedAt: Timestamp.fromMillis(now),
      deadlineAt: Timestamp.fromMillis(deadline),
      questionOrder: exam.shuffleQuestions ? shuffle(ids) : ids,
      answers: {},
    };
    tx.set(ref, a);
    return a;
  });

  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    attemptId: ref.id,
    serverNow: now,
    deadlineAt: (attempt.deadlineAt as Timestamp).toMillis(),
    exam: { title: exam.title, durationMin: exam.durationMin, instructions: exam.instructions ?? '', totalMarks: exam.totalMarks },
    questions: attempt.questionOrder.map((id) => byId.get(id)).filter((q): q is LoadedQuestion => !!q).map(publicQuestion),
    answers: attempt.answers,
  };
});

/** Autosave (`final: false`) or final submission with automatic evaluation. */
export const submitExam = onCall(async (req) => {
  const c = requireRole(req, 'student');
  const input = parse(submitExamSchema, req.data);
  const ref = db.collection(COL.attempts).doc(makeAttemptId(input.examId, c.uid));
  const questions = input.final ? await loadQuestions(input.examId, true) : await loadQuestions(input.examId, false);
  const validIds = new Set(questions.map((q) => q.id));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Start the exam first.');
    const a = snap.data() as Attempt;
    if (a.status !== 'in_progress') throw new HttpsError('already-exists', 'This exam has already been submitted.');

    const now = Date.now();
    const deadline = (a.deadlineAt as Timestamp).toMillis();
    const late = now > deadline + EXAM_SUBMIT_GRACE_SECONDS * 1000;

    // Answers arriving after the deadline are ignored; the last autosave counts.
    const answers: Record<string, StudentAnswer> = { ...a.answers };
    if (!late) {
      for (const [qid, ans] of Object.entries(input.answers)) if (validIds.has(qid)) answers[qid] = ans;
    }

    if (!input.final && !late) {
      tx.update(ref, { answers, lastSavedAt: FieldValue.serverTimestamp() });
      return { ok: true, saved: true };
    }

    const summary = evaluateExam(toEvaluable(questions), answers);
    const status: Attempt['status'] = summary.pendingReview > 0 ? 'submitted' : 'evaluated';
    tx.update(ref, {
      answers,
      results: summary.results,
      score: summary.score,
      maxScore: summary.maxScore,
      correct: summary.correct,
      incorrect: summary.incorrect,
      unattempted: summary.unattempted,
      pendingReview: summary.pendingReview,
      accuracy: summary.accuracy,
      status,
      submittedAt: Timestamp.fromMillis(Math.min(now, deadline + EXAM_SUBMIT_GRACE_SECONDS * 1000)),
      late,
    });
    return {
      ok: true,
      submitted: true,
      status,
      score: summary.score,
      maxScore: summary.maxScore,
      correct: summary.correct,
      incorrect: summary.incorrect,
      unattempted: summary.unattempted,
      pendingReview: summary.pendingReview,
      accuracy: summary.accuracy,
    };
  });
});

/** Teacher awards marks to an uploaded subjective answer; the attempt is re-scored. */
export const gradeSubjective = onCall(async (req) => {
  const t = requirePerm(req, 'exams.evaluate');
  const input = parse(gradeSubjectiveSchema, req.data);
  const ref = db.collection(COL.attempts).doc(input.attemptId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Attempt not found');
  const a = snap.data() as Attempt;
  if (a.status === 'in_progress') throw new HttpsError('failed-precondition', 'Attempt not submitted yet');
  const questions = await loadQuestions(a.examId, true);
  const q = questions.find((x) => x.id === input.questionId);
  if (!q || q.q.type !== 'subjective') throw new HttpsError('invalid-argument', 'Not a subjective question of this exam');
  if (input.marks > q.q.marks) throw new HttpsError('invalid-argument', `Maximum marks for this question is ${q.q.marks}`);

  const manual: Record<string, QuestionResult> = {};
  for (const [qid, r] of Object.entries(a.results ?? {})) {
    const qq = questions.find((x) => x.id === qid);
    if (qq?.q.type === 'subjective' && r.outcome !== 'pending_review' && r.outcome !== 'unattempted') manual[qid] = r;
  }
  manual[input.questionId] = {
    outcome: input.marks >= q.q.marks ? 'correct' : input.marks > 0 ? 'partial' : 'incorrect',
    marksAwarded: input.marks,
    maxMarks: q.q.marks,
    teacherRemark: input.remark,
  };
  const summary = evaluateExam(toEvaluable(questions), a.answers, manual);
  await ref.update({
    results: summary.results,
    score: summary.score,
    correct: summary.correct,
    incorrect: summary.incorrect,
    unattempted: summary.unattempted,
    pendingReview: summary.pendingReview,
    accuracy: summary.accuracy,
    status: summary.pendingReview > 0 ? 'submitted' : 'evaluated',
    evaluatedBy: t.uid,
  });
  return { ok: true, score: summary.score, pendingReview: summary.pendingReview };
});

/** Computes ranks/percentiles for every submitted attempt and publishes results. */
export const publishResults = onCall(async (req) => {
  const t = requirePerm(req, 'exams.manage');
  const { examId } = parse(z.object({ examId: z.string().min(1) }), req.data);
  await loadExam(examId);
  const snaps = await db.collection(COL.attempts).where('examId', '==', examId).get();
  const done = snaps.docs.filter((d) => d.get('status') !== 'in_progress');
  const pending = done.filter((d) => (d.get('pendingReview') as number) > 0).length;
  const ranks = computeRanks(
    done.map((d) => {
      const a = d.data() as Attempt;
      const taken = ((a.submittedAt as Timestamp | undefined)?.toMillis() ?? 0) - (a.startedAt as Timestamp).toMillis();
      return { id: d.id, score: a.score ?? 0, timeTakenSec: Math.max(0, Math.round(taken / 1000)) };
    }),
  );
  const writer = db.bulkWriter();
  for (const d of done) writer.update(d.ref, { rank: ranks[d.id].rank, percentile: ranks[d.id].percentile });
  await writer.close();
  await db.collection(COL.exams).doc(examId).update({ resultsPublished: true, resultsPublishedAt: FieldValue.serverTimestamp(), candidates: done.length });
  await audit(t.uid, 'exam.publishResults', { examId, candidates: done.length, pendingReview: pending });
  return { ok: true, candidates: done.length, pendingReview: pending };
});

/** Detailed review with solutions — available once results are published. */
export const getExamReview = onCall(async (req) => {
  const c = caller(req);
  const { examId, studentId: requested } = parse(z.object({ examId: z.string().min(1), studentId: z.string().optional() }), req.data);
  const studentId = requested ?? c.uid;

  let allowed = studentId === c.uid || c.role === 'admin' || c.role === 'teacher';
  if (!allowed && c.role === 'parent') {
    const p = await db.collection(COL.parents).doc(c.uid).get();
    allowed = ((p.get('childIds') as string[] | undefined) ?? []).includes(studentId);
  }
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed');

  const exam = await loadExam(examId);
  const isStaff = c.role === 'admin' || c.role === 'teacher';
  if (!exam.resultsPublished && !isStaff) throw new HttpsError('failed-precondition', 'Results have not been published yet.');
  const attemptSnap = await db.collection(COL.attempts).doc(makeAttemptId(examId, studentId)).get();
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'No attempt found');
  const attempt = attemptSnap.data() as Attempt;
  const questions = await loadQuestions(examId, true);
  return {
    exam: { title: exam.title, totalMarks: exam.totalMarks },
    attempt: {
      score: attempt.score,
      maxScore: attempt.maxScore,
      rank: attempt.rank ?? null,
      percentile: attempt.percentile ?? null,
      accuracy: attempt.accuracy,
      correct: attempt.correct,
      incorrect: attempt.incorrect,
      unattempted: attempt.unattempted,
      status: attempt.status,
    },
    questions: questions.map((q) => ({
      ...publicQuestion(q),
      correctOptionIds: q.key.correctOptionIds ?? [],
      numericAnswer: q.key.numericAnswer ?? null,
      solution: q.key.solution ?? '',
      answer: attempt.answers[q.id] ?? null,
      result: attempt.results?.[q.id] ?? null,
    })),
  };
});

/** Keeps exam.questionCount / totalMarks in sync whenever questions change. */
export const onExamQuestionWrite = onDocumentWritten(`${COL.exams}/{examId}/${COL.questions}/{questionId}`, async (event) => {
  const examId = event.params.examId;
  const qs = await db.collection(COL.exams).doc(examId).collection(COL.questions).get();
  let total = 0;
  qs.forEach((d) => (total += Number(d.get('marks') ?? 0)));
  await db.collection(COL.exams).doc(examId).set({ questionCount: qs.size, totalMarks: total }, { merge: true });
});

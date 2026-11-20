import type { AnswerKey, Question, QuestionResult, StudentAnswer } from './types';

/**
 * Pure exam-evaluation logic. Runs on the server (Cloud Functions) so students
 * can never see the answer key or tamper with their score. It lives in the
 * shared package so it is unit-tested once and reused by every backend.
 */

export interface EvaluableQuestion {
  id: string;
  question: Pick<Question, 'type' | 'marks' | 'negativeMarks'>;
  key: AnswerKey;
}

const EPSILON = 1e-9;

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluateQuestion(q: EvaluableQuestion, answer: StudentAnswer | undefined): QuestionResult {
  const { type, marks, negativeMarks } = q.question;
  const maxMarks = marks;
  const neg = negativeMarks ? -Math.abs(negativeMarks) : 0;

  if (type === 'subjective') {
    const uploaded = (answer?.uploadPaths?.length ?? 0) > 0;
    return uploaded
      ? { outcome: 'pending_review', marksAwarded: 0, maxMarks }
      : { outcome: 'unattempted', marksAwarded: 0, maxMarks };
  }

  if (type === 'numerical') {
    const v = answer?.numericValue;
    if (v === undefined || v === null || Number.isNaN(v)) {
      return { outcome: 'unattempted', marksAwarded: 0, maxMarks };
    }
    const expected = q.key.numericAnswer;
    if (expected === undefined) throw new Error(`Question ${q.id} has no numeric answer key`);
    const tol = Math.abs(q.key.tolerance ?? 0);
    const ok = Math.abs(v - expected) <= tol + EPSILON;
    return ok
      ? { outcome: 'correct', marksAwarded: marks, maxMarks }
      : { outcome: 'incorrect', marksAwarded: neg, maxMarks };
  }

  const selected = Array.from(new Set(answer?.selectedOptionIds ?? []));
  if (selected.length === 0) return { outcome: 'unattempted', marksAwarded: 0, maxMarks };
  const correct = q.key.correctOptionIds ?? [];
  if (correct.length === 0) throw new Error(`Question ${q.id} has no correct options in key`);

  if (type === 'mcq') {
    const ok = selected.length === 1 && correct.includes(selected[0]);
    return ok
      ? { outcome: 'correct', marksAwarded: marks, maxMarks }
      : { outcome: 'incorrect', marksAwarded: neg, maxMarks };
  }

  // msq
  if (sameSet(selected, correct)) return { outcome: 'correct', marksAwarded: marks, maxMarks };
  const anyWrong = selected.some((s) => !correct.includes(s));
  if (!anyWrong && q.key.partialMarking) {
    // Proportional partial credit, only when every chosen option is correct.
    return {
      outcome: 'partial',
      marksAwarded: round2((marks * selected.length) / correct.length),
      maxMarks,
    };
  }
  return { outcome: 'incorrect', marksAwarded: neg, maxMarks };
}

export interface ExamSummary {
  results: Record<string, QuestionResult>;
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  partial: number;
  unattempted: number;
  pendingReview: number;
  /** Correct ÷ attempted auto-graded questions, 0–100. */
  accuracy: number;
}

export function evaluateExam(
  questions: EvaluableQuestion[],
  answers: Record<string, StudentAnswer>,
  /** Already-awarded marks for subjective questions (teacher evaluation). */
  manualResults: Record<string, QuestionResult> = {},
): ExamSummary {
  const results: Record<string, QuestionResult> = {};
  let score = 0,
    maxScore = 0,
    correct = 0,
    incorrect = 0,
    partial = 0,
    unattempted = 0,
    pendingReview = 0;

  for (const q of questions) {
    let r = evaluateQuestion(q, answers[q.id]);
    const manual = manualResults[q.id];
    if (q.question.type === 'subjective' && manual && manual.outcome !== 'pending_review') {
      r = { ...manual, marksAwarded: Math.min(Math.max(manual.marksAwarded, 0), q.question.marks), maxMarks: q.question.marks };
    }
    results[q.id] = r;
    score += r.marksAwarded;
    maxScore += r.maxMarks;
    if (r.outcome === 'correct') correct++;
    else if (r.outcome === 'incorrect') incorrect++;
    else if (r.outcome === 'partial') partial++;
    else if (r.outcome === 'pending_review') pendingReview++;
    else unattempted++;
  }

  const attempted = correct + incorrect + partial;
  return {
    results,
    score: round2(score),
    maxScore: round2(maxScore),
    correct,
    incorrect,
    partial,
    unattempted,
    pendingReview,
    accuracy: attempted === 0 ? 0 : round2((correct / attempted) * 100),
  };
}

export interface RankInput {
  id: string;
  score: number;
  /** Seconds taken; lower wins ties. */
  timeTakenSec: number;
}

/** Standard competition ranking ("1224"): equal score and time share a rank. */
export function computeRanks(rows: RankInput[]): Record<string, { rank: number; percentile: number }> {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.timeTakenSec - b.timeTakenSec);
  const out: Record<string, { rank: number; percentile: number }> = {};
  const n = sorted.length;
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    const rank = prev && prev.score === r.score && prev.timeTakenSec === r.timeTakenSec ? out[prev.id].rank : i + 1;
    // Percentile = share of candidates scoring strictly below.
    const below = sorted.filter((x) => x.score < r.score).length;
    out[r.id] = { rank, percentile: n <= 1 ? 100 : round2((below / (n - 1)) * 100) };
  });
  return out;
}

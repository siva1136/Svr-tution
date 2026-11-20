import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, deleteDoc, doc, getDoc, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, limit } from 'firebase/firestore';
import { getDownloadURL, ref as sRef } from 'firebase/storage';
import {
  COL,
  EXAM_TYPES,
  QUESTION_TYPE_LABELS,
  formatDateTime,
  type AnswerKey,
  type Attempt,
  type Exam,
  type Question,
  type QuestionBankItem,
} from '@svr/shared';
import { db, errorMessage, fn, storage } from '../lib/firebase';
import { downloadCsv } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDoc, useQuery, type Row } from '../lib/hooks';
import ResourcePage from '../components/ResourcePage';
import Form, { opts, type FieldDef } from '../components/Form';
import MathText from '../components/MathText';
import { Badge, Modal, PageHeader, Stat, Table, Toast } from '../components/ui';
import { StudentName, flattenKey, parseOptions, questionFields } from './Academics';

const examFields = (courseId?: string): FieldDef[] => [
  { name: 'title', label: 'Title', type: 'text', required: true, full: true },
  { name: 'type', label: 'Exam type', type: 'select', options: opts(EXAM_TYPES), required: true, defaultValue: 'chapter' },
  { name: 'courseId', label: 'Course', type: 'ref', refCollection: COL.courses, refLabel: 'title', required: true },
  ...(courseId ? [{ name: 'chapterId', label: 'Chapter (for chapter-wise analytics)', type: 'ref', refCollection: `${COL.courses}/${courseId}/${COL.chapters}`, refLabel: 'title' } as FieldDef] : []),
  { name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, defaultValue: '60' },
  { name: 'startAt', label: 'Window opens', type: 'datetime', help: 'Leave blank to allow any time' },
  { name: 'endAt', label: 'Window closes', type: 'datetime' },
  { name: 'defaultMarks', label: 'Default marks / question', type: 'number', defaultValue: '4' },
  { name: 'defaultNegativeMarks', label: 'Default negative marks', type: 'number', defaultValue: '1' },
  { name: 'instructions', label: 'Instructions', type: 'math' },
  { name: 'shuffleQuestions', label: 'Shuffle questions', type: 'checkbox' },
  { name: 'published', label: 'Published', type: 'checkbox', help: 'Enrolled students can start it (within the window)' },
];

export function ExamsList() {
  const { can } = useAuth();
  return (
    <ResourcePage<Exam>
      title="Examinations"
      sub="Chapter tests, full syllabus, JEE Main pattern and Olympiad practice — evaluated automatically on the server."
      collection={COL.exams}
      order={['createdAt', 'desc']}
      createLabel="New exam"
      canCreate={can('exams.manage')}
      canEdit={false}
      wideForm
      fields={examFields()}
      onCreateExtra={() => ({ createdAt: serverTimestamp(), questionCount: 0, totalMarks: 0, resultsPublished: false })}
      columns={[
        { key: 'title', label: 'Exam', render: (e) => <div><p className="font-medium">{e.title}</p><p className="text-xs text-ink-900/50">{e.type.replace('_', ' ')} · {e.durationMin} min</p></div> },
        { key: 'q', label: 'Questions', render: (e) => `${e.questionCount ?? 0} · ${e.totalMarks ?? 0} marks` },
        { key: 'window', label: 'Window', render: (e) => (e.startAt ? formatDateTime(e.startAt) : 'Any time') },
        { key: 'status', label: 'Status', render: (e) => <Badge>{e.resultsPublished ? 'evaluated' : e.published ? 'published' : 'draft'}</Badge> },
      ]}
      rowActions={(e) => <Link to={`/exams/${e.id}`} className="btn-gold btn-xs">Open</Link>}
    />
  );
}

type QRow = Row<Question> & { key?: AnswerKey };

export function ExamBuilder() {
  const { examId = '' } = useParams();
  const { can } = useAuth();
  const exam = useDoc<Exam>(doc(db, COL.exams, examId), [examId]);
  const qs = useQuery<Question>(query(collection(db, COL.exams, examId, COL.questions), orderBy('order')), [examId]);
  const [tab, setTab] = useState<'questions' | 'results'>('questions');
  const [modal, setModal] = useState<{ kind: 'settings' } | { kind: 'question'; row: QRow | null } | { kind: 'bank' } | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const manage = can('exams.manage');
  const e = exam.data;

  async function openQuestion(row: Row<Question> | null) {
    let key: AnswerKey | undefined;
    if (row) {
      key = (await getDoc(doc(db, COL.examKeys, examId, COL.questions, row.id))).data() as AnswerKey | undefined;
    }
    setModal({ kind: 'question', row: row ? { ...row, key } : null });
  }

  async function saveQuestion(d: Record<string, unknown>, existing: QRow | null) {
    const options = parseOptions(String(d.optionsText ?? ''));
    const isChoice = d.type === 'mcq' || d.type === 'msq';
    const correct = isChoice ? String(d.correctOptionIds ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    if (isChoice && options.length < 2) throw new Error('Add at least two options');
    if (isChoice && correct.length === 0) throw new Error('Specify the correct option(s)');
    if (isChoice && correct.some((c) => !options.find((o) => o.id === c))) throw new Error('Correct option must be one of the listed letters');
    if (d.type === 'mcq' && correct.length !== 1) throw new Error('MCQ must have exactly one correct option');
    if (d.type === 'numerical' && (d.numericAnswer === null || d.numericAnswer === undefined)) throw new Error('Numeric answer is required');

    const id = existing?.id ?? doc(collection(db, COL.exams, examId, COL.questions)).id;
    const question: Question = {
      order: existing?.order ?? qs.rows.length + 1,
      type: d.type as Question['type'],
      text: String(d.text),
      options: isChoice ? options : [],
      marks: Number(d.marks ?? e?.defaultMarks ?? 4),
      negativeMarks: Number(d.negativeMarks ?? 0),
      difficulty: (d.difficulty as Question['difficulty']) ?? 'medium',
      topic: (d.topic as string) || undefined,
    };
    const key: AnswerKey = {
      correctOptionIds: correct,
      numericAnswer: d.type === 'numerical' ? Number(d.numericAnswer) : undefined,
      tolerance: Number(d.tolerance ?? 0),
      partialMarking: Boolean(d.partialMarking),
      solution: String(d.solution ?? ''),
    };
    const batch = writeBatch(db);
    batch.set(doc(db, COL.exams, examId, COL.questions, id), JSON.parse(JSON.stringify(question)));
    batch.set(doc(db, COL.examKeys, examId, COL.questions, id), JSON.parse(JSON.stringify(key)));
    await batch.commit();
    setModal(null);
    setMsg({ text: 'Question saved' });
  }

  async function removeQuestion(q: Row<Question>) {
    if (!confirm('Delete this question?')) return;
    await deleteDoc(doc(db, COL.exams, examId, COL.questions, q.id));
    await deleteDoc(doc(db, COL.examKeys, examId, COL.questions, q.id));
  }

  if (!e) return <p className="text-sm text-ink-900/50">{exam.loading ? 'Loading…' : 'Exam not found.'}</p>;

  return (
    <>
      <Link to="/exams" className="text-sm text-royal-600">← All exams</Link>
      <PageHeader
        title={e.title}
        sub={`${e.type.replace('_', ' ')} · ${e.durationMin} min · negative marking ${e.defaultNegativeMarks ? 'on' : 'off'}`}
        actions={
          manage && (
            <>
              <button className="btn-soft" onClick={() => setModal({ kind: 'settings' })}>Settings</button>
              <button
                className={e.published ? 'btn-soft' : 'btn-gold'}
                onClick={() => {
                  if (!e.published && (e.questionCount ?? 0) === 0) return setMsg({ text: 'Add questions before publishing', error: true });
                  updateDoc(doc(db, COL.exams, examId), { published: !e.published }).then(() => setMsg({ text: e.published ? 'Unpublished' : 'Published to students' }));
                }}
              >
                {e.published ? 'Unpublish' : 'Publish exam'}
              </button>
            </>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Questions" value={e.questionCount ?? qs.rows.length} />
        <Stat label="Total marks" value={e.totalMarks ?? 0} />
        <Stat label="Status" value={<Badge>{e.resultsPublished ? 'evaluated' : e.published ? 'published' : 'draft'}</Badge>} />
        <Stat label="Window" value={<span className="text-sm">{e.startAt ? `${formatDateTime(e.startAt)} → ${formatDateTime(e.endAt)}` : 'Any time'}</span>} />
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 text-sm font-medium shadow-sm ring-1 ring-ink-900/8 sm:w-fit">
        {(['questions', 'results'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 capitalize ${tab === t ? 'bg-ink-900 text-white' : 'text-ink-900/60'}`}>{t}</button>
        ))}
      </div>

      {tab === 'questions' ? (
        <>
          {manage && (
            <div className="mb-4 flex gap-2">
              <button className="btn-primary" onClick={() => openQuestion(null)}>+ Add question</button>
              <button className="btn-soft" onClick={() => setModal({ kind: 'bank' })}>Import from question bank</button>
            </div>
          )}
          <div className="space-y-3">
            {qs.rows.map((q, i) => (
              <div key={q.id} className="panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold">Q{i + 1}</span>
                      <Badge tone="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <span className="text-ink-900/50">+{q.marks} / −{q.negativeMarks}</span>
                    </div>
                    <MathText text={q.text} className="text-sm" />
                    {q.options.length > 0 && (
                      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {q.options.map((o) => <li key={o.id} className="rounded-lg bg-paper px-3 py-1.5 text-sm"><b className="mr-2">{o.id})</b><MathText text={o.text} /></li>)}
                      </ol>
                    )}
                  </div>
                  {manage && (
                    <div className="flex shrink-0 gap-1.5">
                      <button className="btn-soft btn-xs" onClick={() => openQuestion(q)}>Edit</button>
                      <button className="btn-soft btn-xs text-rose-600" onClick={() => removeQuestion(q)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!qs.loading && qs.rows.length === 0 && <div className="panel p-10 text-center text-sm text-ink-900/50">No questions yet.</div>}
          </div>
        </>
      ) : (
        <Results examId={examId} exam={e} onMsg={setMsg} />
      )}

      <Modal open={modal?.kind === 'settings'} title="Exam settings" onClose={() => setModal(null)} wide>
        <Form
          fields={examFields(e.courseId)}
          initial={e as unknown as Record<string, unknown>}
          onCancel={() => setModal(null)}
          onSubmit={async (d) => {
            await updateDoc(doc(db, COL.exams, examId), { ...d, updatedAt: serverTimestamp() });
            setModal(null);
          }}
        />
      </Modal>
      <Modal open={modal?.kind === 'question'} title={modal?.kind === 'question' && modal.row ? 'Edit question' : 'Add question'} onClose={() => setModal(null)} wide>
        {modal?.kind === 'question' && (
          <Form
            fields={questionFields()}
            initial={
              modal.row
                ? { ...modal.row, ...flattenKey(modal.row.key), optionsText: modal.row.options.map((o) => o.text).join('\n') }
                : { marks: e.defaultMarks, negativeMarks: e.defaultNegativeMarks, type: 'mcq' }
            }
            onCancel={() => setModal(null)}
            onSubmit={(d) => saveQuestion(d, modal.row)}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === 'bank'} title="Import from question bank" onClose={() => setModal(null)} wide>
        {modal?.kind === 'bank' && <BankImport examId={examId} startOrder={qs.rows.length + 1} onDone={(n) => { setModal(null); setMsg({ text: `${n} questions imported` }); }} />}
      </Modal>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

function BankImport({ examId, startOrder, onDone }: { examId: string; startOrder: number; onDone: (n: number) => void }) {
  const bank = useQuery<QuestionBankItem>(query(collection(db, COL.questionBank), orderBy('createdAt', 'desc'), limit(300)));
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const rows = bank.rows.filter((q) => !filter || [q.text, q.topic, ...(q.tags ?? [])].join(' ').toLowerCase().includes(filter.toLowerCase()));

  async function importNow() {
    const batch = writeBatch(db);
    picked.forEach((id, i) => {
      const q = bank.rows.find((r) => r.id === id)!;
      const ref = doc(collection(db, COL.exams, examId, COL.questions));
      const { key, tags: _t, source: _s, board: _b, classLevel: _c, id: _id, ...rest } = q as Row<QuestionBankItem> & { createdAt?: unknown };
      delete (rest as Record<string, unknown>).createdAt;
      batch.set(ref, JSON.parse(JSON.stringify({ ...rest, order: startOrder + i })));
      batch.set(doc(db, COL.examKeys, examId, COL.questions, ref.id), JSON.parse(JSON.stringify(key ?? {})));
    });
    await batch.commit();
    onDone(picked.length);
  }

  return (
    <div className="space-y-4">
      <input className="field" placeholder="Filter by text, topic or tag" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {rows.map((q) => (
          <label key={q.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${picked.includes(q.id) ? 'border-royal-500 bg-royal-100/40' : 'border-ink-900/10'}`}>
            <input type="checkbox" className="mt-1 accent-ink-900" checked={picked.includes(q.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id)))} />
            <div className="min-w-0">
              <MathText text={q.text.slice(0, 300)} />
              <p className="mt-1 text-xs text-ink-900/50">{q.type} · {q.marks} marks · {(q.tags ?? []).join(', ')}</p>
            </div>
          </label>
        ))}
        {!bank.loading && rows.length === 0 && <p className="py-8 text-center text-sm text-ink-900/50">No questions in the bank.</p>}
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!picked.length} onClick={importNow}>Import {picked.length || ''} questions</button>
      </div>
    </div>
  );
}

function Results({ examId, exam, onMsg }: { examId: string; exam: Row<Exam>; onMsg: (m: { text: string; error?: boolean }) => void }) {
  const { can } = useAuth();
  const attempts = useQuery<Attempt>(query(collection(db, COL.attempts), where('examId', '==', examId)), [examId]);
  const questions = useQuery<Question>(query(collection(db, COL.exams, examId, COL.questions), orderBy('order')), [examId]);
  const [grading, setGrading] = useState<Row<Attempt> | null>(null);
  const done = attempts.rows.filter((a) => a.status !== 'in_progress').sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (b.score ?? 0) - (a.score ?? 0));
  const pending = done.filter((a) => (a.pendingReview ?? 0) > 0).length;
  const avg = done.length ? done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length : 0;

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Submitted" value={done.length} hint={`${attempts.rows.length - done.length} in progress`} />
        <Stat label="Average score" value={avg.toFixed(1)} hint={`of ${exam.totalMarks ?? 0}`} />
        <Stat label="Highest" value={Math.max(0, ...done.map((a) => a.score ?? 0))} />
        <Stat label="Awaiting evaluation" value={pending} hint="Subjective answers" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {can('exams.manage') && (
          <button className="btn-gold" onClick={() => fn.publishResults({ examId }).then((r) => onMsg({ text: `Ranks computed for ${r.candidates} candidates${r.pendingReview ? ` (${r.pendingReview} still pending evaluation)` : ''}` }), (e) => onMsg({ text: errorMessage(e), error: true }))}>
            {exam.resultsPublished ? 'Recompute ranks' : 'Publish results & ranks'}
          </button>
        )}
        <button className="btn-soft" onClick={() => downloadCsv(`/reports/exams/${examId}/ranklist.csv`, `ranklist-${examId}.csv`).catch((e) => onMsg({ text: e.message, error: true }))}>Download rank list (CSV)</button>
      </div>
      <Table
        rows={done}
        loading={attempts.loading}
        empty="No submissions yet."
        columns={[
          { key: 'rank', label: 'Rank', render: (a) => (a.rank ? `#${a.rank}` : '—') },
          { key: 'studentId', label: 'Student', render: (a) => <StudentName id={a.studentId} /> },
          { key: 'score', label: 'Score', render: (a) => <b>{a.score} / {a.maxScore}</b> },
          { key: 'cia', label: 'C / I / U', render: (a) => `${a.correct ?? 0} / ${a.incorrect ?? 0} / ${a.unattempted ?? 0}` },
          { key: 'accuracy', label: 'Accuracy', render: (a) => `${a.accuracy ?? 0}%` },
          { key: 'submittedAt', label: 'Submitted', render: (a) => formatDateTime(a.submittedAt) },
          { key: 'status', label: 'Status', render: (a) => <Badge>{a.status}</Badge> },
        ]}
        actions={(a) => (a.pendingReview ?? 0) > 0 || Object.values(a.results ?? {}).some((r) => r.teacherRemark !== undefined) ? (
          <button className="btn-gold btn-xs" onClick={() => setGrading(a)}>Evaluate</button>
        ) : null}
      />
      <Modal open={!!grading} title="Evaluate subjective answers" onClose={() => setGrading(null)} wide>
        {grading && <Grader attempt={grading} questions={questions.rows.filter((q) => q.type === 'subjective')} onMsg={onMsg} />}
      </Modal>
    </>
  );
}

function Grader({ attempt, questions, onMsg }: { attempt: Row<Attempt>; questions: Row<Question>[]; onMsg: (m: { text: string; error?: boolean }) => void }) {
  const [urls, setUrls] = useState<Record<string, string[]>>({});
  const load = async (qid: string) => {
    const paths = attempt.answers[qid]?.uploadPaths ?? [];
    const list = await Promise.all(paths.map((p) => getDownloadURL(sRef(storage, p)).catch(() => '')));
    setUrls((u) => ({ ...u, [qid]: list.filter(Boolean) }));
  };
  return (
    <div className="space-y-5">
      {questions.map((q) => {
        const r = attempt.results?.[q.id];
        return (
          <div key={q.id} className="rounded-xl border border-ink-900/10 p-4">
            <MathText text={q.text} className="text-sm" />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge>{r?.outcome ?? 'unattempted'}</Badge>
              {(attempt.answers[q.id]?.uploadPaths?.length ?? 0) > 0 && !urls[q.id] && <button className="btn-soft btn-xs" onClick={() => load(q.id)}>View uploaded answer</button>}
              {urls[q.id]?.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer" className="btn-soft btn-xs">Page {i + 1} ↗</a>)}
            </div>
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.currentTarget);
                try {
                  const res = await fn.gradeSubjective({ attemptId: attempt.id, questionId: q.id, marks: Number(fd.get('marks')), remark: String(fd.get('remark') ?? '') || undefined });
                  onMsg({ text: `Saved — new score ${res.score}` });
                } catch (e) {
                  onMsg({ text: errorMessage(e), error: true });
                }
              }}
            >
              <div>
                <label className="label">Marks (max {q.marks})</label>
                <input name="marks" type="number" step="0.5" min={0} max={q.marks} defaultValue={r?.outcome === 'pending_review' ? '' : r?.marksAwarded} className="field w-28" required />
              </div>
              <div className="min-w-48 flex-1">
                <label className="label">Remark</label>
                <input name="remark" className="field" defaultValue={r?.teacherRemark ?? ''} />
              </div>
              <button className="btn-primary">Save</button>
            </form>
          </div>
        );
      })}
      {questions.length === 0 && <p className="text-sm text-ink-900/50">This exam has no subjective questions.</p>}
    </div>
  );
}


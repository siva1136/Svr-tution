import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDoc, orderBy, query, serverTimestamp, setDoc, addDoc, where, updateDoc } from 'firebase/firestore';
import {
  BOARDS,
  BOARD_LABELS,
  CLASS_LEVELS,
  COL,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  COURSE_CATEGORIES,
  LIVE_PROVIDERS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  VIDEO_PROVIDERS,
  formatDateTime,
  formatINR,
  slugify,
  type Chapter,
  type ContentItem,
  type Course,
  type Homework,
  type HomeworkSubmission,
  type LiveClass,
  type QuestionBankItem,
  type Student,
} from '@svr/shared';
import { db, errorMessage, fn } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { useDoc, useQuery, type Row } from '../lib/hooks';
import ResourcePage from '../components/ResourcePage';
import Form, { opts, type FieldDef } from '../components/Form';
import MathText from '../components/MathText';
import { Badge, Modal, PageHeader, Table, Toast } from '../components/ui';

const classOpts = CLASS_LEVELS.map((c) => [String(c), `Class ${c}`] as const);

/* ============================== COURSES ============================== */

export function Courses() {
  const { can } = useAuth();
  return (
    <ResourcePage<Course>
      title="Courses"
      sub="Create courses, then open one to add chapters, videos, PDFs, DPPs and tests — no code changes required."
      collection={COL.courses}
      order={['order', 'asc']}
      searchKeys={['title', 'slug']}
      canCreate={can('courses.manage')}
      canEdit={can('courses.manage')}
      createLabel="New course"
      wideForm
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true, full: true },
        { name: 'slug', label: 'URL slug', type: 'text', help: 'e.g. class-10-cbse — leave blank to generate from title' },
        { name: 'subtitle', label: 'Subtitle', type: 'text' },
        { name: 'board', label: 'Board / programme', type: 'select', options: opts(BOARDS, BOARD_LABELS), required: true },
        { name: 'classLevel', label: 'Class', type: 'select', options: classOpts },
        { name: 'category', label: 'Category', type: 'select', options: opts(COURSE_CATEGORIES), required: true },
        { name: 'priceInPaise', label: 'Price', type: 'money', required: true },
        { name: 'mrpInPaise', label: 'MRP (strike-through)', type: 'money' },
        { name: 'durationMonths', label: 'Duration (months)', type: 'number', required: true },
        { name: 'order', label: 'Display order', type: 'number', defaultValue: '10' },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'highlights', label: 'Highlights', type: 'list' },
        { name: 'teacherIds', label: 'Teachers', type: 'refmulti', refCollection: COL.teachers, refLabel: 'name' },
        { name: 'thumbnailUrl', label: 'Thumbnail', type: 'file', accept: 'image/*', storageDir: () => 'public/courses' },
        { name: 'published', label: 'Published', type: 'checkbox', help: 'Visible on website and app' },
        { name: 'featured', label: 'Featured', type: 'checkbox', help: 'Show on home page' },
      ]}
      save={async (d, existing) => {
        const data = { ...d, slug: (d.slug as string) || slugify(String(d.title)), teacherIds: d.teacherIds ?? [] };
        if (existing) await setDoc(doc(db, COL.courses, existing.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        else await setDoc(doc(db, COL.courses, data.slug), { ...data, createdAt: serverTimestamp() });
      }}
      columns={[
        { key: 'title', label: 'Course', render: (c) => <div><p className="font-medium">{c.title}</p><p className="text-xs text-ink-900/50">/{c.slug}</p></div> },
        { key: 'board', label: 'Board', render: (c) => `${BOARD_LABELS[c.board] ?? c.board}${c.classLevel ? ` · ${c.classLevel}` : ''}` },
        { key: 'price', label: 'Price', render: (c) => formatINR(c.priceInPaise ?? 0) },
        { key: 'published', label: 'Status', render: (c) => <Badge>{c.published ? 'published' : 'draft'}</Badge> },
      ]}
      rowActions={(c) => <Link to={`/courses/${c.id}`} className="btn-gold btn-xs">Open builder</Link>}
    />
  );
}

export function CourseEditor() {
  const { courseId = '' } = useParams();
  const course = useDoc<Course>(doc(db, COL.courses, courseId), [courseId]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const chapters = useQuery<Chapter>(query(collection(db, COL.courses, courseId, COL.chapters), orderBy('number')), [courseId]);
  const chapter = chapters.rows.find((c) => c.id === chapterId);

  return (
    <>
      <Link to="/courses" className="text-sm text-royal-600">← All courses</Link>
      <PageHeader title={course.data?.title ?? 'Course'} sub={course.data ? `${BOARD_LABELS[course.data.board]} · ${chapters.rows.length} chapters` : undefined} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,500px)_1fr]">
        <div>
          <ResourcePage<Chapter>
            key={`ch-${courseId}`}
            compact
            title="Chapters"
            collection={`${COL.courses}/${courseId}/${COL.chapters}`}
            order={['number', 'asc']}
            createLabel="Chapter"
            canDelete
            fields={[
              { name: 'number', label: 'Chapter no.', type: 'number', required: true },
              { name: 'title', label: 'Title', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'published', label: 'Published', type: 'checkbox', defaultValue: true },
            ]}
            columns={[
              { key: 'number', label: '#', render: (c) => c.number },
              { key: 'title', label: 'Chapter', render: (c) => <button className={`text-left font-medium ${c.id === chapterId ? 'text-royal-600' : ''}`} onClick={() => setChapterId(c.id)}>{c.title}</button> },
              { key: 'published', label: '', render: (c) => (c.published ? '' : <Badge>draft</Badge>) },
            ]}
            rowActions={(c) => <button className="btn-gold btn-xs" onClick={() => setChapterId(c.id)}>Content</button>}
          />
        </div>
        <div>
          {chapter ? (
            <ResourcePage<ContentItem>
              key={`ct-${chapter.id}`}
              compact
              title={`Ch ${chapter.number}: ${chapter.title}`}
              sub="Concept videos, live classes, notes, NCERT, practice, DPPs, assignments and tests"
              collection={`${COL.courses}/${courseId}/${COL.chapters}/${chapter.id}/${COL.contents}`}
              order={['order', 'asc']}
              createLabel="Content"
              canDelete
              wideForm
              fields={contentFields(courseId)}
              columns={[
                { key: 'order', label: '#', render: (c) => c.order },
                { key: 'type', label: 'Type', render: (c) => <Badge tone="blue">{CONTENT_TYPE_LABELS[c.type]}</Badge> },
                { key: 'title', label: 'Title', render: (c) => <span className="font-medium">{c.title}</span> },
                { key: 'flags', label: '', render: (c) => <div className="flex gap-1">{!c.published && <Badge>draft</Badge>}{c.freePreview && <Badge tone="green">free</Badge>}</div> },
              ]}
            />
          ) : (
            <div className="panel flex h-64 items-center justify-center text-sm text-ink-900/50">Select a chapter to manage its content.</div>
          )}
        </div>
      </div>
    </>
  );
}

function contentFields(courseId: string): FieldDef[] {
  const t = (...types: string[]) => (v: Record<string, unknown>) => types.includes(String(v.type));
  return [
    { name: 'type', label: 'Type', type: 'select', options: CONTENT_TYPES.map((c) => [c, CONTENT_TYPE_LABELS[c]] as const), required: true },
    { name: 'order', label: 'Order', type: 'number', required: true, defaultValue: '1' },
    { name: 'title', label: 'Title', type: 'text', required: true, full: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'videoProvider', label: 'Video provider', type: 'select', options: opts(VIDEO_PROVIDERS), showIf: t('video'), defaultValue: 'cloudflare' },
    { name: 'videoRef', label: 'Video ID', type: 'text', showIf: t('video'), help: 'Cloudflare Stream UID or YouTube video ID' },
    { name: 'durationSec', label: 'Duration (seconds)', type: 'number', showIf: t('video') },
    { name: 'fileUrl', label: 'PDF / file', type: 'file', accept: 'application/pdf,image/*,video/mp4', storageDir: () => `courses/${courseId}/files`, showIf: t('notes', 'ncert', 'practice', 'dpp', 'assignment', 'video') },
    { name: 'liveClassId', label: 'Live class', type: 'ref', refCollection: COL.liveClasses, refLabel: 'title', showIf: t('live') },
    { name: 'examId', label: 'Exam', type: 'ref', refCollection: COL.exams, refLabel: 'title', showIf: t('test', 'practice', 'dpp') },
    { name: 'homeworkId', label: 'Homework', type: 'ref', refCollection: COL.homework, refLabel: 'title', showIf: t('assignment') },
    { name: 'published', label: 'Published', type: 'checkbox', defaultValue: true },
    { name: 'freePreview', label: 'Free preview', type: 'checkbox', help: 'Visible to students who are not enrolled' },
  ];
}

/* ============================== LIVE CLASSES ============================== */

export function LiveClasses() {
  const courses = useQuery<Course>(query(collection(db, COL.courses), orderBy('order')));
  const names = useMemo(() => new Map(courses.rows.map((c) => [c.id, c.title])), [courses.rows]);
  return (
    <ResourcePage<LiveClass>
      title="Live Classes"
      sub="Schedule classes on Zoom, Google Meet, 100ms or Jitsi. Join links stay private and attendance is recorded automatically when students join."
      collection={COL.liveClasses}
      order={['startAt', 'desc']}
      createLabel="Schedule class"
      canDelete
      wideForm
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true, full: true },
        { name: 'courseId', label: 'Course', type: 'ref', refCollection: COL.courses, refLabel: 'title', required: true },
        { name: 'teacherId', label: 'Teacher', type: 'ref', refCollection: COL.teachers, refLabel: 'name', required: true },
        { name: 'startAt', label: 'Starts at', type: 'datetime', required: true },
        { name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, defaultValue: '60' },
        { name: 'provider', label: 'Provider', type: 'select', options: opts(LIVE_PROVIDERS), required: true, defaultValue: 'zoom' },
        { name: 'status', label: 'Status', type: 'select', options: opts(['scheduled', 'live', 'completed', 'cancelled'] as const), required: true, defaultValue: 'scheduled' },
        { name: 'joinUrl', label: 'Student join link', type: 'text', required: true, full: true, help: 'Kept private — revealed only to enrolled students at class time' },
        { name: 'hostUrl', label: 'Host / start link', type: 'text', full: true },
        { name: 'passcode', label: 'Passcode', type: 'text' },
        { name: 'recordingRef', label: 'Recording (Cloudflare Stream UID / URL)', type: 'text' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      loadExtra={async (row) => (await getDoc(doc(db, COL.liveClasses, row.id, 'private', 'secret'))).data() ?? {}}
      save={async (d, existing) => {
        const { joinUrl, hostUrl, passcode, ...pub } = d;
        const ref = existing ? doc(db, COL.liveClasses, existing.id) : doc(collection(db, COL.liveClasses));
        await setDoc(ref, { ...pub, ...(existing ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }) }, { merge: true });
        await setDoc(doc(ref, 'private', 'secret'), { joinUrl, hostUrl: hostUrl || null, passcode: passcode || null });
      }}
      columns={[
        { key: 'title', label: 'Class', render: (c) => <div><p className="font-medium">{c.title}</p><p className="text-xs text-ink-900/50">{names.get(c.courseId) ?? c.courseId}</p></div> },
        { key: 'startAt', label: 'When', render: (c) => `${formatDateTime(c.startAt)} · ${c.durationMin}m` },
        { key: 'provider', label: 'Provider', render: (c) => c.provider.replace('_', ' ') },
        { key: 'status', label: 'Status', render: (c) => <Badge>{c.status}</Badge> },
      ]}
      rowActions={(c, toast) => (
        <>
          <button className="btn-gold btn-xs" onClick={() => fn.joinLiveClass({ classId: c.id }).then((r) => window.open(r.joinUrl, '_blank', 'noopener'), (e) => toast(errorMessage(e), true))}>Start</button>
          <Link to={`/attendance?class=${c.id}`} className="btn-soft btn-xs">Attendance</Link>
        </>
      )}
    />
  );
}

/* ============================== ATTENDANCE ============================== */

export function Attendance() {
  const params = new URLSearchParams(location.search);
  const [classId, setClassId] = useState(params.get('class') ?? '');
  const classes = useQuery<LiveClass>(query(collection(db, COL.liveClasses), orderBy('startAt', 'desc')));
  const cls = classes.rows.find((c) => c.id === classId);
  const enrolled = useQuery<Student>(cls ? query(collection(db, COL.students), where('enrolledCourseIds', 'array-contains', cls.courseId)) : null, [cls?.courseId]);
  const present = useQuery<{ present: boolean; late?: boolean }>(classId ? collection(db, COL.liveClasses, classId, COL.attendance) : null, [classId]);
  const map = new Map(present.rows.map((p) => [p.id, p]));
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function mark(s: Row<Student>, value: boolean) {
    try {
      await setDoc(doc(db, COL.liveClasses, classId, COL.attendance, s.id), { studentId: s.id, studentName: s.name, present: value, markedManually: true, markedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      setMsg({ text: errorMessage(e), error: true });
    }
  }

  const count = enrolled.rows.filter((s) => map.get(s.id)?.present).length;
  return (
    <>
      <PageHeader title="Attendance" sub="Automatic from live-class joins; adjust manually for offline sessions" />
      <select className="field mb-4 max-w-xl" value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">Select a class…</option>
        {classes.rows.map((c) => <option key={c.id} value={c.id}>{formatDateTime(c.startAt)} — {c.title}</option>)}
      </select>
      {cls && (
        <>
          <p className="mb-3 text-sm text-ink-900/60">{count} / {enrolled.rows.length} present ({enrolled.rows.length ? Math.round((count / enrolled.rows.length) * 100) : 0}%)</p>
          <Table
            rows={enrolled.rows}
            loading={enrolled.loading}
            empty="No students enrolled in this course."
            columns={[
              { key: 'name', label: 'Student', render: (s) => <span className="font-medium">{s.name}</span> },
              { key: 'admissionNo', label: 'Admission no.' },
              { key: 'status', label: 'Attendance', render: (s) => { const a = map.get(s.id); return a?.present ? <Badge tone={a.late ? 'amber' : 'green'}>{a.late ? 'late' : 'present'}</Badge> : <Badge tone="red">absent</Badge>; } },
            ]}
            actions={(s) => (map.get(s.id)?.present ? <button className="btn-soft btn-xs" onClick={() => mark(s, false)}>Mark absent</button> : <button className="btn-soft btn-xs" onClick={() => mark(s, true)}>Mark present</button>)}
          />
        </>
      )}
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

/* ============================== HOMEWORK ============================== */

export function HomeworkPage() {
  const [grading, setGrading] = useState<Row<Homework> | null>(null);
  return (
    <>
      <ResourcePage<Homework>
        title="Homework"
        sub="Assign work to a course; students upload answers from the app and you grade them here."
        collection={COL.homework}
        order={['dueAt', 'desc']}
        createLabel="Assign homework"
        canDelete
        fields={[
          { name: 'title', label: 'Title', type: 'text', required: true, full: true },
          { name: 'courseId', label: 'Course', type: 'ref', refCollection: COL.courses, refLabel: 'title', required: true },
          { name: 'dueAt', label: 'Due', type: 'datetime', required: true },
          { name: 'maxMarks', label: 'Max marks', type: 'number', required: true, defaultValue: '10' },
          { name: 'description', label: 'Instructions', type: 'math' },
          { name: 'attachment', label: 'Question sheet', type: 'file', accept: 'application/pdf,image/*', storageDir: () => 'homework/sheets' },
          { name: 'published', label: 'Published', type: 'checkbox', defaultValue: true },
        ]}
        save={async (d, existing) => {
          const data = { ...d, attachmentPaths: d.attachmentPath ? [d.attachmentPath] : [] };
          if (existing) await setDoc(doc(db, COL.homework, existing.id), data, { merge: true });
          else await addDoc(collection(db, COL.homework), { ...data, createdAt: serverTimestamp() });
        }}
        columns={[
          { key: 'title', label: 'Homework', render: (h) => <span className="font-medium">{h.title}</span> },
          { key: 'dueAt', label: 'Due', render: (h) => formatDateTime(h.dueAt) },
          { key: 'maxMarks', label: 'Marks' },
          { key: 'published', label: 'Status', render: (h) => <Badge>{h.published ? 'published' : 'draft'}</Badge> },
        ]}
        rowActions={(h) => <button className="btn-gold btn-xs" onClick={() => setGrading(h)}>Submissions</button>}
      />
      <Modal open={!!grading} title={`Submissions — ${grading?.title ?? ''}`} onClose={() => setGrading(null)} wide>
        {grading && <Submissions hw={grading} />}
      </Modal>
    </>
  );
}

function Submissions({ hw }: { hw: Row<Homework> }) {
  const subs = useQuery<HomeworkSubmission>(query(collection(db, COL.homeworkSubmissions), where('homeworkId', '==', hw.id), orderBy('submittedAt', 'desc')), [hw.id]);
  const [editing, setEditing] = useState<Row<HomeworkSubmission> | null>(null);
  const { user } = useAuth();
  if (editing)
    return (
      <Form
        fields={[
          { name: 'marks', label: `Marks (out of ${hw.maxMarks})`, type: 'number', required: true },
          { name: 'feedback', label: 'Feedback', type: 'textarea' },
        ]}
        initial={editing as unknown as Record<string, unknown>}
        onCancel={() => setEditing(null)}
        onSubmit={async (d) => {
          if (Number(d.marks) > hw.maxMarks || Number(d.marks) < 0) throw new Error(`Marks must be between 0 and ${hw.maxMarks}`);
          await updateDoc(doc(db, COL.homeworkSubmissions, editing.id), { marks: d.marks, feedback: d.feedback ?? '', status: 'graded', gradedBy: user?.uid, gradedAt: serverTimestamp() });
          setEditing(null);
        }}
      />
    );
  return (
    <Table
      rows={subs.rows}
      loading={subs.loading}
      empty="No submissions yet."
      columns={[
        { key: 'studentId', label: 'Student', render: (s) => <StudentName id={s.studentId} /> },
        { key: 'submittedAt', label: 'Submitted', render: (s) => formatDateTime(s.submittedAt) },
        { key: 'files', label: 'Files', render: (s) => `${s.uploadPaths.length} file(s)` },
        { key: 'status', label: 'Status', render: (s) => <Badge>{s.status}</Badge> },
        { key: 'marks', label: 'Marks', render: (s) => (s.marks ?? '—') as string },
      ]}
      actions={(s) => <button className="btn-soft btn-xs" onClick={() => setEditing(s)}>Grade</button>}
    />
  );
}

export function StudentName({ id }: { id: string }) {
  const s = useDoc<Student>(doc(db, COL.students, id), [id]);
  return <span>{s.data?.name ?? id.slice(0, 8)}</span>;
}

/* ============================== QUESTION BANK ============================== */

export function QuestionBank() {
  return (
    <ResourcePage<QuestionBankItem>
      title="Question Bank"
      sub="Board, JEE and Olympiad questions with answer keys and solutions. Import into any exam from the exam builder."
      collection={COL.questionBank}
      order={['createdAt', 'desc']}
      searchKeys={['text', 'topic', 'source']}
      createLabel="Question"
      canDelete
      wideForm
      fields={questionFields()}
      save={async (d, existing) => {
        const { correctOptionIds, numericAnswer, tolerance, partialMarking, solution, optionsText, tags, ...q } = d;
        const options = parseOptions(String(optionsText ?? ''));
        const data = {
          ...q,
          tags: tags ?? [],
          options,
          key: { correctOptionIds: correctOptionIds ? String(correctOptionIds).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [], numericAnswer: numericAnswer ?? null, tolerance: tolerance ?? 0, partialMarking: !!partialMarking, solution: solution ?? '' },
        };
        if (existing) await setDoc(doc(db, COL.questionBank, existing.id), data);
        else await addDoc(collection(db, COL.questionBank), { ...data, createdAt: serverTimestamp() });
      }}
      loadExtra={async (r) => ({ ...flattenKey(r.key), optionsText: (r.options ?? []).map((o) => o.text).join('\n') })}
      columns={[
        { key: 'text', label: 'Question', render: (q) => <div className="max-w-xl text-sm"><MathText text={q.text.slice(0, 220)} /></div> },
        { key: 'type', label: 'Type', render: (q) => <Badge tone="blue">{q.type}</Badge> },
        { key: 'difficulty', label: 'Level', render: (q) => q.difficulty ?? '—' },
        { key: 'tags', label: 'Tags', render: (q) => (q.tags ?? []).join(', ') },
      ]}
    />
  );
}

/** Shared question fields used by the bank and the exam builder. Options are "one per line"; ids are a, b, c… */
export function questionFields(): FieldDef[] {
  const choice = (v: Record<string, unknown>) => v.type === 'mcq' || v.type === 'msq';
  return [
    { name: 'type', label: 'Question type', type: 'select', options: QUESTION_TYPES.map((q) => [q, QUESTION_TYPE_LABELS[q]] as const), required: true, defaultValue: 'mcq' },
    { name: 'difficulty', label: 'Difficulty', type: 'select', options: opts(['easy', 'medium', 'hard'] as const), defaultValue: 'medium' },
    { name: 'marks', label: 'Marks', type: 'number', required: true, defaultValue: '4' },
    { name: 'negativeMarks', label: 'Negative marks', type: 'number', defaultValue: '1', help: 'Enter as a positive number' },
    { name: 'text', label: 'Question (LaTeX supported)', type: 'math', required: true },
    { name: 'optionsText', label: 'Options — one per line (a, b, c, d…)', type: 'textarea', showIf: choice },
    { name: 'correctOptionIds', label: 'Correct option(s)', type: 'text', showIf: choice, placeholder: 'e.g. b   or   a,c' },
    { name: 'partialMarking', label: 'Partial marking', type: 'checkbox', showIf: (v) => v.type === 'msq', help: 'Proportional marks if no wrong option chosen' },
    { name: 'numericAnswer', label: 'Numeric answer', type: 'number', showIf: (v) => v.type === 'numerical' },
    { name: 'tolerance', label: 'Tolerance (±)', type: 'number', showIf: (v) => v.type === 'numerical', defaultValue: '0' },
    { name: 'solution', label: 'Detailed solution (LaTeX supported)', type: 'math' },
    { name: 'topic', label: 'Topic', type: 'text' },
    { name: 'tags', label: 'Tags', type: 'list', placeholder: 'One per line, e.g. JEE 2024' },
  ];
}

export function parseOptions(text: string) {
  return text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((t, i) => ({ id: String.fromCharCode(97 + i), text: t }));
}

export function flattenKey(key: QuestionBankItem['key'] | undefined) {
  return {
    correctOptionIds: (key?.correctOptionIds ?? []).join(','),
    numericAnswer: key?.numericAnswer ?? null,
    tolerance: key?.tolerance ?? 0,
    partialMarking: key?.partialMarking ?? false,
    solution: key?.solution ?? '',
  };
}


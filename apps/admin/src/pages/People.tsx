import { useMemo, useState } from 'react';
import { collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import {
  BOARDS,
  BOARD_LABELS,
  CLASS_LEVELS,
  COL,
  TEACHER_PERMISSIONS,
  formatDate,
  type Parent,
  type Student,
  type Teacher,
} from '@svr/shared';
import { db, errorMessage, fn } from '../lib/firebase';
import { apiJson } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useQuery, type Row } from '../lib/hooks';
import Form, { opts, type FieldDef } from '../components/Form';
import { Badge, Modal, PageHeader, SearchInput, Stat, Table, Toast } from '../components/ui';

const classOpts = CLASS_LEVELS.map((c) => [String(c), `Class ${c}`] as const);
const boardOpts = opts(BOARDS, BOARD_LABELS);
const permOpts = TEACHER_PERMISSIONS.map((p) => [p, p.replace('.', ' · ')] as const);

const loginFields: FieldDef[] = [
  { name: 'name', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'text', help: 'Email or mobile is required' },
  { name: 'phone', label: 'Mobile', type: 'text', placeholder: '98xxxxxxxx' },
  { name: 'password', label: 'Initial password', type: 'text', help: 'Min. 8 characters (email accounts). Share securely.' },
];

function clean(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)));
}

function useToast() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  return { msg, clear: () => setMsg(null), ok: (text: string) => setMsg({ text }), fail: (e: unknown) => setMsg({ text: errorMessage(e), error: true }) };
}

/* ============================== STUDENTS ============================== */

interface Analytics {
  testsTaken: number;
  averageScorePct: number;
  overallAccuracy: number;
  bestRank: number | null;
  improvement: number;
  strongChapters: { chapterTitle: string; scorePct: number }[];
  revisionChapters: { chapterTitle: string; scorePct: number }[];
  trend: { examTitle: string; scorePct: number }[];
}

export function Students() {
  const { can } = useAuth();
  const isAdmin = can('admin');
  const { rows, loading } = useQuery<Student>(query(collection(db, COL.students), orderBy('createdAt', 'desc')));
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [mode, setMode] = useState<{ kind: 'create' } | { kind: 'edit'; row: Row<Student> } | { kind: 'report'; row: Row<Student> } | null>(null);
  const [report, setReport] = useState<Analytics | null | 'error'>(null);
  const t = useToast();

  const filtered = rows.filter(
    (s) =>
      (!classFilter || String(s.classLevel) === classFilter) &&
      (!search || [s.name, s.admissionNo, s.phone, s.email].some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase()))),
  );

  const editFields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'classLevel', label: 'Class', type: 'select', options: classOpts, required: true },
    { name: 'board', label: 'Board', type: 'select', options: boardOpts, required: true },
    { name: 'school', label: 'School', type: 'text' },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'enrolledCourseIds', label: 'Enrolled courses', type: 'refmulti', refCollection: COL.courses, refLabel: 'title' },
  ];

  async function toggleStatus(s: Row<Student>) {
    const status = s.status === 'active' ? 'suspended' : 'active';
    if (status === 'suspended' && !confirm(`Suspend ${s.name}? They will be signed out of every device.`)) return;
    try {
      await fn.setUserStatus({ uid: s.id, status });
      t.ok(`${s.name} ${status}`);
    } catch (e) {
      t.fail(e);
    }
  }

  async function openReport(row: Row<Student>) {
    setMode({ kind: 'report', row });
    setReport(null);
    apiJson<Analytics>(`/analytics/students/${row.id}`).then(setReport, () => setReport('error'));
  }

  return (
    <>
      <PageHeader title="Students" sub={`${rows.length} students · ${rows.filter((r) => r.status === 'active').length} active`} actions={isAdmin && <button className="btn-primary" onClick={() => setMode({ kind: 'create' })}>+ Add student</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, admission no, phone…" />
        <select className="field max-w-40" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <Table
        rows={filtered}
        loading={loading}
        columns={[
          { key: 'name', label: 'Student', render: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-900/50">{s.admissionNo}</p></div> },
          { key: 'classLevel', label: 'Class', render: (s) => `${s.classLevel} · ${BOARD_LABELS[s.board] ?? s.board}` },
          { key: 'contact', label: 'Contact', render: (s) => <div className="text-xs"><p>{s.phone ?? '—'}</p><p className="text-ink-900/50">{s.email}</p></div> },
          { key: 'parent', label: 'Parent', render: (s) => <div className="text-xs"><p>{s.parent?.name ?? '—'}</p><p className="text-ink-900/50">{s.parent?.phone}</p></div> },
          { key: 'courses', label: 'Courses', render: (s) => (s.enrolledCourseIds ?? []).length },
          { key: 'createdAt', label: 'Joined', render: (s) => formatDate(s.createdAt) },
          { key: 'status', label: 'Status', render: (s) => <Badge>{s.status}</Badge> },
        ]}
        actions={(s) => (
          <>
            <button className="btn-soft btn-xs" onClick={() => openReport(s)}>Report</button>
            {isAdmin && <button className="btn-soft btn-xs" onClick={() => setMode({ kind: 'edit', row: s })}>Edit</button>}
            {isAdmin && <button className={`btn-soft btn-xs ${s.status === 'active' ? 'text-rose-600' : 'text-emerald-700'}`} onClick={() => toggleStatus(s)}>{s.status === 'active' ? 'Suspend' : 'Activate'}</button>}
          </>
        )}
      />

      <Modal open={mode?.kind === 'create'} title="Add student" onClose={() => setMode(null)}>
        <Form
          fields={[
            ...loginFields,
            { name: 'classLevel', label: 'Class', type: 'select', options: classOpts, required: true },
            { name: 'board', label: 'Board', type: 'select', options: boardOpts, required: true },
            { name: 'courseIds', label: 'Enrol in courses', type: 'refmulti', refCollection: COL.courses, refLabel: 'title' },
          ]}
          submitLabel="Create student account"
          onCancel={() => setMode(null)}
          onSubmit={async (d) => {
            await fn.adminCreateUser({ ...clean(d), role: 'student' }).catch((e) => { throw new Error(errorMessage(e)); });
            setMode(null);
            t.ok('Student created');
          }}
        />
      </Modal>

      <Modal open={mode?.kind === 'edit'} title="Edit student" onClose={() => setMode(null)}>
        {mode?.kind === 'edit' && (
          <Form
            fields={editFields}
            initial={mode.row as unknown as Record<string, unknown>}
            onCancel={() => setMode(null)}
            onSubmit={async (d) => {
              await updateDoc(doc(db, COL.students, mode.row.id), d);
              setMode(null);
              t.ok('Saved');
            }}
          />
        )}
      </Modal>

      <Modal open={mode?.kind === 'report'} title={mode?.kind === 'report' ? `Performance — ${mode.row.name}` : ''} onClose={() => setMode(null)} wide>
        {report === null && <p className="text-sm text-ink-900/50">Loading analytics…</p>}
        {report === 'error' && <p className="text-sm text-rose-600">Could not load analytics (is the API deployed?).</p>}
        {report && report !== 'error' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Tests taken" value={report.testsTaken} />
              <Stat label="Average score" value={`${report.averageScorePct}%`} />
              <Stat label="Accuracy" value={`${report.overallAccuracy}%`} />
              <Stat label="Improvement" value={`${report.improvement > 0 ? '+' : ''}${report.improvement}%`} hint={report.bestRank ? `Best rank #${report.bestRank}` : undefined} />
            </div>
            <div>
              <p className="label">Score trend</p>
              <div className="flex h-32 items-end gap-1.5 rounded-xl bg-paper p-3">
                {report.trend.map((p, i) => (
                  <div key={i} title={`${p.examTitle}: ${p.scorePct}%`} className="flex-1 rounded-t bg-royal-500" style={{ height: `${Math.max(4, p.scorePct)}%` }} />
                ))}
                {report.trend.length === 0 && <p className="m-auto text-xs text-ink-900/40">No tests yet</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChapterList title="Strong chapters" items={report.strongChapters} tone="text-emerald-700" />
              <ChapterList title="Needs revision" items={report.revisionChapters} tone="text-rose-600" />
            </div>
          </div>
        )}
      </Modal>
      <Toast msg={t.msg} onClose={t.clear} />
    </>
  );
}

function ChapterList({ title, items, tone }: { title: string; items: { chapterTitle: string; scorePct: number }[]; tone: string }) {
  return (
    <div className="rounded-xl border border-ink-900/8 p-4">
      <p className="label">{title}</p>
      {items.length === 0 ? <p className="text-xs text-ink-900/40">—</p> : items.map((c) => (
        <div key={c.chapterTitle} className="flex justify-between py-1 text-sm"><span>{c.chapterTitle}</span><span className={`font-semibold ${tone}`}>{c.scorePct}%</span></div>
      ))}
    </div>
  );
}

/* ============================== TEACHERS ============================== */

export function Teachers() {
  const { rows, loading } = useQuery<Teacher>(query(collection(db, COL.teachers), orderBy('name')));
  const [mode, setMode] = useState<{ kind: 'create' } | { kind: 'edit'; row: Row<Teacher> } | null>(null);
  const t = useToast();

  const profileFields: FieldDef[] = [
    { name: 'permissions', label: 'Permissions', type: 'multiselect', options: permOpts },
    { name: 'courseIds', label: 'Assigned courses', type: 'refmulti', refCollection: COL.courses, refLabel: 'title' },
    { name: 'subjects', label: 'Subjects', type: 'list', defaultValue: 'Mathematics' },
  ];

  return (
    <>
      <PageHeader title="Teachers" sub="Accounts, permissions and course assignments" actions={<button className="btn-primary" onClick={() => setMode({ kind: 'create' })}>+ Add teacher</button>} />
      <Table
        rows={rows}
        loading={loading}
        columns={[
          { key: 'name', label: 'Teacher', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-ink-900/50">{r.email}</p></div> },
          { key: 'subjects', label: 'Subjects', render: (r) => (r.subjects ?? []).join(', ') },
          { key: 'permissions', label: 'Permissions', render: (r) => <div className="flex max-w-md flex-wrap gap-1">{(r.permissions ?? []).map((p) => <Badge key={p} tone="blue">{p}</Badge>)}</div> },
          { key: 'courseIds', label: 'Courses', render: (r) => (r.courseIds ?? []).length },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        actions={(r) => (
          <>
            <button className="btn-soft btn-xs" onClick={() => setMode({ kind: 'edit', row: r })}>Permissions</button>
            <button className="btn-soft btn-xs" onClick={() => fn.setUserStatus({ uid: r.id, status: r.status === 'active' ? 'suspended' : 'active' }).then(() => t.ok('Updated'), t.fail)}>
              {r.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          </>
        )}
      />
      <Modal open={mode?.kind === 'create'} title="Add teacher" onClose={() => setMode(null)}>
        <Form
          fields={[...loginFields, ...profileFields]}
          submitLabel="Create teacher account"
          onCancel={() => setMode(null)}
          onSubmit={async (d) => {
            await fn.adminCreateUser({ ...clean(d), role: 'teacher' }).catch((e) => { throw new Error(errorMessage(e)); });
            setMode(null);
            t.ok('Teacher created');
          }}
        />
      </Modal>
      <Modal open={mode?.kind === 'edit'} title="Teacher permissions" onClose={() => setMode(null)}>
        {mode?.kind === 'edit' && (
          <Form
            fields={[...profileFields, { name: 'qualification', label: 'Qualification', type: 'text' }]}
            initial={mode.row as unknown as Record<string, unknown>}
            onCancel={() => setMode(null)}
            onSubmit={async (d) => {
              await fn.updateTeacher({ uid: mode.row.id, ...d, qualification: d.qualification || undefined }).catch((e) => { throw new Error(errorMessage(e)); });
              setMode(null);
              t.ok('Permissions updated — takes effect at the teacher’s next sign-in or within an hour');
            }}
          />
        )}
      </Modal>
      <Toast msg={t.msg} onClose={t.clear} />
    </>
  );
}

/* ============================== PARENTS ============================== */

export function Parents() {
  const { rows, loading } = useQuery<Parent>(query(collection(db, COL.parents), orderBy('name')));
  const students = useQuery<Student>(query(collection(db, COL.students), orderBy('name')));
  const names = useMemo(() => new Map(students.rows.map((s) => [s.id, s.name])), [students.rows]);
  const [mode, setMode] = useState<{ kind: 'create' } | { kind: 'link'; row: Row<Parent> } | null>(null);
  const t = useToast();
  const childField: FieldDef = { name: 'childIds', label: 'Children', type: 'refmulti', refCollection: COL.students, refLabel: 'name', required: true };

  return (
    <>
      <PageHeader title="Parents" sub="Parent portal accounts — each parent sees only their linked children" actions={<button className="btn-primary" onClick={() => setMode({ kind: 'create' })}>+ Add parent</button>} />
      <Table
        rows={rows}
        loading={loading}
        columns={[
          { key: 'name', label: 'Parent', render: (r) => <p className="font-medium">{r.name}</p> },
          { key: 'contact', label: 'Contact', render: (r) => <div className="text-xs"><p>{r.phone ?? '—'}</p><p className="text-ink-900/50">{r.email}</p></div> },
          { key: 'children', label: 'Children', render: (r) => (r.childIds ?? []).map((id) => names.get(id) ?? id).join(', ') || '—' },
        ]}
        actions={(r) => <button className="btn-soft btn-xs" onClick={() => setMode({ kind: 'link', row: r })}>Link children</button>}
      />
      <Modal open={mode?.kind === 'create'} title="Add parent" onClose={() => setMode(null)}>
        <Form
          fields={[...loginFields, childField]}
          submitLabel="Create parent account"
          onCancel={() => setMode(null)}
          onSubmit={async (d) => {
            await fn.adminCreateUser({ ...clean(d), role: 'parent' }).catch((e) => { throw new Error(errorMessage(e)); });
            setMode(null);
            t.ok('Parent created');
          }}
        />
      </Modal>
      <Modal open={mode?.kind === 'link'} title="Link children" onClose={() => setMode(null)}>
        {mode?.kind === 'link' && (
          <Form
            fields={[childField]}
            initial={mode.row as unknown as Record<string, unknown>}
            onCancel={() => setMode(null)}
            onSubmit={async (d) => {
              await fn.linkParent({ parentUid: mode.row.id, childIds: d.childIds as string[] }).catch((e) => { throw new Error(errorMessage(e)); });
              setMode(null);
              t.ok('Children linked');
            }}
          />
        )}
      </Modal>
      <Toast msg={t.msg} onClose={t.clear} />
    </>
  );
}

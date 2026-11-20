import { useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, Timestamp, limit } from 'firebase/firestore';
import {
  BOARD_LABELS,
  BOARDS,
  CLASS_LEVELS,
  COL,
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  PAYMENT_METHODS,
  formatDate,
  formatDateTime,
  formatINR,
  normalizePhone,
  type Announcement,
  type Enquiry,
  type FacultyMember,
  type FreeMaterial,
  type Invoice,
  type Payment,
  type PublicSettings,
  type Student,
  type Testimonial,
  type Topper,
} from '@svr/shared';
import { db, errorMessage, fn } from '../lib/firebase';
import { downloadCsv } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDoc, useQuery, type Row } from '../lib/hooks';
import ResourcePage from '../components/ResourcePage';
import Form, { opts } from '../components/Form';
import { Badge, Modal, PageHeader, Stat, Table, Toast } from '../components/ui';
import { StudentName } from './Academics';

/* ============================== ADMISSIONS ============================== */

export function Admissions() {
  return (
    <ResourcePage<Enquiry>
      title="Admissions & Enquiries"
      sub="Website admission forms, demo bookings and contact requests. Track every lead to conversion."
      collection={COL.enquiries}
      order={['createdAt', 'desc']}
      searchKeys={['name', 'phone', 'email', 'courseSlug']}
      createLabel="Walk-in enquiry"
      canDelete
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'phone', label: 'Mobile', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'type', label: 'Type', type: 'select', options: opts(ENQUIRY_TYPES), required: true, defaultValue: 'admission' },
        { name: 'classLevel', label: 'Class', type: 'select', options: CLASS_LEVELS.map((c) => [String(c), `Class ${c}`] as const) },
        { name: 'board', label: 'Board', type: 'select', options: opts(BOARDS, BOARD_LABELS) },
        { name: 'courseSlug', label: 'Course', type: 'text' },
        { name: 'preferredSlot', label: 'Preferred slot', type: 'text' },
        { name: 'status', label: 'Status', type: 'select', options: opts(ENQUIRY_STATUSES), required: true, defaultValue: 'new' },
        { name: 'notes', label: 'Follow-up notes', type: 'textarea' },
        { name: 'message', label: 'Message', type: 'textarea' },
      ]}
      save={async (d, existing) => {
        const data = { ...d, phone: normalizePhone(String(d.phone)) };
        if (existing) await setDoc(doc(db, COL.enquiries, existing.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        else await addDoc(collection(db, COL.enquiries), { ...data, source: 'walk_in', createdAt: serverTimestamp() });
      }}
      columns={[
        { key: 'name', label: 'Lead', render: (e) => <div><p className="font-medium">{e.name}</p><p className="text-xs text-ink-900/50">{e.phone}{e.email ? ` · ${e.email}` : ''}</p></div> },
        { key: 'type', label: 'Type', render: (e) => <Badge tone="blue">{e.type}</Badge> },
        { key: 'interest', label: 'Interest', render: (e) => <span className="text-xs">{[e.classLevel && `Class ${e.classLevel}`, e.board && BOARD_LABELS[e.board], e.courseSlug, e.preferredSlot].filter(Boolean).join(' · ') || '—'}</span> },
        { key: 'createdAt', label: 'Received', render: (e) => formatDateTime(e.createdAt) },
        { key: 'status', label: 'Status', render: (e) => <Badge>{e.status}</Badge> },
      ]}
      rowActions={(e) => (
        <a className="btn-soft btn-xs" target="_blank" rel="noreferrer" href={`https://wa.me/${e.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${e.name}, thank you for contacting SVR Maths Academy.`)}`}>WhatsApp</a>
      )}
    />
  );
}

/* ============================== FEES ============================== */

export function Fees() {
  const [paying, setPaying] = useState<Row<Invoice> | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const open = useQuery<Invoice>(query(collection(db, COL.invoices), where('status', 'in', ['pending', 'partial'])));
  const due = open.rows.reduce((s, i) => s + i.amountPaise - (i.paidPaise ?? 0), 0);
  const overdue = open.rows.filter((i) => (i.dueDate as Timestamp).toMillis() < Date.now());

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat accent label="Outstanding" value={formatINR(due)} hint={`${open.rows.length} open invoices`} />
        <Stat label="Overdue" value={overdue.length} hint={formatINR(overdue.reduce((s, i) => s + i.amountPaise - (i.paidPaise ?? 0), 0))} />
        <Stat label="Collect offline" value="Cash / UPI / Bank" hint="Use “Record payment” on an invoice" />
      </div>
      <ResourcePage<Invoice>
        title="Fees & Invoices"
        sub="Raise invoices for students; they pay online via Razorpay or you record offline payments. Course invoices auto-enrol students when fully paid."
        collection={COL.invoices}
        order={['dueDate', 'desc']}
        searchKeys={['studentName', 'title', 'status']}
        createLabel="New invoice"
        headerActions={<button className="btn-soft" onClick={() => downloadCsv('/reports/fees.csv', 'svr-fees.csv').catch((e) => setMsg({ text: e.message, error: true }))}>Export CSV</button>}
        fields={[
          { name: 'studentId', label: 'Student', type: 'ref', refCollection: COL.students, refLabel: 'name', required: true },
          { name: 'courseId', label: 'Course (enrols on full payment)', type: 'ref', refCollection: COL.courses, refLabel: 'title' },
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Class 10 CBSE — Term 1 fee' },
          { name: 'amountPaise', label: 'Amount', type: 'money', required: true },
          { name: 'dueDate', label: 'Due date', type: 'date', required: true },
          { name: 'status', label: 'Status', type: 'select', options: opts(['pending', 'partial', 'paid', 'cancelled'] as const), defaultValue: 'pending', required: true },
        ]}
        save={async (d, existing) => {
          const s = await getDoc(doc(db, COL.students, String(d.studentId)));
          const data = { ...d, studentName: (s.get('name') as string) ?? '' };
          if (existing) await setDoc(doc(db, COL.invoices, existing.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
          else await addDoc(collection(db, COL.invoices), { ...data, paidPaise: 0, createdAt: serverTimestamp() });
        }}
        columns={[
          { key: 'studentName', label: 'Student', render: (i) => <span className="font-medium">{i.studentName}</span> },
          { key: 'title', label: 'Invoice' },
          { key: 'amount', label: 'Amount', render: (i) => <div><p>{formatINR(i.amountPaise)}</p>{(i.paidPaise ?? 0) > 0 && <p className="text-xs text-emerald-700">paid {formatINR(i.paidPaise)}</p>}</div> },
          { key: 'dueDate', label: 'Due', render: (i) => <span className={(i.dueDate as Timestamp).toMillis() < Date.now() && i.status !== 'paid' ? 'font-semibold text-rose-600' : ''}>{formatDate(i.dueDate)}</span> },
          { key: 'status', label: 'Status', render: (i) => <Badge>{i.status}</Badge> },
        ]}
        rowActions={(i) => (i.status === 'pending' || i.status === 'partial' ? <button className="btn-gold btn-xs" onClick={() => setPaying(i)}>Record payment</button> : null)}
      />
      <Modal open={!!paying} title={`Record payment — ${paying?.studentName ?? ''}`} onClose={() => setPaying(null)}>
        {paying && (
          <Form
            fields={[
              { name: 'amountPaise', label: 'Amount received', type: 'money', required: true },
              { name: 'method', label: 'Method', type: 'select', options: opts(PAYMENT_METHODS.filter((m) => m !== 'razorpay')), required: true, defaultValue: 'cash' },
              { name: 'reference', label: 'Reference / UTR / cheque no.', type: 'text' },
            ]}
            initial={{ amountPaise: paying.amountPaise - (paying.paidPaise ?? 0) }}
            submitLabel="Record & issue receipt"
            onCancel={() => setPaying(null)}
            onSubmit={async (d) => {
              const r = await fn.recordOfflinePayment({ invoiceId: paying.id, amountPaise: d.amountPaise, method: d.method, reference: d.reference || undefined }).catch((e) => { throw new Error(errorMessage(e)); });
              setPaying(null);
              setMsg({ text: `Payment recorded — receipt ${r.receiptNo}` });
            }}
          />
        )}
      </Modal>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

export function Payments() {
  const { rows, loading } = useQuery<Payment>(query(collection(db, COL.payments), orderBy('createdAt', 'desc'), limit(500)));
  const paid = rows.filter((p) => p.status === 'paid');
  return (
    <>
      <PageHeader title="Payments" sub="Online (Razorpay, server-verified) and offline payments" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat accent label="Collected (shown)" value={formatINR(paid.reduce((s, p) => s + p.amountPaise, 0))} hint={`${paid.length} payments`} />
        <Stat label="Online" value={paid.filter((p) => p.method === 'razorpay').length} />
        <Stat label="Failed / abandoned" value={rows.filter((p) => p.status !== 'paid').length} />
      </div>
      <Table
        rows={rows}
        loading={loading}
        columns={[
          { key: 'receiptNo', label: 'Receipt', render: (p) => p.receiptNo ?? '—' },
          { key: 'studentId', label: 'Student', render: (p) => <StudentName id={p.studentId} /> },
          { key: 'amount', label: 'Amount', render: (p) => <b>{formatINR(p.amountPaise)}</b> },
          { key: 'method', label: 'Method', render: (p) => p.method.replace('_', ' ') },
          { key: 'ref', label: 'Reference', render: (p) => <span className="font-mono text-xs">{p.razorpayPaymentId ?? (p as unknown as { reference?: string }).reference ?? '—'}</span> },
          { key: 'date', label: 'Date', render: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
          { key: 'status', label: 'Status', render: (p) => <Badge>{p.status}</Badge> },
        ]}
      />
    </>
  );
}

/* ============================== NOTIFICATIONS ============================== */

export function Announcements() {
  const { user } = useAuth();
  return (
    <ResourcePage<Announcement>
      title="Notifications & Announcements"
      sub="Announcements appear in the student/parent apps. Tick “Push” to also send a phone notification (FCM)."
      collection={COL.announcements}
      order={['publishedAt', 'desc']}
      createLabel="New announcement"
      canEdit={false}
      canDelete
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true, full: true },
        { name: 'body', label: 'Message', type: 'textarea', required: true },
        { name: 'audience', label: 'Audience', type: 'select', options: opts(['all', 'students', 'parents', 'teachers', 'course'] as const), required: true, defaultValue: 'all' },
        { name: 'courseId', label: 'Course', type: 'ref', refCollection: COL.courses, refLabel: 'title', showIf: (v) => v.audience === 'course' },
        { name: 'push', label: 'Push notification', type: 'checkbox', defaultValue: true, help: 'Send to phones now' },
      ]}
      onCreateExtra={() => ({ publishedAt: serverTimestamp(), createdBy: user?.uid })}
      columns={[
        { key: 'title', label: 'Announcement', render: (a) => <div className="max-w-lg"><p className="font-medium">{a.title}</p><p className="truncate text-xs text-ink-900/55">{a.body}</p></div> },
        { key: 'audience', label: 'Audience', render: (a) => <Badge tone="blue">{a.audience}</Badge> },
        { key: 'push', label: 'Push', render: (a) => (a.push ? ((a as unknown as { pushedAt?: unknown }).pushedAt ? 'Sent' : 'Queued') : '—') },
        { key: 'publishedAt', label: 'Published', render: (a) => formatDateTime(a.publishedAt) },
      ]}
    />
  );
}

/* ============================== WEBSITE CONTENT ============================== */

export function WebsiteContent() {
  const [tab, setTab] = useState<'faculty' | 'testimonials' | 'toppers' | 'materials'>('faculty');
  return (
    <>
      <PageHeader title="Website Content" sub="Everything on SVR Academy (the public website) is managed here." />
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-white p-1 text-sm font-medium shadow-sm ring-1 ring-ink-900/8 sm:w-fit">
        {(['faculty', 'testimonials', 'toppers', 'materials'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 capitalize ${tab === t ? 'bg-ink-900 text-white' : 'text-ink-900/60'}`}>{t === 'materials' ? 'Free materials' : t}</button>
        ))}
      </div>
      {tab === 'faculty' && (
        <ResourcePage<FacultyMember>
          key="faculty" compact title="Faculty" collection={COL.faculty} order={['order', 'asc']} canDelete createLabel="Faculty member"
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'title', label: 'Designation', type: 'text', required: true },
            { name: 'experienceYears', label: 'Experience (years)', type: 'number' },
            { name: 'order', label: 'Order', type: 'number', defaultValue: '1' },
            { name: 'bio', label: 'Bio', type: 'textarea' },
            { name: 'photoUrl', label: 'Photo', type: 'file', accept: 'image/*', storageDir: () => 'public/faculty' },
          ]}
          columns={[{ key: 'name', label: 'Name' }, { key: 'title', label: 'Designation' }, { key: 'order', label: 'Order' }]}
        />
      )}
      {tab === 'testimonials' && (
        <ResourcePage<Testimonial>
          key="testimonials" compact title="Testimonials" collection={COL.testimonials} canDelete createLabel="Testimonial"
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'detail', label: 'Detail', type: 'text', placeholder: 'Class 10 CBSE — 98/100' },
            { name: 'rating', label: 'Rating (1–5)', type: 'number', defaultValue: '5' },
            { name: 'published', label: 'Published', type: 'checkbox', defaultValue: true },
            { name: 'quote', label: 'Quote', type: 'textarea', required: true },
          ]}
          columns={[{ key: 'name', label: 'Name' }, { key: 'detail', label: 'Detail' }, { key: 'published', label: 'Status', render: (t) => <Badge>{t.published ? 'published' : 'draft'}</Badge> }]}
        />
      )}
      {tab === 'toppers' && (
        <ResourcePage<Topper>
          key="toppers" compact title="Results / Toppers" collection={COL.toppers} order={['order', 'asc']} canDelete createLabel="Topper"
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'exam', label: 'Exam', type: 'text', required: true },
            { name: 'score', label: 'Score', type: 'text', required: true },
            { name: 'year', label: 'Year', type: 'text', required: true },
            { name: 'order', label: 'Order', type: 'number', defaultValue: '1' },
            { name: 'photoUrl', label: 'Photo', type: 'file', accept: 'image/*', storageDir: () => 'public/toppers' },
          ]}
          columns={[{ key: 'name', label: 'Name' }, { key: 'exam', label: 'Exam' }, { key: 'score', label: 'Score' }, { key: 'year', label: 'Year' }]}
        />
      )}
      {tab === 'materials' && (
        <ResourcePage<FreeMaterial>
          key="materials" compact title="Free Study Materials" collection={COL.materials} canDelete createLabel="Material"
          fields={[
            { name: 'title', label: 'Title', type: 'text', required: true, full: true },
            { name: 'kind', label: 'Kind', type: 'select', options: opts(['notes', 'formula_sheet', 'pyq', 'worksheet', 'sample_paper'] as const), required: true },
            { name: 'board', label: 'Board', type: 'select', options: opts(BOARDS, BOARD_LABELS), required: true },
            { name: 'classLevel', label: 'Class', type: 'select', options: CLASS_LEVELS.map((c) => [String(c), `Class ${c}`] as const) },
            { name: 'fileUrl', label: 'PDF', type: 'file', accept: 'application/pdf', storageDir: () => 'public/materials', required: true },
            { name: 'published', label: 'Published', type: 'checkbox', defaultValue: true },
          ]}
          columns={[{ key: 'title', label: 'Title' }, { key: 'kind', label: 'Kind' }, { key: 'board', label: 'Board' }, { key: 'published', label: 'Status', render: (m) => <Badge>{m.published ? 'published' : 'draft'}</Badge> }]}
        />
      )}
    </>
  );
}

/* ============================== REPORTS ============================== */

export function Reports() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const exams = useQuery<{ title: string }>(query(collection(db, COL.exams), orderBy('createdAt', 'desc'), limit(100)));
  const [examId, setExamId] = useState('');
  const [busy, setBusy] = useState('');

  async function studentsCsv() {
    setBusy('students');
    try {
      const snap = await getDocs(query(collection(db, COL.students), orderBy('createdAt', 'desc')));
      const rows = snap.docs.map((d) => {
        const s = d.data() as Student;
        return [s.admissionNo, s.name, s.classLevel, s.board, s.phone, s.email, s.parent?.name, s.parent?.phone, (s.enrolledCourseIds ?? []).join(' '), s.status, formatDate(s.createdAt)];
      });
      const esc = (v: unknown) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const csv = [['Admission No', 'Name', 'Class', 'Board', 'Phone', 'Email', 'Parent', 'Parent phone', 'Courses', 'Status', 'Joined'], ...rows].map((r) => r.map(esc).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'svr-students.csv';
      a.click();
    } finally {
      setBusy('');
    }
  }

  const run = (key: string, p: Promise<unknown>) => {
    setBusy(key);
    p.catch((e) => setMsg({ text: (e as Error).message, error: true })).finally(() => setBusy(''));
  };

  return (
    <>
      <PageHeader title="Reports" sub="Financial and academic exports" />
      <div className="grid gap-5 md:grid-cols-3">
        <div className="panel p-6">
          <h2 className="font-semibold">Fee ledger</h2>
          <p className="mt-1 text-sm text-ink-900/60">All invoices with paid and balance amounts.</p>
          <button className="btn-primary mt-4" disabled={!!busy} onClick={() => run('fees', downloadCsv('/reports/fees.csv', 'svr-fees.csv'))}>{busy === 'fees' ? 'Preparing…' : 'Download CSV'}</button>
        </div>
        <div className="panel p-6">
          <h2 className="font-semibold">Student register</h2>
          <p className="mt-1 text-sm text-ink-900/60">Admission numbers, contacts, parents and enrolments.</p>
          <button className="btn-primary mt-4" disabled={!!busy} onClick={studentsCsv}>{busy === 'students' ? 'Preparing…' : 'Download CSV'}</button>
        </div>
        <div className="panel p-6">
          <h2 className="font-semibold">Exam rank list</h2>
          <select className="field mt-3" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam…</option>
            {exams.rows.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <button className="btn-primary mt-4" disabled={!examId || !!busy} onClick={() => run('rank', downloadCsv(`/reports/exams/${examId}/ranklist.csv`, `ranklist-${examId}.csv`))}>{busy === 'rank' ? 'Preparing…' : 'Download CSV'}</button>
        </div>
      </div>
      <p className="mt-6 text-sm text-ink-900/55">Individual student performance reports (chapter-wise accuracy, strong areas, revision topics and trends) are available from <b>Students → Report</b>.</p>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}

/* ============================== SETTINGS ============================== */

export function Settings() {
  const s = useDoc<PublicSettings>(doc(db, COL.settings, 'public'));
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  if (s.loading) return <p className="text-sm text-ink-900/50">Loading…</p>;
  return (
    <>
      <PageHeader title="Settings" sub="Academy details shown on the website and apps" />
      <div className="panel max-w-3xl p-6">
        <Form
          initial={s.data as unknown as Record<string, unknown>}
          fields={[
            { name: 'academyName', label: 'Academy name', type: 'text', required: true },
            { name: 'tagline', label: 'Tagline', type: 'text', required: true },
            { name: 'academicYear', label: 'Academic year', type: 'text', required: true },
            { name: 'phone', label: 'Phone', type: 'text', required: true },
            { name: 'whatsapp', label: 'WhatsApp number', type: 'text', required: true, help: 'Digits with country code, e.g. 919876543210' },
            { name: 'email', label: 'Email', type: 'text', required: true },
            { name: 'address', label: 'Address', type: 'textarea', required: true },
            { name: 'mapUrl', label: 'Google Maps link', type: 'text' },
            { name: 'admissionsOpen', label: 'Admissions open', type: 'checkbox' },
          ]}
          submitLabel="Save settings"
          onSubmit={async (d) => {
            await setDoc(doc(db, COL.settings, 'public'), d, { merge: true });
            setMsg({ text: 'Settings saved' });
          }}
        />
      </div>
      <Toast msg={msg} onClose={() => setMsg(null)} />
    </>
  );
}


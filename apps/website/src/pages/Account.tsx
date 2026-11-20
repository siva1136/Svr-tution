import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  COL,
  formatDate,
  formatDateTime,
  formatINR,
  toMillis,
  type Announcement,
  type Attempt,
  type Course,
  type Invoice,
  type LiveClass,
  type Student,
} from '@svr/shared';
import { callable, db, errorMessage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { payWithRazorpay } from '../lib/payments';
import { useSeo } from '../lib/seo';
import Icon from '../components/Icon';

type WithId<T> = T & { id: string };
const joinLiveClass = callable<{ classId: string }, { joinUrl: string; passcode: string | null }>('joinLiveClass');

interface Overview {
  student: WithId<Student>;
  courses: WithId<Course>[];
  classes: WithId<LiveClass>[];
  invoices: WithId<Invoice>[];
  attempts: WithId<Attempt>[];
}

async function loadOverview(studentId: string): Promise<Overview | null> {
  const s = await getDoc(doc(db!, COL.students, studentId));
  if (!s.exists()) return null;
  const student = { id: s.id, ...(s.data() as Student) };
  const ids = student.enrolledCourseIds ?? [];
  const since = Timestamp.fromMillis(Date.now() - 3 * 3600_000);

  const [courses, classLists, invoices, attempts] = await Promise.all([
    Promise.all(ids.map(async (id) => {
      const c = await getDoc(doc(db!, COL.courses, id));
      return c.exists() ? { id: c.id, ...(c.data() as Course) } : null;
    })),
    Promise.all(ids.map((id) => getDocs(query(collection(db!, COL.liveClasses), where('courseId', '==', id), where('startAt', '>=', since), orderBy('startAt'), limit(5))))),
    getDocs(query(collection(db!, COL.invoices), where('studentId', '==', studentId), orderBy('dueDate'))),
    getDocs(query(collection(db!, COL.attempts), where('studentId', '==', studentId), orderBy('submittedAt', 'desc'), limit(10))),
  ]);

  return {
    student,
    courses: courses.filter((c): c is WithId<Course> => !!c),
    classes: classLists
      .flatMap((q) => q.docs.map((d) => ({ id: d.id, ...(d.data() as LiveClass) })))
      .filter((c) => c.status !== 'cancelled')
      .sort((a, b) => (toMillis(a.startAt) ?? 0) - (toMillis(b.startAt) ?? 0)),
    invoices: invoices.docs.map((d) => ({ id: d.id, ...(d.data() as Invoice) })),
    attempts: attempts.docs.map((d) => ({ id: d.id, ...(d.data() as Attempt) })),
  };
}

export default function Account() {
  useSeo('My Account', 'Your SVR Learn account.');
  const { user, role, loading, logout } = useAuth();
  const [childIds, setChildIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (role === 'parent' && user && db) {
      getDoc(doc(db, COL.parents, user.uid)).then((p) => setChildIds((p.get('childIds') as string[]) ?? []));
    }
  }, [role, user]);

  if (loading) return <div className="container-x py-32 text-center text-ink-900/50">Loading…</div>;
  if (!user || !role) return <Navigate to="/login?next=/account" replace />;

  return (
    <section className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{role === 'parent' ? 'Parent portal' : 'SVR Learn'}</p>
          <h1 className="h-display mt-1 text-4xl">Hello, {user.displayName?.split(' ')[0] || 'there'}</h1>
        </div>
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </div>

      {(role === 'admin' || role === 'teacher') && (
        <div className="card mt-8 p-6">
          <p>You are signed in with a staff account. Manage the academy from <strong>SVR Control</strong>, the admin portal.</p>
        </div>
      )}
      {role === 'student' && <StudentOverview studentId={user.uid} canPay />}
      {role === 'parent' && (childIds === null ? <p className="mt-8 text-ink-900/50">Loading…</p> : childIds.length === 0 ? (
        <div className="card mt-8 p-6">No students are linked to your account yet. Please contact the academy.</div>
      ) : childIds.map((id) => <StudentOverview key={id} studentId={id} canPay showName />))}
    </section>
  );
}

function StudentOverview({ studentId, canPay, showName = false }: { studentId: string; canPay: boolean; showName?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null | undefined>(undefined);
  const [announcements, setAnnouncements] = useState<WithId<Announcement>[]>([]);
  const [msg, setMsg] = useState('');

  const reload = useCallback(() => {
    loadOverview(studentId).then(setData).catch((e) => { console.error(e); setData(null); });
    getDocs(query(collection(db!, COL.announcements), orderBy('publishedAt', 'desc'), limit(5)))
      .then((s) => setAnnouncements(s.docs.map((d) => ({ id: d.id, ...(d.data() as Announcement) }))))
      .catch(() => {});
  }, [studentId]);
  useEffect(reload, [reload]);

  if (data === undefined) return <p className="mt-8 text-ink-900/50">Loading your dashboard…</p>;
  if (data === null) return <div className="card mt-8 p-6">Profile not found.</div>;

  const due = data.invoices.filter((i) => i.status === 'pending' || i.status === 'partial');
  const pay = async (inv: WithId<Invoice>) => {
    setMsg('');
    try {
      const r = await payWithRazorpay({ invoiceId: inv.id }, { name: user?.displayName ?? '', email: user?.email ?? '', contact: user?.phoneNumber ?? '' });
      setMsg(`Payment successful. Receipt ${r.receiptNo}.`);
      reload();
    } catch (e) {
      setMsg(errorMessage(e));
    }
  };
  const join = async (c: WithId<LiveClass>) => {
    try {
      const r = await joinLiveClass({ classId: c.id });
      window.open(r.joinUrl, '_blank', 'noopener');
    } catch (e) {
      setMsg(errorMessage(e));
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {showName && <h2 className="h-display text-2xl">{data.student.name} <span className="text-base font-normal text-ink-900/50">· Class {data.student.classLevel}</span></h2>}
      {msg && <p className="rounded-2xl bg-royal-100 px-4 py-3 text-sm">{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['Admission no.', data.student.admissionNo ?? '—'],
          ['Courses', String(data.courses.length)],
          ['Upcoming classes', String(data.classes.length)],
          ['Fees due', formatINR(due.reduce((s, i) => s + i.amountPaise - (i.paidPaise ?? 0), 0))],
        ].map(([l, v]) => (
          <div key={l} className="card p-5">
            <p className="text-xs text-ink-900/50">{l}</p>
            <p className="mt-1 text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Enrolled courses" icon="doc">
          {data.courses.length === 0 ? <Empty text="No courses yet. Explore courses and enrol online." /> : data.courses.map((c) => (
            <Row key={c.id} title={c.title} sub={c.subtitle ?? ''} />
          ))}
          <p className="pt-3 text-xs text-ink-900/50">Lectures, notes and tests open in the SVR Learn app.</p>
        </Panel>

        <Panel title="Live classes" icon="live">
          {data.classes.length === 0 ? <Empty text="No upcoming classes scheduled." /> : data.classes.map((c) => (
            <Row key={c.id} title={c.title} sub={`${formatDateTime(c.startAt)} · ${c.durationMin} min`} action={!showName && <button className="btn-dark px-4 py-1.5 text-xs" onClick={() => join(c)}>Join</button>} />
          ))}
        </Panel>

        <Panel title="Fees" icon="shield">
          {data.invoices.length === 0 ? <Empty text="No invoices." /> : data.invoices.map((i) => (
            <Row
              key={i.id}
              title={i.title}
              sub={`${formatINR(i.amountPaise)} · due ${formatDate(i.dueDate)} · ${i.status}`}
              action={canPay && (i.status === 'pending' || i.status === 'partial') && (
                <button className="btn-gold px-4 py-1.5 text-xs" onClick={() => pay(i)}>Pay {formatINR(i.amountPaise - (i.paidPaise ?? 0))}</button>
              )}
            />
          ))}
        </Panel>

        <Panel title="Recent test results" icon="chart">
          {data.attempts.length === 0 ? <Empty text="No tests taken yet." /> : data.attempts.filter((a) => a.status !== 'in_progress').map((a) => (
            <Row key={a.id} title={`${a.score ?? 0} / ${a.maxScore ?? 0}`} sub={`${formatDate(a.submittedAt)} · accuracy ${a.accuracy ?? 0}%${a.rank ? ` · rank #${a.rank}` : ''}${a.status === 'submitted' ? ' · awaiting teacher evaluation' : ''}`} />
          ))}
        </Panel>
      </div>

      {announcements.length > 0 && !showName && (
        <Panel title="Announcements" icon="spark">
          {announcements.map((a) => <Row key={a.id} title={a.title} sub={a.body} />)}
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="flex items-center gap-2 font-semibold"><Icon name={icon} className="h-5 w-5 text-royal-600" />{title}</h3>
      <div className="mt-4 divide-y divide-ink-900/8">{children}</div>
    </div>
  );
}
function Row({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-ink-900/55">{sub}</p>
      </div>
      {action}
    </div>
  );
}
const Empty = ({ text }: { text: string }) => <p className="py-3 text-sm text-ink-900/50">{text}</p>;

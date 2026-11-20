import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp, collection, limit, orderBy, query, where } from 'firebase/firestore';
import { COL, formatDateTime, formatINR, type Enquiry, type Exam, type LiveClass } from '@svr/shared';
import { db } from '../lib/firebase';
import { apiJson } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useQuery } from '../lib/hooks';
import { Badge, PageHeader, Stat } from '../components/ui';

interface Summary {
  totalStudents: number;
  activeStudents: number;
  newAdmissions: number;
  totalCourses: number;
  upcomingClasses: number;
  totalExams: number;
  newEnquiries: number;
  teachers: number;
  monthlyRevenuePaise: number;
  pendingFeesPaise: number;
  overdueInvoices: number;
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const isAdmin = can('admin');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isAdmin) apiJson<Summary>('/reports/summary').then(setSummary, (e) => setErr(e.message));
  }, [isAdmin]);

  const now = useMemo(() => Timestamp.fromMillis(Date.now() - 2 * 3600_000), []);
  const classes = useQuery<LiveClass>(query(collection(db, COL.liveClasses), where('startAt', '>=', now), orderBy('startAt'), limit(6)));
  const exams = useQuery<Exam>(query(collection(db, COL.exams), orderBy('createdAt', 'desc'), limit(6)));
  const enquiries = useQuery<Enquiry>(isAdmin ? query(collection(db, COL.enquiries), orderBy('createdAt', 'desc'), limit(6)) : null, [isAdmin]);

  const n = (v: number | undefined) => (summary ? (v ?? 0).toLocaleString('en-IN') : '…');

  return (
    <>
      <PageHeader title={`Welcome, ${user?.displayName?.split(' ')[0] ?? 'there'}`} sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      {isAdmin && (
        <>
          {err && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Summary unavailable: {err}. Deploy the <code>api</code> function or start the emulators.</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat accent label="Monthly revenue" value={summary ? formatINR(summary.monthlyRevenuePaise) : '…'} hint="Collected this month" />
            <Stat label="Pending fees" value={summary ? formatINR(summary.pendingFeesPaise) : '…'} hint={summary ? `${summary.overdueInvoices} overdue invoices` : undefined} />
            <Stat label="Total students" value={n(summary?.totalStudents)} hint={summary ? `${summary.activeStudents} active` : undefined} />
            <Stat label="New admissions" value={n(summary?.newAdmissions)} hint="This month" />
            <Stat label="New enquiries" value={n(summary?.newEnquiries)} hint="Awaiting follow-up" />
            <Stat label="Courses" value={n(summary?.totalCourses)} />
            <Stat label="Upcoming classes" value={n(summary?.upcomingClasses)} />
            <Stat label="Teachers" value={n(summary?.teachers)} hint={summary ? `${summary.totalExams} exams created` : undefined} />
          </div>
        </>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card title="Upcoming live classes" link="/live">
          {classes.rows.map((c) => (
            <Item key={c.id} title={c.title} sub={formatDateTime(c.startAt)} badge={c.status} />
          ))}
          {!classes.loading && classes.rows.length === 0 && <p className="py-4 text-sm text-ink-900/50">No classes scheduled.</p>}
        </Card>
        <Card title="Recent examinations" link="/exams">
          {exams.rows.map((e) => (
            <Item key={e.id} title={e.title} sub={`${e.questionCount ?? 0} questions · ${e.totalMarks ?? 0} marks`} badge={e.resultsPublished ? 'evaluated' : e.published ? 'published' : 'draft'} />
          ))}
          {!exams.loading && exams.rows.length === 0 && <p className="py-4 text-sm text-ink-900/50">No exams yet.</p>}
        </Card>
        {isAdmin && (
          <Card title="Latest enquiries" link="/admissions">
            {enquiries.rows.map((e) => (
              <Item key={e.id} title={e.name} sub={`${e.type.replace('_', ' ')} · ${e.phone}`} badge={e.status} />
            ))}
            {!enquiries.loading && enquiries.rows.length === 0 && <p className="py-4 text-sm text-ink-900/50">No enquiries yet.</p>}
          </Card>
        )}
      </div>
    </>
  );
}

function Card({ title, link, children }: { title: string; link: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link to={link} className="text-xs font-semibold text-royal-600">View all →</Link>
      </div>
      <div className="divide-y divide-ink-900/6">{children}</div>
    </div>
  );
}

function Item({ title, sub, badge }: { title: string; sub: string; badge: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-ink-900/50">{sub}</p>
      </div>
      <Badge>{badge}</Badge>
    </div>
  );
}

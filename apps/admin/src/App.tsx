import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { TeacherPermission } from '@svr/shared';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const People = () => import('./pages/People');
const Academics = () => import('./pages/Academics');
const ExamsMod = () => import('./pages/Exams');
const Ops = () => import('./pages/Operations');

const Students = lazy(() => People().then((m) => ({ default: m.Students })));
const Teachers = lazy(() => People().then((m) => ({ default: m.Teachers })));
const Parents = lazy(() => People().then((m) => ({ default: m.Parents })));
const Courses = lazy(() => Academics().then((m) => ({ default: m.Courses })));
const CourseEditor = lazy(() => Academics().then((m) => ({ default: m.CourseEditor })));
const LiveClasses = lazy(() => Academics().then((m) => ({ default: m.LiveClasses })));
const Attendance = lazy(() => Academics().then((m) => ({ default: m.Attendance })));
const Homework = lazy(() => Academics().then((m) => ({ default: m.HomeworkPage })));
const QuestionBank = lazy(() => Academics().then((m) => ({ default: m.QuestionBank })));
const ExamsList = lazy(() => ExamsMod().then((m) => ({ default: m.ExamsList })));
const ExamBuilder = lazy(() => ExamsMod().then((m) => ({ default: m.ExamBuilder })));
const Admissions = lazy(() => Ops().then((m) => ({ default: m.Admissions })));
const Fees = lazy(() => Ops().then((m) => ({ default: m.Fees })));
const Payments = lazy(() => Ops().then((m) => ({ default: m.Payments })));
const Announcements = lazy(() => Ops().then((m) => ({ default: m.Announcements })));
const WebsiteContent = lazy(() => Ops().then((m) => ({ default: m.WebsiteContent })));
const Reports = lazy(() => Ops().then((m) => ({ default: m.Reports })));
const Settings = lazy(() => Ops().then((m) => ({ default: m.Settings })));

function Guard({ any, children }: { any: (TeacherPermission | 'admin')[]; children: ReactNode }) {
  const { can } = useAuth();
  return any.some((p) => can(p)) ? <>{children}</> : <div className="panel p-10 text-center text-sm text-ink-900/60">You don't have permission to view this page.</div>;
}

export default function App() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-ink-900/50">Loading SVR Control…</div>;
  if (!user || !(role === 'admin' || role === 'teacher')) return <Login />;

  return (
    <Layout>
      <Suspense fallback={<p className="text-sm text-ink-900/50">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<Guard any={['admin', 'students.view']}><Students /></Guard>} />
          <Route path="/teachers" element={<Guard any={['admin']}><Teachers /></Guard>} />
          <Route path="/parents" element={<Guard any={['admin']}><Parents /></Guard>} />
          <Route path="/admissions" element={<Guard any={['admin']}><Admissions /></Guard>} />
          <Route path="/courses" element={<Guard any={['courses.manage', 'content.upload']}><Courses /></Guard>} />
          <Route path="/courses/:courseId" element={<Guard any={['courses.manage', 'content.upload']}><CourseEditor /></Guard>} />
          <Route path="/live" element={<Guard any={['live.manage']}><LiveClasses /></Guard>} />
          <Route path="/attendance" element={<Guard any={['attendance.manage']}><Attendance /></Guard>} />
          <Route path="/exams" element={<Guard any={['exams.manage', 'exams.evaluate']}><ExamsList /></Guard>} />
          <Route path="/exams/:examId" element={<Guard any={['exams.manage', 'exams.evaluate']}><ExamBuilder /></Guard>} />
          <Route path="/question-bank" element={<Guard any={['exams.manage']}><QuestionBank /></Guard>} />
          <Route path="/homework" element={<Guard any={['homework.manage']}><Homework /></Guard>} />
          <Route path="/fees" element={<Guard any={['admin']}><Fees /></Guard>} />
          <Route path="/payments" element={<Guard any={['admin']}><Payments /></Guard>} />
          <Route path="/announcements" element={<Guard any={['announcements.send']}><Announcements /></Guard>} />
          <Route path="/website" element={<Guard any={['admin']}><WebsiteContent /></Guard>} />
          <Route path="/reports" element={<Guard any={['admin']}><Reports /></Guard>} />
          <Route path="/settings" element={<Guard any={['admin']}><Settings /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

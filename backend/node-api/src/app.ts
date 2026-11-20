import express, { type NextFunction, type Request, type Response } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { COL, toMillis, type Attempt, type Exam, type Invoice, type Role } from '@svr/shared';
import { buildStudentAnalytics, toCsv, type AttemptRow } from './analytics';

export interface Deps {
  db: Firestore;
  auth: Auth;
}

interface AuthedRequest extends Request {
  user?: { uid: string; role?: Role; perms: string[] };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ah =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function createApp({ db, auth }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Firebase Hosting rewrites keep the /api prefix; direct function URLs do not.
  const router = express.Router();
  app.use('/api', router);
  app.use('/', router);

  // ----- auth middleware -----
  const withAuth = (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return next(new HttpError(401, 'Missing bearer token'));
    auth
      .verifyIdToken(token, true)
      .then((decoded) => {
        req.user = { uid: decoded.uid, role: decoded.role as Role | undefined, perms: (decoded.perms as string[]) ?? [] };
        next();
      })
      .catch(() => next(new HttpError(401, 'Invalid or expired token')));
  };
  const requireRoles =
    (...roles: Role[]) =>
    (req: AuthedRequest, _res: Response, next: NextFunction) =>
      req.user?.role && roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));

  async function canViewStudent(user: NonNullable<AuthedRequest['user']>, studentId: string) {
    if (user.uid === studentId || user.role === 'admin' || user.role === 'teacher') return true;
    if (user.role === 'parent') {
      const p = await db.collection(COL.parents).doc(user.uid).get();
      return ((p.get('childIds') as string[] | undefined) ?? []).includes(studentId);
    }
    return false;
  }

  // ----- routes -----
  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'svr-api', time: new Date().toISOString() });
  });

  /** Headline numbers for the SVR Control dashboard. */
  router.get(
    '/reports/summary',
    withAuth,
    requireRoles('admin'),
    ah(async (_req, res) => {
      const now = new Date();
      const monthStart = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const nowTs = Timestamp.fromDate(now);
      const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;

      const [totalStudents, activeStudents, newAdmissions, totalCourses, upcomingClasses, totalExams, newEnquiries, teachers] = await Promise.all([
        count(db.collection(COL.students)),
        count(db.collection(COL.students).where('status', '==', 'active')),
        count(db.collection(COL.students).where('createdAt', '>=', monthStart)),
        count(db.collection(COL.courses)),
        count(db.collection(COL.liveClasses).where('startAt', '>=', nowTs)),
        count(db.collection(COL.exams)),
        count(db.collection(COL.enquiries).where('status', '==', 'new')),
        count(db.collection(COL.teachers)),
      ]);

      const paidThisMonth = await db.collection(COL.payments).where('status', '==', 'paid').where('paidAt', '>=', monthStart).get();
      const monthlyRevenuePaise = paidThisMonth.docs.reduce((s, d) => s + (Number(d.get('amountPaise')) || 0), 0);

      const open = await db.collection(COL.invoices).where('status', 'in', ['pending', 'partial']).get();
      let pendingFeesPaise = 0,
        overdueCount = 0;
      open.forEach((d) => {
        const inv = d.data() as Invoice;
        pendingFeesPaise += inv.amountPaise - (inv.paidPaise ?? 0);
        if ((toMillis(inv.dueDate) ?? 0) < now.getTime()) overdueCount++;
      });

      res.json({
        totalStudents,
        activeStudents,
        newAdmissions,
        totalCourses,
        upcomingClasses,
        totalExams,
        newEnquiries,
        teachers,
        monthlyRevenuePaise,
        pendingFeesPaise,
        overdueInvoices: overdueCount,
      });
    }),
  );

  /** Fee ledger CSV export. */
  router.get(
    '/reports/fees.csv',
    withAuth,
    requireRoles('admin'),
    ah(async (_req, res) => {
      const snap = await db.collection(COL.invoices).orderBy('dueDate', 'desc').limit(5000).get();
      const rows = snap.docs.map((d) => {
        const i = d.data() as Invoice;
        return [d.id, i.studentName, i.title, i.amountPaise / 100, (i.paidPaise ?? 0) / 100, (i.amountPaise - (i.paidPaise ?? 0)) / 100, i.status, new Date(toMillis(i.dueDate) ?? 0).toISOString().slice(0, 10)];
      });
      res.type('text/csv').attachment('svr-fees.csv').send(toCsv(['Invoice', 'Student', 'Title', 'Amount (INR)', 'Paid (INR)', 'Balance (INR)', 'Status', 'Due date'], rows));
    }),
  );

  /** Rank list CSV for an exam. */
  router.get(
    '/reports/exams/:examId/ranklist.csv',
    withAuth,
    requireRoles('admin', 'teacher'),
    ah(async (req, res) => {
      const examId = String(req.params.examId);
      const exam = await db.collection(COL.exams).doc(examId).get();
      if (!exam.exists) throw new HttpError(404, 'Exam not found');
      const attempts = await db.collection(COL.attempts).where('examId', '==', examId).get();
      const done = attempts.docs.map((d) => d.data() as Attempt).filter((a) => a.status !== 'in_progress');
      const students = new Map<string, string>();
      await Promise.all(
        [...new Set(done.map((a) => a.studentId))].map(async (sid) => {
          const s = await db.collection(COL.students).doc(sid).get();
          students.set(sid, `${s.get('name') ?? ''}|${s.get('admissionNo') ?? ''}`);
        }),
      );
      done.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (b.score ?? 0) - (a.score ?? 0));
      const rows = done.map((a) => {
        const [name, adm] = (students.get(a.studentId) ?? '|').split('|');
        return [a.rank ?? '', name, adm, a.score ?? 0, a.maxScore ?? 0, a.correct ?? 0, a.incorrect ?? 0, a.unattempted ?? 0, a.accuracy ?? 0, a.percentile ?? ''];
      });
      res
        .type('text/csv')
        .attachment(`ranklist-${examId}.csv`)
        .send(toCsv(['Rank', 'Student', 'Admission No', 'Score', 'Max', 'Correct', 'Incorrect', 'Unattempted', 'Accuracy %', 'Percentile'], rows));
    }),
  );

  /** Performance analytics for one student (student, linked parent, or staff). */
  router.get(
    '/analytics/students/:studentId',
    withAuth,
    ah(async (req, res) => {
      const studentId = String(req.params.studentId);
      if (!(await canViewStudent(req.user!, studentId))) throw new HttpError(403, 'Forbidden');
      const attempts = await db.collection(COL.attempts).where('studentId', '==', studentId).get();
      const done = attempts.docs.map((d) => d.data() as Attempt).filter((a) => a.status !== 'in_progress');

      const examIds = [...new Set(done.map((a) => a.examId))];
      const exams = new Map<string, Exam>();
      await Promise.all(examIds.map(async (id) => exams.set(id, (await db.collection(COL.exams).doc(id).get()).data() as Exam)));

      const chapterTitles = new Map<string, string>();
      await Promise.all(
        [...exams.values()]
          .filter((e) => e?.chapterId)
          .map(async (e) => {
            const ch = await db.collection(COL.courses).doc(e.courseId).collection(COL.chapters).doc(e.chapterId!).get();
            chapterTitles.set(e.chapterId!, (ch.get('title') as string) ?? e.chapterId!);
          }),
      );

      const rows: AttemptRow[] = done.map((a) => {
        const e = exams.get(a.examId);
        const started = toMillis(a.startedAt) ?? 0;
        const submitted = toMillis(a.submittedAt) ?? started;
        return {
          examId: a.examId,
          examTitle: e?.title ?? a.examId,
          chapterId: e?.chapterId,
          chapterTitle: e?.chapterId ? chapterTitles.get(e.chapterId) : undefined,
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 0,
          correct: a.correct ?? 0,
          incorrect: a.incorrect ?? 0,
          unattempted: a.unattempted ?? 0,
          submittedAtMs: submitted,
          timeTakenSec: Math.max(0, Math.round((submitted - started) / 1000)),
          rank: a.rank,
        };
      });
      res.json(buildStudentAnalytics(rows));
    }),
  );

  // ----- errors -----
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * End-to-end test against the Firebase Emulator Suite: security rules,
 * Cloud Functions (registration, exams, payments) and the REST API.
 *
 *   firebase emulators:exec --only auth,firestore,functions,storage "npm run e2e -w @svr/scripts"
 */
import assert from 'node:assert/strict';
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'svr-maths-academy';
const REGION = 'asia-south1';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

initAdmin({ projectId: PROJECT });
const aauth = adminAuth();
const adb = adminDb();

let n = 0;
function client(): FirebaseApp {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `c${n++}`);
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  connectFunctionsEmulator(getFunctions(app, REGION), '127.0.0.1', 5001);
  return app;
}
const call = <T = unknown>(app: FirebaseApp, name: string, data: unknown) => httpsCallable(getFunctions(app, REGION), name)(data).then((r) => r.data as T);

async function denied(p: Promise<unknown>, label: string) {
  try {
    await p;
  } catch (e) {
    const code = String((e as { code?: string }).code ?? '');
    assert.ok(/permission|denied|unauth/.test(code), `${label}: expected denial, got ${code}`);
    console.log(`  ✔ denied: ${label}`);
    return;
  }
  assert.fail(`${label}: expected PERMISSION_DENIED but succeeded`);
}
const ok = (label: string) => console.log(`  ✔ ${label}`);
async function rejects(p: Promise<unknown>, code: RegExp, label: string) {
  const err = await p.then(() => null, (e) => e as { code?: string });
  assert.ok(err && code.test(String(err.code)), `${label}: expected ${code}, got ${err ? err.code : 'success'}`);
  console.log(`  ✔ rejected: ${label}`);
}

async function main() {
  const stamp = Date.now();
  // ---------- admin ----------
  const adminEmail = `admin${stamp}@svr.test`;
  const adminUser = await aauth.createUser({ email: adminEmail, password: 'Admin#12345' });
  await aauth.setCustomUserClaims(adminUser.uid, { role: 'admin' });
  const A = client();
  await signInWithEmailAndPassword(getAuth(A), adminEmail, 'Admin#12345');
  const adb2 = getFirestore(A);
  ok('admin signed in');

  // Course + exam created through the client SDK as admin (exercises rules).
  const courseId = `e2e-course-${stamp}`;
  await setDoc(doc(adb2, 'courses', courseId), { title: 'E2E Course', slug: courseId, board: 'CBSE', category: 'board', description: 'x', highlights: [], priceInPaise: 100000, durationMonths: 1, teacherIds: [], published: true, order: 99 });
  const examRef = await addDoc(collection(adb2, 'exams'), {
    title: 'E2E Test', type: 'chapter', courseId, durationMin: 30, defaultMarks: 4, defaultNegativeMarks: 1,
    totalMarks: 0, questionCount: 0, shuffleQuestions: false, published: true, resultsPublished: false, createdAt: serverTimestamp(),
  });
  const qs = [
    { id: 'q1', q: { order: 1, type: 'mcq', text: '$2+2$', options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }], marks: 4, negativeMarks: 1 }, k: { correctOptionIds: ['b'], solution: 'four' } },
    { id: 'q2', q: { order: 2, type: 'numerical', text: '$\\sqrt{2}$', options: [], marks: 4, negativeMarks: 0 }, k: { numericAnswer: 1.414, tolerance: 0.01 } },
    { id: 'q3', q: { order: 3, type: 'msq', text: 'primes', options: [{ id: 'a', text: '2' }, { id: 'b', text: '4' }, { id: 'c', text: '5' }], marks: 4, negativeMarks: 2 }, k: { correctOptionIds: ['a', 'c'] } },
  ];
  for (const x of qs) {
    await setDoc(doc(adb2, 'exams', examRef.id, 'questions', x.id), x.q);
    await setDoc(doc(adb2, 'examKeys', examRef.id, 'questions', x.id), x.k);
  }
  ok('admin created course, exam, questions and answer keys');

  // ---------- public website ----------
  const P = client();
  const pdb = getFirestore(P);
  await addDoc(collection(pdb, 'enquiries'), { type: 'demo', name: 'Visitor', phone: '+919876543210', status: 'new', source: 'website', createdAt: serverTimestamp() });
  ok('anonymous visitor can submit an enquiry');
  await denied(addDoc(collection(pdb, 'enquiries'), { type: 'demo', name: 'Visitor', phone: '+919876543210', status: 'converted', source: 'website', createdAt: serverTimestamp() }), 'enquiry with forged status');
  await denied(getDocs(collection(pdb, 'enquiries')), 'anonymous read of enquiries');
  const pub = await getDoc(doc(pdb, 'courses', courseId));
  assert.equal(pub.get('title'), 'E2E Course');
  ok('published course readable publicly');

  // ---------- student registration ----------
  const S = client();
  const sEmail = `student${stamp}@svr.test`;
  const cred = await createUserWithEmailAndPassword(getAuth(S), sEmail, 'Student#123');
  const sid = cred.user.uid;
  const reg = await call<{ admissionNo: string }>(S, 'registerStudent', { name: 'Test Student', classLevel: 10, board: 'CBSE', parent: { name: 'Parent', phone: '9876543210' } });
  assert.match(reg.admissionNo, /^SVR\d{6}\d{4}$/);
  await cred.user.getIdToken(true);
  const claims = (await cred.user.getIdTokenResult()).claims;
  assert.equal(claims.role, 'student');
  ok(`student registered (${reg.admissionNo}) with role claim`);
  const sdb = getFirestore(S);

  await denied(updateDoc(doc(sdb, 'students', sid), { enrolledCourseIds: [courseId] }), 'student self-enrolment');
  await denied(getDocs(collection(sdb, 'exams', examRef.id, 'questions')), 'student reading exam questions directly');
  await denied(getDocs(collection(sdb, 'examKeys', examRef.id, 'questions')), 'student reading answer keys');
  await denied(setDoc(doc(sdb, 'attempts', `${examRef.id}_${sid}`), { score: 100 }), 'student writing own attempt/score');
  await denied(setDoc(doc(sdb, 'users', sid), { role: 'admin' }, { merge: true }), 'student escalating role');
  await denied(call(S, 'startExam', { examId: examRef.id }), 'startExam when not enrolled');

  // ---------- fees: invoice + offline payment enrols the student ----------
  const inv = await addDoc(collection(adb2, 'invoices'), { studentId: sid, studentName: 'Test Student', courseId, title: 'E2E fee', amountPaise: 100000, paidPaise: 0, dueDate: serverTimestamp(), status: 'pending', createdAt: serverTimestamp() });
  const studentInvoices = await getDocs(collection(sdb, 'invoices')).catch(() => null);
  assert.equal(studentInvoices, null, 'unfiltered invoice list must be denied');
  const own = await getDoc(doc(sdb, 'invoices', inv.id));
  assert.equal(own.get('amountPaise'), 100000);
  ok('student can read own invoice, not the full list');
  const pay = await call<{ receiptNo: string }>(A, 'recordOfflinePayment', { invoiceId: inv.id, amountPaise: 100000, method: 'cash' });
  assert.match(pay.receiptNo, /^SVR-R-/);
  const enrolled = (await adb.doc(`students/${sid}`).get()).get('enrolledCourseIds') as string[];
  assert.ok(enrolled.includes(courseId));
  assert.equal((await adb.doc(`invoices/${inv.id}`).get()).get('status'), 'paid');
  ok(`offline payment recorded (${pay.receiptNo}); invoice paid and student auto-enrolled`);
  await denied(call(S, 'recordOfflinePayment', { invoiceId: inv.id, amountPaise: 1, method: 'cash' }), 'student calling admin payment function');

  // ---------- exam ----------
  const started = await call<{ questions: { id: string; options: unknown[] }[]; deadlineAt: number }>(S, 'startExam', { examId: examRef.id });
  assert.equal(started.questions.length, 3);
  assert.ok(!JSON.stringify(started).includes('correctOptionIds'), 'answer keys leaked');
  ok('startExam served 3 questions without answer keys');
  await call(S, 'submitExam', { examId: examRef.id, answers: { q1: { selectedOptionIds: ['b'] } }, final: false });
  ok('autosave accepted');
  const res = await call<{ score: number; maxScore: number; correct: number; incorrect: number }>(S, 'submitExam', {
    examId: examRef.id,
    answers: { q2: { numericValue: 1.41 }, q3: { selectedOptionIds: ['a', 'b'] } },
    final: true,
  });
  assert.deepEqual([res.score, res.maxScore, res.correct, res.incorrect], [4 + 4 - 2, 12, 2, 1]);
  ok(`server evaluation: ${res.score}/${res.maxScore} (negative marking applied)`);
  await rejects(call(S, 'getExamReview', { examId: examRef.id }), /failed-precondition/, 'review before results are published');
  await rejects(call(S, 'submitExam', { examId: examRef.id, answers: {}, final: true }), /already-exists/, 'second submission');
  await call(A, 'publishResults', { examId: examRef.id });
  const review = await call<{ attempt: { rank: number }; questions: { solution: string }[] }>(S, 'getExamReview', { examId: examRef.id });
  assert.equal(review.attempt.rank, 1);
  assert.equal(review.questions[0].solution, 'four');
  ok('results published: rank 1, solutions visible');
  const myAttempt = await getDoc(doc(sdb, 'attempts', `${examRef.id}_${sid}`));
  assert.equal(myAttempt.get('score'), 6);
  ok('student can read own attempt');

  // Trigger updated exam totals.
  await new Promise((r) => setTimeout(r, 1500));
  const exam = await adb.doc(`exams/${examRef.id}`).get();
  assert.equal(exam.get('questionCount'), 3);
  assert.equal(exam.get('totalMarks'), 12);
  ok('onExamQuestionWrite trigger maintained totals');

  // ---------- another student cannot see this student ----------
  const O = client();
  const other = await createUserWithEmailAndPassword(getAuth(O), `other${stamp}@svr.test`, 'Student#123');
  await call(O, 'registerStudent', { name: 'Other Student', classLevel: 12, board: 'CBSE' });
  await other.user.getIdToken(true);
  await denied(getDoc(doc(getFirestore(O), 'students', sid)), 'student reading another student');
  await denied(getDoc(doc(getFirestore(O), 'attempts', `${examRef.id}_${sid}`)), 'student reading another attempt');

  // ---------- parent ----------
  const parentRes = await call<{ uid: string }>(A, 'adminCreateUser', { role: 'parent', name: 'E2E Parent', email: `parent${stamp}@svr.test`, password: 'Parent#123', childIds: [sid] });
  const Pa = client();
  await signInWithEmailAndPassword(getAuth(Pa), `parent${stamp}@svr.test`, 'Parent#123');
  const child = await getDoc(doc(getFirestore(Pa), 'students', sid));
  assert.equal(child.get('name'), 'Test Student');
  await denied(getDoc(doc(getFirestore(Pa), 'students', other.user.uid)), "parent reading someone else's child");
  ok(`parent ${parentRes.uid.slice(0, 6)}… sees only linked child`);

  // ---------- REST API ----------
  const token = await getAuth(A).currentUser!.getIdToken();
  const base = `http://127.0.0.1:5001/${PROJECT}/${REGION}/api`;
  const summary = await fetch(`${base}/reports/summary`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json() as Promise<any>); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.ok(summary.totalStudents >= 2, JSON.stringify(summary));
  ok(`API summary: ${summary.totalStudents} students, revenue ₹${summary.monthlyRevenuePaise / 100}`);
  const sToken = await getAuth(S).currentUser!.getIdToken();
  assert.equal((await fetch(`${base}/reports/summary`, { headers: { Authorization: `Bearer ${sToken}` } })).status, 403);
  ok('API denies students access to admin reports');
  const analytics = await fetch(`${base}/analytics/students/${sid}`, { headers: { Authorization: `Bearer ${sToken}` } }).then((r) => r.json() as Promise<any>); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(analytics.testsTaken, 1);
  ok('student analytics endpoint works');
  const csv = await fetch(`${base}/reports/exams/${examRef.id}/ranklist.csv`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.text());
  assert.ok(csv.includes('Test Student'));
  ok('rank list CSV export works');

  // ---------- suspension ----------
  await call(A, 'setUserStatus', { uid: other.user.uid, status: 'suspended' });
  assert.equal((await aauth.getUser(other.user.uid)).disabled, true);
  ok('suspension disables the account');

  for (const app of [A, P, S, O, Pa]) await deleteApp(app);
  console.log('\nAll end-to-end checks passed.');
}

main().catch((e) => {
  console.error('\n✘ E2E FAILED:', e);
  process.exit(1);
});

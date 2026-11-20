# Backend API reference

All functions run in **asia-south1**. Callable functions are invoked with the Firebase SDK (`httpsCallable(functions, name)`, with region `asia-south1`). Input is validated with the Zod schemas in `shared/src/validation.ts`. Errors use standard `HttpsError` codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition`, `not-found`, `already-exists`).

## Users

| Function | Caller | Input | Result |
|---|---|---|---|
| `registerStudent` | any signed-in user without a role | `{ name, classLevel, board, school?, city?, parent?: {name, phone, email?} }` | `{ studentId, admissionNo }`. Then refresh the ID token. |
| `adminCreateUser` | admin | `{ role, name, email?, phone?, password?, classLevel?, board?, courseIds?, permissions?, subjects?, childIds? }` | `{ uid }` |
| `setUserStatus` | admin | `{ uid, status: 'active' \| 'suspended' }` | `{ ok }` |
| `updateTeacher` | admin | `{ uid, permissions[], courseIds?, subjects?, qualification? }` | `{ ok }` |
| `linkParent` | admin | `{ parentUid, childIds[] }` | `{ ok }` |

## Examinations

| Function | Caller | Input | Result |
|---|---|---|---|
| `startExam` | enrolled student | `{ examId }` | `{ attemptId, serverNow, deadlineAt, exam, questions[], answers }`. Questions never include keys. |
| `submitExam` | student | `{ examId, answers: {qid: {selectedOptionIds?, numericValue?, uploadPaths?, timeSpentSec?, markedForReview?}}, final }` | autosave: `{ saved }`; final: `{ score, maxScore, correct, incorrect, unattempted, pendingReview, accuracy, status }` |
| `gradeSubjective` | `exams.evaluate` | `{ attemptId, questionId, marks, remark? }` | `{ score, pendingReview }` |
| `publishResults` | `exams.manage` | `{ examId }` | `{ candidates, pendingReview }` |
| `getExamReview` | student / parent / staff | `{ examId, studentId? }` | attempt summary and questions with solutions (after results are published) |

Subjective answers: upload images or PDFs to `submissions/{uid}/exams/{examId}/…` in Storage, then pass the paths in `uploadPaths`.

## Payments

| Function | Caller | Input | Result |
|---|---|---|---|
| `createPaymentOrder` | student / parent | `{ invoiceId }` or `{ courseId }` (student) | `{ orderId, amount, currency, keyId, invoiceId, title }`. Open Razorpay Checkout with these. |
| `verifyPayment` | student / parent | Razorpay handler response `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ receiptNo }` |
| `recordOfflinePayment` | admin | `{ invoiceId, amountPaise, method, reference? }` | `{ paymentId, receiptNo }` |
| `razorpayWebhook` (HTTP) | Razorpay | events `payment.captured`, `payment.failed` | `200` |

## Live classes

| Function | Caller | Input | Result |
|---|---|---|---|
| `joinLiveClass` | enrolled student (−15 min … end), staff | `{ classId }` | `{ joinUrl, passcode, host }`. Records attendance. |

## Triggers

- `onExamQuestionWrite`: keeps `exams/{id}.questionCount` and `totalMarks` in sync.
- `onAnnouncementCreated`: when `push` is true, sends FCM to topic `all` / `students` / `parents` / `teachers` / `course_<courseId>`.

## REST API (`api` function, served at `/api/**` by Hosting)

Send `Authorization: Bearer <Firebase ID token>`.

| Method & path | Access | Description |
|---|---|---|
| `GET /api/health` | public | liveness |
| `GET /api/reports/summary` | admin | dashboard KPIs (students, admissions, revenue, pending fees, …) |
| `GET /api/reports/fees.csv` | admin | fee ledger export |
| `GET /api/reports/exams/:examId/ranklist.csv` | admin, teacher | rank list export |
| `GET /api/analytics/students/:studentId` | the student, linked parent, staff | tests taken, average, accuracy, chapter-wise accuracy, strong and revision chapters, trend, improvement |

The same Express app can run standalone (`npm start -w @svr/node-api`), for example on Cloud Run.

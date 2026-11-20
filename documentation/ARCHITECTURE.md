# Architecture

```
                    SVR MATHS ACADEMY
                           │
        ┌──────────────────┼──────────────────┐
   SVR Academy         SVR Learn          SVR Control
   website (React)     app (Flutter)      admin (React)
        └──────────────────┼──────────────────┘
                           │  Firebase SDKs (Auth, Firestore, Storage, Functions)
        ┌──────────────────┼──────────────────┐
   Firebase Auth      Cloud Firestore     Cloud Storage
   (OTP / email,      (one database,      (PDFs, images,
    role claims)       security rules)     uploads)
        └──────────────────┼──────────────────┘
                           │
              Cloud Functions (Node 22, asia-south1)
              ├─ callable functions: users, exams, payments, live
              ├─ triggers: exam totals, push notifications
              └─ `api`: Express REST API (reports, CSV, analytics)
                           │
        ┌──────────────────┼──────────────────┐
     Razorpay        Live provider         FCM push
   (orders + HMAC    (Zoom/Meet/100ms      (topics)
    verify + webhook)  links)
```

## Design principles

1. **One backend, many clients.** Every client calls the same Firestore collections (`shared/src/constants.ts → COL`) and the same callable functions. Types and validation live in `@svr/shared`, so the website, admin and functions cannot drift apart. The Flutter app mirrors the same contract (see `apps/student_app/README.md`).
2. **The server owns anything that matters.** Clients cannot write roles, enrolments, payments, exam attempts or scores; Firestore rules deny it. Cloud Functions do these writes with the Admin SDK after checking the caller's role.
3. **Data-driven admin.** Courses, chapters, content, exams, live classes and website content are documents. SVR Control is a schema-driven UI (`ResourcePage` + `Form`) over these collections, so new content never needs a deployment.

## Identity and roles

- Sign-in: Firebase Auth with phone OTP (students) or email/password (everyone).
- Roles are **custom claims** set only by functions:
  - `registerStudent`: a signed-in user with no role becomes a `student` (it never upgrades an existing role).
  - `adminCreateUser`: an admin creates `teacher`, `parent`, `student` or `admin` accounts.
  - `updateTeacher`: sets `perms`, one or more of `courses.manage`, `content.upload`, `live.manage`, `exams.manage`, `exams.evaluate`, `homework.manage`, `attendance.manage`, `students.view`, `announcements.send`.
  - The first admin is created with `backend/scripts/create-admin.ts`.
- Suspension (`setUserStatus`) disables the Auth user and revokes refresh tokens.
- Parents are linked to children with `parents/{uid}.childIds`. The rules check this list on every read.

## Security model highlights (`backend/firebase/firestore.rules`)

| Data | Student | Parent | Teacher | Admin |
|---|---|---|---|---|
| Own student profile | read; edit name/school/city/photo | read linked children | read (`students.view`) | full |
| Course / chapter metadata | read published | read published | read all; write with perms | full |
| Chapter content (videos, PDFs) | enrolled or free preview | — | read; write (`content.upload`) | full |
| Exam questions | **via `startExam` only** | — | `exams.manage`/`evaluate` | full |
| Answer keys | **never** | never | `exams.manage` | full |
| Attempts / scores | read own (written by server) | read child's | read | read |
| Invoices / payments | read own | read child's | — | invoices: write; payments: server only |
| Enquiries | create (validated shape) | create | — | full |
| Live class join links | via `joinLiveClass` (enrolled, in time window) | — | `live.manage` | full |

Storage rules mirror this. Course files are readable only by enrolled students (cross-service Firestore lookup), and student uploads are private to the student, their parent and staff.

## Exams

1. Staff write questions to `exams/{id}/questions` and answer keys to `examKeys/{id}/questions` (two documents, so keys can be locked down separately).
2. `startExam` checks published state, enrolment and time window. It creates `attempts/{examId}_{studentId}` with a **server-set deadline** and returns questions without keys. Calling it again resumes the attempt.
3. `submitExam` with `final:false` autosaves. With `final:true` it evaluates using `shared/src/scoring.ts` (unit-tested): MCQ, MSQ (optional partial marking), numerical with tolerance, negative marking. Subjective uploads are marked `pending_review`. Answers that arrive after the deadline plus a 60 s grace period are ignored.
4. `gradeSubjective` lets a teacher award marks, and the attempt is re-scored.
5. `publishResults` computes competition ranks (ties share a rank; ties on score are broken by time taken) and percentiles. After that, `getExamReview` shows solutions to students and parents.

## Payments (Razorpay)

1. `createPaymentOrder({invoiceId} | {courseId})`: the **amount comes from Firestore**, never from the client. It creates a Razorpay order and stores `payments/{orderId}`.
2. Razorpay Checkout runs in the browser or app.
3. `verifyPayment`: HMAC-SHA256(`order_id|payment_id`, key secret), compared in constant time.
4. `razorpayWebhook`: verifies `X-Razorpay-Signature` over the raw body. It is the source of truth if the browser closes mid-payment.
5. `applyPayment` (inside a transaction, idempotent) marks the payment paid, updates the invoice balance, issues a receipt number and **enrols the student** when a course invoice is fully paid.
6. `recordOfflinePayment` covers cash, UPI, bank transfer and cheque collected at the academy.

## Live classes

We integrate a provider instead of building video infrastructure. A live class stores public data (`liveClasses/{id}`) and private links (`liveClasses/{id}/private/secret`). `joinLiveClass` returns the link only to enrolled students, from 15 minutes before the start until the end, and records attendance (with a late flag). Recordings are referenced by Cloudflare Stream UID.

**Recommended upgrade path:** 100ms or Zoom Video SDK for an in-app classroom (whiteboard, raise hand, chat) inside SVR Learn. The provider field and join flow are already abstracted for this.

## Video hosting

Lecture videos: Cloudflare Stream (`videoProvider: 'cloudflare'`, `videoRef: <uid>`). Signed playback URLs should be issued by a function in Phase 2 (planned: `getVideoToken`). YouTube (unlisted) and Storage MP4 are also supported for small clips.

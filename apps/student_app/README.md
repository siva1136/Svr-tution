# SVR Learn: Flutter student and parent app (Phase 2)

Following **Option A**, the backend this app uses is already built and tested (`npm run e2e`). The app needs **no backend changes**; it uses the same Firebase project, collections and functions as the website.

## Setup (when we start Phase 2)

```bash
flutter create --org in.svrmathsacademy --project-name svr_learn apps/student_app
cd apps/student_app
flutter pub add firebase_core firebase_auth cloud_firestore cloud_functions firebase_storage \
  firebase_messaging go_router flutter_riverpod flutter_math_fork razorpay_flutter \
  file_picker image_picker syncfusion_flutter_pdfviewer video_player url_launcher fl_chart
dart pub global activate flutterfire_cli && flutterfire configure --project=svr-maths-academy
```

## Screens

| Area | Screens | Backend |
|---|---|---|
| Auth | Phone OTP, email login, register profile (class, board, parent) | Firebase Auth → `registerStudent`, then `getIdToken(true)` |
| Home | Welcome, continue learning, today's live classes, upcoming exams, pending homework, announcements, progress | `students/{uid}`, `liveClasses` (where courseId ==), `exams`, `homework`, `announcements`, `progress` |
| Courses | Course → chapters → content tabs (Videos, Live, Notes, NCERT, Practice, DPP, Assignments, Tests) | `courses/{id}/chapters/{id}/contents` (query `published == true`) |
| Player | Cloudflare Stream / YouTube player, PDF viewer, mark complete | `progress/{uid}/courses/{courseId}` |
| Live | Join button (−15 min), recordings | `joinLiveClass` |
| Exam | Instructions, server-timed exam, question palette, mark for review, MCQ/MSQ/numerical/subjective upload, autosave every 30 s, submit | `startExam`, `submitExam` (`final:false` / `true`), Storage `submissions/{uid}/exams/{examId}/…` |
| Results | Score, rank, percentile, solutions | `attempts/{examId}_{uid}`, `getExamReview` |
| Analytics | Chapter accuracy, strong vs revision chapters, trend chart | `GET /api/analytics/students/{uid}` |
| Homework | List, upload answer photos/PDF, grades and feedback | `homework`, `homeworkSubmissions/{hwId}_{uid}` |
| Fees | Invoices, pay with Razorpay, receipts | `invoices`, `createPaymentOrder` → Razorpay → `verifyPayment` |
| Profile | Photo, details, sign out | `students/{uid}` (name/school/city/photo), Storage `avatars/{uid}` |
| Parent mode | Children switcher, attendance, results, homework, fees, announcements | role `parent`, `parents/{uid}.childIds` |
| Push | Subscribe to topics `all`, `students`/`parents`, `course_<id>` per enrolment | FCM, token saved in `users/{uid}/devices/{token}` |

## Rules the app must respect

- Never compute or store scores on the device; the server evaluates.
- Show the server deadline (`deadlineAt − serverNow` offset), not a purely local timer.
- Call `getIdToken(true)` after registration or role changes so claims are current.
- Callable functions region: `asia-south1`.

# SVR MATHS ACADEMY — SVR Digital Learning Platform

**Beyond Learning. Towards Mastery.** · Academic year 2026–27

One backend. One database. Multiple applications. One complete education ecosystem.

| Product | Folder | Technology | Purpose | Status |
|---|---|---|---|---|
| **SVR Academy** | `apps/website` | React 19 + TypeScript + Vite + Tailwind | Public website, admissions, student & parent login, online payment | ✅ Phase 1 |
| **SVR Control** | `apps/admin` | React 19 + TypeScript + Vite + Tailwind | Complete academy management | ✅ Phase 1 |
| **Backend** | `backend/cloud-functions` | Firebase Cloud Functions (Node 22) | Roles, exams, payments, live classes, notifications | ✅ Phase 1 |
| **REST API** | `backend/node-api` | Node.js + Express | Reports, CSV exports, analytics | ✅ Phase 1 |
| **Security** | `backend/firebase` | Firestore & Storage rules | Role-based access control | ✅ Phase 1 |
| **SVR Learn** | `apps/student_app` | Flutter + Dart | Android / iOS learning app | 📋 Phase 2 (spec ready) |
| **Shared** | `shared` | TypeScript + Zod | Types, constants, validation, exam scoring | ✅ |

We followed **Option A**: the website, admin portal and Firebase backend are built and tested together first. The Flutter app will use the same backend without changes.

## What works today

**SVR Academy (website)**
- Home, About, Courses (Class 10 CBSE, Class 12 CBSE, IIT Foundation, JEE, Olympiad, Online and Home Tuition), Faculty, Results, Free Materials, Contact, Admission, Free Demo booking
- Enquiry, admission and demo forms save to Firestore (validated by the rules) and offer a WhatsApp follow-up. Before Firebase is configured, the forms fall back to WhatsApp.
- Student login with **mobile OTP** or **email**, password reset, and self-registration (class, board, parent details, auto admission number)
- Student / parent account page: courses, upcoming live classes with **Join**, fees with **Razorpay checkout**, test results, announcements
- **Enrol & pay online** on each course page. The server prices the order, verifies the payment signature and enrols the student automatically.
- SEO: per-page titles and descriptions, canonical URLs, JSON-LD (Organization, Course), sitemap, robots.txt; optional Google Analytics 4; mobile-responsive

**SVR Control (admin)**: everything is data-driven, so adding chapters, videos, PDFs or exams needs no code changes
- Dashboard: students, active students, new admissions, monthly revenue, pending fees, courses, upcoming classes, enquiries, teachers
- Students (add, edit, enrol, suspend, performance report), Teachers (accounts and fine-grained permissions), Parents (link children)
- Admissions and enquiry pipeline with WhatsApp follow-up
- Course builder: course → chapters → content (concept videos, live classes, notes, NCERT, practice, DPP, assignments, tests) with uploads
- Live classes (Zoom / Meet / 100ms / Jitsi links kept private), automatic and manual attendance
- **Examination engine**: MCQ, multiple-correct (optional partial marking), numerical (with tolerance), subjective (upload + teacher evaluation), LaTeX/KaTeX maths, negative marking, time windows, shuffling, question bank import, server-side auto-evaluation, ranks and percentiles, rank-list CSV
- Homework with submissions and grading
- Fees and invoices, offline payments (cash / UPI / bank / cheque) with receipt numbers, payment ledger
- Notifications (push via FCM topics), website content (faculty, testimonials, toppers, free materials), reports (fees CSV, student register, rank lists), settings

**Security**: role claims (`admin`, `teacher`, `student`, `parent`) and teacher permissions are set only by the server. Students can never read answer keys or write scores, and parents see only their own children. See [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md).

## Quick start (local, no cloud account needed)

Requirements: Node 22, Java 17+ (for the emulators), `npm i -g firebase-tools`.

```bash
npm install
cp apps/website/.env.example apps/website/.env.local   # set VITE_USE_EMULATORS=true, any API key e.g. "demo"
cp apps/admin/.env.example   apps/admin/.env.local     # same
printf 'RAZORPAY_KEY_ID=rzp_test_x\nRAZORPAY_KEY_SECRET=x\nRAZORPAY_WEBHOOK_SECRET=x\n' > backend/cloud-functions/.secret.local

npm run build -w @svr/cloud-functions
firebase emulators:start --project svr-maths-academy        # terminal 1

# terminal 2 — seed catalogue + create the first admin
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=svr-maths-academy
npm run seed
npm run create-admin -w @svr/scripts -- admin@svr.test 'Admin#12345' "Your Name"

npm run dev:website   # http://localhost:5173
npm run dev:admin     # http://localhost:5174  (log in with the admin above)
```

## Quality checks

```bash
npm run typecheck   # all workspaces
npm test            # unit tests: exam scoring, ranks, analytics, CSV
npm run build       # website + admin + functions bundle
npm run e2e         # full emulator test: rules, functions, payments, exams, API (35+ checks)
```

CI (`.github/workflows/node.js.yml`) runs all of these on every push.

## Documentation

- [Architecture & security model](documentation/ARCHITECTURE.md)
- [Firestore data model](documentation/DATA_MODEL.md)
- [Functions & REST API reference](documentation/API.md)
- [Deployment guide (Firebase, Razorpay, domains)](documentation/DEPLOYMENT.md)
- [Roadmap](documentation/ROADMAP.md)
- [SVR Learn Flutter app plan](apps/student_app/README.md)

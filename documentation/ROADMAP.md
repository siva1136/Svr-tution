# Roadmap

| Phase | Development | Priority | Status |
|---|---|---|---|
| 1 | Website and branding | First | ✅ Done: `apps/website` |
| 2 | Firebase backend | First | ✅ Done: rules, functions, REST API, e2e tests |
| 3 | React admin dashboard | First | ✅ Done: `apps/admin` (all 15 modules) |
| 4 | Student registration and courses | Second | ✅ Web registration, enrolment, payments. App screens next. |
| 5 | Flutter student application | Second | 📋 Next: spec in `apps/student_app/README.md` |
| 6 | Video lectures and PDFs | Second | 🟡 Admin upload and model done; signed Cloudflare playback (`getVideoToken`) next |
| 7 | Online examination system | Third | ✅ Backend and admin done; app exam UI with Phase 5 |
| 8 | Fees and payments | Third | ✅ Razorpay (verified and webhook) and offline payments |
| 9 | Live classroom | Fourth | 🟡 Provider links, join control and attendance done; in-app SDK (100ms/Zoom) later |
| 10 | AI mathematics features | Fifth | ⏳ Planned |
| 11 | Parent portal | Fifth | 🟡 Web portal and access rules done; parent screens in the app later |
| 12 | Advanced analytics | Fifth | 🟡 Student analytics API done; cohort and teacher analytics later |

## Next up (Phase 2)

1. **SVR Learn (Flutter)**: auth (OTP), dashboard, course player, PDFs, exam UI with timer, autosave and upload, results and analytics, live join, homework upload, push topics.
2. `getVideoToken` function for signed Cloudflare Stream playback.
3. Progress tracking: write `progress/{uid}/courses/{courseId}` from the player, and continue-learning cards.
4. Scheduled jobs: fee reminders (WhatsApp/SMS/FCM), class reminders 15 minutes before the start, monthly parent reports (PDF).
5. App Check enforcement.

## Phase 5: AI features (teacher-led)

Planned as Cloud Functions that call an LLM with strict maths-tutor prompts and curriculum context:
AI Maths Assistant, Doubt Solver (photo → step-by-step hints), Question Generator (draft questions land in the question bank for **teacher approval**), Adaptive Practice and Smart Revision (driven by `revisionChapters` from the analytics API), Daily Challenge, weekly Leaderboard, Study Planner, Formula Library, AI performance summaries in parent reports.

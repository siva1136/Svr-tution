# Firestore data model

TypeScript definitions: `shared/src/types.ts`. Collection names: `shared/src/constants.ts` (`COL`). Money is always stored in **paise** (integers). Timestamps are Firestore `Timestamp`s.

```
users/{uid}                         role, displayName, email, phone, status, createdAt
  devices/{fcmToken}                FCM tokens written by the apps
students/{uid}                      name, classLevel, board, school, city, parent{name,phone,email},
                                    parentUid, admissionNo, enrolledCourseIds[], status, createdAt
teachers/{uid}                      name, email, subjects[], permissions[], courseIds[], status
parents/{uid}                       name, email, phone, childIds[]

courses/{courseId}                  title, slug, board, classLevel, category, description, highlights[],
                                    priceInPaise, mrpInPaise, durationMonths, teacherIds[], published,
                                    featured, order, thumbnailUrl
  chapters/{chapterId}              number, title, description, published
    contents/{contentId}            type (video|live|notes|ncert|practice|dpp|assignment|test), title,
                                    order, published, freePreview, videoProvider, videoRef, durationSec,
                                    fileUrl, fileUrlPath, examId, liveClassId, homeworkId

liveClasses/{id}                    title, courseId, chapterId, teacherId, provider, startAt, durationMin,
                                    status, recordingRef
  private/secret                    joinUrl, hostUrl, passcode           (staff only)
  attendance/{studentId}            present, late, firstJoinedAt, joinCount, markedManually

exams/{examId}                      title, type, courseId, chapterId, durationMin, startAt, endAt,
                                    defaultMarks, defaultNegativeMarks, totalMarks*, questionCount*,
                                    shuffleQuestions, published, resultsPublished, candidates*
  questions/{qid}                   order, type, text (LaTeX), options[{id,text}], marks, negativeMarks,
                                    difficulty, topic
examKeys/{examId}/questions/{qid}   correctOptionIds[], numericAnswer, tolerance, partialMarking, solution
questionBank/{id}                   …question fields, key{…}, tags[], board, classLevel, source

attempts/{examId}_{studentId}       examId, studentId, courseId, status (in_progress|submitted|evaluated),
                                    startedAt, deadlineAt, submittedAt, questionOrder[], answers{qid:…},
                                    results{qid:{outcome,marksAwarded,maxMarks,teacherRemark}},
                                    score, maxScore, correct, incorrect, unattempted, pendingReview,
                                    accuracy, rank, percentile                       (server-written)

homework/{id}                       title, description, courseId, dueAt, maxMarks, attachmentPaths[], published
homeworkSubmissions/{hwId}_{sid}    homeworkId, studentId, courseId, uploadPaths[], note, submittedAt,
                                    status (submitted|graded|returned), marks, feedback, gradedBy

enquiries/{id}                      type (admission|demo|contact|home_tuition), name, phone, email,
                                    classLevel, board, courseSlug, preferredSlot, message, status,
                                    source (website|app|walk_in|whatsapp), notes, createdAt

invoices/{id}                       studentId, studentName, courseId, title, amountPaise, paidPaise,
                                    dueDate, status (pending|partial|paid|cancelled)
payments/{id}                       invoiceId, studentId, courseId, amountPaise, method, status,
                                    razorpayOrderId, razorpayPaymentId, receiptNo, recordedBy, paidAt
                                    (id = Razorpay order id for online payments; server-written)

announcements/{id}                  title, body, audience (all|students|parents|teachers|course),
                                    courseId, push, publishedAt, pushedAt*
progress/{studentId}/courses/{cid}  completedContentIds[], lastContentId, timeSpentSec, updatedAt

settings/public                     academyName, tagline, academicYear, phone, whatsapp, email, address,
                                    mapUrl, admissionsOpen                         (public read)
settings/counters                   admission, receipt                              (server)
faculty/{id}, testimonials/{id}, toppers/{id}, materials/{id}               (website content)
auditLogs/{id}                      actorUid, action, details, at                   (server)
```

`*` maintained by Cloud Functions.

Composite indexes are in `backend/firebase/firestore.indexes.json`.

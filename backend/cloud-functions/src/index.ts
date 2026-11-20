/**
 * SVR Digital Learning Platform — Cloud Functions entry point.
 * One backend shared by SVR Academy (website), SVR Control (admin) and SVR Learn (Flutter app).
 */
import { onRequest } from 'firebase-functions/v2/https';
import { createApp } from '@svr/node-api';
import { auth, db } from './core'; // first import: applies global options (region)

export { registerStudent, adminCreateUser, setUserStatus, updateTeacher, linkParent } from './users';
export { startExam, submitExam, gradeSubjective, publishResults, getExamReview, onExamQuestionWrite } from './exams';
export { createPaymentOrder, verifyPayment, razorpayWebhook, recordOfflinePayment } from './payments';
export { joinLiveClass } from './live';
export { onAnnouncementCreated } from './notifications';

/** REST API (reports, CSV exports, analytics) served at /api/** via Hosting rewrites. */
export const api = onRequest({ memory: '512MiB' }, createApp({ db, auth }));

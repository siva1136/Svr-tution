import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { COL, type LiveClass, type LiveClassSecret } from '@svr/shared';
import { FieldValue, caller, db, parse } from './core';

/** Join window: students may join from 15 minutes before start until the class ends. */
const EARLY_JOIN_MS = 15 * 60_000;

/**
 * Returns the join link for a live class and records attendance.
 * Join links are stored in a private sub-document so they are never exposed
 * to students who are not enrolled.
 */
export const joinLiveClass = onCall(async (req) => {
  const c = caller(req);
  const { classId } = parse(z.object({ classId: z.string().min(1).max(128) }), req.data);
  const ref = db.collection(COL.liveClasses).doc(classId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Class not found');
  const lc = snap.data() as LiveClass;
  const secret = (await ref.collection('private').doc('secret').get()).data() as LiveClassSecret | undefined;
  if (!secret?.joinUrl) throw new HttpsError('failed-precondition', 'The join link has not been added yet.');

  if (c.role === 'admin' || c.role === 'teacher') {
    return { joinUrl: secret.hostUrl || secret.joinUrl, passcode: secret.passcode ?? null, host: true };
  }
  if (c.role !== 'student') throw new HttpsError('permission-denied', 'Only students can join classes.');

  const student = await db.collection(COL.students).doc(c.uid).get();
  if (!((student.get('enrolledCourseIds') as string[] | undefined) ?? []).includes(lc.courseId)) {
    throw new HttpsError('permission-denied', 'You are not enrolled in this course.');
  }
  if (lc.status === 'cancelled') throw new HttpsError('failed-precondition', 'This class was cancelled.');
  const start = (lc.startAt as Timestamp).toMillis();
  const end = start + lc.durationMin * 60_000;
  const now = Date.now();
  if (now < start - EARLY_JOIN_MS) throw new HttpsError('failed-precondition', 'You can join 15 minutes before the class starts.');
  if (now > end) throw new HttpsError('failed-precondition', 'This class has ended. Watch the recording instead.');

  await ref.collection(COL.attendance).doc(c.uid).set(
    {
      studentId: c.uid,
      studentName: student.get('name') ?? '',
      present: true,
      firstJoinedAt: FieldValue.serverTimestamp(),
      joinCount: FieldValue.increment(1),
      late: now > start + 10 * 60_000,
    },
    { merge: true },
  );
  return { joinUrl: secret.joinUrl, passcode: secret.passcode ?? null, host: false };
});

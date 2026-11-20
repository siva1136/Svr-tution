import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COL, type Announcement } from '@svr/shared';
import { messaging } from './core';

/**
 * Sends a push notification (FCM) when an announcement with `push: true` is
 * created. Apps subscribe devices to topics: `all`, `students`, `parents`,
 * `teachers` and `course_<courseId>`.
 */
export const onAnnouncementCreated = onDocumentCreated(`${COL.announcements}/{id}`, async (event) => {
  const a = event.data?.data() as Announcement | undefined;
  if (!a?.push) return;
  const topic = a.audience === 'course' && a.courseId ? `course_${a.courseId}` : a.audience;
  try {
    await messaging().send({
      topic,
      notification: { title: a.title, body: a.body.slice(0, 240) },
      data: { type: 'announcement', id: event.params.id },
      android: { priority: 'high', notification: { channelId: 'announcements' } },
    });
    await event.data?.ref.update({ pushedAt: new Date() });
  } catch (e) {
    logger.error('FCM send failed', e);
  }
});

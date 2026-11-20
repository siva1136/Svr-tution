import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import {
  COL,
  createOrderSchema,
  offlinePaymentSchema,
  verifyPaymentSchema,
  type Course,
  type Invoice,
  type Payment,
} from '@svr/shared';
import { FieldValue, audit, caller, db, nextCounter, parse, requireRole, academicYearCode } from './core';

export const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
export const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
export const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

export function hmacHex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function assertCanPayFor(uid: string, role: string | undefined, studentId: string) {
  if (uid === studentId) return;
  if (role === 'parent') {
    const p = await db.collection(COL.parents).doc(uid).get();
    if (((p.get('childIds') as string[] | undefined) ?? []).includes(studentId)) return;
  }
  throw new HttpsError('permission-denied', 'You cannot pay for this invoice.');
}

async function receiptNo(): Promise<string> {
  return `SVR-R-${academicYearCode()}-${String(await nextCounter('receipt')).padStart(5, '0')}`;
}

/**
 * Applies a successful payment inside a transaction: marks the payment paid,
 * updates the invoice balance and enrols the student when a course invoice is
 * fully paid. Idempotent — safe to call from both verify and webhook.
 */
async function applyPayment(tx: Transaction, paymentRef: FirebaseFirestore.DocumentReference, extra: Partial<Payment>, receipt: string) {
  const pSnap = await tx.get(paymentRef);
  if (!pSnap.exists) throw new HttpsError('not-found', 'Payment not found');
  const payment = pSnap.data() as Payment;
  if (payment.status === 'paid') return { alreadyApplied: true, payment };

  let invoiceSnap: FirebaseFirestore.DocumentSnapshot | undefined;
  if (payment.invoiceId) invoiceSnap = await tx.get(db.collection(COL.invoices).doc(payment.invoiceId));

  tx.update(paymentRef, { ...extra, status: 'paid', paidAt: FieldValue.serverTimestamp(), receiptNo: receipt });

  if (invoiceSnap?.exists) {
    const inv = invoiceSnap.data() as Invoice;
    const paid = (inv.paidPaise ?? 0) + payment.amountPaise;
    const fullyPaid = paid >= inv.amountPaise;
    tx.update(invoiceSnap.ref, { paidPaise: paid, status: fullyPaid ? 'paid' : 'partial', updatedAt: FieldValue.serverTimestamp() });
    if (fullyPaid && inv.courseId) {
      tx.update(db.collection(COL.students).doc(inv.studentId), { enrolledCourseIds: FieldValue.arrayUnion(inv.courseId) });
    }
  }
  return { alreadyApplied: false, payment };
}

/** Creates a Razorpay order. The amount is always computed on the server. */
export const createPaymentOrder = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (req) => {
  const c = caller(req);
  const input = parse(createOrderSchema, req.data);

  let invoiceRef: FirebaseFirestore.DocumentReference;
  let invoice: Invoice;
  if (input.invoiceId) {
    invoiceRef = db.collection(COL.invoices).doc(input.invoiceId);
    const snap = await invoiceRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Invoice not found');
    invoice = snap.data() as Invoice;
    await assertCanPayFor(c.uid, c.role, invoice.studentId);
  } else {
    // Direct course purchase by a student: create an invoice at the catalogue price.
    if (c.role !== 'student') throw new HttpsError('permission-denied', 'Only students can buy courses directly.');
    const course = await db.collection(COL.courses).doc(input.courseId!).get();
    if (!course.exists || course.get('published') !== true) throw new HttpsError('not-found', 'Course not available');
    const cdata = course.data() as Course;
    const student = await db.collection(COL.students).doc(c.uid).get();
    if (((student.get('enrolledCourseIds') as string[] | undefined) ?? []).includes(course.id)) {
      throw new HttpsError('already-exists', 'You are already enrolled in this course.');
    }
    invoiceRef = db.collection(COL.invoices).doc();
    invoice = {
      studentId: c.uid,
      studentName: (student.get('name') as string) ?? '',
      courseId: course.id,
      title: cdata.title,
      amountPaise: cdata.priceInPaise,
      paidPaise: 0,
      dueDate: Timestamp.now(),
      status: 'pending',
      createdAt: Timestamp.now(),
    };
    await invoiceRef.set(invoice);
  }

  if (invoice.status === 'paid' || invoice.status === 'cancelled') throw new HttpsError('failed-precondition', `Invoice is ${invoice.status}.`);
  const due = invoice.amountPaise - (invoice.paidPaise ?? 0);
  if (due <= 0) throw new HttpsError('failed-precondition', 'Nothing due on this invoice.');

  const keyId = RAZORPAY_KEY_ID.value();
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${keyId}:${RAZORPAY_KEY_SECRET.value()}`).toString('base64'),
    },
    body: JSON.stringify({ amount: due, currency: 'INR', receipt: invoiceRef.id.slice(0, 40), notes: { invoiceId: invoiceRef.id, studentId: invoice.studentId } }),
  });
  if (!res.ok) {
    logger.error('Razorpay order failed', { status: res.status, body: await res.text() });
    throw new HttpsError('unavailable', 'Payment gateway error. Please try again.');
  }
  const order = (await res.json()) as { id: string; amount: number; currency: string };

  const payment: Payment = {
    invoiceId: invoiceRef.id,
    studentId: invoice.studentId,
    courseId: invoice.courseId,
    amountPaise: order.amount,
    method: 'razorpay',
    status: 'created',
    razorpayOrderId: order.id,
    createdAt: Timestamp.now(),
  };
  // Payment doc id == Razorpay order id, so verify/webhook can find it directly.
  await db.collection(COL.payments).doc(order.id).set(payment);

  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId, invoiceId: invoiceRef.id, title: invoice.title };
});

/** Verifies the Razorpay checkout signature (HMAC-SHA256 of order_id|payment_id). */
export const verifyPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (req) => {
  const c = caller(req);
  const input = parse(verifyPaymentSchema, req.data);
  const expected = hmacHex(RAZORPAY_KEY_SECRET.value(), `${input.razorpay_order_id}|${input.razorpay_payment_id}`);
  if (!safeEqualHex(expected, input.razorpay_signature)) {
    logger.warn('Invalid payment signature', { uid: c.uid, order: input.razorpay_order_id });
    throw new HttpsError('permission-denied', 'Payment verification failed.');
  }
  const ref = db.collection(COL.payments).doc(input.razorpay_order_id);
  const existing = await ref.get();
  if (!existing.exists) throw new HttpsError('not-found', 'Order not found');
  await assertCanPayFor(c.uid, c.role, existing.get('studentId') as string);

  const receipt = await receiptNo();
  const r = await db.runTransaction((tx) => applyPayment(tx, ref, { razorpayPaymentId: input.razorpay_payment_id }, receipt));
  return { ok: true, receiptNo: r.alreadyApplied ? r.payment.receiptNo : receipt };
});

/**
 * Razorpay webhook (configure URL: https://<region>-<project>.cloudfunctions.net/razorpayWebhook,
 * events: payment.captured, payment.failed). Source of truth if the browser closes mid-payment.
 */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  const signature = req.get('x-razorpay-signature') ?? '';
  const expected = hmacHex(RAZORPAY_WEBHOOK_SECRET.value(), req.rawBody);
  if (!signature || !safeEqualHex(expected, signature)) {
    res.status(401).send('Invalid signature');
    return;
  }
  const event = req.body as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; status: string } } } };
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) {
    res.status(200).send('ignored');
    return;
  }
  const ref = db.collection(COL.payments).doc(entity.order_id);
  if (!(await ref.get()).exists) {
    res.status(200).send('unknown order');
    return;
  }
  if (event.event === 'payment.captured') {
    const receipt = await receiptNo();
    await db.runTransaction((tx) => applyPayment(tx, ref, { razorpayPaymentId: entity.id }, receipt));
  } else if (event.event === 'payment.failed') {
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (s.get('status') === 'created') tx.update(ref, { status: 'failed', razorpayPaymentId: entity.id });
    });
  }
  res.status(200).send('ok');
});

/** Records a cash / UPI / bank payment collected at the academy. */
export const recordOfflinePayment = onCall(async (req) => {
  const admin = requireRole(req, 'admin');
  const input = parse(offlinePaymentSchema, req.data);
  const invSnap = await db.collection(COL.invoices).doc(input.invoiceId).get();
  if (!invSnap.exists) throw new HttpsError('not-found', 'Invoice not found');
  const inv = invSnap.data() as Invoice;
  const ref = db.collection(COL.payments).doc();
  const payment: Payment & { reference?: string } = {
    invoiceId: input.invoiceId,
    studentId: inv.studentId,
    courseId: inv.courseId,
    amountPaise: input.amountPaise,
    method: input.method,
    status: 'created',
    recordedBy: admin.uid,
    reference: input.reference,
    createdAt: Timestamp.now(),
  };
  await ref.set(payment);
  const receipt = await receiptNo();
  await db.runTransaction((tx) => applyPayment(tx, ref, {}, receipt));
  await audit(admin.uid, 'payment.offline', { paymentId: ref.id, invoiceId: input.invoiceId, amountPaise: input.amountPaise });
  return { ok: true, paymentId: ref.id, receiptNo: receipt };
});

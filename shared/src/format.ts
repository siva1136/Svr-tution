import type { TimestampLike } from './types';

export function toMillis(t: TimestampLike | undefined | null): number | undefined {
  if (t === undefined || t === null) return undefined;
  return typeof t === 'number' ? t : t.toMillis();
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Format an amount stored in paise as ₹ (whole rupees). */
export function formatINR(paise: number): string {
  return inr.format(Math.round(paise) / 100);
}

export function formatDateTime(t: TimestampLike | undefined | null): string {
  const ms = toMillis(t);
  if (ms === undefined) return '—';
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

export function formatDate(t: TimestampLike | undefined | null): string {
  const ms = toMillis(t);
  if (ms === undefined) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
}

/** Deterministic attempt document id — one attempt per student per exam. */
export function attemptId(examId: string, studentId: string): string {
  return `${examId}_${studentId}`;
}

export function submissionId(homeworkId: string, studentId: string): string {
  return `${homeworkId}_${studentId}`;
}

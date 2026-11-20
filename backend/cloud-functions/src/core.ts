import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { ZodType } from 'zod';
import { COL, FUNCTIONS_REGION, type Role, type TeacherPermission } from '@svr/shared';

// Must run before any function is defined: every function module imports core first.
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 20 });

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
// Optional fields (e.g. payment reference, courseId) are simply omitted when undefined.
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth();
export const messaging = () => getMessaging();
export { FieldValue };

export interface Caller {
  uid: string;
  role: Role | undefined;
  perms: string[];
  email?: string;
}

export function caller(req: CallableRequest): Caller {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const t = req.auth.token as Record<string, unknown>;
  return {
    uid: req.auth.uid,
    role: t.role as Role | undefined,
    perms: Array.isArray(t.perms) ? (t.perms as string[]) : [],
    email: t.email as string | undefined,
  };
}

export function requireRole(req: CallableRequest, ...roles: Role[]): Caller {
  const c = caller(req);
  if (!c.role || !roles.includes(c.role)) throw new HttpsError('permission-denied', 'You do not have access to this action.');
  return c;
}

/** Admins always pass; teachers need the named permission. */
export function requirePerm(req: CallableRequest, perm: TeacherPermission): Caller {
  const c = caller(req);
  if (c.role === 'admin') return c;
  if (c.role === 'teacher' && c.perms.includes(perm)) return c;
  throw new HttpsError('permission-denied', `Missing permission: ${perm}`);
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    throw new HttpsError('invalid-argument', msg);
  }
  return r.data;
}

export async function audit(actorUid: string, action: string, details: Record<string, unknown>): Promise<void> {
  await db.collection(COL.auditLogs).add({ actorUid, action, details, at: FieldValue.serverTimestamp() });
}

/** Atomically increments a named counter and returns the new value (e.g. admission / receipt numbers). */
export async function nextCounter(name: string): Promise<number> {
  const ref = db.collection(COL.settings).doc('counters');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.get(name) as number | undefined) ?? 0) + 1;
    tx.set(ref, { [name]: next }, { merge: true });
    return next;
  });
}

export function academicYearCode(d = new Date()): string {
  // Academic year starts in April (India).
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}${String((y + 1) % 100).padStart(2, '0')}`;
}

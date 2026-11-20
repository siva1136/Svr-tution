import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  COL,
  TEACHER_PERMISSIONS,
  adminCreateUserSchema,
  normalizePhone,
  studentRegistrationSchema,
  type Role,
} from '@svr/shared';
import { FieldValue, audit, auth, caller, db, academicYearCode, nextCounter, parse, requireRole } from './core';

async function newAdmissionNo(): Promise<string> {
  const n = await nextCounter('admission');
  return `SVR${academicYearCode()}${String(n).padStart(4, '0')}`;
}

/**
 * Self-registration for students after they sign in (OTP or email) on the
 * website / app. Creates the profile and grants the `student` role.
 * Idempotent; never upgrades an existing non-student account.
 */
export const registerStudent = onCall(async (req) => {
  const c = caller(req);
  const input = parse(studentRegistrationSchema, req.data);
  if (c.role && c.role !== 'student') throw new HttpsError('failed-precondition', 'This account already has a different role.');

  const studentRef = db.collection(COL.students).doc(c.uid);
  const existing = await studentRef.get();
  if (existing.exists) return { ok: true, studentId: c.uid, alreadyRegistered: true };

  const user = await auth.getUser(c.uid);
  const admissionNo = await newAdmissionNo();
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(COL.users).doc(c.uid), {
    role: 'student',
    displayName: input.name,
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    status: 'active',
    createdAt: now,
  });
  batch.set(studentRef, {
    name: input.name,
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    classLevel: input.classLevel,
    board: input.board,
    school: input.school ?? null,
    city: input.city ?? null,
    parent: input.parent ? { ...input.parent, phone: normalizePhone(input.parent.phone) } : null,
    admissionNo,
    enrolledCourseIds: [],
    status: 'active',
    createdAt: now,
  });
  await batch.commit();
  await auth.setCustomUserClaims(c.uid, { role: 'student' });
  return { ok: true, studentId: c.uid, admissionNo };
});

/** Admin creates any account (student, teacher, parent, admin) from SVR Control. */
export const adminCreateUser = onCall(async (req) => {
  const admin = requireRole(req, 'admin');
  const input = parse(adminCreateUserSchema, req.data);

  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  let user;
  try {
    user = await auth.createUser({
      email: input.email,
      phoneNumber: phone,
      password: input.password,
      displayName: input.name,
      emailVerified: false,
    });
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('already-exists')) throw new HttpsError('already-exists', 'An account with this email or phone already exists.');
    throw new HttpsError('internal', (e as Error).message);
  }

  const uid = user.uid;
  const role: Role = input.role;
  const perms = role === 'teacher' ? (input.permissions ?? []) : undefined;
  await auth.setCustomUserClaims(uid, perms ? { role, perms } : { role });

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(COL.users).doc(uid), {
    role,
    displayName: input.name,
    email: input.email ?? null,
    phone: phone ?? null,
    status: 'active',
    createdAt: now,
  });

  if (role === 'student') {
    batch.set(db.collection(COL.students).doc(uid), {
      name: input.name,
      email: input.email ?? null,
      phone: phone ?? null,
      classLevel: input.classLevel,
      board: input.board,
      admissionNo: await newAdmissionNo(),
      enrolledCourseIds: input.courseIds ?? [],
      status: 'active',
      createdAt: now,
    });
  } else if (role === 'teacher') {
    batch.set(db.collection(COL.teachers).doc(uid), {
      name: input.name,
      email: input.email ?? null,
      phone: phone ?? null,
      subjects: input.subjects ?? ['Mathematics'],
      permissions: perms,
      courseIds: input.courseIds ?? [],
      status: 'active',
      createdAt: now,
    });
  } else if (role === 'parent') {
    const childIds = input.childIds ?? [];
    batch.set(db.collection(COL.parents).doc(uid), { name: input.name, email: input.email ?? null, phone: phone ?? null, childIds, createdAt: now });
    for (const sid of childIds) batch.update(db.collection(COL.students).doc(sid), { parentUid: uid });
  }
  await batch.commit();
  await audit(admin.uid, 'user.create', { uid, role });
  return { ok: true, uid };
});

/** Suspend / reactivate an account. Suspension disables sign-in and revokes sessions. */
export const setUserStatus = onCall(async (req) => {
  const admin = requireRole(req, 'admin');
  const { uid, status } = parse(z.object({ uid: z.string().min(1), status: z.enum(['active', 'suspended']) }), req.data);
  if (uid === admin.uid) throw new HttpsError('failed-precondition', 'You cannot suspend your own account.');

  await auth.updateUser(uid, { disabled: status === 'suspended' });
  if (status === 'suspended') await auth.revokeRefreshTokens(uid);

  const userSnap = await db.collection(COL.users).doc(uid).get();
  const role = userSnap.get('role') as Role | undefined;
  const batch = db.batch();
  batch.set(userSnap.ref, { status }, { merge: true });
  if (role === 'student') batch.set(db.collection(COL.students).doc(uid), { status }, { merge: true });
  if (role === 'teacher') batch.set(db.collection(COL.teachers).doc(uid), { status }, { merge: true });
  await batch.commit();
  await audit(admin.uid, 'user.status', { uid, status });
  return { ok: true };
});

/** Update a teacher's permissions and assigned courses; keeps custom claims in sync. */
export const updateTeacher = onCall(async (req) => {
  const admin = requireRole(req, 'admin');
  const input = parse(
    z.object({
      uid: z.string().min(1),
      permissions: z.array(z.enum(TEACHER_PERMISSIONS)),
      courseIds: z.array(z.string()).max(50).optional(),
      subjects: z.array(z.string().max(40)).max(10).optional(),
      qualification: z.string().max(200).optional(),
    }),
    req.data,
  );
  const ref = db.collection(COL.teachers).doc(input.uid);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Teacher not found');
  await auth.setCustomUserClaims(input.uid, { role: 'teacher', perms: input.permissions });
  const { uid, ...rest } = input;
  await ref.set(rest, { merge: true });
  await audit(admin.uid, 'teacher.update', { uid, permissions: input.permissions });
  return { ok: true };
});

/** Link a parent account to one or more students. */
export const linkParent = onCall(async (req) => {
  const admin = requireRole(req, 'admin');
  const { parentUid, childIds } = parse(z.object({ parentUid: z.string().min(1), childIds: z.array(z.string()).max(10) }), req.data);
  const parentRef = db.collection(COL.parents).doc(parentUid);
  const parent = await parentRef.get();
  if (!parent.exists) throw new HttpsError('not-found', 'Parent not found');
  const previous = (parent.get('childIds') as string[] | undefined) ?? [];
  const batch = db.batch();
  batch.update(parentRef, { childIds });
  for (const sid of previous.filter((s) => !childIds.includes(s))) batch.update(db.collection(COL.students).doc(sid), { parentUid: FieldValue.delete() });
  for (const sid of childIds) batch.update(db.collection(COL.students).doc(sid), { parentUid });
  await batch.commit();
  await audit(admin.uid, 'parent.link', { parentUid, childIds });
  return { ok: true };
});

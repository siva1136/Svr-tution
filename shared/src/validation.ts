import { z } from 'zod';
import { BOARDS, CLASS_LEVELS, ENQUIRY_TYPES, QUESTION_TYPES, ROLES, TEACHER_PERMISSIONS } from './constants';

/** Indian mobile number, with or without +91. Normalised to E.164 by `normalizePhone`. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .refine((s) => /^(\+91)?[6-9]\d{9}$/.test(s), 'Enter a valid 10-digit Indian mobile number');

export function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s-]/g, '');
  return s.startsWith('+91') ? s : `+91${s}`;
}

const classLevel = z.coerce.number().int().refine((n) => (CLASS_LEVELS as readonly number[]).includes(n), 'Invalid class');

export const enquirySchema = z.object({
  type: z.enum(ENQUIRY_TYPES),
  name: z.string().trim().min(2, 'Name is required').max(80),
  phone: phoneSchema,
  email: z.string().trim().email('Invalid email').max(120).optional().or(z.literal('')),
  classLevel: classLevel.optional(),
  board: z.enum(BOARDS).optional(),
  courseSlug: z.string().max(80).optional(),
  preferredSlot: z.string().max(80).optional(),
  message: z.string().max(1000).optional(),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const studentRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  classLevel,
  board: z.enum(BOARDS),
  school: z.string().trim().max(120).optional(),
  city: z.string().trim().max(60).optional(),
  parent: z
    .object({
      name: z.string().trim().min(2).max(80),
      phone: phoneSchema,
      email: z.string().trim().email().max(120).optional().or(z.literal('')),
      relation: z.enum(['father', 'mother', 'guardian']).optional(),
    })
    .optional(),
});
export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;

export const adminCreateUserSchema = z
  .object({
    role: z.enum(ROLES),
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().optional(),
    phone: phoneSchema.optional(),
    password: z.string().min(8).max(64).optional(),
    // student
    classLevel: classLevel.optional(),
    board: z.enum(BOARDS).optional(),
    courseIds: z.array(z.string()).max(50).optional(),
    // teacher
    permissions: z.array(z.enum(TEACHER_PERMISSIONS)).optional(),
    subjects: z.array(z.string().max(40)).max(10).optional(),
    // parent
    childIds: z.array(z.string()).max(10).optional(),
  })
  .refine((v) => v.email || v.phone, { message: 'Email or phone is required' })
  .refine((v) => v.role !== 'student' || (v.classLevel && v.board), { message: 'Class and board are required for students' });
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const answerSchema = z.object({
  selectedOptionIds: z.array(z.string().max(20)).max(10).optional(),
  numericValue: z.number().finite().nullable().optional(),
  uploadPaths: z.array(z.string().max(300)).max(10).optional(),
  timeSpentSec: z.number().int().min(0).max(36000).optional(),
  markedForReview: z.boolean().optional(),
});

export const submitExamSchema = z.object({
  examId: z.string().min(1).max(128),
  answers: z.record(z.string().max(128), answerSchema),
  final: z.boolean().default(true),
});
export type SubmitExamInput = z.infer<typeof submitExamSchema>;

export const questionInputSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  text: z.string().min(1).max(5000),
  options: z.array(z.object({ id: z.string(), text: z.string().max(1000) })).max(8),
  marks: z.number().min(0).max(100),
  negativeMarks: z.number().min(0).max(100),
  correctOptionIds: z.array(z.string()).optional(),
  numericAnswer: z.number().optional(),
  tolerance: z.number().min(0).optional(),
  partialMarking: z.boolean().optional(),
  solution: z.string().max(10000).optional(),
});

/** Pay an existing invoice, or buy a course (server creates the invoice at the catalogue price). */
export const createOrderSchema = z
  .object({
    invoiceId: z.string().min(1).max(128).optional(),
    courseId: z.string().min(1).max(128).optional(),
  })
  .refine((v) => !!v.invoiceId !== !!v.courseId, { message: 'Provide exactly one of invoiceId or courseId' });

export const offlinePaymentSchema = z.object({
  invoiceId: z.string().min(1).max(128),
  amountPaise: z.number().int().positive().max(100_000_000),
  method: z.enum(['cash', 'upi_offline', 'bank_transfer', 'cheque']),
  reference: z.string().max(120).optional(),
});

export const gradeSubjectiveSchema = z.object({
  attemptId: z.string().min(1).max(260),
  questionId: z.string().min(1).max(128),
  marks: z.number().min(0).max(100),
  remark: z.string().max(1000).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

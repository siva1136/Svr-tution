/** Brand + platform constants shared by every SVR application. */
export const BRAND = {
  name: 'SVR MATHS ACADEMY',
  shortName: 'SVR',
  platform: 'SVR Digital Learning Platform',
  tagline: 'Beyond Learning. Towards Mastery.',
  academicYear: '2026–27',
  products: {
    learn: 'SVR Learn',
    control: 'SVR Control',
    academy: 'SVR Academy',
  },
} as const;

/** Firebase region used by all callable/HTTP functions. Keep in sync with clients. */
export const FUNCTIONS_REGION = 'asia-south1';

export const ROLES = ['admin', 'teacher', 'student', 'parent'] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: readonly Role[] = ['admin', 'teacher'];

/** Fine-grained permissions an admin can grant to a teacher account. */
export const TEACHER_PERMISSIONS = [
  'courses.manage',
  'content.upload',
  'live.manage',
  'exams.manage',
  'exams.evaluate',
  'homework.manage',
  'attendance.manage',
  'students.view',
  'announcements.send',
] as const;
export type TeacherPermission = (typeof TEACHER_PERMISSIONS)[number];

export const BOARDS = ['CBSE', 'ICSE', 'STATE', 'IIT_FOUNDATION', 'JEE_MAIN', 'OLYMPIAD'] as const;
export type Board = (typeof BOARDS)[number];
export const BOARD_LABELS: Record<Board, string> = {
  CBSE: 'CBSE',
  ICSE: 'ICSE',
  STATE: 'State Board',
  IIT_FOUNDATION: 'IIT Foundation',
  JEE_MAIN: 'JEE Main',
  OLYMPIAD: 'Olympiad',
};

export const CLASS_LEVELS = [6, 7, 8, 9, 10, 11, 12] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const COURSE_CATEGORIES = ['board', 'foundation', 'competitive', 'olympiad', 'tuition'] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const CONTENT_TYPES = [
  'video',
  'live',
  'notes',
  'ncert',
  'practice',
  'dpp',
  'assignment',
  'test',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  video: 'Concept Video',
  live: 'Live Class',
  notes: 'Notes (PDF)',
  ncert: 'NCERT Solutions',
  practice: 'Practice Questions',
  dpp: 'Daily Practice Problems',
  assignment: 'Assignment',
  test: 'Test',
};

export const VIDEO_PROVIDERS = ['cloudflare', 'youtube', 'storage'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const LIVE_PROVIDERS = ['zoom', 'google_meet', 'hundredms', 'jitsi', 'other'] as const;
export type LiveProvider = (typeof LIVE_PROVIDERS)[number];

export const QUESTION_TYPES = ['mcq', 'msq', 'numerical', 'subjective'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Single correct (MCQ)',
  msq: 'Multiple correct (MSQ)',
  numerical: 'Numerical answer',
  subjective: 'Subjective (upload)',
};

export const EXAM_TYPES = ['chapter', 'full_syllabus', 'jee_main', 'olympiad', 'dpp', 'mock'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const ENQUIRY_TYPES = ['admission', 'demo', 'contact', 'home_tuition'] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const ENQUIRY_STATUSES = ['new', 'contacted', 'demo_scheduled', 'converted', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const INVOICE_STATUSES = ['pending', 'partial', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_STATUSES = ['created', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['razorpay', 'cash', 'upi_offline', 'bank_transfer', 'cheque'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Firestore collection names — single source of truth for every app. */
export const COL = {
  users: 'users',
  students: 'students',
  teachers: 'teachers',
  parents: 'parents',
  courses: 'courses',
  chapters: 'chapters',
  contents: 'contents',
  liveClasses: 'liveClasses',
  attendance: 'attendance',
  exams: 'exams',
  questions: 'questions',
  examKeys: 'examKeys',
  questionBank: 'questionBank',
  attempts: 'attempts',
  homework: 'homework',
  homeworkSubmissions: 'homeworkSubmissions',
  enquiries: 'enquiries',
  invoices: 'invoices',
  payments: 'payments',
  announcements: 'announcements',
  progress: 'progress',
  settings: 'settings',
  faculty: 'faculty',
  testimonials: 'testimonials',
  toppers: 'toppers',
  materials: 'materials',
  auditLogs: 'auditLogs',
} as const;

/** Grace period (seconds) after an exam's duration within which submissions are accepted. */
export const EXAM_SUBMIT_GRACE_SECONDS = 60;

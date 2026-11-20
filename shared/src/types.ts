import type {
  Board,
  ClassLevel,
  ContentType,
  CourseCategory,
  EnquiryStatus,
  EnquiryType,
  ExamType,
  InvoiceStatus,
  LiveProvider,
  PaymentMethod,
  PaymentStatus,
  QuestionType,
  Role,
  TeacherPermission,
  VideoProvider,
} from './constants';

/**
 * Timestamps are stored as Firestore Timestamps. In shared code we type them as
 * a structural "has toMillis" value so the same types work with the web SDK,
 * the admin SDK and plain numbers (ms since epoch) in tests.
 */
export type TimestampLike = { toMillis(): number } | number;

export interface WithId {
  id: string;
}

export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  role: Role;
  displayName: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  status: UserStatus;
  createdAt: TimestampLike;
}

export interface ParentContact {
  name: string;
  phone: string;
  email?: string;
  relation?: 'father' | 'mother' | 'guardian';
}

export interface Student {
  name: string;
  email?: string;
  phone?: string;
  classLevel: ClassLevel;
  board: Board;
  school?: string;
  city?: string;
  parent?: ParentContact;
  parentUid?: string;
  admissionNo?: string;
  enrolledCourseIds: string[];
  status: UserStatus;
  photoURL?: string;
  createdAt: TimestampLike;
}

export interface Teacher {
  name: string;
  email: string;
  phone?: string;
  subjects: string[];
  qualification?: string;
  permissions: TeacherPermission[];
  courseIds: string[];
  status: UserStatus;
  createdAt: TimestampLike;
}

export interface Parent {
  name: string;
  email?: string;
  phone?: string;
  childIds: string[];
  createdAt: TimestampLike;
}

export interface Course {
  title: string;
  slug: string;
  board: Board;
  classLevel?: ClassLevel;
  category: CourseCategory;
  subtitle?: string;
  description: string;
  highlights: string[];
  priceInPaise: number;
  /** Optional strike-through price for marketing. */
  mrpInPaise?: number;
  durationMonths: number;
  thumbnailUrl?: string;
  teacherIds: string[];
  published: boolean;
  featured?: boolean;
  order: number;
  createdAt?: TimestampLike;
}

export interface Chapter {
  title: string;
  number: number;
  description?: string;
  published: boolean;
}

export interface ContentItem {
  type: ContentType;
  title: string;
  order: number;
  published: boolean;
  description?: string;
  /** Free preview items are visible to non-enrolled users. */
  freePreview?: boolean;
  videoProvider?: VideoProvider;
  /** Cloudflare Stream UID / YouTube ID / storage path depending on provider. */
  videoRef?: string;
  durationSec?: number;
  storagePath?: string;
  fileUrl?: string;
  examId?: string;
  liveClassId?: string;
  homeworkId?: string;
}

export interface LiveClass {
  title: string;
  courseId: string;
  chapterId?: string;
  teacherId: string;
  provider: LiveProvider;
  startAt: TimestampLike;
  durationMin: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  recordingRef?: string;
  description?: string;
}

/** Private, staff-only data for a live class (kept out of the public doc). */
export interface LiveClassSecret {
  joinUrl: string;
  hostUrl?: string;
  passcode?: string;
}

export interface Exam {
  title: string;
  type: ExamType;
  courseId: string;
  chapterId?: string;
  instructions?: string;
  durationMin: number;
  startAt?: TimestampLike;
  endAt?: TimestampLike;
  /** Default marks per question when a question does not override them. */
  defaultMarks: number;
  defaultNegativeMarks: number;
  totalMarks: number;
  questionCount: number;
  shuffleQuestions: boolean;
  published: boolean;
  resultsPublished: boolean;
  createdBy?: string;
  createdAt?: TimestampLike;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

/** The student-visible part of a question (never contains answers). */
export interface Question {
  order: number;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  marks: number;
  negativeMarks: number;
  chapterId?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/** The answer key — stored separately and readable by staff only. */
export interface AnswerKey {
  correctOptionIds?: string[];
  numericAnswer?: number;
  /** Absolute tolerance for numerical answers. */
  tolerance?: number;
  /** For MSQ: award proportional marks when no wrong option is chosen (JEE-Advanced style). */
  partialMarking?: boolean;
  solution?: string;
  solutionImageUrl?: string;
}

export interface QuestionBankItem extends Omit<Question, 'order'> {
  key: AnswerKey;
  board?: Board;
  classLevel?: ClassLevel;
  tags: string[];
  source?: string;
}

export interface StudentAnswer {
  selectedOptionIds?: string[];
  numericValue?: number | null;
  /** Uploaded image/PDF storage paths for subjective questions. */
  uploadPaths?: string[];
  timeSpentSec?: number;
  markedForReview?: boolean;
}

export type QuestionOutcome = 'correct' | 'incorrect' | 'partial' | 'unattempted' | 'pending_review';

export interface QuestionResult {
  outcome: QuestionOutcome;
  marksAwarded: number;
  maxMarks: number;
  teacherRemark?: string;
}

export interface Attempt {
  examId: string;
  studentId: string;
  courseId: string;
  status: 'in_progress' | 'submitted' | 'evaluated';
  startedAt: TimestampLike;
  submittedAt?: TimestampLike;
  deadlineAt: TimestampLike;
  questionOrder: string[];
  answers: Record<string, StudentAnswer>;
  results?: Record<string, QuestionResult>;
  score?: number;
  maxScore?: number;
  correct?: number;
  incorrect?: number;
  unattempted?: number;
  pendingReview?: number;
  accuracy?: number;
  rank?: number;
  percentile?: number;
}

export interface Homework {
  title: string;
  description?: string;
  courseId: string;
  chapterId?: string;
  dueAt: TimestampLike;
  maxMarks: number;
  attachmentPaths: string[];
  published: boolean;
  createdBy?: string;
}

export interface HomeworkSubmission {
  homeworkId: string;
  studentId: string;
  courseId: string;
  uploadPaths: string[];
  note?: string;
  submittedAt: TimestampLike;
  status: 'submitted' | 'graded' | 'returned';
  marks?: number;
  feedback?: string;
  gradedBy?: string;
}

export interface Enquiry {
  type: EnquiryType;
  name: string;
  phone: string;
  email?: string;
  classLevel?: ClassLevel;
  board?: Board;
  courseSlug?: string;
  preferredSlot?: string;
  message?: string;
  status: EnquiryStatus;
  source: 'website' | 'app' | 'walk_in' | 'whatsapp';
  createdAt: TimestampLike;
}

export interface Invoice {
  studentId: string;
  studentName: string;
  courseId?: string;
  title: string;
  amountPaise: number;
  paidPaise: number;
  dueDate: TimestampLike;
  status: InvoiceStatus;
  createdAt: TimestampLike;
}

export interface Payment {
  invoiceId?: string;
  studentId: string;
  courseId?: string;
  amountPaise: number;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receiptNo?: string;
  recordedBy?: string;
  createdAt: TimestampLike;
  paidAt?: TimestampLike;
}

export interface Announcement {
  title: string;
  body: string;
  audience: 'all' | 'students' | 'parents' | 'teachers' | 'course';
  courseId?: string;
  push: boolean;
  publishedAt: TimestampLike;
  createdBy?: string;
}

export interface CourseProgress {
  completedContentIds: string[];
  lastContentId?: string;
  timeSpentSec: number;
  updatedAt: TimestampLike;
}

export interface PublicSettings {
  academyName: string;
  tagline: string;
  academicYear: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapUrl?: string;
  social?: { youtube?: string; instagram?: string; facebook?: string };
  admissionsOpen: boolean;
}

export interface FacultyMember {
  name: string;
  title: string;
  bio: string;
  photoUrl?: string;
  experienceYears: number;
  order: number;
}

export interface Testimonial {
  name: string;
  detail: string;
  quote: string;
  rating: number;
  published: boolean;
}

export interface Topper {
  name: string;
  exam: string;
  score: string;
  year: string;
  photoUrl?: string;
  order: number;
}

export interface FreeMaterial {
  title: string;
  board: Board;
  classLevel?: ClassLevel;
  kind: 'notes' | 'formula_sheet' | 'pyq' | 'worksheet' | 'sample_paper';
  fileUrl: string;
  published: boolean;
}

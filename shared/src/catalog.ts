import type { Course } from './types';

/**
 * Default course catalogue. Used (1) by the seed script to populate Firestore
 * and (2) by the website as an offline fallback when Firebase is not yet
 * configured. Once seeded, everything is managed from SVR Control — no code
 * changes are needed to add courses or chapters.
 */
export interface CatalogCourse extends Omit<Course, 'teacherIds' | 'createdAt'> {
  chapters: string[];
}

export const NCERT_CLASS_10_CHAPTERS = [
  'Real Numbers',
  'Polynomials',
  'Pair of Linear Equations in Two Variables',
  'Quadratic Equations',
  'Arithmetic Progressions',
  'Triangles',
  'Coordinate Geometry',
  'Introduction to Trigonometry',
  'Some Applications of Trigonometry',
  'Circles',
  'Areas Related to Circles',
  'Surface Areas and Volumes',
  'Statistics',
  'Probability',
];

export const NCERT_CLASS_12_CHAPTERS = [
  'Relations and Functions',
  'Inverse Trigonometric Functions',
  'Matrices',
  'Determinants',
  'Continuity and Differentiability',
  'Application of Derivatives',
  'Integrals',
  'Application of Integrals',
  'Differential Equations',
  'Vector Algebra',
  'Three Dimensional Geometry',
  'Linear Programming',
  'Probability',
];

export const CATALOG: CatalogCourse[] = [
  {
    slug: 'class-10-cbse',
    title: 'Class 10 CBSE Mathematics',
    subtitle: 'Complete NCERT + board mastery programme',
    board: 'CBSE',
    classLevel: 10,
    category: 'board',
    description:
      'A complete year-long programme covering every NCERT chapter with concept videos, exercise-wise solutions, daily practice problems and full-length board pattern examinations.',
    highlights: ['All 14 NCERT chapters', 'Weekly chapter tests', '5 full board mock papers', 'Doubt sessions every Saturday'],
    priceInPaise: 1899900,
    mrpInPaise: 2499900,
    durationMonths: 11,
    published: true,
    featured: true,
    order: 1,
    chapters: NCERT_CLASS_10_CHAPTERS,
  },
  {
    slug: 'class-12-cbse',
    title: 'Class 12 CBSE Mathematics',
    subtitle: 'Boards + CUET ready',
    board: 'CBSE',
    classLevel: 12,
    category: 'board',
    description:
      'Rigorous coverage of the Class 12 syllabus — calculus, algebra, vectors and probability — with NCERT solutions, previous year questions and board-pattern examinations.',
    highlights: ['All 13 NCERT chapters', 'PYQ practice from 10 years', 'Calculus problem-solving labs', 'Board + CUET mock tests'],
    priceInPaise: 2499900,
    mrpInPaise: 2999900,
    durationMonths: 11,
    published: true,
    featured: true,
    order: 2,
    chapters: NCERT_CLASS_12_CHAPTERS,
  },
  {
    slug: 'iit-foundation',
    title: 'IIT Foundation Mathematics (Class 8–10)',
    subtitle: 'Build the base for JEE early',
    board: 'IIT_FOUNDATION',
    classLevel: 9,
    category: 'foundation',
    description:
      'Concept depth beyond the board syllabus — number theory, algebraic identities, geometry and logical reasoning — to prepare young learners for JEE and Olympiads.',
    highlights: ['Board + competitive syllabus', 'Logical reasoning modules', 'Monthly foundation tests', 'Olympiad bridge'],
    priceInPaise: 1599900,
    durationMonths: 10,
    published: true,
    featured: true,
    order: 3,
    chapters: ['Number Systems', 'Algebraic Identities', 'Linear Equations', 'Geometry Foundations', 'Mensuration', 'Logical Reasoning'],
  },
  {
    slug: 'jee-mathematics',
    title: 'JEE Main Mathematics',
    subtitle: 'Class 11 + 12 complete JEE preparation',
    board: 'JEE_MAIN',
    classLevel: 12,
    category: 'competitive',
    description:
      'Topic-wise JEE Main preparation with NTA-pattern tests, numerical-answer practice, negative marking, rank lists and detailed performance analysis.',
    highlights: ['NTA pattern mock tests', 'Numerical answer practice', 'All-India style rank lists', 'Speed + accuracy drills'],
    priceInPaise: 3499900,
    mrpInPaise: 4499900,
    durationMonths: 12,
    published: true,
    featured: true,
    order: 4,
    chapters: [
      'Sets, Relations and Functions',
      'Complex Numbers and Quadratic Equations',
      'Matrices and Determinants',
      'Permutations and Combinations',
      'Binomial Theorem',
      'Sequences and Series',
      'Limits, Continuity and Differentiability',
      'Integral Calculus',
      'Differential Equations',
      'Coordinate Geometry',
      'Three Dimensional Geometry',
      'Vector Algebra',
      'Statistics and Probability',
      'Trigonometry',
    ],
  },
  {
    slug: 'olympiad-mathematics',
    title: 'Olympiad Mathematics',
    subtitle: 'IMO / RMO / NMTC preparation',
    board: 'OLYMPIAD',
    category: 'olympiad',
    description: 'Problem-solving training for mathematics Olympiads — combinatorics, number theory, inequalities and geometry with proof writing.',
    highlights: ['Proof-writing workshops', 'Past Olympiad problems', 'Weekly challenge sets', 'Mentor feedback on solutions'],
    priceInPaise: 1999900,
    durationMonths: 9,
    published: true,
    order: 5,
    chapters: ['Number Theory', 'Combinatorics', 'Inequalities', 'Euclidean Geometry', 'Functional Equations'],
  },
  {
    slug: 'online-tuition',
    title: 'Online Live Tuition',
    subtitle: 'Small-batch live classes, Class 6–12',
    board: 'CBSE',
    category: 'tuition',
    description: 'Live, interactive small-batch classes for CBSE, ICSE and State Board students with personal attention, homework tracking and parent reports.',
    highlights: ['Batch size under 15', 'Homework tracking', 'Monthly parent report', 'Recorded sessions'],
    priceInPaise: 249900,
    durationMonths: 1,
    published: true,
    order: 6,
    chapters: [],
  },
  {
    slug: 'home-tuition',
    title: 'Home Tuition',
    subtitle: 'One-to-one at your home',
    board: 'CBSE',
    category: 'tuition',
    description: 'Personal one-to-one mathematics tuition at home by SVR faculty, supported by the full SVR digital platform for practice and tests.',
    highlights: ['One-to-one teaching', 'Flexible timings', 'Full platform access', 'Progress reviews'],
    priceInPaise: 799900,
    durationMonths: 1,
    published: true,
    order: 7,
    chapters: [],
  },
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

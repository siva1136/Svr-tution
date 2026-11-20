/** Pure analytics helpers (unit-tested; no Firebase dependency). */

export interface AttemptRow {
  examId: string;
  examTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  submittedAtMs: number;
  timeTakenSec: number;
  rank?: number;
}

export interface ChapterStat {
  chapterId: string;
  chapterTitle: string;
  attempts: number;
  accuracy: number;
  scorePct: number;
}

export interface StudentAnalytics {
  testsTaken: number;
  averageScorePct: number;
  overallAccuracy: number;
  totalTimeSec: number;
  bestRank: number | null;
  chapters: ChapterStat[];
  strongChapters: ChapterStat[];
  revisionChapters: ChapterStat[];
  trend: { examTitle: string; scorePct: number; date: number }[];
  /** Change in score % between the first and second half of the test history. */
  improvement: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b <= 0 ? 0 : (a / b) * 100);

export const STRONG_THRESHOLD = 75;
export const REVISION_THRESHOLD = 50;

export function buildStudentAnalytics(rows: AttemptRow[]): StudentAnalytics {
  const sorted = [...rows].sort((a, b) => a.submittedAtMs - b.submittedAtMs);
  const byChapter = new Map<string, { title: string; attempts: number; correct: number; attempted: number; score: number; max: number }>();
  let correct = 0,
    attempted = 0,
    time = 0,
    pctSum = 0;
  let bestRank: number | null = null;

  for (const r of sorted) {
    correct += r.correct;
    attempted += r.correct + r.incorrect;
    time += r.timeTakenSec;
    pctSum += pct(r.score, r.maxScore);
    if (r.rank && (bestRank === null || r.rank < bestRank)) bestRank = r.rank;
    if (r.chapterId) {
      const c = byChapter.get(r.chapterId) ?? { title: r.chapterTitle ?? r.chapterId, attempts: 0, correct: 0, attempted: 0, score: 0, max: 0 };
      c.attempts++;
      c.correct += r.correct;
      c.attempted += r.correct + r.incorrect;
      c.score += r.score;
      c.max += r.maxScore;
      byChapter.set(r.chapterId, c);
    }
  }

  const chapters: ChapterStat[] = [...byChapter.entries()].map(([chapterId, c]) => ({
    chapterId,
    chapterTitle: c.title,
    attempts: c.attempts,
    accuracy: r1(pct(c.correct, c.attempted)),
    scorePct: r1(pct(c.score, c.max)),
  }));

  const trend = sorted.map((r) => ({ examTitle: r.examTitle, scorePct: r1(pct(r.score, r.maxScore)), date: r.submittedAtMs }));
  const half = Math.floor(trend.length / 2);
  const avg = (xs: { scorePct: number }[]) => (xs.length ? xs.reduce((s, x) => s + x.scorePct, 0) / xs.length : 0);
  const improvement = trend.length >= 2 ? r1(avg(trend.slice(trend.length - half)) - avg(trend.slice(0, half))) : 0;

  return {
    testsTaken: sorted.length,
    averageScorePct: sorted.length ? r1(pctSum / sorted.length) : 0,
    overallAccuracy: r1(pct(correct, attempted)),
    totalTimeSec: time,
    bestRank,
    chapters: chapters.sort((a, b) => b.scorePct - a.scorePct),
    strongChapters: chapters.filter((c) => c.scorePct >= STRONG_THRESHOLD),
    revisionChapters: chapters.filter((c) => c.scorePct < REVISION_THRESHOLD),
    trend,
    improvement,
  };
}

/** Minimal RFC 4180 CSV encoder. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

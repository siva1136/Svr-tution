import { describe, expect, it } from 'vitest';
import { buildStudentAnalytics, toCsv } from './analytics';

const row = (o: Partial<Parameters<typeof buildStudentAnalytics>[0][number]>) => ({
  examId: 'e', examTitle: 'T', score: 0, maxScore: 100, correct: 0, incorrect: 0, unattempted: 0, submittedAtMs: 0, timeTakenSec: 60, ...o,
});

describe('buildStudentAnalytics', () => {
  it('classifies strong and revision chapters and computes trend', () => {
    const a = buildStudentAnalytics([
      row({ chapterId: 'c1', chapterTitle: 'Matrices', score: 90, correct: 9, incorrect: 1, submittedAtMs: 3, rank: 4 }),
      row({ chapterId: 'c2', chapterTitle: 'Integrals', score: 30, correct: 3, incorrect: 7, submittedAtMs: 1, rank: 9 }),
    ]);
    expect(a.testsTaken).toBe(2);
    expect(a.averageScorePct).toBe(60);
    expect(a.overallAccuracy).toBe(60);
    expect(a.bestRank).toBe(4);
    expect(a.strongChapters.map((c) => c.chapterTitle)).toEqual(['Matrices']);
    expect(a.revisionChapters.map((c) => c.chapterTitle)).toEqual(['Integrals']);
    expect(a.trend[0].scorePct).toBe(30);
    expect(a.improvement).toBe(60);
  });
  it('handles no data', () => {
    expect(buildStudentAnalytics([]).averageScorePct).toBe(0);
  });
});

describe('toCsv', () => {
  it('escapes quotes, commas and formula injection', () => {
    expect(toCsv(['a', 'b'], [['x,y', '=SUM(A1)'], [-5, 'he said "hi"']])).toBe('a,b\r\n"x,y",\'=SUM(A1)\r\n-5,"he said ""hi"""\r\n');
  });
});

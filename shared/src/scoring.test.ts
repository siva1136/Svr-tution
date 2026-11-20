import { describe, expect, it } from 'vitest';
import { computeRanks, evaluateExam, evaluateQuestion, type EvaluableQuestion } from './scoring';

const mcq: EvaluableQuestion = { id: 'q1', question: { type: 'mcq', marks: 4, negativeMarks: 1 }, key: { correctOptionIds: ['b'] } };
const msq: EvaluableQuestion = {
  id: 'q2',
  question: { type: 'msq', marks: 4, negativeMarks: 2 },
  key: { correctOptionIds: ['a', 'c'], partialMarking: true },
};
const num: EvaluableQuestion = { id: 'q3', question: { type: 'numerical', marks: 4, negativeMarks: 0 }, key: { numericAnswer: 2.5, tolerance: 0.01 } };
const subj: EvaluableQuestion = { id: 'q4', question: { type: 'subjective', marks: 5, negativeMarks: 0 }, key: {} };

describe('evaluateQuestion', () => {
  it('scores MCQ correct / incorrect / unattempted with negative marking', () => {
    expect(evaluateQuestion(mcq, { selectedOptionIds: ['b'] })).toMatchObject({ outcome: 'correct', marksAwarded: 4 });
    expect(evaluateQuestion(mcq, { selectedOptionIds: ['a'] })).toMatchObject({ outcome: 'incorrect', marksAwarded: -1 });
    expect(evaluateQuestion(mcq, { selectedOptionIds: ['a', 'b'] })).toMatchObject({ outcome: 'incorrect' });
    expect(evaluateQuestion(mcq, undefined)).toMatchObject({ outcome: 'unattempted', marksAwarded: 0 });
  });

  it('scores MSQ with partial marking only when no wrong option chosen', () => {
    expect(evaluateQuestion(msq, { selectedOptionIds: ['c', 'a'] })).toMatchObject({ outcome: 'correct', marksAwarded: 4 });
    expect(evaluateQuestion(msq, { selectedOptionIds: ['a'] })).toMatchObject({ outcome: 'partial', marksAwarded: 2 });
    expect(evaluateQuestion(msq, { selectedOptionIds: ['a', 'b'] })).toMatchObject({ outcome: 'incorrect', marksAwarded: -2 });
  });

  it('scores numerical answers within tolerance', () => {
    expect(evaluateQuestion(num, { numericValue: 2.505 })).toMatchObject({ outcome: 'correct' });
    expect(evaluateQuestion(num, { numericValue: 2.6 })).toMatchObject({ outcome: 'incorrect', marksAwarded: 0 });
    expect(evaluateQuestion(num, { numericValue: null })).toMatchObject({ outcome: 'unattempted' });
  });

  it('marks uploaded subjective answers for teacher review', () => {
    expect(evaluateQuestion(subj, { uploadPaths: ['x.jpg'] })).toMatchObject({ outcome: 'pending_review' });
    expect(evaluateQuestion(subj, {})).toMatchObject({ outcome: 'unattempted' });
  });
});

describe('evaluateExam', () => {
  it('totals score and applies manual subjective grades (clamped)', () => {
    const s = evaluateExam(
      [mcq, msq, num, subj],
      { q1: { selectedOptionIds: ['a'] }, q2: { selectedOptionIds: ['a'] }, q3: { numericValue: 2.5 }, q4: { uploadPaths: ['p'] } },
      { q4: { outcome: 'correct', marksAwarded: 9, maxMarks: 5 } },
    );
    expect(s.score).toBe(-1 + 2 + 4 + 5);
    expect(s.maxScore).toBe(17);
    expect(s.correct).toBe(2);
    expect(s.partial).toBe(1);
    expect(s.incorrect).toBe(1);
    expect(s.pendingReview).toBe(0);
  });
});

describe('computeRanks', () => {
  it('ranks by score then time, sharing ties', () => {
    const r = computeRanks([
      { id: 'a', score: 80, timeTakenSec: 100 },
      { id: 'b', score: 90, timeTakenSec: 300 },
      { id: 'c', score: 80, timeTakenSec: 100 },
      { id: 'd', score: 80, timeTakenSec: 50 },
    ]);
    expect(r.b.rank).toBe(1);
    expect(r.d.rank).toBe(2);
    expect(r.a.rank).toBe(3);
    expect(r.c.rank).toBe(3);
    expect(r.b.percentile).toBe(100);
  });
});

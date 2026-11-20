import { Link } from 'react-router-dom';
import { BOARD_LABELS, formatINR } from '@svr/shared';
import type { CourseView } from '../lib/data';
import Icon from './Icon';

const tones: Record<string, string> = {
  board: 'from-royal-600 to-ink-800',
  foundation: 'from-emerald-600 to-ink-800',
  competitive: 'from-rose-600 to-ink-800',
  olympiad: 'from-amber-500 to-ink-800',
  tuition: 'from-sky-600 to-ink-800',
};

export default function CourseCard({ course }: { course: CourseView }) {
  return (
    <Link to={`/courses/${course.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <div className={`relative h-32 bg-gradient-to-br ${tones[course.category] ?? tones.board} p-5 text-white`}>
        <div className="grid-bg absolute inset-0 opacity-60" />
        <span className="relative rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{BOARD_LABELS[course.board]}</span>
        <p className="relative mt-4 font-display text-3xl font-semibold opacity-90">{course.classLevel ? `Class ${course.classLevel}` : 'All levels'}</p>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold leading-snug">{course.title}</h3>
        {course.subtitle && <p className="mt-1 text-sm text-ink-900/60">{course.subtitle}</p>}
        <ul className="mt-4 space-y-1.5 text-sm text-ink-900/70">
          {course.highlights.slice(0, 3).map((h) => (
            <li key={h} className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-royal-600" />
              {h}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between pt-6">
          <div>
            <p className="text-xl font-bold">{formatINR(course.priceInPaise)}</p>
            <p className="text-xs text-ink-900/50">
              {course.mrpInPaise && <s className="mr-1">{formatINR(course.mrpInPaise)}</s>}
              {course.durationMonths === 1 ? 'per month' : `${course.durationMonths} months`}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-royal-600">
            View <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

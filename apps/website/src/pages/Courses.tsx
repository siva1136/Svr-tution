import { useState } from 'react';
import { COURSE_CATEGORIES } from '@svr/shared';
import CourseCard from '../components/CourseCard';
import { PageHero } from '../components/Section';
import { useCourses } from '../lib/data';
import { useSeo } from '../lib/seo';

const labels: Record<string, string> = { all: 'All', board: 'Board exams', foundation: 'Foundation', competitive: 'JEE', olympiad: 'Olympiad', tuition: 'Tuition' };

export default function Courses() {
  useSeo('Courses', 'Mathematics courses at SVR: Class 10 & 12 CBSE, IIT Foundation, JEE Main, Olympiad, online and home tuition.');
  const { data: courses, loading } = useCourses();
  const [cat, setCat] = useState<string>('all');
  const shown = cat === 'all' ? courses : courses.filter((c) => c.category === cat);
  return (
    <>
      <PageHero eyebrow="Courses 2026–27" title="Mathematics programmes for every goal">
        Board excellence, competitive exam preparation or personal tuition — every programme includes live classes, recorded lectures, tests and analytics.
      </PageHero>
      <section className="container-x py-14">
        <div className="flex flex-wrap gap-2" role="tablist">
          {['all', ...COURSE_CATEGORIES].map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${cat === c ? 'bg-ink-900 text-white' : 'bg-white text-ink-900/70 hover:text-ink-900'}`}>
              {labels[c]}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
        {!loading && shown.length === 0 && <p className="py-20 text-center text-ink-900/50">No courses in this category yet.</p>}
      </section>
    </>
  );
}

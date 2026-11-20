import { Link } from 'react-router-dom';
import { BRAND, CONTENT_TYPE_LABELS, type Testimonial } from '@svr/shared';
import CourseCard from '../components/CourseCard';
import Icon from '../components/Icon';
import { SectionHeading } from '../components/Section';
import { useCourses, useList } from '../lib/data';
import { organizationLd, useSeo } from '../lib/seo';

const fallbackTestimonials: Testimonial[] = [
  { name: 'Ananya R.', detail: 'Class 10 CBSE — 98/100', quote: 'The chapter tests and analysis showed me exactly what to revise. Maths became my strongest subject.', rating: 5, published: true },
  { name: 'Parent of Rahul K.', detail: 'Class 12 CBSE', quote: 'Monthly reports and attendance updates kept us informed throughout the year.', rating: 5, published: true },
  { name: 'Sai Teja', detail: 'JEE Main — 99.2 percentile (Maths)', quote: 'NTA-pattern mocks with rank lists made the real exam feel familiar.', rating: 5, published: true },
];

const pillars = [
  { icon: 'live', title: 'Live interactive classes', text: 'Whiteboard teaching, raise-hand, chat and attendance — with every session recorded.' },
  { icon: 'play', title: 'Recorded concept lectures', text: 'Chapter-wise videos you can pause, rewind and revisit before every test.' },
  { icon: 'test', title: 'Serious online examinations', text: 'MCQ, multiple-correct, numerical and subjective — with negative marking and rank lists.' },
  { icon: 'chart', title: 'Performance analytics', text: 'Chapter-wise accuracy, strong areas and topics to revise, tracked over time.' },
  { icon: 'doc', title: 'Notes, NCERT & DPPs', text: 'Downloadable notes, exercise-wise NCERT solutions and daily practice problems.' },
  { icon: 'users', title: 'Parent connect', text: 'Parents see attendance, homework, results and fee history from their own login.' },
];

const chapterModules = ['video', 'live', 'notes', 'ncert', 'practice', 'dpp', 'assignment', 'test'] as const;

export default function Home() {
  useSeo('', 'SVR Maths Academy — premium mathematics learning for CBSE, ICSE, State Board, IIT Foundation, JEE Main and Olympiad. Live classes, recorded lectures, online tests and analytics.', organizationLd);
  const { data: courses } = useCourses();
  const { data: testimonials } = useList<Testimonial>('testimonials', fallbackTestimonials);
  const featured = courses.filter((c) => c.featured).slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-royal-500/25 blur-3xl" />
        <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="container-x relative grid items-center gap-14 py-20 lg:grid-cols-[1.1fr_.9fr] lg:py-28">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Admissions open · Academic year {BRAND.academicYear}
            </span>
            <h1 className="h-display mt-6 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Beyond Learning.
              <br />
              <span className="text-gold-400">Towards Mastery.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              The SVR Digital Learning Platform brings live classes, recorded lectures, examinations and analytics together — for CBSE, ICSE, State Board, IIT Foundation, JEE Main and Olympiad mathematics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/demo" className="btn-gold px-6 py-3 text-base">
                Book a free demo class
              </Link>
              <Link to="/courses" className="btn-ghost-light px-6 py-3 text-base">
                Explore courses
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
              {[
                ['6', 'Programmes'],
                ['Class 6–12', 'All boards'],
                ['1:15', 'Live batch ratio'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-xs text-white/50">{l}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
            <div className="float-slow rounded-[2rem] border border-white/10 bg-white/[.06] p-4 backdrop-blur-xl">
              <div className="rounded-3xl bg-white p-5 text-ink-900 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-ink-900/50">Good evening, Ananya</p>
                    <p className="font-semibold">Class 12 CBSE Mathematics</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> LIVE 6:00 PM
                  </span>
                </div>
                <div className="mt-5 rounded-2xl bg-ink-900 p-4 text-white">
                  <p className="text-xs text-white/60">Chapter 5 · Continuity & Differentiability</p>
                  <p className="mt-1 font-display text-xl">Chapter test — 86%</p>
                  <div className="mt-3 flex h-16 items-end gap-1.5">
                    {[38, 52, 47, 61, 58, 72, 69, 86].map((h, i) => (
                      <div key={i} className={`flex-1 rounded-t ${i === 7 ? 'bg-gold-400' : 'bg-white/25'}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ['Rank', '#4'],
                    ['Accuracy', '91%'],
                    ['Streak', '12 days'],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-paper p-3">
                      <p className="text-ink-900/50">{l}</p>
                      <p className="mt-0.5 text-base font-bold">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ['Revise: Integrals by parts', 'Smart revision'],
                    ['DPP 14 — Matrices', 'Due today'],
                  ].map(([t, s]) => (
                    <div key={t} className="flex items-center justify-between rounded-xl border border-ink-900/8 px-3 py-2.5 text-sm">
                      <span>{t}</span>
                      <span className="text-xs text-royal-600">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-gold-500 px-4 py-3 text-ink-950 shadow-xl sm:block">
              <p className="text-xs font-semibold">∫ eˣ (f + f′) dx</p>
              <p className="text-[11px] opacity-70">Formula of the day</p>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading center eyebrow="One complete ecosystem" title="Everything a mathematics student needs — in one place" sub="Classes, practice, tests and progress tracking work together, so students always know what to do next." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="card p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-royal-100 text-royal-600">
                <Icon name={p.icon} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-900/65">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COURSES */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Programmes 2026–27" title="Choose your path to mastery" />
            <Link to="/courses" className="btn-ghost self-start sm:self-auto">
              All courses <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      </section>

      {/* CHAPTER STRUCTURE */}
      <section className="container-x grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="The SVR method"
            title="Every chapter, built the same rigorous way"
            sub="Concept first, then guided practice, then examination — and analysis that tells you exactly where you stand."
          />
          <Link to="/demo" className="btn-dark mt-8">
            Experience a demo class
          </Link>
        </div>
        <div className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">Class 12 · Chapter 3</p>
          <p className="h-display mt-1 text-2xl">Matrices</p>
          <ol className="mt-6 grid gap-2 sm:grid-cols-2">
            {chapterModules.map((m, i) => (
              <li key={m} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">{i + 1}</span>
                {CONTENT_TYPE_LABELS[m]}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* EXAMS + AI */}
      <section className="bg-ink-900 py-20 text-white sm:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Examination engine</p>
            <h2 className="h-display mt-2 text-3xl sm:text-4xl">Tests that feel like the real exam</h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {['Chapter-wise & full syllabus', 'JEE Main pattern with negative marking', 'Numerical-answer questions', 'Subjective answers with teacher evaluation', 'Automatic evaluation & solutions', 'Rank lists & percentiles'].map((t) => (
                <li key={t} className="flex gap-2 text-sm text-white/80">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Coming in SVR Learn</p>
            <h3 className="h-display mt-2 text-2xl">AI that supports the teacher — never replaces them</h3>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {['AI Maths Assistant', 'Doubt Solver', 'Adaptive Practice', 'Smart Revision', 'Formula Library', 'Daily Challenge'].map((t) => (
                <div key={t} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <Icon name="spark" className="h-4 w-4 text-gold-400" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading center eyebrow="Students & parents" title="Results that speak for themselves" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.slice(0, 3).map((t) => (
            <figure key={t.name} className="card flex flex-col p-7">
              <p className="text-gold-500" aria-label={`${t.rating} out of 5`}>{'★'.repeat(t.rating)}</p>
              <blockquote className="mt-4 flex-1 text-ink-900/80">“{t.quote}”</blockquote>
              <figcaption className="mt-6 border-t border-ink-900/8 pt-4">
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-ink-900/55">{t.detail}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/results" className="btn-ghost">See all results</Link>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-royal-600 to-ink-900 px-8 py-14 text-white sm:px-14">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <h2 className="h-display text-3xl sm:text-4xl">Start with a free demo class</h2>
              <p className="mt-2 max-w-xl text-white/75">Meet the faculty, experience the platform and get a personalised study plan — at no cost.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/demo" className="btn-gold px-6 py-3">Book free demo</Link>
              <Link to="/admission" className="btn-ghost-light px-6 py-3">Apply for admission</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

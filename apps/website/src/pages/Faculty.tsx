import type { FacultyMember } from '@svr/shared';
import { orderBy } from 'firebase/firestore';
import { PageHero } from '../components/Section';
import { useList } from '../lib/data';
import { useSeo } from '../lib/seo';

const fallback: FacultyMember[] = [
  { name: 'S. V. Ramana', title: 'Founder & Head of Mathematics', bio: 'Two decades of teaching board and JEE mathematics with a focus on concept mastery.', experienceYears: 20, order: 1 },
  { name: 'Dr. K. Lakshmi', title: 'Senior Faculty — Calculus & Algebra', bio: 'PhD in Mathematics; specialises in calculus and problem-solving for JEE.', experienceYears: 14, order: 2 },
  { name: 'R. Arjun', title: 'Olympiad Mentor', bio: 'Guides students through RMO and INMO preparation with proof-writing workshops.', experienceYears: 8, order: 3 },
];

const initials = (n: string) => n.split(/\s+/).filter((p) => /[A-Za-z]/.test(p[0])).slice(-2).map((p) => p[0]).join('');

export default function Faculty() {
  useSeo('Faculty', 'Meet the experienced mathematics faculty of SVR Maths Academy.');
  const { data } = useList<FacultyMember>('faculty', fallback, orderBy('order'));
  return (
    <>
      <PageHero eyebrow="Faculty" title="Teachers who make mathematics click" />
      <section className="container-x grid gap-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((f) => (
          <article key={f.name} className="card p-7">
            {f.photoUrl ? (
              <img src={f.photoUrl} alt={f.name} className="h-20 w-20 rounded-2xl object-cover" loading="lazy" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-900 font-display text-2xl text-gold-400">{initials(f.name)}</div>
            )}
            <h2 className="mt-5 text-lg font-semibold">{f.name}</h2>
            <p className="text-sm font-medium text-royal-600">{f.title}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-900/65">{f.bio}</p>
            <p className="mt-4 text-xs text-ink-900/50">{f.experienceYears}+ years of teaching</p>
          </article>
        ))}
      </section>
    </>
  );
}

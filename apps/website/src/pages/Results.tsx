import type { Testimonial, Topper } from '@svr/shared';
import { orderBy } from 'firebase/firestore';
import Icon from '../components/Icon';
import { PageHero, SectionHeading } from '../components/Section';
import { useList } from '../lib/data';
import { useSeo } from '../lib/seo';

const fallbackToppers: Topper[] = [
  { name: 'Ananya R.', exam: 'CBSE Class 10', score: '98/100', year: '2025', order: 1 },
  { name: 'Vikram P.', exam: 'CBSE Class 12', score: '97/100', year: '2025', order: 2 },
  { name: 'Sai Teja', exam: 'JEE Main Maths', score: '99.2 %ile', year: '2025', order: 3 },
];

export default function Results() {
  useSeo('Results', 'Board and competitive examination results of SVR Maths Academy students.');
  const { data: toppers } = useList<Topper>('toppers', fallbackToppers, orderBy('order'));
  const { data: testimonials } = useList<Testimonial>('testimonials', []);
  return (
    <>
      <PageHero eyebrow="Results" title="Our students, our pride" />
      <section className="container-x py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {toppers.map((t) => (
            <div key={t.name + t.exam} className="card flex items-center gap-5 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-100 text-gold-500">
                <Icon name="trophy" className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-ink-900/60">{t.exam} · {t.year}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-royal-600">{t.score}</p>
              </div>
            </div>
          ))}
        </div>
        {testimonials.length > 0 && (
          <div className="mt-20">
            <SectionHeading eyebrow="In their words" title="What students and parents say" />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {testimonials.map((t) => (
                <blockquote key={t.id} className="card p-6 text-ink-900/80">
                  “{t.quote}”<footer className="mt-3 text-sm font-semibold text-ink-900">— {t.name}, <span className="font-normal text-ink-900/55">{t.detail}</span></footer>
                </blockquote>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

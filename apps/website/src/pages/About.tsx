import { Link } from 'react-router-dom';
import { BRAND } from '@svr/shared';
import { PageHero, SectionHeading } from '../components/Section';
import { useSeo } from '../lib/seo';

const values = [
  ['Concept before procedure', 'Every topic starts with why it works. Formulas follow understanding — never replace it.'],
  ['Practice with purpose', 'DPPs and chapter questions are sequenced from fundamentals to competition level.'],
  ['Measure, then improve', 'Every test feeds analytics that show strengths and topics needing revision.'],
  ['Teacher-led, technology-powered', 'Our platform and AI tools support the teacher. The teacher stays at the centre.'],
];

export default function About() {
  useSeo('About SVR', 'About SVR Maths Academy — our teaching methodology, vision and the SVR Digital Learning Platform.');
  return (
    <>
      <PageHero eyebrow="About SVR" title={<>A mathematics academy built for <span className="text-gold-400">mastery</span></>}>
        SVR Maths Academy combines experienced faculty with a complete digital learning ecosystem — so every student learns, practises and is assessed the right way.
      </PageHero>
      <section className="container-x grid gap-14 py-20 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Our vision" title="One academy. One platform. Every student's growth visible." />
          <p className="mt-6 leading-relaxed text-ink-900/70">
            We are building the {BRAND.platform}: {BRAND.products.academy} (this website and admissions), {BRAND.products.learn} (the student learning app) and {BRAND.products.control} (our academy management system) — all running on one backend and one database.
          </p>
          <p className="mt-4 leading-relaxed text-ink-900/70">
            Students attend live classes, revisit recorded lectures, download materials, write online examinations and track their performance. Parents follow progress from their own accounts. Teachers see exactly where each student needs help.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map(([t, d]) => (
            <div key={t} className="card p-6">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-ink-900/65">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="container-x">
          <SectionHeading center eyebrow="Who we teach" title="From Class 6 foundations to JEE and Olympiads" />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {['CBSE', 'ICSE', 'State Board', 'IIT Foundation', 'JEE Main', 'Olympiad'].map((b) => (
              <span key={b} className="rounded-full border border-ink-900/10 bg-paper px-5 py-2 text-sm font-medium">{b}</span>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/faculty" className="btn-dark">Meet our faculty</Link>
          </div>
        </div>
      </section>
    </>
  );
}

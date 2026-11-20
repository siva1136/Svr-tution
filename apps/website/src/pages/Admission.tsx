import { PageHero } from '../components/Section';
import EnquiryForm from '../components/EnquiryForm';
import { useSeo } from '../lib/seo';
import { BRAND } from '@svr/shared';

const steps = [
  ['Apply', 'Submit the admission form below.'],
  ['Counselling call', 'Our team calls within one working day to understand your goals.'],
  ['Free demo & assessment', 'Attend a demo class and a short diagnostic test.'],
  ['Enrol', 'Choose a programme, pay securely online and get your SVR Learn login.'],
];

export default function Admission() {
  useSeo('Admission Registration', `Apply for admission to SVR Maths Academy for the academic year ${BRAND.academicYear}.`);
  return (
    <>
      <PageHero eyebrow={`Admissions ${BRAND.academicYear}`} title="Admission registration">
        Seats in live batches are limited to keep classes small. Register now to reserve your place.
      </PageHero>
      <section className="container-x grid gap-10 py-16 lg:grid-cols-[1fr_340px]">
        <EnquiryForm type="admission" submitLabel="Submit application" />
        <ol className="space-y-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="card flex gap-4 p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-gold-400">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-ink-900/60">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

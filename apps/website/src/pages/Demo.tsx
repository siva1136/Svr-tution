import { useSearchParams } from 'react-router-dom';
import EnquiryForm from '../components/EnquiryForm';
import Icon from '../components/Icon';
import { PageHero } from '../components/Section';
import { useSeo } from '../lib/seo';

export default function Demo() {
  useSeo('Book a Free Demo Class', 'Book a free mathematics demo class with SVR Maths Academy faculty.');
  const [params] = useSearchParams();
  return (
    <>
      <PageHero eyebrow="Free demo class" title="Experience an SVR class — free">
        A 45-minute live session with our faculty, a quick diagnostic and a personalised study plan.
      </PageHero>
      <section className="container-x grid gap-10 py-16 lg:grid-cols-[1fr_340px]">
        <EnquiryForm type="demo" submitLabel="Book my free demo" showSlot defaultCourse={params.get('course') ?? ''} />
        <div className="card h-fit p-6">
          <p className="font-semibold">What you get</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-900/70">
            {['Live class with senior faculty', 'Diagnostic test with instant analysis', 'Personalised study plan', 'Free formula sheet for your class'].map((t) => (
              <li key={t} className="flex gap-2"><Icon name="check" className="h-4 w-4 shrink-0 translate-y-0.5 text-royal-600" />{t}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

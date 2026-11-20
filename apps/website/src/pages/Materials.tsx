import { BOARD_LABELS, type FreeMaterial } from '@svr/shared';
import { where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { PageHero } from '../components/Section';
import { useList } from '../lib/data';
import { useSeo } from '../lib/seo';

const kindLabel: Record<FreeMaterial['kind'], string> = {
  notes: 'Notes',
  formula_sheet: 'Formula sheet',
  pyq: 'Previous year questions',
  worksheet: 'Worksheet',
  sample_paper: 'Sample paper',
};

export default function Materials() {
  useSeo('Free Study Materials', 'Free mathematics notes, formula sheets, worksheets and previous year questions from SVR Maths Academy.');
  const { data, loading } = useList<FreeMaterial>('materials', [], where('published', '==', true));
  return (
    <>
      <PageHero eyebrow="Free resources" title="Free study materials">
        Formula sheets, worksheets, sample papers and previous year questions — free for every student.
      </PageHero>
      <section className="container-x py-16">
        {data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((m) => (
              <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-100 text-royal-600"><Icon name="doc" /></div>
                <div className="flex-1">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-sm text-ink-900/55">{kindLabel[m.kind]} · {BOARD_LABELS[m.board]}{m.classLevel ? ` · Class ${m.classLevel}` : ''}</p>
                </div>
                <Icon name="download" className="h-5 w-5 text-ink-900/40 group-hover:text-royal-600" />
              </a>
            ))}
          </div>
        ) : (
          <div className="card mx-auto max-w-xl p-10 text-center">
            <p className="font-semibold">{loading ? 'Loading materials…' : 'New materials are being added for 2026–27.'}</p>
            <p className="mt-2 text-sm text-ink-900/60">Register for a free demo and we'll send the formula sheets for your class on WhatsApp.</p>
            <Link to="/demo" className="btn-gold mt-6">Get free materials</Link>
          </div>
        )}
      </section>
    </>
  );
}

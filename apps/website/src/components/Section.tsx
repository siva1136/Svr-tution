import type { ReactNode } from 'react';

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-ink-900 text-white">
      <div className="grid-bg absolute inset-0" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-royal-500/30 blur-3xl" />
      <div className="container-x relative py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">{eyebrow}</p>
        <h1 className="h-display mt-3 max-w-3xl text-4xl sm:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-white/70">{children}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, sub, center = false }: { eyebrow: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h-display mt-2 text-3xl sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-ink-900/65">{sub}</p>}
    </div>
  );
}

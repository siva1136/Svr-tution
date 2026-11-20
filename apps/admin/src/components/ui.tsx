import { useEffect, type ReactNode } from 'react';

export function PageHeader({ title, sub, actions, compact = false }: { title: string; sub?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  const H = compact ? 'h2' : 'h1';
  return (
    <div className={`${compact ? 'mb-4' : 'mb-6'} flex flex-wrap items-end justify-between gap-4`}>
      <div>
        <H className={`font-display font-semibold tracking-tight ${compact ? 'text-xl' : 'text-3xl'}`}>{title}</H>
        {sub && <p className="mt-1 text-sm text-ink-900/60">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`panel w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-lg p-1 text-ink-900/50 hover:bg-paper hover:text-ink-900" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const tones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-royal-100 text-royal-600 ring-royal-600/15',
  gray: 'bg-ink-900/5 text-ink-900/60 ring-ink-900/10',
};
const statusTone: Record<string, string> = {
  active: 'green', paid: 'green', published: 'green', evaluated: 'green', converted: 'green', completed: 'green', graded: 'green',
  suspended: 'red', failed: 'red', cancelled: 'red', closed: 'gray',
  pending: 'amber', partial: 'amber', submitted: 'amber', new: 'blue', created: 'gray', scheduled: 'blue', live: 'red',
  draft: 'gray', contacted: 'blue', demo_scheduled: 'amber', in_progress: 'blue',
};

export function Badge({ children, tone }: { children: ReactNode; tone?: keyof typeof tones }) {
  const t = tone ?? statusTone[String(children)] ?? 'gray';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[t]}`}>{String(children).replace(/_/g, ' ')}</span>;
}

export function Stat({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-ink-900 text-white' : 'panel'}`}>
      <p className={`text-xs font-medium ${accent ? 'text-white/60' : 'text-ink-900/55'}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className={`mt-1 text-xs ${accent ? 'text-gold-400' : 'text-ink-900/50'}`}>{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-14 text-center text-sm text-ink-900/50">{children}</div>;
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function Table<T extends { id: string }>({ rows, columns, loading, empty = 'Nothing here yet.', actions }: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  empty?: ReactNode;
  actions?: (row: T) => ReactNode;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead className="border-b border-ink-900/8 bg-paper/60">
            <tr>
              {columns.map((c) => <th key={c.key} className={`th ${c.className ?? ''}`}>{c.label}</th>)}
              {actions && <th className="th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/6">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper/50">
                {columns.map((c) => (
                  <td key={c.key} className={`td ${c.className ?? ''}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>
                ))}
                {actions && <td className="td whitespace-nowrap text-right"><div className="inline-flex gap-1.5">{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <Empty>Loading…</Empty>}
      {!loading && rows.length === 0 && <Empty>{empty}</Empty>}
    </div>
  );
}

export function Toast({ msg, onClose }: { msg: { text: string; error?: boolean } | null; onClose: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div className={`fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl px-4 py-3 text-sm text-white shadow-lg ${msg.error ? 'bg-rose-600' : 'bg-ink-900'}`} role="status">
      {msg.text}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="search" className="field max-w-xs" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}

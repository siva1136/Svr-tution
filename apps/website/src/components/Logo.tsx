import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path d="M18 44 L32 16 L46 44" fill="none" stroke="#f5b83d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 34 H40" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="SVR Maths Academy home">
      <LogoMark className={`h-9 w-9 ${light ? 'text-white/10' : 'text-ink-900'}`} />
      <span className="leading-none">
        <span className={`block font-display text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>SVR Maths Academy</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-gold-400' : 'text-royal-600'}`}>Towards Mastery</span>
      </span>
    </Link>
  );
}

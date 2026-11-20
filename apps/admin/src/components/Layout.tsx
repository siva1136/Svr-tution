import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BRAND } from '@svr/shared';
import { useAuth } from '../lib/auth';
import { NAV } from '../nav';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, role, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink-900 text-white/70" aria-label="SVR Control">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/favicon.svg" alt="" className="h-9 w-9" />
        <div className="leading-tight">
          <p className="font-display text-lg font-semibold text-white">{BRAND.products.control}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-400">{BRAND.shortName} Maths Academy</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((s) => {
          const items = s.items.filter((i) => i.perms.some((p) => can(p)));
          if (!items.length) return null;
          return (
            <div key={s.section}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{s.section}</p>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-white/10 font-semibold text-white' : 'hover:bg-white/5 hover:text-white'}`}>
                  <span className="w-4 text-center text-gold-400">{i.icon}</span>
                  {i.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.displayName || user?.email}</p>
        <p className="text-xs capitalize text-white/50">{role}</p>
        <button className="mt-3 text-xs text-gold-400 hover:text-gold-500" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-900/8 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn-soft btn-xs" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <p className="font-display font-semibold">{BRAND.products.control}</p>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

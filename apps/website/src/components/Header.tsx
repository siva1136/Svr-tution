import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { useAuth } from '../lib/auth';

const courseLinks = [
  ['Class 10 CBSE', '/courses/class-10-cbse'],
  ['Class 12 CBSE', '/courses/class-12-cbse'],
  ['IIT Foundation', '/courses/iit-foundation'],
  ['JEE Mathematics', '/courses/jee-mathematics'],
  ['Olympiad Mathematics', '/courses/olympiad-mathematics'],
  ['Online Tuition', '/courses/online-tuition'],
  ['Home Tuition', '/courses/home-tuition'],
] as const;

const links = [
  ['About', '/about'],
  ['Faculty', '/faculty'],
  ['Results', '/results'],
  ['Free Materials', '/materials'],
  ['Contact', '/contact'],
] as const;

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-medium transition ${isActive ? 'text-royal-600' : 'text-ink-900/75 hover:text-ink-900'}`;

  return (
    <header className={`sticky top-0 z-40 transition ${scrolled ? 'border-b border-ink-900/8 bg-paper/85 backdrop-blur-xl' : 'bg-paper'}`}>
      <div className="container-x flex h-18 items-center justify-between gap-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <div className="group relative">
            <NavLink to="/courses" className={navCls}>
              Courses ▾
            </NavLink>
            <div className="invisible absolute left-0 top-full w-64 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="card p-2">
                {courseLinks.map(([label, to]) => (
                  <Link key={to} to={to} className="block rounded-xl px-3 py-2 text-sm text-ink-900/80 hover:bg-royal-100 hover:text-ink-900">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} className={navCls}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link to={user ? '/account' : '/login'} className="btn-ghost">
            {user ? 'My Account' : 'Student Login'}
          </Link>
          <Link to="/admission" className="btn-gold">
            Apply for 2026–27
          </Link>
        </div>
        <button className="rounded-full p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          <Icon name={open ? 'close' : 'menu'} className="h-6 w-6" />
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-900/8 bg-paper lg:hidden">
          <div className="container-x grid gap-1 py-4">
            <p className="eyebrow px-3 pb-1 pt-2">Courses</p>
            {courseLinks.map(([label, to]) => (
              <Link key={to} to={to} className="rounded-xl px-3 py-2 text-sm hover:bg-white">
                {label}
              </Link>
            ))}
            <div className="my-2 h-px bg-ink-900/8" />
            {links.map(([label, to]) => (
              <Link key={to} to={to} className="rounded-xl px-3 py-2 text-sm hover:bg-white">
                {label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to={user ? '/account' : '/login'} className="btn-ghost">
                {user ? 'My Account' : 'Login'}
              </Link>
              <Link to="/admission" className="btn-gold">
                Apply now
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

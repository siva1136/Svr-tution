import { Link } from 'react-router-dom';
import { BRAND } from '@svr/shared';
import Logo from './Logo';
import Icon from './Icon';
import { useSettings } from '../lib/data';

export default function Footer() {
  const { data: s } = useSettings();
  return (
    <footer className="bg-ink-950 text-white/70">
      <div className="container-x grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo light />
          <p className="text-sm leading-relaxed">{BRAND.tagline} A complete digital learning ecosystem for mathematics — live classes, recorded lectures, examinations and analytics.</p>
          <p className="text-xs text-white/40">Academic year {s.academicYear}</p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Programmes</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/courses/class-10-cbse" className="hover:text-white">Class 10 CBSE</Link></li>
            <li><Link to="/courses/class-12-cbse" className="hover:text-white">Class 12 CBSE</Link></li>
            <li><Link to="/courses/iit-foundation" className="hover:text-white">IIT Foundation</Link></li>
            <li><Link to="/courses/jee-mathematics" className="hover:text-white">JEE Mathematics</Link></li>
            <li><Link to="/courses/olympiad-mathematics" className="hover:text-white">Olympiad Mathematics</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Academy</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="hover:text-white">About SVR</Link></li>
            <li><Link to="/faculty" className="hover:text-white">Faculty</Link></li>
            <li><Link to="/results" className="hover:text-white">Results</Link></li>
            <li><Link to="/materials" className="hover:text-white">Free Study Materials</Link></li>
            <li><Link to="/demo" className="hover:text-white">Book a Free Demo</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Contact</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><Icon name="phone" className="h-4 w-4 shrink-0 translate-y-0.5" /><a href={`tel:${s.phone.replace(/\s/g, '')}`} className="hover:text-white">{s.phone}</a></li>
            <li className="flex gap-2"><Icon name="mail" className="h-4 w-4 shrink-0 translate-y-0.5" /><a href={`mailto:${s.email}`} className="hover:text-white break-all">{s.email}</a></li>
            <li className="flex gap-2"><Icon name="pin" className="h-4 w-4 shrink-0 translate-y-0.5" /><span>{s.address}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <p>{BRAND.platform}</p>
        </div>
      </div>
    </footer>
  );
}

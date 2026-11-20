import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';

export default function NotFound() {
  useSeo('Page not found', 'The page you are looking for does not exist.');
  return (
    <section className="container-x py-32 text-center">
      <p className="h-display text-7xl text-royal-600">404</p>
      <h1 className="h-display mt-4 text-3xl">This page is undefined</h1>
      <p className="mt-2 text-ink-900/60">Like division by zero — let's take you somewhere that makes sense.</p>
      <Link to="/" className="btn-dark mt-8">Back to home</Link>
    </section>
  );
}

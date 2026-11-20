import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import WhatsAppFab from './components/WhatsAppFab';
import { AuthProvider } from './lib/auth';
import { trackPage } from './lib/analytics';
import Home from './pages/Home';

const About = lazy(() => import('./pages/About'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Faculty = lazy(() => import('./pages/Faculty'));
const Results = lazy(() => import('./pages/Results'));
const Materials = lazy(() => import('./pages/Materials'));
const Contact = lazy(() => import('./pages/Contact'));
const Admission = lazy(() => import('./pages/Admission'));
const Demo = lazy(() => import('./pages/Demo'));
const Login = lazy(() => import('./pages/Login'));
const Account = lazy(() => import('./pages/Account'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPage(pathname);
  }, [pathname]);

  return (
    <AuthProvider>
      <Header />
      <main>
        <Suspense fallback={<div className="container-x py-32 text-center text-ink-900/50">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:slug" element={<CourseDetail />} />
            <Route path="/faculty" element={<Faculty />} />
            <Route path="/results" element={<Results />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admission" element={<Admission />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppFab />
    </AuthProvider>
  );
}

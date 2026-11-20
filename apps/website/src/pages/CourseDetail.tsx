import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BOARD_LABELS, CONTENT_TYPE_LABELS, formatINR } from '@svr/shared';
import EnquiryForm from '../components/EnquiryForm';
import Icon from '../components/Icon';
import { PageHero } from '../components/Section';
import { useCourse } from '../lib/data';
import { useAuth } from '../lib/auth';
import { payWithRazorpay } from '../lib/payments';
import { errorMessage } from '../lib/firebase';
import { useSeo } from '../lib/seo';
import NotFound from './NotFound';

export default function CourseDetail() {
  const { slug = '' } = useParams();
  const { data: course, loading } = useCourse(slug);
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [payState, setPayState] = useState<{ busy: boolean; msg?: string; ok?: boolean }>({ busy: false });

  useSeo(
    course?.title ?? 'Course',
    course ? `${course.title} at SVR Maths Academy — ${course.description.slice(0, 140)}` : 'SVR Maths Academy course',
    course
      ? {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: course.title,
          description: course.description,
          provider: { '@type': 'Organization', name: 'SVR Maths Academy' },
          offers: { '@type': 'Offer', price: course.priceInPaise / 100, priceCurrency: 'INR' },
        }
      : undefined,
  );

  if (!course && !loading) return <NotFound />;
  if (!course) return <div className="container-x py-32 text-center text-ink-900/50">Loading…</div>;

  const isTuition = course.category === 'tuition';

  async function enrol() {
    if (!user) return navigate(`/login?next=/courses/${slug}`);
    if (role !== 'student') return navigate('/account');
    setPayState({ busy: true });
    try {
      const r = await payWithRazorpay({ courseId: course!.id }, { name: user.displayName ?? '', email: user.email ?? '', contact: user.phoneNumber ?? '' });
      setPayState({ busy: false, ok: true, msg: `Payment successful — receipt ${r.receiptNo}. You are now enrolled.` });
    } catch (e) {
      setPayState({ busy: false, msg: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHero eyebrow={`${BOARD_LABELS[course.board]}${course.classLevel ? ` · Class ${course.classLevel}` : ''}`} title={course.title}>
        {course.subtitle}
      </PageHero>
      <section className="container-x grid gap-10 py-14 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <div>
            <h2 className="h-display text-2xl">About this programme</h2>
            <p className="mt-3 leading-relaxed text-ink-900/70">{course.description}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {course.highlights.map((h) => (
                <li key={h} className="flex gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
                  <Icon name="check" className="h-4 w-4 shrink-0 translate-y-0.5 text-royal-600" /> {h}
                </li>
              ))}
            </ul>
          </div>

          {course.chapters.length > 0 && (
            <div>
              <h2 className="h-display text-2xl">Syllabus</h2>
              <p className="mt-1 text-sm text-ink-900/60">Each chapter includes: {Object.values(CONTENT_TYPE_LABELS).join(' · ')}</p>
              <ol className="mt-6 divide-y divide-ink-900/8 overflow-hidden rounded-3xl border border-ink-900/8 bg-white">
                {course.chapters.map((ch, i) => (
                  <li key={ch} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-100 text-xs font-bold text-royal-600">{i + 1}</span>
                    <span className="text-sm font-medium">{ch}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div id="enquire">
            <h2 className="h-display text-2xl">{isTuition ? 'Request a callback' : 'Have questions? Talk to us'}</h2>
            <div className="mt-6">
              <EnquiryForm type={course.slug === 'home-tuition' ? 'home_tuition' : 'admission'} defaultCourse={course.slug} submitLabel="Request callback" />
            </div>
          </div>
        </div>

        <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
          <div className="card p-7">
            <p className="text-3xl font-bold">{formatINR(course.priceInPaise)}</p>
            <p className="mt-1 text-sm text-ink-900/55">
              {course.mrpInPaise && <s className="mr-2">{formatINR(course.mrpInPaise)}</s>}
              {course.durationMonths === 1 ? 'per month' : `${course.durationMonths}-month programme`}
            </p>
            <div className="mt-6 grid gap-3">
              {!isTuition && (
                <button className="btn-gold py-3" onClick={enrol} disabled={payState.busy}>
                  {payState.busy ? 'Processing…' : 'Enrol & pay online'}
                </button>
              )}
              <Link to={`/demo?course=${course.slug}`} className="btn-dark py-3">Book free demo</Link>
              <a href="#enquire" className="btn-ghost py-3">Request callback</a>
            </div>
            {payState.msg && <p className={`mt-4 text-sm ${payState.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{payState.msg}</p>}
            <ul className="mt-6 space-y-2 border-t border-ink-900/8 pt-6 text-sm text-ink-900/70">
              <li className="flex gap-2"><Icon name="live" className="h-4 w-4" /> Live + recorded classes</li>
              <li className="flex gap-2"><Icon name="test" className="h-4 w-4" /> Online tests with rank lists</li>
              <li className="flex gap-2"><Icon name="shield" className="h-4 w-4" /> Secure payments by Razorpay</li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}

import { useState, type FormEvent } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { BOARDS, BOARD_LABELS, CLASS_LEVELS, COL, enquirySchema, normalizePhone, type EnquiryType } from '@svr/shared';
import { db } from '../lib/firebase';
import { useCourses, useSettings, whatsappLink } from '../lib/data';
import { trackEvent } from '../lib/analytics';
import Icon from './Icon';

interface Props {
  type: EnquiryType;
  submitLabel?: string;
  defaultCourse?: string;
  showSlot?: boolean;
  showMessage?: boolean;
}

const SLOTS = ['Weekday evening (5–7 PM)', 'Weekday night (7–9 PM)', 'Saturday', 'Sunday'];

export default function EnquiryForm({ type, submitLabel = 'Submit', defaultCourse = '', showSlot = false, showMessage = true }: Props) {
  const { data: courses } = useCourses();
  const { data: settings } = useSettings();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== '')) as Record<string, string>;
    const parsed = enquirySchema.safeParse({ ...raw, type });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    const v = parsed.data;
    const course = courses.find((c) => c.slug === v.courseSlug);
    const text = [
      `New ${type.replace('_', ' ')} enquiry — SVR Maths Academy`,
      `Name: ${v.name}`,
      `Phone: ${v.phone}`,
      v.classLevel && `Class: ${v.classLevel}`,
      v.board && `Board: ${BOARD_LABELS[v.board]}`,
      course && `Course: ${course.title}`,
      v.preferredSlot && `Preferred slot: ${v.preferredSlot}`,
      v.message && `Message: ${v.message}`,
    ]
      .filter(Boolean)
      .join('\n');
    setSummary(text);

    if (!db) {
      // Firebase not configured yet: hand the enquiry to WhatsApp instead.
      window.open(whatsappLink(settings.whatsapp, text), '_blank', 'noopener');
      setStatus('done');
      return;
    }
    setStatus('sending');
    try {
      const payload: Record<string, unknown> = {
        type,
        name: v.name,
        phone: normalizePhone(v.phone),
        status: 'new',
        source: 'website',
        createdAt: serverTimestamp(),
      };
      if (v.email) payload.email = v.email;
      if (v.classLevel) payload.classLevel = v.classLevel;
      if (v.board) payload.board = v.board;
      if (v.courseSlug) payload.courseSlug = v.courseSlug;
      if (v.preferredSlot) payload.preferredSlot = v.preferredSlot;
      if (v.message) payload.message = v.message;
      await addDoc(collection(db, COL.enquiries), payload);
      trackEvent('generate_lead', { type });
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h3 className="h-display mt-4 text-2xl">Thank you!</h3>
        <p className="mt-2 text-ink-900/65">Our admissions team will call you within one working day.</p>
        <a href={whatsappLink(settings.whatsapp, summary)} target="_blank" rel="noopener noreferrer" className="btn-dark mt-6">
          Continue on WhatsApp
        </a>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-rose-600">{errors[k]}</p>;

  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-6 sm:grid-cols-2 sm:p-8" noValidate>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="name">Student name *</label>
        <input id="name" name="name" className="field" autoComplete="name" required />
        {err('name')}
      </div>
      <div>
        <label className="label" htmlFor="phone">Mobile number *</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="98xxxxxxxx" autoComplete="tel" required />
        {err('phone')}
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="field" autoComplete="email" />
        {err('email')}
      </div>
      <div>
        <label className="label" htmlFor="classLevel">Class</label>
        <select id="classLevel" name="classLevel" className="field" defaultValue="">
          <option value="">Select class</option>
          {CLASS_LEVELS.map((c) => (
            <option key={c} value={c}>Class {c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="board">Board / Programme</label>
        <select id="board" name="board" className="field" defaultValue="">
          <option value="">Select</option>
          {BOARDS.map((b) => (
            <option key={b} value={b}>{BOARD_LABELS[b]}</option>
          ))}
        </select>
      </div>
      <div className={showSlot ? '' : 'sm:col-span-2'}>
        <label className="label" htmlFor="courseSlug">Course</label>
        <select id="courseSlug" name="courseSlug" className="field" defaultValue={defaultCourse}>
          <option value="">Not sure yet</option>
          {courses.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
      </div>
      {showSlot && (
        <div>
          <label className="label" htmlFor="preferredSlot">Preferred demo slot</label>
          <select id="preferredSlot" name="preferredSlot" className="field" defaultValue="">
            <option value="">Any time</option>
            {SLOTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      {showMessage && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={3} className="field" maxLength={1000} />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-900/50">We respect your privacy. Your details are used only to contact you about admissions.</p>
        <button className="btn-gold" disabled={status === 'sending'}>
          {status === 'sending' ? 'Submitting…' : submitLabel}
        </button>
      </div>
      {status === 'error' && <p className="text-sm text-rose-600 sm:col-span-2">Could not submit right now. Please try again or message us on WhatsApp.</p>}
    </form>
  );
}

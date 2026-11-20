import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
} from 'firebase/auth';
import { BOARDS, BOARD_LABELS, CLASS_LEVELS, normalizePhone, phoneSchema, studentRegistrationSchema } from '@svr/shared';
import { auth, callable, errorMessage, firebaseEnabled } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { useSeo } from '../lib/seo';

const registerStudent = callable<unknown, { ok: boolean; admissionNo?: string }>('registerStudent');

export default function Login() {
  useSeo('Student Login', 'Log in to SVR Learn — your classes, tests and progress.');
  const { user, role, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/account';

  useEffect(() => {
    if (!loading && user && role) navigate(next, { replace: true });
  }, [loading, user, role, navigate, next]);

  if (!firebaseEnabled) {
    return (
      <Shell>
        <p className="text-sm text-ink-900/70">Online login will be available once the academy's Firebase project is connected. Please contact the academy for access.</p>
      </Shell>
    );
  }
  if (loading) return <Shell><p className="text-sm text-ink-900/60">Loading…</p></Shell>;
  if (user && !role) return <Register onDone={async () => { await refresh(); navigate(next, { replace: true }); }} />;
  return <SignIn />;
}

function Shell({ children, title = 'Welcome to SVR Learn' }: { children: React.ReactNode; title?: string }) {
  return (
    <section className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="h-display text-3xl">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function SignIn() {
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => recaptchaRef.current?.clear(), []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sendOtp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const phone = String(new FormData(e.currentTarget).get('phone') ?? '');
    const p = phoneSchema.safeParse(phone);
    if (!p.success) return setError(p.error.issues[0].message);
    run(async () => {
      recaptchaRef.current ??= new RecaptchaVerifier(auth!, 'recaptcha', { size: 'invisible' });
      setConfirm(await signInWithPhoneNumber(auth!, normalizePhone(p.data), recaptchaRef.current));
      setInfo('OTP sent. It may take up to a minute to arrive.');
    });
  };

  const verifyOtp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('otp') ?? '').trim();
    run(async () => {
      await confirm!.confirm(code);
    });
  };

  const emailSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email'));
    const password = String(fd.get('password'));
    run(async () => {
      if (emailMode === 'login') await signInWithEmailAndPassword(auth!, email, password);
      else await createUserWithEmailAndPassword(auth!, email, password);
    });
  };

  const forgot = (form: HTMLFormElement | null) => {
    const email = form ? String(new FormData(form).get('email') ?? '') : '';
    if (!email) return setError('Enter your email above first.');
    run(async () => {
      await sendPasswordResetEmail(auth!, email);
      setInfo('Password reset link sent to your email.');
    });
  };

  const emailFormRef = useRef<HTMLFormElement>(null);

  return (
    <Shell>
      <div className="grid grid-cols-2 rounded-full bg-paper p-1 text-sm font-medium">
        {(['phone', 'email'] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setError(''); }} className={`rounded-full py-2 ${mode === m ? 'bg-white shadow-sm' : 'text-ink-900/60'}`}>
            {m === 'phone' ? 'Mobile OTP' : 'Email'}
          </button>
        ))}
      </div>

      {mode === 'phone' ? (
        !confirm ? (
          <form onSubmit={sendOtp} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="phone">Mobile number</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="98xxxxxxxx" autoComplete="tel" />
            </div>
            <button className="btn-gold w-full py-3" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="otp">Enter 6-digit OTP</label>
              <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field tracking-[0.5em]" />
            </div>
            <button className="btn-gold w-full py-3" disabled={busy}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
            <button type="button" className="w-full text-sm text-royal-600" onClick={() => setConfirm(null)}>Change number</button>
          </form>
        )
      ) : (
        <form ref={emailFormRef} onSubmit={emailSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="field" autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} className="field" autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'} required />
          </div>
          <button className="btn-gold w-full py-3" disabled={busy}>{busy ? 'Please wait…' : emailMode === 'login' ? 'Log in' : 'Create account'}</button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-royal-600" onClick={() => setEmailMode(emailMode === 'login' ? 'signup' : 'login')}>
              {emailMode === 'login' ? 'New student? Create account' : 'Have an account? Log in'}
            </button>
            {emailMode === 'login' && <button type="button" className="text-ink-900/60" onClick={() => forgot(emailFormRef.current)}>Forgot password?</button>}
          </div>
        </form>
      )}
      <div id="recaptcha" />
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {info && <p className="mt-4 text-sm text-emerald-700">{info}</p>}
      <p className="mt-6 text-center text-xs text-ink-900/50">
        Parents receive login details from the academy. <Link to="/contact" className="text-royal-600">Need help?</Link>
      </p>
    </Shell>
  );
}

function Register({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const input = {
      name: fd.name,
      classLevel: fd.classLevel,
      board: fd.board,
      school: fd.school || undefined,
      city: fd.city || undefined,
      parent: fd.parentName ? { name: fd.parentName, phone: fd.parentPhone, email: fd.parentEmail || undefined } : undefined,
    };
    const parsed = studentRegistrationSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    setBusy(true);
    setError('');
    try {
      await registerStudent(parsed.data);
      if (auth?.currentUser && !auth.currentUser.displayName) await updateProfile(auth.currentUser, { displayName: parsed.data.name });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Complete your profile">
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className="label" htmlFor="name">Student name *</label>
          <input id="name" name="name" className="field" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="classLevel">Class *</label>
            <select id="classLevel" name="classLevel" className="field" required defaultValue="">
              <option value="" disabled>Select</option>
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="board">Board *</label>
            <select id="board" name="board" className="field" required defaultValue="">
              <option value="" disabled>Select</option>
              {BOARDS.map((b) => <option key={b} value={b}>{BOARD_LABELS[b]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="school" className="field" placeholder="School" />
          <input name="city" className="field" placeholder="City" />
        </div>
        <p className="pt-2 text-sm font-semibold">Parent / guardian</p>
        <input name="parentName" className="field" placeholder="Parent name" />
        <div className="grid grid-cols-2 gap-3">
          <input name="parentPhone" type="tel" className="field" placeholder="Parent mobile" />
          <input name="parentEmail" type="email" className="field" placeholder="Parent email" />
        </div>
        <button className="btn-gold mt-2 py-3" disabled={busy}>{busy ? 'Saving…' : 'Create my SVR account'}</button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </Shell>
  );
}

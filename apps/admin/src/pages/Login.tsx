import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { BRAND } from '@svr/shared';
import { auth, errorMessage, firebaseConfigured } from '../lib/firebase';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, role, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [email, setEmail] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get('password'));
    setBusy(true);
    setMsg(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setMsg({ t: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-royal-500/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
          <p className="font-display text-xl font-semibold">{BRAND.name}</p>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{BRAND.products.control}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-tight">The academy control centre.</h1>
          <p className="mt-4 max-w-md text-white/60">Students, courses, live classes, examinations, fees and reports — one place, one backend.</p>
        </div>
        <p className="relative text-xs text-white/40">{BRAND.platform} · {BRAND.academicYear}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-900/60">Staff accounts only.</p>
          {!firebaseConfigured && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Firebase is not configured. Copy <code>.env.example</code> to <code>.env</code> and add your project keys.</p>
          )}
          {user && !(role === 'admin' || role === 'teacher') && (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {user.email ?? user.phoneNumber} does not have staff access. <button className="underline" onClick={logout}>Sign out</button>
            </div>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="field py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="field py-2.5" autoComplete="current-password" required />
            </div>
            <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button
              type="button"
              className="w-full text-sm text-royal-600"
              onClick={async () => {
                if (!email) return setMsg({ t: 'Enter your email first.' });
                await sendPasswordResetEmail(auth, email).then(() => setMsg({ t: 'Password reset email sent.', ok: true }), (e) => setMsg({ t: errorMessage(e) }));
              }}
            >
              Forgot password?
            </button>
            {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.t}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Input } from './ui';
import { getGoogleIdToken, googleEnabled, preloadGoogle } from '@/lib/firebase';

export default function OtpLogin({ onDone, title = 'Admin sign in', subtitle = 'Authorized platform administrators only.' }) {
  const { setUser } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => {
    preloadGoogle()?.catch(() => {});
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e) {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { email } });
      setIsNew(r.isNewUser);
      setStep('code');
      setWait(30);
      setTimeout(() => codeRef.current?.focus(), 80);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.fields?.email || e2.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr('');
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      const r = await api('/auth/google', { method: 'POST', body: { idToken } });
      setUser(r.user);
      onDone?.(r.user);
    } catch (e2) {
      const c = e2?.code || '';
      if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
      if (c === 'auth/popup-blocked') setErr('Your browser blocked the Google window. Allow pop-ups and try again.');
      else if (c === 'auth/unauthorized-domain') setErr('This website is not yet allowed in Firebase Authorized domains.');
      else setErr(e2 instanceof ApiError ? e2.message : 'Google sign-in failed. Try email code instead.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e, c = code) {
    e?.preventDefault();
    if (c.length !== 6 || busy) return;
    if (isNew && name.trim().length < 2) return setErr('Please enter your name');
    setErr('');
    setBusy(true);
    try {
      const body = { email, code: c, ...(isNew ? { name: name.trim() } : {}) };
      const r = await api('/auth/otp/verify', { method: 'POST', body });
      setUser(r.user);
      onDone?.(r.user);
    } catch (e2) {
      if (e2.code === 'name_required') setIsNew(true);
      setErr(e2.message);
      if (e2.code === 'otp_invalid') setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <form className="stack" onSubmit={send}>
        <div className="stack-sm">
          <h2>{title}</h2>
          <p className="muted small">{subtitle}</p>
        </div>
        <Input label="Admin email" type="email" inputMode="email" autoComplete="email" placeholder="admin@qline.app" value={email} onChange={(e) => setEmail(e.target.value)} error={err} required autoFocus maxLength={254} />
        <Button block type="submit" loading={busy} disabled={!email.includes('@')}>Continue with email</Button>
        {googleEnabled && (
          <>
            <div className="or"><span>or</span></div>
            <Button block type="button" variant="secondary" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.93h5.35c-.23 1.45-1.67 4.25-5.35 4.25a5.9 5.9 0 0 1 0-11.8c1.87 0 3.12.8 3.84 1.48l2.1-2.03A8.9 8.9 0 0 0 12 3.1a9.1 9.1 0 1 0 0 18.2c5.25 0 8.73-3.69 8.73-8.9 0-.6-.06-1.05-.15-1.3Z" /></svg>
              Continue with Google
            </Button>
          </>
        )}
      </form>
    );
  }

  return (
    <form className="stack" onSubmit={verify}>
      <div className="stack-sm">
        <h2>Check your email</h2>
        <p className="muted small">We sent a code to <b style={{ color: 'var(--fg)' }}>{email}</b>.</p>
      </div>
      {isNew && <Input label="Your name" autoComplete="name" placeholder="Admin Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
      <Input
        ref={codeRef}
        label="6 digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        value={code}
        maxLength={6}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          setErr('');
          if (v.length === 6 && (!isNew || name.trim().length >= 2)) verify(null, v);
        }}
        error={err}
        className="num"
        style={{ letterSpacing: '0.5em', fontSize: 24, textAlign: 'center', fontWeight: 600 }}
      />
      <Button block type="submit" loading={busy} disabled={code.length !== 6}>Verify</Button>
      <div className="row between">
        <button type="button" className="btn ghost sm" onClick={() => { setStep('email'); setCode(''); setErr(''); }}>Change email</button>
        <button type="button" className="btn ghost sm" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button>
      </div>
    </form>
  );
}


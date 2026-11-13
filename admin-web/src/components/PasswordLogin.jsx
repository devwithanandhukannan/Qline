'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input } from './ui';

export default function PasswordLogin({
  onDone,
  title = 'Admin sign in',
  subtitle = 'Enter your administrator email and password.',
}) {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      setUser(r.user);
      onDone?.(r.user);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.fields?.email || e2.fields?.password || e2.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="stack-sm">
        <h2>{title}</h2>
        <p className="muted small">{subtitle}</p>
      </div>

      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="admin@qline.app"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr('');
        }}
        required
        autoFocus
        maxLength={254}
      />

      <Field label="Password" id="f_admin_pw" error={err}>
        <div style={{ position: 'relative' }}>
          <input
            id="f_admin_pw"
            className={`input${err ? ' err' : ''}`}
            style={{ paddingRight: 64 }}
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErr('');
            }}
            required
            maxLength={128}
          />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setShowPw((v) => !v)}
            style={{ position: 'absolute', right: 6, top: 5, minHeight: 34, padding: '0 10px' }}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      <Button block type="submit" loading={busy} disabled={!email.includes('@') || !password}>
        Sign in
      </Button>
    </form>
  );
}


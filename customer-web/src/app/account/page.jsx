'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell, { LoginGate } from '@/components/Shell';
import { Button, Input, useConfirm, useToast } from '@/components/ui';
import { AccountSkeleton } from '@/components/Skeletons';
import { PwaInstallCard } from '@/components/Pwa';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function Profile() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(user.name); setPhone(user.phone || ''); }, [user]);
  const dirty = name !== user.name || phone !== (user.phone || '');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api('/auth/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } });
      setUser(r.user);
      toast.show('Saved');
    } catch (e2) {
      setErrors(e2.fields?.name || e2.fields?.phone ? e2.fields : { name: e2.message });
    } finally {
      setBusy(false);
    }
  }

  async function out() {
    const ok = await confirm({ title: 'Sign out?', message: 'You can sign back in any time with a code sent to your email.', confirmText: 'Sign out', destructive: true });
    if (!ok) return;
    await logout();
    router.replace('/explore');
  }

  return (
    <div className="stack-lg">
      <h1 className="enter">Account</h1>
      <form className="card stack enter" onSubmit={save}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} autoComplete="name" />
        <Input label="Phone (optional)" hint="Shops can call you if they are running late." value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} inputMode="tel" autoComplete="tel" maxLength={20} />
        <div className="field"><label>Email</label><div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-2)' }}>{user.email}</div></div>
        <Button type="submit" block loading={busy} disabled={!dirty}>Save changes</Button>
      </form>
      <PwaInstallCard />
      <div className="list enter">
        {process.env.NEXT_PUBLIC_ORG_URL && <a className="item" href={process.env.NEXT_PUBLIC_ORG_URL} rel="noopener">I own a shop</a>}
        <button className="item" style={{ color: 'var(--bad)' }} onClick={out}>Sign out</button>
      </div>
    </div>
  );
}

export default function Account() {
  return (
    <Shell>
      <LoginGate reason="Sign in to manage your account" fallback={<AccountSkeleton />}><Profile /></LoginGate>
    </Shell>
  );
}

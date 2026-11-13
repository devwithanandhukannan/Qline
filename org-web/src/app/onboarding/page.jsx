'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell, { useShop } from '@/components/Shell';
import { Button, Input, Textarea, useToast } from '@/components/ui';
import { Plus, Trash } from '@/components/icons';
import { api, ApiError } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';


function Form() {
  const router = useRouter();
  const toast = useToast();
  const { shop } = useShop();
  const [f, setF] = useState({ name: '', category: 'barber', city: '', area: '', address: '', phone: '', description: '' });
  const [services, setServices] = useState([{ name: 'Haircut', durationMin: '30', price: '' }]);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (shop) {
    router.replace('/dashboard');
    return null;
  }

  const setSvc = (i, k, v) => setServices(services.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  async function submit(e) {
    e.preventDefault();
    const e2 = {};
    if (f.name.trim().length < 2) e2.name = 'Enter your shop name';
    if (f.city.trim().length < 2) e2.city = 'Enter your city';
    const clean = services.filter((s) => s.name.trim());
    if (!clean.length) e2.services = 'Add at least one service';
    if (clean.some((s) => !(Number(s.durationMin) >= 5 && Number(s.durationMin) <= 480))) e2.services = 'Duration must be 5 to 480 minutes';
    setErrs(e2);
    if (Object.keys(e2).length) return;
    setBusy(true);
    try {
      await api('/org/shop', {
        method: 'POST',
        body: {
          ...f,
          name: f.name.trim(),
          city: f.city.trim(),
          services: clean.map((s) => ({ name: s.name.trim(), durationMin: Number(s.durationMin), price: Number(s.price) || 0, active: true })),
        },
      });
      router.replace('/dashboard?welcome=1');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrs(err.fields);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-lg enter" onSubmit={submit} style={{ maxWidth: 560, margin: '0 auto' }} noValidate>
      <div className="stack-sm">
        <h1>Set up your shop</h1>
        <p className="muted">This takes two minutes. You can change everything later.</p>
      </div>
      <div className="stack">
        <Input label="Shop name" value={f.name} onChange={set('name')} error={errs.name} placeholder="e.g. Royal Cuts" maxLength={80} autoFocus />
        <div className="field">
          <label>Type</label>
          <div className="hscroll" role="radiogroup" aria-label="Shop type">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.value} role="radio" aria-checked={f.category === c.value} className={`chip ${f.category === c.value ? 'on' : ''}`} onClick={() => setF({ ...f, category: c.value })}>{c.label}</button>
            ))}
          </div>
        </div>
        <div className="grid two">
          <Input label="City" value={f.city} onChange={set('city')} error={errs.city} placeholder="Kochi" maxLength={80} />
          <Input label="Area" value={f.area} onChange={set('area')} error={errs.area} placeholder="Edappally" maxLength={80} />
        </div>
        <Input label="Address" value={f.address} onChange={set('address')} error={errs.address} placeholder="Street, landmark" maxLength={200} />
        <Input label="Phone" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} error={errs.phone} placeholder="Optional" maxLength={20} />
        <Textarea label="About (optional)" value={f.description} onChange={set('description')} error={errs.description} maxLength={400} placeholder="A line about your shop" />
      </div>

      <div className="stack-sm">
        <div className="section-title">First services</div>
        <div className="list">
          {services.map((s, i) => (
            <div key={i} className="item" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="grow" style={{ minWidth: 140 }}>
                <input className="input" aria-label="Service name" placeholder="Service name" value={s.name} onChange={(e) => setSvc(i, 'name', e.target.value)} maxLength={60} />
              </div>
              <input className="input" aria-label="Minutes" inputMode="numeric" placeholder="Min" style={{ width: 84 }} value={s.durationMin} onChange={(e) => setSvc(i, 'durationMin', e.target.value.replace(/\D/g, ''))} />
              <input className="input" aria-label="Price" inputMode="numeric" placeholder="₹" style={{ width: 90 }} value={s.price} onChange={(e) => setSvc(i, 'price', e.target.value.replace(/\D/g, ''))} />
              {services.length > 1 && (
                <button type="button" className="ico-btn" aria-label="Remove service" onClick={() => setServices(services.filter((_, j) => j !== i))}><Trash /></button>
              )}
            </div>
          ))}
        </div>
        {errs.services && <span className="err-text">{errs.services}</span>}
        <Button type="button" variant="secondary" size="sm" onClick={() => setServices([...services, { name: '', durationMin: '15', price: '' }])} style={{ alignSelf: 'flex-start' }}><Plus width="16" height="16" /> Add service</Button>
      </div>
      <Button block type="submit" loading={busy}>Create my shop</Button>
    </form>
  );
}

export default function Onboarding() {
  return (
    <Shell noShop wide={false}>
      <Form />
    </Shell>
  );
}

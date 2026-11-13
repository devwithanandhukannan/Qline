'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useReveal, useScrolled, cx } from '@/components/ui';

const CARDS = [
  ['t1', 'Hours and days off', 'Weekly hours, split shifts, holidays and staff time off. Override any single day.'],
  ['t2', 'Queue and slots', 'Set the maximum queue, service times and slot length. Pause the line when you need a breather.'],
  ['t3', 'Reports and graphs', 'See visits per day, new customers, busiest hours and ratings in one calm view.'],
];
const STEPS = [
  ['Create your shop', 'Name, area, services and prices.'],
  ['Set hours and limits', 'Opening times, days off, queue size.'],
  ['Print your QR', 'Stick it on the wall. Done.'],
];
const FAQ = [
  ['Is it free for shops?', 'Yes. Qline is built to run free for small shops.'],
  ['Do my customers need an app?', 'No. They scan the QR and it opens in their browser.'],
  ['Can I close for a day or a staff holiday?', 'Yes. Add a day off, a staff time off, or override a single date.'],
];

export default function Landing() {
  const { user, ready } = useAuth();
  const scrolled = useScrolled();
  useReveal();
  const cta = ready && user ? { href: '/dashboard', label: 'Open dashboard' } : { href: '/login', label: 'Set up your shop' };
  const year = new Date().getFullYear();
  return (
    <>
      <header className={cx('topbar', scrolled && 'scrolled')}>
        <div className="topbar-in">
          <Link href="/" className="brand">qline</Link>
          <span className="pilltag">for shops</span>
          <div className="grow" />
          <Link href={cta.href} className="btn sm">{ready && user ? 'Open dashboard' : 'Sign in'}</Link>
        </div>
      </header>

      <main className="lp">
        <section className="lp-hero">
          <h1 className="enter">Run your queue.<br />Not your stress.</h1>
          <p className="lede enter">A free queue and booking system for barbers, salons and cafes. Set your hours once, put a QR code on the wall, and let customers line up on their phones.</p>
          <div className="lp-cta enter"><Link href={cta.href} className="btn">{cta.label}</Link><a href="#how" className="btn secondary">See how it works</a></div>
          <div className="lp-stage enter">
            <img
              src="/hero-shop.jpg"
              alt="Shop queue management counter with live queue display and QR code"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </section>

        <section className="lp-section lp-center reveal">
          <h2>Set your limits once. Qline keeps the line honest, even on your busiest day.</h2>
          <div className="lp-strip">
            {CARDS.map(([c, t, d]) => <div key={t} className={cx('lp-tile', c)} style={{ minHeight: 168, textAlign: 'left' }}><b style={{ fontSize: 18 }}>{t}</b><span style={{ fontSize: 13.5, lineHeight: 1.45, opacity: 0.9 }}>{d}</span></div>)}
          </div>
        </section>
      </main>

      <section className="lp-grey reveal" id="how">
        <div className="lp">
          <div className="lp-head"><h2>Set up in three steps</h2></div>
          <div className="lp-steps">
            {STEPS.map(([t, d], i) => <div key={t} className="lp-stepcard"><div className="num">{i + 1}</div><b style={{ fontSize: 15 }}>{t}</b><span className="small muted">{d}</span></div>)}
          </div>
        </div>
      </section>

      <main className="lp">
        <section className="lp-section reveal">
          <div className="lp-head" style={{ textAlign: 'center' }}><h2>Questions</h2></div>
          <div className="lp-faq">{FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </section>
        <section className="lp-two reveal">
          <div><h2>Ready to calm the chaos?</h2><p>Set up your shop in a few minutes.</p></div>
          <div className="btns"><Link href={cta.href} className="btn">{cta.label}</Link></div>
        </section>
      </main>

      <footer className="lp-foot"><div className="lp"><div className="bottom" style={{ marginTop: 0 }}><span className="logo">qline.</span><span>{year} Qline</span></div></div></footer>
    </>
  );
}

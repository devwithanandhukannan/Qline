'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useReveal, useScrolled, cx } from '@/components/ui';
import { Scissors, Gem, Coffee, Store } from '@/components/icons';
import { BookTokenArt, FindShopArt, WalkInArt } from '@/components/HowItWorksArt';

const TILES = [
  ['t1', 'Barbers', Scissors],
  ['t2', 'Salons', Gem],
  ['t3', 'Cafes and tables', Coffee],
  ['t4', 'And more shops', Store],
];
const WHY = [
  ['Honest waits', 'The estimate counts the people ahead, and the shop’s own service times.'],
  ['Clear limits', 'Shops set hours and queue limits, so you never join a line that cannot finish today.'],
  ['One minute sign up', 'A six digit code to your email, or Google. No passwords to remember.'],
];
const STEPS = [
  ['1. Find your shop', 'Scan the QR on the wall or search by name or area.', FindShopArt],
  ['2. Join or book', 'Take a live token, or pick a free slot for later.', BookTokenArt],
  ['3. Walk in on time', 'Watch your turn live, then rate the visit.', WalkInArt],
];
const FAQ = [
  ['Is Qline free for customers?', 'Yes. You never pay to join a queue or book a slot.'],
  ['Do I need to install an app?', 'No. Qline runs in your browser, and you can add it to your home screen.'],
  ['What if the shop closes early?', 'Shops can change a single day. Your booking shows the update.'],
  ['Who can leave a rating?', 'Only customers with a completed visit.'],
];

export default function Landing() {
  const { user } = useAuth();
  const scrolled = useScrolled();
  useReveal();
  const orgUrl = process.env.NEXT_PUBLIC_ORG_URL;
  const year = new Date().getFullYear();
  return (
    <>
      <header className={cx('topbar', scrolled && 'scrolled')}>
        <div className="topbar-in">
          <Link href="/" className="brand">qline</Link>
          <div className="grow" />
          {orgUrl && <a href={orgUrl} className="btn ghost sm">For shops</a>}
          <Link href={user ? '/explore' : '/login'} className="btn sm">{user ? 'Open app' : 'Sign in'}</Link>
        </div>
      </header>

      <main className="lp">
        <section className="lp-hero">
          <h1 className="enter">Skip the wait.<br />Join the queue.<br />Book in seconds.</h1>
          <p className="lede enter">See your turn live at your local barber, salon or cafe, and walk in right on time.</p>
          <div className="lp-cta enter">
            <Link href="/explore" className="btn">Find a shop</Link>
            <Link href="/explore?scan=1" className="btn secondary">Scan a QR code</Link>
          </div>
          <div className="lp-stage enter">
            <img
              src="/hero-stage.jpg"
              alt="Qline live queue token, time slot selector, and QR check-in preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </section>

        <section className="lp-section lp-center reveal">
          <h2>No more guessing how long it will take. Qline shows the real line, then tells you when to leave.</h2>
          <div className="lp-strip">
            {TILES.map(([c, t, Icon]) => (
              <div key={t} className={cx('lp-tile', c)}>
                <span className="lp-tile-icon"><Icon /></span>
                <b>{t}</b>
              </div>
            ))}
          </div>
        </section>
      </main>

      <section className="lp-grey reveal">
        <div className="lp">
          <div className="kicker" style={{ marginBottom: 16 }}>What is Qline</div>
          <p className="lp-statement">Qline is a free, simple queue and booking app for local shops. <span>Customers join from their phone. Shops run the line from theirs. Nobody waits in the dark.</span></p>
          <div className="lp-words"><span>Live queue</span><span>Time slots</span><span>QR scan</span><span>Email code</span><span>Google sign in</span><span>Ratings</span></div>
        </div>
      </section>

      <main className="lp">
        <section className="lp-section reveal">
          <div className="lp-head"><h2>Why Qline</h2><p>Built for the customer first</p></div>
          <div className="lp-why">
            {WHY.map(([t, d]) => <div key={t}><span className="pilltag">{t}</span><h3>{d}</h3></div>)}
          </div>
        </section>

        <section id="how" className="lp-section reveal">
          <div className="lp-head"><h2>How it works</h2></div>
          <div className="lp-steps">
            {STEPS.map(([t, d, Art]) => (
              <div key={t} className="lp-step">
                <div className="art">
                  <Art />
                </div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section reveal">
          <div className="lp-head" style={{ textAlign: 'center' }}><h2>Questions</h2></div>
          <div className="lp-faq">
            {FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="lp-two reveal">
          <div><h2>Ready to skip the wait?</h2><p>Find a shop near you in a few taps.</p></div>
          <div className="btns"><Link href="/explore" className="btn">Find a shop</Link>{orgUrl && <a href={orgUrl} className="btn secondary">I run a shop</a>}</div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp">
          <div className="cols">
            <div><b>Product</b><Link href="/explore">Find a shop</Link><a href="#how">How it works</a></div>
            {orgUrl && <div><b>Shops</b><a href={orgUrl}>Qline for shops</a></div>}
          </div>
          <div className="bottom"><span className="logo">qline.</span><span>{year} Qline</span></div>
        </div>
      </footer>
    </>
  );
}

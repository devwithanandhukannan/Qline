import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page" style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
      <div className="stack center" style={{ alignItems: 'center' }}>
        <h1>Page not found</h1>
        <p className="muted">That page does not exist.</p>
        <Link href="/dashboard" className="btn">Go to dashboard</Link>
      </div>
    </main>
  );
}

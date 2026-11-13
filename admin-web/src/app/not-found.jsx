import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page center" style={{ paddingTop: 96 }}>
      <div className="stack">
        <h1>Page not found</h1>
        <p className="muted">That admin page does not exist.</p>
        <div>
          <Link href="/dashboard" className="btn">Go to overview</Link>
        </div>
      </div>
    </main>
  );
}


import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
      <h1>Page not found</h1>
      <p className="muted" style={{ margin: '12px 0 28px' }}>That page does not exist.</p>
      <Link href="/explore" className="btn">Find a shop</Link>
    </main>
  );
}

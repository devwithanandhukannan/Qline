'use client';
import { useEffect, useRef, useState } from 'react';

export function slugFromScan(value) {
  try {
    const u = new URL(value);
    const m = u.pathname.match(/^\/s\/([a-z0-9-]{3,80})\/?$/);
    return m ? m[1] : null;
  } catch {
    return /^[a-z0-9-]{3,80}$/.test(value) ? value : null;
  }
}

// In-app QR scanner using the camera + the BarcodeDetector API (Chrome/Android, recent Safari).
// Where unsupported, people can still scan with their phone's own camera app: the QR is a normal link.
export default function Scanner({ onSlug }) {
  const video = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | unsupported | denied | bad
  useEffect(() => {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    let stream;
    let raf;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        setState('scanning');
        let last = 0;
        const tick = async (ts) => {
          if (stopped) return;
          if (ts - last > 250) {
            last = ts;
            try {
              const codes = await detector.detect(video.current);
              for (const c of codes) {
                const slug = slugFromScan(c.rawValue);
                if (slug) {
                  stopped = true;
                  stream.getTracks().forEach((t) => t.stop());
                  onSlug(slug);
                  return;
                }
                setState('bad');
              }
            } catch {}
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setState('denied');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onSlug]);

  if (state === 'unsupported') {
    return <p className="muted center" style={{ padding: '24px 0' }}>Open your phone&apos;s camera app and point it at the shop&apos;s QR code. It opens Qline directly.</p>;
  }
  if (state === 'denied') {
    return <p className="muted center" style={{ padding: '24px 0' }}>Camera access was blocked. Allow the camera in your browser settings, or scan with your phone&apos;s camera app.</p>;
  }
  return (
    <div className="stack">
      <div style={{ position: 'relative', overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
        <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: '18%', border: '3px solid #fff', boxShadow: '0 0 0 999px rgba(0,0,0,.35)' }} />
      </div>
      <p className="muted small center">{state === 'bad' ? 'That QR code is not a Qline shop. Try another one.' : 'Point the camera at the QR code on the shop wall.'}</p>
    </div>
  );
}

'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button, Modal } from './ui';
import { Check, Download, Share, X } from './icons';

const APP_NAME = 'Qline Admin';
const APP_SUBTITLE = 'Install on your device to monitor orgs and live data anytime.';

const PwaCtx = createContext(null);
export const usePwa = () => useContext(PwaCtx);

export function PwaProvider({ children }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setInstalled(!!standalone);
    const ua = navigator.userAgent || '';
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    try {
      if (sessionStorage.getItem('qline_admin_pwa_dismissed') === '1') setDismissed(true);
    } catch {}

    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setGuideOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem('qline_admin_pwa_dismissed', '1');
    } catch {}
  }, []);

  const install = useCallback(async () => {
    if (installed) return;
    if (promptEvent) {
      setInstalling(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') setInstalled(true);
        setPromptEvent(null);
      } catch {
        setGuideOpen(true);
      } finally {
        setInstalling(false);
      }
      return;
    }
    setGuideOpen(true);
  }, [installed, promptEvent]);

  return (
    <PwaCtx.Provider value={{ installed, canPrompt: !!promptEvent, isIOS, installing, install, dismissed, dismiss }}>
      {children}
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title={`Install ${APP_NAME}`}>
        <div className="stack" style={{ textAlign: 'left' }}>
          <div className="row between">
            <h3>Install {APP_NAME}</h3>
            <button className="btn icon ghost" onClick={() => setGuideOpen(false)} aria-label="Close">
              <X width="18" height="18" />
            </button>
          </div>
          {isIOS ? (
            <div className="stack-sm small muted">
              <p>Add {APP_NAME} to your iPhone or iPad Home Screen:</p>
              <div className="list">
                <div className="item">
                  <Share width="18" height="18" />
                  <span>1. Tap the <b>Share</b> button in Safari</span>
                </div>
                <div className="item">
                  <Download width="18" height="18" />
                  <span>2. Scroll and tap <b>Add to Home Screen</b></span>
                </div>
                <div className="item">
                  <Check width="18" height="18" />
                  <span>3. Tap <b>Add</b> in the top right corner</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="stack-sm small muted">
              <p>Install {APP_NAME} directly from your browser:</p>
              <div className="list">
                <div className="item">
                  <span>1. Open your browser menu (<b>⋮</b> or address bar icon)</span>
                </div>
                <div className="item">
                  <span>2. Tap <b>Install app</b> or <b>Add to Home screen</b></span>
                </div>
              </div>
            </div>
          )}
          <Button block onClick={() => setGuideOpen(false)}>Got it</Button>
        </div>
      </Modal>
    </PwaCtx.Provider>
  );
}

export function PwaInstallCard({ title = `Download ${APP_NAME} App`, subtitle = APP_SUBTITLE }) {
  const pwa = usePwa();
  if (!pwa) return null;
  const { installed, installing, install } = pwa;

  return (
    <div className="card row between wrap enter" style={{ gap: 12 }}>
      <div className="row grow" style={{ gap: 12, minWidth: 200 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--inv-bg)',
            color: 'var(--inv-fg)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          {installed ? <Check width="20" height="20" /> : <Download width="20" height="20" />}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{installed ? `${APP_NAME} installed` : title}</b>
          <div className="small muted">{installed ? 'Running in app mode on your device.' : subtitle}</div>
        </div>
      </div>
      {installed ? (
        <span className="tag ok">Installed</span>
      ) : (
        <Button size="sm" onClick={install} loading={installing}>
          <Download width="15" height="15" /> Download app
        </Button>
      )}
    </div>
  );
}

export function PwaGuestBanner() {
  const { user, ready } = useAuth();
  const pwa = usePwa();
  const path = usePathname() || '';
  if (!ready || user || !pwa || pwa.installed || pwa.dismissed) return null;
  if (path === '/login') return null;

  return (
    <div className="pwa-banner" role="region" aria-label={`Download ${APP_NAME} app`}>
      <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
        <div className="pwa-ico"><Download width="17" height="17" /></div>
        <div className="grow" style={{ minWidth: 0 }}>
          <b className="small" style={{ display: 'block', lineHeight: 1.2 }}>Get {APP_NAME}</b>
          <span className="tiny muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Install the app for quick access</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flex: 'none' }}>
        <Button size="sm" onClick={pwa.install} loading={pwa.installing}>Download</Button>
        <button className="btn icon ghost" style={{ width: 32, minHeight: 32 }} onClick={pwa.dismiss} aria-label="Dismiss install prompt">
          <X width="16" height="16" />
        </button>
      </div>
    </div>
  );
}

export default function Pwa() {
  return <PwaGuestBanner />;
}

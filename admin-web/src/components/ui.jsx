'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, X } from './icons';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant, size, block, loading, children, className, disabled, ...p }) {
  return (
    <button className={cx('btn', variant, size, block && 'block', className)} disabled={disabled || loading} {...p}>
      {loading ? <span className="spinner" role="status" aria-label="Loading" /> : children}
    </button>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="err-text" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ label, error, hint, id, className, ...p }) {
  const rid = id || `f_${(label || p.name || 'x').toString().replace(/\W/g, '')}`;
  return (
    <Field label={label} error={error} hint={hint} id={rid}>
      <input id={rid} className={cx('input', error && 'err', className)} aria-invalid={!!error} {...p} />
    </Field>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={!!checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Skeleton = ({ h = 20, w = '100%', r }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;

export function Stars({ value = 0, size = 16 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={value >= n - 0.25} style={{ width: size, height: size, opacity: value >= n - 0.25 ? 1 : 0.28 }} />
      ))}
    </span>
  );
}

export function Empty({ icon, title, children, action }) {
  return (
    <div className="empty">
      {icon && <div className="ico">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

function useExit(open, ms = 200) {
  const [mounted, setMounted] = useState(open);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setOut(false);
      return;
    }
    if (!mounted) return;
    setOut(true);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, mounted, ms]);
  return { mounted, out };
}

function Layer({ open, onClose, sheet, title, children, label }) {
  const { mounted, out } = useExit(open);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div className={cx('overlay', sheet && 'sheet-overlay', out && 'out')} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      {sheet ? (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={label || title} ref={ref}>
          <div className="sheet-grab" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="btn icon secondary" onClick={onClose} aria-label="Close"><X width="18" height="18" /></button>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      ) : (
        <div className="modal" role="dialog" aria-modal="true" aria-label={label || title} ref={ref}>{children}</div>
      )}
    </div>,
    document.body
  );
}

export const Modal = (p) => <Layer {...p} />;
export const Sheet = (p) => <Layer {...p} sheet />;

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  const api = useRef({ show: (m) => push(m), error: (m) => push(m, 'err') });
  api.current.show = (m) => push(m);
  api.current.error = (m) => push(m, 'err');
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.kind === 'err' && 'err')}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function WakingBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const h = (e) => setOn(!!e.detail);
    window.addEventListener('qline:waking', h);
    return () => window.removeEventListener('qline:waking', h);
  }, []);
  if (!on) return null;
  return (
    <div className="banner" role="status">
      <span className="spinner" /> Waking up the server, one moment…
    </div>
  );
}

export function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const f = () => setS(window.scrollY > 4);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return s;
}


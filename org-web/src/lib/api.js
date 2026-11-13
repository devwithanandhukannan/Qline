'use client';
// Thin fetch wrapper. Cookies are httpOnly and set by the API, so there are no tokens in JS.
// - refreshes the session once on 401
// - retries while a free-tier server is waking up (502/503/504 or network errors)

const APP = 'owner';

export class ApiError extends Error {
  constructor(status, body = {}) {
    super(body.message || 'Something went wrong');
    this.status = status;
    this.code = body.error || 'error';
    this.fields = body.fields || {};
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (name, detail) => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent(name, { detail }));

async function once(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Qline-App': APP },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { res, json };
}

let refreshing = null;
function refreshSession() {
  refreshing ||= once('/auth/refresh', { method: 'POST', body: {} })
    .then(({ res }) => res.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export async function api(path, opts = {}) {
  let attempt = 0;
  for (;;) {
    let out;
    try {
      out = await once(path, opts);
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      out = { res: { status: 0, ok: false }, json: null };
    }
    const { res, json } = out;
    if ([0, 502, 503, 504].includes(res.status) && attempt < 4) {
      attempt += 1;
      emit('qline:waking', true);
      await sleep(2500 * attempt);
      continue;
    }
    if (attempt > 0) emit('qline:waking', false);
    const canRefresh = !path.startsWith('/auth/') || path === '/auth/me';
    if (res.status === 401 && canRefresh && !opts._retried) {
      if (await refreshSession()) return api(path, { ...opts, _retried: true });
      if (!path.startsWith('/auth/')) emit('qline:signed-out');
    }
    if (!res.ok) throw new ApiError(res.status, json || {});
    return json;
  }
}

export const wakeServer = () => fetch('/api/health', { headers: { 'X-Qline-App': APP }, cache: 'no-store' }).catch(() => {});

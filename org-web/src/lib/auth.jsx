'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, wakeServer } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    wakeServer();
    api('/auth/me')
      .then((r) => alive && setUser(r.user))
      .catch(() => {})
      .finally(() => alive && setReady(true));
    const out = () => setUser(null);
    window.addEventListener('qline:signed-out', out);
    return () => {
      alive = false;
      window.removeEventListener('qline:signed-out', out);
    };
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, setUser, ready, logout }}>{children}</Ctx.Provider>;
}

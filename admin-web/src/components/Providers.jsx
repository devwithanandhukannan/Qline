'use client';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider, WakingBanner } from './ui';
import Pwa, { PwaProvider } from './Pwa';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PwaProvider>
          {children}
          <WakingBanner />
          <Pwa />
        </PwaProvider>
      </AuthProvider>
    </ToastProvider>
  );
}


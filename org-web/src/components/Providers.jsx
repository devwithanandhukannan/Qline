'use client';
import { AuthProvider } from '@/lib/auth';
import { ConfirmProvider, ToastProvider, WakingBanner } from './ui';
import Pwa, { PwaProvider } from './Pwa';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <PwaProvider>
            {children}
            <WakingBanner />
            <Pwa />
          </PwaProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { TweaksProvider } from '@/lib/tweaks-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TweaksProvider>
        <AuthProvider>{children}</AuthProvider>
      </TweaksProvider>
    </ThemeProvider>
  );
}

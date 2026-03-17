'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { setupApi } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (isLoading) return;

      if (!user) {
        // Check if setup is needed
        try {
          const { isSetup } = await setupApi.getStatus();
          if (!isSetup) {
            router.replace('/setup');
          } else {
            router.replace('/login');
          }
        } catch {
          router.replace('/login');
        }
        return;
      }

      setChecking(false);
    };

    check();
  }, [user, isLoading, router]);

  if (isLoading || checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { projectsApi } from '@/lib/api';

export function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoading || !user || !token || !projectId) return;

    if (user.role === 'SUPER_ADMIN') {
      setAllowed(true);
      return;
    }

    projectsApi.getOne(projectId, token).then((project) => {
      const myRole = project.members?.find((m) => m.user.id === user.id)?.role;
      if (myRole === 'CLIENT') {
        router.replace(`/dashboard/projects/${projectId}`);
      } else {
        setAllowed(true);
      }
    }).catch(() => {
      router.replace('/dashboard');
    });
  }, [isLoading, user, token, projectId, router]);

  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

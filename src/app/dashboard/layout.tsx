'use client';

import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Shield, LogOut, Users, FolderOpen } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '';

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">HTGether</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Button
            variant="secondary"
            className="w-full justify-start"
            size="sm"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Projets
          </Button>

          {user?.role === 'SUPER_ADMIN' && (
            <>
              <div className="px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Administration
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
              >
                <Users className="mr-2 h-4 w-4" />
                Utilisateurs
              </Button>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Utilisateur'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLogout}
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}

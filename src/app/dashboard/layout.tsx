'use client';

import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Shield,
  LogOut,
  Users,
  FolderOpen,
  Settings,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navigate = (path: string) => {
    router.push(path);
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '';

  const navItems = (
    <>
      <Button
        variant={pathname === '/dashboard' ? 'secondary' : 'ghost'}
        className="w-full justify-start"
        size="sm"
        onClick={() => navigate('/dashboard')}
      >
        <LayoutDashboard className="mr-2 h-4 w-4" />
        Dashboard
      </Button>

      <Button
        variant={pathname?.startsWith('/dashboard/projects') ? 'secondary' : 'ghost'}
        className="w-full justify-start"
        size="sm"
        onClick={() => navigate('/dashboard/projects')}
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        Projets
      </Button>

      <Button
        variant={pathname === '/dashboard/settings' ? 'secondary' : 'ghost'}
        className="w-full justify-start"
        size="sm"
        onClick={() => navigate('/dashboard/settings')}
      >
        <Settings className="mr-2 h-4 w-4" />
        Paramètres
      </Button>

      {user?.role === 'SUPER_ADMIN' && (
        <>
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Administration
            </p>
          </div>
          <Button
            variant={pathname === '/dashboard/users' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            size="sm"
            onClick={() => navigate('/dashboard/users')}
          >
            <Users className="mr-2 h-4 w-4" />
            Utilisateurs
          </Button>
        </>
      )}
    </>
  );

  const userSection = (
    <div className="border-t p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
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
          className="h-8 w-8 shrink-0"
          onClick={handleLogout}
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">HTGether</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems}
        </nav>

        {userSection}
      </aside>

      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + close */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">HTGether</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems}
        </nav>

        {userSection}
      </aside>

      {/* ── Main Area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">HTGether</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

'use client';

import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/shell/sidebar';
import { CommandPalette } from '@/components/shell/command-palette';
import { ShellProvider, useShell } from '@/components/shell/shell-context';
import { SocketProvider } from '@/lib/socket-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SocketProvider>
        <ShellProvider>
          <Shell>{children}</Shell>
        </ShellProvider>
      </SocketProvider>
    </AuthGuard>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { paletteOpen, openPalette, closePalette, activeProject } = useShell();
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar onOpenPalette={openPalette} activeProject={activeProject || undefined} />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--bg)',
        }}
      >
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}

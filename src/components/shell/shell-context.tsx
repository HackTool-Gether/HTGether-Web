'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface ShellContextValue {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  /** Active project to expand sidebar sub-nav. Set by project pages on mount. */
  activeProject: { id: string; slug: string; findingsCount?: number; scopesCount?: number } | null;
  setActiveProject: (p: ShellContextValue['activeProject']) => void;
}

const ShellContext = createContext<ShellContextValue | undefined>(undefined);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<ShellContextValue['activeProject']>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);

  // Global Cmd+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ShellContext.Provider
      value={{ paletteOpen, openPalette, closePalette, togglePalette, activeProject, setActiveProject }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}

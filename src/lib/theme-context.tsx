'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  isWhiteMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleWhiteMode: (enabled: boolean) => void;
};

const STORAGE_KEY = 'htg-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      const resolvedTheme: Theme = savedTheme === 'light' ? 'light' : 'dark';
      setThemeState(resolvedTheme);
      applyThemeToDocument(resolvedTheme);
    } catch {
      setThemeState('dark');
      applyThemeToDocument('dark');
    }
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyThemeToDocument(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, []);

  const toggleWhiteMode = useCallback((enabled: boolean) => {
    setTheme(enabled ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    isWhiteMode: theme === 'light',
    setTheme,
    toggleWhiteMode,
  }), [theme, setTheme, toggleWhiteMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemeProvider');
  }
  return context;
}

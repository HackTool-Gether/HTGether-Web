'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemePreference = 'system' | 'dark' | 'light';
type ResolvedTheme = 'dark' | 'light';

type ThemeContextValue = {
  preference: ThemePreference;
  theme: ResolvedTheme;
  isWhiteMode: boolean;
  setPreference: (pref: ThemePreference) => void;
  toggleWhiteMode: (enabled: boolean) => void;
};

const STORAGE_KEY = 'htg-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return getSystemTheme();
  return pref;
}

function applyThemeToDocument(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.setAttribute('data-theme', theme);
}

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readPreference()));

  useEffect(() => {
    const pref = readPreference();
    setPreferenceState(pref);
    const theme = resolveTheme(pref);
    setResolved(theme);
    applyThemeToDocument(theme);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const theme = getSystemTheme();
      setResolved(theme);
      applyThemeToDocument(theme);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    const theme = resolveTheme(pref);
    setResolved(theme);
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {}
  }, []);

  const toggleWhiteMode = useCallback((enabled: boolean) => {
    setPreference(enabled ? 'light' : 'dark');
  }, [setPreference]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    theme: resolved,
    isWhiteMode: resolved === 'light',
    setPreference,
    toggleWhiteMode,
  }), [preference, resolved, setPreference, toggleWhiteMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemeProvider');
  }
  return context;
}

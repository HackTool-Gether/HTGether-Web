'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Accent = 'amber' | 'cyan' | 'indigo';
export type Signature = 'rulers' | 'ticks' | 'mono' | 'rails' | 'none';

interface TweaksState {
  accent: Accent;
  signature: Signature;
}

interface TweaksContextValue extends TweaksState {
  setAccent: (a: Accent) => void;
  setSignature: (s: Signature) => void;
}

const DEFAULTS: TweaksState = {
  accent: 'amber',
  signature: 'rulers',
};

const TweaksContext = createContext<TweaksContextValue | undefined>(undefined);

export function TweaksProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TweaksState>(DEFAULTS);

  // Hydrate from localStorage on mount (the inline script in layout already
  // applied attributes pre-paint to avoid flash, this just syncs React state).
  useEffect(() => {
    try {
      const a = localStorage.getItem('htg-accent') as Accent | null;
      const s = localStorage.getItem('htg-signature') as Signature | null;
      setState({
        accent: a && ['amber', 'cyan', 'indigo'].includes(a) ? a : DEFAULTS.accent,
        signature: s && ['rulers', 'ticks', 'mono', 'rails', 'none'].includes(s) ? s : DEFAULTS.signature,
      });
    } catch {
      /* localStorage might be unavailable */
    }
  }, []);

  const setAccent = useCallback((accent: Accent) => {
    setState((prev) => ({ ...prev, accent }));
    document.documentElement.setAttribute('data-accent', accent);
    try { localStorage.setItem('htg-accent', accent); } catch {}
  }, []);

  const setSignature = useCallback((signature: Signature) => {
    setState((prev) => ({ ...prev, signature }));
    document.documentElement.setAttribute('data-signature', signature);
    try { localStorage.setItem('htg-signature', signature); } catch {}
  }, []);

  return (
    <TweaksContext.Provider value={{ ...state, setAccent, setSignature }}>
      {children}
    </TweaksContext.Provider>
  );
}

export function useTweaks(): TweaksContextValue {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error('useTweaks must be used within TweaksProvider');
  return ctx;
}

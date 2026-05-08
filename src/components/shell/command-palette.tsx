'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutGrid,
  Folder,
  ShieldAlert,
  Bug,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface PaletteItem {
  group: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items: PaletteItem[] = useMemo(
    () => [
      {
        group: 'Navigation',
        icon: LayoutGrid,
        label: 'Aller au tableau de bord',
        hint: 'G D',
        action: () => router.push('/dashboard'),
      },
      {
        group: 'Navigation',
        icon: Folder,
        label: 'Aller aux projets',
        hint: 'G P',
        action: () => router.push('/dashboard/projects'),
      },
      {
        group: 'Créer',
        icon: Plus,
        label: 'Nouveau projet…',
        hint: '⌘N',
        action: () => router.push('/dashboard/projects?new=1'),
      },
      {
        group: 'Actions',
        icon: Settings,
        label: 'Paramètres',
        hint: '⌘,',
        action: () => router.push('/dashboard/settings'),
      },
      {
        group: 'Actions',
        icon: Users,
        label: 'Utilisateurs',
        action: () => router.push('/dashboard/users'),
      },
    ],
    [router]
  );

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setIdx(0);
  }, [query]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[idx];
      if (item) {
        item.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Group filtered preserving global index for keyboard nav
  const grouped: Record<string, Array<PaletteItem & { absIdx: number }>> = {};
  filtered.forEach((it, i) => {
    grouped[it.group] = grouped[it.group] || [];
    grouped[it.group].push({ ...it, absIdx: i });
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'oklch(0.10 0.005 250 / 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 120,
        animation: 'htgFadeIn var(--dur-fast) var(--ease-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sig-card"
        style={{
          width: 580,
          maxHeight: 460,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'htgScaleIn var(--dur-base) var(--ease-out)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Search size={16} style={{ color: 'var(--fg-subtle)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Chercher des actions, des projets…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 0,
              fontSize: 14,
              color: 'var(--fg)',
              fontFamily: 'inherit',
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        <div style={{ overflow: 'auto', padding: '6px 6px 10px' }}>
          {Object.entries(grouped).map(([group, its]) => (
            <div key={group}>
              <div className="cap" style={{ padding: '10px 14px 4px', fontSize: 10.5 }}>
                {group}
              </div>
              {its.map((it) => {
                const active = it.absIdx === idx;
                const ItIcon = it.icon;
                return (
                  <button
                    key={it.label}
                    type="button"
                    onMouseEnter={() => setIdx(it.absIdx)}
                    onClick={() => {
                      it.action();
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      background: active ? 'var(--bg-subtle)' : 'transparent',
                      border: '1px solid',
                      borderColor: active ? 'var(--border-subtle)' : 'transparent',
                      borderRadius: 'var(--r-md)',
                      color: 'var(--fg)',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <ItIcon
                      size={15}
                      strokeWidth={1.75}
                      style={{ color: active ? 'var(--accent)' : 'var(--fg-muted)' }}
                    />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.hint && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                        {it.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--fg-subtle)',
                fontSize: 13,
              }}
            >
              Aucun résultat pour « {query} »
            </div>
          )}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: 'var(--fg-subtle)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> naviguer
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="kbd">↵</span> ouvrir
          </span>
          <span style={{ marginLeft: 'auto' }}>HTGether</span>
        </div>
      </div>
    </div>
  );
}

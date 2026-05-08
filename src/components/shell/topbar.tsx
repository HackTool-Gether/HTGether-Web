'use client';

import { ChevronRight } from 'lucide-react';
import { AvatarStack, type PresenceUser } from './avatar';
import type { ReactNode } from 'react';

export interface Crumb {
  label: string;
  mono?: boolean;
  href?: string;
}

interface TopbarProps {
  crumbs?: Crumb[];
  presence?: PresenceUser[];
  actions?: ReactNode;
}

export function Topbar({ crumbs = [], presence = [], actions }: TopbarProps) {
  return (
    <header
      style={{
        height: 48,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && (
              <ChevronRight size={13} style={{ color: 'var(--fg-subtle)' }} />
            )}
            <span
              style={{
                fontSize: 13,
                color: i === crumbs.length - 1 ? 'var(--fg)' : 'var(--fg-muted)',
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
                fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
              }}
            >
              {c.label}
            </span>
          </span>
        ))}
      </div>

      {presence.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 4 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 'var(--r-full)',
                background: 'oklch(0.75 0.13 155)',
                boxShadow: '0 0 6px oklch(0.75 0.13 155 / 0.6)',
              }}
            />
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
              live
            </span>
          </div>
          <AvatarStack users={presence} max={3} />
        </div>
      )}

      {actions}
    </header>
  );
}

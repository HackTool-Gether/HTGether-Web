'use client';

import { useMemo } from 'react';
import { generateAvatarSvg } from '@/lib/dicebear';

const PRESENCE_COLORS = [
  'var(--pr-1)',
  'var(--pr-2)',
  'var(--pr-3)',
  'var(--pr-4)',
  'var(--pr-5)',
];

export interface PresenceUser {
  id: string;
  name: string;
  initials?: string;
  color?: string;
  avatarStyle?: string;
  avatarSeed?: string;
  avatarOptions?: Record<string, any>;
}

function colorFor(user: PresenceUser): string {
  if (user.color) return user.color;
  let h = 0;
  for (let i = 0; i < user.id.length; i++) h = (h * 31 + user.id.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  user: PresenceUser;
  size?: 'sm' | 'lg';
  title?: string;
}

export function Avatar({ user, size = 'sm', title }: AvatarProps) {
  const svg = useMemo(() => {
    if (!user.avatarStyle || !user.avatarSeed) return null;
    return generateAvatarSvg(user.avatarStyle, user.avatarSeed, user.avatarOptions || {});
  }, [user.avatarStyle, user.avatarSeed, user.avatarOptions]);

  if (svg) {
    return (
      <span
        className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`}
        title={title || user.name}
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-elevated)' }}
      />
    );
  }

  return (
    <span
      className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`}
      style={{ background: colorFor(user) }}
      title={title || user.name}
    >
      {user.initials || initialsFrom(user.name)}
    </span>
  );
}

interface AvatarStackProps {
  users: PresenceUser[];
  max?: number;
  size?: 'sm' | 'lg';
}

export function AvatarStack({ users, max = 3, size = 'sm' }: AvatarStackProps) {
  const shown = users.slice(0, max);
  const rest = users.length - max;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((u, i) => (
        <div
          key={u.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            position: 'relative',
            zIndex: shown.length - i,
            boxShadow: '0 0 0 2px var(--bg-elevated)',
            borderRadius: size === 'lg' ? 'var(--r-md)' : 'var(--r-sm)',
          }}
        >
          <Avatar user={u} size={size} />
        </div>
      ))}
      {rest > 0 && (
        <span
          className="mono"
          style={{ marginLeft: 4, fontSize: 11, color: 'var(--fg-muted)' }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

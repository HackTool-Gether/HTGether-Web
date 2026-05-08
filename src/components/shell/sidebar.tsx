'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Folder,
  Users,
  Settings,
  Search,
  ShieldAlert,
  MoreHorizontal,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from './avatar';

interface SidebarItemProps {
  icon?: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  badge?: string | number;
  indent?: number;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, href, active, badge, indent = 0, onClick }: SidebarItemProps) {
  const router = useRouter();
  const handleClick = () => {
    if (onClick) onClick();
    else if (href) router.push(href);
  };
  return (
    <button
      onClick={handleClick}
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: `7px 10px 7px ${10 + indent * 12}px`,
        background: active ? 'var(--bg-subtle)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--border-subtle)' : 'transparent',
        borderRadius: 'var(--r-md)',
        color: active ? 'var(--fg)' : 'var(--fg-muted)',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {Icon && <Icon size={15} strokeWidth={1.75} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {badge !== undefined && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{badge}</span>
      )}
    </button>
  );
}

interface SidebarProps {
  onOpenPalette: () => void;
  /** Optional active project to expand sub-nav */
  activeProject?: { id: string; slug: string; findingsCount?: number; scopesCount?: number };
}

export function Sidebar({ onOpenPalette, activeProject }: SidebarProps) {
  const pathname = usePathname() || '';
  const { user, logout } = useAuth();

  const inProject =
    !!activeProject &&
    pathname.startsWith(`/dashboard/projects/${activeProject.id}`);

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--bg)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--r-md)',
            background:
              'linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.15) c h))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-fg)',
            fontWeight: 700,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-0.03em',
          }}
        >
          HT
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>HTGether</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>
            {user?.email?.split('@')[1] || 'workspace'}
          </span>
        </div>
      </div>

      {/* Search trigger */}
      <div style={{ padding: '6px 10px 10px' }}>
        <button
          type="button"
          onClick={onOpenPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--fg-subtle)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'border-color var(--dur-fast) var(--ease-out)',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)')}
        >
          <Search size={13} />
          <span style={{ flex: 1, textAlign: 'left' }}>Rechercher…</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <div style={{ padding: '0 10px', flex: 1, overflow: 'auto' }}>
        <div className="cap" style={{ padding: '8px 10px 6px', fontSize: 10.5 }}>Espace</div>
        <SidebarItem
          icon={LayoutGrid}
          label="Tableau de bord"
          href="/dashboard"
          active={pathname === '/dashboard'}
        />
        <SidebarItem
          icon={Folder}
          label="Projets"
          href="/dashboard/projects"
          active={pathname.startsWith('/dashboard/projects')}
        />

        {inProject && activeProject && (
          <>
            <div className="cap" style={{ padding: '16px 10px 6px', fontSize: 10.5 }}>
              Projet actif
            </div>
            <SidebarItem
              icon={ShieldAlert}
              label={activeProject.slug}
              href={`/dashboard/projects/${activeProject.id}`}
              active={pathname === `/dashboard/projects/${activeProject.id}`}
            />
            <SidebarItem
              label="Overview"
              indent={1}
              href={`/dashboard/projects/${activeProject.id}`}
              active={pathname === `/dashboard/projects/${activeProject.id}`}
            />
            <SidebarItem
              label="Findings"
              indent={1}
              badge={activeProject.findingsCount}
              href={`/dashboard/projects/${activeProject.id}/findings`}
              active={pathname.startsWith(`/dashboard/projects/${activeProject.id}/findings`)}
            />
            <SidebarItem
              icon={FileText}
              label="Rapport"
              indent={1}
              href={`/dashboard/projects/${activeProject.id}/report`}
              active={pathname.startsWith(`/dashboard/projects/${activeProject.id}/report`)}
            />
          </>
        )}

        {user?.role === 'SUPER_ADMIN' && (
          <>
            <div className="cap" style={{ padding: '16px 10px 6px', fontSize: 10.5 }}>Admin</div>
            <SidebarItem
              icon={Users}
              label="Utilisateurs"
              href="/dashboard/users"
              active={pathname === '/dashboard/users'}
            />
            <SidebarItem
              icon={Settings}
              label="Paramètres"
              href="/dashboard/settings"
              active={pathname === '/dashboard/settings'}
            />
          </>
        )}
      </div>

      {/* User footer */}
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {user && (
          <Avatar
            user={{
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
            }}
          />
        )}
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>
            {user ? `${user.firstName} ${user.lastName}` : '—'}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--fg-subtle)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Déconnexion"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--fg-subtle)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </aside>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Folder,
  Users,
  Settings,
  Search,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, scopesApi, type Project, type Scope } from '@/lib/api';
import { Avatar } from './avatar';
import { HtgLogo } from '@/components/ui/htg-logo';

interface SidebarItemProps {
  icon?: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, href, active, badge, onClick }: SidebarItemProps) {
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
        padding: '7px 10px',
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  IN_PROGRESS: 'En cours',
  IN_REVIEW: 'Revue',
};

interface ProjectNavItemProps {
  label: string;
  href: string;
  active: boolean;
}

function ProjectNavItem({ label, href, active }: ProjectNavItemProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '6px 10px 6px 38px',
        background: active ? 'var(--bg-subtle)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--border-subtle)' : 'transparent',
        borderRadius: 'var(--r-md)',
        color: active ? 'var(--fg)' : 'var(--fg-muted)',
        fontSize: 12.5,
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
      {label}
    </button>
  );
}

interface ProjectTreeItemProps {
  project: Project;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  token: string | null;
}

function ProjectTreeItem({ project, expanded, onToggle, pathname, token }: ProjectTreeItemProps) {
  const router = useRouter();
  const base = `/dashboard/projects/${project.id}`;
  const isInThisProject = pathname.startsWith(base);
  const [scopes, setScopes] = useState<Scope[]>([]);

  useEffect(() => {
    if (!expanded || !token) { setScopes([]); return; }
    let cancelled = false;
    scopesApi.getAll(project.id, token).then((data) => {
      if (!cancelled) setScopes(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [expanded, token, project.id]);

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Project row */}
      <button
        type="button"
        onClick={() => {
          onToggle();
          router.push(base);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '7px 10px',
          background: isInThisProject ? 'var(--bg-subtle)' : 'transparent',
          border: '1px solid',
          borderColor: isInThisProject ? 'var(--border-subtle)' : 'transparent',
          borderRadius: 'var(--r-md)',
          textAlign: 'left',
          cursor: 'pointer',
          transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          if (!isInThisProject) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
        }}
        onMouseLeave={(e) => {
          if (!isInThisProject) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--r-sm)',
            background: isInThisProject
              ? 'linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.1) c h))'
              : 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: isInThisProject ? 'white' : 'var(--fg-muted)',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--fg)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
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
            {project.clientCompany}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              padding: '2px 5px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-input)',
              color: 'var(--fg-subtle)',
            }}
          >
            {STATUS_LABELS[project.status] || project.status}
          </span>
          <ChevronRight
            size={12}
            style={{
              color: 'var(--fg-subtle)',
              transition: 'transform var(--dur-fast) var(--ease-out)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Sub-navigation */}
      {expanded && (
        <div style={{ padding: '4px 0 2px' }}>
          <ProjectNavItem
            label="Vue d'ensemble"
            href={base}
            active={pathname === base}
          />
          <ProjectNavItem
            label="Findings"
            href={`${base}/findings`}
            active={pathname.startsWith(`${base}/findings`)}
          />
          <ProjectNavItem
            label="Tâches"
            href={`${base}/tasks`}
            active={pathname.startsWith(`${base}/tasks`)}
          />
          <ProjectNavItem
            label="Rapport"
            href={`${base}/report`}
            active={pathname.startsWith(`${base}/report`)}
          />
          <ProjectNavItem
            label="Membres"
            href={`${base}/members`}
            active={pathname.startsWith(`${base}/members`)}
          />
          {scopes.length > 0 && (
            <>
              <div
                className="cap"
                style={{ padding: '8px 10px 4px 38px', fontSize: 10, color: 'var(--fg-subtle)' }}
              >
                Périmètres
              </div>
              {scopes.map((s) => (
                <ProjectNavItem
                  key={s.id}
                  label={s.name}
                  href={`${base}/scopes/${s.id}`}
                  active={pathname.startsWith(`${base}/scopes/${s.id}`)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  onOpenPalette: () => void;
  activeProject?: { id: string; slug: string; findingsCount?: number; scopesCount?: number };
}

export function Sidebar({ onOpenPalette }: SidebarProps) {
  const pathname = usePathname() || '';
  const { user, token, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      const data = await projectsApi.getAll(token);
      setProjects(data);
    } catch {
      // silently fail
    }
  }, [token]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Auto-expand the project whose page we're on
  useEffect(() => {
    const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
    if (match) {
      const id = match[1];
      setExpanded((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: true };
      });
    }
  }, [pathname]);

  const toggleProject = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeProjects = projects.filter(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'IN_REVIEW' || p.status === 'DRAFT'
  );

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
          }}
        >
          <HtgLogo size={18} />
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
          active={pathname === '/dashboard/projects'}
        />

        {activeProjects.length > 0 && (
          <>
            <div className="cap" style={{ padding: '16px 10px 6px', fontSize: 10.5 }}>
              Projets actifs
            </div>
            {activeProjects.map((p) => (
              <ProjectTreeItem
                key={p.id}
                project={p}
                expanded={!!expanded[p.id]}
                onToggle={() => toggleProject(p.id)}
                pathname={pathname}
                token={token}
              />
            ))}
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
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

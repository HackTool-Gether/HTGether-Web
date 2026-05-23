'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarStack } from '@/components/shell/avatar';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, dashboardApi, type Project, type DashboardStats } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Folder,
  Bug,
  ListChecks,
  Users,
  Plus,
  ArrowRight,
  Activity,
  Command,
  FileText,
  Loader2,
  CheckCircle2,
  LayoutGrid,
  Clock,
} from 'lucide-react';

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'oklch(0.65 0.2 25)',
  HIGH: 'oklch(0.7 0.15 40)',
  MEDIUM: 'oklch(0.65 0.15 80)',
  LOW: 'oklch(0.6 0.12 250)',
  INFO: 'oklch(0.5 0.05 250)',
};

function StatusPhase(status: Project['status']): string {
  const map: Record<Project['status'], string> = {
    DRAFT: 'Cadrage',
    IN_PROGRESS: 'Exécution',
    IN_REVIEW: 'Revue',
    DELIVERED: 'Livré',
    ARCHIVED: 'Archivé',
  };
  return map[status] || status;
}

function progressFor(p: Project): number {
  const map: Record<Project['status'], number> = {
    DRAFT: 8,
    IN_PROGRESS: 50,
    IN_REVIEW: 80,
    DELIVERED: 100,
    ARCHIVED: 100,
  };
  return map[p.status] ?? 0;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [p, s] = await Promise.all([
        projectsApi.getAll(token),
        dashboardApi.getStats(token),
      ]);
      setProjects(p);
      setStats(s);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isEmpty = !loading && projects && projects.length === 0;

  return (
    <div className="flex-1 overflow-auto">
      {isEmpty ? (
        <DashboardEmpty firstName={user?.firstName} />
      ) : (
        <DashboardActive
          firstName={user?.firstName}
          today={today}
          projects={projects || []}
          stats={stats}
          loading={loading}
          isAdmin={user?.role === 'SUPER_ADMIN'}
          onOpen={(id) => router.push(`/dashboard/projects/${id}`)}
          onNew={() => router.push('/dashboard/projects?new=1')}
          onAllProjects={() => router.push('/dashboard/projects')}
        />
      )}
    </div>
  );
}

function DashboardEmpty({ firstName }: { firstName?: string }) {
  const router = useRouter();
  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 ">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Bonjour {firstName || ''}.
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
          Votre espace de travail est prêt. Commencez par créer votre premier projet de
          pentest — tout le reste (findings, rapport, chaînes d&apos;attaque) en découlera.
        </p>
      </div>

      <div className="rounded-xl bg-card mb-6">
        {[
          {
            n: '01',
            title: 'Créez un projet',
            desc: 'Définissez le client, les dates et la nature de l\'audit.',
            cta: 'Créer un projet',
            primary: true,
            action: () => router.push('/dashboard/projects?new=1'),
          },
          {
            n: '02',
            title: 'Déclarez un périmètre',
            desc: 'IPs, domaines, applications. Vous pourrez en ajouter plus tard.',
            cta: 'En savoir plus',
            primary: false,
            action: () => router.push('/dashboard/projects'),
          },
          {
            n: '03',
            title: 'Prenez vos premières notes',
            desc: 'Tapez « / » pour insérer des blocs : finding, composant, variable…',
            cta: 'Voir l\'éditeur',
            primary: false,
            action: () => router.push('/dashboard/projects'),
          },
        ].map((s, i) => (
          <div
            key={s.n}
            className={`flex items-center gap-4 px-4 py-4 ${
              i > 0 ? 'border-t border-transparent' : ''
            }`}
            style={i > 0 ? { borderColor: 'var(--bg)' } : undefined}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary font-mono">
              {s.n}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
            <Button
              variant={s.primary ? 'default' : 'ghost'}
              size="sm"
              onClick={s.action}
            >
              {s.cta}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Raccourcis essentiels',
            d: '⌘K palette · / blocs · ⌘⏎ promouvoir en finding',
            i: Command,
          },
          {
            t: 'Modèles de rapport',
            d: 'Partez d\'un template OWASP, EBIOS-RM ou vide.',
            i: FileText,
          },
        ].map((c) => {
          const Icon = c.i;
          return (
            <div key={c.t} className="rounded-xl bg-card p-4">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{c.t}</span>
              </div>
              <p className="text-xs text-muted-foreground">{c.d}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DashboardActiveProps {
  firstName?: string;
  today: string;
  projects: Project[];
  stats: DashboardStats | null;
  loading: boolean;
  isAdmin?: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onAllProjects: () => void;
}

function DashboardActive({
  firstName,
  today,
  projects,
  stats,
  loading,
  isAdmin,
  onOpen,
  onNew,
  onAllProjects,
}: DashboardActiveProps) {
  const router = useRouter();
  const recent = projects.slice(0, 3);

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            {today}
          </p>
          <h1 className="text-2xl font-bold mt-1">
            Bonjour {firstName || ''}.
          </h1>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus className="mr-1 h-3 w-3" /> Nouveau projet
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label={isAdmin ? 'Projets actifs' : 'Mes projets'}
          value={stats ? String(isAdmin ? stats.projects.active : stats.projects.total) : '—'}
          hint={stats ? (isAdmin ? `${stats.projects.total} au total` : `${stats.projects.active} en cours`) : ''}
          icon={<Folder className="h-3.5 w-3.5" />}
        />
        <StatCard
          label={isAdmin ? 'Findings ouvertes' : 'Findings'}
          value={stats ? String(stats.findings.open) : '—'}
          hint={stats ? (
            isAdmin
              ? `${stats.findings.bySeverity.CRITICAL || 0} critiques`
              : `${stats.findings.mine ?? 0} par moi · ${stats.findings.bySeverity.CRITICAL || 0} critiques`
          ) : ''}
          icon={<Bug className="h-3.5 w-3.5" />}
          hintColor={stats && stats.findings.bySeverity.CRITICAL > 0 ? SEV_COLORS.CRITICAL : undefined}
        />
        <StatCard
          label={isAdmin ? 'Tâches' : 'Mes tâches'}
          value={stats ? (
            isAdmin
              ? `${stats.tasks.done}/${stats.tasks.total}`
              : `${stats.myTasks?.done ?? 0}/${stats.myTasks?.total ?? 0}`
          ) : '—'}
          hint={stats ? (
            isAdmin
              ? `${stats.tasks.inProgress} en cours`
              : `${stats.myTasks?.inProgress ?? 0} en cours`
          ) : ''}
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        {isAdmin ? (
          <StatCard
            label="Utilisateurs actifs"
            value={stats ? String(stats.users.active) : '—'}
            hint="sur la plateforme"
            icon={<Users className="h-3.5 w-3.5" />}
          />
        ) : (
          <StatCard
            label="Équipe"
            value={stats ? String(stats.team ?? 0) : '—'}
            hint="collaborateurs"
            icon={<Users className="h-3.5 w-3.5" />}
          />
        )}
      </div>

      {/* Findings by severity bar */}
      {stats && stats.findings.open > 0 && (
        <div className="rounded-xl bg-card p-4 mb-6">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Findings ouvertes par sévérité
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-2">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => {
              const count = stats.findings.bySeverity[sev] || 0;
              if (!count) return null;
              const pct = (count / stats.findings.open) * 100;
              return (
                <div
                  key={sev}
                  style={{ width: `${pct}%`, background: SEV_COLORS[sev], minWidth: 4 }}
                  title={`${sev}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
              <div key={sev} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[sev] }} />
                <span className="text-muted-foreground">{sev.toLowerCase()}</span>
                <span className="font-mono font-semibold">{stats.findings.bySeverity[sev] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Recent projects */}
        <div className="rounded-xl bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">Projets récents</span>
            <Button variant="ghost" size="sm" onClick={onAllProjects}>
              Tout voir <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div>
            {loading && (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            )}
            {!loading && recent.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                Aucun projet pour l&apos;instant.
              </p>
            )}
            {recent.map((p) => {
              const progress = progressFor(p);
              const team = (p.members || []).map((m) => ({
                id: m.user.id,
                name: `${m.user.firstName} ${m.user.lastName}`,
              }));
              return (
                <div
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  className="grid grid-cols-[1fr_100px_auto_auto] gap-3.5 items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {p.clientCompany} · {StatusPhase(p.status)}
                    </p>
                  </div>
                  <div className="w-[100px]">
                    <div className="h-[3px] bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                      {progress}%
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground text-right min-w-[60px] font-mono">
                    {p._count?.scopes ?? 0}{' '}
                    <span className="text-muted-foreground/60">scopes</span>
                  </p>
                  <AvatarStack users={team} max={3} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div className="flex flex-col gap-4">
          {/* Active tasks — non-admin only */}
          {!isAdmin && (
            <div className="rounded-xl bg-card">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">Mes tâches en cours</span>
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="px-4 pb-3">
                {!stats || !stats.activeTasks || stats.activeTasks.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                    <Activity className="h-3.5 w-3.5" />
                    Aucune tâche active.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {stats.activeTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 -mx-1.5 transition-colors"
                        onClick={() => router.push(`/dashboard/projects/${t.projectId}/tasks`)}
                      >
                        <TaskStatusDot status={t.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{t.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {t.projectName}
                            {t.dueDate && ` · ${new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                          </div>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Kanban shortcuts per project */}
              {stats?.activeTasks && stats.activeTasks.length > 0 && (() => {
                const projectMap = new Map<string, { id: string; name: string; count: number }>();
                for (const t of stats.activeTasks) {
                  const existing = projectMap.get(t.projectId);
                  if (existing) { existing.count++; } else {
                    projectMap.set(t.projectId, { id: t.projectId, name: t.projectName, count: 1 });
                  }
                }
                return (
                  <div className="border-t border-border px-4 py-2.5 flex flex-wrap gap-2">
                    {[...projectMap.values()].map((p) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => router.push(`/dashboard/projects/${p.id}/tasks`)}
                      >
                        <LayoutGrid className="h-3 w-3" />
                        {p.name}
                        <span className="text-muted-foreground font-mono">({p.count})</span>
                      </Button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Recent findings */}
          <div className="rounded-xl bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{isAdmin ? 'Derniers findings' : 'Mes derniers findings'}</span>
              <Bug className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="px-4 pb-3">
              {!stats || stats.recentFindings.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                  <Activity className="h-3.5 w-3.5" />
                  Aucun finding récent.
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentFindings.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 -mx-1.5 transition-colors"
                      onClick={() => router.push(`/dashboard/projects/${f.projectId}/findings`)}
                    >
                      <span
                        className="text-[8px] font-bold uppercase px-1 py-0.5 rounded mt-0.5 shrink-0"
                        style={{
                          background: `color-mix(in oklch, ${SEV_COLORS[f.severity] || 'gray'} 15%, transparent)`,
                          color: SEV_COLORS[f.severity] || 'gray',
                        }}
                      >
                        {f.severity.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{f.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {f.projectName} · {f.authorName} · {timeAgo(f.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent completed tasks */}
          <div className="rounded-xl bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{isAdmin ? 'Tâches complétées' : 'Mes tâches complétées'}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="px-4 pb-3">
              {!stats || stats.recentTasks.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                  <Activity className="h-3.5 w-3.5" />
                  Aucune tâche complétée récemment.
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 -mx-1.5 transition-colors"
                      onClick={() => router.push(`/dashboard/projects/${t.projectId}/tasks`)}
                    >
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color: 'oklch(0.60 0.15 145)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{t.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {t.projectName}
                          {t.assigneeName && ` · ${t.assigneeName}`}
                          {' · '}{timeAgo(t.completedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'oklch(0.55 0.02 250)',
  TODO: 'oklch(0.6 0.15 250)',
  IN_PROGRESS: 'oklch(0.65 0.18 55)',
};

const PRIORITY_LABELS: Record<string, { text: string; color: string }> = {
  CRITICAL: { text: 'C', color: SEV_COLORS.CRITICAL },
  HIGH: { text: 'H', color: SEV_COLORS.HIGH },
  MEDIUM: { text: 'M', color: SEV_COLORS.MEDIUM },
  LOW: { text: 'B', color: SEV_COLORS.LOW },
};

function TaskStatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'gray';
  const isInProgress = status === 'IN_PROGRESS';
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {isInProgress && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_LABELS[priority];
  if (!p) return null;
  return (
    <span
      className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
      style={{
        background: `color-mix(in oklch, ${p.color} 15%, transparent)`,
        color: p.color,
      }}
    >
      {p.text}
    </span>
  );
}

function StatCard({ label, value, hint, icon, hintColor }: {
  label: string; value: string; hint: string;
  icon: React.ReactNode; hintColor?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight font-mono">{value}</p>
      {hint && (
        <p className="text-xs mt-1" style={{ color: hintColor || 'var(--muted-foreground)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

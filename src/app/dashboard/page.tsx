'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarStack } from '@/components/shell/avatar';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, type Project } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Folder,
  Bug,
  Clock,
  FileText,
  Plus,
  ArrowRight,
  Activity,
  Network,
  Command,
  Loader2,
} from 'lucide-react';

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

export default function DashboardPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    projectsApi
      .getAll(token)
      .then((data) => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [token]);

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
          loading={loading}
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
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onAllProjects: () => void;
}

function DashboardActive({
  firstName,
  today,
  projects,
  loading,
  onOpen,
  onNew,
  onAllProjects,
}: DashboardActiveProps) {
  const active = projects.filter((p) => p.status === 'IN_PROGRESS').length;
  const inReview = projects.filter((p) => p.status === 'IN_REVIEW').length;
  const recent = projects.slice(0, 3);

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6">
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
        {[
          { label: 'Projets actifs', value: active, hint: `${inReview} en revue`, icon: Folder },
          { label: 'Findings ouvertes', value: '—', hint: 'à venir', icon: Bug },
          { label: 'Heures engagées', value: '—', hint: 'à venir', icon: Clock },
          { label: 'Rapports en cours', value: '—', hint: 'à venir', icon: FileText },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl bg-card p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              <p className="text-2xl font-semibold tracking-tight font-mono">
                {s.value}
              </p>
              {s.hint && (
                <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
              )}
            </div>
          );
        })}
      </div>

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

        {/* Activity */}
        <div className="rounded-xl bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">Activité récente</span>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Network className="h-3.5 w-3.5" />
              Le flux d&apos;activité collaboratif arrive bientôt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

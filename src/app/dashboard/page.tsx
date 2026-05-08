'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { AvatarStack } from '@/components/shell/avatar';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, type Project } from '@/lib/api';
import {
  Folder,
  Bug,
  Clock,
  FileText,
  Plus,
  Filter,
  ArrowRight,
  Activity,
  Command,
  Network,
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Folder;
}

function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div
      className="card-htg sig-card"
      style={{ padding: 16, flex: 1, minWidth: 0, position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={14} strokeWidth={1.75} style={{ color: 'var(--fg-subtle)' }} />
        <span className="cap" style={{ fontSize: 10.5 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {value}
        </span>
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

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
  // Placeholder: derive a rough progress % from status
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
    <>
      <Topbar crumbs={[{ label: 'Tableau de bord' }]} />
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
    </>
  );
}

function DashboardEmpty({ firstName }: { firstName?: string }) {
  const router = useRouter();
  return (
    <div
      className="sig-surface"
      style={{ padding: '40px 32px', minHeight: '100%', overflow: 'auto' }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-subtle)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            ~/ Bienvenue
          </div>
          <h1
            style={{
              fontSize: 'var(--text-display-size)',
              lineHeight: 'var(--text-display-lh)',
              fontWeight: 600,
              letterSpacing: 'var(--text-display-track)',
              margin: 0,
            }}
          >
            Bonjour {firstName || ''}.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--fg-muted)',
              marginTop: 8,
              maxWidth: 520,
              lineHeight: 1.55,
            }}
          >
            Votre espace de travail est prêt. Commencez par créer votre premier projet de
            pentest — tout le reste (findings, rapport, chaînes d&apos;attaque) en découlera.
          </p>
        </div>

        <div className="card-htg sig-card" style={{ padding: 4, marginBottom: 24 }}>
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
          ].map((s, i, arr) => (
            <div
              key={s.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 18px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div
                className="mono"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                }}
              >
                {s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{s.desc}</div>
              </div>
              <button
                type="button"
                onClick={s.action}
                className={`btn ${s.primary ? 'btn-primary' : ''}`}
              >
                {s.cta}
                <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            const I = c.i;
            return (
              <div key={c.t} className="card-htg" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <I size={15} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.t}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{c.d}</div>
              </div>
            );
          })}
        </div>
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
    <div
      className="sig-surface"
      style={{ padding: '28px 32px', minHeight: '100%', overflow: 'auto' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--fg-subtle)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {today}
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                margin: '6px 0 0',
              }}
            >
              Bonjour {firstName || ''}.
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn">
              <Filter size={13} /> Cette semaine
            </button>
            <button type="button" className="btn btn-primary" onClick={onNew}>
              <Plus size={13} /> Nouveau projet
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard
            label="Projets actifs"
            value={active}
            hint={`${inReview} en revue`}
            icon={Folder}
          />
          <StatCard label="Findings ouvertes" value="—" hint="à venir" icon={Bug} />
          <StatCard label="Heures engagées" value="—" hint="à venir" icon={Clock} />
          <StatCard label="Rapports en cours" value="—" hint="à venir" icon={FileText} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div className="card-htg" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Projets récents</span>
              <button
                type="button"
                onClick={onAllProjects}
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto' }}
              >
                Tout voir <ArrowRight size={12} />
              </button>
            </div>
            {loading && (
              <div style={{ padding: 24, color: 'var(--fg-muted)', fontSize: 13 }}>
                Chargement…
              </div>
            )}
            {!loading && recent.length === 0 && (
              <div style={{ padding: 24, color: 'var(--fg-muted)', fontSize: 13 }}>
                Aucun projet pour l&apos;instant.
              </div>
            )}
            {recent.map((p, i) => {
              const progress = progressFor(p);
              const team = (p.members || []).map((m) => ({
                id: m.user.id,
                name: `${m.user.firstName} ${m.user.lastName}`,
              }));
              return (
                <div
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  style={{
                    padding: '12px 14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px auto auto',
                    gap: 14,
                    alignItems: 'center',
                    borderBottom:
                      i < recent.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast) var(--ease-out)',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                  }
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--fg-subtle)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.clientCompany} · {StatusPhase(p.status)}
                    </div>
                  </div>
                  <div style={{ width: 100 }}>
                    <div
                      style={{
                        height: 3,
                        background: 'var(--bg-input)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 3 }}
                    >
                      {progress}%
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--fg-muted)',
                      minWidth: 60,
                      textAlign: 'right',
                    }}
                  >
                    {p._count?.scopes ?? 0}{' '}
                    <span style={{ color: 'var(--fg-subtle)' }}>scopes</span>
                  </div>
                  <AvatarStack users={team} max={3} />
                </div>
              );
            })}
          </div>

          <div className="card-htg" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Activité récente</span>
              <Activity
                size={13}
                style={{ color: 'var(--fg-subtle)', marginLeft: 'auto' }}
              />
            </div>
            <div style={{ padding: 14, fontSize: 12.5, color: 'var(--fg-muted)' }}>
              <Network size={14} style={{ marginRight: 6, color: 'var(--fg-subtle)' }} />
              Le flux d&apos;activité collaboratif arrive bientôt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

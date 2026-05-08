'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { Avatar, AvatarStack } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, scopesApi, ApiError, type ProjectDetail, type Scope, type ScopeStatus } from '@/lib/api';
import {
  Plus,
  X,
  Loader2,
  FileText,
  Bug,
  Target,
  Trash2,
  ArrowRight,
} from 'lucide-react';

const AUDIT_LABELS: Record<string, string> = {
  WEB: 'Web', INTERNAL_AD: 'Active Directory', LINUX: 'Linux', MOBILE: 'Mobile', OTHER: 'Autre',
};

const SCOPE_BADGE: Record<ScopeStatus, string> = {
  NOT_STARTED: 'untested',
  IN_PROGRESS: 'remark',
  COMPLETED: 'compliant',
  IN_REVIEW: 'remark',
};

const SCOPE_LABEL: Record<ScopeStatus, string> = {
  NOT_STARTED: 'à démarrer',
  IN_PROGRESS: 'en cours',
  COMPLETED: 'terminé',
  IN_REVIEW: 'en revue',
};

const STATUS_PHASE: Record<string, string> = {
  DRAFT: 'Cadrage',
  IN_PROGRESS: 'Exécution',
  IN_REVIEW: 'Revue',
  DELIVERED: 'Livré',
  ARCHIVED: 'Archivé',
};

function progressPercent(p: ProjectDetail): number {
  const start = new Date(p.startDate).getTime();
  const end = new Date(p.endDate).getTime();
  const now = Date.now();
  if (!start || !end || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

export default function ProjectDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddScope, setShowAddScope] = useState(false);
  const [scopeForm, setScopeForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await projectsApi.getOne(projectId, token);
      setProject(data);
    } catch {
      setError('Impossible de charger le projet');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  // Sync active project with sidebar
  useEffect(() => {
    if (project) {
      setActiveProject({
        id: project.id,
        slug: project.name,
        scopesCount: project.scopes?.length,
      });
    }
    return () => setActiveProject(null);
  }, [project, setActiveProject]);

  const handleAddScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      await scopesApi.create(projectId, scopeForm, token);
      setScopeForm({ name: '', description: '' });
      setShowAddScope(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteScope = async (scopeId: string) => {
    if (!token) return;
    if (!confirm('Supprimer ce scope ?')) return;
    try {
      await scopesApi.remove(projectId, scopeId, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Projets' }, { label: '…' }]} />
        <div style={{ padding: 40, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement…
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Projets' }, { label: 'Introuvable' }]} />
        <div style={{ padding: 40, color: 'var(--sev-critical-fg)' }}>Projet introuvable.</div>
      </>
    );
  }

  const team = (project.members || []).map((m) => ({
    id: m.user.id,
    name: `${m.user.firstName} ${m.user.lastName}`,
  }));
  const progress = progressPercent(project);

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Projets' },
          { label: project.name, mono: true },
        ]}
        presence={team.slice(0, 3)}
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => router.push(`/dashboard/projects/${projectId}/findings`)}
          >
            <Bug size={12} /> Findings
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} className="sig-surface">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
          {/* Hero */}
          <div style={{ marginBottom: 24 }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--fg-subtle)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {project.clientCompany} · {AUDIT_LABELS[project.auditType]}
            </div>
            <h1
              style={{
                fontSize: 'var(--text-h1-size)',
                lineHeight: 'var(--text-h1-lh)',
                fontWeight: 600,
                letterSpacing: 'var(--text-h1-track)',
                margin: 0,
              }}
            >
              {project.name}
            </h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12.5, color: 'var(--fg-muted)' }}>
              <span className="mono">
                {new Date(project.startDate).toLocaleDateString('fr-FR')} — {new Date(project.endDate).toLocaleDateString('fr-FR')}
              </span>
              <span style={{ textTransform: 'capitalize' }}>{STATUS_PHASE[project.status]}</span>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  height: 4,
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
                    transition: 'width 200ms ease-out',
                  }}
                />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--fg-subtle)',
                  marginTop: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>jour {Math.round((progress / 100) * Math.max(1, durationDays(project)))} / {durationDays(project)}</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                fontSize: 13,
                color: 'var(--sev-critical-fg)',
                background: 'var(--sev-critical-bg)',
                border: '1px solid var(--sev-critical-br)',
                borderRadius: 'var(--r-md)',
              }}
            >
              {error}
            </div>
          )}

          {/* Grid 12 cols */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Cadrage */}
              <div className="card-htg sig-card" style={{ padding: 16 }}>
                <div className="cap" style={{ marginBottom: 10 }}>Cadrage</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Block label="Besoin client" value={project.clientNeed} />
                  <Block label="Contexte" value={project.context} />
                </div>
              </div>

              {/* Scopes */}
              <div className="card-htg sig-card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Périmètres
                    <span className="mono" style={{ color: 'var(--fg-subtle)', marginLeft: 6, fontWeight: 400 }}>
                      {project.scopes?.length || 0}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setShowAddScope(true)}
                  >
                    <Plus size={12} /> Nouveau
                  </button>
                </div>

                {showAddScope && (
                  <form onSubmit={handleAddScope} style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <input
                        className="input"
                        placeholder="Nom (ex: Application Web)"
                        value={scopeForm.name}
                        onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })}
                        required
                      />
                      <input
                        className="input"
                        placeholder="Description (optionnelle)"
                        value={scopeForm.description}
                        onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="btn btn-sm" onClick={() => setShowAddScope(false)}>
                        <X size={12} /> Annuler
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                        {creating && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Ajouter
                      </button>
                    </div>
                  </form>
                )}

                {(!project.scopes || project.scopes.length === 0) ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                    <Target size={20} style={{ marginBottom: 8, color: 'var(--fg-subtle)' }} />
                    <div>Aucun périmètre. Ajoutez-en pour démarrer le test.</div>
                  </div>
                ) : (
                  project.scopes.map((scope: Scope, i, arr) => (
                    <div
                      key={scope.id}
                      onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scope.id}`)}
                      style={{
                        padding: '12px 16px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto auto',
                        gap: 14,
                        alignItems: 'center',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                      }
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{scope.name}</div>
                        {scope.description && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--fg-subtle)',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {scope.description}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          color: 'var(--fg-muted)',
                        }}
                      >
                        <FileText size={12} style={{ color: 'var(--fg-subtle)' }} />
                        {scope._count?.notes ?? 0}
                      </span>
                      <span className={`badge badge-${SCOPE_BADGE[scope.status]}`}>
                        {SCOPE_LABEL[scope.status]}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScope(scope.id);
                        }}
                        className="btn btn-ghost btn-sm"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Team */}
              <div className="card-htg sig-card" style={{ padding: 16 }}>
                <div className="cap" style={{ marginBottom: 10 }}>Équipe ({project.members?.length || 0})</div>
                {(!project.members || project.members.length === 0) ? (
                  <div style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>Aucun membre.</div>
                ) : (
                  project.members.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 0',
                        fontSize: 13,
                      }}
                    >
                      <Avatar
                        user={{
                          id: m.user.id,
                          name: `${m.user.firstName} ${m.user.lastName}`,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>
                          {m.user.firstName} {m.user.lastName}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                          {m.role.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick links */}
              <div className="card-htg sig-card" style={{ padding: 16 }}>
                <div className="cap" style={{ marginBottom: 10 }}>Vues</div>
                {[
                  { label: 'Findings', icon: Bug, href: `/dashboard/projects/${projectId}/findings` },
                  { label: 'Rapport', icon: FileText, href: `/dashboard/projects/${projectId}/report` },
                ].map((l) => {
                  const I = l.icon;
                  return (
                    <button
                      key={l.label}
                      type="button"
                      onClick={() => router.push(l.href)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: 'var(--r-md)',
                        color: 'var(--fg)',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                      }}
                    >
                      <I size={14} strokeWidth={1.75} style={{ color: 'var(--fg-muted)' }} />
                      <span style={{ flex: 1 }}>{l.label}</span>
                      <ArrowRight size={12} style={{ color: 'var(--fg-subtle)' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function durationDays(p: ProjectDetail): number {
  const start = new Date(p.startDate).getTime();
  const end = new Date(p.endDate).getTime();
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function Block({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="cap" style={{ marginBottom: 4, fontSize: 10.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.5 }}>
        {value || <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
      </div>
    </div>
  );
}

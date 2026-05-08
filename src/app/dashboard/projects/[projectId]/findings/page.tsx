'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  projectsApi,
  findingsApi,
  ApiError,
  type Finding,
  type Severity,
  type FindingStatus,
  type ProjectDetail,
} from '@/lib/api';
import { Plus, Filter, Loader2, X } from 'lucide-react';

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const STATUS_LABEL: Record<FindingStatus, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmé',
  FALSE_POSITIVE: 'Faux positif',
  FIXED: 'Corrigé',
};

const STATUS_DOT: Record<FindingStatus, string> = {
  DRAFT: 'oklch(0.62 0.01 250)',
  CONFIRMED: 'oklch(0.78 0.16 15)',
  FALSE_POSITIVE: 'oklch(0.62 0.01 250)',
  FIXED: 'oklch(0.75 0.13 155)',
};

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const days = Math.round(hr / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export default function FindingsListPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sev, setSev] = useState<'all' | Severity>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ title: string; severity: Severity }>({
    title: '',
    severity: 'MEDIUM',
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [proj, finds] = await Promise.all([
        projectsApi.getOne(projectId, token),
        findingsApi.getAllByProject(projectId, token),
      ]);
      setProject(proj);
      setFindings(finds);
      if (finds.length > 0 && !selected) setSelected(finds[0].id);
    } catch {
      setError('Impossible de charger les findings');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, selected]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (project) {
      setActiveProject({
        id: project.id,
        slug: project.name,
        findingsCount: findings.length,
      });
    }
    return () => setActiveProject(null);
  }, [project, findings.length, setActiveProject]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      const created = await findingsApi.create(
        projectId,
        { title: form.title, severity: form.severity },
        token
      );
      setFindings((prev) => [created, ...prev]);
      setSelected(created.id);
      setShowCreate(false);
      setForm({ title: '', severity: 'MEDIUM' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const filtered = sev === 'all' ? findings : findings.filter((f) => f.severity === sev);
  const cur = findings.find((f) => f.id === selected) || null;

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Projets' },
          { label: project?.name || '…', mono: true },
          { label: 'Findings' },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={12} /> Nouveau finding
          </button>
        }
      />

      {error && (
        <div
          style={{
            margin: '12px 24px 0',
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

      {showCreate && (
        <div style={{ padding: '12px 24px 0' }}>
          <form
            onSubmit={handleCreate}
            className="card-htg sig-card"
            style={{
              padding: 12,
              display: 'grid',
              gridTemplateColumns: '1fr 160px auto auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              className="input"
              placeholder="Titre du finding (ex: SQLi sur /api/v2/login)"
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <select
              className="input"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
            >
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
              {creating && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              Créer
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
              <X size={12} />
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Main pane */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: 14,
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
                    marginBottom: 4,
                  }}
                >
                  {project?.name || '…'} · findings
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>
                  Findings{' '}
                  <span
                    className="mono"
                    style={{
                      color: 'var(--fg-subtle)',
                      fontSize: 14,
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    {findings.length}
                  </span>
                </h1>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm">
                  <Filter size={12} /> Filtres
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { k: 'all' as const, label: 'Toutes', n: findings.length, c: 'var(--fg-muted)' },
                  ...SEVERITY_ORDER.map((s) => ({
                    k: s,
                    label: s.charAt(0) + s.slice(1).toLowerCase(),
                    n: findings.filter((f) => f.severity === s).length,
                    c: `var(--sev-${s.toLowerCase()}-fg)`,
                  })),
                ]
              ).map((f) => {
                const active = sev === f.k;
                return (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => setSev(f.k)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      background: active ? 'var(--bg-subtle)' : 'transparent',
                      border: '1px solid',
                      borderColor: active ? 'var(--border)' : 'transparent',
                      borderRadius: 'var(--r-sm)',
                      color: active ? 'var(--fg)' : 'var(--fg-muted)',
                      fontSize: 12.5,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {f.k !== 'all' && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 'var(--r-full)',
                          background: f.c,
                        }}
                      />
                    )}
                    {f.label}
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                      {f.n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div
              className="cap"
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 90px 1fr 70px 110px 130px 90px',
                gap: 12,
                padding: '8px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg)',
                position: 'sticky',
                top: 0,
                fontSize: 10.5,
              }}
            >
              <div>ID</div>
              <div>Sévérité</div>
              <div>Titre</div>
              <div style={{ textAlign: 'right' }}>CVSS</div>
              <div>Statut</div>
              <div>Owner</div>
              <div style={{ textAlign: 'right' }}>Maj</div>
            </div>

            {loading ? (
              <div style={{ padding: 40, color: 'var(--fg-muted)' }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  margin: 24,
                  padding: 40,
                  textAlign: 'center',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--r-lg)',
                  color: 'var(--fg-muted)',
                  fontSize: 13,
                }}
              >
                {findings.length === 0
                  ? 'Aucun finding pour ce projet. Créez-en un pour commencer.'
                  : 'Aucun finding ne correspond au filtre.'}
              </div>
            ) : (
              filtered.map((f) => {
                const active = f.id === selected;
                const sevLow = f.severity.toLowerCase();
                const owner = f.author
                  ? { id: f.author.id, name: `${f.author.firstName} ${f.author.lastName}` }
                  : null;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelected(f.id)}
                    onDoubleClick={() => router.push(`/dashboard/projects/${projectId}/findings/${f.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 90px 1fr 70px 110px 130px 90px',
                      gap: 12,
                      padding: '10px 24px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: active ? 'var(--bg-subtle)' : 'transparent',
                      position: 'relative',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: `var(--sev-${sevLow}-fg)`,
                        }}
                      />
                    )}
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                      {f.slug || f.id.slice(0, 8)}
                    </span>
                    <span className={`badge badge-${sevLow}`}>{sevLow}</span>
                    <div
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.title}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 12.5,
                        textAlign: 'right',
                        color:
                          (f.cvssScore || 0) >= 7
                            ? 'var(--sev-critical-fg)'
                            : (f.cvssScore || 0) >= 4
                            ? 'var(--sev-medium-fg)'
                            : 'var(--fg-muted)',
                      }}
                    >
                      {f.cvssScore !== undefined && f.cvssScore !== null ? f.cvssScore.toFixed(1) : '—'}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--fg-muted)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 'var(--r-full)',
                          background: STATUS_DOT[f.status],
                        }}
                      />
                      {STATUS_LABEL[f.status]}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {owner && <Avatar user={owner} />}
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--fg-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {owner ? owner.name.split(' ')[0] : ''}
                      </span>
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'right' }}
                    >
                      {relativeTime(f.updatedAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side panel */}
        <aside
          style={{
            width: 360,
            flexShrink: 0,
            borderLeft: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          {!cur ? (
            <div style={{ padding: 24, color: 'var(--fg-muted)', fontSize: 13 }}>
              Sélectionnez un finding pour voir le détail.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '18px 20px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 6 }}>
                  {cur.slug || cur.id.slice(0, 8)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>
                  {cur.title}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${cur.severity.toLowerCase()}`}>
                    {cur.severity.toLowerCase()}
                  </span>
                  {cur.cvssScore !== undefined && cur.cvssScore !== null && (
                    <span className="badge badge-info">CVSS {cur.cvssScore.toFixed(1)}</span>
                  )}
                  <span className="badge badge-info" style={{ textTransform: 'none' }}>
                    {STATUS_LABEL[cur.status]}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                  onClick={() => router.push(`/dashboard/projects/${projectId}/findings/${cur.id}`)}
                >
                  Ouvrir l&apos;éditeur
                </button>
              </div>

              {cur.cvssVector && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="cap" style={{ fontSize: 10.5, marginBottom: 10 }}>
                    Vecteur CVSS
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-muted)',
                      userSelect: 'all',
                      padding: 8,
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border-subtle)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {cur.cvssVector}
                  </div>
                </div>
              )}

              <div style={{ padding: '16px 20px' }}>
                <div className="cap" style={{ fontSize: 10.5, marginBottom: 10 }}>
                  Métadonnées
                </div>
                {[
                  ['Auteur', cur.author ? `${cur.author.firstName} ${cur.author.lastName}` : '—', false],
                  ['Créé', new Date(cur.createdAt).toLocaleDateString('fr-FR'), true],
                  ['Maj', relativeTime(cur.updatedAt), true],
                ].map(([k, v, mono]) => (
                  <div
                    key={k as string}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: 'var(--fg-subtle)' }}>{k as string}</span>
                    <span className={mono ? 'mono' : ''}>{v as string}</span>
                  </div>
                ))}
                {cur.tags && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {cur.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--r-sm)',
                          color: 'var(--fg-muted)',
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

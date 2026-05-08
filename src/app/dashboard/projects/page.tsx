'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { AvatarStack } from '@/components/shell/avatar';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, ApiError, type Project, type AuditType, type ProjectStatus } from '@/lib/api';
import { Plus, X, Loader2 } from 'lucide-react';

const AUDIT_TYPES: { value: AuditType; label: string }[] = [
  { value: 'WEB', label: 'Web' },
  { value: 'INTERNAL_AD', label: 'Active Directory' },
  { value: 'LINUX', label: 'Linux' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'OTHER', label: 'Autre' },
];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'cadrage',
  IN_PROGRESS: 'exécution',
  IN_REVIEW: 'revue',
  DELIVERED: 'livré',
  ARCHIVED: 'archivé',
};

function relativeDate(dateStr?: string): { label: string; overdue: boolean } {
  if (!dateStr) return { label: '—', overdue: false };
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const days = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (days === 0) return { label: "aujourd'hui", overdue: false };
  if (days > 0) return { label: `dans ${days}j`, overdue: false };
  return { label: `il y a ${-days}j`, overdue: true };
}

export default function ProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    clientCompany: '',
    clientNeed: '',
    context: '',
    startDate: '',
    endDate: '',
    auditType: 'WEB' as AuditType,
  });

  // Auto-open create dialog if query param ?new=1
  useEffect(() => {
    if (searchParams?.get('new') === '1') setShowCreate(true);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await projectsApi.getAll(token);
      setProjects(data);
    } catch {
      setError('Impossible de charger les projets');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      const project = await projectsApi.create(form, token);
      setShowCreate(false);
      setForm({
        name: '', clientCompany: '', clientNeed: '', context: '',
        startDate: '', endDate: '', auditType: 'WEB',
      });
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.clientCompany.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<'all' | ProjectStatus, number> = {
    all: projects.length,
    DRAFT: projects.filter((p) => p.status === 'DRAFT').length,
    IN_PROGRESS: projects.filter((p) => p.status === 'IN_PROGRESS').length,
    IN_REVIEW: projects.filter((p) => p.status === 'IN_REVIEW').length,
    DELIVERED: projects.filter((p) => p.status === 'DELIVERED').length,
    ARCHIVED: projects.filter((p) => p.status === 'ARCHIVED').length,
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Projets' }]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={12} /> Nouveau projet
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ padding: '20px 24px 0' }}>
          {/* Filters + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'IN_PROGRESS', 'IN_REVIEW', 'DRAFT', 'DELIVERED', 'ARCHIVED'] as const).map((k) => {
                const active = filter === k;
                const label = k === 'all' ? 'Tous' : STATUS_LABEL[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
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
                      textTransform: 'capitalize',
                    }}
                  >
                    {label}
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                      {counts[k]}
                    </span>
                  </button>
                );
              })}
            </div>
            <input
              className="input"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 260, marginLeft: 'auto' }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              margin: '0 24px 12px',
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
          <CreateDialog
            form={form}
            setForm={setForm}
            onCancel={() => { setShowCreate(false); setError(''); }}
            onSubmit={handleCreate}
            creating={creating}
          />
        )}

        {loading ? (
          <div style={{ padding: 40, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              margin: '24px',
              padding: 40,
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r-lg)',
              color: 'var(--fg-muted)',
            }}
          >
            {projects.length === 0
              ? 'Aucun projet pour l\'instant. Créez-en un pour démarrer.'
              : 'Aucun projet ne correspond à ce filtre.'}
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {/* Header */}
            <div
              className="cap"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 220px 90px 100px 120px 100px',
                gap: 12,
                padding: '8px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg)',
                position: 'sticky',
                top: 0,
                fontSize: 10.5,
              }}
            >
              <div>Projet</div>
              <div>Client</div>
              <div>Type</div>
              <div>Phase</div>
              <div>Équipe</div>
              <div style={{ textAlign: 'right' }}>Échéance</div>
            </div>

            {filtered.map((p) => {
              const auditLabel = AUDIT_TYPES.find((t) => t.value === p.auditType)?.label || p.auditType;
              const due = relativeDate(p.endDate);
              const team = (p.members || []).map((m) => ({
                id: m.user.id,
                name: `${m.user.firstName} ${m.user.lastName}`,
              }));
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px 90px 100px 120px 100px',
                    gap: 12,
                    padding: '12px 24px',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontSize: 13,
                    position: 'relative',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                  }
                >
                  {due.overdue && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: 'var(--sev-critical-fg)',
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
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
                      {p.clientNeed}
                    </div>
                  </div>
                  <div
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--fg-muted)',
                    }}
                  >
                    {p.clientCompany}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{auditLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>
                    {STATUS_LABEL[p.status]}
                  </div>
                  <div>
                    <AvatarStack users={team} max={3} />
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: due.overdue ? 'var(--sev-critical-fg)' : 'var(--fg-muted)',
                      textAlign: 'right',
                    }}
                  >
                    {due.label}
                  </div>
                </div>
              );
            })}

            <div
              style={{
                padding: '12px 24px',
                fontSize: 11.5,
                color: 'var(--fg-subtle)',
              }}
              className="mono"
            >
              {projects.length} projet{projects.length > 1 ? 's' : ''} ·{' '}
              {counts.IN_PROGRESS} actif{counts.IN_PROGRESS > 1 ? 's' : ''} ·{' '}
              {counts.DELIVERED} livré{counts.DELIVERED > 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface CreateDialogProps {
  form: {
    name: string;
    clientCompany: string;
    clientNeed: string;
    context: string;
    startDate: string;
    endDate: string;
    auditType: AuditType;
  };
  setForm: (f: CreateDialogProps['form']) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  creating: boolean;
}

function CreateDialog({ form, setForm, onCancel, onSubmit, creating }: CreateDialogProps) {
  return (
    <div style={{ margin: '0 24px 16px' }}>
      <div className="card-htg sig-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Nouveau projet</span>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
          >
            <X size={14} />
          </button>
        </div>
        <form onSubmit={onSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nom du projet">
              <input
                className="input"
                placeholder="acme-prod-2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Client">
              <input
                className="input"
                placeholder="ACME Corp"
                value={form.clientCompany}
                onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Besoin client">
            <input
              className="input"
              placeholder="Test d'intrusion de l'application web…"
              value={form.clientNeed}
              onChange={(e) => setForm({ ...form, clientNeed: e.target.value })}
              required
            />
          </Field>
          <Field label="Contexte">
            <input
              className="input"
              placeholder="Application e-commerce en production…"
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              required
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Début">
              <input
                className="input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Fin">
              <input
                className="input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Type d'audit">
              <select
                className="input"
                value={form.auditType}
                onChange={(e) => setForm({ ...form, auditType: e.target.value as AuditType })}
              >
                {AUDIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn" onClick={onCancel}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              Créer le projet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="cap" style={{ fontSize: 10.5 }}>{label}</span>
      {children}
    </label>
  );
}

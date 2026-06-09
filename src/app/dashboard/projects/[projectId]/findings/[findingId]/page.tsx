'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  findingsApi,
  projectsApi,
  ApiError,
  type Finding,
  type Severity,
  type FindingStatus,
  type ProjectDetail,
} from '@/lib/api';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { CvssCalculator } from '@/components/findings/cvss-calculator';
import { TagInput } from '@/components/findings/tag-input';

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// Note: FALSE_POSITIVE is intentionally not selectable — a confirmed false
// positive shouldn't be reported, so it has no place in the editor workflow.
const STATUS_OPTIONS: { value: FindingStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'FIXED', label: 'Corrigé' },
];

type Tab = 'description' | 'reproduction' | 'impact' | 'history';

const TABS: { key: Tab; label: string }[] = [
  { key: 'description', label: 'Description' },
  { key: 'reproduction', label: 'PoC' },
  { key: 'impact', label: 'Impact & reco' },
  { key: 'history', label: 'Historique' },
];

export default function FindingEditPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const findingId = params.findingId as string;
  const { token, user } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('description');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local editable state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proof, setProof] = useState('');
  const [impact, setImpact] = useState('');
  const [remediation, setRemediation] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [status, setStatus] = useState<FindingStatus>('DRAFT');
  const [cvssScore, setCvssScore] = useState<string>('');
  const [cvssVector, setCvssVector] = useState<string>('');
  const [tags, setTags] = useState<string>('');

  // Horizontal partitioning (cloisonnement) — a PENTESTER may only edit their
  // own findings. MANAGER and SUPER_ADMIN can edit any; CLIENT is read-only.
  const myRole = project?.members.find((m) => m.user.id === user?.id)?.role;
  const canEdit =
    user?.role === 'SUPER_ADMIN' ||
    myRole === 'MANAGER' ||
    (myRole === 'PENTESTER' && finding?.authorId === user?.id);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [proj, f] = await Promise.all([
        projectsApi.getOne(projectId, token),
        findingsApi.getOne(findingId, token),
      ]);
      setProject(proj);
      setFinding(f);
      setTitle(f.title);
      setDescription(f.description || '');
      setProof(f.proof || '');
      setImpact(f.impact || '');
      setRemediation(f.remediation || '');
      setSeverity(f.severity);
      setStatus(f.status);
      setCvssScore(f.cvssScore != null ? String(f.cvssScore) : '');
      setCvssVector(f.cvssVector || '');
      setTags(f.tags || '');
    } catch {
      setError('Impossible de charger le finding');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, findingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (project) {
      setActiveProject({ id: project.id, slug: project.name });
    }
    return () => setActiveProject(null);
  }, [project, setActiveProject]);

  // Persist any change with a debounce
  const persist = useCallback(
    (override?: Partial<Finding>) => {
      if (!token || !finding) return;
      setSaveState('saving');
      const data = {
        title,
        description,
        proof,
        impact,
        remediation,
        severity,
        status,
        cvssScore: cvssScore ? parseFloat(cvssScore) : undefined,
        cvssVector: cvssVector || undefined,
        tags: tags || undefined,
        ...override,
      };
      findingsApi
        .update(finding.id, data, token)
        .then((updated) => {
          setFinding(updated);
          setSaveState('saved');
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Erreur de sauvegarde');
          setSaveState('error');
        });
    },
    [token, finding, title, description, proof, impact, remediation, severity, status, cvssScore, cvssVector, tags]
  );

  // Auto-save 1.5s after last edit
  useEffect(() => {
    if (!finding || !canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, proof, impact, remediation, cvssScore, cvssVector, tags]);

  const handleSeverityChange = (s: Severity) => {
    setSeverity(s);
    persist({ severity: s });
  };
  const handleStatusChange = (s: FindingStatus) => {
    setStatus(s);
    persist({ status: s });
  };
  const handleCvssChange = ({ score, vector }: { score: number | null; vector: string }) => {
    const scoreStr = score != null ? String(score) : '';
    setCvssScore(scoreStr);
    setCvssVector(vector);
    persist({ cvssScore: score ?? undefined, cvssVector: vector || undefined });
  };

  const handleDelete = async () => {
    if (!finding || !token) return;
    if (!confirm(`Supprimer définitivement « ${finding.title} » ?`)) return;
    try {
      await findingsApi.remove(finding.id, token);
      router.push(`/dashboard/projects/${projectId}/findings`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!finding) {
    return (
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
        <p className="text-sm text-destructive">{error || 'Finding introuvable'}</p>
      </div>
    );
  }

  const sevLow = severity.toLowerCase();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground" onClick={() => router.push(`/dashboard/projects/${projectId}/findings`)}>
            <ArrowLeft className="h-3 w-3 mr-1" />
            Findings
          </Button>
          <span className="font-mono text-xs text-muted-foreground">{finding.slug || finding.id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[11px]"
            style={{
              color:
                saveState === 'saving'
                  ? 'var(--fg-muted)'
                  : saveState === 'saved'
                  ? 'var(--st-compliant-fg)'
                  : saveState === 'error'
                  ? 'var(--sev-critical-fg)'
                  : 'var(--fg-subtle)',
            }}
          >
            {saveState === 'saving' && 'enregistrement…'}
            {saveState === 'saved' && '✓ enregistré'}
            {saveState === 'error' && 'erreur'}
          </span>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete} title="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!canEdit && (
            <div
              className="mx-4 sm:mx-8 mb-3"
              style={{
                fontSize: 12,
                color: 'var(--fg-muted)',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 12px',
              }}
            >
              Lecture seule — vous ne pouvez modifier que les findings dont vous êtes l’auteur.
            </div>
          )}
          <div className="px-4 sm:px-8 pb-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              readOnly={!canEdit}
              placeholder="Titre du finding"
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                outline: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: 'var(--fg)',
                fontFamily: 'inherit',
                padding: 0,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: 12,
                fontSize: 12,
                color: 'var(--fg-subtle)',
                alignItems: 'center',
              }}
            >
              <span className={`badge badge-${sevLow}`}>{sevLow}</span>
              <span className="mono">{finding.slug || finding.id.slice(0, 8)}</span>
              {finding.author && (
                <span>
                  par {finding.author.firstName} {finding.author.lastName}
                </span>
              )}
              <span className="mono">
                créé {new Date(finding.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 16px 0',
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: active ? 'var(--fg)' : 'var(--fg-muted)',
                    fontWeight: active ? 500 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    borderBottom: '2px solid',
                    borderBottomColor: active ? 'var(--accent)' : 'transparent',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div style={{ flex: 1, padding: '14px 16px', overflow: 'auto' }}>
            {tab === 'description' && (
              <FindingEditor
                value={description}
                onChange={setDescription}
                placeholder="Décrivez la vulnérabilité, le contexte, le composant impacté…"
                projectId={projectId}
                editable={canEdit}
              />
            )}
            {tab === 'reproduction' && (
              <FindingEditor
                value={proof}
                onChange={setProof}
                placeholder="Preuve de concept : étapes, requêtes, payloads…"
                projectId={projectId}
                editable={canEdit}
              />
            )}
            {tab === 'impact' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="cap" style={{ marginBottom: 6 }}>Impact</div>
                  <FindingEditor
                    value={impact}
                    onChange={setImpact}
                    placeholder="Quels sont les impacts métier / techniques ?"
                    projectId={projectId}
                    editable={canEdit}
                  />
                </div>
                <div>
                  <div className="cap" style={{ marginBottom: 6 }}>Recommandations</div>
                  <FindingEditor
                    value={remediation}
                    onChange={setRemediation}
                    placeholder="Recommandations pour corriger…"
                    projectId={projectId}
                    editable={canEdit}
                  />
                </div>
              </div>
            )}
            {tab === 'history' && (
              <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                Historique des modifications à venir.
              </div>
            )}
          </div>
        </div>

        {/* Aside */}
        <aside
          style={{
            width: 320,
            flexShrink: 0,
            background: 'var(--bg-elevated)',
            overflow: 'auto',
            padding: '18px 20px',
          }}
        >
          {/* Severity buttons */}
          <div className="cap" style={{ marginBottom: 8 }}>Sévérité</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 16 }}>
            {SEVERITIES.map((s) => {
              const active = severity === s;
              const sl = s.toLowerCase();
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleSeverityChange(s)}
                  style={{
                    padding: '6px 0',
                    background: active ? `var(--sev-${sl}-bg)` : 'var(--bg-subtle)',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    color: active ? `var(--sev-${sl}-fg)` : 'var(--fg-muted)',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                  title={s}
                >
                  {sl.slice(0, 4)}
                </button>
              );
            })}
          </div>

          {/* Status */}
          <div className="cap" style={{ marginBottom: 8 }}>Statut</div>
          <select
            className="input"
            value={status}
            disabled={!canEdit}
            onChange={(e) => handleStatusChange(e.target.value as FindingStatus)}
            style={{ marginBottom: 16 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* CVSS */}
          <div className="cap" style={{ marginBottom: 8 }}>CVSS 3.1</div>
          <input
            className="input mono"
            value={cvssVector}
            readOnly={!canEdit}
            onChange={(e) => setCvssVector(e.target.value)}
            placeholder="CVSS:3.1/AV:N/AC:L/…"
            style={{ fontSize: 11, marginBottom: 8 }}
          />
          {canEdit && <CvssCalculator vector={cvssVector} onChange={handleCvssChange} />}
          <div style={{ marginBottom: 16 }} />

          {/* Tags */}
          <div className="cap" style={{ marginBottom: 8 }}>Tags</div>
          {canEdit ? (
            <TagInput value={tags} onChange={setTags} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="mono"
                    style={{
                      padding: '2px 6px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 10.5,
                      color: 'var(--fg-muted)',
                    }}
                  >
                    {t}
                  </span>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface FindingEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  projectId?: string;
  editable?: boolean;
}

function FindingEditor({ value, onChange, placeholder, projectId, editable = true }: FindingEditorProps) {
  return (
    <div
      style={{
        borderRadius: 'var(--r-md)',
        background: 'var(--bg-elevated)',
        padding: '14px 18px',
        minHeight: 280,
      }}
    >
      <RichTextEditor
        content={value}
        onChange={onChange}
        placeholder={placeholder}
        storageMode="json"
        projectId={projectId}
        editable={editable}
      />
    </div>
  );
}

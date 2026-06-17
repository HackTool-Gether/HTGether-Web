'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  projectsApi, scopesApi, statsApi, remarksApi, ApiError,
  type ProjectDetail, type ProjectStats, type ProjectRemark,
  type Scope, type ScopeStatus, type AuditType, type ProjectStatus,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  X,
  Loader2,
  FileText,
  Target,
  Trash2,
  Pencil,
  Check,
  AlertTriangle,
  Clock,
  Bug,
  ListChecks,
  Send,
  MessageSquare,
  Brain,
  CheckSquare,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const AUDIT_LABELS: Record<string, string> = {
  APP_PENTEST: "Test d'intrusion applicatif",
  EXTERNAL_PENTEST: "Test d'intrusion externe",
  INTERNAL_PENTEST: "Test d'intrusion interne",
  CODE_AUDIT: 'Audit de code',
  ARCHITECTURE_AUDIT: "Audit d'architecture",
  CONFIG_AUDIT: 'Audit de configuration',
  CLOUD_CONFIG_AUDIT: 'Audit de configuration Cloud',
};

const AUDIT_OPTIONS: { value: AuditType; label: string }[] = [
  { value: 'APP_PENTEST', label: "Test d'intrusion applicatif" },
  { value: 'EXTERNAL_PENTEST', label: "Test d'intrusion externe" },
  { value: 'INTERNAL_PENTEST', label: "Test d'intrusion interne" },
  { value: 'CODE_AUDIT', label: 'Audit de code' },
  { value: 'ARCHITECTURE_AUDIT', label: "Audit d'architecture" },
  { value: 'CONFIG_AUDIT', label: 'Audit de configuration' },
  { value: 'CLOUD_CONFIG_AUDIT', label: 'Audit de configuration Cloud' },
];

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Cadrage' },
  { value: 'IN_PROGRESS', label: 'Exécution' },
  { value: 'IN_REVIEW', label: 'Revue' },
  { value: 'DELIVERED', label: 'Livré' },
  { value: 'ARCHIVED', label: 'Archivé' },
];

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

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'var(--sev-critical-fg, oklch(0.65 0.2 25))',
  HIGH: 'var(--sev-high-fg, oklch(0.7 0.15 40))',
  MEDIUM: 'var(--sev-medium-fg, oklch(0.75 0.15 80))',
  LOW: 'var(--sev-low-fg, oklch(0.6 0.12 250))',
  INFO: 'var(--sev-info-fg, oklch(0.6 0.05 250))',
};

function progressPercent(p: ProjectDetail): number {
  const start = new Date(p.startDate).getTime();
  const end = new Date(p.endDate).getTime();
  const now = Date.now();
  if (!start || !end || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

interface EditForm {
  name: string;
  clientCompany: string;
  clientNeed: string;
  context: string;
  startDate: string;
  endDate: string;
  auditType: AuditType;
  status: ProjectStatus;
}

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export default function ProjectDetailPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [remarks, setRemarks] = useState<ProjectRemark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddScope, setShowAddScope] = useState(false);
  const [scopeForm, setScopeForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', clientCompany: '', clientNeed: '', context: '',
    startDate: '', endDate: '', auditType: 'APP_PENTEST', status: 'DRAFT',
  });
  const [remarkText, setRemarkText] = useState('');
  const [sendingRemark, setSendingRemark] = useState(false);

  const isManager = user && project && (
    user.role === 'SUPER_ADMIN' ||
    project.members?.some((m) => m.user.id === user.id && m.role === 'MANAGER')
  );

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

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await statsApi.getProjectStats(projectId, token);
      setStats(data);
    } catch { /* stats are non-critical */ }
  }, [token, projectId]);

  const loadRemarks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await remarksApi.getAll(projectId, token);
      setRemarks(data);
    } catch { /* remarks are manager-only, may fail for non-managers */ }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRemarks(); }, [loadRemarks]);

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
      loadStats();
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
      loadStats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const startEditing = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      clientCompany: project.clientCompany,
      clientNeed: project.clientNeed,
      context: project.context,
      startDate: toDateInput(project.startDate),
      endDate: toDateInput(project.endDate),
      auditType: project.auditType,
      status: project.status,
    });
    setEditing(true);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await projectsApi.update(projectId, editForm, token);
      setEditing(false);
      load();
      loadStats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleSendRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !remarkText.trim()) return;
    setSendingRemark(true);
    try {
      await remarksApi.create(projectId, remarkText.trim(), token);
      setRemarkText('');
      loadRemarks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setSendingRemark(false);
    }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    if (!token) return;
    try {
      await remarksApi.remove(projectId, remarkId, token);
      loadRemarks();
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

  if (!project) {
    return (
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
        <p className="text-sm" style={{ color: 'var(--sev-critical-fg)' }}>Projet introuvable.</p>
      </div>
    );
  }

  const progress = progressPercent(project);
  const alertCount = stats ? (
    (stats.alerts.isLate ? 1 : 0) +
    stats.alerts.stalledScopes.length +
    (stats.alerts.unconfirmedFindings > 0 ? 1 : 0)
  ) : 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
        {/* Header */}
        {editing ? (
          <form onSubmit={handleSave}>
            <div className="rounded-xl bg-card p-5 mb-6 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold">Modifier le projet</h2>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setError(''); }}>
                    <X className="mr-1 h-3 w-3" /> Annuler
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                    Enregistrer
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom du projet</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client</Label>
                  <Input
                    value={editForm.clientCompany}
                    onChange={(e) => setEditForm({ ...editForm, clientCompany: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Besoin client</Label>
                <textarea
                  value={editForm.clientNeed}
                  onChange={(e) => setEditForm({ ...editForm, clientNeed: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Contexte</Label>
                <textarea
                  value={editForm.context}
                  onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Début</Label>
                  <Input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin</Label>
                  <Input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type d&apos;audit</Label>
                  <Select
                    value={editForm.auditType}
                    onValueChange={(v) => setEditForm({ ...editForm, auditType: v as AuditType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Statut</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm({ ...editForm, status: v as ProjectStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                  <span>{project.clientCompany}</span>
                  <span className="text-border">—</span>
                  <span>{AUDIT_LABELS[project.auditType]}</span>
                  <span className="text-border">—</span>
                  <span>
                    {new Date(project.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(project.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {stats?.alerts.isLate && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle size={11} /> en retard
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground capitalize">{STATUS_PHASE[project.status]}</span>
                {isManager && (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil className="mr-1 h-3 w-3" /> Éditer
                  </Button>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: stats?.alerts.isLate ? 'oklch(0.65 0.2 25)' : 'var(--primary)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10.5px] text-muted-foreground">
                <span>jour {Math.round((progress / 100) * Math.max(1, durationDays(project)))} / {durationDays(project)}</span>
                <span>{progress}%</span>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Alerts banner */}
        {stats && alertCount > 0 && (
          <div className="mb-4 rounded-xl border p-3 space-y-1.5"
            style={{ borderColor: 'oklch(0.65 0.2 25 / 0.3)', background: 'oklch(0.65 0.2 25 / 0.05)' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'oklch(0.65 0.2 25)' }}>
              <AlertTriangle size={13} /> Alertes ({alertCount})
            </div>
            <div className="space-y-1">
              {stats.alerts.isLate && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock size={11} className="text-muted-foreground" />
                  <span>Projet en retard — date de fin dépassée</span>
                </div>
              )}
              {stats.alerts.stalledScopes.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Target size={11} className="text-muted-foreground" />
                  <span>{stats.alerts.stalledScopes.length} périmètre{stats.alerts.stalledScopes.length > 1 ? 's' : ''} sans activité depuis 7 jours</span>
                </div>
              )}
              {stats.alerts.unconfirmedFindings > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Bug size={11} className="text-muted-foreground" />
                  <span>{stats.alerts.unconfirmedFindings} finding{stats.alerts.unconfirmedFindings > 1 ? 's' : ''} non confirmé{stats.alerts.unconfirmedFindings > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {/* Cadrage */}
            <div className="rounded-xl bg-card p-4">
              <div className="text-sm font-medium mb-2.5">Cadrage</div>
              <div className="grid grid-cols-2 gap-4">
                <Block label="Besoin client" value={project.clientNeed} />
                <Block label="Contexte" value={project.context} />
              </div>
            </div>

            {/* Findings by severity */}
            {stats && stats.findings.total > 0 && (
              <div className="rounded-xl bg-card p-4">
                <div className="text-sm font-medium mb-3">Findings par sévérité</div>
                <div className="flex gap-1.5 h-3 rounded-full overflow-hidden mb-2">
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => {
                    const count = stats.findings.bySeverity[sev] || 0;
                    if (!count) return null;
                    const pct = (count / stats.findings.total) * 100;
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

                {stats.findings.byAuthor.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1.5">Par auditeur</div>
                    <div className="space-y-1">
                      {stats.findings.byAuthor.map((a) => (
                        <div key={a.userId} className="flex items-center justify-between text-xs">
                          <span>{a.name}</span>
                          <span className="font-mono font-semibold">{a.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task progress by member */}
            {stats && stats.tasks.byMember.length > 0 && (
              <div className="rounded-xl bg-card p-4">
                <div className="text-sm font-medium mb-3">Tâches par membre</div>
                <div className="space-y-2.5">
                  {stats.tasks.byMember.map((m) => {
                    const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
                    return (
                      <div key={m.memberId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{m.name}</span>
                          <span className="font-mono text-muted-foreground">{m.done}/{m.total}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scopes */}
            <div className="rounded-xl bg-card overflow-hidden">
              <div className="flex items-center px-4 py-3">
                <span className="text-sm font-medium">
                  Périmètres
                  <span className="font-mono text-muted-foreground ml-1.5 font-normal">
                    {project.scopes?.length || 0}
                  </span>
                </span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowAddScope(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Nouveau
                </Button>
              </div>

              {showAddScope && (
                <form onSubmit={handleAddScope} className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Input
                      placeholder="Nom (ex: Application Web)"
                      value={scopeForm.name}
                      onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Description (optionnelle)"
                      value={scopeForm.description}
                      onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddScope(false)}>
                      <X className="mr-1 h-3 w-3" /> Annuler
                    </Button>
                    <Button type="submit" size="sm" disabled={creating}>
                      {creating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Ajouter
                    </Button>
                  </div>
                </form>
              )}

              {(!project.scopes || project.scopes.length === 0) ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Target className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
                  Aucun périmètre. Ajoutez-en pour démarrer le test.
                </div>
              ) : (
                project.scopes.map((scope: Scope) => {
                  const isStalled = stats?.alerts.stalledScopes.includes(scope.id);
                  return (
                    <div
                      key={scope.id}
                      onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scope.id}`)}
                      className="grid gap-3.5 items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ gridTemplateColumns: '1fr auto auto auto' }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {scope.name}
                          {isStalled && (
                            <span className="text-[9px] px-1 py-0.5 rounded font-sans"
                              style={{ background: 'oklch(0.75 0.15 80 / 0.15)', color: 'oklch(0.65 0.15 80)' }}>
                              inactif
                            </span>
                          )}
                        </div>
                        {scope.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {scope.description}
                          </div>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {scope._count?.notes ?? 0}
                      </span>
                      <span className={`badge badge-${SCOPE_BADGE[scope.status]}`}>
                        {SCOPE_LABEL[scope.status]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScope(scope.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Team */}
            <div className="rounded-xl bg-card p-4">
              <div className="text-sm font-medium mb-2.5">Équipe ({project.members?.length || 0})</div>
              {(!project.members || project.members.length === 0) ? (
                <div className="text-xs text-muted-foreground">Aucun membre.</div>
              ) : (
                project.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                    <Avatar
                      user={{
                        id: m.user.id,
                        name: `${m.user.firstName} ${m.user.lastName}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {m.user.firstName} {m.user.lastName}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {m.role.toLowerCase()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Scope completion */}
            {stats && stats.scopes.total > 0 && (
              <div className="rounded-xl bg-card p-4">
                <div className="text-sm font-medium mb-2.5">Avancement périmètres</div>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-2">
                  {[
                    { key: 'completed', color: 'oklch(0.60 0.15 145)', count: stats.scopes.completed },
                    { key: 'inReview', color: 'oklch(0.75 0.15 80)', count: stats.scopes.inReview },
                    { key: 'inProgress', color: 'oklch(0.65 0.15 250)', count: stats.scopes.inProgress },
                    { key: 'notStarted', color: 'var(--secondary)', count: stats.scopes.notStarted },
                  ].map((s) => {
                    if (!s.count) return null;
                    return (
                      <div
                        key={s.key}
                        style={{ width: `${(s.count / stats.scopes.total) * 100}%`, background: s.color, minWidth: 3 }}
                      />
                    );
                  })}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Terminés</span><span className="font-mono">{stats.scopes.completed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">En revue</span><span className="font-mono">{stats.scopes.inReview}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">En cours</span><span className="font-mono">{stats.scopes.inProgress}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Non démarrés</span><span className="font-mono">{stats.scopes.notStarted}</span></div>
                </div>
              </div>
            )}

            {/* AI config */}
            {isManager && project && (
              <div className="rounded-xl bg-card p-4">
                <div className="text-sm font-medium mb-2.5 flex items-center gap-1.5">
                  <Brain size={13} />
                  Intelligence Artificielle
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium">Activer l&apos;IA pour ce projet</p>
                    <p className="text-[10.5px] text-muted-foreground">L&apos;IA aura accès aux notes des scopes sélectionnés</p>
                  </div>
                  <Switch
                    checked={project.aiEnabled ?? false}
                    onCheckedChange={async (checked) => {
                      if (!token) return;
                      try {
                        await projectsApi.update(project.id, { aiEnabled: checked } as any, token);
                        setProject({ ...project, aiEnabled: checked });
                      } catch { /* ignore */ }
                    }}
                  />
                </div>
                {project.aiEnabled && project.scopes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider">Scopes accessibles par l&apos;IA</p>
                    {project.scopes.map((scope) => {
                      const aiScopeIds = (project.aiScopeIds ?? []) as string[];
                      const allSelected = aiScopeIds.length === 0;
                      const isSelected = allSelected || aiScopeIds.includes(scope.id);
                      return (
                        <button
                          key={scope.id}
                          className={`flex items-center gap-2 w-full rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${isSelected ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'}`}
                          onClick={async () => {
                            if (!token) return;
                            let newIds: string[];
                            if (allSelected) {
                              newIds = project.scopes.filter((s) => s.id !== scope.id).map((s) => s.id);
                            } else if (isSelected) {
                              newIds = aiScopeIds.filter((id) => id !== scope.id);
                            } else {
                              newIds = [...aiScopeIds, scope.id];
                            }
                            if (newIds.length === project.scopes.length) newIds = [];
                            try {
                              await projectsApi.update(project.id, { aiScopeIds: newIds } as any, token);
                              setProject({ ...project, aiScopeIds: newIds });
                            } catch { /* ignore */ }
                          }}
                        >
                          <CheckSquare size={12} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                          {scope.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Manager remarks */}
            {isManager && (
              <div className="rounded-xl bg-card p-4">
                <div className="text-sm font-medium mb-2.5 flex items-center gap-1.5">
                  <MessageSquare size={13} />
                  Remarques manager
                </div>
                <form onSubmit={handleSendRemark} className="flex gap-2 mb-3">
                  <Input
                    placeholder="Ajouter une remarque…"
                    value={remarkText}
                    onChange={(e) => setRemarkText(e.target.value)}
                    className="text-xs"
                  />
                  <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={sendingRemark || !remarkText.trim()}>
                    {sendingRemark ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </form>
                {remarks.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">Aucune remarque</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {remarks.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border p-2.5 group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10.5px] font-medium">
                            {r.author.firstName} {r.author.lastName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteRemark(r.id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm leading-relaxed">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

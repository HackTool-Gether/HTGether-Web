'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, scopesApi, ApiError, type ProjectDetail, type Scope, type ScopeStatus, type AuditType, type ProjectStatus } from '@/lib/api';
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
} from 'lucide-react';

const AUDIT_LABELS: Record<string, string> = {
  WEB: 'Web', INTERNAL_AD: 'Active Directory', LINUX: 'Linux', MOBILE: 'Mobile', OTHER: 'Autre',
};

const AUDIT_OPTIONS: { value: AuditType; label: string }[] = [
  { value: 'WEB', label: 'Web' },
  { value: 'INTERNAL_AD', label: 'Active Directory' },
  { value: 'LINUX', label: 'Linux' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'OTHER', label: 'Autre' },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddScope, setShowAddScope] = useState(false);
  const [scopeForm, setScopeForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', clientCompany: '', clientNeed: '', context: '',
    startDate: '', endDate: '', auditType: 'WEB', status: 'DRAFT',
  });

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

  const canEdit = user && project && (
    user.role === 'SUPER_ADMIN' ||
    project.members?.some((m) => m.user.id === user.id && m.role === 'MANAGER')
  );

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
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

  const team = (project.members || []).map((m) => ({
    id: m.user.id,
    name: `${m.user.firstName} ${m.user.lastName}`,
  }));
  const progress = progressPercent(project);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                  {project.clientCompany} · {AUDIT_LABELS[project.auditType]}
                </p>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {new Date(project.startDate).toLocaleDateString('fr-FR')} — {new Date(project.endDate).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="capitalize">{STATUS_PHASE[project.status]}</span>
                </div>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="mr-1 h-3 w-3" /> Éditer
                </Button>
              )}
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10.5px] text-muted-foreground font-mono">
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

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {/* Cadrage */}
            <div className="rounded-xl bg-card p-4">
              <div className="cap mb-2.5">Cadrage</div>
              <div className="grid grid-cols-2 gap-4">
                <Block label="Besoin client" value={project.clientNeed} />
                <Block label="Contexte" value={project.context} />
              </div>
            </div>

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
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddScope(false)}>
                      <X className="mr-1 h-3 w-3" /> Annuler
                    </Button>
                    <Button size="sm" disabled={creating}>
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
                project.scopes.map((scope: Scope) => (
                  <div
                    key={scope.id}
                    onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scope.id}`)}
                    className="grid gap-3.5 items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    style={{ gridTemplateColumns: '1fr auto auto auto' }}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-medium">{scope.name}</div>
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
                ))
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Team */}
            <div className="rounded-xl bg-card p-4">
              <div className="cap mb-2.5">Équipe ({project.members?.length || 0})</div>
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
      <div className="cap text-[10.5px] mb-1">{label}</div>
      <div className="text-sm leading-relaxed">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

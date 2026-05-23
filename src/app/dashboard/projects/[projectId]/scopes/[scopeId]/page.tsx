'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { scopesApi, notesApi, componentsApi, ApiError } from '@/lib/api';
import type { ScopeDetail, Note, ComponentData, ComponentStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
  Clock,
  Grid3X3,
  X,
  ChevronDown,
  Bug,
} from 'lucide-react';

const STATUS_META: Record<ComponentStatus, { label: string; color: string; bg: string }> = {
  COMPLIANT: { label: 'Conforme', color: 'oklch(0.72 0.17 150)', bg: 'oklch(0.72 0.17 150 / 0.12)' },
  REMARK: { label: 'Remarque', color: 'oklch(0.75 0.15 75)', bg: 'oklch(0.75 0.15 75 / 0.12)' },
  VULNERABLE: { label: 'Vulnérable', color: 'oklch(0.65 0.2 25)', bg: 'oklch(0.65 0.2 25 / 0.12)' },
  UNTESTED: { label: 'Non testé', color: 'oklch(0.65 0.01 250)', bg: 'oklch(0.65 0.01 250 / 0.12)' },
};

const STATUS_ORDER: ComponentStatus[] = ['VULNERABLE', 'REMARK', 'COMPLIANT', 'UNTESTED'];

export default function ScopeDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const scopeId = params.scopeId as string;

  const [scope, setScope] = useState<ScopeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);

  const [components, setComponents] = useState<ComponentData[]>([]);
  const [showAddComp, setShowAddComp] = useState(false);
  const [compForm, setCompForm] = useState({ name: '', type: '' });
  const [creatingComp, setCreatingComp] = useState(false);
  const [statusMenu, setStatusMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await scopesApi.getOne(projectId, scopeId, token);
      setScope(data);
      try {
        const comps = await componentsApi.getAllByScope(scopeId, token);
        setComponents(comps);
      } catch {
        setComponents([]);
      }
    } catch {
      setError('Impossible de charger le scope');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, scopeId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      const note = await notesApi.create(projectId, scopeId, { title: newTitle }, token);
      router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
      setCreating(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!token) return;
    try {
      await notesApi.remove(noteId, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !compForm.name.trim()) return;
    setCreatingComp(true);
    setError('');
    try {
      const comp = await componentsApi.create(scopeId, {
        name: compForm.name,
        type: compForm.type || undefined,
      }, token);
      setComponents((prev) => [...prev, comp]);
      setCompForm({ name: '', type: '' });
      setShowAddComp(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreatingComp(false);
    }
  };

  const handleStatusChange = async (compId: string, status: ComponentStatus) => {
    if (!token) return;
    setStatusMenu(null);
    try {
      const updated = await componentsApi.updateStatus(scopeId, compId, status, token);
      setComponents((prev) => prev.map((c) => (c.id === compId ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleDeleteComponent = async (compId: string) => {
    if (!token) return;
    try {
      await componentsApi.remove(scopeId, compId, token);
      setComponents((prev) => prev.filter((c) => c.id !== compId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const totalComps = components.length;
  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = components.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<ComponentStatus, number>);
  const complianceRate = totalComps > 0
    ? Math.round((statusCounts.COMPLIANT / totalComps) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!scope) {
    return (
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Scope introuvable</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 max-w-5xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {scope.project.name}
          </Button>
          <h1 className="text-2xl font-bold">{scope.name}</h1>
          {scope.description && (
            <p className="text-sm text-muted-foreground mt-1">{scope.description}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ── Component Cartography ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Grid3X3 className="h-4.5 w-4.5" />
                Composants
                <span className="text-sm font-normal text-muted-foreground font-mono">{totalComps}</span>
              </h2>
            </div>
            <Button size="sm" onClick={() => setShowAddComp(true)}>
              <Plus className="mr-1.5 h-3 w-3" />
              Ajouter
            </Button>
          </div>

          {/* Stats bar */}
          {totalComps > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden flex">
                {STATUS_ORDER.map((s) => {
                  const pct = (statusCounts[s] / totalComps) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={s}
                      style={{ width: `${pct}%`, background: STATUS_META[s].color }}
                      className="h-full transition-all"
                    />
                  );
                })}
              </div>
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                {complianceRate}% conforme
              </span>
            </div>
          )}

          {/* Status legend */}
          {totalComps > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                  {STATUS_META[s].label}
                  <span className="font-mono">{statusCounts[s]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add component form */}
          {showAddComp && (
            <div className="rounded-xl bg-card p-3 mb-4">
              <form onSubmit={handleCreateComponent} className="flex items-center gap-2">
                <Input
                  value={compForm.name}
                  onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                  placeholder="Nom du composant (ex: /api/login, SSH, LDAP)"
                  required
                  autoFocus
                  className="flex-1 h-8 text-sm"
                />
                <Input
                  value={compForm.type}
                  onChange={(e) => setCompForm({ ...compForm, type: e.target.value })}
                  placeholder="Type (ex: endpoint, service)"
                  className="w-[180px] h-8 text-sm"
                />
                <Button type="submit" size="sm" disabled={creatingComp}>
                  {creatingComp && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Créer
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddComp(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </form>
            </div>
          )}

          {/* Component grid */}
          {totalComps === 0 && !showAddComp ? (
            <div className="rounded-xl bg-card flex flex-col items-center justify-center py-10">
              <Grid3X3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Aucun composant</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Ajoutez les composants du périmètre pour suivre leur état
              </p>
              <Button size="sm" onClick={() => setShowAddComp(true)}>
                <Plus className="mr-1.5 h-3 w-3" />
                Ajouter un composant
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {components.map((comp) => {
                const meta = STATUS_META[comp.status];
                const findingsCount = comp._count?.findings || 0;
                return (
                  <div
                    key={comp.id}
                    className="relative rounded-lg border border-border p-3 transition-all hover:shadow-sm group"
                    style={{ borderLeftWidth: '3px', borderLeftColor: meta.color }}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="text-sm font-medium truncate">{comp.name}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                        onClick={() => handleDeleteComponent(comp.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {comp.type && (
                      <span className="text-[10px] font-mono text-muted-foreground">{comp.type}</span>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {/* Status dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setStatusMenu(statusMenu === comp.id ? null : comp.id)}
                          className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                        {statusMenu === comp.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setStatusMenu(null)} />
                            <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
                              {STATUS_ORDER.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(comp.id, s)}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                                  {STATUS_META[s].label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {findingsCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                          <Bug className="h-2.5 w-2.5" />
                          {findingsCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Notes section ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Notes</h2>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Nouvelle note
          </Button>
        </div>

        {/* Create note form */}
        {showNew && (
          <div className="rounded-xl bg-card p-4 mb-4">
            <form onSubmit={handleCreateNote} className="flex items-center gap-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titre de la note..."
                required
                autoFocus
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Créer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewTitle(''); }}>
                Annuler
              </Button>
            </form>
          </div>
        )}

        {/* Notes list */}
        {scope.notes.length === 0 && !showNew ? (
          <div className="rounded-xl bg-card flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Aucune note</p>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première note pour documenter vos observations
            </p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle note
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {scope.notes.map((note: Note) => (
              <div
                key={note.id}
                className="rounded-xl bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}/notes/${note.id}`)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{note.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {note.author.firstName} {note.author.lastName}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

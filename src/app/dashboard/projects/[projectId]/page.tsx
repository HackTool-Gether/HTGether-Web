'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, scopesApi, ApiError } from '@/lib/api';
import type { ProjectDetail, Scope } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Target,
  Users,
  Calendar,
  X,
  Trash2,
} from 'lucide-react';

const SCOPE_STATUS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Non démarré', color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-blue-500/10 text-blue-600' },
  COMPLETED: { label: 'Terminé', color: 'bg-green-500/10 text-green-600' },
  IN_REVIEW: { label: 'En revue', color: 'bg-yellow-500/10 text-yellow-600' },
};

const AUDIT_LABELS: Record<string, string> = {
  WEB: 'Web', INTERNAL_AD: 'Active Directory', LINUX: 'Linux', MOBILE: 'Mobile', OTHER: 'Autre',
};

export default function ProjectDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

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
    try {
      await scopesApi.remove(projectId, scopeId, token);
      load();
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
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Projet introuvable</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push('/dashboard/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Projets
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {AUDIT_LABELS[project.auditType] || project.auditType}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {project.members.length} membre(s)
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(project.startDate).toLocaleDateString('fr-FR')} — {new Date(project.endDate).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>

        {/* Project info */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Client</p>
              <p className="text-sm font-medium">{project.clientCompany}</p>
              <p className="text-xs text-muted-foreground mt-1">{project.clientNeed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Contexte</p>
              <p className="text-sm">{project.context}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scopes section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Scopes</h2>
          <Button size="sm" onClick={() => setShowAddScope(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Ajouter un scope
          </Button>
        </div>

        {showAddScope && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <form onSubmit={handleAddScope} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom du scope</Label>
                    <Input
                      value={scopeForm.name}
                      onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })}
                      placeholder="ex: Application Web, API REST..."
                      required
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description (optionnel)</Label>
                    <Input
                      value={scopeForm.description}
                      onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                      placeholder="Périmètre de test..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddScope(false)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Annuler
                  </Button>
                  <Button type="submit" size="sm" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Ajouter
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {project.scopes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Target className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Aucun scope</p>
              <p className="text-xs text-muted-foreground">Ajoutez un périmètre de test pour commencer</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {project.scopes.map((scope: Scope & { _count?: { notes: number; components: number } }) => {
              const status = SCOPE_STATUS[scope.status] || SCOPE_STATUS.NOT_STARTED;
              return (
                <Card
                  key={scope.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scope.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-sm">{scope.name}</p>
                        {scope.description && (
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {scope._count?.notes || 0} notes
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

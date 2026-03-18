'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, ApiError } from '@/lib/api';
import type { Project, AuditType } from '@/lib/api';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  FolderOpen,
  Loader2,
  AlertCircle,
  Users,
  Target,
  Calendar,
  ArrowRight,
  X,
} from 'lucide-react';

const AUDIT_TYPES: { value: AuditType; label: string }[] = [
  { value: 'WEB', label: 'Web' },
  { value: 'INTERNAL_AD', label: 'Active Directory' },
  { value: 'LINUX', label: 'Linux' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'OTHER', label: 'Autre' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-blue-500/10 text-blue-600' },
  IN_REVIEW: { label: 'En revue', color: 'bg-yellow-500/10 text-yellow-600' },
  DELIVERED: { label: 'Livré', color: 'bg-green-500/10 text-green-600' },
  ARCHIVED: { label: 'Archivé', color: 'bg-muted text-muted-foreground' },
};

export default function ProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientCompany: '',
    clientNeed: '',
    context: '',
    startDate: '',
    endDate: '',
    auditType: 'WEB' as AuditType,
  });

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
      setForm({ name: '', clientCompany: '', clientNeed: '', context: '', startDate: '', endDate: '', auditType: 'WEB' });
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground">Gérez vos audits de sécurité</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create dialog */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Nouveau projet</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du projet</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Audit Web Corp"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input
                    value={form.clientCompany}
                    onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                    placeholder="Nom de l'entreprise cliente"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Besoin du client</Label>
                <Input
                  value={form.clientNeed}
                  onChange={(e) => setForm({ ...form, clientNeed: e.target.value })}
                  placeholder="Test d'intrusion de l'application web..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contexte</Label>
                <Input
                  value={form.context}
                  onChange={(e) => setForm({ ...form, context: e.target.value })}
                  placeholder="Application e-commerce en production..."
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type d&apos;audit</Label>
                  <Select value={form.auditType} onValueChange={(val) => setForm({ ...form, auditType: val as AuditType })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le projet
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Aucun projet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre premier projet pour commencer un audit
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau projet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = STATUS_LABELS[project.status] || STATUS_LABELS.DRAFT;
            const auditLabel = AUDIT_TYPES.find((t) => t.value === project.auditType)?.label || project.auditType;
            return (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <CardDescription>{project.clientCompany}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />
                      {auditLabel}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {project.members.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {project._count?.scopes || 0} scopes
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(project.startDate).toLocaleDateString('fr-FR')} — {new Date(project.endDate).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex justify-end pt-1">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

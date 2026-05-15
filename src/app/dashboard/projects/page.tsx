'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AvatarStack } from '@/components/shell/avatar';
import { useAuth } from '@/lib/auth-context';
import { projectsApi, ApiError, type Project, type AuditType, type ProjectStatus } from '@/lib/api';
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
  Plus, X, Loader2, Search,
  Globe, Server, Terminal, Smartphone, MoreHorizontal,
  Calendar, Building2, FolderOpen,
} from 'lucide-react';

const AUDIT_TYPES: { value: AuditType; label: string; icon: typeof Globe }[] = [
  { value: 'WEB', label: 'Web', icon: Globe },
  { value: 'INTERNAL_AD', label: 'Active Directory', icon: Server },
  { value: 'LINUX', label: 'Linux', icon: Terminal },
  { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
  { value: 'OTHER', label: 'Autre', icon: MoreHorizontal },
];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'cadrage',
  IN_PROGRESS: 'exécution',
  IN_REVIEW: 'revue',
  DELIVERED: 'livré',
  ARCHIVED: 'archivé',
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  DRAFT: 'oklch(0.62 0.01 250)',
  IN_PROGRESS: 'oklch(0.65 0.18 260)',
  IN_REVIEW: 'oklch(0.78 0.16 70)',
  DELIVERED: 'oklch(0.75 0.13 155)',
  ARCHIVED: 'oklch(0.50 0.01 250)',
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
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground text-sm">Gérez vos audits de sécurité</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" /> Nouveau projet
        </Button>
      </div>

      <div className="px-4 sm:px-8">
        {/* Filters + search */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {(['all', 'IN_PROGRESS', 'IN_REVIEW', 'DRAFT', 'DELIVERED', 'ARCHIVED'] as const).map((k) => {
              const isActive = filter === k;
              const label = k === 'all' ? 'Tous' : STATUS_LABEL[k];
              return (
                <Button
                  key={k}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(k)}
                  className="capitalize gap-1.5"
                >
                  {k !== 'all' && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: STATUS_DOT[k] }}
                    />
                  )}
                  {label}
                  <span className="text-xs text-muted-foreground font-mono">
                    {counts[k]}
                  </span>
                </Button>
              );
            })}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[240px]"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl bg-card p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Nouveau projet</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowCreate(false); setError(''); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du projet <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="acme-prod-2026"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="ACME Corp"
                    value={form.clientCompany}
                    onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Besoin client <span className="text-destructive">*</span></Label>
                <textarea
                  placeholder="Test d'intrusion de l'application web…"
                  value={form.clientNeed}
                  onChange={(e) => setForm({ ...form, clientNeed: e.target.value })}
                  required
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label>Contexte <span className="text-destructive">*</span></Label>
                <textarea
                  placeholder="Application e-commerce en production…"
                  value={form.context}
                  onChange={(e) => setForm({ ...form, context: e.target.value })}
                  required
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Début <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type d&apos;audit <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.auditType}
                    onValueChange={(v) => setForm({ ...form, auditType: v as AuditType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setError(''); }}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le projet
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-card p-16 text-center">
            <div className="rounded-full bg-secondary p-4 mb-4 inline-flex">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">
              {projects.length === 0 ? 'Aucun projet' : 'Aucun résultat'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {projects.length === 0
                ? 'Créez votre premier audit pour démarrer.'
                : 'Aucun projet ne correspond à votre recherche.'}
            </p>
            {projects.length === 0 && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="mr-1 h-3 w-3" /> Nouveau projet
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-card overflow-hidden">
            {/* Column headers */}
            <div
              className="cap grid gap-3 px-4 py-2 text-[10.5px]"
              style={{ gridTemplateColumns: '1fr 130px 100px 110px 80px 90px' }}
            >
              <div>Projet</div>
              <div>Client</div>
              <div>Type</div>
              <div>Statut</div>
              <div>Équipe</div>
              <div className="text-right">Échéance</div>
            </div>

            {/* Rows */}
            {filtered.map((p) => {
                const audit = AUDIT_TYPES.find((t) => t.value === p.auditType);
                const AuditIcon = audit?.icon || MoreHorizontal;
                const due = relativeDate(p.endDate);
                const team = (p.members || []).map((m) => ({
                  id: m.user.id,
                  name: `${m.user.firstName} ${m.user.lastName}`,
                }));
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                    className="grid gap-3 px-4 py-3 items-center cursor-pointer transition-colors text-sm"
                    style={{
                      gridTemplateColumns: '1fr 130px 100px 110px 80px 90px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                    }}
                  >
                    {/* Project name + need */}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.clientNeed}
                      </div>
                    </div>

                    {/* Client */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {p.clientCompany}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AuditIcon className="h-3 w-3" />
                      {audit?.label || p.auditType}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: STATUS_DOT[p.status] }}
                      />
                      <span className="capitalize">{STATUS_LABEL[p.status]}</span>
                    </div>

                    {/* Team */}
                    <div>
                      {team.length > 0 && <AvatarStack users={team} max={3} />}
                    </div>

                    {/* Due date */}
                    <div
                      className={`font-mono text-[11px] text-right ${
                        due.overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {due.label}
                    </div>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

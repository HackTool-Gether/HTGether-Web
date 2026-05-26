'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  projectsApi,
  findingsApi,
  ApiError,
  type Finding,
  type Severity,
  type FindingStatus,
  type ProjectDetail,
} from '@/lib/api';
import { Plus, ArrowLeft, Loader2, X } from 'lucide-react';

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
  const [authorFilter, setAuthorFilter] = useState<string>('all');
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
      setSelected((prev) => prev ?? (finds.length > 0 ? finds[0].id : null));
    } catch {
      setError('Impossible de charger les findings');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

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
      router.push(`/dashboard/projects/${projectId}/findings/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const authors = Array.from(
    new Map(findings.filter((f) => f.author).map((f) => [f.author!.id, f.author!])).values()
  );

  const filtered = findings.filter((f) => {
    if (sev !== 'all' && f.severity !== sev) return false;
    if (authorFilter !== 'all' && f.author?.id !== authorFilter) return false;
    return true;
  });
  const cur = findings.find((f) => f.id === selected) || null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
        <div>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground mb-1" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
            <ArrowLeft className="h-3 w-3 mr-1" />
            {project?.name || '…'}
          </Button>
          <h1 className="text-2xl font-bold">
            Findings
            <span className="ml-2 text-base font-normal text-muted-foreground font-mono">{findings.length}</span>
          </h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" /> Nouveau finding
        </Button>
      </div>

      <div className="px-4 sm:px-8">
        {/* Severity filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {(
              [
                { k: 'all' as const, label: 'Toutes', c: '' },
                ...SEVERITY_ORDER.map((s) => ({
                  k: s,
                  label: s.charAt(0) + s.slice(1).toLowerCase(),
                  c: `var(--sev-${s.toLowerCase()}-fg)`,
                })),
              ]
            ).map((f) => {
              const active = sev === f.k;
              const n = f.k === 'all' ? findings.length : findings.filter((fd) => fd.severity === f.k).length;
              return (
                <Button
                  key={f.k}
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSev(f.k)}
                  className="gap-1.5"
                >
                  {f.k !== 'all' && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: f.c }}
                    />
                  )}
                  {f.label}
                  <span className="text-xs text-muted-foreground font-mono">{n}</span>
                </Button>
              );
            })}
          </div>

          <Select value={authorFilter} onValueChange={(v) => setAuthorFilter(v ?? 'all')}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Tous les membres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les membres</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl bg-card p-3 mb-4">
            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <Input
                placeholder="Titre du finding (ex: SQLi sur /api/v2/login)"
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="flex-1 h-8 text-sm"
              />
              <Select
                value={form.severity}
                onValueChange={(v) => setForm({ ...form, severity: v as Severity })}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={creating}>
                {creating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Créer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                <X className="h-3 w-3" />
              </Button>
            </form>
          </div>
        )}

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground">
            {findings.length === 0
              ? 'Aucun finding pour ce projet. Créez-en un pour commencer.'
              : 'Aucun finding ne correspond au filtre.'}
          </div>
        ) : (
          <div className="flex gap-0 min-h-0">
            {/* Table */}
            <div className="flex-1 min-w-0 rounded-xl bg-card overflow-hidden">
              {/* Column headers */}
              <div
                className="cap grid gap-3 px-4 py-2 text-[10.5px]"
                style={{ gridTemplateColumns: '100px 80px 1fr 60px 100px 110px 80px' }}
              >
                <div>ID</div>
                <div>Sévérité</div>
                <div>Titre</div>
                <div className="text-right">CVSS</div>
                <div>Statut</div>
                <div>Owner</div>
                <div className="text-right">Maj</div>
              </div>

              {/* Rows */}
              {filtered.map((f) => {
                const active = f.id === selected;
                const sevLow = f.severity.toLowerCase();
                const owner = f.author
                  ? { id: f.author.id, name: `${f.author.firstName} ${f.author.lastName}` }
                  : null;
                return (
                  <div
                    key={f.id}
                    onClick={() => router.push(`/dashboard/projects/${projectId}/findings/${f.id}`)}
                    className="grid gap-3 px-4 py-2.5 items-center cursor-pointer transition-colors relative text-sm"
                    style={{
                      gridTemplateColumns: '100px 80px 1fr 60px 100px 110px 80px',
                      background: active ? 'var(--bg-subtle)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = '';
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                        style={{ background: `var(--sev-${sevLow}-fg)` }}
                      />
                    )}
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {f.slug || f.id.slice(0, 8)}
                    </span>
                    <span className={`badge badge-${sevLow}`}>{sevLow}</span>
                    <div className="truncate">{f.title}</div>
                    <div
                      className="font-mono text-xs text-right"
                      style={{
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
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: STATUS_DOT[f.status] }}
                      />
                      {STATUS_LABEL[f.status]}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {owner && <Avatar user={owner} />}
                      <span className="text-xs text-muted-foreground truncate">
                        {owner ? owner.name.split(' ')[0] : ''}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground text-right">
                      {relativeTime(f.updatedAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Side panel */}
            <aside className="w-[320px] shrink-0 rounded-xl bg-card overflow-auto hidden lg:block ml-4">
              {!cur ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Sélectionnez un finding pour voir le détail.
                </div>
              ) : (
                <>
                  <div className="p-5">
                    <div className="font-mono text-[11px] text-muted-foreground mb-1.5">
                      {cur.slug || cur.id.slice(0, 8)}
                    </div>
                    <div className="text-[15px] font-semibold leading-snug mb-3">
                      {cur.title}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
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
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => router.push(`/dashboard/projects/${projectId}/findings/${cur.id}`)}
                    >
                      Ouvrir l&apos;éditeur
                    </Button>
                  </div>

                  {cur.cvssVector && (
                    <div className="px-5 pb-4">
                      <div className="cap text-[10.5px] mb-2">Vecteur CVSS</div>
                      <div className="font-mono text-[11px] text-muted-foreground p-2 bg-secondary rounded-md break-all select-all">
                        {cur.cvssVector}
                      </div>
                    </div>
                  )}

                  <div className="px-5 pb-5">
                    <div className="cap text-[10.5px] mb-2">Métadonnées</div>
                    {[
                      ['Auteur', cur.author ? `${cur.author.firstName} ${cur.author.lastName}` : '—', false],
                      ['Créé', new Date(cur.createdAt).toLocaleDateString('fr-FR'), true],
                      ['Maj', relativeTime(cur.updatedAt), true],
                    ].map(([k, v, mono]) => (
                      <div key={k as string} className="flex justify-between items-center py-1 text-xs">
                        <span className="text-muted-foreground">{k as string}</span>
                        <span className={mono ? 'font-mono' : ''}>{v as string}</span>
                      </div>
                    ))}
                    {cur.tags && (
                      <div className="flex gap-1.5 flex-wrap mt-2.5">
                        {cur.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className="text-[11px] px-2 py-0.5 bg-secondary rounded-sm text-muted-foreground">
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
        )}
      </div>
    </div>
  );
}

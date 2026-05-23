'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  workloadApi, ApiError,
  type WorkloadData, type WorkloadMember, type WorkloadScope, type ScopeStatus,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, User } from 'lucide-react';

const SCOPE_STATUS_LABEL: Record<ScopeStatus, string> = {
  NOT_STARTED: 'Non démarré',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  IN_REVIEW: 'En revue',
};

const SCOPE_STATUS_COLOR: Record<ScopeStatus, string> = {
  NOT_STARTED: 'var(--muted-foreground)',
  IN_PROGRESS: 'oklch(0.65 0.15 250)',
  COMPLETED: 'oklch(0.60 0.15 145)',
  IN_REVIEW: 'oklch(0.75 0.15 80)',
};

function workloadLevel(total: number): { label: string; color: string } {
  if (total === 0) return { label: 'Libre', color: 'var(--muted-foreground)' };
  if (total <= 3) return { label: 'Normal', color: 'oklch(0.60 0.15 145)' };
  if (total <= 6) return { label: 'Chargé', color: 'oklch(0.75 0.15 80)' };
  return { label: 'Surchargé', color: 'oklch(0.65 0.2 25)' };
}

export default function WorkloadPage() {
  const { token, user } = useAuth();
  const params = useParams();
  const projectId = params.projectId as string;

  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const isManager = user?.role === 'SUPER_ADMIN'; // will also check project membership below

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await workloadApi.get(projectId, token);
      setData(d);
    } catch {
      setError('Impossible de charger les attributions');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (scopeId: string, memberId: string, assigned: boolean) => {
    if (!token) return;
    const key = `${scopeId}:${memberId}`;
    setToggling(key);
    try {
      if (assigned) {
        await workloadApi.unassignScope(projectId, scopeId, memberId, token);
      } else {
        await workloadApi.assignScope(projectId, scopeId, memberId, token);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
        <p className="text-sm text-destructive">Données non disponibles.</p>
      </div>
    );
  }

  const unassignedCount = data.scopes.filter((s) => s.unassigned).length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Attribution des tâches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Répartition du travail par scope et par membre
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Alerts */}
        {unassignedCount > 0 && (
          <div className="mb-4 rounded-xl border p-3 flex items-center gap-2"
            style={{ borderColor: 'oklch(0.75 0.15 80 / 0.3)', background: 'oklch(0.75 0.15 80 / 0.05)' }}>
            <AlertTriangle size={14} style={{ color: 'oklch(0.65 0.15 80)' }} />
            <span className="text-xs">
              {unassignedCount} périmètre{unassignedCount > 1 ? 's' : ''} non assigné{unassignedCount > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Member workload cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {data.members.map((m) => {
            const level = workloadLevel(m.tasks.total);
            const pct = m.tasks.total ? Math.round((m.tasks.done / m.tasks.total) * 100) : 0;
            return (
              <div key={m.memberId} className="rounded-xl bg-card border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                    {m.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{m.role.toLowerCase()}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono">{m.tasks.done}/{m.tasks.total} tâches</span>
                  <span className="font-mono font-semibold" style={{ color: level.color }}>{level.label}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                </div>
                <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground font-mono">
                  <span>{m.tasks.inProgress} en cours</span>
                  <span>{m.tasks.todo} à faire</span>
                  <span>{m.tasks.backlog} backlog</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Matrix */}
        {data.scopes.length > 0 && data.members.length > 0 && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Matrice scope × membre</span>
              <span className="text-xs text-muted-foreground ml-2">
                Cliquez pour assigner/retirer un membre d&apos;un périmètre
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[180px]">
                      Périmètre
                    </th>
                    {data.members.map((m) => (
                      <th key={m.memberId} className="p-3 text-center font-medium text-muted-foreground min-w-[100px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="truncate max-w-[90px]">{m.name.split(' ')[0]}</span>
                          <span className="text-[9px] font-mono opacity-60">{m.role.toLowerCase()}</span>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-center font-medium text-muted-foreground min-w-[80px]">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scopes.map((scope) => (
                    <ScopeRow
                      key={scope.scopeId}
                      scope={scope}
                      members={data.members}
                      projectId={projectId}
                      toggling={toggling}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.scopes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun périmètre dans ce projet.
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeRow({ scope, members, projectId, toggling, onToggle }: {
  scope: WorkloadScope;
  members: WorkloadMember[];
  projectId: string;
  toggling: string | null;
  onToggle: (scopeId: string, memberId: string, assigned: boolean) => void;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="p-3 sticky left-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <span className="font-medium">{scope.name}</span>
          {scope.unassigned && (
            <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
              style={{ background: 'oklch(0.75 0.15 80 / 0.15)', color: 'oklch(0.65 0.15 80)' }}>
              non assigné
            </span>
          )}
        </div>
      </td>
      {members.map((m) => {
        const assigned = scope.assignedMembers.includes(m.memberId);
        const key = `${scope.scopeId}:${m.memberId}`;
        const isToggling = toggling === key;
        return (
          <td key={m.memberId} className="p-3 text-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mx-auto"
              disabled={isToggling}
              onClick={() => onToggle(scope.scopeId, m.memberId, assigned)}
              style={{
                background: assigned ? 'oklch(0.60 0.15 145 / 0.15)' : 'transparent',
                color: assigned ? 'oklch(0.55 0.15 145)' : 'var(--muted-foreground)',
                border: assigned ? '1px solid oklch(0.60 0.15 145 / 0.3)' : '1px solid var(--border)',
              }}
            >
              {isToggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : assigned ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5 opacity-30" />
              )}
            </Button>
          </td>
        );
      })}
      <td className="p-3 text-center">
        <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: `color-mix(in oklch, ${SCOPE_STATUS_COLOR[scope.status]} 12%, transparent)`,
            color: SCOPE_STATUS_COLOR[scope.status],
          }}>
          {SCOPE_STATUS_LABEL[scope.status]}
        </span>
      </td>
    </tr>
  );
}

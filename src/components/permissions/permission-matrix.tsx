'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { projectsApi, type ProjectRole, type PermissionsResponse } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const PERMISSION_LABELS: Record<string, string> = {
  'tasks.create': 'Créer des tâches',
  'tasks.move': 'Déplacer des tâches',
  'tasks.delete': 'Supprimer des tâches',
  'findings.create': 'Créer des findings',
  'findings.edit': 'Modifier des findings',
  'findings.delete': 'Supprimer des findings',
  'scopes.create': 'Créer des périmètres',
  'scopes.edit': 'Modifier des périmètres',
  'members.manage': 'Gérer les membres',
  'report.edit': 'Modifier le rapport',
};

const EDITABLE_ROLES: ProjectRole[] = ['PENTESTER', 'CLIENT'];

interface PermissionMatrixProps {
  projectId: string;
  token: string;
}

export function PermissionMatrix({ projectId, token }: PermissionMatrixProps) {
  const [data, setData] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await projectsApi.getPermissions(projectId, token);
      setData(resp);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getEffective = (role: ProjectRole, key: string): boolean => {
    const overrideVal = data.overrides?.[role]?.[key];
    if (overrideVal !== undefined) return overrideVal;
    return data.defaults[role]?.[key] ?? false;
  };

  const handleToggle = async (role: ProjectRole, key: string, checked: boolean) => {
    const defaultVal = data.defaults[role]?.[key] ?? false;
    const newOverrides = { ...data.overrides };

    if (checked === defaultVal) {
      // Remove override — back to default
      if (newOverrides[role]) {
        delete newOverrides[role][key];
        if (Object.keys(newOverrides[role]).length === 0) {
          delete newOverrides[role];
        }
      }
    } else {
      if (!newOverrides[role]) newOverrides[role] = {};
      newOverrides[role][key] = checked;
    }

    setData({ ...data, overrides: newOverrides });
    setSaving(true);
    try {
      await projectsApi.updatePermissions(projectId, newOverrides, token);
    } catch {
      // revert
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">Permissions</h3>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid gap-3 px-4 py-2 bg-secondary/50" style={{ gridTemplateColumns: '1fr 100px 100px 100px' }}>
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider">Permission</div>
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider text-center">Manager</div>
          {EDITABLE_ROLES.map((r) => (
            <div key={r} className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider text-center">
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </div>
          ))}
        </div>

        {/* Rows */}
        {data.keys.map((key) => (
          <div
            key={key}
            className="grid gap-3 px-4 py-2.5 items-center border-t border-border"
            style={{ gridTemplateColumns: '1fr 100px 100px 100px' }}
          >
            <span className="text-sm">{PERMISSION_LABELS[key] || key}</span>
            <div className="flex justify-center">
              <Switch checked={true} disabled />
            </div>
            {EDITABLE_ROLES.map((role) => (
              <div key={role} className="flex justify-center">
                <Switch
                  checked={getEffective(role, key)}
                  onCheckedChange={(checked: boolean) => handleToggle(role, key, checked)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templatesApi, ApiError, type ReportTemplate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Copy, Trash2, FileText, Star } from 'lucide-react';

export default function TemplatesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await templatesApi.getAll(token);
      setTemplates(data);
    } catch {
      setError('Impossible de charger les templates');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const t = await templatesApi.create({ name: 'Nouveau template' }, token);
      router.push(`/dashboard/templates/${t.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!token) return;
    try {
      await templatesApi.duplicate(id, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await templatesApi.remove(id, token);
      await load();
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Templates de rapport</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les modèles HTML utilisés pour générer les rapports PDF
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Nouveau template
        </Button>
      </div>

      <div className="px-4 sm:px-8 space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">Aucun template</p>
            <p className="text-xs mt-1 opacity-60">Créez votre premier template de rapport</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-card border border-border p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors cursor-pointer group"
                onClick={() => router.push(`/dashboard/templates/${t.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.1) c h))',
                        color: 'white',
                      }}
                    >
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {t.name}
                        {t.isDefault && <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">
                      {t._count?.projects || 0} projet{(t._count?.projects || 0) > 1 ? 's' : ''}
                    </span>
                    <span className="font-mono">
                      {(t.variables as any[])?.length || 0} variable{((t.variables as any[])?.length || 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(t.id); }}
                      title="Dupliquer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

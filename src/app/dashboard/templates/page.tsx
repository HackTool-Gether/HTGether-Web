'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templatesApi, ApiError, type ReportTemplate, type LibraryTemplate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Loader2, Plus, Copy, Trash2, FileText, Star, Library, Download, X,
  Shield, Monitor, Globe, Smartphone, Search, Cpu, Cloud, Wifi, Users,
  Code2, Upload,
} from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  web: { label: 'Web', icon: Globe, color: 'oklch(0.65 0.15 250)' },
  ad: { label: 'Active Directory', icon: Shield, color: 'oklch(0.55 0.15 300)' },
  linux: { label: 'Linux', icon: Monitor, color: 'oklch(0.60 0.15 145)' },
  mobile: { label: 'Mobile', icon: Smartphone, color: 'oklch(0.65 0.15 30)' },
  recon: { label: 'Reconnaissance', icon: Search, color: 'oklch(0.60 0.12 60)' },
  hardware: { label: 'Hardware / IoT', icon: Cpu, color: 'oklch(0.58 0.14 180)' },
  api: { label: 'API', icon: Code2, color: 'oklch(0.62 0.16 270)' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'oklch(0.60 0.13 220)' },
  wifi: { label: 'Wi-Fi', icon: Wifi, color: 'oklch(0.58 0.15 340)' },
  social: { label: 'Social Engineering', icon: Users, color: 'oklch(0.55 0.12 20)' },
};

export default function TemplatesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<LibraryTemplate[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [importingJson, setImportingJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openLibrary = async () => {
    setShowLibrary(true);
    setCategoryFilter(null);
    if (library.length > 0) return;
    if (!token) return;
    setLoadingLibrary(true);
    try {
      const data = await templatesApi.getLibrary(token);
      setLibrary(data);
    } catch {
      setError('Impossible de charger la bibliothèque');
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleImport = async (slug: string) => {
    if (!token) return;
    setImporting(slug);
    try {
      const t = await templatesApi.importFromLibrary(slug, token);
      await load();
      setShowLibrary(false);
      router.push(`/dashboard/templates/${t.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de l\'import');
    } finally {
      setImporting(null);
    }
  };

  // Import a template from a JSON file (round-trips with the export button).
  const handleImportJson = async (file: File) => {
    if (!token) return;
    setImportingJson(true);
    setError('');
    try {
      const raw = JSON.parse(await file.text());
      // Accept either a bare template object or an { template: {...} } wrapper.
      const tpl = raw?.template ?? raw;
      if (!tpl || typeof tpl.name !== 'string' || !tpl.name.trim()) {
        throw new Error('Fichier JSON invalide : champ « name » manquant');
      }
      const created = await templatesApi.create(
        {
          name: tpl.name,
          description: typeof tpl.description === 'string' ? tpl.description : undefined,
          htmlContent: typeof tpl.htmlContent === 'string' ? tpl.htmlContent : undefined,
          cssContent: typeof tpl.cssContent === 'string' ? tpl.cssContent : undefined,
          variables: Array.isArray(tpl.variables) ? tpl.variables : undefined,
        },
        token,
      );
      await load();
      router.push(`/dashboard/templates/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur lors de l'import JSON",
      );
    } finally {
      setImportingJson(false);
    }
  };

  // Export a template (full content) to a downloadable JSON file.
  const handleExportJson = async (id: string, name: string) => {
    if (!token) return;
    try {
      const tpl = await templatesApi.getOne(id, token);
      const payload = {
        format: 'htgether-template',
        version: 1,
        template: {
          name: tpl.name,
          description: tpl.description,
          htmlContent: tpl.htmlContent,
          cssContent: tpl.cssContent,
          variables: tpl.variables,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (name || 'template')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
      a.href = url;
      a.download = `${base || 'template'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de export');
    }
  };

  const filteredLibrary = categoryFilter
    ? library.filter((e) => e.category === categoryFilter)
    : library;

  const categories = Array.from(new Set(library.map((e) => e.category)));

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
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportJson(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importingJson}
          >
            {importingJson ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            Importer JSON
          </Button>
          <Button variant="secondary" onClick={openLibrary}>
            <Library className="mr-1.5 h-3.5 w-3.5" />
            Bibliothèque
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Nouveau template
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-8 space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Library modal */}
        {showLibrary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLibrary(false)}>
            <div
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden mx-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">Bibliothèque de templates</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {library.length} templates méthodologiques pré-configurés
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLibrary(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Category filters */}
              {!loadingLibrary && categories.length > 0 && (
                <div className="flex items-center gap-1.5 px-5 pt-4 pb-2 flex-wrap flex-shrink-0">
                  <button
                    className="text-xs px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      background: !categoryFilter ? 'var(--accent)' : 'var(--muted)',
                      color: !categoryFilter ? 'white' : 'var(--muted-foreground)',
                    }}
                    onClick={() => setCategoryFilter(null)}
                  >
                    Tous
                  </button>
                  {categories.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        className="text-xs px-2.5 py-1 rounded-full transition-colors"
                        style={{
                          background: active ? meta?.color || 'var(--accent)' : 'var(--muted)',
                          color: active ? 'white' : 'var(--muted-foreground)',
                        }}
                        onClick={() => setCategoryFilter(active ? null : cat)}
                      >
                        {meta?.label || cat}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="overflow-auto flex-1 p-5">
                {loadingLibrary ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredLibrary.map((entry) => {
                      const meta = CATEGORY_META[entry.category] || { label: entry.category, icon: FileText, color: 'var(--accent)' };
                      const Icon = meta.icon;
                      const isImporting = importing === entry.slug;
                      return (
                        <div
                          key={entry.slug}
                          className="rounded-xl border border-border p-4 flex flex-col gap-3 transition-all cursor-pointer hover:bg-muted/50"
                          onClick={() => !importing && handleImport(entry.slug)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `color-mix(in oklch, ${meta.color} 15%, transparent)`, color: meta.color }}
                            >
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold">{entry.name}</div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: `color-mix(in oklch, ${meta.color} 12%, transparent)`, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              {isImporting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              {isImporting ? 'Import…' : 'Importer'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">Aucun template</p>
            <p className="text-xs mt-1 opacity-60">Créez votre premier template de rapport</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={openLibrary}>
              <Library className="mr-1.5 h-3.5 w-3.5" />
              Importer depuis la bibliothèque
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-card border border-border p-4 flex flex-col gap-3 cursor-pointer group transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/dashboard/templates/${t.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
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
                      onClick={(e) => { e.stopPropagation(); handleExportJson(t.id, t.name); }}
                      title="Exporter en JSON"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
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

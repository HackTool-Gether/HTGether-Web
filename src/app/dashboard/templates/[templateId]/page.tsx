'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templatesApi, ApiError, type ReportTemplate, type TemplateVariable } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, ArrowLeft, Save, Eye, EyeOff, Code, Palette, Variable,
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight, HelpCircle,
} from 'lucide-react';

type EditorTab = 'html' | 'css' | 'variables';

const VARIABLE_TYPES = [
  { value: 'string', label: 'Texte' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Nombre' },
  { value: 'boolean', label: 'Booléen' },
  { value: 'enum', label: 'Liste de choix' },
  { value: 'image', label: 'Image' },
];

const AUTO_VARIABLES = [
  { id: 'project_name', label: 'Nom du projet', type: 'string' },
  { id: 'client_company', label: 'Entreprise cliente', type: 'string' },
  { id: 'client_need', label: 'Besoin client', type: 'string' },
  { id: 'project_context', label: 'Contexte du projet', type: 'string' },
  { id: 'start_date', label: 'Date de début', type: 'date' },
  { id: 'end_date', label: 'Date de fin', type: 'date' },
  { id: 'audit_type', label: 'Type d\'audit', type: 'string' },
  { id: 'findings_total', label: 'Total findings', type: 'number' },
  { id: 'findings_critical', label: 'Findings critiques', type: 'number' },
  { id: 'findings_high', label: 'Findings élevés', type: 'number' },
  { id: 'findings_medium', label: 'Findings moyens', type: 'number' },
  { id: 'findings_low', label: 'Findings faibles', type: 'number' },
  { id: 'findings_info', label: 'Findings info', type: 'number' },
];

const LOOP_VARIABLES = [
  { id: 'findings', label: 'Liste des findings', hint: '{{#each findings}}...{{/each}}' },
  { id: 'members', label: 'Membres du projet', hint: '{{#each members}}...{{/each}}' },
  { id: 'pentesters', label: 'Pentesters uniquement', hint: '{{#each pentesters}}...{{/each}}' },
  { id: 'scopes', label: 'Périmètres', hint: '{{#each scopes}}...{{/each}}' },
  { id: 'sections', label: 'Sections du rapport', hint: '{{#each sections}}...{{/each}}' },
];

export default function TemplateDesignerPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;
  const { token } = useAuth();

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [cssContent, setCssContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [showPreview, setShowPreview] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [expandedVarId, setExpandedVarId] = useState<string | null>(null);
  const [showAutoVars, setShowAutoVars] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const cssRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await templatesApi.getOne(templateId, token);
      setTemplate(data);
      setName(data.name);
      setDescription(data.description);
      setHtmlContent(data.htmlContent);
      setCssContent(data.cssContent);
      setVariables(data.variables || []);
      setIsDefault(data.isDefault);
    } catch {
      setError('Template introuvable');
    } finally {
      setLoading(false);
    }
  }, [token, templateId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (!token || !template) return;
    setSaving(true);
    setError('');
    try {
      const updated = await templatesApi.update(templateId, {
        name, description, htmlContent, cssContent, variables, isDefault,
      }, token);
      setTemplate(updated);
      setDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [token, template, templateId, name, description, htmlContent, cssContent, variables, isDefault]);

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);

  const loadPreview = useCallback(async () => {
    if (!token || !dirty) return;
    await handleSave();
  }, [token, dirty, handleSave]);

  const refreshPreview = useCallback(async () => {
    if (!token) return;
    setPreviewLoading(true);
    try {
      if (dirty) {
        await templatesApi.update(templateId, {
          name, description, htmlContent, cssContent, variables, isDefault,
        }, token);
        setDirty(false);
      }
      const result = await templatesApi.preview(templateId, token);
      const fullHtml = `<!DOCTYPE html><html><head><style>${result.css}</style></head><body>${result.html}</body></html>`;
      setPreviewHtml(fullHtml);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [token, templateId, dirty, name, description, htmlContent, cssContent, variables, isDefault]);

  useEffect(() => {
    if (template && !previewHtml) {
      refreshPreview();
    }
  }, [template]);

  useEffect(() => {
    if (!dirty) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      refreshPreview();
    }, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [htmlContent, cssContent, dirty]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave().then(() => refreshPreview());
    }
  }, [handleSave, refreshPreview]);

  const addVariable = () => {
    const newVar: TemplateVariable = {
      id: `var_${Date.now()}`,
      label: 'Nouvelle variable',
      type: 'string',
    };
    setVariables((prev) => [...prev, newVar]);
    setExpandedVarId(newVar.id);
    markDirty();
  };

  const updateVariable = (id: string, updates: Partial<TemplateVariable>) => {
    setVariables((prev) => prev.map((v) => v.id === id ? { ...v, ...updates } : v));
    markDirty();
  };

  const removeVariable = (id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
    if (expandedVarId === id) setExpandedVarId(null);
    markDirty();
  };

  const insertVariable = (varId: string) => {
    const ref = activeTab === 'html' ? htmlRef.current : cssRef.current;
    if (!ref) return;
    const tag = `{{${varId}}}`;
    const start = ref.selectionStart;
    const end = ref.selectionEnd;
    const setter = activeTab === 'html' ? setHtmlContent : setCssContent;
    const current = activeTab === 'html' ? htmlContent : cssContent;
    setter(current.substring(0, start) + tag + current.substring(end));
    markDirty();
    setTimeout(() => {
      ref.focus();
      ref.selectionStart = ref.selectionEnd = start + tag.length;
    }, 0);
  };

  const handleTabInput = (e: React.KeyboardEvent<HTMLTextAreaElement>, setter: (v: string) => void, value: string) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      setter(value.substring(0, start) + '  ' + value.substring(end));
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/templates')}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => router.push('/dashboard/templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <input
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-0"
          placeholder="Nom du template"
        />

        <input
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty(); }}
          className="text-xs text-muted-foreground bg-transparent border-none outline-none w-60 hidden sm:block"
          placeholder="Description…"
        />

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Switch
              size="sm"
              checked={isDefault}
              onCheckedChange={(checked: boolean) => { setIsDefault(checked); markDirty(); }}
            />
            Par défaut
          </label>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Masquer' : 'Aperçu'}
          </Button>

          {dirty && (
            <span className="text-[10px] text-amber-500 font-medium">Modifié</span>
          )}

          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => handleSave().then(() => refreshPreview())}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 px-2 pt-2 flex-shrink-0">
            {([
              { key: 'html' as const, icon: Code, label: 'HTML' },
              { key: 'css' as const, icon: Palette, label: 'CSS' },
              { key: 'variables' as const, icon: Variable, label: 'Variables' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md border border-b-0 transition-colors ${
                  activeTab === key
                    ? 'bg-card text-foreground border-border'
                    : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Editor content */}
          <div className="flex-1 overflow-hidden border-t border-border">
            {activeTab === 'html' && (
              <textarea
                ref={htmlRef}
                value={htmlContent}
                onChange={(e) => { setHtmlContent(e.target.value); markDirty(); }}
                onKeyDown={(e) => handleTabInput(e, setHtmlContent, htmlContent)}
                className="w-full h-full resize-none bg-card p-4 text-xs leading-relaxed outline-none font-mono"
                spellCheck={false}
                placeholder="<!-- Écrivez votre template HTML ici -->
<!-- Utilisez {{variable}} pour insérer des variables -->
<!-- Utilisez {{#each findings}}...{{/each}} pour les boucles -->"
              />
            )}

            {activeTab === 'css' && (
              <textarea
                ref={cssRef}
                value={cssContent}
                onChange={(e) => { setCssContent(e.target.value); markDirty(); }}
                onKeyDown={(e) => handleTabInput(e, setCssContent, cssContent)}
                className="w-full h-full resize-none bg-card p-4 text-xs leading-relaxed outline-none font-mono"
                spellCheck={false}
                placeholder="/* Styles CSS du rapport */
/* Utilisez @page pour les règles d'impression PDF */
@page {
  size: A4;
  margin: 20mm;
}"
              />
            )}

            {activeTab === 'variables' && (
              <div className="h-full overflow-auto p-4 space-y-4">
                {/* Auto variables reference */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setShowAutoVars(!showAutoVars)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    {showAutoVars ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <HelpCircle className="h-3.5 w-3.5" />
                    Variables automatiques (projet)
                    <span className="ml-auto text-[10px] opacity-60">Remplies automatiquement depuis les données du projet</span>
                  </button>
                  {showAutoVars && (
                    <div className="border-t border-border">
                      <div className="divide-y divide-border/50">
                        {AUTO_VARIABLES.map((v) => (
                          <div key={v.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/30 transition-colors group">
                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-accent min-w-[140px]">
                              {'{{' + v.id + '}}'}
                            </code>
                            <span className="text-muted-foreground flex-1">{v.label}</span>
                            <button
                              onClick={() => insertVariable(v.id)}
                              className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                            >
                              Insérer
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-muted/30 border-t border-border">
                        <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Boucles disponibles</p>
                        <div className="space-y-1">
                          {LOOP_VARIABLES.map((v) => (
                            <div key={v.id} className="flex items-center gap-3 text-xs">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-accent">
                                {v.hint}
                              </code>
                              <span className="text-muted-foreground">{v.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom variables */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-medium">Variables personnalisées</h3>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={addVariable}>
                      <Plus className="h-3 w-3" /> Ajouter
                    </Button>
                  </div>

                  {variables.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Variable className="h-8 w-8 opacity-20 mb-2" />
                      <p className="text-xs">Aucune variable personnalisée</p>
                      <p className="text-[10px] opacity-60 mt-0.5">Les variables permettent de personnaliser le rapport par projet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {variables.map((v) => (
                        <div key={v.id} className="rounded-lg border border-border overflow-hidden">
                          <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedVarId(expandedVarId === v.id ? null : v.id)}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                            {expandedVarId === v.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            <code className="text-[11px] font-mono text-accent bg-muted px-1.5 py-0.5 rounded">
                              {'{{' + v.id + '}}'}
                            </code>
                            <span className="text-xs flex-1 truncate">{v.label}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {VARIABLE_TYPES.find((t) => t.value === v.type)?.label || v.type}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeVariable(v.id); }}
                              className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {expandedVarId === v.id && (
                            <div className="border-t border-border p-3 bg-muted/20 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Identifiant</label>
                                  <Input
                                    value={v.id}
                                    onChange={(e) => updateVariable(v.id, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
                                    className="h-7 text-xs font-mono"
                                    placeholder="nom_variable"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Label</label>
                                  <Input
                                    value={v.label}
                                    onChange={(e) => updateVariable(v.id, { label: e.target.value })}
                                    className="h-7 text-xs"
                                    placeholder="Nom affiché"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Type</label>
                                  <select
                                    value={v.type}
                                    onChange={(e) => updateVariable(v.id, { type: e.target.value as TemplateVariable['type'] })}
                                    className="h-7 w-full text-xs rounded-lg border border-input bg-transparent px-2 outline-none focus:border-ring"
                                  >
                                    {VARIABLE_TYPES.map((t) => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Catégorie</label>
                                  <Input
                                    value={v.category || ''}
                                    onChange={(e) => updateVariable(v.id, { category: e.target.value })}
                                    className="h-7 text-xs"
                                    placeholder="Général"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Valeur par défaut</label>
                                  <Input
                                    value={v.defaultValue ?? ''}
                                    onChange={(e) => updateVariable(v.id, { defaultValue: e.target.value })}
                                    className="h-7 text-xs"
                                    placeholder="—"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Texte d&apos;aide</label>
                                  <Input
                                    value={v.helpText || ''}
                                    onChange={(e) => updateVariable(v.id, { helpText: e.target.value })}
                                    className="h-7 text-xs"
                                    placeholder="Aide pour l'utilisateur"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                  <Switch
                                    size="sm"
                                    checked={v.required || false}
                                    onCheckedChange={(checked: boolean) => updateVariable(v.id, { required: checked })}
                                  />
                                  Obligatoire
                                </label>
                              </div>

                              {v.type === 'enum' && (
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Options</label>
                                  <div className="space-y-1.5">
                                    {(v.options || []).map((opt, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <Input
                                          value={opt.value}
                                          onChange={(e) => {
                                            const opts = [...(v.options || [])];
                                            opts[i] = { ...opts[i], value: e.target.value };
                                            updateVariable(v.id, { options: opts });
                                          }}
                                          className="h-7 text-xs font-mono flex-1"
                                          placeholder="valeur"
                                        />
                                        <Input
                                          value={opt.label}
                                          onChange={(e) => {
                                            const opts = [...(v.options || [])];
                                            opts[i] = { ...opts[i], label: e.target.value };
                                            updateVariable(v.id, { options: opts });
                                          }}
                                          className="h-7 text-xs flex-1"
                                          placeholder="Libellé"
                                        />
                                        <button
                                          onClick={() => {
                                            const opts = (v.options || []).filter((_, j) => j !== i);
                                            updateVariable(v.id, { options: opts });
                                          }}
                                          className="text-muted-foreground hover:text-destructive p-0.5"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] gap-1"
                                      onClick={() => {
                                        const opts = [...(v.options || []), { value: '', label: '' }];
                                        updateVariable(v.id, { options: opts });
                                      }}
                                    >
                                      <Plus className="h-2.5 w-2.5" /> Ajouter une option
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="pt-1">
                                <button
                                  onClick={() => insertVariable(v.id)}
                                  className="text-[10px] text-accent hover:underline"
                                >
                                  Insérer dans l&apos;éditeur
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <>
            <div className="w-px bg-border flex-shrink-0" />
            <div className="flex flex-col w-[50%] min-w-[300px] flex-shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Aperçu</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={refreshPreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Rafraîchir
                </Button>
              </div>
              <div className="flex-1 overflow-auto bg-white">
                {previewLoading && !previewHtml ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                    title="Aperçu du template"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

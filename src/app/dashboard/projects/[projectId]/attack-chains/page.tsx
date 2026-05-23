'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  attackChainsApi, findingsApi, ApiError,
  type AttackChain, type Finding,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Plus, Trash2, ArrowRight, ChevronDown, ChevronUp,
  AlertTriangle, X, GripVertical,
} from 'lucide-react';

const SEV_COLORS: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: 'oklch(0.65 0.2 25 / 0.15)', fg: 'oklch(0.65 0.2 25)' },
  HIGH: { bg: 'oklch(0.7 0.15 40 / 0.15)', fg: 'oklch(0.7 0.15 40)' },
  MEDIUM: { bg: 'oklch(0.75 0.15 80 / 0.15)', fg: 'oklch(0.65 0.15 80)' },
  LOW: { bg: 'oklch(0.6 0.12 250 / 0.15)', fg: 'oklch(0.6 0.12 250)' },
  INFO: { bg: 'oklch(0.6 0.05 250 / 0.15)', fg: 'oklch(0.5 0.05 250)' },
};

export default function AttackChainsPage() {
  const { token } = useAuth();
  const params = useParams();
  const projectId = params.projectId as string;

  const [chains, setChains] = useState<AttackChain[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [c, f] = await Promise.all([
        attackChainsApi.getAll(projectId, token),
        findingsApi.getAllByProject(projectId, token),
      ]);
      setChains(c);
      setFindings(f);
    } catch {
      setError('Impossible de charger les chaînes');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    try {
      const chain = await attackChainsApi.create(projectId, { name: newName.trim() }, token);
      setNewName('');
      setChains((prev) => [chain, ...prev]);
      setExpanded(chain.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Supprimer cette chaîne ?')) return;
    try {
      await attackChainsApi.remove(id, token);
      setChains((prev) => prev.filter((c) => c.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleAddFinding = async (chainId: string, findingId: string) => {
    if (!token) return;
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;
    const currentIds = chain.findings.map((f) => f.finding.id);
    if (currentIds.includes(findingId)) return;
    try {
      const updated = await attackChainsApi.setFindings(chainId, [...currentIds, findingId], token);
      setChains((prev) => prev.map((c) => c.id === chainId ? updated : c));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleRemoveFinding = async (chainId: string, findingId: string) => {
    if (!token) return;
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;
    const newIds = chain.findings
      .filter((f) => f.finding.id !== findingId)
      .map((f) => f.finding.id);
    try {
      const updated = await attackChainsApi.setFindings(chainId, newIds, token);
      setChains((prev) => prev.map((c) => c.id === chainId ? updated : c));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleMoveFinding = async (chainId: string, findingId: string, direction: 'up' | 'down') => {
    if (!token) return;
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;
    const ids = chain.findings.map((f) => f.finding.id);
    const idx = ids.indexOf(findingId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const updated = await attackChainsApi.setFindings(chainId, ids, token);
      setChains((prev) => prev.map((c) => c.id === chainId ? updated : c));
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
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Chaînes d&apos;attaque</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scénarios d&apos;exploitation reliant plusieurs findings
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <Input
            placeholder="Nom de la chaîne (ex: Élévation de privilèges via SSRF)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            Créer
          </Button>
        </form>

        {chains.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucune chaîne d&apos;attaque</p>
            <p className="text-xs mt-1 opacity-60">
              Créez des chaînes pour documenter les scénarios d&apos;exploitation multi-étapes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chains.map((chain) => {
              const isExpanded = expanded === chain.id;
              const usedFindingIds = new Set(chain.findings.map((f) => f.finding.id));
              const availableFindings = findings.filter((f) => !usedFindingIds.has(f.id));

              return (
                <div key={chain.id} className="rounded-xl bg-card border border-border overflow-hidden">
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : chain.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{chain.name}</div>
                      {chain.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{chain.description}</div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {chain.findings.length} étape{chain.findings.length > 1 ? 's' : ''}
                    </span>

                    {/* Mini severity chain */}
                    {chain.findings.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {chain.findings.map((f, i) => (
                          <span key={f.id} className="flex items-center gap-0.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ background: SEV_COLORS[f.finding.severity]?.fg || 'var(--muted)' }}
                              title={`${f.finding.title} (${f.finding.severity})`}
                            />
                            {i < chain.findings.length - 1 && (
                              <ArrowRight size={8} className="text-muted-foreground" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDelete(chain.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4">
                      {/* Flow diagram */}
                      {chain.findings.length > 0 ? (
                        <div className="space-y-0">
                          {chain.findings.map((step, idx) => {
                            const sev = SEV_COLORS[step.finding.severity] || { bg: 'var(--secondary)', fg: 'var(--foreground)' };
                            return (
                              <div key={step.id}>
                                <div className="flex items-stretch gap-3">
                                  {/* Step number + line */}
                                  <div className="flex flex-col items-center w-8 shrink-0">
                                    <div
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                      style={{ background: sev.bg, color: sev.fg, border: `1.5px solid ${sev.fg}` }}
                                    >
                                      {idx + 1}
                                    </div>
                                    {idx < chain.findings.length - 1 && (
                                      <div className="flex-1 w-px my-1" style={{ background: 'var(--border)' }} />
                                    )}
                                  </div>

                                  {/* Card */}
                                  <div className="flex-1 rounded-lg border border-border p-3 mb-2 group">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          {step.finding.slug && (
                                            <span className="text-[10px] font-mono text-muted-foreground">{step.finding.slug}</span>
                                          )}
                                          <span
                                            className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded"
                                            style={{ background: sev.bg, color: sev.fg }}
                                          >
                                            {step.finding.severity}
                                          </span>
                                        </div>
                                        <div className="text-sm font-medium mt-0.5">{step.finding.title}</div>
                                      </div>
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <Button
                                          variant="ghost" size="icon" className="h-6 w-6"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveFinding(chain.id, step.finding.id, 'up')}
                                        >
                                          <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost" size="icon" className="h-6 w-6"
                                          disabled={idx === chain.findings.length - 1}
                                          onClick={() => handleMoveFinding(chain.id, step.finding.id, 'down')}
                                        >
                                          <ChevronDown className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost" size="icon"
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                          onClick={() => handleRemoveFinding(chain.id, step.finding.id)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Arrow between steps */}
                                {idx < chain.findings.length - 1 && (
                                  <div className="flex items-center pl-[15px] -mt-1 -mb-1">
                                    <ArrowRight size={10} className="text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                          Aucune étape. Ajoutez des findings pour construire la chaîne.
                        </div>
                      )}

                      {/* Add finding */}
                      <div className="mt-3 pt-3 border-t border-border">
                        {showPicker === chain.id ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium">Ajouter un finding</span>
                              <Button variant="ghost" size="sm" onClick={() => setShowPicker(null)}>
                                <X className="mr-1 h-3 w-3" /> Fermer
                              </Button>
                            </div>
                            {availableFindings.length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                Tous les findings sont déjà dans cette chaîne
                              </div>
                            ) : (
                              <div className="space-y-1 max-h-48 overflow-auto">
                                {availableFindings.map((f) => {
                                  const sev = SEV_COLORS[f.severity] || { bg: 'var(--secondary)', fg: 'var(--foreground)' };
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => handleAddFinding(chain.id, f.id)}
                                      className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                                    >
                                      <span
                                        className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded shrink-0"
                                        style={{ background: sev.bg, color: sev.fg }}
                                      >
                                        {f.severity}
                                      </span>
                                      <span className="text-xs flex-1 truncate">{f.title}</span>
                                      {f.slug && (
                                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{f.slug}</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowPicker(chain.id)}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Ajouter un finding
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

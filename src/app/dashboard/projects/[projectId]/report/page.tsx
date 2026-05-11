'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  reportsApi,
  projectsApi,
  findingsApi,
  ApiError,
  type ProjectDetail,
  type Finding,
  type Report,
  type Severity,
} from '@/lib/api';
import { ReportProvider } from '@/lib/report-context';
import {
  VariableNode,
  FindingsTableNode,
  buildReportSlashItems,
} from '@/components/editor/report-nodes';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ReportOutline, type OutlineBlock } from '@/components/report/report-outline';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  ShieldAlert,
  Table2,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface ReportBlock {
  id: string;
  type: 'section' | 'finding' | 'summary';
  title: string;
  content: any;
  findingId?: string;
  severity?: Severity;
}

interface ReportData {
  version: 2;
  blocks: ReportBlock[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

const SEV_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEV_LABEL: Record<Severity, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Haut',
  MEDIUM: 'Moyen',
  LOW: 'Bas',
  INFO: 'Info',
};

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--sev-critical-fg)',
  HIGH: 'var(--sev-high-fg)',
  MEDIUM: 'var(--sev-medium-fg)',
  LOW: 'var(--sev-low-fg)',
  INFO: 'var(--sev-info-fg)',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmé',
  FALSE_POSITIVE: 'Faux positif',
  FIXED: 'Corrigé',
};

function migrateContent(raw: any): ReportData {
  if (!raw) return { version: 2, blocks: [] };
  if (raw.version === 2 && Array.isArray(raw.blocks)) return raw as ReportData;
  if (raw.type === 'doc') {
    return {
      version: 2,
      blocks: [
        {
          id: uid(),
          type: 'section',
          title: 'Contenu importé',
          content: raw,
        },
      ],
    };
  }
  return { version: 2, blocks: [] };
}

function buildFindingContent(f: Finding): any {
  const nodes: any[] = [];

  if (f.description) {
    nodes.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Description' }] },
      { type: 'paragraph', content: [{ type: 'text', text: f.description }] },
    );
  }

  if (f.proof) {
    nodes.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Preuve' }] },
      { type: 'paragraph', content: [{ type: 'text', text: f.proof }] },
    );
  }

  if (f.impact) {
    nodes.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Impact' }] },
      { type: 'paragraph', content: [{ type: 'text', text: f.impact }] },
    );
  }

  if (f.remediation) {
    nodes.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Remédiation' }] },
      { type: 'paragraph', content: [{ type: 'text', text: f.remediation }] },
    );
  }

  if (f.references) {
    nodes.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Références' }] },
      { type: 'paragraph', content: [{ type: 'text', text: f.references }] },
    );
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph' });
  }

  return { type: 'doc', content: nodes };
}

function generateTemplate(findings: Finding[]): ReportBlock[] {
  const sorted = [...findings].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
  );

  const blocks: ReportBlock[] = [
    { id: uid(), type: 'section', title: 'Introduction', content: null },
    { id: uid(), type: 'section', title: 'Périmètre et méthodologie', content: null },
    { id: uid(), type: 'summary', title: 'Synthèse des vulnérabilités', content: null },
  ];

  for (const f of sorted) {
    blocks.push({
      id: uid(),
      type: 'finding',
      title: f.slug ? `${f.slug} — ${f.title}` : f.title,
      content: buildFindingContent(f),
      findingId: f.id,
      severity: f.severity,
    });
  }

  blocks.push(
    { id: uid(), type: 'section', title: 'Recommandations', content: null },
    { id: uid(), type: 'section', title: 'Conclusion', content: null },
  );

  return blocks;
}

// ── Finding metadata bar ────────────────────────────────────────────────

function FindingMeta({ finding }: { finding: Finding }) {
  const c = SEV_COLOR[finding.severity];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '10px 16px',
        background: `color-mix(in oklch, ${c} 6%, var(--bg-elevated))`,
        borderRadius: 'var(--r-md)',
        borderLeft: `3px solid ${c}`,
        marginBottom: 16,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: c,
          background: `color-mix(in oklch, ${c} 15%, transparent)`,
          border: `1px solid color-mix(in oklch, ${c} 30%, transparent)`,
        }}
      >
        {SEV_LABEL[finding.severity]}
      </span>

      {finding.cvssScore != null && (
        <span className="font-mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
          CVSS {finding.cvssScore.toFixed(1)}
        </span>
      )}

      <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
        {STATUS_LABEL[finding.status] || finding.status}
      </span>

      {finding.component && (
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
          {finding.component.name}
        </span>
      )}

      {finding.slug && (
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
          {finding.slug}
        </span>
      )}
    </div>
  );
}

// ── Findings summary table (for summary blocks) ────────────────────────

function FindingsSummaryTable({ findings }: { findings: Finding[] }) {
  const sorted = [...findings].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
  );

  if (sorted.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
        Aucun finding dans ce projet
      </div>
    );
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    borderBottom: '1px solid var(--border)',
    fontWeight: 500,
    color: 'var(--fg-muted)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  const td: React.CSSProperties = {
    padding: '10px 14px',
    borderTop: '1px solid var(--border-subtle)',
    fontSize: 13,
    color: 'var(--fg)',
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Réf.</th>
            <th style={th}>Vulnérabilité</th>
            <th style={th}>Sévérité</th>
            <th style={th}>CVSS</th>
            <th style={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => {
            const c = SEV_COLOR[f.severity];
            return (
              <tr key={f.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                  {f.slug || '—'}
                </td>
                <td style={{ ...td, fontWeight: 500 }}>{f.title}</td>
                <td style={td}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: c,
                      background: `color-mix(in oklch, ${c} 12%, transparent)`,
                    }}
                  >
                    {SEV_LABEL[f.severity]}
                  </span>
                </td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {f.cvssScore != null ? f.cvssScore.toFixed(1) : '—'}
                </td>
                <td style={{ ...td, fontSize: 12, color: 'var(--fg-muted)' }}>
                  {STATUS_LABEL[f.status] || f.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState({ onGenerate, findingsCount }: { onGenerate: () => void; findingsCount: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        color: 'var(--fg-subtle)',
        textAlign: 'center',
        padding: 32,
      }}
    >
      <FileText size={48} style={{ opacity: 0.2 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg-muted)', marginBottom: 4 }}>
          Commencez votre rapport
        </div>
        <div style={{ fontSize: 13 }}>
          Ajoutez des blocs manuellement ou générez la structure automatiquement
        </div>
      </div>
      <Button onClick={onGenerate} size="sm" style={{ marginTop: 8 }}>
        <Sparkles className="mr-2 h-3.5 w-3.5" />
        Générer la structure {findingsCount > 0 && `(${findingsCount} findings)`}
      </Button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────

export default function ProjectReportPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [blocks, setBlocks] = useState<ReportBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const extraExtensions = useMemo(() => [VariableNode, FindingsTableNode], []);
  const extraSlashItems = useMemo(() => buildReportSlashItems(), []);

  // ── Load data ──

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const [proj, fdg, rep] = await Promise.all([
          projectsApi.getOne(projectId, token),
          findingsApi.getAllByProject(projectId, token),
          reportsApi.get(projectId, token),
        ]);
        if (!mounted) return;
        setProject(proj);
        setFindings(fdg);
        setReport(rep);

        const data = migrateContent(
          rep.content && typeof rep.content === 'object' ? rep.content : null,
        );
        setBlocks(data.blocks);
        if (data.blocks.length > 0) setActiveBlockId(data.blocks[0].id);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : 'Erreur de chargement');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token, projectId]);

  useEffect(() => {
    if (project) {
      setActiveProject({ id: project.id, slug: project.name, findingsCount: findings.length });
    }
    return () => setActiveProject(null);
  }, [project, findings.length, setActiveProject]);

  // ── Save logic ──

  const persist = useCallback(
    (blocksToSave: ReportBlock[]) => {
      if (!token || !report) return;
      const data: ReportData = { version: 2, blocks: blocksToSave };
      setSaveState('saving');
      reportsApi
        .update(projectId, data, token)
        .then((r) => { setReport(r); setSaveState('saved'); })
        .catch(() => setSaveState('error'));
    },
    [token, report, projectId],
  );

  const scheduleSave = useCallback(
    (nextBlocks: ReportBlock[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(nextBlocks), 1200);
    },
    [persist],
  );

  const updateBlocks = useCallback(
    (nextBlocks: ReportBlock[]) => {
      setBlocks(nextBlocks);
      scheduleSave(nextBlocks);
    },
    [scheduleSave],
  );

  // ── Block CRUD ──

  const addSection = useCallback(() => {
    const block: ReportBlock = { id: uid(), type: 'section', title: 'Nouvelle section', content: null };
    const next = [...blocks, block];
    updateBlocks(next);
    setActiveBlockId(block.id);
  }, [blocks, updateBlocks]);

  const addSummary = useCallback(() => {
    const block: ReportBlock = { id: uid(), type: 'summary', title: 'Synthèse des vulnérabilités', content: null };
    const next = [...blocks, block];
    updateBlocks(next);
    setActiveBlockId(block.id);
  }, [blocks, updateBlocks]);

  const importFinding = useCallback(
    (findingId: string) => {
      const f = findings.find((x) => x.id === findingId);
      if (!f) return;
      const block: ReportBlock = {
        id: uid(),
        type: 'finding',
        title: f.slug ? `${f.slug} — ${f.title}` : f.title,
        content: buildFindingContent(f),
        findingId: f.id,
        severity: f.severity,
      };
      const next = [...blocks, block];
      updateBlocks(next);
      setActiveBlockId(block.id);
    },
    [blocks, findings, updateBlocks],
  );

  const importAllFindings = useCallback(() => {
    const imported = new Set(blocks.filter((b) => b.findingId).map((b) => b.findingId));
    const available = findings.filter((f) => !imported.has(f.id));
    const sorted = [...available].sort(
      (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
    );
    const newBlocks = sorted.map((f): ReportBlock => ({
      id: uid(),
      type: 'finding',
      title: f.slug ? `${f.slug} — ${f.title}` : f.title,
      content: buildFindingContent(f),
      findingId: f.id,
      severity: f.severity,
    }));
    const next = [...blocks, ...newBlocks];
    updateBlocks(next);
    if (newBlocks.length > 0) setActiveBlockId(newBlocks[0].id);
  }, [blocks, findings, updateBlocks]);

  const handleGenerate = useCallback(() => {
    const generated = generateTemplate(findings);
    updateBlocks(generated);
    if (generated.length > 0) setActiveBlockId(generated[0].id);
  }, [findings, updateBlocks]);

  const deleteBlock = useCallback(
    (id: string) => {
      const next = blocks.filter((b) => b.id !== id);
      updateBlocks(next);
      if (activeBlockId === id) {
        setActiveBlockId(next.length > 0 ? next[0].id : null);
      }
    },
    [blocks, activeBlockId, updateBlocks],
  );

  const reorderBlocks = useCallback(
    (ids: string[]) => {
      const map = new Map(blocks.map((b) => [b.id, b]));
      const next = ids.map((id) => map.get(id)!).filter(Boolean);
      updateBlocks(next);
    },
    [blocks, updateBlocks],
  );

  const updateBlockContent = useCallback(
    (id: string, raw: string) => {
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
      setBlocks((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, content: parsed } : b));
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const updateBlockTitle = useCallback(
    (id: string, title: string) => {
      const next = blocks.map((b) => (b.id === id ? { ...b, title } : b));
      updateBlocks(next);
    },
    [blocks, updateBlocks],
  );

  // ── Derived state ──

  const activeBlock = blocks.find((b) => b.id === activeBlockId) || null;
  const activeFinding = activeBlock?.findingId
    ? findings.find((f) => f.id === activeBlock.findingId) || null
    : null;

  const importedFindingIds = useMemo(
    () => new Set(blocks.filter((b) => b.findingId).map((b) => b.findingId)),
    [blocks],
  );

  const availableFindings = useMemo(
    () =>
      findings
        .filter((f) => !importedFindingIds.has(f.id))
        .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)),
    [findings, importedFindingIds],
  );

  const outlineItems: OutlineBlock[] = useMemo(
    () => blocks.map((b) => ({ id: b.id, type: b.type, title: b.title, severity: b.severity })),
    [blocks],
  );

  // ── Render ──

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ReportProvider project={project} findings={findings}>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-3 border-b border-border">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-muted-foreground mb-1"
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              {project?.name || '…'}
            </Button>
            <h1 className="text-2xl font-bold">Rapport</h1>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[11px]"
              style={{
                color:
                  saveState === 'saving' ? 'var(--fg-muted)'
                  : saveState === 'saved' ? 'var(--st-compliant-fg)'
                  : saveState === 'error' ? 'var(--sev-critical-fg)'
                  : 'var(--fg-subtle)',
              }}
            >
              {saveState === 'saving' && 'enregistrement…'}
              {saveState === 'saved' && '✓ enregistré'}
              {saveState === 'error' && 'erreur'}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {blocks.length} bloc{blocks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-8 mt-3 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Outline sidebar */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ReportOutline
              items={outlineItems}
              activeId={activeBlockId}
              onSelect={setActiveBlockId}
              onReorder={reorderBlocks}
              onDelete={deleteBlock}
              onAddSection={addSection}
              onAddSummary={addSummary}
              onImportFinding={importFinding}
              onImportAllFindings={importAllFindings}
              onGenerate={handleGenerate}
              availableFindings={availableFindings.map((f) => ({
                id: f.id,
                title: f.title,
                severity: f.severity,
                slug: f.slug,
              }))}
            />
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {blocks.length === 0 ? (
              <EmptyState onGenerate={handleGenerate} findingsCount={findings.length} />
            ) : activeBlock ? (
              <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
                {/* Block type indicator */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    color: 'var(--fg-subtle)',
                    fontSize: 11,
                  }}
                >
                  {activeBlock.type === 'section' && <><FileText size={12} /> Section</>}
                  {activeBlock.type === 'finding' && <><ShieldAlert size={12} /> Finding</>}
                  {activeBlock.type === 'summary' && <><Table2 size={12} /> Synthèse</>}
                </div>

                {/* Editable title */}
                {activeBlock.type !== 'summary' && (
                  <input
                    value={activeBlock.title}
                    onChange={(e) => updateBlockTitle(activeBlock.id, e.target.value)}
                    placeholder="Titre du bloc"
                    style={{
                      width: '100%',
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--fg)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      marginBottom: 16,
                      fontFamily: 'inherit',
                    }}
                  />
                )}

                {/* Finding metadata */}
                {activeBlock.type === 'finding' && activeFinding && (
                  <FindingMeta finding={activeFinding} />
                )}

                {/* Summary table (no editor) */}
                {activeBlock.type === 'summary' ? (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--fg)' }}>
                      {activeBlock.title}
                    </h2>
                    <FindingsSummaryTable findings={findings} />
                  </div>
                ) : (
                  /* Rich text editor */
                  <div
                    style={{
                      padding: '20px 24px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--r-lg)',
                      minHeight: 400,
                    }}
                  >
                    <RichTextEditor
                      key={activeBlock.id}
                      content={activeBlock.content ? JSON.stringify(activeBlock.content) : ''}
                      onChange={(raw) => updateBlockContent(activeBlock.id, raw)}
                      storageMode="json"
                      placeholder="Commencez à écrire… (tapez / pour les commandes)"
                      extraExtensions={extraExtensions}
                      extraSlashItems={extraSlashItems}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--fg-subtle)',
                  fontSize: 13,
                }}
              >
                Sélectionnez un bloc dans le plan
              </div>
            )}
          </div>
        </div>
      </div>
    </ReportProvider>
  );
}

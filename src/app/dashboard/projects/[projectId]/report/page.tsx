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
  type FindingStatus,
} from '@/lib/api';
import { ReportProvider } from '@/lib/report-context';
import {
  VariableNode,
  FindingsTableNode,
  buildReportSlashItems,
} from '@/components/editor/report-nodes';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  ReportSidebar,
  type SidebarSection,
  type SidebarFinding,
  type ActiveView,
} from '@/components/report/report-sidebar';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  ShieldAlert,
  Save,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  type: string;
  title: string;
  content: any;
  predefined: boolean;
}

interface ReportDataV3 {
  version: 3;
  sections: ReportSection[];
  findingOrder: string[];
}

// ── Constants ───────────────────────────────────────────────────────────

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

const STATUS_OPTIONS: { value: FindingStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'FALSE_POSITIVE', label: 'Faux positif' },
  { value: 'FIXED', label: 'Corrigé' },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmé',
  FALSE_POSITIVE: 'Faux positif',
  FIXED: 'Corrigé',
};

const PREDEFINED_SECTIONS: Omit<ReportSection, 'id'>[] = [
  { type: 'executive_summary', title: 'Synthèse exécutive', content: null, predefined: true },
  { type: 'scope', title: 'Périmètre', content: null, predefined: true },
  { type: 'methodology', title: 'Méthodologie', content: null, predefined: true },
  { type: 'recommendations', title: 'Recommandations', content: null, predefined: true },
  { type: 'conclusion', title: 'Conclusion', content: null, predefined: true },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function migrateContent(raw: any, findings: Finding[]): ReportDataV3 {
  if (!raw) return makeDefault(findings);

  if (raw.version === 3 && Array.isArray(raw.sections)) {
    return raw as ReportDataV3;
  }

  if (raw.version === 2 && Array.isArray(raw.blocks)) {
    const sections: ReportSection[] = [];
    const findingOrder: string[] = [];
    for (const block of raw.blocks) {
      if (block.type === 'section' || block.type === 'summary') {
        sections.push({
          id: block.id || uid(),
          type: 'custom',
          title: block.title || 'Section importée',
          content: block.content,
          predefined: false,
        });
      } else if (block.type === 'finding' && block.findingId) {
        findingOrder.push(block.findingId);
      }
    }
    if (sections.length === 0) {
      return makeDefault(findings);
    }
    return { version: 3, sections, findingOrder };
  }

  if (raw.type === 'doc') {
    const defaultData = makeDefault(findings);
    defaultData.sections[0].content = raw;
    return defaultData;
  }

  return makeDefault(findings);
}

function makeDefault(findings: Finding[]): ReportDataV3 {
  return {
    version: 3,
    sections: PREDEFINED_SECTIONS.map((s) => ({ ...s, id: uid() })),
    findingOrder: [...findings]
      .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
      .map((f) => f.id),
  };
}

// ── Finding metadata bar ────────────────────────────────────────────────

function FindingMeta({
  finding,
  onUpdate,
}: {
  finding: Finding;
  onUpdate: (field: string, value: any) => void;
}) {
  const c = SEV_COLOR[finding.severity];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        background: `color-mix(in oklch, ${c} 6%, var(--bg-elevated))`,
        borderRadius: 'var(--r-md)',
        borderLeft: `3px solid ${c}`,
        marginBottom: 20,
        alignItems: 'center',
      }}
    >
      {/* Severity select */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 500 }}>Sévérité</span>
        <select
          value={finding.severity}
          onChange={(e) => onUpdate('severity', e.target.value)}
          style={{
            padding: '2px 6px',
            borderRadius: 'var(--r-sm)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: c,
            background: `color-mix(in oklch, ${c} 12%, transparent)`,
            border: `1px solid color-mix(in oklch, ${c} 25%, transparent)`,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {SEV_ORDER.map((s) => (
            <option key={s} value={s}>{SEV_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* CVSS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 500 }}>CVSS</span>
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={finding.cvssScore ?? ''}
          onChange={(e) => onUpdate('cvssScore', e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="—"
          className="font-mono"
          style={{
            width: 52,
            padding: '2px 6px',
            fontSize: 12,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--fg)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 500 }}>Statut</span>
        <select
          value={finding.status}
          onChange={(e) => onUpdate('status', e.target.value)}
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--r-sm)',
            fontSize: 11.5,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Component */}
      {finding.component && (
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
          {finding.component.name}
        </span>
      )}

      {/* Slug */}
      {finding.slug && (
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
          {finding.slug}
        </span>
      )}
    </div>
  );
}

// ── Finding structured field ────────────────────────────────────────────

function FindingField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(80, el.scrollHeight) + 'px';
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--fg-muted)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>
      <textarea
        ref={ref}
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize();
        }}
        placeholder={placeholder || `${label}…`}
        style={{
          width: '100%',
          minHeight: 80,
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--fg)',
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      />
    </div>
  );
}

// ── Section editor ──────────────────────────────────────────────────────

function SectionEditor({
  section,
  onTitleChange,
  onContentChange,
  extraExtensions,
  extraSlashItems,
}: {
  section: ReportSection;
  onTitleChange: (title: string) => void;
  onContentChange: (raw: string) => void;
  extraExtensions: any[];
  extraSlashItems: any[];
}) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
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
        <FileText size={12} />
        {section.predefined ? 'Section prédéfinie' : 'Section personnalisée'}
      </div>

      <input
        value={section.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Titre de la section"
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
          marginBottom: 20,
          fontFamily: 'inherit',
        }}
      />

      <div
        style={{
          padding: '20px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-lg)',
          minHeight: 400,
        }}
      >
        <RichTextEditor
          key={section.id}
          content={section.content ? JSON.stringify(section.content) : ''}
          onChange={onContentChange}
          storageMode="json"
          placeholder="Commencez à écrire… (tapez / pour les commandes)"
          extraExtensions={extraExtensions}
          extraSlashItems={extraSlashItems}
        />
      </div>
    </div>
  );
}

// ── Finding editor ──────────────────────────────────────────────────────

function FindingEditor({
  finding,
  onUpdate,
}: {
  finding: Finding;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
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
        <ShieldAlert size={12} />
        Vulnérabilité
      </div>

      <input
        value={finding.title}
        onChange={(e) => onUpdate('title', e.target.value)}
        placeholder="Titre de la vulnérabilité"
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

      <FindingMeta finding={finding} onUpdate={onUpdate} />

      <FindingField
        label="Description"
        value={finding.description}
        onChange={(v) => onUpdate('description', v)}
        placeholder="Décrivez la vulnérabilité découverte…"
      />
      <FindingField
        label="Preuve"
        value={finding.proof || ''}
        onChange={(v) => onUpdate('proof', v)}
        placeholder="Étapes de reproduction, captures, logs…"
      />
      <FindingField
        label="Impact"
        value={finding.impact || ''}
        onChange={(v) => onUpdate('impact', v)}
        placeholder="Impact sur la confidentialité, intégrité, disponibilité…"
      />
      <FindingField
        label="Remédiation"
        value={finding.remediation || ''}
        onChange={(v) => onUpdate('remediation', v)}
        placeholder="Mesures correctives recommandées…"
      />
      <FindingField
        label="Références"
        value={finding.references || ''}
        onChange={(v) => onUpdate('references', v)}
        placeholder="CVE, CWE, OWASP, liens externes…"
      />
    </div>
  );
}

// ── Findings summary table ──────────────────────────────────────────────

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
          Les sections prédéfinies seront créées automatiquement.
          {findingsCount > 0 && ` ${findingsCount} vulnérabilité${findingsCount > 1 ? 's' : ''} disponible${findingsCount > 1 ? 's' : ''}.`}
        </div>
      </div>
      <Button onClick={onGenerate} size="sm" style={{ marginTop: 8 }}>
        <Sparkles className="mr-2 h-3.5 w-3.5" />
        Initialiser le rapport
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
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [findingOrder, setFindingOrder] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const findingSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          fdg,
        );
        setSections(data.sections);
        setFindingOrder(data.findingOrder);

        if (data.sections.length > 0) {
          setActiveView({ kind: 'section', id: data.sections[0].id });
        }
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

  // ── Save report sections ──

  const persistReport = useCallback(
    (sectionsToSave: ReportSection[], orderToSave: string[]) => {
      if (!token || !report) return;
      const data: ReportDataV3 = { version: 3, sections: sectionsToSave, findingOrder: orderToSave };
      setSaveState('saving');
      reportsApi
        .update(projectId, data, token)
        .then((r) => { setReport(r); setSaveState('saved'); })
        .catch(() => setSaveState('error'));
    },
    [token, report, projectId],
  );

  const scheduleSaveReport = useCallback(
    (nextSections: ReportSection[], nextOrder: string[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistReport(nextSections, nextOrder), 1200);
    },
    [persistReport],
  );

  // ── Save finding changes ──

  const persistFinding = useCallback(
    (findingId: string, updates: Partial<Finding>) => {
      if (!token) return;
      setSaveState('saving');
      findingsApi
        .update(findingId, updates, token)
        .then((updated) => {
          setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    },
    [token],
  );

  const scheduleSaveFinding = useCallback(
    (findingId: string, updates: Partial<Finding>) => {
      if (findingSaveTimer.current) clearTimeout(findingSaveTimer.current);
      findingSaveTimer.current = setTimeout(() => persistFinding(findingId, updates), 1200);
    },
    [persistFinding],
  );

  // ── Section CRUD ──

  const updateSections = useCallback(
    (nextSections: ReportSection[]) => {
      setSections(nextSections);
      scheduleSaveReport(nextSections, findingOrder);
    },
    [scheduleSaveReport, findingOrder],
  );

  const addSection = useCallback(() => {
    const sec: ReportSection = {
      id: uid(),
      type: 'custom',
      title: 'Nouvelle section',
      content: null,
      predefined: false,
    };
    const next = [...sections, sec];
    updateSections(next);
    setActiveView({ kind: 'section', id: sec.id });
  }, [sections, updateSections]);

  const deleteSection = useCallback(
    (id: string) => {
      const next = sections.filter((s) => s.id !== id);
      updateSections(next);
      if (activeView?.kind === 'section' && activeView.id === id) {
        setActiveView(next.length > 0 ? { kind: 'section', id: next[0].id } : null);
      }
    },
    [sections, activeView, updateSections],
  );

  const updateSectionTitle = useCallback(
    (id: string, title: string) => {
      const next = sections.map((s) => (s.id === id ? { ...s, title } : s));
      updateSections(next);
    },
    [sections, updateSections],
  );

  const updateSectionContent = useCallback(
    (id: string, raw: string) => {
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
      setSections((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, content: parsed } : s));
        scheduleSaveReport(next, findingOrder);
        return next;
      });
    },
    [scheduleSaveReport, findingOrder],
  );

  // ── Finding update handler ──

  const handleFindingUpdate = useCallback(
    (findingId: string, field: string, value: any) => {
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, [field]: value } : f)),
      );
      scheduleSaveFinding(findingId, { [field]: value });
    },
    [scheduleSaveFinding],
  );

  // ── Initialize report ──

  const handleInitialize = useCallback(() => {
    const defaultSections = PREDEFINED_SECTIONS.map((s) => ({ ...s, id: uid() }));
    const order = [...findings]
      .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
      .map((f) => f.id);
    setSections(defaultSections);
    setFindingOrder(order);
    scheduleSaveReport(defaultSections, order);
    if (defaultSections.length > 0) {
      setActiveView({ kind: 'section', id: defaultSections[0].id });
    }
  }, [findings, scheduleSaveReport]);

  // ── Derived data for sidebar ──

  const sidebarSections: SidebarSection[] = useMemo(
    () => sections.map((s) => ({ id: s.id, type: s.type, title: s.title, predefined: s.predefined })),
    [sections],
  );

  const sidebarFindings: SidebarFinding[] = useMemo(
    () => findings
      .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
      .map((f) => ({
        id: f.id,
        title: f.title,
        slug: f.slug,
        severity: f.severity,
        status: f.status,
      })),
    [findings],
  );

  const activeSection = activeView?.kind === 'section'
    ? sections.find((s) => s.id === activeView.id) || null
    : null;

  const activeFinding = activeView?.kind === 'finding'
    ? findings.find((f) => f.id === activeView.id) || null
    : null;

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
              {sections.length} section{sections.length !== 1 ? 's' : ''} · {findings.length} finding{findings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-8 mt-3 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Main content: sidebar + editor */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
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
            <ReportSidebar
              sections={sidebarSections}
              findings={sidebarFindings}
              activeView={activeView}
              onSelectSection={(id) => setActiveView({ kind: 'section', id })}
              onSelectFinding={(id) => setActiveView({ kind: 'finding', id })}
              onAddSection={addSection}
              onDeleteSection={deleteSection}
            />
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {sections.length === 0 && findings.length === 0 ? (
              <EmptyState onGenerate={handleInitialize} findingsCount={findings.length} />
            ) : activeSection ? (
              <SectionEditor
                section={activeSection}
                onTitleChange={(title) => updateSectionTitle(activeSection.id, title)}
                onContentChange={(raw) => updateSectionContent(activeSection.id, raw)}
                extraExtensions={extraExtensions}
                extraSlashItems={extraSlashItems}
              />
            ) : activeFinding ? (
              <FindingEditor
                finding={activeFinding}
                onUpdate={(field, value) => handleFindingUpdate(activeFinding.id, field, value)}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--fg-subtle)',
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <FileText size={32} style={{ opacity: 0.15 }} />
                Sélectionnez une section ou un finding
              </div>
            )}
          </div>
        </div>
      </div>
    </ReportProvider>
  );
}

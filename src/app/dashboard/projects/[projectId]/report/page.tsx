'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { arrayMove } from '@dnd-kit/sortable';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  reportsApi,
  projectsApi,
  findingsApi,
  attackChainsApi,
  templatesApi,
  ApiError,
  type ProjectDetail,
  type Finding,
  type AttackChain,
  type Report,
  type ReportTemplate,
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
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Check,
  Plus,
  Trash2,
  Link2,
  ArrowRight,
  Zap,
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
  { type: 'findings', title: 'Vulnérabilités', content: null, predefined: false },
  { type: 'impacts', title: 'Impacts', content: null, predefined: false },
  { type: 'attack_chains', title: 'Chaînes d\'attaque', content: null, predefined: false },
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
    const data = raw as ReportDataV3;
    const sections = [...data.sections];
    if (!sections.some((s) => s.type === 'findings')) {
      const recIdx = sections.findIndex((s) => s.type === 'recommendations');
      const insertIdx = recIdx !== -1 ? recIdx : sections.length;
      sections.splice(insertIdx, 0, {
        id: uid(), type: 'findings', title: 'Vulnérabilités', content: null, predefined: false,
      });
    }
    if (!sections.some((s) => s.type === 'impacts')) {
      const findingsIdx = sections.findIndex((s) => s.type === 'findings');
      const insertIdx = findingsIdx !== -1 ? findingsIdx + 1 : sections.length;
      sections.splice(insertIdx, 0, {
        id: uid(), type: 'impacts', title: 'Impacts', content: null, predefined: false,
      });
    }
    if (!sections.some((s) => s.type === 'attack_chains')) {
      const impactsIdx = sections.findIndex((s) => s.type === 'impacts');
      const insertIdx = impactsIdx !== -1 ? impactsIdx + 1 : sections.length;
      sections.splice(insertIdx, 0, {
        id: uid(), type: 'attack_chains', title: 'Chaînes d\'attaque', content: null, predefined: false,
      });
    }
    return { ...data, sections };
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

// ── Clipboard helpers ──────────────────────────────────────────────────

function tiptapToText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  const children = (node.content || []).map(tiptapToText).join('');
  switch (node.type) {
    case 'paragraph': return children + '\n\n';
    case 'heading': return '#'.repeat(node.attrs?.level || 1) + ' ' + children + '\n\n';
    case 'bulletList': return children;
    case 'orderedList': return children;
    case 'listItem': return '- ' + children;
    case 'codeBlock': return '```\n' + children + '```\n\n';
    case 'blockquote': return children.split('\n').map((l: string) => '> ' + l).join('\n') + '\n';
    default: return children;
  }
}

function toText(v: any): string {
  if (!v) return '';
  if (typeof v === 'object') return tiptapToText(v).trim();
  if (typeof v === 'string' && v.startsWith('{"type":"doc"')) {
    try { return tiptapToText(JSON.parse(v)).trim(); } catch { return v; }
  }
  return v;
}

function findingToMarkdown(f: Finding): string {
  const parts = [
    `## ${f.title}`,
    `**Sévérité :** ${f.severity}${f.cvssScore != null ? ` (CVSS ${f.cvssScore.toFixed(1)})` : ''}`,
    `**Statut :** ${STATUS_LABEL[f.status] || f.status}`,
    f.slug ? `**Réf :** ${f.slug}` : '',
    '',
    f.description ? `### Description\n${toText(f.description)}` : '',
    f.proof ? `### Preuve\n${toText(f.proof)}` : '',
    f.impact ? `### Impact\n${toText(f.impact)}` : '',
    f.remediation ? `### Remédiation\n${toText(f.remediation)}` : '',
    f.references ? `### Références\n${toText(f.references)}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={label || 'Copier'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 'var(--r-sm)',
        fontSize: 10.5,
        color: copied ? 'var(--st-compliant-fg)' : 'var(--fg-subtle)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {label && <span>{copied ? 'Copié' : label}</span>}
    </button>
  );
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
  value: rawValue,
  onChange,
  placeholder,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const value = useMemo(() => {
    if (!rawValue) return '';
    if (typeof rawValue === 'object') return tiptapToText(rawValue).trim();
    if (typeof rawValue === 'string' && rawValue.startsWith('{"type":"doc"')) {
      try { return tiptapToText(JSON.parse(rawValue)).trim(); } catch { return rawValue; }
    }
    return rawValue;
  }, [rawValue]);
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
  contentKey,
  actions,
}: {
  section: ReportSection;
  onTitleChange: (title: string) => void;
  onContentChange: (raw: string) => void;
  extraExtensions: any[];
  extraSlashItems: any[];
  contentKey?: number;
  actions?: React.ReactNode;
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
        <span style={{ marginLeft: 'auto' }}>
          <CopyBtn
            text={`## ${section.title}\n\n${tiptapToText(section.content)}`}
            label="Copier"
          />
        </span>
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

      {actions}

      <div
        style={{
          padding: '20px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-lg)',
          minHeight: 400,
        }}
      >
        <RichTextEditor
          key={`${section.id}-${contentKey || 0}`}
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
        <span style={{ marginLeft: 'auto' }}>
          <CopyBtn text={findingToMarkdown(finding)} label="Copier" />
        </span>
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

  const tableMarkdown = sorted.length > 0
    ? '| Réf. | Vulnérabilité | Sévérité | CVSS | Statut |\n|------|--------------|----------|------|--------|\n' +
      sorted.map((f) =>
        `| ${f.slug || '—'} | ${f.title} | ${f.severity} | ${f.cvssScore != null ? f.cvssScore.toFixed(1) : '—'} | ${STATUS_LABEL[f.status] || f.status} |`
      ).join('\n')
    : '';

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <CopyBtn text={tableMarkdown} label="Copier le tableau" />
      </div>
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
    </div>
  );
}

// ── Impacts summary view ───────────────────────────────────────────────

function ImpactsSummaryView({ findings }: { findings: Finding[] }) {
  const withImpact = findings.filter((f) => f.impact);
  const sorted = [...withImpact].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
  );

  const groups = SEV_ORDER.map((sev) => ({
    severity: sev,
    label: SEV_LABEL[sev],
    color: SEV_COLOR[sev],
    findings: sorted.filter((f) => f.severity === sev),
  })).filter((g) => g.findings.length > 0);

  const copyText = groups
    .map(
      (g) =>
        `### ${g.label}\n\n` +
        g.findings
          .map((f) => `**${f.title}**${f.slug ? ` (${f.slug})` : ''}\n${toText(f.impact)}`)
          .join('\n\n'),
    )
    .join('\n\n');

  if (sorted.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
        Aucun impact renseigné dans les findings
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <CopyBtn text={copyText} label="Copier tout" />
      </div>
      {groups.map((group) => (
        <div key={group.severity} style={{ marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: `2px solid color-mix(in oklch, ${group.color} 30%, transparent)`,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: group.color,
                background: `color-mix(in oklch, ${group.color} 12%, transparent)`,
              }}
            >
              {group.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
              {group.findings.length} finding{group.findings.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {group.findings.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${group.color}`,
                  background: 'var(--bg-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{f.title}</span>
                  {f.slug && (
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                      {f.slug}
                    </span>
                  )}
                  {f.cvssScore != null && (
                    <span className="font-mono" style={{ fontSize: 11, color: group.color, marginLeft: 'auto' }}>
                      CVSS {f.cvssScore.toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fg-muted)', whiteSpace: 'pre-wrap' }}>
                  {toText(f.impact)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Recommendations generator ──────────────────────────────────────────

function buildRecommendationsContent(findings: Finding[]): any {
  const sevLabel: Record<string, string> = {
    CRITICAL: 'Critiques',
    HIGH: 'Hautes',
    MEDIUM: 'Moyennes',
    LOW: 'Basses',
    INFO: 'Informatives',
  };

  const doc: any = { type: 'doc', content: [] };

  for (const sev of SEV_ORDER) {
    const sevFindings = findings.filter(
      (f) => f.severity === sev && f.remediation && toText(f.remediation),
    );
    if (sevFindings.length === 0) continue;

    doc.content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: `Recommandations ${sevLabel[sev]}` }],
    });

    for (const f of sevFindings) {
      const remText = toText(f.remediation);

      doc.content.push({
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: f.title },
          ...(f.slug ? [{ type: 'text', text: ` (${f.slug})` }] : []),
        ],
      });

      doc.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: remText }],
      });
    }
  }

  if (doc.content.length === 0) {
    doc.content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Aucune remédiation renseignée dans les findings.' }],
    });
  }

  return doc;
}

// ── Attack chains editor ───────────────────────────────────────────────

const CHAIN_SEV_COLORS: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: 'oklch(0.65 0.2 25 / 0.15)', fg: 'oklch(0.65 0.2 25)' },
  HIGH: { bg: 'oklch(0.7 0.15 40 / 0.15)', fg: 'oklch(0.7 0.15 40)' },
  MEDIUM: { bg: 'oklch(0.75 0.15 80 / 0.15)', fg: 'oklch(0.65 0.15 80)' },
  LOW: { bg: 'oklch(0.6 0.12 250 / 0.15)', fg: 'oklch(0.6 0.12 250)' },
  INFO: { bg: 'oklch(0.6 0.05 250 / 0.15)', fg: 'oklch(0.5 0.05 250)' },
};

function AttackChainsEditor({
  projectId,
  token,
  allFindings,
}: {
  projectId: string;
  token: string;
  allFindings: Finding[];
}) {
  const [chains, setChains] = useState<AttackChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    attackChainsApi.getAll(projectId, token)
      .then((c) => { if (mounted) setChains(c); })
      .catch(() => { if (mounted) setError('Impossible de charger les chaînes'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [projectId, token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
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
    try {
      await attackChainsApi.remove(id, token);
      setChains((prev) => prev.filter((c) => c.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleAddFinding = async (chainId: string, findingId: string) => {
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;
    const currentIds = chain.findings.map((f) => f.finding.id);
    if (currentIds.includes(findingId)) return;
    try {
      const updated = await attackChainsApi.setFindings(chainId, [...currentIds, findingId], token);
      setChains((prev) => prev.map((c) => (c.id === chainId ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleRemoveFinding = async (chainId: string, findingId: string) => {
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;
    const newIds = chain.findings.filter((f) => f.finding.id !== findingId).map((f) => f.finding.id);
    try {
      const updated = await attackChainsApi.setFindings(chainId, newIds, token);
      setChains((prev) => prev.map((c) => (c.id === chainId ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleMoveFinding = async (chainId: string, findingId: string, direction: 'up' | 'down') => {
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
      setChains((prev) => prev.map((c) => (c.id === chainId ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--fg-subtle)', fontSize: 11 }}>
        <Link2 size={12} />
        Chaînes d&apos;attaque
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
        Chaînes d&apos;attaque
      </h2>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--r-md)', background: 'var(--sev-critical-fg-bg, oklch(0.65 0.2 25 / 0.1))', color: 'var(--sev-critical-fg)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Nom de la chaîne (ex: Élévation de privilèges via SSRF)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 13,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', color: 'var(--fg)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
          Créer
        </Button>
      </form>

      {chains.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)' }}>
          <Link2 size={32} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Aucune chaîne d&apos;attaque</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>
            Créez des chaînes pour documenter les scénarios d&apos;exploitation multi-étapes
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {chains.map((chain) => {
            const isExpanded = expanded === chain.id;
            const usedFindingIds = new Set(chain.findings.map((f) => f.finding.id));
            const availableFindings = allFindings.filter((f) => !usedFindingIds.has(f.id));

            return (
              <div
                key={chain.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  overflow: 'hidden',
                  background: 'var(--bg-elevated)',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : chain.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{chain.name}</div>
                    {chain.description && (
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chain.description}
                      </div>
                    )}
                  </div>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                    {chain.findings.length} étape{chain.findings.length > 1 ? 's' : ''}
                  </span>
                  {chain.findings.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {chain.findings.map((f, i) => (
                        <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span
                            style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: CHAIN_SEV_COLORS[f.finding.severity]?.fg || 'var(--fg-subtle)',
                            }}
                            title={`${f.finding.title} (${f.finding.severity})`}
                          />
                          {i < chain.findings.length - 1 && <ArrowRight size={8} style={{ color: 'var(--fg-subtle)' }} />}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(chain.id); }}
                    style={{
                      background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                      color: 'var(--fg-subtle)', display: 'flex', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sev-critical-fg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
                    {chain.findings.length > 0 ? (
                      <div>
                        {chain.findings.map((step, idx) => {
                          const sev = CHAIN_SEV_COLORS[step.finding.severity] || { bg: 'var(--bg-subtle)', fg: 'var(--fg)' };
                          return (
                            <div key={step.id}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 700,
                                    background: sev.bg, color: sev.fg, border: `1.5px solid ${sev.fg}`,
                                  }}>
                                    {idx + 1}
                                  </div>
                                  {idx < chain.findings.length - 1 && (
                                    <div style={{ flex: 1, width: 1, margin: '4px 0', background: 'var(--border)' }} />
                                  )}
                                </div>
                                <div
                                  className="group"
                                  style={{
                                    flex: 1, padding: '8px 12px', marginBottom: 8,
                                    border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {step.finding.slug && (
                                          <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>{step.finding.slug}</span>
                                        )}
                                        <span style={{
                                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                                          padding: '1px 5px', borderRadius: 4,
                                          background: sev.bg, color: sev.fg,
                                        }}>
                                          {step.finding.severity}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{step.finding.title}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.1s', flexShrink: 0 }} className="group-hover:!opacity-100">
                                      <button
                                        disabled={idx === 0}
                                        onClick={() => handleMoveFinding(chain.id, step.finding.id, 'up')}
                                        style={{ background: 'none', border: 'none', padding: 4, cursor: idx === 0 ? 'default' : 'pointer', color: 'var(--fg-subtle)', opacity: idx === 0 ? 0.3 : 1, display: 'flex' }}
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button
                                        disabled={idx === chain.findings.length - 1}
                                        onClick={() => handleMoveFinding(chain.id, step.finding.id, 'down')}
                                        style={{ background: 'none', border: 'none', padding: 4, cursor: idx === chain.findings.length - 1 ? 'default' : 'pointer', color: 'var(--fg-subtle)', opacity: idx === chain.findings.length - 1 ? 0.3 : 1, display: 'flex' }}
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveFinding(chain.id, step.finding.id)}
                                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sev-critical-fg)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)'; }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--fg-subtle)' }}>
                        Aucune étape. Ajoutez des findings pour construire la chaîne.
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                      {showPicker === chain.id ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Ajouter un finding</span>
                            <button
                              onClick={() => setShowPicker(null)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <X size={12} /> Fermer
                            </button>
                          </div>
                          {availableFindings.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', textAlign: 'center', padding: 8 }}>
                              Tous les findings sont déjà dans cette chaîne
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                              {availableFindings.map((f) => {
                                const sev = CHAIN_SEV_COLORS[f.severity] || { bg: 'var(--bg-subtle)', fg: 'var(--fg)' };
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => handleAddFinding(chain.id, f.id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      padding: '6px 10px', border: '1px solid var(--border)',
                                      borderRadius: 'var(--r-md)', background: 'transparent',
                                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: sev.bg, color: sev.fg, flexShrink: 0 }}>
                                      {f.severity}
                                    </span>
                                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' }}>
                                      {f.title}
                                    </span>
                                    {f.slug && (
                                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-subtle)', flexShrink: 0 }}>{f.slug}</span>
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
  const [reports, setReports] = useState<Report[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [findingOrder, setFindingOrder] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [creatingReport, setCreatingReport] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const findingSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTemplateSelect) return;
    const handleClick = (e: MouseEvent) => {
      if (templateSelectRef.current && !templateSelectRef.current.contains(e.target as Node)) {
        setShowTemplateSelect(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTemplateSelect]);

  const extraExtensions = useMemo(() => [VariableNode, FindingsTableNode], []);
  const extraSlashItems = useMemo(() => buildReportSlashItems(), []);

  // ── Load data ──

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const [proj, fdg, reps, tpls] = await Promise.all([
          projectsApi.getOne(projectId, token),
          findingsApi.getAllByProject(projectId, token),
          reportsApi.getAll(projectId, token).catch(() => [] as Report[]),
          templatesApi.getAll(token),
        ]);
        if (!mounted) return;
        setProject(proj);
        setFindings(fdg);
        setTemplates(tpls);

        let allReports = reps;
        if (allReports.length === 0) {
          const rep = await reportsApi.get(projectId, token);
          allReports = [rep];
        }
        setReports(allReports);

        const rep = allReports[0];
        setReport(rep);
        setSelectedTemplateId(rep.templateId || proj.templateId || null);

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
      const savePromise = report.id
        ? reportsApi.updateOne(report.id, { content: data }, token)
        : reportsApi.update(projectId, data, token);
      savePromise
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

  const addSection = useCallback((type?: string) => {
    let sec: ReportSection;
    if (type === 'findings') {
      sec = { id: uid(), type: 'findings', title: 'Vulnérabilités', content: null, predefined: false };
    } else if (type === 'impacts') {
      sec = { id: uid(), type: 'impacts', title: 'Impacts', content: null, predefined: false };
    } else if (type === 'attack_chains') {
      sec = { id: uid(), type: 'attack_chains', title: 'Chaînes d\'attaque', content: null, predefined: false };
    } else {
      sec = { id: uid(), type: 'custom', title: 'Nouvelle section', content: null, predefined: false };
    }
    const next = [...sections, sec];
    updateSections(next);
    setActiveView({ kind: 'section', id: sec.id });
  }, [sections, updateSections]);

  const deleteSection = useCallback(
    (id: string) => {
      const deletedSection = sections.find((s) => s.id === id);
      const next = sections.filter((s) => s.id !== id);
      updateSections(next);
      const shouldReset =
        (activeView?.kind === 'section' && activeView.id === id) ||
        (activeView?.kind === 'finding' && deletedSection?.type === 'findings');
      if (shouldReset) {
        setActiveView(next.length > 0 ? { kind: 'section', id: next[0].id } : null);
      }
    },
    [sections, activeView, updateSections],
  );

  const reorderSections = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = arrayMove(sections, fromIndex, toIndex);
      updateSections(next);
    },
    [sections, updateSections],
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

  // ── Generate recommendations from findings ──

  const handleGenerateRecommendations = useCallback(
    (sectionId: string) => {
      const content = buildRecommendationsContent(findings);
      const next = sections.map((s) => (s.id === sectionId ? { ...s, content } : s));
      updateSections(next);
      setContentVersion((v) => v + 1);
    },
    [findings, sections, updateSections],
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

  // ── Template assignment ──

  const assignTemplate = useCallback(
    async (templateId: string | null) => {
      if (!token) return;
      setSelectedTemplateId(templateId);
      setShowTemplateSelect(false);
      try {
        await projectsApi.update(projectId, { templateId }, token);
      } catch {
        setError('Erreur lors de l\'assignation du template');
      }
    },
    [token, projectId],
  );

  // ── Multi-report management ──

  const switchReport = useCallback(
    (rep: Report) => {
      setReport(rep);
      setSelectedTemplateId(rep.templateId || project?.templateId || null);
      const data = migrateContent(
        rep.content && typeof rep.content === 'object' ? rep.content : null,
        findings,
      );
      setSections(data.sections);
      setFindingOrder(data.findingOrder);
      if (data.sections.length > 0) {
        setActiveView({ kind: 'section', id: data.sections[0].id });
      } else {
        setActiveView(null);
      }
    },
    [findings, project],
  );

  const createReport = useCallback(async () => {
    if (!token || creatingReport) return;
    setCreatingReport(true);
    try {
      const name = `Rapport ${reports.length + 1}`;
      const rep = await reportsApi.create(projectId, { name }, token);
      setReports((prev) => [...prev, rep]);
      switchReport(rep);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setCreatingReport(false);
    }
  }, [token, projectId, reports.length, creatingReport, switchReport]);

  const deleteReport = useCallback(async (reportId: string) => {
    if (!token || reports.length <= 1) return;
    try {
      await reportsApi.remove(reportId, token);
      const remaining = reports.filter((r) => r.id !== reportId);
      setReports(remaining);
      if (report?.id === reportId && remaining.length > 0) {
        switchReport(remaining[0]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  }, [token, reports, report, switchReport]);

  // ── PDF preview + export ──

  const loadPdfPreview = useCallback(async () => {
    if (!token || !selectedTemplateId) return;
    setPdfLoading(true);
    try {
      const result = await templatesApi.render(selectedTemplateId, projectId, token);
      const previewStyles = `
        @page { size: A4; margin: 0; }
        html, body {
          margin: 0;
          padding: 0;
          background: #525659;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          padding: 32px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }
        .page-sheet {
          width: 210mm;
          min-height: 297mm;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1);
          border-radius: 2px;
          padding: 20mm 18mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        @media print {
          html, body { background: white; padding: 0; gap: 0; }
          .page-sheet { box-shadow: none; border-radius: 0; width: auto; min-height: auto; padding: 0; margin: 0; }
        }
      `;
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${previewStyles}\n.page-sheet { }\n${result.css}</style></head><body><div class="page-sheet">${result.html}</div></body></html>`;
      setPdfPreviewHtml(fullHtml);
      setShowPdfPreview(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du rendu');
    } finally {
      setPdfLoading(false);
    }
  }, [token, selectedTemplateId, projectId]);

  const exportPdf = useCallback(() => {
    if (!pdfPreviewHtml) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(pdfPreviewHtml);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 300);
    };
  }, [pdfPreviewHtml]);

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
        tags: f.tags,
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

          {/* Report tabs */}
          {reports.length > 1 && (
            <div className="flex items-center gap-1 mx-4">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center group">
                  <button
                    onClick={() => switchReport(r)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                      report?.id === r.id
                        ? 'bg-accent/15 text-accent font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {r.name || 'Sans titre'}
                  </button>
                  {reports.length > 1 && report?.id !== r.id && (
                    <button
                      onClick={() => deleteReport(r.id)}
                      className="h-4 w-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={createReport}
                disabled={creatingReport}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Nouveau rapport"
              >
                {creatingReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </button>
            </div>
          )}

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

            {reports.length <= 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground"
                onClick={createReport}
                disabled={creatingReport}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nouveau rapport
              </Button>
            )}

            <div className="h-4 w-px bg-border" />

            {/* Template selector */}
            <div className="relative" ref={templateSelectRef}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowTemplateSelect(!showTemplateSelect)}
              >
                <FileText className="h-3 w-3" />
                {selectedTemplateId
                  ? templates.find((t) => t.id === selectedTemplateId)?.name || 'Template'
                  : 'Choisir un template'}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {showTemplateSelect && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover shadow-md py-1"
                >
                  {templates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun template disponible</div>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => assignTemplate(t.id)}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent/10 transition-colors text-left ${
                          selectedTemplateId === t.id ? 'text-accent font-medium' : 'text-foreground'
                        }`}
                      >
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate flex-1">{t.name}</span>
                        {t.isDefault && (
                          <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">défaut</span>
                        )}
                      </button>
                    ))
                  )}
                  {selectedTemplateId && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <button
                        onClick={() => assignTemplate(null)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/10"
                      >
                        <X className="h-3 w-3" />
                        Retirer le template
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* PDF actions */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={loadPdfPreview}
              disabled={!selectedTemplateId || pdfLoading}
            >
              {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              Aperçu PDF
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                if (pdfPreviewHtml) {
                  exportPdf();
                } else if (selectedTemplateId) {
                  loadPdfPreview().then(() => {
                    setTimeout(exportPdf, 500);
                  });
                }
              }}
              disabled={!selectedTemplateId || pdfLoading}
            >
              <Download className="h-3 w-3" />
              Exporter PDF
            </Button>
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
              onReorderSections={reorderSections}
            />
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {sections.length === 0 && findings.length === 0 ? (
              <EmptyState onGenerate={handleInitialize} findingsCount={findings.length} />
            ) : activeSection?.type === 'findings' ? (
              <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--fg-subtle)', fontSize: 11 }}>
                  <ShieldAlert size={12} />
                  Tableau des vulnérabilités
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
                  Vulnérabilités
                </h2>
                <FindingsSummaryTable findings={findings} />
              </div>
            ) : activeSection?.type === 'impacts' ? (
              <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--fg-subtle)', fontSize: 11 }}>
                  <Zap size={12} />
                  Synthèse automatique
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
                  Impacts
                </h2>
                <ImpactsSummaryView findings={findings} />
              </div>
            ) : activeSection?.type === 'attack_chains' ? (
              <AttackChainsEditor projectId={projectId} token={token!} allFindings={findings} />
            ) : activeSection ? (
              <SectionEditor
                section={activeSection}
                onTitleChange={(title) => updateSectionTitle(activeSection.id, title)}
                onContentChange={(raw) => updateSectionContent(activeSection.id, raw)}
                extraExtensions={extraExtensions}
                extraSlashItems={extraSlashItems}
                contentKey={contentVersion}
                actions={activeSection.type === 'recommendations' && findings.some((f) => f.remediation) ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      marginBottom: 16,
                      borderRadius: 'var(--r-md)',
                      background: 'color-mix(in oklch, var(--accent) 8%, var(--bg-elevated))',
                      border: '1px solid color-mix(in oklch, var(--accent) 20%, transparent)',
                    }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', flex: 1 }}>
                      Pré-remplir à partir des remédiations des findings
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleGenerateRecommendations(activeSection.id)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Générer
                    </Button>
                  </div>
                ) : undefined}
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

        {/* PDF Preview modal */}
        {showPdfPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowPdfPreview(false)}
          >
            <div
              className="bg-card rounded-xl border border-border shadow-2xl flex flex-col"
              style={{ width: '80vw', height: '85vh', maxWidth: 1000 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Aperçu du rapport</span>
                  <span className="text-xs text-muted-foreground">
                    ({templates.find((t) => t.id === selectedTemplateId)?.name})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={exportPdf}>
                    <Download className="h-3 w-3" />
                    Imprimer / PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowPdfPreview(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto rounded-b-xl" style={{ background: '#525659' }}>
                <iframe
                  srcDoc={pdfPreviewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  title="Aperçu PDF"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ReportProvider>
  );
}

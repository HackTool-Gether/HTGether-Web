'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useReport, REPORT_VARIABLES } from '@/lib/report-context';
import type { Severity } from '@/lib/api';

// ===== VariableNode (inline) =====

function VariableNodeView({ node }: any) {
  const { resolveVariable } = useReport();
  const path: string = node.attrs.path || '';
  const value = resolveVariable(path);
  const isUnknown = value === `{{ ${path} }}`;
  const color = isUnknown ? 'var(--sev-high-fg)' : 'var(--accent)';

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        title={path}
        contentEditable={false}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.05rem 0.4rem',
          borderRadius: 4,
          background: `color-mix(in oklch, ${color} 18%, transparent)`,
          color,
          border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85em',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          cursor: 'default',
          userSelect: 'all',
        }}
      >
        {value}
      </span>
    </NodeViewWrapper>
  );
}

export const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      path: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-path'),
        renderHTML: (attrs) => ({ 'data-path': attrs.path }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-variable': '', class: 'report-variable' }),
      `{{ ${HTMLAttributes['data-path'] || ''} }}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableNodeView);
  },
});

// ===== FindingsTableNode (block) =====

const SEV_LABEL: Record<Severity, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Haut',
  MEDIUM: 'Moyen',
  LOW: 'Bas',
  INFO: 'Info',
};

const SEV_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--sev-critical-fg)',
  HIGH: 'var(--sev-high-fg)',
  MEDIUM: 'var(--sev-medium-fg)',
  LOW: 'var(--sev-low-fg)',
  INFO: 'var(--sev-info-fg)',
};

const wrapperStyle: React.CSSProperties = {
  margin: '1rem 0',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'hidden',
  background: 'var(--bg-subtle)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.875rem',
  background: 'var(--bg-input)',
  borderBottom: '1px solid var(--border)',
  fontWeight: 500,
  color: 'var(--fg-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  borderTop: '1px solid var(--border)',
  color: 'var(--fg)',
  verticalAlign: 'top',
  fontSize: '0.875rem',
};

function FindingsTableNodeView() {
  const { findings } = useReport();

  if (findings.length === 0) {
    return (
      <NodeViewWrapper>
        <div
          contentEditable={false}
          style={{
            ...wrapperStyle,
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--fg-muted)',
            fontSize: '0.875rem',
          }}
        >
          Aucun finding pour ce projet
        </div>
      </NodeViewWrapper>
    );
  }

  const sorted = [...findings].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
  );

  return (
    <NodeViewWrapper>
      <div contentEditable={false} style={wrapperStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Slug</th>
              <th style={thStyle}>Titre</th>
              <th style={thStyle}>Sévérité</th>
              <th style={thStyle}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => {
              const c = SEV_COLOR[f.severity];
              return (
                <tr key={f.id}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {f.slug || '—'}
                  </td>
                  <td style={tdStyle}>{f.title}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 999,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: c,
                        background: `color-mix(in oklch, ${c} 15%, transparent)`,
                        border: `1px solid ${c}`,
                      }}
                    >
                      {SEV_LABEL[f.severity]}
                    </span>
                  </td>
                  <td style={tdStyle}>{f.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </NodeViewWrapper>
  );
}

export const FindingsTableNode = Node.create({
  name: 'findingsTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-findings-table]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-findings-table': '',
        class: 'report-findings-table-placeholder',
      }),
      'Tableau des findings',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FindingsTableNodeView);
  },
});

// ===== Slash items factory =====

import type { LucideIcon } from 'lucide-react';
import { Variable, Table2 } from 'lucide-react';

export interface ReportSlashItem {
  title: string;
  description: string;
  icon: any;
  command: (props: { editor: any; range: any }) => void;
}

export function buildReportSlashItems(): ReportSlashItem[] {
  const items: ReportSlashItem[] = [
    {
      title: 'Tableau des findings',
      description: 'Insère un tableau live des findings du projet',
      icon: <Table2 size={18} />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: 'findingsTable' })
          .run();
      },
    },
  ];

  for (const v of REPORT_VARIABLES) {
    items.push({
      title: `Variable: ${v.label}`,
      description: `{{ ${v.path} }} — ${v.group}`,
      icon: <Variable size={18} />,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'variable',
            attrs: { path: v.path },
          })
          .run();
      },
    });
  }

  return items;
}

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  BookOpen,
  Target,
  FlaskConical,
  Lightbulb,
  Flag,
  Search,
} from 'lucide-react';
import type { Severity } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────

export interface SidebarSection {
  id: string;
  type: string;
  title: string;
  predefined: boolean;
}

export interface SidebarFinding {
  id: string;
  title: string;
  slug?: string;
  severity: Severity;
  status: string;
  tags?: string;
}

export type ActiveView =
  | { kind: 'section'; id: string }
  | { kind: 'finding'; id: string }
  | null;

interface ReportSidebarProps {
  sections: SidebarSection[];
  findings: SidebarFinding[];
  activeView: ActiveView;
  onSelectSection: (id: string) => void;
  onSelectFinding: (id: string) => void;
  onAddSection: () => void;
  onDeleteSection: (id: string) => void;
}

// ── Constants ───────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--sev-critical-fg)',
  HIGH: 'var(--sev-high-fg)',
  MEDIUM: 'var(--sev-medium-fg)',
  LOW: 'var(--sev-low-fg)',
  INFO: 'var(--sev-info-fg)',
};

const SEV_SHORT: Record<Severity, string> = {
  CRITICAL: 'C',
  HIGH: 'H',
  MEDIUM: 'M',
  LOW: 'L',
  INFO: 'I',
};

const SECTION_ICON: Record<string, typeof FileText> = {
  executive_summary: BookOpen,
  scope: Target,
  methodology: FlaskConical,
  recommendations: Lightbulb,
  conclusion: Flag,
  custom: FileText,
};

// ── Component ───────────────────────────────────────────────────────────

export function ReportSidebar({
  sections,
  findings,
  activeView,
  onSelectSection,
  onSelectFinding,
  onAddSection,
  onDeleteSection,
}: ReportSidebarProps) {
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [findingsOpen, setFindingsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const allTags = Array.from(
    new Set(
      findings.flatMap((f) =>
        f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      ),
    ),
  ).sort();

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const filteredFindings = findings.filter((f) => {
    if (search) {
      const q = search.toLowerCase();
      const matchText =
        f.title.toLowerCase().includes(q) ||
        (f.slug && f.slug.toLowerCase().includes(q)) ||
        (f.tags && f.tags.toLowerCase().includes(q));
      if (!matchText) return false;
    }
    if (activeTags.length > 0) {
      const fTags = f.tags ? f.tags.split(',').map((t) => t.trim()) : [];
      if (!activeTags.some((t) => fTags.includes(t))) return false;
    }
    return true;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontSize: 13,
      }}
    >
      {/* Sections group */}
      <div style={{ padding: '12px 8px 4px' }}>
        <button
          type="button"
          onClick={() => setSectionsOpen(!sectionsOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            padding: '4px 6px',
            background: 'none',
            border: 'none',
            color: 'var(--fg-subtle)',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sectionsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Sections
          <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{sections.length}</span>
        </button>
      </div>

      {sectionsOpen && (
        <div style={{ padding: '0 8px' }}>
          {sections.map((sec) => {
            const isActive = activeView?.kind === 'section' && activeView.id === sec.id;
            const Icon = SECTION_ICON[sec.type] || FileText;

            return (
              <div
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className="group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 'var(--r-md)',
                  background: isActive ? 'var(--accent-tint)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
                  fontWeight: isActive ? 500 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={13} style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--fg-subtle)' }} />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                >
                  {sec.title}
                </span>
                {!sec.predefined && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection(sec.id);
                    }}
                    style={{
                      opacity: 0,
                      transition: 'opacity 0.1s',
                      background: 'none',
                      border: 'none',
                      color: 'var(--sev-critical-fg)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      flexShrink: 0,
                    }}
                    className="group-hover:!opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddSection}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '5px 8px',
              marginTop: 2,
              background: 'none',
              border: 'none',
              color: 'var(--fg-subtle)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: 'var(--r-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-subtle)';
            }}
          >
            <Plus size={12} />
            Ajouter une section
          </button>
        </div>
      )}

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 12px' }} />

      {/* Findings group */}
      <div style={{ padding: '4px 8px 4px' }}>
        <button
          type="button"
          onClick={() => setFindingsOpen(!findingsOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            padding: '4px 6px',
            background: 'none',
            border: 'none',
            color: 'var(--fg-subtle)',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {findingsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Vulnérabilités
          <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{findings.length}</span>
        </button>
      </div>

      {findingsOpen && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          {findings.length > 3 && (
            <div style={{ padding: '0 8px 4px' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={12}
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--fg-subtle)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 8px 4px 26px',
                    fontSize: 11.5,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    color: 'var(--fg)',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div style={{ padding: '0 8px 6px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {allTags.map((tag) => {
                const isActive = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: isActive ? 600 : 400,
                      borderRadius: 999,
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'var(--accent-tint)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--fg-subtle)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      transition: 'all 0.1s',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTags([])}
                  style={{
                    padding: '1px 6px',
                    fontSize: 10,
                    borderRadius: 999,
                    border: 'none',
                    background: 'none',
                    color: 'var(--fg-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  tout
                </button>
              )}
            </div>
          )}

          {/* Findings list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {filteredFindings.map((f) => {
              const isActive = activeView?.kind === 'finding' && activeView.id === f.id;
              const c = SEV_COLOR[f.severity];

              return (
                <div
                  key={f.id}
                  onClick={() => onSelectFinding(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 'var(--r-md)',
                    background: isActive ? 'var(--accent-tint)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: c,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12.5,
                    }}
                  >
                    {f.title}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: c,
                      flexShrink: 0,
                    }}
                  >
                    {SEV_SHORT[f.severity]}
                  </span>
                </div>
              );
            })}

            {findings.length === 0 && (
              <div style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12 }}>
                Aucun finding
              </div>
            )}

            {search && filteredFindings.length === 0 && findings.length > 0 && (
              <div style={{ padding: '8px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12 }}>
                Aucun résultat
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

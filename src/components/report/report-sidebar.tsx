'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  Plus,
  Trash2,
  GripVertical,
  BookOpen,
  Target,
  FlaskConical,
  Lightbulb,
  Flag,
  Search,
  ShieldAlert,
  Link2,
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
  onAddSection: (type?: string) => void;
  onDeleteSection: (id: string) => void;
  onReorderSections?: (fromIndex: number, toIndex: number) => void;
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
  findings: ShieldAlert,
  attack_chains: Link2,
  custom: FileText,
};

// ── Sortable section item ──────────────────────────────────────────────

function SortableSectionItem({
  sec,
  isActive,
  onSelect,
  onDelete,
  badge,
}: {
  sec: SidebarSection;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  badge?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sec.id });

  const Icon = SECTION_ICON[sec.type] || FileText;
  const isDeletable = !sec.predefined;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    borderRadius: 'var(--r-md)',
    background: isDragging
      ? 'var(--bg-subtle)'
      : isActive
        ? 'var(--accent-tint)'
        : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
    color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
    fontWeight: isActive ? 500 : 400,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className="group"
      onMouseEnter={(e) => {
        if (!isActive && !isDragging) e.currentTarget.style.background = 'var(--bg-subtle)';
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isDragging) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          color: 'var(--fg-subtle)',
          opacity: 0,
          transition: 'opacity 0.1s',
          flexShrink: 0,
          padding: '0 2px',
        }}
        className="group-hover:!opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={11} />
      </span>
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
      {badge !== undefined && (
        <span
          className="font-mono"
          style={{ fontSize: 9, color: 'var(--fg-subtle)', flexShrink: 0 }}
        >
          {badge}
        </span>
      )}
      {isDeletable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
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
}

// ── Component ───────────────────────────────────────────────────────────

export function ReportSidebar({
  sections,
  findings,
  activeView,
  onSelectSection,
  onSelectFinding,
  onAddSection,
  onDeleteSection,
  onReorderSections,
}: ReportSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderSections) return;
    const fromIndex = sections.findIndex((s) => s.id === active.id);
    const toIndex = sections.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderSections(fromIndex, toIndex);
    }
  };

  const findingsSectionId = sections.find((s) => s.type === 'findings')?.id;
  const hasFindingsSection = !!findingsSectionId;
  const hasAttackChainsSection = sections.some((s) => s.type === 'attack_chains');

  const showFindingsList =
    (activeView?.kind === 'section' && activeView.id === findingsSectionId) ||
    activeView?.kind === 'finding';

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
      {/* Header */}
      <div style={{ padding: '12px 8px 4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 6px',
            color: 'var(--fg-subtle)',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Sections
          <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{sections.length}</span>
        </div>
      </div>

      {/* Sortable sections with inline sub-lists */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((sec) => {
              const isSectionActive = activeView?.kind === 'section' && activeView.id === sec.id;
              const isParentOfFinding = sec.type === 'findings' && activeView?.kind === 'finding';
              const isHighlighted = isSectionActive || isParentOfFinding;

              return (
                <div key={sec.id}>
                  <SortableSectionItem
                    sec={sec}
                    isActive={isHighlighted}
                    onSelect={() => onSelectSection(sec.id)}
                    onDelete={() => onDeleteSection(sec.id)}
                    badge={sec.type === 'findings' ? findings.length : undefined}
                  />

                  {/* Findings sub-list (shown when findings section or a finding is active) */}
                  {sec.type === 'findings' && showFindingsList && (
                    <div style={{ paddingLeft: 12, paddingBottom: 4 }}>
                      {/* Search */}
                      {findings.length > 3 && (
                        <div style={{ padding: '4px 0' }}>
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
                        <div style={{ padding: '0 0 6px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {allTags.map((tag) => {
                            const isTagActive = activeTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                style={{
                                  padding: '1px 6px',
                                  fontSize: 10,
                                  fontWeight: isTagActive ? 600 : 400,
                                  borderRadius: 999,
                                  border: `1px solid ${isTagActive ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isTagActive ? 'var(--accent-tint)' : 'transparent',
                                  color: isTagActive ? 'var(--accent)' : 'var(--fg-subtle)',
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

                      {/* Finding items */}
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
                              padding: '5px 8px',
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
                                width: 6,
                                height: 6,
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
                                fontSize: 11.5,
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
                        <div style={{ padding: '8px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 11 }}>
                          Aucun finding
                        </div>
                      )}

                      {search && filteredFindings.length === 0 && findings.length > 0 && (
                        <div style={{ padding: '8px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 11 }}>
                          Aucun résultat
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Separator */}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 4px' }} />

        {/* Add section buttons */}
        <button
          type="button"
          onClick={() => onAddSection()}
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

        {!hasFindingsSection && (
          <button
            type="button"
            onClick={() => onAddSection('findings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '5px 8px',
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
            <ShieldAlert size={12} />
            Ajouter les vulnérabilités
          </button>
        )}

        {!hasAttackChainsSection && (
          <button
            type="button"
            onClick={() => onAddSection('attack_chains')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '5px 8px',
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
            <Link2 size={12} />
            Ajouter les chaînes d&apos;attaque
          </button>
        )}
      </div>
    </div>
  );
}

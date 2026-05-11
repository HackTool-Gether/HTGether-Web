'use client';

import { useState, useRef, useEffect } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  ShieldAlert,
  Table2,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import type { Severity } from '@/lib/api';

export interface OutlineBlock {
  id: string;
  type: 'section' | 'finding' | 'summary';
  title: string;
  severity?: Severity;
}

interface AvailableFinding {
  id: string;
  title: string;
  severity: Severity;
  slug?: string;
}

interface ReportOutlineProps {
  items: OutlineBlock[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onAddSection: () => void;
  onAddSummary: () => void;
  onImportFinding: (findingId: string) => void;
  onImportAllFindings: () => void;
  onGenerate: () => void;
  availableFindings: AvailableFinding[];
}

const SEV_DOT: Record<Severity, string> = {
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

const TYPE_ICON = {
  section: FileText,
  finding: ShieldAlert,
  summary: Table2,
};

function SortableItem({
  block,
  isActive,
  onSelect,
  onDelete,
}: {
  block: OutlineBlock;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const Icon = TYPE_ICON[block.type];
  const sevColor = block.severity ? SEV_DOT[block.severity] : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 'var(--r-md)',
          background: isActive ? 'var(--accent-tint)' : 'transparent',
          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: 'pointer',
          fontSize: 12.5,
          color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
          fontWeight: isActive ? 500 : 400,
          transition: 'background 0.1s, color 0.1s',
          position: 'relative',
          fontFamily: 'inherit',
        }}
        className="group"
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            color: 'var(--fg-subtle)',
            background: 'none',
            border: 'none',
            padding: 0,
            display: 'flex',
            flexShrink: 0,
          }}
          tabIndex={-1}
        >
          <GripVertical size={12} />
        </button>

        {sevColor ? (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: sevColor,
              flexShrink: 0,
            }}
          />
        ) : (
          <Icon size={13} style={{ flexShrink: 0, color: 'var(--fg-subtle)' }} />
        )}

        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {block.title || 'Sans titre'}
        </span>

        {block.severity && (
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: sevColor,
              flexShrink: 0,
            }}
          >
            {SEV_SHORT[block.severity]}
          </span>
        )}

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
      </div>
    </div>
  );
}

function AddMenu({
  availableFindings,
  onAddSection,
  onAddSummary,
  onImportFinding,
  onImportAllFindings,
  onGenerate,
}: {
  availableFindings: AvailableFinding[];
  onAddSection: () => void;
  onAddSummary: () => void;
  onImportFinding: (id: string) => void;
  onImportAllFindings: () => void;
  onGenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowFindings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menuItem = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    extra?: React.ReactNode,
  ) => (
    <button
      type="button"
      key={label}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        color: 'var(--fg)',
        fontSize: 12.5,
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: 'var(--fg-subtle)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {extra}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowFindings(false); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '7px 10px',
          background: 'transparent',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--fg-muted)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--fg-muted)';
        }}
      >
        <Plus size={13} />
        Ajouter un bloc
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: 4,
            zIndex: 30,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {menuItem('Section libre', <FileText size={14} />, () => {
            onAddSection();
            setOpen(false);
          })}

          {menuItem(
            'Importer un finding',
            <ShieldAlert size={14} />,
            () => setShowFindings(!showFindings),
            <ChevronRight
              size={11}
              style={{
                color: 'var(--fg-subtle)',
                transform: showFindings ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />,
          )}

          {showFindings && (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                marginLeft: 12,
                borderLeft: '1px solid var(--border-subtle)',
                paddingLeft: 4,
              }}
            >
              {availableFindings.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onImportAllFindings();
                      setOpen(false);
                      setShowFindings(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      padding: '5px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      fontWeight: 500,
                      textAlign: 'left',
                      borderRadius: 'var(--r-sm)',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Importer tous ({availableFindings.length})
                  </button>
                  {availableFindings.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onImportFinding(f.id);
                        setOpen(false);
                        setShowFindings(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '4px 8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--fg)',
                        fontSize: 11.5,
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: 'var(--r-sm)',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: SEV_DOT[f.severity],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.slug ? `${f.slug} — ` : ''}{f.title}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--fg-subtle)' }}>
                  Tous les findings sont importés
                </div>
              )}
            </div>
          )}

          {menuItem('Tableau de synthèse', <Table2 size={14} />, () => {
            onAddSummary();
            setOpen(false);
          })}

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

          {menuItem('Générer le rapport', <Sparkles size={14} />, () => {
            onGenerate();
            setOpen(false);
          })}
        </div>
      )}
    </div>
  );
}

export function ReportOutline({
  items,
  activeId,
  onSelect,
  onReorder,
  onDelete,
  onAddSection,
  onAddSummary,
  onImportFinding,
  onImportAllFindings,
  onGenerate,
  availableFindings,
}: ReportOutlineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((b) => b.id === active.id);
    const newIdx = items.findIndex((b) => b.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(items, oldIdx, newIdx);
    onReorder(reordered.map((b) => b.id));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px 8px',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--fg-subtle)',
          padding: '0 8px 4px',
        }}
      >
        Plan du rapport
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {items.map((block) => (
              <SortableItem
                key={block.id}
                block={block}
                isActive={block.id === activeId}
                onSelect={() => onSelect(block.id)}
                onDelete={() => onDelete(block.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 8px',
              color: 'var(--fg-subtle)',
              fontSize: 12,
            }}
          >
            Aucun bloc
          </div>
        )}
      </div>

      <AddMenu
        availableFindings={availableFindings}
        onAddSection={onAddSection}
        onAddSummary={onAddSummary}
        onImportFinding={onImportFinding}
        onImportAllFindings={onImportAllFindings}
        onGenerate={onGenerate}
      />
    </div>
  );
}

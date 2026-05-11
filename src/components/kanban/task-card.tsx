'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskPriority, ProjectMember } from '@/lib/api';
import { Avatar } from '@/components/shell/avatar';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu';
import { Calendar, UserPlus, Pencil, Trash2, UserCheck } from 'lucide-react';

const PRIORITY_BADGE: Record<TaskPriority, { label: string; color: string }> = {
  CRITICAL: { label: 'Critique', color: 'var(--sev-critical-fg, oklch(0.65 0.22 25))' },
  HIGH: { label: 'Haute', color: 'var(--sev-high-fg, oklch(0.72 0.18 40))' },
  MEDIUM: { label: 'Moyenne', color: 'var(--sev-medium-fg, oklch(0.80 0.15 80))' },
  LOW: { label: 'Basse', color: 'var(--sev-low-fg, oklch(0.65 0.15 250))' },
};

interface TaskCardProps {
  task: Task;
  members: ProjectMember[];
  onEdit: (task: Task) => void;
  onAssign: (taskId: string, memberId: string | null) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, members, onEdit, onAssign, onDelete }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prio = PRIORITY_BADGE[task.priority];
  const assignee = task.assignee?.user;

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPicker((v) => !v);
  };

  const handlePickMember = (e: React.MouseEvent, memberId: string | null) => {
    e.stopPropagation();
    onAssign(task.id, memberId);
    setShowPicker(false);
  };

  const contextItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = [
      {
        label: 'Modifier',
        icon: <Pencil className="h-3.5 w-3.5" />,
        onClick: () => onEdit(task),
      },
      {
        label: assignee ? 'Réassigner' : 'Assigner',
        icon: <UserCheck className="h-3.5 w-3.5" />,
        onClick: () => setShowPicker(true),
      },
    ];
    if (onDelete) {
      items.push({
        label: 'Supprimer',
        icon: <Trash2 className="h-3.5 w-3.5" />,
        onClick: () => onDelete(task.id),
        variant: 'destructive',
      });
    }
    return items;
  }, [task, assignee, onEdit, onDelete]);

  return (
    <ContextMenu items={contextItems}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onEdit(task)}
        className="rounded-lg border border-border bg-background p-3 cursor-grab active:cursor-grabbing hover:border-border-strong transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium leading-snug line-clamp-2">
            {task.title}
          </span>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ color: prio.color, background: `color-mix(in oklch, ${prio.color} 15%, transparent)` }}
          >
            {prio.label}
          </span>

          {task.dueDate && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}

          <div className="ml-auto relative" ref={pickerRef}>
            <button
              type="button"
              onClick={handleAvatarClick}
              className="flex items-center justify-center rounded-full transition-colors hover:opacity-80"
              title={assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Assigner un membre'}
            >
              {assignee ? (
                <Avatar user={{ id: assignee.id, name: `${assignee.firstName} ${assignee.lastName}` }} />
              ) : (
                <span className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <UserPlus className="h-2.5 w-2.5 text-muted-foreground/60" />
                </span>
              )}
            </button>

            {showPicker && (
              <div className="absolute right-0 bottom-full mb-1 z-50 w-48 rounded-lg bg-popover border border-border shadow-lg py-1 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors text-left"
                  onClick={(e) => handlePickMember(e, null)}
                >
                  Non assigné
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left ${
                      task.assigneeId === m.id ? 'bg-accent/50 font-medium' : ''
                    }`}
                    onClick={(e) => handlePickMember(e, m.id)}
                  >
                    <Avatar user={{ id: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` }} />
                    <span className="truncate">{m.user.firstName} {m.user.lastName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ContextMenu>
  );
}

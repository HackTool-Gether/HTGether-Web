'use client';

import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Task, TaskStatus, ProjectMember } from '@/lib/api';
import { TaskCard } from './task-card';
import { Button } from '@/components/ui/button';
import { ContextMenu } from '@/components/ui/context-menu';
import { Plus, Pencil } from 'lucide-react';

export const DEFAULT_COLUMN_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
};

const COLUMN_COLORS: Record<TaskStatus, string> = {
  BACKLOG: 'oklch(0.62 0.01 250)',
  TODO: 'oklch(0.65 0.18 260)',
  IN_PROGRESS: 'oklch(0.78 0.16 70)',
  DONE: 'oklch(0.75 0.13 155)',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  label: string;
  members: ProjectMember[];
  onEdit: (task: Task) => void;
  onAdd: (status: TaskStatus) => void;
  onRenameColumn: (status: TaskStatus, label: string) => void;
  onAssign: (taskId: string, memberId: string | null) => void;
  onDelete: (taskId: string) => void;
}

export function KanbanColumn({
  status,
  tasks,
  label,
  members,
  onEdit,
  onAdd,
  onRenameColumn,
  onAssign,
  onDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = COLUMN_COLORS[status];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startRename = () => {
    setDraft(label);
    setEditing(true);
  };

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      onRenameColumn(status, trimmed);
    } else {
      setDraft(label);
    }
    setEditing(false);
  };

  const columnContextItems = [
    {
      label: 'Renommer',
      icon: <Pencil className="h-3.5 w-3.5" />,
      onClick: startRename,
    },
    {
      label: 'Ajouter une tâche',
      icon: <Plus className="h-3.5 w-3.5" />,
      onClick: () => onAdd(status),
    },
  ];

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <ContextMenu items={columnContextItems}>
        <div className="flex items-center gap-2 px-2 pb-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: color }}
          />
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setDraft(label); setEditing(false); }
              }}
              className="text-xs font-semibold bg-transparent border-b border-foreground/30 outline-none w-full py-0"
            />
          ) : (
            <span
              className="text-xs font-semibold cursor-default select-none"
              onDoubleClick={startRename}
            >
              {label}
            </span>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            {tasks.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0"
            onClick={() => onAdd(status)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </ContextMenu>

      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-2 p-1 rounded-lg transition-colors min-h-[100px]"
        style={{
          background: isOver ? 'var(--bg-subtle)' : undefined,
        }}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onEdit={onEdit}
              onAssign={onAssign}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

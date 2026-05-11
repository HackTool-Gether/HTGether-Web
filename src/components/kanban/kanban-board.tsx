'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Task, TaskStatus, ProjectMember } from '@/lib/api';
import { tasksApi } from '@/lib/api';
import { KanbanColumn } from './kanban-column';
import { TaskCard } from './task-card';

const COLUMNS: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'];

interface KanbanBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: ProjectMember[];
  token: string;
  projectId: string;
  columnLabels: Record<string, string>;
  onEdit: (task: Task) => void;
  onAdd: (status: TaskStatus) => void;
  onRenameColumn: (status: TaskStatus, label: string) => void;
  onAssign: (taskId: string, memberId: string | null) => void;
  onDelete: (taskId: string) => void;
}

export function KanbanBoard({
  tasks,
  setTasks,
  members,
  token,
  columnLabels,
  onEdit,
  onAdd,
  onRenameColumn,
  onAssign,
  onDelete,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const getTasksByStatus = useCallback(
    (status: TaskStatus) =>
      tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.position - b.position),
    [tasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskItem = tasks.find((t) => t.id === activeId);
    if (!activeTaskItem) return;

    const overColumn = COLUMNS.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status;

    if (!overColumn || activeTaskItem.status === overColumn) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, status: overColumn } : t,
      ),
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    const targetStatus = COLUMNS.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status ?? task.status;

    const columnTasks = tasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.position - b.position);

    let newPosition: number;

    if (overId === targetStatus || !columnTasks.find((t) => t.id === overId)) {
      newPosition = columnTasks.length;
    } else {
      const overIndex = columnTasks.findIndex((t) => t.id === overId);
      const activeIndex = columnTasks.findIndex((t) => t.id === activeId);

      if (activeIndex >= 0) {
        const reordered = arrayMove(columnTasks, activeIndex, overIndex);
        setTasks((prev) => {
          const others = prev.filter(
            (t) => t.status !== targetStatus || t.id === activeId,
          );
          const updated = reordered.map((t, i) => ({
            ...t,
            position: i,
            status: targetStatus,
          }));
          return [
            ...others.filter((t) => t.id !== activeId),
            ...updated,
          ];
        });
        newPosition = overIndex;
      } else {
        newPosition = overIndex;
      }
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? { ...t, status: targetStatus, position: newPosition }
          : t,
      ),
    );

    try {
      await tasksApi.move(activeId, { status: targetStatus, position: newPosition }, token);
    } catch {
      // Revert on error — reload will fix state
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-0 flex-1">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getTasksByStatus(status)}
            label={columnLabels[status] || status}
            members={members}
            onEdit={onEdit}
            onAdd={onAdd}
            onRenameColumn={onRenameColumn}
            onAssign={onAssign}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90">
            <TaskCard task={activeTask} members={[]} onEdit={() => {}} onAssign={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

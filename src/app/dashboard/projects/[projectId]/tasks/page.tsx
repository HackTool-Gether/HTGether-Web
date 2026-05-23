'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useShell } from '@/components/shell/shell-context';
import {
  projectsApi,
  tasksApi,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type ProjectDetail,
  type ProjectMember,
  type KanbanConfig,
} from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { DEFAULT_COLUMN_LABELS } from '@/components/kanban/kanban-column';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, X, Plus } from 'lucide-react';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'LOW', label: 'Basse' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
];

export default function TasksPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({ ...DEFAULT_COLUMN_LABELS });

  // Modal state
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('BACKLOG');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    status: 'BACKLOG' as TaskStatus,
    assigneeId: '',
    dueDate: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [proj, taskList] = await Promise.all([
        projectsApi.getOne(projectId, token),
        tasksApi.getAllByProject(projectId, token),
      ]);
      setProject(proj);
      setTasks(taskList);
      const savedLabels = (proj.kanbanConfig as KanbanConfig | undefined)?.labels;
      if (savedLabels) {
        setColumnLabels({ ...DEFAULT_COLUMN_LABELS, ...savedLabels });
      }
    } catch {
      setError('Impossible de charger les tâches');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (project) {
      setActiveProject({
        id: project.id,
        slug: project.name,
        findingsCount: 0,
      });
    }
    return () => setActiveProject(null);
  }, [project, setActiveProject]);

  const openCreate = (status: TaskStatus) => {
    setModalMode('create');
    setModalTask(null);
    setDefaultStatus(status);
    setForm({
      title: '',
      description: '',
      priority: 'MEDIUM',
      status,
      assigneeId: '',
      dueDate: '',
    });
    setShowModal(true);
  };

  const openEdit = (task: Task) => {
    setModalMode('edit');
    setModalTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      assigneeId: task.assigneeId || '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (modalMode === 'create') {
        const created = await tasksApi.create(
          projectId,
          {
            title: form.title,
            description: form.description || undefined,
            priority: form.priority,
            assigneeId: form.assigneeId || undefined,
            dueDate: form.dueDate || undefined,
          },
          token,
        );
        if (form.status !== 'BACKLOG') {
          const moved = await tasksApi.move(
            created.id,
            { status: form.status, position: 0 },
            token,
          );
          setTasks((prev) => [...prev, moved]);
        } else {
          setTasks((prev) => [...prev, created]);
        }
      } else if (modalTask) {
        const updated = await tasksApi.update(
          modalTask.id,
          {
            title: form.title,
            description: form.description || undefined,
            priority: form.priority,
            status: form.status,
            assigneeId: form.assigneeId || undefined,
            dueDate: form.dueDate || undefined,
          },
          token,
        );
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
      setShowModal(false);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!modalTask || !token) return;
    setSaving(true);
    try {
      await tasksApi.remove(modalTask.id, token);
      setTasks((prev) => prev.filter((t) => t.id !== modalTask.id));
      setShowModal(false);
    } catch {
      setError('Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameColumn = async (status: TaskStatus, label: string) => {
    const newLabels = { ...columnLabels, [status]: label };
    setColumnLabels(newLabels);
    if (!token) return;
    try {
      await projectsApi.updateKanbanConfig(projectId, newLabels, token);
    } catch {
      // revert silently
      setColumnLabels(columnLabels);
    }
  };

  const handleDeleteFromBoard = async (taskId: string) => {
    if (!token) return;
    try {
      await tasksApi.remove(taskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleAssign = async (taskId: string, memberId: string | null) => {
    if (!token) return;
    try {
      const updated = await tasksApi.update(
        taskId,
        { assigneeId: memberId || undefined },
        token,
      );
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError("Erreur lors de l'assignation");
    }
  };

  const members = project?.members || [];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
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
          <h1 className="text-2xl font-bold">
            Tâches
            <span className="ml-2 text-base font-normal text-muted-foreground font-mono">
              {tasks.length}
            </span>
          </h1>
        </div>
        <Button size="sm" onClick={() => openCreate('TODO')}>
          <Plus className="mr-1 h-3 w-3" /> Nouvelle tâche
        </Button>
      </div>

      {error && (
        <div className="mx-4 sm:mx-8 mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden px-4 sm:px-8">
        <KanbanBoard
          tasks={tasks}
          setTasks={setTasks}
          members={members}
          token={token || ''}
          projectId={projectId}
          columnLabels={columnLabels}
          onEdit={openEdit}
          onAdd={openCreate}
          onRenameColumn={handleRenameColumn}
          onAssign={handleAssign}
          onDelete={handleDeleteFromBoard}
        />
      </div>

      {/* Task modal (slide-over) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">
                  {modalMode === 'create' ? 'Nouvelle tâche' : 'Modifier la tâche'}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowModal(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    placeholder="Titre de la tâche"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    placeholder="Description (optionnel)"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Assigné</Label>
                    <Select
                      value={form.assigneeId || '__none__'}
                      onValueChange={(v) => setForm({ ...form, assigneeId: !v || v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non assigné">
                          {form.assigneeId
                            ? (() => {
                                const m = members.find((mb) => mb.id === form.assigneeId);
                                return m ? `${m.user.firstName} ${m.user.lastName}` : 'Non assigné';
                              })()
                            : 'Non assigné'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non assigné</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.user.firstName} {m.user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Échéance</Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  {modalMode === 'edit' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      Supprimer
                    </Button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowModal(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

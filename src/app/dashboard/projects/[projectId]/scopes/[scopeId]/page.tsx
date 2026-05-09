'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { scopesApi, notesApi, ApiError } from '@/lib/api';
import type { ScopeDetail, Note } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
  Clock,
} from 'lucide-react';

export default function ScopeDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const scopeId = params.scopeId as string;

  const [scope, setScope] = useState<ScopeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await scopesApi.getOne(projectId, scopeId, token);
      setScope(data);
    } catch {
      setError('Impossible de charger le scope');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, scopeId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      const note = await notesApi.create(projectId, scopeId, { title: newTitle }, token);
      router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
      setCreating(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!token) return;
    try {
      await notesApi.remove(noteId, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!scope) {
    return (
      <div className="px-4 sm:px-8 pt-4 sm:pt-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Scope introuvable</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {scope.project.name}
          </Button>
          <h1 className="text-2xl font-bold">{scope.name}</h1>
          {scope.description && (
            <p className="text-sm text-muted-foreground mt-1">{scope.description}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Notes header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Notes</h2>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Nouvelle note
          </Button>
        </div>

        {/* Create note form */}
        {showNew && (
          <div className="rounded-xl bg-card p-4 mb-4">
            <form onSubmit={handleCreateNote} className="flex items-center gap-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titre de la note..."
                required
                autoFocus
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Créer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewTitle(''); }}>
                Annuler
              </Button>
            </form>
          </div>
        )}

        {/* Notes list */}
        {scope.notes.length === 0 && !showNew ? (
          <div className="rounded-xl bg-card flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Aucune note</p>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première note pour documenter vos observations
            </p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle note
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {scope.notes.map((note: Note) => (
              <div
                key={note.id}
                className="rounded-xl bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}/notes/${note.id}`)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{note.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {note.author.firstName} {note.author.lastName}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

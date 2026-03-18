'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { notesApi, ApiError } from '@/lib/api';
import type { NoteDetail } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';

// Lazy-load TipTap editor for SSR compat
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="h-[300px] rounded-lg border bg-muted/30 animate-pulse" /> },
);

export default function NoteEditorPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const scopeId = params.scopeId as string;
  const noteId = params.noteId as string;

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save timer
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const titleRef = useRef(title);

  contentRef.current = content;
  titleRef.current = title;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await notesApi.getOne(noteId, token);
      setNote(data);
      setTitle(data.title);
      setContent(data.content);
    } catch {
      setError('Impossible de charger la note');
    } finally {
      setLoading(false);
    }
  }, [token, noteId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!token || !note) return;
    setSaving(true);
    try {
      await notesApi.update(noteId, { title: titleRef.current, content: contentRef.current }, token);
      setLastSaved(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [token, noteId, note]);

  // Auto-save on content/title change (debounced 2s)
  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 2000);
  }, [save]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleAutosave();
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    scheduleAutosave();
  };

  // Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Note introuvable</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {note.scope.name}
          </Button>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">{note.scope.project.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sauvegarde...
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-500" />
              Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-6 mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        {/* Title */}
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Titre de la note..."
          className="border-none text-2xl font-bold h-auto py-2 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
        />

        <p className="text-xs text-muted-foreground mb-4">
          Par {note.author.firstName} {note.author.lastName}
        </p>

        {/* Rich text editor */}
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Commencez à documenter vos observations..."
        />
      </div>
    </div>
  );
}

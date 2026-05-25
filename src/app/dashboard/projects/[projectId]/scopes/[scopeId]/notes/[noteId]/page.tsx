'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { notesApi, ApiError } from '@/lib/api';
import type { NoteDetail } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  Clock,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';

// Lazy-load TipTap editor for SSR compat
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[60vh] animate-pulse opacity-10" />
    ),
  },
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

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    if (!token || !note) return;
    setSaving(true);
    try {
      await notesApi.update(
        noteId,
        { title: titleRef.current, content: contentRef.current },
        token,
      );
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
    scheduleAutosave();
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus the editor
      const editorEl = document.querySelector('.notion-editor') as HTMLElement;
      editorEl?.focus();
    }
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      {/* Top bar - minimal */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={() => router.push(`/dashboard/projects/${projectId}`)}
            className="hover:text-foreground transition-colors"
          >
            {note.scope.project.name}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/scopes/${scopeId}`)
            }
            className="hover:text-foreground transition-colors"
          >
            {note.scope.name}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {title || 'Sans titre'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sauvegarde...
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-xs text-green-500/80">
              <Check className="h-3 w-3" />
              Sauvegarde
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(note.updatedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-6 mt-4 max-w-3xl self-center w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Editor area - centered like Notion */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-10 lg:px-16">
          {/* Title */}
          <textarea
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Sans titre"
            rows={1}
            className="w-full bg-transparent text-4xl font-bold tracking-tight resize-none border-none outline-none placeholder:text-muted-foreground/30 text-foreground leading-tight mb-1"
            style={{ overflow: 'hidden' }}
          />

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-8 pb-8">
            <span>
              {note.author.firstName} {note.author.lastName}
            </span>
            <span>
              {new Date(note.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Rich text editor */}
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Tapez '/' pour les commandes..."
            projectId={projectId}
          />
        </div>
      </div>
    </div>
  );
}

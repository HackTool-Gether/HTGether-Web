'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import {
  reportsApi,
  projectsApi,
  findingsApi,
  ApiError,
  type ProjectDetail,
  type Finding,
  type Report,
} from '@/lib/api';
import { Topbar } from '@/components/shell/topbar';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  ReportProvider,
} from '@/lib/report-context';
import {
  VariableNode,
  FindingsTableNode,
  buildReportSlashItems,
} from '@/components/editor/report-nodes';

export default function ProjectReportPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [content, setContent] = useState<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const [proj, fdg, rep] = await Promise.all([
          projectsApi.getOne(projectId, token),
          findingsApi.getAllByProject(projectId, token),
          reportsApi.get(projectId, token),
        ]);
        if (!mounted) return;
        setProject(proj);
        setFindings(fdg);
        setReport(rep);
        // content may be ProseMirror JSON or null
        const initial = rep.content && typeof rep.content === 'object'
          ? JSON.stringify(rep.content)
          : '';
        setContent(initial);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : 'Erreur de chargement');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, projectId]);

  // Sidebar context
  useEffect(() => {
    if (project) {
      setActiveProject({
        id: project.id,
        slug: project.name,
        findingsCount: findings.length,
      });
    }
    return () => setActiveProject(null);
  }, [project, findings.length, setActiveProject]);

  // Persist with debounce — only after first load and only on real changes
  const persist = useCallback(
    (raw: string) => {
      if (!token || !report) return;
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      setSaveState('saving');
      reportsApi
        .update(projectId, parsed, token)
        .then((r) => {
          setReport(r);
          setSaveState('saved');
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Erreur de sauvegarde');
          setSaveState('error');
        });
    },
    [token, report, projectId],
  );

  const handleChange = (next: string) => {
    setContent(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 1500);
  };

  // Build slash items + extensions once
  const extraExtensions = useMemo(() => [VariableNode, FindingsTableNode], []);
  const extraSlashItems = useMemo(() => buildReportSlashItems(), []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ReportProvider project={project} findings={findings}>
      <div className="flex-1 overflow-auto">
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-4 max-w-[880px]">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground mb-1" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
                <ArrowLeft className="h-3 w-3 mr-1" />
                {project?.name || '…'}
              </Button>
              <h1 className="text-2xl font-bold">Rapport</h1>
            </div>
            <span
              className="font-mono text-[11px]"
              style={{
                color:
                  saveState === 'saving'
                    ? 'var(--fg-muted)'
                    : saveState === 'saved'
                      ? 'var(--st-compliant-fg)'
                      : saveState === 'error'
                        ? 'var(--sev-critical-fg)'
                        : 'var(--fg-subtle)',
              }}
            >
              {saveState === 'saving' && 'enregistrement…'}
              {saveState === 'saved' && '✓ enregistré'}
              {saveState === 'error' && 'erreur'}
            </span>
          </div>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--fg-muted)',
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              <FileText size={13} />
              <span className="cap">Rapport de mission</span>
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--fg)',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {project?.name}
            </h1>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: 'var(--fg-subtle)',
              }}
            >
              Tapez <span className="kbd">/</span> pour insérer une variable, un tableau de findings, ou un bloc.
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'color-mix(in oklch, var(--sev-critical-fg) 10%, transparent)',
                color: 'var(--sev-critical-fg)',
                borderRadius: 'var(--r-md)',
                fontSize: 12.5,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Editor */}
          <div
            style={{
              padding: '24px 28px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--r-lg, 12px)',
              minHeight: 480,
            }}
          >
            <RichTextEditor
              content={content}
              onChange={handleChange}
              storageMode="json"
              placeholder="Commencez votre rapport… (tapez / pour les commandes)"
              extraExtensions={extraExtensions}
              extraSlashItems={extraSlashItems}
            />
          </div>
        </div>
      </div>
    </ReportProvider>
  );
}

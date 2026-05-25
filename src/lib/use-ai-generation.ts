'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from './auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function useAiGeneration() {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (params: {
    content: string;
    images?: string[];
    projectId?: string;
    action: 'reformulate' | 'generate' | 'complete';
    onChunk: (text: string) => void;
    onDone: (fullText: string) => void;
    onError?: (error: string) => void;
  }) => {
    if (!token) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);

    try {
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: params.content,
          images: params.images,
          projectId: params.projectId,
          action: params.action,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: 'Erreur IA' }));
        params.onError?.(err.message);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                params.onError?.(data.error);
                setGenerating(false);
                return;
              }
              if (data.text) {
                fullText += data.text;
                params.onChunk(data.text);
              }
            } catch { /* skip malformed */ }
          }
        }
      }

      params.onDone(fullText);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        params.onError?.(err.message || 'Erreur de connexion');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [token]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  }, []);

  return { generating, generate, cancel };
}

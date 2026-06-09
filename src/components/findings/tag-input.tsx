'use client';

import { useState, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { searchVulnTags } from '@/lib/vuln-tags';

interface TagInputProps {
  // Comma-separated tag string (the storage format used by the Finding model).
  value: string;
  onChange: (value: string) => void;
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Smart tag editor with OWASP/CWE autocomplete. Type a keyword (e.g. "xss"),
// pick a suggestion, and the associated CWE/OWASP tag is added as a chip.
export function TagInput({ value, onChange }: TagInputProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => parseTags(value), [value]);
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const existing = new Set(tags.map((t) => t.toLowerCase()));
    return searchVulnTags(query).filter((s) => !existing.has(s.tag.toLowerCase()));
  }, [query, tags]);

  const commit = (next: string[]) => {
    // De-duplicate while preserving order.
    const seen = new Set<string>();
    const deduped = next.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    onChange(deduped.join(', '));
  };

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    commit([...tags, clean]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    commit(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) addTag(suggestions[0].tag);
      else if (query.trim()) addTag(query);
    } else if (e.key === 'Backspace' && !query && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {tags.map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--r-sm)',
                fontSize: 10.5,
                color: 'var(--fg-muted)',
              }}
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Retirer ${t}`}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  color: 'var(--fg-subtle)',
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        className="input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Rechercher (ex. XSS, IDOR, SSRF…)"
      />

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.3))',
            zIndex: 20,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s.tag);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 10px',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: s.source === 'OWASP' ? 'var(--accent)' : 'var(--fg-muted)',
                  minWidth: 64,
                }}
              >
                {s.tag}
              </span>
              <span style={{ fontSize: 12, color: 'var(--fg)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 4 }}>
        Entrée pour ajouter · CWE/OWASP auto-complétés.
      </div>
    </div>
  );
}

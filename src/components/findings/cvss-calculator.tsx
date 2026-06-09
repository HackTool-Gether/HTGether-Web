'use client';

import { useMemo } from 'react';
import {
  CVSS_METRICS,
  type CvssSelections,
  type CvssMetricKey,
  computeCvssBaseScore,
  buildCvssVector,
  cvssSeverityLabel,
  parseCvssVector,
} from '@/lib/cvss';

interface CvssCalculatorProps {
  vector: string;
  onChange: (next: { score: number | null; vector: string }) => void;
}

// Interactive CVSS 3.1 base-score calculator. Drives the score + vector from a
// set of metric buttons, and stays in sync with the existing vector string.
export function CvssCalculator({ vector, onChange }: CvssCalculatorProps) {
  const selections = useMemo<CvssSelections>(() => parseCvssVector(vector), [vector]);

  const select = (key: CvssMetricKey, value: string) => {
    const next: CvssSelections = { ...selections, [key]: value };
    onChange({ score: computeCvssBaseScore(next), vector: buildCvssVector(next) });
  };

  const score = computeCvssBaseScore(selections);

  return (
    <div style={{ marginBottom: 8 }}>
      {score != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>
            {score.toFixed(1)}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
            {cvssSeverityLabel(score)}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CVSS_METRICS.map((m) => (
          <div key={m.key}>
            <div
              className="mono"
              style={{ fontSize: 10, color: 'var(--fg-subtle)', marginBottom: 3 }}
            >
              {m.key} · {m.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {m.options.map((o) => {
                const active = selections[m.key] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => select(m.key, o.value)}
                    title={o.label}
                    style={{
                      flex: '1 1 auto',
                      padding: '4px 6px',
                      background: active ? 'var(--accent)' : 'var(--bg-subtle)',
                      border: 'none',
                      borderRadius: 'var(--r-sm)',
                      color: active ? 'var(--accent-fg, #fff)' : 'var(--fg-muted)',
                      fontSize: 10.5,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.value} · {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

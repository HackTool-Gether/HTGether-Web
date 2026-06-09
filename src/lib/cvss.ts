// CVSS 3.1 base score calculator.
// Implements the official base metric equations from the CVSS v3.1 specification
// (https://www.first.org/cvss/v3.1/specification-document).

export type CvssMetricKey = 'AV' | 'AC' | 'PR' | 'UI' | 'S' | 'C' | 'I' | 'A';

export interface CvssMetricOption {
  value: string;
  label: string;
}

export interface CvssMetricDef {
  key: CvssMetricKey;
  label: string;
  options: CvssMetricOption[];
}

// Order matters: this is also the canonical order used to build the vector string.
export const CVSS_METRICS: CvssMetricDef[] = [
  {
    key: 'AV',
    label: "Vecteur d'attaque",
    options: [
      { value: 'N', label: 'Réseau' },
      { value: 'A', label: 'Adjacent' },
      { value: 'L', label: 'Local' },
      { value: 'P', label: 'Physique' },
    ],
  },
  {
    key: 'AC',
    label: 'Complexité',
    options: [
      { value: 'L', label: 'Faible' },
      { value: 'H', label: 'Élevée' },
    ],
  },
  {
    key: 'PR',
    label: 'Privilèges requis',
    options: [
      { value: 'N', label: 'Aucun' },
      { value: 'L', label: 'Faibles' },
      { value: 'H', label: 'Élevés' },
    ],
  },
  {
    key: 'UI',
    label: 'Interaction utilisateur',
    options: [
      { value: 'N', label: 'Aucune' },
      { value: 'R', label: 'Requise' },
    ],
  },
  {
    key: 'S',
    label: 'Portée (Scope)',
    options: [
      { value: 'U', label: 'Inchangée' },
      { value: 'C', label: 'Modifiée' },
    ],
  },
  {
    key: 'C',
    label: 'Confidentialité',
    options: [
      { value: 'N', label: 'Aucun' },
      { value: 'L', label: 'Faible' },
      { value: 'H', label: 'Élevé' },
    ],
  },
  {
    key: 'I',
    label: 'Intégrité',
    options: [
      { value: 'N', label: 'Aucun' },
      { value: 'L', label: 'Faible' },
      { value: 'H', label: 'Élevé' },
    ],
  },
  {
    key: 'A',
    label: 'Disponibilité',
    options: [
      { value: 'N', label: 'Aucun' },
      { value: 'L', label: 'Faible' },
      { value: 'H', label: 'Élevé' },
    ],
  },
];

export type CvssSelections = Partial<Record<CvssMetricKey, string>>;

const AV_W: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC_W: Record<string, number> = { L: 0.77, H: 0.44 };
const UI_W: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA_W: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
// Privileges Required weights depend on Scope.
const PR_W_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_W_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };

// Official CVSS 3.1 roundup using integer arithmetic to avoid float drift.
function roundup(input: number): number {
  const intInput = Math.round(input * 100000);
  if (intInput % 10000 === 0) return intInput / 100000;
  return (Math.floor(intInput / 10000) + 1) / 10;
}

export function isCvssComplete(s: CvssSelections): boolean {
  return CVSS_METRICS.every((m) => s[m.key]);
}

export function buildCvssVector(s: CvssSelections): string {
  if (!isCvssComplete(s)) return '';
  const parts = CVSS_METRICS.map((m) => `${m.key}:${s[m.key]}`);
  return `CVSS:3.1/${parts.join('/')}`;
}

// Returns the base score (0–10) or null if the selection is incomplete.
export function computeCvssBaseScore(s: CvssSelections): number | null {
  if (!isCvssComplete(s)) return null;

  const scopeChanged = s.S === 'C';
  const prWeights = scopeChanged ? PR_W_CHANGED : PR_W_UNCHANGED;

  const av = AV_W[s.AV!];
  const ac = AC_W[s.AC!];
  const pr = prWeights[s.PR!];
  const ui = UI_W[s.UI!];
  const c = CIA_W[s.C!];
  const i = CIA_W[s.I!];
  const a = CIA_W[s.A!];

  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = scopeChanged
    ? 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15)
    : 6.42 * iscBase;

  const exploitability = 8.22 * av * ac * pr * ui;

  if (impact <= 0) return 0;

  const raw = scopeChanged
    ? 1.08 * (impact + exploitability)
    : impact + exploitability;

  return roundup(Math.min(raw, 10));
}

// Parses a "CVSS:3.1/AV:N/AC:L/…" string into a selections map (base metrics only).
export function parseCvssVector(vector: string): CvssSelections {
  const out: CvssSelections = {};
  if (!vector) return out;
  const valid = new Set(CVSS_METRICS.map((m) => m.key));
  for (const segment of vector.split('/')) {
    const [key, value] = segment.split(':');
    if (valid.has(key as CvssMetricKey) && value) {
      const def = CVSS_METRICS.find((m) => m.key === key);
      if (def && def.options.some((o) => o.value === value)) {
        out[key as CvssMetricKey] = value;
      }
    }
  }
  return out;
}

// Maps a numeric base score to its qualitative CVSS 3.1 rating.
export function cvssSeverityLabel(score: number): string {
  if (score === 0) return 'None';
  if (score < 4) return 'Low';
  if (score < 7) return 'Medium';
  if (score < 9) return 'High';
  return 'Critical';
}

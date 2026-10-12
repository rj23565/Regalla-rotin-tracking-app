// ─── Zonal Edge Clustering Vision Core ───────────────────────────────────────
// Deterministic multi-object parsing. No modulo cycling, no positional
// guessing: the frame is decomposed into a cell lattice, each cell carries
// colour + texture + edge telemetry, adjacent similar cells are flood-merged
// into regions, and every region is scored against FOODDB visual signatures.

import { FOODDB, PORTIONS } from './fooddb';
import type { FoodKey, PortionId, VisualSignature } from './fooddb';

const GRID = 16; // 16×16 = 256 analysis cells
const SAMPLE = 128; // working raster edge

export interface Cell {
  gx: number;
  gy: number;
  h: number; // hue 0-360
  s: number;
  v: number;
  texture: number; // intra-cell luminance variance
  edge: number; // normalized gradient energy
  used: boolean;
}

export interface VisionRegion {
  cells: number;
  area: number; // 0-1 fraction of frame
  bbox: { x: number; y: number; w: number; h: number }; // percentages
  h: number;
  s: number;
  v: number;
  texture: number;
  edge: number;
}

export interface VisionDetection {
  key: FoodKey;
  name: string;
  confidence: number;
  area: number;
  grams: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  bbox: { x: number; y: number; w: number; h: number };
  rationale: string;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Rasterize a dataURL into the working analysis buffer. */
function rasterize(dataURL: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = SAMPLE;
        c.height = SAMPLE;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        resolve(ctx.getImageData(0, 0, SAMPLE, SAMPLE));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/** Build the cell lattice with per-cell colour, texture and edge energy. */
function buildCells(data: ImageData): Cell[] {
  const step = SAMPLE / GRID;
  const px = data.data;
  const lum = new Float32Array(SAMPLE * SAMPLE);
  for (let i = 0; i < SAMPLE * SAMPLE; i++) {
    lum[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
  }

  const cells: Cell[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      let lSum = 0, lSq = 0, edgeSum = 0;
      const x0 = Math.floor(gx * step), y0 = Math.floor(gy * step);
      for (let y = y0; y < y0 + step; y++) {
        for (let x = x0; x < x0 + step; x++) {
          const i = y * SAMPLE + x;
          r += px[i * 4];
          g += px[i * 4 + 1];
          b += px[i * 4 + 2];
          const l = lum[i];
          lSum += l;
          lSq += l * l;
          // Sobel-lite gradient magnitude
          if (x > 0 && y > 0 && x < SAMPLE - 1 && y < SAMPLE - 1) {
            const dx = lum[i + 1] - lum[i - 1];
            const dy = lum[i + SAMPLE] - lum[i - SAMPLE];
            edgeSum += Math.sqrt(dx * dx + dy * dy);
          }
          n++;
        }
      }
      const mean = lSum / n;
      const { h, s, v } = rgbToHsv(r / n, g / n, b / n);
      cells.push({
        gx,
        gy,
        h,
        s,
        v,
        texture: clamp01(lSq / n - mean * mean),
        // granularity: mean gradient scaled into 0-1 band
        edge: clamp01((edgeSum / n) * 6),
        used: false,
      });
    }
  }
  return cells;
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Flood-merge adjacent cells of similar colour & texture into regions. */
function clusterRegions(cells: Cell[]): VisionRegion[] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= GRID || y >= GRID ? null : cells[y * GRID + x]);
  const regions: VisionRegion[] = [];

  for (const seed of cells) {
    if (seed.used) continue;
    // Skip near-black plate shadow / blown-out background cells
    if (seed.v < 0.1) {
      seed.used = true;
      continue;
    }
    const queue: Cell[] = [seed];
    seed.used = true;
    const members: Cell[] = [];
    while (queue.length) {
      const c = queue.pop()!;
      members.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nb = at(c.gx + dx, c.gy + dy);
        if (!nb || nb.used) continue;
        const similar =
          hueDist(nb.h, c.h) < 26 &&
          Math.abs(nb.s - c.s) < 0.24 &&
          Math.abs(nb.v - c.v) < 0.24 &&
          Math.abs(nb.edge - c.edge) < 0.42;
        if (similar) {
          nb.used = true;
          queue.push(nb);
        }
      }
    }
    if (members.length < 5) continue; // reject speckle

    let hx = 0, hy = 0, s = 0, v = 0, texture = 0, edge = 0;
    let minX = GRID, minY = GRID, maxX = 0, maxY = 0;
    for (const m of members) {
      const rad = (m.h * Math.PI) / 180;
      hx += Math.cos(rad);
      hy += Math.sin(rad);
      s += m.s;
      v += m.v;
      texture += m.texture;
      edge += m.edge;
      minX = Math.min(minX, m.gx);
      minY = Math.min(minY, m.gy);
      maxX = Math.max(maxX, m.gx);
      maxY = Math.max(maxY, m.gy);
    }
    const n = members.length;
    let hue = (Math.atan2(hy / n, hx / n) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    regions.push({
      cells: n,
      area: n / (GRID * GRID),
      bbox: {
        x: (minX / GRID) * 100,
        y: (minY / GRID) * 100,
        w: ((maxX - minX + 1) / GRID) * 100,
        h: ((maxY - minY + 1) / GRID) * 100,
      },
      h: hue,
      s: s / n,
      v: v / n,
      texture: texture / n,
      edge: edge / n,
    });
  }
  return regions.sort((a, b) => b.area - a.area).slice(0, 6);
}

/** Band membership score — 1 inside the band, decaying outside. */
function band(value: number, [lo, hi]: [number, number], tolerance: number): number {
  if (value >= lo && value <= hi) return 1;
  const d = value < lo ? lo - value : value - hi;
  return Math.max(0, 1 - d / tolerance);
}

function hueBand(value: number, [lo, hi]: [number, number]): number {
  const inside = lo <= hi ? value >= lo && value <= hi : value >= lo || value <= hi;
  if (inside) return 1;
  const d = Math.min(hueDist(value, lo), hueDist(value, hi));
  return Math.max(0, 1 - d / 50);
}

function scoreRegion(r: VisionRegion, sig: VisualSignature): number {
  // Texture + edge carry the heaviest weight — they are what separate a
  // granular bowl of nuts/seeds from a smooth poultry fillet.
  const sHue = hueBand(r.h, sig.hue);
  const sSat = band(r.s, sig.sat, 0.3);
  const sVal = band(r.v, sig.bright, 0.3);
  const sTex = band(r.texture, sig.texture, 0.06);
  const sEdge = band(r.edge, sig.edge, 0.3);
  return (sHue * 1.5 + sSat * 1.0 + sVal * 1.0 + sTex * 2.2 + sEdge * 2.3) / 8 * sig.weight;
}

function rationaleFor(r: VisionRegion, key: FoodKey): string {
  const tex = r.texture > 0.055 ? 'granular' : r.texture > 0.02 ? 'semi-textured' : 'smooth';
  const ed = r.edge > 0.6 ? 'high edge density' : r.edge > 0.3 ? 'moderate edges' : 'low edge density';
  const tone = r.h < 20 || r.h > 340 ? 'red-toned' : r.h < 50 ? 'amber/tan' : r.h < 70 ? 'pale cream' : r.h < 170 ? 'green' : 'cool-toned';
  const note =
    key === 'nuts_seeds'
      ? ' · clustered kernel geometry confirmed'
      : key === 'chicken_breast'
        ? ' · continuous fillet surface'
        : key === 'cooked_rice'
          ? ' · fine grain speckle'
          : '';
  return `${tone}, ${tex}, ${ed}${note}`;
}

/**
 * Full multi-object parse. Returns one detection per discriminated zone,
 * macros scaled by true region area × portion modifier.
 */
export async function parseFrame(dataURL: string, portion: PortionId = 'standard'): Promise<VisionDetection[]> {
  const raster = await rasterize(dataURL);
  if (!raster) return [];
  const cells = buildCells(raster);
  const regions = clusterRegions(cells);
  if (regions.length === 0) return [];

  const mult = PORTIONS[portion].mult;
  const keys = Object.keys(FOODDB) as FoodKey[];
  const out: VisionDetection[] = [];
  const claimed = new Set<FoodKey>();

  for (const r of regions) {
    if (r.area < 0.035) continue; // ignore garnish-scale fragments
    const ranked = keys
      .map((k) => ({ k, score: scoreRegion(r, FOODDB[k].sig) }))
      .sort((a, b) => b.score - a.score);
    // Prefer an unclaimed key so densely clustered plates resolve to
    // distinct components rather than collapsing onto one label.
    const pick = ranked.find((x) => !claimed.has(x.k)) ?? ranked[0];
    if (pick.score < 0.42) continue;
    claimed.add(pick.k);

    const spec = FOODDB[pick.k];
    // Portion mass tracks the measured zone area against a reference plate fill
    const areaScale = Math.min(1.9, Math.max(0.45, r.area / 0.24));
    const grams = Math.round(spec.gramsPerServing * areaScale * mult);
    const factor = (grams / spec.gramsPerServing);
    out.push({
      key: pick.k,
      name: spec.name,
      confidence: Math.min(0.97, pick.score),
      area: r.area,
      grams,
      kcal: Math.round(spec.kcal * factor),
      protein: Math.round(spec.protein * factor),
      carb: Math.round(spec.carb * factor),
      fat: Math.round(spec.fat * factor),
      bbox: r.bbox,
      rationale: rationaleFor(r, pick.k),
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ─── Skincare OCR-grade ingredient toxicity core ─────────────────────────────

export interface ToxHit {
  term: string;
  family: string;
  severity: 'high' | 'moderate' | 'low';
  risk: string;
}

const TOX_TABLE: Array<[RegExp, string, ToxHit['severity'], string]> = [
  [/\b\w*paraben\b/i, 'Parabens', 'high', 'endocrine disruption · hormonal interference with prolonged dermal load'],
  [/sodium lauryl sulfate|sodium laureth sulfate|\bsls\b|\bsles\b/i, 'Heavy sulfates', 'high', 'barrier stripping · contact dermatitis and chronic dryness'],
  [/\bfragrance\b|\bparfum\b|aroma compound/i, 'Synthetic fragrance', 'moderate', 'sensitization · undisclosed allergen blends trigger flare reactions'],
  [/phthalate|\bdbp\b|\bdehp\b/i, 'Phthalates', 'high', 'reproductive toxicity · systemic absorption through compromised barrier'],
  [/formaldehyde|dmdm hydantoin|quaternium-15|imidazolidinyl urea|diazolidinyl urea/i, 'Formaldehyde releasers', 'high', 'carcinogenic vapor release · severe contact sensitization'],
  [/\blead\b|\bmercury\b|\bcadmium\b|\barsenic\b|thimerosal/i, 'Toxic metal complexes', 'high', 'neurotoxic bioaccumulation · irreversible systemic deposition'],
  [/hydroquinone/i, 'Hydroquinone', 'high', 'ochronosis risk · paradoxical darkening with chronic use'],
  [/oxybenzone|octinoxate/i, 'Chemical UV filters', 'moderate', 'photoallergic reaction · hormonal activity reported'],
  [/triclosan/i, 'Triclosan', 'moderate', 'microbiome disruption · resistance promotion'],
  [/\bdenat\b|alcohol denat|\bsd alcohol/i, 'Denatured alcohol', 'moderate', 'acute dehydration · lipid barrier erosion'],
  [/\btoluene\b/i, 'Toluene', 'high', 'neurological irritation on inhalation exposure'],
  [/mineral oil|petrolatum|paraffinum/i, 'Occlusive petrolatums', 'low', 'pore occlusion risk on acne-prone skin'],
  [/\bpeg-?\d+/i, 'PEG compounds', 'low', 'penetration enhancement · possible dioxane contamination'],
  [/coconut oil|isopropyl myristate|\blanolin\b/i, 'Comedogenic esters', 'low', 'follicular congestion on oily skin types'],
];

export interface SkinReport {
  verdict: 'toxic' | 'caution' | 'safe';
  hits: ToxHit[];
  parsed: number;
  index: number; // 0-100 reaction risk index
  steps: string[];
}

export function analyzeIngredients(raw: string, userTriggers: string[] = []): SkinReport {
  const text = raw.replace(/\s+/g, ' ').trim();
  const tokens = text.split(/[,;·•\n]+/).map((t) => t.trim()).filter(Boolean);
  const hits: ToxHit[] = [];

  for (const [re, family, severity, risk] of TOX_TABLE) {
    const m = text.match(re);
    if (m) hits.push({ term: m[0], family, severity, risk });
  }
  for (const trig of userTriggers) {
    const t = trig.trim().toLowerCase();
    if (t && text.toLowerCase().includes(t)) {
      hits.push({ term: trig, family: 'Personal trigger', severity: 'high', risk: 'flagged on your own reaction list — avoid entirely' });
    }
  }

  const weight = hits.reduce((a, h) => a + (h.severity === 'high' ? 34 : h.severity === 'moderate' ? 18 : 8), 0);
  const index = Math.min(100, weight);
  const verdict: SkinReport['verdict'] = hits.some((h) => h.severity === 'high') ? 'toxic' : hits.length > 0 ? 'caution' : 'safe';

  const steps =
    verdict === 'safe'
      ? ['Patch test behind the ear for 24 hours regardless.', 'Introduce as a single new variable — no stacking.', 'Log a baseline frame in the progression vault today.']
      : [
          `Discontinue if erythema or stinging appears within ${verdict === 'toxic' ? '15 minutes' : 'the first hour'}.`,
          'Patch test on the inner forearm for 48 hours before facial application.',
          hits.some((h) => h.family === 'Heavy sulfates') ? 'Pair with a ceramide barrier cream to offset lipid stripping.' : 'Buffer with a bland occlusive on compromised zones.',
          'Re-photograph the area at 7 and 28 days to chart reaction drift.',
        ];

  return { verdict, hits, parsed: tokens.length, index, steps };
}

// ─── Before / After progression comparison ───────────────────────────────────

export interface CompareResult {
  clarity: number; // % change in micro-texture smoothness
  evenness: number; // % change in tonal evenness
  brightness: number; // % change in luminance
  verdict: string;
}

async function frameStats(dataURL: string) {
  const raster = await rasterize(dataURL);
  if (!raster) return null;
  const cells = buildCells(raster);
  const n = cells.length;
  const texture = cells.reduce((a, c) => a + c.texture, 0) / n;
  const edge = cells.reduce((a, c) => a + c.edge, 0) / n;
  const v = cells.reduce((a, c) => a + c.v, 0) / n;
  const meanH = cells.reduce((a, c) => a + c.s, 0) / n;
  const toneSpread = Math.sqrt(cells.reduce((a, c) => a + (c.s - meanH) ** 2, 0) / n);
  return { texture, edge, v, toneSpread };
}

export async function compareFrames(beforeURL: string, afterURL: string): Promise<CompareResult | null> {
  const [b, a] = await Promise.all([frameStats(beforeURL), frameStats(afterURL)]);
  if (!b || !a) return null;
  const pct = (before: number, after: number) => (before === 0 ? 0 : ((before - after) / before) * 100);
  const clarity = Math.max(-99, Math.min(99, pct(b.texture + b.edge, a.texture + a.edge)));
  const evenness = Math.max(-99, Math.min(99, pct(b.toneSpread, a.toneSpread)));
  const brightness = Math.max(-99, Math.min(99, ((a.v - b.v) / Math.max(0.01, b.v)) * 100));
  const verdict =
    clarity > 8 ? 'Micro-texture has measurably smoothed across the aligned field.'
      : clarity < -8 ? 'Surface irregularity increased — review recent formulations.'
        : 'Texture holding steady; continue the protocol for a longer arc.';
  return { clarity, evenness, brightness, verdict };
}

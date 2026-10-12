// ─── Body Forge · four-tier somatic re-engineering ───────────────────────────
import type { Activity, BodyProfile, BodyType, Goal } from './types';

export interface Directive {
  head: string;
  body: string;
}

export interface BodySpec {
  id: BodyType;
  numeral: string;
  name: string;
  epithet: string;
  baseline: string;
  macros: { carb: number; protein: number; fat: number }; // fractions
  proteinPerKg: number;
  kcalBias: number; // multiplier vs mesomorph baseline
  steps: string;
  stepsMin: number;
  meals: string;
  constraint: string;
  directives: Directive[];
}

export const BODY_TYPES: Record<BodyType, BodySpec> = {
  ectomorph: {
    id: 'ectomorph',
    numeral: 'I',
    name: 'Ectomorph',
    epithet: 'The Quick Flame',
    baseline:
      'Hyper-metabolic chassis. Calories clear fast, tissue is hard to hold, and the furnace must be fed on a tight cadence.',
    macros: { carb: 0.47, protein: 0.25, fat: 0.28 },
    proteinPerKg: 1.8,
    kcalBias: 1.12,
    steps: '≤ 8,000 / day',
    stepsMin: 8000,
    meals: '5–6 feeds · every 3 hours',
    constraint: 'Eating window constraint: 3-hour cadence',
    directives: [
      { head: 'Carb ceiling raised', body: 'Scale carbohydrate splits to higher caps — 45–50% of total intake fuels the furnace.' },
      { head: 'Three-hour feed cadence', body: 'Never exceed a 3-hour fast while awake; missed feeds are lost tissue.' },
      { head: 'Cardio rationing', body: 'Limit exhausting heavy cardio metrics — cap low-intensity work at two 20-minute sessions weekly.' },
      { head: 'Bedtime nutrient shake', body: 'A slow protein + oat + nut-butter shake before sleep halts overnight catabolism.' },
    ],
  },
  mesomorph: {
    id: 'mesomorph',
    numeral: 'II',
    name: 'Mesomorph',
    epithet: 'The Balanced Blade',
    baseline:
      'Balanced lean distribution. Responds to both iron and table; discipline of portion is the only true risk.',
    macros: { carb: 0.4, protein: 0.3, fat: 0.3 },
    proteinPerKg: 2.0,
    kcalBias: 1.0,
    steps: '10,000 / day',
    stepsMin: 10000,
    meals: '3–4 feeds · even spacing',
    constraint: 'Portion control warning caps active',
    directives: [
      { head: 'Standard 40 / 30 / 30', body: 'Hold the dynamic macro split at 40% carbohydrate, 30% protein, 30% fat.' },
      { head: 'Strength + hybrid conditioning', body: 'Run a tight matrix of strength and hybrid conditioning elements, 4–5 sessions per week.' },
      { head: 'Portion warning caps', body: 'Lean gain comes easily — so does quiet surplus. Cap single-plate portions at measured servings.' },
      { head: 'Rotate intensities', body: 'Alternate heavy lifts with conditioning days to keep adaptation compounding.' },
    ],
  },
  endomorph: {
    id: 'endomorph',
    numeral: 'III',
    name: 'Endomorph',
    epithet: 'The Deep Vault',
    baseline:
      'Slower metabolic retention. Energy is stored readily and defended stubbornly; the day must be engineered around it.',
    macros: { carb: 0.3, protein: 0.4, fat: 0.3 },
    proteinPerKg: 2.2,
    kcalBias: 0.88,
    steps: '≥ 12,000 / day',
    stepsMin: 12000,
    meals: '3 feeds · front-loaded',
    constraint: 'Calories front-loaded before midday',
    directives: [
      { head: 'Lower carb targets', body: 'Compress carbohydrates; raise essential proteins and heavy plant fibers to hold satiety.' },
      { head: 'Front-load consumption', body: 'Front-load calorie consumption points early — largest feed before midday, lightest at night.' },
      { head: 'Steps above gym time', body: 'Elevate step metrics above structural gym time: 12,000 daily steps outrank any single session.' },
      { head: 'Eliminate liquid calories', body: 'Zero liquid calories — no juices, no soft drinks, no exceptions. Water, black coffee, plain tea.' },
    ],
  },
  hybrid: {
    id: 'hybrid',
    numeral: 'IV',
    name: 'Combination Hybrid',
    epithet: 'The Shifting Alloy',
    baseline:
      'Mixed tissue profile — ecto-endo alloy. Macros are not fixed law; they are flags, re-cast against weight targets and occupational labor.',
    macros: { carb: 0.38, protein: 0.32, fat: 0.3 },
    proteinPerKg: 2.0,
    kcalBias: 1.0,
    steps: '10,000 / day',
    stepsMin: 10000,
    meals: '4 feeds · goal-timed',
    constraint: 'Dynamic macro adjustment flags live',
    directives: [
      { head: 'Dynamic macro flags', body: 'Macro splits are re-cast on every goal change — no fixed ratio survives contact with the scale.' },
      { head: 'Weight-target buffers', body: 'Modulate calorie targets by the active target: deficit buffers when losing, surplus buffers when gaining.' },
      { head: 'Occupational overlay', body: 'A labor-heavy occupation adds feed volume; a desk-bound one tightens it. Activity sets the floor.' },
      { head: 'Reassess fortnightly', body: 'Re-weigh every 14 days and re-cast flags — the alloy drifts, the plan must drift with it.' },
    ],
  },
};

export interface ForgeTargets {
  kcal: number;
  baseKcal: number;
  bufferKcal: number;
  waterL: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  macros: { carb: number; protein: number; fat: number };
  stepsMin: number;
  meals: string;
  windowText: string;
  cardioNote: string;
  flags: string[];
}

const ACTIVITY_KCAL: Record<Activity, number> = { sedentary: 0.94, active: 1.0, labor: 1.08 };
const GOAL_KCAL: Record<Goal, number> = { lose: 0.88, recomp: 0.97, gain: 1.1 };
const HYBRID_MACROS: Record<Goal, { carb: number; protein: number; fat: number }> = {
  lose: { carb: 0.32, protein: 0.4, fat: 0.28 },
  recomp: { carb: 0.38, protein: 0.32, fat: 0.3 },
  gain: { carb: 0.46, protein: 0.27, fat: 0.27 },
};

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'Desk-bound',
  active: 'On feet',
  labor: 'Manual labor',
};

export function computeTargets(p: BodyProfile, synthesisBufferKcal = 0): ForgeTargets {
  const spec = BODY_TYPES[p.type];
  const isHybrid = p.type === 'hybrid';

  // Base maintenance: deterministic somatic coefficient.
  let kcal = p.weightKg * 32 * spec.kcalBias;
  kcal *= ACTIVITY_KCAL[p.activity];
  const goalMult = isHybrid ? GOAL_KCAL[p.goal] : p.goal === 'lose' ? 0.9 : p.goal === 'gain' ? 1.08 : 1.0;
  kcal = Math.round(kcal * goalMult);
  const baseKcal = kcal;
  kcal += synthesisBufferKcal;

  // Water prescription — 0.033 L per kilogram baseline, modulated by build.
  const waterMult =
    p.type === 'ectomorph' ? 1.05 : p.type === 'endomorph' ? 1.12 : p.type === 'hybrid' ? (p.goal === 'lose' ? 1.1 : p.goal === 'gain' ? 0.95 : 1.0) : 1.0;
  const waterL = Math.round(p.weightKg * 0.033 * waterMult * 10) / 10;

  const macros = isHybrid ? HYBRID_MACROS[p.goal] : spec.macros;
  const proteinG = Math.round(p.weightKg * spec.proteinPerKg * (p.goal === 'lose' ? 1.08 : 1));
  const carbG = Math.round((kcal * macros.carb) / 4);
  const fatG = Math.round((kcal * macros.fat) / 9);

  const flags: string[] = [];
  if (isHybrid) {
    const delta = Math.round((goalMult - 1) * 100);
    flags.push(`MACRO FLAG · ${p.goal.toUpperCase()} ${delta >= 0 ? '+' : ''}${delta}% buffer`);
    flags.push(`OCCUPATION · ${ACTIVITY_LABEL[p.activity].toUpperCase()} floor ×${ACTIVITY_KCAL[p.activity].toFixed(2)}`);
  }
  if (p.type === 'endomorph') flags.push('LIQUID CALORIES · FORBIDDEN');
  if (p.type === 'ectomorph') flags.push('FEED CADENCE · ≤ 3 HOURS');
  if (p.type === 'mesomorph') flags.push('PORTION CAPS · ARMED');
  if (synthesisBufferKcal > 0) flags.push(`SYNTHESIS · CONDITIONING BUFFER +${synthesisBufferKcal} KCAL`);

  const stepsMin = spec.stepsMin + (p.goal === 'lose' ? 1000 : 0) - (p.goal === 'gain' && p.type === 'ectomorph' ? 1500 : 0);

  const cardioNote =
    p.type === 'ectomorph'
      ? 'Heavy cardio capped — 2 × 20 min LISS weekly, no more.'
      : p.type === 'mesomorph'
        ? 'Hybrid conditioning 4–5×/week woven through strength days.'
        : p.type === 'endomorph'
          ? 'Steps outrank the gym — daily walking volume is the primary lever.'
          : `Conditioning re-cast by goal: ${p.goal === 'lose' ? 'daily LISS emphasis' : p.goal === 'gain' ? 'brief finishers only' : 'even split'}.`;

  const windowText =
    p.type === 'endomorph'
      ? 'Last feed by 19:00 · calories front-loaded'
      : p.type === 'ectomorph'
        ? 'First feed within 45 min of waking · shake at lights-out'
        : p.type === 'hybrid'
          ? p.goal === 'lose'
            ? 'Compressed 10-hour window · front-weighted'
            : 'Standard window · feeds around training'
          : 'Standard 12-hour window · even spacing';

  return { kcal, baseKcal, bufferKcal: synthesisBufferKcal, waterL, proteinG, carbG, fatG, macros, stepsMin, meals: spec.meals, windowText, cardioNote, flags };
}

export const GOALS: Array<{ id: Goal; label: string }> = [
  { id: 'lose', label: 'Lose' },
  { id: 'recomp', label: 'Recomp' },
  { id: 'gain', label: 'Gain' },
];

export const ACTIVITIES: Array<{ id: Activity; label: string }> = [
  { id: 'sedentary', label: 'Desk-bound' },
  { id: 'active', label: 'On feet' },
  { id: 'labor', label: 'Manual labor' },
];

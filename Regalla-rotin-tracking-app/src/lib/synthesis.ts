// ─── Cross-domain habit synthesis · modules that feed each other ────────────
import type { Habit, Logs, Plan, SlotId } from './types';
import { consistencyRate, elapsedDays } from './analytics';
import { SLOTS } from './time';

const WORKOUT_RE = /train|strength|workout|gym|lift|cardio|condition|run|swim|exercise|mobility/i;
const STUDY_RE = /study|read|work|learn|book|deep|write|journal|page|course|practice/i;

export interface WorkoutSynthesis {
  habits: number;
  consistency: number;
  unlocked: boolean;
  bufferKcal: number;
  reason: string;
}

/** High workout consistency unlocks a calorie buffer in the Diet planner. */
export function workoutSynthesis(plan: Plan, habits: Habit[], logs: Logs): WorkoutSynthesis {
  const gym = habits.filter((h) => h.planId === plan.id && WORKOUT_RE.test(h.title));
  if (gym.length === 0) {
    return { habits: 0, consistency: 0, unlocked: false, bufferKcal: 0, reason: 'no conditioning rites bound' };
  }
  const consistency = gym.reduce((acc, h) => acc + consistencyRate(h.id, plan, logs), 0) / gym.length;
  const elapsed = elapsedDays(plan);
  const unlocked = elapsed >= 5 && consistency >= 0.85;
  return {
    habits: gym.length,
    consistency,
    unlocked,
    bufferKcal: unlocked ? 150 : 0,
    reason: unlocked
      ? `conditioning consistency ${Math.round(consistency * 100)}% over ${elapsed} days — buffer earned`
      : `require ≥85% conditioning consistency across 5+ elapsed days`,
  };
}

export interface FocusWindow {
  slot: SlotId;
  label: string;
  range: string;
  pct: number;
}

/** Study-pattern completion pushes optimized energy windows into the lab. */
export function studyFocusWindows(plan: Plan, habits: Habit[], logs: Logs): FocusWindow[] {
  const study = habits.filter((h) => h.planId === plan.id && STUDY_RE.test(h.title));
  if (study.length === 0) return [];
  const bySlot = new Map<SlotId, { sum: number; n: number }>();
  for (const h of study) {
    const c = consistencyRate(h.id, plan, logs);
    const cur = bySlot.get(h.slot) ?? { sum: 0, n: 0 };
    cur.sum += c;
    cur.n += 1;
    bySlot.set(h.slot, cur);
  }
  return [...bySlot.entries()]
    .map(([slot, { sum, n }]) => {
      const def = SLOTS.find((s) => s.id === slot) ?? SLOTS[0];
      return { slot, label: def.label, range: def.range, pct: sum / n };
    })
    .filter((w) => w.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);
}

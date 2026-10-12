// ─── Discipline analytics · deterministic matrices ──────────────────────────
import type { Habit, Logs, Plan } from './types';
import { addDays, clamp, diffDays, todayISO } from './time';

export const planEnd = (plan: Plan) => addDays(plan.startISO, plan.duration - 1);

/** Days since plan start including today, clamped to the window. */
export function elapsedDays(plan: Plan): number {
  return clamp(diffDays(plan.startISO, todayISO()) + 1, 0, plan.duration);
}

export const dayIndexOf = (plan: Plan, dateISO: string) => diffDays(plan.startISO, dateISO) + 1;

export const isWithin = (plan: Plan, dateISO: string) => {
  const i = dayIndexOf(plan, dateISO);
  return i >= 1 && i <= plan.duration;
};

const planHabits = (plan: Plan, habits: Habit[]) => habits.filter((h) => h.planId === plan.id);

/** ticks recorded for one habit inside the plan window */
export function habitTicks(habitId: string, plan: Plan, logs: Logs): number {
  let n = 0;
  for (let i = 0; i < plan.duration; i++) {
    const key = addDays(plan.startISO, i);
    if (logs[key]?.includes(habitId)) n++;
  }
  return n;
}

/** ticks recorded only across days that have already elapsed */
export function habitTicksElapsed(habitId: string, plan: Plan, logs: Logs): number {
  const e = elapsedDays(plan);
  let n = 0;
  for (let i = 0; i < e; i++) {
    const key = addDays(plan.startISO, i);
    if (logs[key]?.includes(habitId)) n++;
  }
  return n;
}

/** Consistency Rate — ticked occurrences relative only to elapsed days. */
export function consistencyRate(habitId: string, plan: Plan, logs: Logs): number {
  const e = elapsedDays(plan);
  if (e === 0) return 0;
  return habitTicksElapsed(habitId, plan, logs) / e;
}

/** Plan Progress — completed checks ÷ total window constraint. */
export function planProgress(plan: Plan, habits: Habit[], logs: Logs) {
  const hs = planHabits(plan, habits);
  const total = plan.duration * hs.length;
  const done = hs.reduce((acc, h) => acc + habitTicks(h.id, plan, logs), 0);
  return { done, total, pct: total === 0 ? 0 : done / total };
}

/** Mean consistency across all habits of the plan (elapsed-day relative). */
export function meanConsistency(plan: Plan, habits: Habit[], logs: Logs): number {
  const hs = planHabits(plan, habits);
  if (hs.length === 0) return 0;
  return hs.reduce((acc, h) => acc + consistencyRate(h.id, plan, logs), 0) / hs.length;
}

export function dayCompletion(plan: Plan, habits: Habit[], logs: Logs, dateISO: string) {
  const hs = planHabits(plan, habits);
  const doneIds = logs[dateISO] ?? [];
  const done = hs.filter((h) => doneIds.includes(h.id)).length;
  return { done, total: hs.length, pct: hs.length === 0 ? 0 : done / hs.length };
}

export const isPerfectDay = (plan: Plan, habits: Habit[], logs: Logs, dateISO: string) => {
  const c = dayCompletion(plan, habits, logs, dateISO);
  return c.total > 0 && c.done === c.total;
};

/** Walk backwards from today (today may still be in progress — chain holds). */
export function perfectStreak(plan: Plan, habits: Habit[], logs: Logs): number {
  const today = todayISO();
  let cursor = isPerfectDay(plan, habits, logs, today) ? today : addDays(today, -1);
  let n = 0;
  while (isWithin(plan, cursor) && isPerfectDay(plan, habits, logs, cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Per-habit streak ending today/yesterday. */
export function habitStreak(habitId: string, plan: Plan, logs: Logs): number {
  const today = todayISO();
  let cursor = logs[today]?.includes(habitId) ? today : addDays(today, -1);
  let n = 0;
  while (isWithin(plan, cursor) && logs[cursor]?.includes(habitId)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Longest perfect-day run anywhere in the window. */
export function bestStreak(plan: Plan, habits: Habit[], logs: Logs): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < plan.duration; i++) {
    const key = addDays(plan.startISO, i);
    if (isPerfectDay(plan, habits, logs, key)) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

/** Next 7-day milestone marker above the current streak. */
export const nextMilestone = (streak: number) => (Math.floor(streak / 7) + 1) * 7;

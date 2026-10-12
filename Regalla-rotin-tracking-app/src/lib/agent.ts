// ─── Omni-agent · conversational workspace automation ───────────────────────
// Parses natural directions and executes operations natively across every
// domain — routine, diet, fitness, projects, study — with zero server calls.

import type { useRegalia } from '../store';
import { DOMAINS, type LangCode, type Domain, type SlotId } from './types';
import { todayISO } from './time';

type Store = ReturnType<typeof useRegalia.getState>;

export interface AgentReply {
  reply: string;
  nav?: string;
}

const SLOT_WORDS: SlotId[] = ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night'];
const VIEW_WORDS: Record<string, string> = {
  command: 'command', dashboard: 'command', home: 'command',
  timeline: 'timeline', day: 'timeline',
  stacks: 'stacks', grid: 'stacks', calendar: 'stacks',
  forge: 'forge', body: 'forge', somatic: 'forge',
  diet: 'diet', meal: 'diet', food: 'diet', allergen: 'diet',
  sentinel: 'sentinel', security: 'sentinel',
};

function findHabit(s: Store, text: string) {
  const q = text.toLowerCase().trim();
  return s.habits
    .filter((h) => h.planId === s.activePlanId)
    .find((h) => h.title.toLowerCase().includes(q) || q.includes(h.title.toLowerCase()));
}

export function runDirective(s: Store, raw: string): AgentReply {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (!text) return { reply: 'A directive, sovereign — I await it.' };

  // navigation
  const navMatch = lower.match(/^(?:go to|open|show|switch to)\s+(.+)$/);
  if (navMatch) {
    const word = navMatch[1].trim();
    for (const [w, v] of Object.entries(VIEW_WORDS)) {
      if (word.includes(w)) return { reply: `Plotting course — ${v} matrix engaged.`, nav: v };
    }
  }

  // bulk discipline
  if (/seal all|complete all|tick all|mark all/.test(lower)) {
    s.sealAllToday();
    return { reply: 'Every rite for today is sealed across all views.' };
  }
  if (/clear (?:today|day)|reset today/.test(lower)) {
    s.clearToday();
    return { reply: 'Today has been struck clean and mirrored everywhere.' };
  }
  if (/audit|verify board/.test(lower)) {
    s.auditBoard();
    return { reply: 'Board audit executed — the ledger holds the figures.' };
  }

  // add rite
  const addMatch = lower.match(/^(?:add|enlist|create)\s+(?:a\s+|new\s+)?(?:rite|habit|task)\s+(.+)$/);
  if (addMatch) {
    let body = addMatch[1];
    let domain: Domain = 'health';
    let slot: SlotId = 'morning';
    for (const d of DOMAINS) {
      const re = new RegExp(`\\s+${d}\\b`);
      if (re.test(body)) {
        domain = d as Domain;
        body = body.replace(re, '');
      }
    }
    for (const sl of SLOT_WORDS) {
      const re = new RegExp(`\\s+${sl}\\b`);
      if (re.test(body)) {
        slot = sl;
        body = body.replace(re, '');
      }
    }
    const r = s.addHabit(body.trim(), slot, domain);
    return r.ok
      ? { reply: `Rite enlisted — “${body.trim()}” · ${domain} · ${slot}.` }
      : { reply: r.blocked ? `Sentinel arrested that string — ${r.vector}. Entry refused.` : 'The title came up empty.' };
  }

  // delete rite
  const delMatch = lower.match(/^(?:delete|remove|strike)\s+(?:the\s+)?(?:rite|habit|task)\s+(.+)$/) ?? lower.match(/^(?:delete|remove)\s+(.+)$/);
  if (delMatch) {
    const h = findHabit(s, delMatch[1]);
    if (!h) return { reply: 'No rite answers to that name.' };
    s.removeHabit(h.id);
    return { reply: `“${h.title}” struck from the board — recoverable in the vault for 30 days.` };
  }

  // tick rite
  const tickMatch = lower.match(/^(?:tick|seal|complete|check)\s+(.+)$/);
  if (tickMatch) {
    const h = findHabit(s, tickMatch[1]);
    if (!h) return { reply: 'No rite answers to that name.' };
    const on = s.logs[todayISO()]?.includes(h.id);
    if (!on) s.toggleHabit(h.id);
    return { reply: on ? `“${h.title}” already bears today’s seal.` : `“${h.title}” sealed for today.` };
  }

  // untick
  const untickMatch = lower.match(/^(?:untick|unseal|uncheck)\s+(.+)$/);
  if (untickMatch) {
    const h = findHabit(s, untickMatch[1]);
    if (!h) return { reply: 'No rite answers to that name.' };
    if (s.logs[todayISO()]?.includes(h.id)) s.toggleHabit(h.id);
    return { reply: `Seal lifted from “${h.title}”.` };
  }

  // meal logging
  const mealMatch = lower.match(/^(?:log|record)\s+(?:a\s+)?meal\s+(.+?)(?:\s+(\d{2,4})\s*(?:kcal)?)?$/);
  if (mealMatch) {
    const name = mealMatch[1].trim();
    const kcal = mealMatch[2] ? Number(mealMatch[2]) : 0;
    const r = s.addMeal({ name, kcal, carb: 0, protein: 0, fat: 0 });
    return r.ok
      ? { reply: `Meal recorded — “${name}”${kcal ? ` at ${kcal} kcal` : ''}. The shield scanned it en route.`, nav: 'diet' }
      : { reply: 'Sentinel refused that meal string.' };
  }

  // language
  const langMatch = lower.match(/^(?:set\s+)?language\s+(\w+)/) ?? lower.match(/^speak\s+(urdu|hindi|arabic|spanish|french|english)/);
  if (langMatch) {
    const map: Record<string, LangCode> = { english: 'en', en: 'en', urdu: 'ur', ur: 'ur', hindi: 'hi', hi: 'hi', arabic: 'ar', ar: 'ar', spanish: 'es', es: 'es', french: 'fr', fr: 'fr' };
    const code = map[langMatch[1].toLowerCase()];
    if (code) {
      s.setLanguage(code);
      return { reply: 'Guidance tongue re-cast. The chrome transforms with it.' };
    }
  }

  // weight / goal
  const weightMatch = lower.match(/weight\s+(\d+(?:\.\d+)?)/);
  if (weightMatch) {
    s.setWeight(Number(weightMatch[1]));
    return { reply: `Mass recalibrated to ${weightMatch[1]} kg — provision targets re-computed.` };
  }

  if (/brief|speak|read the day/.test(lower)) {
    return { reply: '__BRIEF__' };
  }

  return {
    reply:
      'Directives I honor: “seal strength training”, “add rite Quran study evening study”, “delete rite soda”, “log meal chicken rice 520”, “seal all”, “clear today”, “language urdu”, “weight 74.5”, “open diet lab”, “audit”.',
  };
}

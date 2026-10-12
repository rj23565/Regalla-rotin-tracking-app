// ─── First-light seed · deterministic demo residency ─────────────────────────
import type { Habit, Logs, Plan, RegaliaData } from './types';
import { addDays, todayISO, uid } from './time';

/** Deterministic PRNG so the seeded history is stable & auditable. */
const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function seedState(): RegaliaData {
  const today = todayISO();
  const start = addDays(today, -13); // today lands on day 14 of a 30-day window
  const plan: Plan = {
    id: 'plan_foundry',
    title: 'The Foundry',
    duration: 30,
    startISO: start,
    motto: 'Small rites, sealed daily, forge the sovereign self.',
    createdAt: Date.now(),
  };

  const habitDefs: Array<[string, Habit['slot'], Habit['domain']]> = [
    ['Rise with the sun', 'dawn', 'health'],
    ['Mobility & cold rinse', 'dawn', 'beauty'],
    ['Deep work — one 90-minute block', 'morning', 'work'],
    ['Read twenty pages', 'afternoon', 'study'],
    ['Strength training', 'evening', 'fitness'],
    ['Reflect & journal', 'night', 'health'],
  ];
  const habits: Habit[] = habitDefs.map(([title, slot, domain], i) => ({
    id: `habit_${i + 1}`,
    planId: plan.id,
    title,
    slot,
    domain,
    createdAt: Date.now(),
  }));

  // 13 elapsed days of history: days 1-5 perfect, day 6 partial,
  // days 7-13 perfect → a live 7-day chain arriving at today.
  const rand = mulberry32(4242);
  const logs: Logs = {};
  for (let d = 0; d < 13; d++) {
    const key = addDays(start, d);
    const ids: string[] = [];
    habits.forEach((h, hi) => {
      let hit = rand() < 0.86 - hi * 0.015;
      if (d >= 6) hit = true; // last seven days: flawless
      if (d === 5 && (h.id === 'habit_3' || h.id === 'habit_6')) hit = false;
      if (hit) ids.push(h.id);
    });
    logs[key] = ids;
  }
  // Today: three rites already sealed, the rest await.
  logs[today] = ['habit_1', 'habit_2', 'habit_3'];

  return {
    plans: [plan],
    activePlanId: plan.id,
    habits,
    logs,
    threats: [
      {
        id: uid('th'),
        at: Date.now() - 6 * 86_400_000,
        vector: 'EVENT HANDLER',
        snippet: 'img src x onerror steal session — quarantined at snapshot input',
        source: 'Snapshot input',
      },
      {
        id: uid('th'),
        at: Date.now() - 2 * 86_400_000,
        vector: 'JS URI SCHEME',
        snippet: 'javascript void document cookie — quarantined at probe console',
        source: 'Probe console',
      },
    ],
    securityScore: 93,
    body: { type: 'mesomorph', goal: 'recomp', activity: 'active', weightKg: 72 },
    settings: { language: 'en', voiceRate: 1, discreet: false, voiceAssist: false, theme: 'light' },
    celebrated: [7],
    trash: [],
    exportEvents: [],
    tampered: false,
    meals: [],
    diet: { allergies: ['peanuts'], conditions: ['lactose'], dislikes: ['cilantro'] },
    study: [],
    accounts: [],
    activeUserId: 'guest',
    workspaces: {},
    admin: null,
    adCode: '',
    opsLog: [],
    adStack: [
      { id: 'ad_herald', name: 'Herald Banner', format: 'responsive', slot: '8841022331', active: true, createdAt: Date.now() },
      { id: 'ad_vaultfeed', name: 'Vault Feed Card', format: 'in-feed', slot: '5501190342', active: false, createdAt: Date.now() },
    ],
    notes: [
      {
        id: uid('nt'),
        kind: 'system',
        title: 'Residency established',
        body: 'All state lives locally under key regalia_v2. No server. No egress.',
        at: Date.now(),
      },
    ],
    lastPhrase: '',
    voiceRepeats: 0,
    lastVoiceAt: 0,
    seededAt: Date.now(),
  };
}

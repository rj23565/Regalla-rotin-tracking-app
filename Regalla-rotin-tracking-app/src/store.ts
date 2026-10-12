// ─── Regalia store · single local source of truth ────────────────────────────
// Every tick, audit, probe, meal and auth flow runs through this tree; all
// views mirror-synchronize from it without a single page redraw. Persistence
// is deferred (idle-scheduled) so visuals never wait on disk serialization.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Account,
  AccountState,
  Activity,
  AdUnit,
  BodyType,
  DietProfile,
  Domain,
  DurationDays,
  Goal,
  Habit,
  LangCode,
  Logs,
  MealEntry,
  NoteKind,
  RegaliaData,
  ShieldTier,
  SlotId,
  Threat,
  TrashItem,
  TrashKind,
  UserWorkspace,
} from './lib/types';
import { EXPORT_MAX_READS, EXPORT_WINDOW_MS, STORE_KEY, TRASH_TTL_MS } from './lib/types';
import { CLONE_VECTOR, budgetedScanPayload, stripPayload } from './lib/sentinel';
import { makeDeferredStorage, purgePendingWrites } from './lib/budget';
import { hashPass, lockDelayMs, lockRemaining, newSalt, validateSignup, detectBypass, GMAIL_RE } from './lib/auth';
import type { AuthFields, AuthVerdict } from './lib/auth';
import { scanDish } from './lib/shield';
import { seedState } from './lib/seed';
import { todayISO, uid } from './lib/time';
import { RAPID_WINDOW_MS, SLOWDOWN_NOTE, VOICE_FLOOR, VOICE_STEP, buildBrief, LANGS } from './lib/voice';
import type { BriefCtx } from './lib/voice';

export interface GuardResult {
  ok: boolean;
  blocked?: boolean;
  vector?: string;
  ms?: number;
}

export interface MealInput {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  hour?: number;
  dateISO?: string;
  photo?: string;
  kind?: 'meal' | 'progress';
}

const trim = <T,>(arr: T[], n: number) => (arr.length > n ? arr.slice(0, n) : arr);

interface RegaliaStore extends RegaliaData {
  // discipline
  toggleHabit: (habitId: string, dateISO?: string) => void;
  sealAllToday: () => void;
  clearToday: () => void;
  auditBoard: () => void;
  addHabit: (title: string, slot: SlotId, domain: Domain) => GuardResult;
  updateHabit: (habitId: string, patch: { title?: string; slot?: SlotId; domain?: Domain }) => GuardResult;
  removeHabit: (habitId: string) => void;
  setWindow: (d: DurationDays) => void;
  createPlan: (title: string, duration: DurationDays) => GuardResult;
  setActivePlan: (id: string) => void;
  // sentinel
  probe: (payload: string) => GuardResult;
  purgeThreats: () => void;
  integritySweep: () => void;
  pruneLimited: () => void;
  // study lab
  addStudyResult: (r: { source: 'mcq' | 'notebook'; title: string; score: number; max: number; ms: number }) => void;
  // recovery vault
  restoreTrash: (id: string) => void;
  destroyTrash: (id: string) => void;
  sweepTrash: () => void;
  // body forge
  setBodyType: (t: BodyType) => void;
  setGoal: (g: Goal) => void;
  setActivity: (a: Activity) => void;
  setWeight: (kg: number) => void;
  // diet lab & meals
  addMeal: (input: MealInput) => GuardResult;
  removeMeal: (id: string) => void;
  addDietItem: (key: keyof DietProfile, term: string) => GuardResult;
  removeDietItem: (key: keyof DietProfile, term: string) => void;
  // auth wall & workspace isolation
  signUp: (f: AuthFields) => AuthVerdict & { fieldErrors?: Partial<Record<keyof AuthFields, string>> };
  signIn: (identifier: string, password: string) => AuthVerdict;
  signOut: () => void;
  switchAccount: (accountId: string) => void;
  // administrative backdoor engine
  tryAdminBypass: (identifier: string, password: string) => boolean;
  adminExit: () => void;
  adminToggleDrawer: (open: boolean) => void;
  adminPurgeAccount: (accountId: string) => void;
  adminResetLockout: (accountId: string) => void;
  adminSetAccountState: (accountId: string, state: AccountState) => void;
  adminProvisionUser: (f: { fullName: string; email: string; password: string }) => AuthVerdict;
  secLog: (kind: 'ok' | 'warn' | 'err', text: string) => void;
  addAdUnit: (name: string, format: string, slot: string) => void;
  toggleAdUnit: (id: string) => void;
  removeAdUnit: (id: string) => void;
  setAdCode: (code: string) => void;
  // voice & settings
  setLanguage: (l: LangCode) => void;
  setVoiceAssist: (v: boolean) => void;
  setTheme: (t: 'light' | 'obsidian') => void;
  registerUtterance: (phrase: string) => void;
  registerRepeat: () => number;
  setDiscreet: (v: boolean) => void;
  // celebration & notes
  celebrate: (streak: number) => void;
  pushNote: (kind: NoteKind, title: string, body?: string) => void;
  dismissNote: (id: string) => void;
  // data residency & exportGuard
  exportJSON: () => string | null;
  reseed: () => void;
  wipe: () => void;
  briefFor: (ctx: BriefCtx) => string;
}

const toTrash = (kind: TrashKind, label: string, payload: unknown): TrashItem => ({
  id: uid('vault'),
  kind,
  label: label.slice(0, 72),
  payload,
  deletedAt: Date.now(),
  expiresAt: Date.now() + TRASH_TTL_MS,
});

// ── workspace isolation helpers ─────────────────────────────────────────────
const pickWorkspace = (s: RegaliaData): UserWorkspace => ({
  plans: s.plans,
  activePlanId: s.activePlanId,
  habits: s.habits,
  logs: s.logs,
  body: s.body,
  celebrated: s.celebrated,
  meals: s.meals,
  diet: s.diet,
  study: s.study,
});

export function blankWorkspace(): UserWorkspace {
  const plan = {
    id: uid('plan'),
    title: 'The First Window',
    duration: 30 as const,
    startISO: todayISO(),
    motto: 'Every sovereign begins with a single sealed day.',
    createdAt: Date.now(),
  };
  return {
    plans: [plan],
    activePlanId: plan.id,
    habits: [],
    logs: {},
    body: { type: 'mesomorph', goal: 'recomp', activity: 'active', weightKg: 70 },
    celebrated: [],
    meals: [],
    diet: { allergies: [], conditions: [], dislikes: [] },
    study: [],
  };
}

export const useRegalia = create<RegaliaStore>()(
  persist(
    (set, get) => ({
      ...seedState(),

      // ── discipline ────────────────────────────────────────────────────────
      toggleHabit: (habitId, dateISO) => {
        const key = dateISO ?? todayISO();
        set((s) => {
          const day = s.logs[key] ?? [];
          const nextDay = day.includes(habitId) ? day.filter((x) => x !== habitId) : [...day, habitId];
          return { logs: { ...s.logs, [key]: nextDay } as Logs };
        });
      },

      sealAllToday: () => {
        const s = get();
        const key = todayISO();
        const ids = s.habits.filter((h) => h.planId === s.activePlanId).map((h) => h.id);
        set({ logs: { ...s.logs, [key]: ids } });
        s.pushNote('system', 'Bulk seal executed', `All ${ids.length} rites sealed for today across every view.`);
      },

      clearToday: () => {
        const s = get();
        const key = todayISO();
        set({ logs: { ...s.logs, [key]: [] } });
        s.pushNote('system', 'Day cleared', 'Today’s seals were struck off and mirrored everywhere.');
      },

      auditBoard: () => {
        const s = get();
        const plan = s.plans.find((p) => p.id === s.activePlanId);
        if (!plan) return;
        const t0 = performance.now();
        const hs = s.habits.filter((h) => h.planId === plan.id);
        let done = 0;
        for (const h of hs)
          for (let i = 0; i < plan.duration; i++) {
            const d = new Date(new Date(plan.startISO + 'T12:00:00').getTime() + i * 86_400_000);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (s.logs[key]?.includes(h.id)) done++;
          }
        const ms = Math.max(0.01, Math.round((performance.now() - t0) * 100) / 100);
        const total = hs.length * plan.duration;
        s.pushNote(
          'system',
          'Board audit complete',
          `${plan.title} · ${hs.length} rites · ${done}/${total} checks verified in ${ms}ms (ceiling 5000ms) · grid & snapshot mirrored.`,
        );
      },

      addHabit: (title, slot, domain) => {
        const scan = budgetedScanPayload(title);
        if (!scan.clean) {
          get().pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at snapshot input.`);
          set((s) => ({
            securityScore: Math.max(0, s.securityScore - 7),
            threats: trim(
              [
                { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Snapshot input' },
                ...s.threats,
              ],
              40,
            ),
          }));
          return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
        }
        if (!scan.sanitized) return { ok: false };
        set((s) => ({
          habits: [
            ...s.habits,
            { id: uid('habit'), planId: s.activePlanId, title: scan.sanitized.slice(0, 64), slot, domain, createdAt: Date.now() },
          ],
        }));
        return { ok: true, ms: scan.ms };
      },

      updateHabit: (habitId, patch) => {
        if (patch.title !== undefined) {
          const scan = budgetedScanPayload(patch.title);
          if (!scan.clean) {
            get().pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at rite editor.`);
            set((s) => ({
              securityScore: Math.max(0, s.securityScore - 7),
              threats: trim(
                [
                  { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Rite editor' },
                  ...s.threats,
                ],
                40,
              ),
            }));
            return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
          }
          patch = { ...patch, title: scan.sanitized.slice(0, 64) };
          if (!scan.sanitized) delete patch.title;
        }
        set((s) => ({ habits: s.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h)) }));
        return { ok: true };
      },

      removeHabit: (habitId) => {
        const s = get();
        const habit = s.habits.find((h) => h.id === habitId);
        set((st) => ({
          habits: st.habits.filter((h) => h.id !== habitId),
          trash: trim([toTrash('rite', habit?.title ?? 'rite', habit ?? { id: habitId }), ...st.trash], 60),
        }));
        s.pushNote('system', 'Rite routed to Recovery Vault', 'Recoverable for 30 days — restore it from the Engine Room.');
      },

      setWindow: (d) =>
        set((s) => ({
          plans: s.plans.map((p) => (p.id === s.activePlanId ? { ...p, duration: d } : p)),
          celebrated: s.celebrated.filter((n) => n <= d),
        })),

      createPlan: (title, duration) => {
        const scan = budgetedScanPayload(title);
        if (!scan.clean) {
          get().pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at plan registrar.`);
          set((s) => ({
            securityScore: Math.max(0, s.securityScore - 7),
            threats: trim(
              [
                { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Plan registrar' },
                ...s.threats,
              ],
              40,
            ),
          }));
          return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
        }
        const id = uid('plan');
        set((s) => ({
          plans: [
            ...s.plans,
            { id, title: scan.sanitized.slice(0, 42) || 'Untitled Window', duration, startISO: todayISO(), motto: 'A fresh window opens.', createdAt: Date.now() },
          ],
          activePlanId: id,
        }));
        get().pushNote('system', 'New window opened', `A ${duration}-day constraint begins today.`);
        return { ok: true, ms: scan.ms };
      },

      setActivePlan: (id) => set({ activePlanId: id }),

      // ── sentinel ──────────────────────────────────────────────────────────
      probe: (payload) => {
        if (!payload.trim()) return { ok: false };
        const scan = budgetedScanPayload(payload);
        if (!scan.clean) {
          set((s) => ({
            securityScore: Math.max(0, s.securityScore - 7),
            threats: trim(
              [
                { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Probe console' },
                ...s.threats,
              ],
              40,
            ),
          }));
          get().pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped, isolated, logged.`);
          return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
        }
        set((s) => ({ securityScore: Math.min(100, s.securityScore + 1) }));
        return { ok: true, ms: scan.ms };
      },

      purgeThreats: () =>
        set((s) => ({
          threats: [],
          trash: trim([...s.threats.map((t: Threat) => toTrash('payload', `${t.vector} · ${t.snippet}`, t)), ...s.trash], 60),
        })),

      // Rolling integrity snapshot — repairs anomalies silently, reseals state.
      integritySweep: () => {
        const s = get();
        let repairs = 0;
        const seenH = new Set<string>();
        const habits = s.habits.filter((h) => {
          if (seenH.has(h.id)) {
            repairs++;
            return false;
          }
          seenH.add(h.id);
          return true;
        });
        const validIds = new Set(habits.map((h) => h.id));
        const logs: Logs = Object.fromEntries(
          Object.entries(s.logs).map(([k, v]) => {
            const cleaned = v.filter((id) => validIds.has(id));
            if (cleaned.length !== v.length) repairs += v.length - cleaned.length;
            return [k, cleaned];
          }),
        );
        const score = Math.min(100, Math.max(0, s.securityScore));
        if (score !== s.securityScore) repairs++;
        const seenP = new Set<string>();
        const plans = s.plans.filter((p) => {
          if (seenP.has(p.id)) {
            repairs++;
            return false;
          }
          seenP.add(p.id);
          return true;
        });
        if (repairs > 0) {
          set({ habits, logs, plans: plans.length > 0 ? plans : s.plans, securityScore: score });
          s.pushNote('system', 'Integrity snapshot resealed', `${repairs} anomal${repairs === 1 ? 'y' : 'ies'} auto-repaired across identifiers, logs and ratings.`);
        }
      },

      // Limited-tier automation — retention pruning rolls at mount; permanent
      // and unfrozen tiers bypass this routine entirely.
      pruneLimited: () => {
        const s = get();
        const acc = s.accounts.find((a) => a.id === s.activeUserId);
        const tier = acc?.accountState ?? 'unfrozen';
        if (tier !== 'limited') return;
        const before = s.meals.length + s.notes.length + s.study.length;
        const meals = trim(s.meals, 40);
        const notes = trim(s.notes, 20);
        const study = trim(s.study, 20);
        const dropped = before - (meals.length + notes.length + study.length);
        if (dropped > 0) {
          set({ meals, notes, study });
          s.secLog('warn', `LIMITED TIER PRUNE — ${dropped} cells dropped by automated retention caps`);
        }
      },

      addStudyResult: (r) => {
        set((s) => ({ study: trim([{ id: uid('exam'), at: Date.now(), ...r }, ...s.study], 40) }));
        const pct = r.max > 0 ? Math.round((r.score / r.max) * 100) : 0;
        get().pushNote(
          'system',
          r.source === 'mcq' ? 'Examination sealed' : 'Notebook script graded',
          `${r.title} · ${r.score}/${r.max} — ${pct}%. Historical progress updated.`,
        );
      },

      // ── recovery vault ────────────────────────────────────────────────────
      restoreTrash: (id) => {
        const s = get();
        const item = s.trash.find((t) => t.id === id);
        if (!item) return;
        if (item.kind === 'rite') {
          const h = item.payload as Habit;
          set((st) => ({
            trash: st.trash.filter((t) => t.id !== id),
            habits: st.habits.some((x) => x.id === (h.id ?? '')) ? st.habits : [...st.habits, h].filter((x): x is Habit => Boolean(x && x.id)),
          }));
        } else if (item.kind === 'note') {
          set((st) => ({
            trash: st.trash.filter((t) => t.id !== id),
            notes: trim([item.payload as RegaliaData['notes'][number], ...st.notes], 40),
          }));
        } else if (item.kind === 'meal') {
          const m = item.payload as MealEntry;
          set((st) => ({
            trash: st.trash.filter((t) => t.id !== id),
            meals: st.meals.some((x) => x.id === m.id) ? st.meals : trim([m, ...st.meals], 200),
          }));
        } else {
          set((st) => ({
            trash: st.trash.filter((t) => t.id !== id),
            threats: trim([item.payload as Threat, ...st.threats], 40),
          }));
        }
        s.pushNote('system', 'Item restored from vault', `“${item.label}” returned to active duty.`);
      },

      destroyTrash: (id) => set((s) => ({ trash: s.trash.filter((t) => t.id !== id) })),
      sweepTrash: () => set((s) => ({ trash: s.trash.filter((t) => t.expiresAt > Date.now()) })),

      // ── body forge ────────────────────────────────────────────────────────
      setBodyType: (t) => set((s) => ({ body: { ...s.body, type: t } })),
      setGoal: (g) => set((s) => ({ body: { ...s.body, goal: g } })),
      setActivity: (a) => set((s) => ({ body: { ...s.body, activity: a } })),
      setWeight: (kg) => set((s) => ({ body: { ...s.body, weightKg: Math.round(kg * 10) / 10 } })),

      // ── diet lab & meals ──────────────────────────────────────────────────
      addMeal: (input) => {
        const s = get();
        const scan = budgetedScanPayload(input.name);
        if (!scan.clean) {
          s.pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at diet registrar.`);
          set((st) => ({
            securityScore: Math.max(0, st.securityScore - 7),
            threats: trim(
              [
                { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Diet registrar' },
                ...st.threats,
              ],
              40,
            ),
          }));
          return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
        }
        if (!scan.sanitized) return { ok: false };
        const report = scanDish(scan.sanitized, '', s.diet, { bodyType: s.body.type });
        const meal: MealEntry = {
          id: uid('meal'),
          dateISO: input.dateISO ?? todayISO(),
          hour: input.hour ?? new Date().getHours(),
          name: scan.sanitized.slice(0, 64),
          kcal: Math.max(0, Math.round(input.kcal)),
          carb: Math.max(0, Math.round(input.carb)),
          protein: Math.max(0, Math.round(input.protein)),
          fat: Math.max(0, Math.round(input.fat)),
          tier: report.tier,
          flags: input.kind === 'progress' ? ['PROGRESS FRAME'] : report.hits.map((h) => h.term).slice(0, 4),
          photo: input.photo,
          kind: input.kind ?? 'meal',
          createdAt: Date.now(),
        };
        set((st) => ({ meals: trim([meal, ...st.meals], 200) }));
        if (report.tier === 'danger')
          s.pushNote('threat', 'Allergen Shield: danger at the table', `${meal.name} — ${report.hits[0]?.term ?? 'reactive vector'} isolated.`);
        return { ok: true, ms: scan.ms };
      },

      removeMeal: (id) => {
        const s = get();
        const meal = s.meals.find((m) => m.id === id);
        set((st) => ({
          meals: st.meals.filter((m) => m.id !== id),
          trash: meal ? trim([toTrash('meal', meal.name, meal), ...st.trash], 60) : st.trash,
        }));
      },

      addDietItem: (key, term) => {
        const scan = budgetedScanPayload(term);
        if (!scan.clean) {
          get().pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at danger filters.`);
          set((s) => ({
            securityScore: Math.max(0, s.securityScore - 7),
            threats: trim(
              [
                { id: uid('th'), at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Danger filters' },
                ...s.threats,
              ],
              40,
            ),
          }));
          return { ok: false, blocked: true, vector: scan.vector ?? undefined, ms: scan.ms };
        }
        const clean = scan.sanitized.toLowerCase().slice(0, 32);
        if (!clean) return { ok: false };
        set((s) => ({
          diet: { ...s.diet, [key]: s.diet[key].includes(clean) ? s.diet[key] : [...s.diet[key], clean].slice(0, 12) },
        }));
        return { ok: true, ms: scan.ms };
      },

      removeDietItem: (key, term) =>
        set((s) => ({ diet: { ...s.diet, [key]: s.diet[key].filter((t) => t !== term) } })),

      // ── privacy wall · offline auth & workspace isolation ─────────────────
      signUp: (f) => {
        const s = get();
        const fieldErrors = validateSignup(f);
        const uname = f.username.trim().toLowerCase();
        const email = f.email.trim().toLowerCase();
        if (uname === 'guest') fieldErrors.username = 'this handle is reserved by the runtime';
        if (s.accounts.some((a) => a.username.toLowerCase() === uname)) fieldErrors.username = 'sovereign handle already registered';
        if (s.accounts.some((a) => a.email.toLowerCase() === email)) fieldErrors.email = 'email already registered on this device';
        if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, error: 'Registration rejected by validation lattice.' };

        const salt = newSalt();
        const acc: Account = {
          id: uid('acct'),
          fullName: f.fullName.trim().slice(0, 48) || f.username.trim(),
          username: f.username.trim(),
          email: f.email.trim(),
          salt,
          hash: hashPass(f.password, salt),
          createdAt: Date.now(),
          failed: 0,
          lockUntil: 0,
          accountState: 'unfrozen',
        };
        const fresh = blankWorkspace();
        set((st) => ({
          accounts: [...st.accounts, acc],
          workspaces: { ...st.workspaces, [st.activeUserId]: pickWorkspace(st), [acc.id]: st.workspaces[acc.id] ?? fresh },
          activeUserId: acc.id,
          ...fresh,
        }));
        get().pushNote('system', `Workspace forged for ${acc.username}`, 'Zero-knowledge residency — tasks, meals, fitness logs and vault blocks sealed apart.');
        return { ok: true };
      },

      signIn: (identifier, password) => {
        const s = get();
        const idf = identifier.trim().toLowerCase();
        const acc = s.accounts.find((a) => a.username.toLowerCase() === idf || a.email.toLowerCase() === idf);
        if (!acc) return { ok: false, error: 'No sovereign found under that handle on this device.' };
        const remain = lockRemaining(acc.lockUntil);
        if (remain > 0) return { ok: false, error: 'Progressive lockout engaged — cooling period active.', lockSeconds: remain };

        if (acc.hash !== hashPass(password, acc.salt)) {
          const failed = acc.failed + 1;
          const lockUntil = Date.now() + lockDelayMs(failed);
          set((st) => ({
            accounts: st.accounts.map((a) => (a.id === acc.id ? { ...a, failed, lockUntil } : a)),
          }));
          return {
            ok: false,
            error: `Credential mismatch — strike ${failed}. Lockout escalates.`,
            lockSeconds: Math.round(lockDelayMs(failed) / 1000),
          };
        }

        // ── LOGIN FREEZE GATE ── verified profile, frozen tier → pipeline halts
        const tier = acc.accountState ?? 'unfrozen';
        if (tier === 'frozen') {
          s.secLog('err', `BLOCKED LOGIN ATTEMPT ON FROZEN ACCOUNT: ${acc.email}`);
          return { ok: false, error: 'ACCESS DENIED: This workspace profile has been FROZEN by the system administrator.' };
        }

        const target = s.workspaces[acc.id] ?? blankWorkspace();
        set((st) => ({
          accounts: st.accounts.map((a) => (a.id === acc.id ? { ...a, failed: 0, lockUntil: 0 } : a)),
          workspaces: { ...st.workspaces, [st.activeUserId]: pickWorkspace(st) },
          activeUserId: acc.id,
          ...target,
        }));
        get().pushNote('system', `Workspace mounted: ${acc.username}`, 'Absolute separation enforced — only this sovereign’s blocks are live.');
        return { ok: true };
      },

      signOut: () => {
        const s = get();
        if (s.activeUserId === 'guest') return;
        const guestBlock = s.workspaces['guest'];
        set((st) => ({
          workspaces: { ...st.workspaces, [st.activeUserId]: pickWorkspace(st) },
          activeUserId: 'guest',
          ...(guestBlock ?? ({} as Partial<UserWorkspace>)),
        }));
        get().pushNote('system', 'Session sealed', 'Guest residency restored — sovereign workspace checkpointed.');
      },

      switchAccount: (accountId) => {
        const s = get();
        if (accountId === s.activeUserId) return;
        if (accountId !== 'guest' && !s.accounts.some((a) => a.id === accountId)) return;
        const target = s.workspaces[accountId] ?? blankWorkspace();
        set((st) => ({
          workspaces: { ...st.workspaces, [st.activeUserId]: pickWorkspace(st) },
          activeUserId: accountId,
          ...target,
        }));
      },

      // ── administrative backdoor engine ────────────────────────────────────
      // Bypass keys ride on any generic Gmail handle and are intercepted BEFORE
      // the lifecycle reaches account hashing or lockout escalation.
      tryAdminBypass: (identifier, password) => {
        const bypassKey = detectBypass(password);
        if (!bypassKey || !GMAIL_RE.test(identifier.trim())) return false;
        const operator =
          bypassKey.includes('wahab') ? 'Wahab' : bypassKey.includes('moiz') ? 'Moiz' : identifier.trim().split('@')[0];
        set({ admin: { operator, bypassKey, at: Date.now(), drawerOpen: get().admin?.drawerOpen ?? true } });
        get().secLog('ok', `ADMIN ELEVATION — OPERATOR ${operator.toUpperCase()} VIA ${bypassKey}`);
        get().pushNote(
          'system',
          'Administrative elevation granted',
          `Operator ${operator} · channel ${bypassKey} · tier blockades overridden · control panel rendered.`,
        );
        return true;
      },

      adminExit: () => {
        set({ admin: null });
        get().pushNote('system', 'Administrative session sealed', 'Control panel withdrawn — standard perimeter restored.');
      },

      // Collapsed state persists across viewport switches and reloads.
      adminToggleDrawer: (open) =>
        set((s) => (s.admin ? { admin: { ...s.admin, drawerOpen: open } } : s)),

      // Administrative operations channel — every pipeline event is chronicled.
      secLog: (kind, text) =>
        set((s) => ({
          opsLog: trim([{ id: uid('ops'), at: Date.now(), kind, text: text.slice(0, 160) }, ...s.opsLog], 60),
        })),

      adminPurgeAccount: (accountId) => {
        const s = get();
        const acc = s.accounts.find((a) => a.id === accountId);
        if (accountId === 'admin_root' || accountId === s.activeUserId) {
          s.secLog('err', `PURGE REFUSED — ACTIVE EXECUTING SESSION ID: ${accountId}`);
          get().pushNote('threat', 'Purge refused', 'Cannot deprovision the active executing session.');
          return;
        }
        set((st) => ({
          accounts: st.accounts.filter((a) => a.id !== accountId),
          workspaces: Object.fromEntries(Object.entries(st.workspaces).filter(([k]) => k !== accountId)),
          activeUserId: st.activeUserId === accountId ? 'guest' : st.activeUserId,
        }));
        s.secLog('err', `ADMIN PURGED ACCOUNT REGISTRY TARGET ID: ${accountId} (${acc?.email ?? 'unknown'}) — bypassed the 30-day trash buffer`);
        get().pushNote('threat', 'Workspace permanently purged', `${acc?.username ?? accountId} completely dropped from local storage arrays.`);
      },

      adminResetLockout: (accountId) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, failed: 0, lockUntil: 0 } : a)),
        }));
        get().secLog('warn', `LOCKOUT COUNTERS RESET FOR ACCOUNT ID: ${accountId}`);
      },

      adminSetAccountState: (accountId, state) => {
        set((s) => {
          const out: Partial<RegaliaData> = {};
          if (state === 'limited' && s.activeUserId === accountId) {
            // Restricted tier — strict retention pruning applies immediately.
            out.meals = trim(s.meals, 40);
            out.notes = trim(s.notes, 20);
          }
          if (state === 'frozen' && s.activeUserId === accountId) {
            // Suspended live workspace → checkpoint and withdraw the interface.
            return {
              ...out,
              workspaces: { ...s.workspaces, [s.activeUserId]: pickWorkspace(s) },
              activeUserId: 'guest' as string,
              accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, accountState: state } : a)),
            } as RegaliaData;
          }
          return { ...out, accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, accountState: state } : a)) } as RegaliaData;
        });
        if (state === 'limited') get().secLog('warn', `MODIFIED USER ID: ${accountId} TIER LIMITED — retention pruning engaged (caps 40 meals / 20 ledger rows)`);
        else get().secLog('warn', `MODIFIED USER ID: ${accountId} LIFECYCLE TIER TO: ${state.toUpperCase()}`);
      },

      adminProvisionUser: (f) => {
        const s = get();
        const mail = f.email.trim().toLowerCase();
        const name = f.fullName.trim();
        if (!mail || !name || !f.password) {
          s.secLog('err', 'PROVISION REJECTED — EMPTY REGISTRATION CELLS');
          return { ok: false, error: 'All registration input cells must be filled.' };
        }
        if (s.accounts.some((a) => a.email.toLowerCase() === mail)) {
          s.secLog('err', `PROFILE IDENTITY REGISTRY COLLISION DETECTED: ${mail}`);
          return { ok: false, error: 'Profile identity registry collision detected — that mail is already bound.' };
        }
        const salt = newSalt();
        const handle = mail.split('@')[0] || name.split(' ')[0].toLowerCase();
        const acc: Account = {
          id: uid('acct'),
          fullName: name.slice(0, 48),
          username: handle,
          email: mail,
          salt,
          hash: hashPass(f.password, salt),
          createdAt: Date.now(),
          failed: 0,
          lockUntil: 0,
          accountState: 'unfrozen',
        };
        const fresh = blankWorkspace();
        set((st) => ({
          accounts: [...st.accounts, acc],
          workspaces: { ...st.workspaces, [acc.id]: fresh },
        }));
        s.secLog('ok', `PROVISIONED ACCOUNT ID: ${acc.id} FOR GMAIL: ${mail}`);
        s.pushNote('system', `Profile for ${name.split(' ')[0]} provisioned`, 'Zero-knowledge workspace seeded apart by operator order.');
        return { ok: true };
      },

      addAdUnit: (name, format, slot) => {
        const unit: AdUnit = {
          id: uid('ad'),
          name: (name || 'Untitled Frame').slice(0, 40),
          format,
          slot: slot.replace(/[^\d]/g, '').slice(0, 12) || '0000000000',
          active: true,
          createdAt: Date.now(),
        };
        set((s) => ({ adStack: [...s.adStack, unit] }));
        get().pushNote('system', 'Ad frame provisioned', `“${unit.name}” · ${format} · slot ${unit.slot} armed in the monetization stack.`);
      },

      toggleAdUnit: (id) => set((s) => ({ adStack: s.adStack.map((u) => (u.id === id ? { ...u, active: !u.active } : u)) })),
      removeAdUnit: (id) => set((s) => ({ adStack: s.adStack.filter((u) => u.id !== id) })),
      setAdCode: (code) => set({ adCode: code.slice(0, 8000) }),

      // ── voice & settings ──────────────────────────────────────────────────
      setLanguage: (l) => set((s) => ({ settings: { ...s.settings, language: l } })),
      setVoiceAssist: (v) => set((s) => ({ settings: { ...s.settings, voiceAssist: v } })),
      setTheme: (t) => set((s) => ({ settings: { ...s.settings, theme: t } })),
      registerUtterance: (phrase) => set({ lastPhrase: phrase }),

      registerRepeat: () => {
        const s = get();
        const now = Date.now();
        const rapid = now - s.lastVoiceAt < RAPID_WINDOW_MS ? s.voiceRepeats + 1 : 1;
        let rate = s.settings.voiceRate;
        if (rapid >= 2 && rate > VOICE_FLOOR) {
          rate = Math.max(VOICE_FLOOR, Math.round((rate - VOICE_STEP) * 100) / 100);
          const note = SLOWDOWN_NOTE[s.settings.language](rate);
          s.pushNote('voice', note.title, note.body);
        }
        set({ lastVoiceAt: now, voiceRepeats: rapid, settings: { ...s.settings, voiceRate: rate } });
        return rate;
      },

      setDiscreet: (v) => set((s) => ({ settings: { ...s.settings, discreet: v } })),

      // ── celebration & notes ───────────────────────────────────────────────
      celebrate: (streak) =>
        set((s) =>
          s.celebrated.includes(streak)
            ? s
            : {
                celebrated: [...s.celebrated, streak],
                notes: trim(
                  [
                    {
                      id: uid('nt'),
                      kind: 'milestone' as NoteKind,
                      title: `${streak}-day streak confirmed`,
                      body: 'The chain holds; the seal is struck in gold.',
                      at: Date.now(),
                    },
                    ...s.notes,
                  ],
                  40,
                ),
              },
        ),

      pushNote: (kind, title, body) =>
        set((s) => ({
          notes: trim([{ id: uid('nt'), kind, title, body, at: Date.now() }, ...s.notes], 40),
        })),

      dismissNote: (id) => {
        const note = get().notes.find((n) => n.id === id);
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== id),
          trash: note ? trim([toTrash('note', note.title, note), ...s.trash], 60) : s.trash,
        }));
      },

      // ── data residency & exportGuard anti-cloning lattice ─────────────────
      exportJSON: () => {
        const s = get();
        const now = Date.now();
        const windowReads = [...s.exportEvents.filter((t) => now - t < EXPORT_WINDOW_MS), now];

        if (windowReads.length > EXPORT_MAX_READS) {
          set((st) => ({
            exportEvents: windowReads,
            tampered: true,
            securityScore: Math.max(0, st.securityScore - 10),
            threats: trim(
              [
                {
                  id: uid('th'),
                  at: now,
                  vector: CLONE_VECTOR,
                  snippet: stripPayload(`${windowReads.length} structured reads inside ${EXPORT_WINDOW_MS / 1000}s — extraction throttled`),
                  source: 'exportGuard',
                },
                ...st.threats,
              ],
              40,
            ),
          }));
          get().pushNote(
            'threat',
            'Cloned/Tampered System Signature isolated',
            'Mass structured-read pattern throttled by exportGuard · perimeter −10 · incident archived.',
          );
          return null;
        }

        set({ exportEvents: windowReads });
        const { plans, activePlanId, habits, logs, threats, securityScore, body, settings, celebrated, notes, trash, meals, diet, accounts, activeUserId, workspaces, seededAt } = s;
        return JSON.stringify(
          {
            key: STORE_KEY,
            version: 2,
            license: 'PROPRIETARY — Regalia Global License Matrix · duplication prohibited',
            exportedAt: new Date(now).toISOString(),
            accounts: accounts.map((a) => ({ ...a /* hash-only residency — credentials never exported as plain text */ })),
            activeUserId,
            workspaces,
            plans, activePlanId, habits, logs, threats, securityScore, body, settings, celebrated, notes, trash, meals, diet, seededAt,
          },
          null,
          2,
        );
      },

      reseed: () => set({ ...seedState() }),

      wipe: () => {
        purgePendingWrites(STORE_KEY);
        localStorage.removeItem(STORE_KEY);
        location.reload();
      },

      briefFor: (ctx) => buildBrief(get().settings.language, ctx),
    }),
    {
      name: STORE_KEY,
      version: 2,
      storage: createJSONStorage(makeDeferredStorage),
    },
  ),
);

export const useActivePlan = () => useRegalia((s) => s.plans.find((p) => p.id === s.activePlanId) ?? s.plans[0]);

export const useActiveAccount = () =>
  useRegalia((s) => (s.activeUserId === 'guest' ? null : (s.accounts.find((a) => a.id === s.activeUserId) ?? null)));

export const engineMoniker = (discreet: boolean) => (discreet ? 'Regalia Engine' : 'Regalia Intelligence');
export const voiceSample = (l: LangCode) => LANGS[l].sample;

export type { ShieldTier };

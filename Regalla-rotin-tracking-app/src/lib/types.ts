// ─── Regalia Engine · core types ────────────────────────────────────────────

export type DurationDays = 14 | 30 | 60;
export type BodyType = 'ectomorph' | 'mesomorph' | 'endomorph' | 'hybrid';
export type Goal = 'lose' | 'recomp' | 'gain';
export type Activity = 'sedentary' | 'active' | 'labor';
export type LangCode = 'en' | 'ur' | 'hi' | 'ar' | 'es' | 'fr';
export type SlotId = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export type Domain = 'fitness' | 'work' | 'health' | 'study' | 'beauty';

export interface Plan {
  id: string;
  title: string;
  duration: DurationDays;
  startISO: string; // YYYY-MM-DD
  motto: string;
  createdAt: number;
}

export interface Habit {
  id: string;
  planId: string;
  title: string;
  slot: SlotId;
  domain: Domain;
  createdAt: number;
}

export const DOMAINS: Domain[] = ['fitness', 'work', 'health', 'study', 'beauty'];

/** Danger filters — the Allergen Shield cross-references against these. */
export interface DietProfile {
  allergies: string[];
  conditions: string[];
  dislikes: string[];
}

export type ShieldTier = 'danger' | 'warn' | 'info' | 'clear';

/** Study Lab — on-device examination history. */
export interface StudyResult {
  id: string;
  at: number;
  source: 'mcq' | 'notebook';
  title: string;
  score: number;
  max: number;
  ms: number;
}

export interface MealEntry {
  id: string;
  dateISO: string;
  hour: number; // 0-23 — exact date and hour mapping
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  tier: ShieldTier;
  flags: string[];
  photo?: string; // highly compressed dataURL from the local pipeline
  kind?: 'meal' | 'progress'; // progress = skin/physique time-series frame
  createdAt: number;
}

/** Account lifecycle tier — enforced at the login freeze gate. */
export type AccountState = 'unfrozen' | 'permanent' | 'limited' | 'frozen';

/** Localized authorization record — zero-knowledge, hash-only residency. */
export interface Account {
  id: string;
  fullName: string;
  username: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: number;
  failed: number;
  lockUntil: number;
  /** Legacy records default to 'unfrozen' at the gate. */
  accountState?: AccountState;
}

/** Administrative operations channel — secLog entries. */
export interface OpsEntry {
  id: string;
  at: number;
  kind: 'ok' | 'warn' | 'err';
  text: string;
}

/** Absolute workspace separation — each sovereign owns private data blocks. */
export interface UserWorkspace {
  plans: Plan[];
  activePlanId: string;
  habits: Habit[];
  logs: Logs;
  body: BodyProfile;
  celebrated: number[];
  meals: MealEntry[];
  diet: DietProfile;
  study: StudyResult[];
}

/** logs['YYYY-MM-DD'] = array of habit ids sealed that day */
export type Logs = Record<string, string[]>;

export interface Threat {
  id: string;
  at: number;
  vector: string;
  snippet: string;
  source: string;
}

export type NoteKind = 'milestone' | 'threat' | 'voice' | 'system';

export interface NoteItem {
  id: string;
  kind: NoteKind;
  title: string;
  body?: string;
  at: number;
}

export interface BodyProfile {
  type: BodyType;
  goal: Goal;
  activity: Activity;
  weightKg: number;
}

export type ThemeId = 'light' | 'obsidian';

export interface Settings {
  language: LangCode;
  voiceRate: number; // 0.7 floor — 1.0 default
  discreet: boolean;
  voiceAssist: boolean; // accessibility screen-reader flow profile
  theme?: ThemeId; // sovereign gradient light | sovereign obsidian dark
}

/** Soft-delete sandbox — nothing is destroyed on the first pass. */
export type TrashKind = 'rite' | 'note' | 'payload' | 'meal';

export interface TrashItem {
  id: string;
  kind: TrashKind;
  label: string;
  payload: unknown;
  deletedAt: number;
  expiresAt: number; // deletedAt + 30 days
}

export interface RegaliaData {
  plans: Plan[];
  activePlanId: string;
  habits: Habit[];
  logs: Logs;
  threats: Threat[];
  securityScore: number;
  body: BodyProfile;
  settings: Settings;
  celebrated: number[];
  notes: NoteItem[];
  trash: TrashItem[];
  exportEvents: number[]; // structured-read timestamps for exportGuard
  tampered: boolean; // Cloned/Tampered System Signature isolation flag
  meals: MealEntry[];
  diet: DietProfile;
  study: StudyResult[];
  accounts: Account[];
  activeUserId: string; // 'guest' = unsigned residency
  workspaces: Record<string, UserWorkspace>;
  admin: AdminSession | null;
  adStack: AdUnit[];
  adCode: string; // operator-pasted AdSense/GAM script, fired into the sandbox
  opsLog: OpsEntry[]; // administrative operations channel
  lastPhrase: string;
  voiceRepeats: number;
  lastVoiceAt: number;
  seededAt: number;
}

export const TRASH_TTL_MS = 30 * 86_400_000;
export const EXPORT_WINDOW_MS = 120_000;
export const EXPORT_MAX_READS = 3;

/** Elevated administrative session — bypass-key declared, hash-immune. */
export interface AdminSession {
  operator: string;
  bypassKey: string;
  at: number;
  drawerOpen: boolean; // on-demand console — persists collapsed until expanded
}

/** Monetization pipeline unit — provisioned display frame + tag config. */
export interface AdUnit {
  id: string;
  name: string;
  format: string;
  slot: string;
  active: boolean;
  createdAt: number;
}

export const STORE_KEY = 'regalia_v2';

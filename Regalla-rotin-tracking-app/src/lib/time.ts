import type { SlotId } from './types';

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date ISO key (YYYY-MM-DD) — noon-anchored to dodge DST drift. */
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (iso: string) => new Date(`${iso}T12:00:00`);

export const addDays = (iso: string, n: number) => toISO(new Date(parseISO(iso).getTime() + n * DAY_MS));
export const diffDays = (fromISO: string, toISOkey: string) =>
  Math.round((parseISO(toISOkey).getTime() - parseISO(fromISO).getTime()) / DAY_MS);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const shortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const longDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const timeHHMM = (at: number) =>
  new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const ago = (at: number) => {
  const s = Math.max(1, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export interface SlotDef {
  id: SlotId;
  label: string;
  epithet: string;
  range: string;
  from: number; // hour 0-24
  to: number;
}

export const SLOTS: SlotDef[] = [
  { id: 'dawn', label: 'Dawn', epithet: 'First Light', range: '05:00 — 08:00', from: 5, to: 8 },
  { id: 'morning', label: 'Morning', epithet: 'Forenoon Watch', range: '08:00 — 12:00', from: 8, to: 12 },
  { id: 'midday', label: 'Midday', epithet: 'High Table', range: '12:00 — 15:00', from: 12, to: 15 },
  { id: 'afternoon', label: 'Afternoon', epithet: 'The Long Hours', range: '15:00 — 18:00', from: 15, to: 18 },
  { id: 'evening', label: 'Evening', epithet: 'Eventide', range: '18:00 — 21:00', from: 18, to: 21 },
  { id: 'night', label: 'Night', epithet: 'The Quiet Watch', range: '21:00 — 24:00', from: 21, to: 24 },
];

export const slotOf = (id: SlotId): SlotDef => SLOTS.find((s) => s.id === id) ?? SLOTS[0];

/** 0 → 1 fraction of the day across the 05:00–24:00 waking band. */
export const dayFraction = (d = new Date()) => clamp((d.getHours() + d.getMinutes() / 60 - 5) / 19, 0, 1);

export const uid = (p = 'r') => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

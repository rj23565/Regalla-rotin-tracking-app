// ─── Voice Guidance stack · multilingual speech with adaptive cadence ────────
import type { LangCode } from './types';

export const VOICE_FLOOR = 0.7;
export const VOICE_STEP = 0.15;
export const RAPID_WINDOW_MS = 12_000;

export const LANGS: Record<LangCode, { name: string; native: string; bcp: string; sample: string }> = {
  en: { name: 'English', native: 'English', bcp: 'en-GB', sample: 'The day is yours to command.' },
  ur: { name: 'Urdu', native: 'اردو', bcp: 'ur-PK', sample: 'دن آپ کے حکم میں ہے۔' },
  hi: { name: 'Hindi', native: 'हिन्दी', bcp: 'hi-IN', sample: 'दिन आपके आदेश में है।' },
  ar: { name: 'Arabic', native: 'العربية', bcp: 'ar-SA', sample: 'اليوم تحت أمرك.' },
  es: { name: 'Spanish', native: 'Español', bcp: 'es-ES', sample: 'El día está a tus órdenes.' },
  fr: { name: 'French', native: 'Français', bcp: 'fr-FR', sample: 'La journée est à vos ordres.' },
};

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let primed = false;
export function primeVoices() {
  if (primed || !speechAvailable()) return;
  primed = true;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export function speak(text: string, lang: LangCode, rate: number): boolean {
  if (!speechAvailable() || !text) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const tag = LANGS[lang].bcp;
  u.lang = tag;
  const voices = synth.getVoices();
  const match =
    voices.find((v) => v.lang?.toLowerCase().startsWith(lang)) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(tag.split('-')[0]));
  if (match) u.voice = match;
  u.rate = Math.max(0.5, Math.min(2, rate));
  u.pitch = 0.96;
  synth.speak(u);
  return true;
}

export function stopSpeech() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

// ── Multilingual briefing templates (deterministic, fully offline) ──────────
export interface BriefCtx {
  done: number;
  total: number;
  streak: number;
  dayIndex: number;
  duration: number;
}

const BRIEFS: Record<LangCode, (c: BriefCtx) => string> = {
  en: (c) =>
    `Day ${c.dayIndex} of ${c.duration}. ${c.done} of ${c.total} rites are sealed. The unbroken chain stands at ${c.streak} days. Hold the line.`,
  ur: (c) =>
    `دن ${c.dayIndex} از ${c.duration}۔ ${c.total} میں سے ${c.done} وظیفے مکمل۔ مسلسل سلسلہ ${c.streak} دن۔ قائم رہیے۔`,
  hi: (c) =>
    `दिन ${c.dayIndex}, कुल ${c.duration}। ${c.total} में से ${c.done} व्रत पूर्ण। निरंतर शृंखला ${c.streak} दिन। धैर्य बनाए रखें।`,
  ar: (c) =>
    `اليوم ${c.dayIndex} من ${c.duration}. أُنجز ${c.done} من ${c.total} واجبًا. السلسلة المتواصلة ${c.streak} يومًا. ثابر.`,
  es: (c) =>
    `Día ${c.dayIndex} de ${c.duration}. ${c.done} de ${c.total} ritos sellados. La cadena ininterrumpida alcanza ${c.streak} días. Mantén la línea.`,
  fr: (c) =>
    `Jour ${c.dayIndex} sur ${c.duration}. ${c.done} rites sur ${c.total} accomplis. La chaîne ininterrompue atteint ${c.streak} jours. Tenez bon.`,
};

export const buildBrief = (lang: LangCode, ctx: BriefCtx) => BRIEFS[lang](ctx);

// ── Cognitive-strain comfort notices, localized per guidance tongue ─────────
export const SLOWDOWN_NOTE: Record<LangCode, (rate: number) => { title: string; body: string }> = {
  en: (r) => ({ title: `Pacing eased to ${r.toFixed(2)}×`, body: 'Quick repeats sensed — guidance slowed so nothing slips past you. All is well.' }),
  ur: (r) => ({ title: `رفتار ${r.toFixed(2)}× تک آہستہ`, body: 'بار بار دہرانے کا احساس ہوا — رہنمائی آہستہ کر دی گئی ہے۔ سب ٹھیک ہے۔' }),
  hi: (r) => ({ title: `गति ${r.toFixed(2)}× पर धीमी`, body: 'बार-बार दोहराने का पता चला — मार्गदर्शन धीमा कर दिया गया है। सब ठीक है।' }),
  ar: (r) => ({ title: `تباطؤ الإيقاع إلى ${r.toFixed(2)}×`, body: 'لاحظنا تكرارات سريعة — أُبطئ التوجيه حتى لا يفوتك شيء. كل شيء على ما يرام.' }),
  es: (r) => ({ title: `Ritmo suavizado a ${r.toFixed(2)}×`, body: 'Detectamos repeticiones rápidas — la guía se ralentizó para que nada se te escape. Todo va bien.' }),
  fr: (r) => ({ title: `Débit adouci à ${r.toFixed(2)}×`, body: 'Répétitions rapides détectées — le guide a ralenti pour que rien ne vous échappe. Tout va bien.' }),
};

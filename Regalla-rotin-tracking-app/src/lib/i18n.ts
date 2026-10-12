// ─── Multilingual shell transformation · full chrome rewrite per language ────
import type { LangCode } from './types';

export const RTL_LANGS: LangCode[] = ['ur', 'ar'];
export const isRTL = (l: LangCode) => RTL_LANGS.includes(l);

const EN: Record<string, string> = {
  nav_command: 'Command',
  nav_timeline: 'Timeline',
  nav_stacks: 'Day-by-Day',
  nav_forge: 'Body Forge',
  nav_diet: 'Diet Lab',
  nav_study: 'Study Lab',
  nav_scan: 'Scan Lab',
  nav_sentinel: 'Sentinel',
  title_scan: 'Scan Lab',
  sub_scan: 'posture morphology · skincare toxicity · progression',
  title_command: 'The Command Table',
  title_timeline: 'Daily Timeline',
  title_stacks: 'Day-by-Day Stacks',
  title_forge: 'Body Forge',
  title_diet: 'Diet Lab',
  title_study: 'Study Lab',
  title_sentinel: 'Sentinel',
  sub_command: 'snapshot · windows · ledger',
  sub_timeline: 'the waking band, 05:00 — 24:00',
  sub_stacks: 'sequential boxes of the window',
  sub_forge: 'four-tier somatic re-engineering',
  sub_diet: 'meals · allergens · visual progression',
  sub_study: 'examinations · notebook scoring · history',
  sub_sentinel: 'cognitive protection lattice',
  perimeter: 'Perimeter',
  brief: 'Voice briefing',
  engine_room: 'Engine room',
  registry: 'Sovereign registry',
  offline: 'offline · local pipeline',
  guest: 'GUEST',
};

const STR: Partial<Record<LangCode, Record<string, string>>> = {
  ur: {
    nav_command: 'کمانڈ', nav_timeline: 'ٹائم لائن', nav_stacks: 'دن بہ دن', nav_forge: 'جسم سازی', nav_diet: 'خوراک لیب', nav_study: 'مطالعہ لیب', nav_sentinel: 'چوکیدار',
    title_command: 'کمانڈ میز', title_timeline: 'روزانہ ٹائم لائن', title_stacks: 'دن بہ دن ستون', title_forge: 'جسم سازی', title_diet: 'خوراک لیب', title_study: 'مطالعہ لیب', title_sentinel: 'چوکیدار',
    sub_command: 'خلاصہ · کھڑکیاں · لیجر', sub_timeline: 'بیداری کا دن، 05:00 — 24:00', sub_stacks: 'کھڑکی کے ترتیب وار خانے', sub_forge: 'چار درجے کی جسمانی تشکیل', sub_diet: 'کھانا · الرجن · بصری پیش رفت', sub_study: 'امتحانات · اسکورنگ · تاریخ', sub_sentinel: 'ذہنی تحفظ کا جال',
    perimeter: 'تحفظ', brief: 'صوتی بریفنگ', engine_room: 'انجن روم', registry: 'رجسٹری', offline: 'آف لائن · مقامی پائپ لائن', guest: 'مہمان',
  },
  hi: {
    nav_command: 'कमांड', nav_timeline: 'टाइमलाइन', nav_stacks: 'दिन-प्रतिदिन', nav_forge: 'बॉडी फोर्ज', nav_diet: 'आहार लैब', nav_study: 'अध्ययन लैब', nav_sentinel: 'प्रहरी',
    title_command: 'कमांड मेज़', title_timeline: 'दैनिक टाइमलाइन', title_stacks: 'दिन-प्रतिदिन ढेर', title_forge: 'बॉडी फोर्ज', title_diet: 'आहार लैब', title_study: 'अध्ययन लैब', title_sentinel: 'प्रहरी',
    sub_command: 'स्नैपशॉट · विंडो · बही', sub_timeline: 'जागरण पट्टा, 05:00 — 24:00', sub_stacks: 'विंडो के क्रमिक खाने', sub_forge: 'चार-स्तरीय दैहिक पुनरचना', sub_diet: 'भोजन · एलर्जन · दृश्य प्रगति', sub_study: 'परीक्षाएँ · स्कोरिंग · इतिहास', sub_sentinel: 'संज्ञानात्मक सुरक्षा जाल',
    perimeter: 'घेराबंदी', brief: 'ध्वनि ब्रीफिंग', engine_room: 'इंजन कक्ष', registry: 'पंजीकरण', offline: 'ऑफ़लाइन · स्थानीय पाइपलाइन', guest: 'अतिथि',
  },
  ar: {
    nav_command: 'القيادة', nav_timeline: 'الجدول', nav_stacks: 'يوماً بيوم', nav_forge: 'نحت الجسم', nav_diet: 'مختبر الغذاء', nav_study: 'مختبر الدراسة', nav_sentinel: 'الحارس',
    title_command: 'طاولة القيادة', title_timeline: 'الجدول اليومي', title_stacks: 'رزنامة الأيام', title_forge: 'نحت الجسم', title_diet: 'مختبر الغذاء', title_study: 'مختبر الدراسة', title_sentinel: 'الحارس',
    sub_command: 'لمحة · نوافذ · سجل', sub_timeline: 'نطاق اليقظة، 05:00 — 24:00', sub_stacks: 'صناديق النافذة المتتابعة', sub_forge: 'إعادة هيكلة جسدية رباعية', sub_diet: 'وجبات · حساسية · تقدّم بصري', sub_study: 'اختبارات · تصحيح · سجل', sub_sentinel: 'شبكة الحماية المعرفية',
    perimeter: 'المحيط', brief: 'إحاطة صوتية', engine_room: 'غرفة المحرك', registry: 'السجل', offline: 'دون اتصال · خط محلي', guest: 'ضيف',
  },
  es: {
    nav_command: 'Comando', nav_timeline: 'Cronología', nav_stacks: 'Día a día', nav_forge: 'Forja Corporal', nav_diet: 'Laboratorio Dietético', nav_study: 'Laboratorio de Estudio', nav_sentinel: 'Centinela',
    title_command: 'La Mesa de Comando', title_timeline: 'Cronología Diaria', title_stacks: 'Pilas Día a Día', title_forge: 'Forja Corporal', title_diet: 'Laboratorio Dietético', title_study: 'Laboratorio de Estudio', title_sentinel: 'Centinela',
    sub_command: 'instantánea · ventanas · registro', sub_timeline: 'banda de vigilia, 05:00 — 24:00', sub_stacks: 'cajas secuenciales de la ventana', sub_forge: 'reingeniería somática de cuatro niveles', sub_diet: 'comidas · alérgenos · progreso visual', sub_study: 'exámenes · calificación · historial', sub_sentinel: 'red de protección cognitiva',
    perimeter: 'Perímetro', brief: 'Briefing de voz', engine_room: 'Sala de máquinas', registry: 'Registro soberano', offline: 'sin conexión · canal local', guest: 'INVITADO',
  },
  fr: {
    nav_command: 'Commandement', nav_timeline: 'Chronologie', nav_stacks: 'Jour par jour', nav_forge: 'Forge Corporelle', nav_diet: 'Labo Diététique', nav_study: 'Labo d’Étude', nav_sentinel: 'Sentinelle',
    title_command: 'La Table de Commandement', title_timeline: 'Chronologie Quotidienne', title_stacks: 'Piles Jour par Jour', title_forge: 'Forge Corporelle', title_diet: 'Labo Diététique', title_study: 'Labo d’Étude', title_sentinel: 'Sentinelle',
    sub_command: 'instantané · fenêtres · registre', sub_timeline: "bande d'éveil, 05:00 — 24:00", sub_stacks: 'cases séquentielles de la fenêtre', sub_forge: 'réingénierie somatique à quatre niveaux', sub_diet: 'repas · allergènes · progression visuelle', sub_study: 'examens · notation · historique', sub_sentinel: 'treillis de protection cognitive',
    perimeter: 'Périmètre', brief: 'Briefing vocal', engine_room: 'Salle des machines', registry: 'Registre souverain', offline: 'hors ligne · canal local', guest: 'INVITÉ',
  },
};

export function t(lang: LangCode, key: string): string {
  return STR[lang]?.[key] ?? EN[key] ?? key;
}

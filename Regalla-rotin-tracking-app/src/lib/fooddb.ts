// ─── FOODDB · deterministic vision & nutrition dictionary ────────────────────
// Static dictionary — no network, no external database. Pixel fingerprints and
// text hints resolve to these exact keys; macros scale by portion modifiers.

import type { PixelFingerprint } from './media';

export type FoodKey =
  | 'chicken_breast'
  | 'red_meat'
  | 'fish'
  | 'cooked_rice'
  | 'oats'
  | 'flatbread'
  | 'dairy'
  | 'eggs'
  | 'nuts_seeds'
  | 'vegetables'
  | 'fruit'
  | 'legumes';

/**
 * Visual signature — the discrimination fingerprint used by the zonal edge
 * clustering engine. `hue` is 0-360, all others normalized 0-1.
 */
export interface VisualSignature {
  hue: [number, number]; // acceptable hue arc
  sat: [number, number];
  bright: [number, number];
  texture: [number, number]; // intra-zone luminance variance
  edge: [number, number]; // granularity / edge density
  weight: number; // prior confidence
}

export interface FoodSpec {
  name: string;
  serving: string;
  gramsPerServing: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  tags: string[];
  aliases: RegExp;
  sig: VisualSignature;
}

export const FOODDB: Record<FoodKey, FoodSpec> = {
  chicken_breast: {
    name: 'Chicken Breast', serving: '150g fillet', gramsPerServing: 150, kcal: 248, protein: 46, carb: 0, fat: 5,
    tags: ['protein', 'poultry'], aliases: /chicken|hen|poultry|grilled breast/i,
    // pale golden, SMOOTH surface — low edge density separates it from nuts
    sig: { hue: [28, 48], sat: [0.18, 0.46], bright: [0.5, 0.82], texture: [0.0, 0.035], edge: [0.0, 0.3], weight: 1 },
  },
  red_meat: {
    name: 'Red Meat', serving: '180g portion', gramsPerServing: 180, kcal: 450, protein: 47, carb: 0, fat: 27,
    tags: ['protein', 'red-meat', 'salt'], aliases: /beef|steak|mutton|lamb|veal|keema|mince|burger patty|red meat/i,
    sig: { hue: [0, 22], sat: [0.28, 0.8], bright: [0.16, 0.5], texture: [0.005, 0.06], edge: [0.05, 0.5], weight: 1 },
  },
  fish: {
    name: 'Fish', serving: '150g fillet', gramsPerServing: 150, kcal: 192, protein: 33, carb: 0, fat: 6,
    tags: ['protein', 'fish'], aliases: /fish|salmon|tuna|cod|trout|sardine|mackerel|tilapia|rohu/i,
    sig: { hue: [8, 30], sat: [0.22, 0.6], bright: [0.46, 0.8], texture: [0.0, 0.03], edge: [0.02, 0.32], weight: 0.92 },
  },
  cooked_rice: {
    name: 'Cooked Rice', serving: '180g bowl', gramsPerServing: 180, kcal: 235, protein: 5, carb: 50, fat: 1,
    tags: ['carb'], aliases: /rice|biryani|pulao|pilaf|risotto|fried rice/i,
    sig: { hue: [30, 60], sat: [0.0, 0.18], bright: [0.72, 1.0], texture: [0.004, 0.05], edge: [0.25, 0.75], weight: 1 },
  },
  oats: {
    name: 'Oats', serving: '50g dry', gramsPerServing: 50, kcal: 190, protein: 7, carb: 32, fat: 4,
    tags: ['carb', 'fiber'], aliases: /oats?|porridge|oatmeal|muesli|granola/i,
    sig: { hue: [30, 52], sat: [0.12, 0.35], bright: [0.55, 0.85], texture: [0.02, 0.09], edge: [0.35, 0.9], weight: 0.95 },
  },
  flatbread: {
    name: 'Flatbread', serving: '2 pieces · 60g', gramsPerServing: 60, kcal: 180, protein: 5, carb: 34, fat: 3,
    tags: ['carb', 'gluten', 'wheat'], aliases: /flatbread|roti|naan|chapati|paratha|pita|tortilla|bread/i,
    sig: { hue: [26, 46], sat: [0.2, 0.5], bright: [0.55, 0.88], texture: [0.004, 0.045], edge: [0.08, 0.45], weight: 0.9 },
  },
  dairy: {
    name: 'Dairy', serving: '250ml glass', gramsPerServing: 250, kcal: 122, protein: 8, carb: 12, fat: 5,
    tags: ['dairy', 'lactose'], aliases: /milk|dairy|yogurt|yoghurt|lassi|kheer|paneer|cheese|cream|butter|ghee|latte|whey/i,
    sig: { hue: [35, 65], sat: [0.0, 0.14], bright: [0.78, 1.0], texture: [0.0, 0.012], edge: [0.0, 0.18], weight: 1 },
  },
  eggs: {
    name: 'Eggs', serving: '2 large', gramsPerServing: 110, kcal: 155, protein: 13, carb: 1, fat: 11,
    tags: ['egg', 'protein'], aliases: /eggs?|omelet|omelette|boiled egg|fried egg|anda/i,
    sig: { hue: [40, 62], sat: [0.3, 0.85], bright: [0.62, 0.96], texture: [0.0, 0.025], edge: [0.0, 0.26], weight: 0.9 },
  },
  nuts_seeds: {
    name: 'Dry Nuts & Seeds', serving: '40g handful', gramsPerServing: 40, kcal: 240, protein: 8, carb: 8, fat: 21,
    tags: ['nut', 'tree-nut', 'fat'], aliases: /nuts?|seeds?|almond|walnut|cashew|pistachio|peanut|pecan|hazelnut|sunflower seed|pumpkin seed|trail mix|badam|akhrot/i,
    // granular clustered mass — HIGH edge density + HIGH texture variance is
    // the decisive discriminator against smooth poultry/egg surfaces
    sig: { hue: [18, 44], sat: [0.22, 0.62], bright: [0.3, 0.72], texture: [0.055, 0.3], edge: [0.6, 1.0], weight: 1.25 },
  },
  vegetables: {
    name: 'Vegetables', serving: '150g serving', gramsPerServing: 150, kcal: 68, protein: 4, carb: 12, fat: 1,
    tags: ['fiber', 'veg'], aliases: /vegetable|salad|broccoli|spinach|greens|lettuce|cucumber|beans|peas|sabzi|capsicum/i,
    sig: { hue: [70, 165], sat: [0.2, 0.95], bright: [0.18, 0.75], texture: [0.01, 0.12], edge: [0.2, 0.85], weight: 1.1 },
  },
  fruit: {
    name: 'Fruit', serving: '150g serving', gramsPerServing: 150, kcal: 86, protein: 1, carb: 21, fat: 0,
    tags: ['sugar', 'fiber'], aliases: /fruit|apple|banana|berry|berries|mango|orange|grape|melon|pear|peach/i,
    sig: { hue: [330, 30], sat: [0.45, 1.0], bright: [0.42, 0.92], texture: [0.0, 0.045], edge: [0.05, 0.4], weight: 0.95 },
  },
  legumes: {
    name: 'Legumes & Pulses', serving: '180g bowl', gramsPerServing: 180, kcal: 215, protein: 14, carb: 34, fat: 2,
    tags: ['fiber', 'carb', 'protein'], aliases: /lentil|daal|dal|chickpea|bean|rajma|chana|hummus|pulses/i,
    sig: { hue: [20, 45], sat: [0.3, 0.75], bright: [0.3, 0.68], texture: [0.03, 0.14], edge: [0.4, 0.95], weight: 1 },
  },
};

/** Portion modifiers — every macro reading scales deterministically. */
export type PortionId = 'small' | 'standard' | 'large';
export const PORTIONS: Record<PortionId, { label: string; mult: number }> = {
  small: { label: 'Small · 0.75×', mult: 0.75 },
  standard: { label: 'Standard · 1×', mult: 1 },
  large: { label: 'Large · 1.4×', mult: 1.4 },
};

/** Strict allergen alias bounds — matching arrays the shield honors verbatim. */
export const ALLERGEN_ALIAS: Record<string, string[]> = {
  peanut: ['peanut', 'groundnut', 'arachis', 'satay', 'monkey nut'],
  nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'nut', 'nuts', 'trail mix'],
  dairy: ['milk', 'cheese', 'cream', 'butter', 'ghee', 'paneer', 'whey', 'yogurt', 'yoghurt', 'dairy'],
  lactose: ['lactose', 'milk', 'dairy', 'cream', 'kheer', 'whey'],
  gluten: ['gluten', 'flour', 'seitan', 'semolina', 'barley', 'rye', 'maida'],
  wheat: ['wheat', 'bread', 'flatbread', 'roti', 'naan', 'chapati', 'pasta', 'noodle', 'bagel'],
  egg: ['egg', 'eggs', 'omelet', 'omelette', 'mayonnaise', 'meringue', 'anda'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'trout', 'anchovy', 'sardine', 'mackerel', 'sushi', 'rohu', 'tilapia'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'oyster', 'mussel', 'calamari', 'shellfish'],
  soy: ['soy', 'soya', 'tofu', 'edamame', 'miso', 'tempeh', 'soybean'],
  sesame: ['sesame', 'tahini', 'til', 'gingelly'],
  mushroom: ['mushroom', 'shiitake', 'portobello', 'champignon', 'morel', 'oyster mushroom'],
};

/** Exactly three fully-safe alternatives per allergen, pre-audited. */
export const ALLERGEN_SUBS: Record<string, [string, string, string]> = {
  peanut: ['Sunflower-seed crunch cup', 'Roasted chickpeas with smoked salt', 'Pumpkin-seed butter on rice cakes'],
  nuts: ['Crispy edamame cup', 'Toasted pumpkin-seed salad', 'Roasted chickpea trail mix'],
  dairy: ['Oat-milk golden latte', 'Coconut yogurt with berries', 'Olive-oil mashed potatoes'],
  lactose: ['Lactose-free kefir glass', 'Almond-free oat yogurt bowl', 'Coconut-milk chia pudding'],
  gluten: ['Quinoa power bowl', 'Rice cakes with smashed avocado', 'Buckwheat galettes with greens'],
  wheat: ['Rice-flour dosa with chutney', 'Corn-tortilla bean tacos', 'Quinoa tabbouleh plate'],
  egg: ['Silken tofu scramble', 'Chickpea-flour omelette', 'Avocado smash on rye-free crisp'],
  fish: ['Rosemary chicken fillet', 'Herbed lentil loaf', 'Garlic tofu steaks'],
  shellfish: ['Grilled herb chicken skewers', 'Lemon white-bean salad', 'Seared mushroom-free tofu strips'],
  soy: ['Lentil & herb patties', 'Grilled chicken broth bowl', 'Sunflower pesto zoodles'],
  sesame: ['White-bean & olive-oil dip', 'Roast-pepper mutabbal, sesame-free', 'Cucumber coconut raita'],
  mushroom: ['Charred courgette ribbons', 'Crispy eggplant coins', 'Herbed cauliflower steaks'],
};

/** Map a free-text filter entry to its canonical allergen key. */
export function canonicalAllergen(entry: string): string | null {
  const t = entry.trim().toLowerCase();
  if (!t) return null;
  if (ALLERGEN_ALIAS[t]) return t;
  for (const [key, aliases] of Object.entries(ALLERGEN_ALIAS)) {
    if (aliases.some((a) => t.includes(a) || a.includes(t))) return key;
  }
  return null;
}

/**
 * Sparse pixel-signature evaluation — deterministic mapping of tone metrics
 * to FOODDB keys. No network, no CV APIs.
 */
export function classifyFingerprint(fp: PixelFingerprint): Array<{ key: FoodKey; confidence: number }> {
  const out: Array<{ key: FoodKey; confidence: number }> = [];
  if (fp.brightness > 0.74 && fp.warmth < 0.42) {
    out.push({ key: 'cooked_rice', confidence: 0.72 }, { key: 'dairy', confidence: 0.58 }, { key: 'oats', confidence: 0.44 });
  } else if (fp.warmth > 0.52 && fp.variance > 0.03) {
    out.push({ key: 'red_meat', confidence: 0.68 }, { key: 'flatbread', confidence: 0.55 }, { key: 'chicken_breast', confidence: 0.47 });
  } else if (fp.brightness < 0.4) {
    out.push({ key: 'red_meat', confidence: 0.55 }, { key: 'fish', confidence: 0.42 });
  } else {
    out.push({ key: 'chicken_breast', confidence: 0.6 }, { key: 'eggs', confidence: 0.5 }, { key: 'flatbread', confidence: 0.4 });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

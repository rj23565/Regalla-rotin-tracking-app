import { motion } from 'framer-motion';
import {
  Ban,
  BriefcaseBusiness,
  CalendarCheck2,
  Clock3,
  Droplets,
  Dumbbell,
  Footprints,
  HeartPulse,
  Link2,
  Minus,
  MoonStar,
  Plus,
  Repeat,
  Salad,
  Scale,
  SlidersHorizontal,
  Sunrise,
  Target,
  Timer,
  TriangleAlert,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { useActivePlan, useRegalia } from '../store';
import { ACTIVITIES, BODY_TYPES, GOALS, computeTargets } from '../lib/bodyforge';
import { workoutSynthesis } from '../lib/synthesis';
import { Chip, SectionLabel } from '../components/bits';
import type { Activity, BodyType, Goal } from '../lib/types';

const DIRECTIVE_ICONS: Record<BodyType, LucideIcon[]> = {
  ectomorph: [Wheat, Timer, HeartPulse, MoonStar],
  mesomorph: [Scale, Dumbbell, TriangleAlert, Repeat],
  endomorph: [Salad, Sunrise, Footprints, Ban],
  hybrid: [SlidersHorizontal, Target, BriefcaseBusiness, CalendarCheck2],
};

const TYPE_ORDER: BodyType[] = ['ectomorph', 'mesomorph', 'endomorph', 'hybrid'];

export default function BodyForge() {
  const body = useRegalia((s) => s.body);
  const setBodyType = useRegalia((s) => s.setBodyType);
  const setGoal = useRegalia((s) => s.setGoal);
  const setActivity = useRegalia((s) => s.setActivity);
  const setWeight = useRegalia((s) => s.setWeight);
  const plan = useActivePlan();
  const habits = useRegalia((s) => s.habits);
  const logs = useRegalia((s) => s.logs);

  const syn = workoutSynthesis(plan, habits, logs);
  const spec = BODY_TYPES[body.type];
  const t = computeTargets(body, syn.bufferKcal);
  const icons = DIRECTIVE_ICONS[body.type];

  const macroSegs = [
    { label: 'Carbohydrate', pct: t.macros.carb, grams: t.carbG, cls: 'bg-[linear-gradient(90deg,#b8862f,#e3c878)]' },
    { label: 'Protein', pct: t.macros.protein, grams: t.proteinG, cls: 'bg-[linear-gradient(90deg,#66101f,#a92540)]' },
    { label: 'Fat', pct: t.macros.fat, grams: t.fatG, cls: 'bg-[linear-gradient(90deg,#52372a,#7a5a3c)]' },
  ];

  return (
    <div className="space-y-5">
      {/* type selector */}
      <div className="rd-grid grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TYPE_ORDER.map((id, i) => {
          const s = BODY_TYPES[id];
          const active = body.type === id;
          return (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setBodyType(id)}
              className={`card relative px-4 py-4 text-left transition-all ${active ? '!border-gold ring-2 ring-gold/50 ring-offset-2 ring-offset-cream' : 'hover:-translate-y-0.5'}`}
            >
              {active && (
                <span className="stamp-in absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-crimson font-monox text-[9px] text-gold2 shadow-[0_6px_14px_-6px_rgba(102,16,31,0.9)]">
                  ✦
                </span>
              )}
              <div className="font-display text-[11px] italic text-golddeep">Tier {s.numeral}</div>
              <div className="mt-1 font-display text-[19px] font-semibold leading-tight text-ink">{s.name}</div>
              <div className="font-monox text-[8.5px] tracking-[0.22em] text-faint uppercase">{s.epithet}</div>
              <p className="mt-2 hidden text-[11px] leading-snug text-ink2/80 sm:block">{s.baseline.split('.')[0]}.</p>
            </motion.button>
          );
        })}
      </div>

      <div className="rd-grid grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* left: targets */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card ornate relative overflow-hidden px-6 py-6">
          <img
            src="/images/forge-plate.png"
            alt=""
            aria-hidden
            className="rd-deco pointer-events-none absolute -top-4 right-0 hidden h-36 select-none opacity-45 mix-blend-multiply sm:block md:h-44"
          />
          <div className="relative">
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>Daily provision · {spec.name}</SectionLabel>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="font-display text-[54px] font-semibold leading-none tracking-tight text-ink">
                {t.kcal.toLocaleString('en-US')}
                <span className="ml-2 align-middle font-monox text-[11px] tracking-[0.22em] text-golddeep uppercase">kcal</span>
              </div>
              <p className="mt-1 font-monox text-[9.5px] tracking-[0.2em] text-faint uppercase">
                {body.weightKg} kg chassis · {GOALS.find((g) => g.id === body.goal)?.label} vector
              </p>
              {syn.unlocked && (
                <p className="mt-1 flex items-center gap-1.5 font-monox text-[9px] tracking-[0.16em] text-golddeep uppercase">
                  <Link2 size={9} /> synthesis unlocked · {t.baseKcal} base + {t.bufferKcal} earned
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              <Chip tone="gold">
                <Droplets size={9} /> {t.waterL.toFixed(1)} L water
              </Chip>
              <Chip tone="gold">
                <Footprints size={9} /> {t.stepsMin.toLocaleString()} steps
              </Chip>
              <Chip tone="gold">
                <UtensilsCrossed size={9} /> {t.meals}
              </Chip>
              <Chip tone="faint">
                <Clock3 size={9} /> {t.windowText}
              </Chip>
            </div>
          </div>

          {/* macro bar */}
          <div className="mt-6">
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-ink/15">
              {macroSegs.map((m) => (
                <motion.div
                  key={m.label}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.pct * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full ${m.cls}`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {macroSegs.map((m) => (
                <div key={m.label} className="rounded-[4px] border border-ink/12 bg-paper/60 px-3 py-2">
                  <div className="font-monox text-[8px] tracking-[0.22em] text-faint uppercase">{m.label}</div>
                  <div className="mt-0.5 font-display text-lg font-semibold text-ink">
                    {m.grams}
                    <span className="text-[11px] text-faint"> g</span>
                    <span className="ml-1.5 font-monox text-[9px] text-golddeep">{Math.round(m.pct * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* conditioning + flags */}
          <p className="mt-5 border-l-2 border-crimson/50 pl-3 font-display text-[13.5px] italic leading-snug text-ink2">{t.cardioNote}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {t.flags.map((f) => (
              <span key={f} className="rounded-[3px] border border-crimson/50 bg-crimson/5 px-2 py-1 font-monox text-[8.5px] tracking-[0.18em] text-crimson uppercase">
                {f}
              </span>
            ))}
          </div>

          {/* controls */}
          <div className="mt-6 space-y-4 border-t border-ink/12 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 font-monox text-[9px] tracking-[0.22em] text-faint uppercase">Weight target</span>
              <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id as Goal)}
                    className={`px-3 py-1.5 font-monox text-[10.5px] transition-colors ${body.goal === g.id ? 'bg-crimson text-[#f2dda0]' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 font-monox text-[9px] tracking-[0.22em] text-faint uppercase">Occupation</span>
              <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActivity(a.id as Activity)}
                    className={`px-3 py-1.5 font-monox text-[10.5px] transition-colors ${body.activity === a.id ? 'bg-gold text-coal' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-24 font-monox text-[9px] tracking-[0.22em] text-faint uppercase">Mass</span>
              <button className="btn-ghost !p-1.5" onClick={() => setWeight(Math.max(40, body.weightKg - 0.5))} aria-label="Decrease weight">
                <Minus size={12} />
              </button>
              <input
                type="range"
                min={40}
                max={160}
                step={0.5}
                value={body.weightKg}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-44 accent-[#8c1d2f]"
              />
              <button className="btn-ghost !p-1.5" onClick={() => setWeight(Math.min(160, body.weightKg + 0.5))} aria-label="Increase weight">
                <Plus size={12} />
              </button>
              <span className="font-display text-lg font-semibold text-ink">{body.weightKg.toFixed(1)} kg</span>
            </div>
          </div>
          </div>
        </motion.section>

        {/* right: directives */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="card px-6 py-6">
          <SectionLabel>Standing directives</SectionLabel>
          <p className="mt-3 font-display text-[13px] italic leading-snug text-ink2/90">{spec.baseline}</p>
          <ul className="mt-5 space-y-4">
            {spec.directives.map((d, i) => {
              const Icon = icons[i] ?? Target;
              return (
                <motion.li
                  key={`${body.type}-${d.head}`}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.06 }}
                  className="flex gap-3.5"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[4px] border border-gold/45 bg-gold/8 text-golddeep">
                    <Icon size={15} />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold leading-tight text-ink">{d.head}</div>
                    <p className="mt-1 text-[12px] leading-snug text-ink2/85">{d.body}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-[4px] border border-ink/12 bg-parch/40 p-3">
            <div className="font-monox text-[8.5px] tracking-[0.24em] text-faint uppercase">Constraint of record</div>
            <div className="mt-1 font-display text-[14px] font-medium text-crimson">{spec.constraint}</div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

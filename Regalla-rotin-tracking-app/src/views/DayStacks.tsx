import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck2, Flame, X } from 'lucide-react';
import { useActivePlan, useRegalia } from '../store';
import { dayCompletion, dayIndexOf, elapsedDays } from '../lib/analytics';
import { addDays, longDate, shortDate, todayISO } from '../lib/time';
import { Ring, Tick, TONES } from '../components/bits';
import type { DurationDays } from '../lib/types';

type DayState = 'perfect' | 'partial' | 'missed' | 'future' | 'today';

export default function DayStacks() {
  const plan = useActivePlan();
  const habits = useRegalia((s) => s.habits);
  const logs = useRegalia((s) => s.logs);
  const setWindow = useRegalia((s) => s.setWindow);
  const toggleHabit = useRegalia((s) => s.toggleHabit);
  const [selected, setSelected] = useState<string | null>(null);

  const today = todayISO();
  const planHabits = useMemo(() => habits.filter((h) => h.planId === plan.id), [habits, plan.id]);
  const elapsed = elapsedDays(plan);

  const days = useMemo(
    () =>
      Array.from({ length: plan.duration }, (_, i) => {
        const iso = addDays(plan.startISO, i);
        const comp = dayCompletion(plan, habits, logs, iso);
        const idx = i + 1;
        let state: DayState;
        if (iso === today) state = 'today';
        else if (iso > today) state = 'future';
        else if (comp.pct === 1) state = 'perfect';
        else if (comp.pct > 0) state = 'partial';
        else state = 'missed';
        return { iso, idx, comp, state, milestone: idx % 7 === 0 };
      }),
    [plan, habits, logs, today],
  );

  const boxCls: Record<DayState, string> = {
    perfect:
      'border-gold/70 text-[#ebd99a] bg-[radial-gradient(130%_150%_at_30%_25%,#93203a,#7e1628_58%,#5c0f1d)] shadow-[0_10px_20px_-12px_rgba(92,15,29,0.85)]',
    partial: 'border-ink/25 text-ink bg-paper hover:border-gold',
    missed: 'border-ink/15 text-faint/80 bg-parch/40',
    future: 'border-dashed border-ink/20 text-faint/60 bg-transparent',
    today: 'border-gold text-ink bg-paper ring-2 ring-gold/60 ring-offset-2 ring-offset-cream',
  };

  const sel = selected ? days.find((d) => d.iso === selected) : null;
  const selFuture = sel ? sel.iso > today : false;

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-monox text-[10px] tracking-[0.28em] text-faint uppercase">
            {plan.title} · {elapsed} of {plan.duration} elapsed
          </span>
        </div>
        <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
          {([14, 30, 60] as DurationDays[]).map((d) => (
            <button
              key={d}
              onClick={() => setWindow(d)}
              className={`px-3.5 py-1.5 font-monox text-[11px] transition-colors ${
                plan.duration === d ? 'bg-crimson text-[#f2dda0]' : 'bg-paper/60 text-ink2 hover:bg-parch'
              }`}
            >
              {d}-day
            </button>
          ))}
        </div>
      </motion.div>

      {/* legend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        {[
          ['bg-crimson border border-gold/70', 'Perfect seal'],
          ['bg-paper border border-ink/25 relative overflow-hidden after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-2/3 after:bg-gold', 'Partial'],
          ['bg-parch/50 border border-ink/15', 'Missed'],
          ['border border-dashed border-ink/25', 'Beyond reach'],
          ['bg-paper border border-gold ring-1 ring-gold/60', 'Today'],
        ].map(([sw, label]) => (
          <span key={label} className="flex items-center gap-2 font-monox text-[9px] tracking-[0.18em] text-ink2 uppercase">
            <span className={`inline-block h-3 w-3 rounded-[2px] ${sw}`} /> {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-monox text-[9px] tracking-[0.18em] text-ink2 uppercase">
          <Flame size={11} className="text-golddeep" /> every 7th day
        </span>
      </motion.div>

      {/* grid */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card ornate px-4 py-5 md:px-6">
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7 md:gap-3">
          {days.map((d, i) => (
            <motion.button
              key={d.iso}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.012, 0.5) }}
              onClick={() => setSelected(d.iso)}
              className={`relative aspect-[0.92] rounded-[5px] border p-2 text-left transition-transform hover:-translate-y-0.5 ${boxCls[d.state]}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-[19px] font-semibold leading-none md:text-[22px]">{d.idx}</span>
                {d.milestone && (
                  <Flame size={11} className={d.state === 'perfect' ? 'text-gold2 flame-flicker' : 'text-golddeep/80'} fill={d.state === 'perfect' ? '#e3c878' : 'none'} />
                )}
              </div>
              <div className={`mt-0.5 font-monox text-[8px] tracking-[0.12em] uppercase ${d.state === 'perfect' ? 'text-gold2/80' : 'text-faint'}`}>
                {shortDate(d.iso)}
              </div>
              <div className="absolute inset-x-2 bottom-2 flex items-center gap-1">
                {planHabits.slice(0, 7).map((h) => {
                  const hit = logs[d.iso]?.includes(h.id);
                  return (
                    <span
                      key={h.id}
                      className={`h-[5px] w-[5px] rounded-full ${
                        hit ? (d.state === 'perfect' ? 'bg-gold2' : 'bg-crimson') : d.state === 'perfect' ? 'bg-gold2/25' : 'bg-ink/15'
                      }`}
                    />
                  );
                })}
                {d.state === 'today' && <span className="pulse-dot ml-auto h-[7px] w-[7px] rounded-full bg-crimson" />}
              </div>
              {d.state === 'partial' && (
                <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-[5px]">
                  <div className="h-full bg-gold" style={{ width: `${d.comp.pct * 100}%` }} />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* day sheet */}
      <AnimatePresence>
        {sel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-coal/45 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[min(400px,92vw)] flex-col border-l border-gold/40 bg-paper shadow-[-24px_0_60px_-30px_rgba(28,17,9,0.7)]"
            >
              <div className="flex items-start justify-between border-b border-ink/12 px-6 py-5">
                <div>
                  <p className="font-monox text-[9px] tracking-[0.28em] text-faint uppercase">
                    Day {dayIndexOf(plan, sel.iso)} of {plan.duration}
                  </p>
                  <h3 className="mt-1.5 font-display text-2xl font-semibold text-ink">{longDate(sel.iso)}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-full border border-ink/20 p-1.5 text-ink2 transition-colors hover:border-crimson hover:text-crimson">
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-4 border-b border-ink/12 px-6 py-4">
                <Ring pct={sel.comp.pct} size={62} stroke={5} tone={sel.comp.pct === 1 ? TONES.crimson : TONES.gold}>
                  <span className="font-display text-[13px] font-semibold text-ink">{Math.round(sel.comp.pct * 100)}%</span>
                </Ring>
                <p className="text-[13px] leading-snug text-ink2">
                  {sel.comp.pct === 1
                    ? 'A perfect seal — every rite struck.'
                    : selFuture
                      ? 'This day lies beyond reach. Its boxes unlock when it dawns.'
                      : `${sel.comp.done} of ${sel.comp.total} rites sealed this day.`}
                </p>
              </div>

              <ul className={`scrollthin flex-1 divide-y divide-ink/10 overflow-y-auto px-6 ${selFuture ? 'pointer-events-none opacity-40' : ''}`}>
                {planHabits.map((h) => {
                  const on = logs[sel.iso]?.includes(h.id) ?? false;
                  return (
                    <li key={h.id} className="flex items-center gap-3 py-3.5">
                      <Tick on={on} onToggle={() => toggleHabit(h.id, sel.iso)} disabled={selFuture} />
                      <span className={`font-display text-[15.5px] ${on ? 'text-faint line-through decoration-crimson/40' : 'text-ink'}`}>{h.title}</span>
                    </li>
                  );
                })}
                {planHabits.length === 0 && <li className="py-8 text-center font-display italic text-faint">No rites on this board.</li>}
              </ul>

              <div className="border-t border-ink/12 px-6 py-4">
                <button
                  onClick={() => setSelected(today <= addDays(plan.startISO, plan.duration - 1) && today >= plan.startISO ? today : null)}
                  className="btn-seal w-full justify-center"
                >
                  <CalendarCheck2 size={13} /> Return to today
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Dumbbell, Flame, Link2, Repeat2, Sparkles, Square, Volume2 } from 'lucide-react';
import { useActivePlan, useRegalia } from '../store';
import { studyFocusWindows, workoutSynthesis } from '../lib/synthesis';
import { dayCompletion, elapsedDays, habitStreak, perfectStreak } from '../lib/analytics';
import { SLOTS, dayFraction, todayISO } from '../lib/time';
import { Chip, Ring, SectionLabel, Tick, TONES } from '../components/bits';
import { LANGS, speak, stopSpeech } from '../lib/voice';

export default function Timeline() {
  const plan = useActivePlan();
  const habits = useRegalia((s) => s.habits);
  const logs = useRegalia((s) => s.logs);
  const toggleHabit = useRegalia((s) => s.toggleHabit);
  const settings = useRegalia((s) => s.settings);
  const lastPhrase = useRegalia((s) => s.lastPhrase);
  const registerUtterance = useRegalia((s) => s.registerUtterance);
  const registerRepeat = useRegalia((s) => s.registerRepeat);
  const briefFor = useRegalia((s) => s.briefFor);

  const today = todayISO();
  const planHabits = useMemo(() => habits.filter((h) => h.planId === plan.id), [habits, plan.id]);
  const frac = dayFraction();
  const now = new Date();
  const hourNow = now.getHours() + now.getMinutes() / 60;

  const todayC = dayCompletion(plan, habits, logs, today);
  const streak = perfectStreak(plan, habits, logs);
  const dayIdx = Math.max(1, Math.min(elapsedDays(plan), plan.duration));
  const remaining = todayC.total - todayC.done;
  const syn = workoutSynthesis(plan, habits, logs);
  const focus = studyFocusWindows(plan, habits, logs);

  const readBrief = () => {
    const text = briefFor({ done: todayC.done, total: todayC.total, streak, dayIndex: dayIdx, duration: plan.duration });
    registerUtterance(text);
    speak(text, settings.language, settings.voiceRate);
  };

  const repeatLast = () => {
    const rate = registerRepeat();
    const text = lastPhrase || briefFor({ done: todayC.done, total: todayC.total, streak, dayIndex: dayIdx, duration: plan.duration });
    speak(text, settings.language, rate);
  };

  const decree =
    todayC.pct === 1
      ? 'The day is sealed. Rest is now a discipline too.'
      : frac < 0.2
        ? `The board is fresh — ${remaining} rite${remaining === 1 ? '' : 's'} await their seal.`
        : frac < 0.7
          ? `The hours press on — ${remaining} rite${remaining === 1 ? '' : 's'} still unbroken.`
          : remaining <= 2
            ? 'Dusk approaches; the final seals are within reach.'
            : `The evening watch remains — ${remaining} rites before the day is struck.`;

  return (
    <div className="space-y-5">
      {/* voice strip */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-wrap items-center gap-3 px-5 py-4">
        <SectionLabel>Voice guidance</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-seal !py-1.5" onClick={readBrief}>
            <Volume2 size={12} /> Read the day
          </button>
          <button className="btn-ghost !py-1.5" onClick={repeatLast} title="Repeat last utterance — rapid repeats ease the cadence">
            <Repeat2 size={12} /> Repeat
          </button>
          <button className="btn-ghost !py-1.5" onClick={stopSpeech}>
            <Square size={11} /> Hush
          </button>
          <Chip tone="gold">{LANGS[settings.language].native}</Chip>
          <Chip tone={settings.voiceRate < 1 ? 'crimson' : 'faint'}>{settings.voiceRate.toFixed(2)}× cadence</Chip>
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* timeline spine */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card ornate px-5 py-5 md:px-7">
          <SectionLabel>The waking band · 05:00 — 24:00</SectionLabel>
          <div className="relative mt-5">
            {/* spine */}
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-gold/60 via-crimson/40 to-ink/25" />
            {/* now marker */}
            <div className="absolute left-0 z-10 flex -translate-y-1/2 items-center" style={{ top: `${8 + frac * 90}%` }}>
              <span className="pulse-dot h-[15px] w-[15px] rounded-full border-2 border-gold2 bg-crimson" />
              <span className="ml-2 rounded-[3px] border border-crimson/40 bg-paper px-1.5 py-0.5 font-monox text-[9px] tracking-[0.15em] text-crimson">
                NOW {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="space-y-5 pl-9">
              {SLOTS.map((slot) => {
                const slotHabits = planHabits.filter((h) => h.slot === slot.id);
                const doneCount = slotHabits.filter((h) => logs[today]?.includes(h.id)).length;
                const isPast = hourNow >= slot.to;
                const isNow = hourNow >= slot.from && hourNow < slot.to;
                return (
                  <div key={slot.id} className={`relative rounded-[5px] border p-3.5 transition-colors ${isNow ? 'border-gold/60 bg-parch/30' : 'border-ink/12 bg-paper/40'} ${isPast ? 'opacity-90' : ''}`}>
                    <span className={`absolute -left-9 top-[22px] h-[9px] w-[9px] rounded-full border-2 ${isPast ? 'border-crimson bg-crimson' : isNow ? 'border-gold bg-paper' : 'border-ink/30 bg-cream'}`} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-display text-[16px] font-semibold text-ink">{slot.label}</span>
                        <span className="ml-2 font-monox text-[8.5px] tracking-[0.24em] text-faint uppercase">{slot.epithet}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-monox text-[9.5px] tracking-[0.15em] text-ink2">{slot.range}</span>
                        {slotHabits.length > 0 && (
                          <Chip tone={doneCount === slotHabits.length ? 'crimson' : 'faint'}>
                            {doneCount}/{slotHabits.length} sealed
                          </Chip>
                        )}
                      </div>
                    </div>
                    {slotHabits.length > 0 ? (
                      <ul className="mt-2.5 space-y-2">
                        {slotHabits.map((h) => {
                          const on = logs[today]?.includes(h.id) ?? false;
                          const hs = habitStreak(h.id, plan, logs);
                          return (
                            <li key={h.id} className="flex items-center gap-3">
                              <Tick on={on} onToggle={() => toggleHabit(h.id)} />
                              <span className={`font-display text-[15px] ${on ? 'text-faint line-through decoration-crimson/40' : 'text-ink'}`}>{h.title}</span>
                              {hs >= 3 && (
                                <Chip tone={hs >= 7 ? 'crimson' : 'gold'}>
                                  <Flame size={9} /> {hs}
                                </Chip>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 font-display text-[12.5px] italic text-faint/80">No rites bound to these hours.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* side column */}
        <div className="space-y-5">
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="card px-5 py-5">
            <SectionLabel>Decree of the day</SectionLabel>
            <div className="mt-4 flex items-center gap-4">
              <Ring pct={todayC.pct} size={86} tone={TONES.crimson}>
                <div className="text-center">
                  <div className="font-display text-lg font-semibold text-ink">
                    {todayC.done}/{todayC.total}
                  </div>
                  <div className="font-monox text-[7.5px] tracking-[0.2em] text-faint uppercase">sealed</div>
                </div>
              </Ring>
              <p className="flex-1 font-display text-[15px] italic leading-snug text-ink2">“{decree}”</p>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card px-5 py-5">
            <SectionLabel>Daylight meter</SectionLabel>
            <div className="mt-4">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-gold2 via-gold to-crimson2/70">
                <div className="absolute inset-y-0 right-0 bg-coal/70 transition-all duration-700" style={{ width: `${(1 - frac) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-monox text-[8.5px] tracking-[0.2em] text-faint uppercase">
                <span>05:00 first light</span>
                <span>{Math.round(frac * 100)}% spent</span>
                <span>24:00 quiet</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2.5 rounded-[4px] border border-gold/30 bg-gold/5 p-3">
              <Sparkles size={14} className="flex-none text-golddeep" />
              <p className="text-[12px] leading-snug text-ink2">
                Ticks here are mirrored instantly to the Snapshot and the Day-by-Day stacks — one local truth, no redraws.
              </p>
            </div>
          </motion.section>

          {/* cross-domain synthesis */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="card px-5 py-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Cross-domain synthesis</SectionLabel>
              <Link2 size={13} className={syn.unlocked ? 'text-golddeep' : 'text-faint/50'} />
            </div>
            {syn.habits === 0 ? (
              <p className="mt-3 font-display text-[12.5px] italic leading-snug text-faint">
                Bind a conditioning rite — training, gym, a run — and the matrix will begin feeding the diet planner and
                study lab.
              </p>
            ) : (
              <div className="mt-4 space-y-3.5">
                <div className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 flex-none place-items-center rounded-[4px] border ${syn.unlocked ? 'border-gold/55 bg-gold/10 text-golddeep' : 'border-ink/20 text-faint'}`}>
                    <Dumbbell size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[13.5px] font-semibold text-ink">
                      Conditioning consistency · {Math.round(syn.consistency * 100)}%
                    </div>
                    <div className="mt-0.5 font-monox text-[8.5px] tracking-[0.14em] text-faint uppercase">{syn.reason}</div>
                  </div>
                  <Chip tone={syn.unlocked ? 'gold' : 'faint'}>{syn.unlocked ? '+150 kcal live' : 'locked'}</Chip>
                </div>
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[4px] border border-ink/20 text-faint">
                    <BookOpen size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[13.5px] font-semibold text-ink">Study energy windows</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {focus.length === 0 && <span className="font-monox text-[9px] tracking-[0.14em] text-faint uppercase">insufficient signal — bind study rites</span>}
                      {focus.map((w) => (
                        <Chip key={w.slot} tone="gold">
                          {w.label} · {w.range.slice(0, 5)} · {Math.round(w.pct * 100)}%
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-4 border-t border-ink/10 pt-3 font-monox text-[7.5px] leading-relaxed tracking-[0.18em] text-faint uppercase">
              diet planner reads the workout matrix · study lab reads the focus matrix
            </p>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

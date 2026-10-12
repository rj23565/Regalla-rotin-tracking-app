import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AudioLines,
  Check,
  CheckCheck,
  ClipboardCheck,
  Eraser,
  Flame,
  Info,
  Pencil,
  Plus,
  ScanSearch,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useActivePlan, useRegalia } from '../store';
import { DOMAINS } from '../lib/types';
import type { Domain } from '../lib/types';
import {
  dayCompletion,
  elapsedDays,
  habitStreak,
  meanConsistency,
  nextMilestone,
  perfectStreak,
  planProgress,
} from '../lib/analytics';
import { SLOTS, ago, longDate, ordinal, slotOf, todayISO } from '../lib/time';
import { Bar, Chip, Ring, SectionLabel, Tick, TONES, pctText } from '../components/bits';
import type { DurationDays, SlotId } from '../lib/types';

const NOTE_ICONS = {
  milestone: { Icon: Flame, cls: 'text-golddeep border-gold/50 bg-gold/10' },
  threat: { Icon: ShieldAlert, cls: 'text-crimson border-crimson/40 bg-crimson/5' },
  voice: { Icon: AudioLines, cls: 'text-ink2 border-ink/30 bg-parch/60' },
  system: { Icon: Info, cls: 'text-ink2 border-ink/25 bg-parch/60' },
} as const;

const DOMAIN_TONE: Record<Domain, 'crimson' | 'gold' | 'ink' | 'faint'> = {
  fitness: 'crimson',
  work: 'gold',
  health: 'faint',
  study: 'ink',
  beauty: 'crimson',
};

export default function Command() {
  const plan = useActivePlan();
  const habits = useRegalia((s) => s.habits);
  const logs = useRegalia((s) => s.logs);
  const notes = useRegalia((s) => s.notes);
  const plans = useRegalia((s) => s.plans);
  const activePlanId = useRegalia((s) => s.activePlanId);
  const toggleHabit = useRegalia((s) => s.toggleHabit);
  const sealAllToday = useRegalia((s) => s.sealAllToday);
  const clearToday = useRegalia((s) => s.clearToday);
  const auditBoard = useRegalia((s) => s.auditBoard);
  const addHabit = useRegalia((s) => s.addHabit);
  const updateHabit = useRegalia((s) => s.updateHabit);
  const removeHabit = useRegalia((s) => s.removeHabit);
  const setWindow = useRegalia((s) => s.setWindow);
  const createPlan = useRegalia((s) => s.createPlan);
  const setActivePlan = useRegalia((s) => s.setActivePlan);
  const dismissNote = useRegalia((s) => s.dismissNote);

  const planHabits = useMemo(() => habits.filter((h) => h.planId === plan.id), [habits, plan.id]);
  const today = todayISO();
  const progress = planProgress(plan, habits, logs);
  const consistency = meanConsistency(plan, habits, logs);
  const streak = perfectStreak(plan, habits, logs);
  const todayC = dayCompletion(plan, habits, logs, today);
  const elapsed = elapsedDays(plan);
  const dayIdx = Math.min(Math.max(1, elapsed), plan.duration);
  const milestone = nextMilestone(streak);

  const [newTitle, setNewTitle] = useState('');
  const [newSlot, setNewSlot] = useState<SlotId>('morning');
  const [newDomain, setNewDomain] = useState<Domain>('health');
  const [domainFilter, setDomainFilter] = useState<Domain | 'all'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [alarm, setAlarm] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDur, setPlanDur] = useState<DurationDays>(30);
  const [planAlarm, setPlanAlarm] = useState<string | null>(null);

  const visibleHabits = planHabits.filter((h) => domainFilter === 'all' || (h.domain ?? 'health') === domainFilter);

  const submitHabit = () => {
    const r = addHabit(newTitle, newSlot, newDomain);
    if (r.blocked) {
      setAlarm(r.vector ?? 'PAYLOAD');
      setTimeout(() => setAlarm(null), 4200);
      return;
    }
    if (r.ok) setNewTitle('');
  };

  const submitPlan = () => {
    const r = createPlan(planTitle || 'New Window', planDur);
    if (r.blocked) {
      setPlanAlarm(r.vector ?? 'PAYLOAD');
      setTimeout(() => setPlanAlarm(null), 4200);
      return;
    }
    setPlanForm(false);
    setPlanTitle('');
  };

  const flame = streak > 0;

  return (
    <div className="space-y-5">
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="card ornate relative overflow-hidden px-6 py-6 md:px-9 md:py-8"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 select-none font-display text-[190px] font-bold leading-none text-gold/10"
          aria-hidden
        >
            {dayIdx}
          </div>
          <img
            src="/images/ornament.png"
            alt=""
            aria-hidden
            className={`rd-deco pointer-events-none absolute -bottom-5 right-0 hidden h-44 select-none mix-blend-multiply transition-opacity duration-500 sm:block md:h-56 ${planForm ? 'opacity-0' : 'opacity-60'}`}
          />
          <p className="relative font-monox text-[10px] tracking-[0.3em] text-faint uppercase">{longDate(today)}</p>
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink md:text-[52px] md:leading-[1.02]">
          The <span className="gold-text">{ordinal(dayIdx)} day</span> of {plan.duration}
        </h2>
        <p className="mt-2 max-w-md font-display text-[15px] italic text-ink2/85">
          “{plan.motto}” — <span className="not-italic font-monox text-[10px] tracking-[0.25em] text-golddeep uppercase">{plan.title}</span>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="font-monox text-[9px] tracking-[0.25em] text-faint uppercase">Window</span>
            <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
              {([14, 30, 60] as DurationDays[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setWindow(d)}
                  className={`px-3 py-1.5 font-monox text-[11px] transition-colors ${
                    plan.duration === d ? 'bg-crimson text-[#f2dda0]' : 'bg-paper/60 text-ink2 hover:bg-parch'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-monox text-[9px] tracking-[0.25em] text-faint uppercase">Board</span>
            <select
              value={activePlanId}
              onChange={(e) => setActivePlan(e.target.value)}
              className="rounded-[4px] border border-ink/25 bg-paper/70 px-2.5 py-1.5 font-monox text-[11px] text-ink2"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.duration}d
                </option>
              ))}
            </select>
            <button className="btn-ghost !py-1.5" onClick={() => setPlanForm((v) => !v)}>
              <Plus size={12} /> New
            </button>
          </div>
        </div>

        {planForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-[4px] border border-gold/40 bg-parch/40 p-3 ${planAlarm ? 'alarm' : ''}`}>
              <input
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="Name the new window…"
                className="w-52 rounded-[4px] border border-ink/25 bg-paper px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint"
              />
              <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
                {([14, 30, 60] as DurationDays[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setPlanDur(d)}
                    className={`px-2.5 py-1.5 font-monox text-[11px] ${planDur === d ? 'bg-gold text-coal' : 'bg-paper/60 text-ink2'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button className="btn-seal !py-1.5" onClick={submitPlan}>
                Open window
              </button>
              {planAlarm && <span className="font-monox text-[10px] tracking-[0.2em] text-crimson uppercase">Breach arrested · {planAlarm}</span>}
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* ── Matrix row ───────────────────────────────────────────── */}
      <section className="rd-grid grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card px-5 py-5">
          <SectionLabel>Plan progress</SectionLabel>
          <div className="mt-3 flex items-center justify-center">
            <Ring pct={progress.pct} size={104} tone={TONES.crimson}>
              <div className="text-center">
                <div className="font-display text-[22px] font-semibold text-ink">{pctText(progress.pct)}</div>
                <div className="font-monox text-[8px] tracking-[0.2em] text-faint uppercase">complete</div>
              </div>
            </Ring>
          </div>
          <p className="mt-3 text-center font-monox text-[10px] tracking-[0.14em] text-ink2 uppercase">
            {progress.done} <span className="text-faint">/</span> {progress.total} checks
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card px-5 py-5">
          <SectionLabel>Consistency</SectionLabel>
          <div className="mt-3 flex items-center justify-center">
            <Ring pct={consistency} size={104} tone={TONES.gold}>
              <div className="text-center">
                <div className="font-display text-[22px] font-semibold text-ink">{pctText(consistency)}</div>
                <div className="font-monox text-[8px] tracking-[0.2em] text-faint uppercase">of elapsed</div>
              </div>
            </Ring>
          </div>
          <p className="mt-3 text-center font-monox text-[10px] tracking-[0.14em] text-ink2 uppercase">
            vs <span className="text-golddeep">{elapsed}</span> elapsed days
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card relative col-span-2 overflow-hidden px-5 py-5 lg:col-span-2"
        >
          <SectionLabel>Unbroken chain</SectionLabel>
          <div className="mt-2 flex items-center gap-5">
            <Ring pct={streak / milestone} size={104} stroke={6} tone={TONES.gold2} track="rgba(140,29,47,0.14)">
              <Flame size={30} className={flame ? 'flame-flicker text-crimson' : 'text-faint/50'} fill={flame ? '#8c1d2f' : 'none'} />
            </Ring>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[44px] font-semibold leading-none text-ink">{streak}</span>
                <span className="font-monox text-[10px] tracking-[0.22em] text-ink2 uppercase">days in a row</span>
              </div>
              <p className="mt-1.5 font-monox text-[9.5px] tracking-[0.16em] text-faint uppercase">
                next seal at {milestone} · {milestone - streak} to go
              </p>
              {streak > 0 && streak % 7 === 0 && (
                <Chip tone="crimson">
                  <Flame size={9} /> {streak}-day streak confirmed
                </Chip>
              )}
            </div>
            <div className="ml-auto hidden text-right sm:block">
              <div className="font-monox text-[9px] tracking-[0.22em] text-faint uppercase">Today</div>
              <div className="mt-1 font-display text-2xl font-semibold text-ink">
                {todayC.done}<span className="text-faint/70">/{todayC.total}</span>
              </div>
              <div className="mt-1.5 w-24"><Bar pct={todayC.pct} /></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Task Snapshot + Ledger ───────────────────────────────── */}
      <section className="rd-grid grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card ornate px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Task snapshot · today</SectionLabel>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !py-1.5" onClick={sealAllToday} title="Seal every rite for today">
                <CheckCheck size={12} /> Seal all
              </button>
              <button className="btn-ghost !py-1.5" onClick={clearToday} title="Strike off today">
                <Eraser size={12} /> Clear
              </button>
              <button className="btn-ghost !py-1.5" onClick={auditBoard} title="Run board integrity audit">
                <ScanSearch size={12} /> Audit
              </button>
            </div>
          </div>

          {/* domain filter rail */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {(['all', ...DOMAINS] as const).map((d) => {
              const n = d === 'all' ? planHabits.length : planHabits.filter((h) => (h.domain ?? 'health') === d).length;
              return (
                <button
                  key={d}
                  onClick={() => setDomainFilter(d)}
                  className={`rounded-[3px] border px-2 py-1 font-monox text-[9px] tracking-[0.16em] uppercase transition-colors ${
                    domainFilter === d ? 'border-crimson bg-crimson text-[#f2dda0]' : 'border-ink/20 text-ink2 hover:border-gold'
                  }`}
                >
                  {d} · {n}
                </button>
              );
            })}
          </div>

          <ul className="mt-3 divide-y divide-ink/10">
            {visibleHabits.length === 0 && (
              <li className="py-8 text-center font-display italic text-faint">
                {planHabits.length === 0 ? 'No rites enlisted on this board — add the first below.' : 'No rites in this domain yet.'}
              </li>
            )}
            {visibleHabits.map((h) => {
              const on = logs[today]?.includes(h.id) ?? false;
              const hStreak = habitStreak(h.id, plan, logs);
              const slot = slotOf(h.slot);
              const dom = (h.domain ?? 'health') as Domain;
              const nextDomain = DOMAINS[(DOMAINS.indexOf(dom) + 1) % DOMAINS.length];
              const nextSlot = SLOTS[(SLOTS.findIndex((s) => s.id === h.slot) + 1) % SLOTS.length].id;
              return (
                <li key={h.id} className="group flex items-center gap-3.5 py-3">
                  <Tick on={on} onToggle={() => toggleHabit(h.id)} />
                  <div className="min-w-0 flex-1">
                    {editing === h.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateHabit(h.id, { title: editTitle });
                              setEditing(null);
                            }
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          className="min-w-0 flex-1 rounded-[3px] border border-gold/60 bg-paper px-2 py-1 text-[13px] text-ink"
                        />
                        <button
                          onClick={() => {
                            updateHabit(h.id, { title: editTitle });
                            setEditing(null);
                          }}
                          className="rounded-[3px] border border-gold/60 p-1 text-golddeep"
                          title="Confirm edit"
                        >
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditing(null)} className="rounded-[3px] border border-ink/20 p-1 text-faint" title="Cancel">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className={`font-display text-[17px] font-medium leading-tight transition-colors ${on ? 'text-faint line-through decoration-crimson/40' : 'text-ink'}`}>
                        {h.title}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button onClick={() => updateHabit(h.id, { slot: nextSlot })} title="Cycle time slot">
                        <Chip tone="faint">{slot.label} · {slot.range.slice(0, 5)}</Chip>
                      </button>
                      <button onClick={() => updateHabit(h.id, { domain: nextDomain })} title="Cycle domain">
                        <Chip tone={DOMAIN_TONE[dom]}>{dom}</Chip>
                      </button>
                      {hStreak >= 3 && (
                        <Chip tone={hStreak >= 7 ? 'crimson' : 'gold'}>
                          <Flame size={9} /> {hStreak}
                        </Chip>
                      )}
                    </div>
                  </div>
                  {on && (
                    <span className="stamp-in font-monox text-[8.5px] tracking-[0.28em] text-crimson/80 uppercase">Sealed</span>
                  )}
                  <button
                    onClick={() => {
                      setEditing(h.id);
                      setEditTitle(h.title);
                    }}
                    title="Edit rite"
                    className="text-faint/60 opacity-0 transition-opacity hover:text-golddeep group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeHabit(h.id)}
                    title="Vault rite (30-day recoverable)"
                    className="text-faint/60 opacity-0 transition-opacity hover:text-crimson group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-[4px] border border-dashed border-ink/25 bg-parch/30 p-3 ${alarm ? 'alarm !border-crimson' : ''}`}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitHabit()}
              placeholder="Enlist a new rite… (guarded by Sentinel)"
              className="min-w-44 flex-1 rounded-[4px] border border-ink/20 bg-paper px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint"
            />
            <select
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value as SlotId)}
              className="rounded-[4px] border border-ink/20 bg-paper px-2 py-1.5 font-monox text-[11px] text-ink2"
            >
              {SLOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value as Domain)}
              className="rounded-[4px] border border-ink/20 bg-paper px-2 py-1.5 font-monox text-[11px] capitalize text-ink2"
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button className="btn-seal !py-1.5" onClick={submitHabit}>
              <Plus size={12} /> Enlist
            </button>
            {alarm && (
              <span className="flex items-center gap-1.5 font-monox text-[9.5px] tracking-[0.18em] text-crimson uppercase">
                <ShieldAlert size={11} /> Payload stripped · {alarm} · score −7
              </span>
            )}
          </div>
        </motion.div>

        {/* Engine ledger */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card flex max-h-[520px] flex-col px-5 py-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Engine ledger</SectionLabel>
            <ClipboardCheck size={14} className="text-gold" />
          </div>
          <ul className="scrollthin mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {notes.length === 0 && <li className="py-6 text-center font-display italic text-faint">The ledger is blank.</li>}
            {notes.map((n) => {
              const { Icon, cls } = NOTE_ICONS[n.kind];
              return (
                <li key={n.id} className="flex items-start gap-3 rounded-[4px] border border-ink/10 bg-paper/50 p-3">
                  <span className={`grid h-6 w-6 flex-none place-items-center rounded-full border ${cls}`}>
                    <Icon size={11} className={n.kind === 'milestone' ? 'flame-flicker' : ''} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[13.5px] font-semibold leading-tight text-ink">{n.title}</span>
                      <span className="flex-none font-monox text-[8.5px] tracking-[0.12em] text-faint">{ago(n.at)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-[11.5px] leading-snug text-ink2/80">{n.body}</p>}
                  </div>
                  <button onClick={() => dismissNote(n.id)} className="text-faint/50 transition-colors hover:text-crimson" aria-label="Dismiss note">
                    <X size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </section>
    </div>
  );
}

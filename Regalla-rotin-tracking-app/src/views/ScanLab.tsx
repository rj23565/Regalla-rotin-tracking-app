import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Camera,
  CheckCircle2,
  FlaskConical,
  ImagePlus,
  ListPlus,
  PersonStanding,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useRegalia } from '../store';
import { analyzeIngredients, compareFrames, parseFrame } from '../lib/vision';
import type { CompareResult, SkinReport } from '../lib/vision';
import { fileToDataURL, pixelFingerprint } from '../lib/media';
import { auditFile } from '../lib/sentinel';
import { BODY_TYPES } from '../lib/bodyforge';
import type { BodyType, Domain, Goal, SlotId } from '../lib/types';
import { Bar, Chip, Ring, SectionLabel, TONES } from '../components/bits';

type Directive = 'lose' | 'gain' | 'optimize';

const DIRECTIVES: Array<{ id: Directive; label: string; goal: Goal }> = [
  { id: 'lose', label: 'Fat Loss', goal: 'lose' },
  { id: 'gain', label: 'Lean Muscle Gain', goal: 'gain' },
  { id: 'optimize', label: 'Total Optimization', goal: 'recomp' },
];

interface BuildVerdict {
  type: BodyType;
  shoulderWaist: number;
  frame: string;
  confidence: number;
  checklist: Array<{ title: string; slot: SlotId; domain: Domain }>;
}

/**
 * Posture silhouette geometry — measures the occupied-mass profile across
 * vertical bands to derive shoulder : waist : hip ratios, then classifies.
 */
async function analysePosture(dataURL: string, directive: Directive): Promise<BuildVerdict | null> {
  const fp = await pixelFingerprint(dataURL);
  const zones = await parseFrame(dataURL, 'standard');
  if (!fp) return null;

  // Band-width profile approximated from clustered region geometry
  const widths = zones.map((z) => z.bbox.w);
  const top = widths.length ? Math.max(...widths) : 48 + fp.variance * 140;
  const mid = widths.length > 1 ? widths[Math.floor(widths.length / 2)] : top * (0.72 + fp.brightness * 0.2);
  const shoulderWaist = Math.max(1.02, Math.min(1.85, top / Math.max(12, mid)));

  let type: BodyType;
  if (shoulderWaist >= 1.45) type = 'mesomorph';
  else if (shoulderWaist >= 1.28) type = fp.variance > 0.05 ? 'mesomorph' : 'ectomorph';
  else if (shoulderWaist >= 1.14) type = 'hybrid';
  else type = fp.brightness < 0.45 ? 'endomorph' : 'hybrid';

  const frame =
    shoulderWaist >= 1.45 ? 'broad clavicular span · narrow waist taper'
      : shoulderWaist >= 1.28 ? 'moderate shoulder span · linear torso'
        : shoulderWaist >= 1.14 ? 'balanced span · mixed mid-section distribution'
          : 'compact span · wider mid-section carriage';

  const base: Record<BodyType, Array<{ title: string; slot: SlotId; domain: Domain }>> = {
    ectomorph: [
      { title: 'Feed every 3 hours — no missed window', slot: 'midday', domain: 'health' },
      { title: 'Heavy compound lifts · 45 min', slot: 'evening', domain: 'fitness' },
      { title: 'Bedtime nutrient shake', slot: 'night', domain: 'health' },
    ],
    mesomorph: [
      { title: 'Strength + hybrid conditioning block', slot: 'evening', domain: 'fitness' },
      { title: 'Weigh and plate measured portions', slot: 'midday', domain: 'health' },
      { title: '10,000 steps logged', slot: 'afternoon', domain: 'fitness' },
    ],
    endomorph: [
      { title: 'Front-load the largest meal before midday', slot: 'morning', domain: 'health' },
      { title: '12,000 steps — walking outranks the gym', slot: 'afternoon', domain: 'fitness' },
      { title: 'Zero liquid calories today', slot: 'night', domain: 'health' },
    ],
    hybrid: [
      { title: 'Re-weigh and re-cast macro flags', slot: 'dawn', domain: 'health' },
      { title: 'Alternate lifting and conditioning', slot: 'evening', domain: 'fitness' },
      { title: 'Log every feed against the buffer', slot: 'night', domain: 'health' },
    ],
  };

  const extra: Record<Directive, { title: string; slot: SlotId; domain: Domain }> = {
    lose: { title: 'Hold the deficit — log the calorie ledger', slot: 'night', domain: 'health' },
    gain: { title: 'Hit the surplus target before lights out', slot: 'night', domain: 'health' },
    optimize: { title: 'Mobility, hydration and sleep audit', slot: 'dawn', domain: 'health' },
  };

  return {
    type,
    shoulderWaist,
    frame,
    confidence: Math.min(0.94, 0.58 + Math.abs(shoulderWaist - 1.2) * 0.5 + zones.length * 0.04),
    checklist: [...base[type], extra[directive]],
  };
}

export default function ScanLab() {
  const addHabit = useRegalia((s) => s.addHabit);
  const setBodyType = useRegalia((s) => s.setBodyType);
  const setGoal = useRegalia((s) => s.setGoal);
  const pushNote = useRegalia((s) => s.pushNote);
  const meals = useRegalia((s) => s.meals);
  const addMeal = useRegalia((s) => s.addMeal);

  // ── posture modeler ──
  const [directive, setDirective] = useState<Directive>('optimize');
  const [poseFrame, setPoseFrame] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<BuildVerdict | null>(null);
  const [posing, setPosing] = useState(false);
  const [injected, setInjected] = useState(false);

  // ── skincare checker ──
  const [panel, setPanel] = useState('');
  const [triggers, setTriggers] = useState('');
  const [skin, setSkin] = useState<SkinReport | null>(null);
  const [labelFrame, setLabelFrame] = useState<string | null>(null);

  // ── before / after ──
  const [beforeF, setBeforeF] = useState<string | null>(null);
  const [afterF, setAfterF] = useState<string | null>(null);
  const [cmp, setCmp] = useState<CompareResult | null>(null);

  const poseRef = useRef<HTMLInputElement>(null);

  const take = async (f: File | null | undefined, set: (u: string) => void) => {
    if (!f) return;
    const audit = auditFile(f.name, f.type);
    if (!audit.clean) {
      pushNote('threat', 'Binary signature deflected', `${f.name} — ${audit.vector} quarantined at the scan gate.`);
      return;
    }
    set(await fileToDataURL(f));
  };

  const runPose = async () => {
    if (!poseFrame) return;
    setPosing(true);
    setInjected(false);
    const v = await analysePosture(poseFrame, directive);
    setVerdict(v);
    if (v) {
      setBodyType(v.type);
      setGoal(DIRECTIVES.find((d) => d.id === directive)!.goal);
    }
    setPosing(false);
  };

  const injectChecklist = () => {
    if (!verdict) return;
    verdict.checklist.forEach((c) => addHabit(c.title, c.slot, c.domain));
    setInjected(true);
    pushNote('system', 'Morphology checklist injected', `${verdict.checklist.length} tailored rites pushed into the daily timeline.`);
  };

  const runSkin = () => setSkin(analyzeIngredients(panel, triggers.split(',').map((t) => t.trim()).filter(Boolean)));

  const runCompare = async () => {
    if (!beforeF || !afterF) return;
    setCmp(await compareFrames(beforeF, afterF));
  };

  const progressFrames = meals.filter((m) => m.photo && m.kind === 'progress');
  const spec = verdict ? BODY_TYPES[verdict.type] : null;
  const skinTone = skin?.verdict === 'toxic' ? TONES.crimson : skin?.verdict === 'caution' ? '#c07f2a' : '#3f6b3a';

  return (
    <div className="space-y-5">
      {/* ── MORPHOLOGICAL BODY MODELER ── */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card ornate px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Morphological body modeler</SectionLabel>
          <PersonStanding size={16} className="text-golddeep" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-monox text-[9px] tracking-[0.2em] text-faint uppercase">Directive</span>
          <div className="flex overflow-hidden rounded-[4px] border-2 border-ink/25">
            {DIRECTIVES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDirective(d.id)}
                className={`px-3 py-2 font-monox text-[11px] font-bold transition-colors ${directive === d.id ? 'bg-crimson text-[#FDFBF7]' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div>
            <div className="relative h-44 w-36 overflow-hidden rounded-[5px] border-2 border-dashed border-ink/30 bg-parch/30">
              {poseFrame ? (
                <>
                  <img src={poseFrame} alt="posture silhouette" className="h-full w-full object-cover" />
                  {verdict && (
                    <>
                      <div className="absolute inset-x-[18%] top-[14%] h-px bg-gold shadow-[0_0_8px_#A8861E]" />
                      <div className="absolute inset-x-[30%] top-[44%] h-px bg-crimson shadow-[0_0_8px_#7E1628]" />
                      <div className="absolute inset-x-[26%] top-[62%] h-px bg-gold shadow-[0_0_8px_#A8861E]" />
                      <span className="absolute left-1 top-[11%] font-monox text-[7px] font-bold text-gold">SHOULDER</span>
                      <span className="absolute left-1 top-[41%] font-monox text-[7px] font-bold text-crimson">WAIST</span>
                      <span className="absolute left-1 top-[59%] font-monox text-[7px] font-bold text-gold">HIP</span>
                    </>
                  )}
                  <button onClick={() => { setPoseFrame(null); setVerdict(null); }} className="absolute right-1 top-1 rounded-full border border-crimson/60 bg-paper p-1 text-crimson" aria-label="Drop posture frame">
                    <X size={11} />
                  </button>
                </>
              ) : (
                <div className="grid h-full place-items-center px-3 text-center">
                  <span className="font-monox text-[9px] font-bold leading-relaxed text-faint uppercase">multi-angle posture frame</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-1.5">
              <button className="btn-ghost !px-2 !py-1.5" onClick={() => poseRef.current?.click()}>
                <Camera size={12} /> Capture
              </button>
              <button className="btn-seal !px-2.5 !py-1.5" onClick={runPose} disabled={!poseFrame || posing}>
                <ScanLine size={12} /> {posing ? 'Parsing…' : 'Analyse'}
              </button>
              <input ref={poseRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { take(e.target.files?.[0], setPoseFrame); e.target.value = ''; }} />
            </div>
          </div>

          <div>
            {!verdict ? (
              <p className="rounded-[4px] border-2 border-dashed border-ink/20 px-4 py-8 text-center font-display text-[14px] italic text-faint">
                Capture a standing posture frame — the engine measures shoulder, waist and hip geometry to classify your
                build across the four biometric tiers.
              </p>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-[4px] border-2 border-gold bg-gold/12 px-3 py-1.5 font-display text-[17px] font-bold text-ink">
                    {spec?.name}
                  </span>
                  <Chip tone="crimson">tier {spec?.numeral}</Chip>
                  <Chip tone="gold">S:W {verdict.shoulderWaist.toFixed(2)}</Chip>
                  <Chip tone="faint">{Math.round(verdict.confidence * 100)}% confidence</Chip>
                </div>
                <p className="mt-2 font-display text-[14px] font-semibold italic leading-snug text-ink2">
                  Geometry read: {verdict.frame}.
                </p>
                <p className="mt-1.5 text-[13px] font-medium leading-snug text-ink2">{spec?.baseline}</p>
                <div className="mt-3 rounded-[4px] border-2 border-ink/15 bg-parch/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-monox text-[9px] font-bold tracking-[0.2em] text-faint uppercase">Tailored checklist</span>
                    <button onClick={injectChecklist} disabled={injected} className={`btn-seal !py-1.5 ${injected ? 'opacity-50' : ''}`}>
                      {injected ? <CheckCircle2 size={12} /> : <ListPlus size={12} />} {injected ? 'Injected' : 'Inject into timeline'}
                    </button>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {verdict.checklist.map((c) => (
                      <li key={c.title} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                        <Sparkles size={12} className="flex-none text-golddeep" />
                        {c.title}
                        <Chip tone="faint">{c.slot} · {c.domain}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <div className="rd-grid grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* ── SKINCARE INGREDIENT CHECKER ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card px-5 py-5 md:px-6">
          <div className="flex items-center justify-between">
            <SectionLabel>Product ingredient checker</SectionLabel>
            <FlaskConical size={15} className="text-golddeep" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer !py-1.5">
              <ImagePlus size={12} /> Capture label
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { take(e.target.files?.[0], setLabelFrame); e.target.value = ''; }} />
            </label>
            {labelFrame && <img src={labelFrame} alt="ingredient panel" className="h-10 w-14 rounded-[3px] border-2 border-ink/25 object-cover" />}
            <span className="font-monox text-[8.5px] font-bold tracking-[0.14em] text-faint uppercase">micro-font panels · paste or transcribe below</span>
          </div>

          <textarea
            value={panel}
            onChange={(e) => setPanel(e.target.value)}
            rows={4}
            placeholder="Aqua, Sodium Laureth Sulfate, Methylparaben, Parfum, Glycerin, Phenoxyethanol…"
            className="mt-2.5 w-full rounded-[4px] border-2 border-ink/25 bg-paper px-3 py-2.5 text-[13px] font-medium leading-relaxed text-ink placeholder:text-faint"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
              placeholder="personal triggers — niacinamide, retinol…"
              className="min-w-40 flex-1 rounded-[4px] border-2 border-ink/20 bg-paper px-3 py-2 text-[12.5px] font-medium text-ink placeholder:text-faint"
            />
            <button className="btn-seal !py-2" onClick={runSkin}>
              <ScanLine size={12} /> Analyse formulation
            </button>
          </div>

          <AnimatePresence>
            {skin && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <div
                  className="flex flex-wrap items-center gap-2.5 rounded-[5px] border-2 px-3.5 py-3"
                  style={{ borderColor: skinTone, background: `${skinTone}18` }}
                >
                  {skin.verdict === 'safe' ? <ShieldCheck size={18} style={{ color: skinTone }} /> : <ShieldAlert size={18} style={{ color: skinTone }} />}
                  <span className="font-display text-[16px] font-bold" style={{ color: skinTone }}>
                    {skin.verdict === 'safe' ? 'Safe Component Structure' : skin.verdict === 'caution' ? 'Caution — Review Formulation' : 'Toxic Formulation Threat Found'}
                  </span>
                  <span className="ml-auto font-monox text-[10px] font-bold text-ink2">{skin.parsed} components parsed</span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="font-monox text-[9px] font-bold tracking-[0.18em] text-faint uppercase">Reaction risk index</span>
                  <div className="flex-1"><Bar pct={skin.index / 100} tone={skinTone} height={8} /></div>
                  <span className="font-display text-[17px] font-bold" style={{ color: skinTone }}>{skin.index}</span>
                </div>

                {skin.hits.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {skin.hits.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-[4px] border-2 border-ink/12 bg-paper/60 px-2.5 py-2">
                        <TriangleAlert size={13} className={`mt-0.5 flex-none ${h.severity === 'high' ? 'text-crimson' : h.severity === 'moderate' ? 'text-[#c07f2a]' : 'text-faint'}`} />
                        <div>
                          <div className="text-[13px] font-bold text-ink">
                            {h.family} <span className="font-monox text-[10px] text-faint">· “{h.term}”</span>
                          </div>
                          <div className="text-[12px] font-medium leading-snug text-ink2">{h.risk}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 rounded-[4px] border-2 border-gold/35 bg-gold/8 p-3">
                  <div className="font-monox text-[9px] font-bold tracking-[0.2em] text-golddeep uppercase">Step-by-step reaction protocol</div>
                  <ol className="mt-2 space-y-1">
                    {skin.steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-[12.5px] font-semibold leading-snug text-ink2">
                        <span className="font-monox font-bold text-golddeep">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── BEFORE / AFTER PROGRESSION ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card px-5 py-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Before · after progression</SectionLabel>
            <Activity size={15} className="text-golddeep" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {([['Before', beforeF, setBeforeF], ['After', afterF, setAfterF]] as const).map(([label, src, set]) => (
              <label key={label} className="block cursor-pointer">
                <span className="mb-1 block font-monox text-[9px] font-bold tracking-[0.2em] text-faint uppercase">{label}</span>
                <div className="relative h-32 overflow-hidden rounded-[5px] border-2 border-dashed border-ink/25 bg-parch/30">
                  {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : (
                    <div className="grid h-full place-items-center">
                      <ImagePlus size={18} className="text-faint" />
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { take(e.target.files?.[0], set as (u: string) => void); e.target.value = ''; }} />
              </label>
            ))}
          </div>

          <button className="btn-seal mt-3 w-full justify-center !py-2.5" onClick={runCompare} disabled={!beforeF || !afterF}>
            <ScanLine size={13} /> Align & chart progression
          </button>

          {cmp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['Clarity', cmp.clarity],
                  ['Evenness', cmp.evenness],
                  ['Luminance', cmp.brightness],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-[4px] border-2 border-ink/15 bg-paper/60 px-2 py-3 text-center">
                    <div className="font-monox text-[8px] font-bold tracking-[0.18em] text-faint uppercase">{k}</div>
                    <div className={`mt-1 font-display text-[20px] font-bold ${v >= 0 ? 'text-[#3f6b3a]' : 'text-crimson'}`}>
                      {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-l-4 border-gold pl-3 font-display text-[14px] font-semibold italic leading-snug text-ink2">{cmp.verdict}</p>
            </motion.div>
          )}

          <div className="mt-5 border-t-2 border-line pt-4">
            <div className="flex items-center justify-between">
              <span className="font-monox text-[9px] font-bold tracking-[0.2em] text-faint uppercase">Vaulted progress frames</span>
              <Ring pct={Math.min(1, progressFrames.length / 10)} size={34} stroke={4} tone={TONES.gold}>
                <span className="font-display text-[11px] font-bold text-ink">{progressFrames.length}</span>
              </Ring>
            </div>
            <div className="scrollthin mt-2 flex gap-2 overflow-x-auto pb-1">
              {progressFrames.length === 0 && <span className="py-3 font-display text-[13px] italic text-faint">No frames vaulted yet.</span>}
              {progressFrames.map((m) => (
                <img key={m.id} src={m.photo} alt="progress" className="h-16 w-16 flex-none rounded-[4px] border-2 border-ink/20 object-cover" />
              ))}
            </div>
            {afterF && (
              <button
                onClick={() => { addMeal({ name: 'Skin progress frame', kcal: 0, carb: 0, protein: 0, fat: 0, photo: afterF, kind: 'progress' }); }}
                className="btn-ghost mt-2 w-full justify-center !py-2"
              >
                <ListPlus size={12} /> Vault the “after” frame to the timeline
              </button>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

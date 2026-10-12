import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Aperture,
  Camera,
  Flame,
  ImagePlus,
  Plus,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useRegalia } from '../store';
import { scanDish, TIER_META } from '../lib/shield';
import type { ShieldReport } from '../lib/shield';
import { fileToDataURL, pixelFingerprint, snapshotVideo, videoFrameToDataURL } from '../lib/media';
import { auditFile } from '../lib/sentinel';
import { computeTargets } from '../lib/bodyforge';
import { PORTIONS, type PortionId } from '../lib/fooddb';
import { parseFrame, type VisionDetection } from '../lib/vision';
import { shortDate, todayISO } from '../lib/time';
import { Bar, Chip, SectionLabel, TONES } from '../components/bits';
import type { DietProfile, MealEntry } from '../lib/types';

const FILTERS: Array<{ key: keyof DietProfile; label: string; tier: string; placeholder: string }> = [
  { key: 'allergies', label: 'Allergies · danger', tier: 'danger', placeholder: 'e.g. peanuts, shellfish…' },
  { key: 'conditions', label: 'Conditions · warn', tier: 'warn', placeholder: 'e.g. diabetes, lactose…' },
  { key: 'dislikes', label: 'Dislikes · info', tier: 'info', placeholder: 'e.g. cilantro, olives…' },
];

const tierChipTone = (t: MealEntry['tier']) => (t === 'danger' ? 'crimson' : t === 'warn' ? 'gold' : t === 'info' ? 'faint' : 'gold');

export default function DietLab() {
  const diet = useRegalia((s) => s.diet);
  const meals = useRegalia((s) => s.meals);
  const body = useRegalia((s) => s.body);
  const addMeal = useRegalia((s) => s.addMeal);
  const removeMeal = useRegalia((s) => s.removeMeal);
  const addDietItem = useRegalia((s) => s.addDietItem);
  const removeDietItem = useRegalia((s) => s.removeDietItem);
  const pushNote = useRegalia((s) => s.pushNote);

  // ── scanner state ──
  const [dish, setDish] = useState('');
  const [hints, setHints] = useState('');
  const [portion, setPortion] = useState<PortionId>('standard');
  const [frame, setFrame] = useState<string | null>(null);
  const [report, setReport] = useState<ShieldReport | null>(null);
  const [zones, setZones] = useState<VisionDetection[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filterInput, setFilterInput] = useState<Record<keyof DietProfile, string>>({ allergies: '', conditions: '', dislikes: '' });

  // ── meal form state ──
  const [mName, setMName] = useState('');
  const [mKcal, setMKcal] = useState('450');
  const [mCarb, setMCarb] = useState('40');
  const [mProtein, setMProtein] = useState('30');
  const [mFat, setMFat] = useState('15');
  const [mPhoto, setMPhoto] = useState<string | null>(null);

  // ── camera modal ──
  const [camOpen, setCamOpen] = useState(false);
  const [camTarget, setCamTarget] = useState<'frame' | 'meal'>('frame');
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── viewer modal ──
  const [viewer, setViewer] = useState<MealEntry | null>(null);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopCam(), []);

  const openCam = async (target: 'frame' | 'meal') => {
    setCamTarget(target);
    setCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Live camera unavailable in this browser — use frame upload instead.');
      setCamOpen(true);
      return;
    }
    setCamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCamError('Camera permission denied or device offline — use frame upload instead.');
    }
  };

  const capture = () => {
    if (!videoRef.current) return;
    const shot = snapshotVideo(videoRef.current);
    if (shot) {
      if (camTarget === 'frame') setFrame(shot);
      else setMPhoto(shot);
      pushNote('system', 'Camera snapshot compressed', 'Frame inducted into the local pipeline matrix at 640px · JPEG 0.72.');
    }
    stopCam();
    setCamOpen(false);
  };

  const onUpload = async (files: FileList | null, target: 'frame' | 'meal') => {
    if (!files || files.length === 0) return;
    let ok = 0;
    for (const file of Array.from(files)) {
      const audit = auditFile(file.name, file.type);
      if (!audit.clean) {
        pushNote('threat', 'Binary signature deflected', `${file.name} — ${audit.vector} quarantined before pipeline entry.`);
        continue;
      }
      let url: string | null = null;
      if (file.type.startsWith('video/')) url = await videoFrameToDataURL(file);
      else url = await fileToDataURL(file);
      if (url && ok === 0) {
        if (target === 'frame') setFrame(url);
        else setMPhoto(url);
      }
      if (url) ok++;
    }
    if (ok > 0) pushNote('system', 'Media inducted', `${ok} frame${ok === 1 ? '' : 's'} compressed into the local pipeline matrix.`);
  };

  const runScan = async () => {
    if (!dish.trim() && !hints.trim() && !frame) return;
    setScanning(true);
    // Zonal edge clustering runs first — its multi-object verdict outranks
    // every textual hint and fingerprint heuristic.
    const dets = frame ? await parseFrame(frame, portion) : [];
    const fp = frame ? await pixelFingerprint(frame) : null;
    setZones(dets);
    setReport(scanDish(dish, hints, diet, { bodyType: body.type, fingerprint: fp, portion, vision: dets }));
    setScanning(false);
  };

  /** A zone is unsafe when its detected name surfaces in a danger-tier hit. */
  const zoneUnsafe = (d: VisionDetection) =>
    (report?.hits ?? []).some((h) => h.tier === 'danger' && h.term.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]));

  const foodTotals = (report?.foods ?? []).reduce(
    (a, f) => ({ kcal: a.kcal + f.kcal, carb: a.carb + f.carb, protein: a.protein + f.protein, fat: a.fat + f.fat }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 },
  );

  const loadToRegistrar = () => {
    if (!report || report.foods.length === 0) return;
    setMName(dish.trim() || report.foods.map((f) => f.name).join(' + '));
    setMKcal(String(foodTotals.kcal));
    setMCarb(String(foodTotals.carb));
    setMProtein(String(foodTotals.protein));
    setMFat(String(foodTotals.fat));
    if (frame) setMPhoto(frame);
  };

  const submitMeal = () => {
    const r = addMeal({
      name: mName,
      kcal: Number(mKcal) || 0,
      carb: Number(mCarb) || 0,
      protein: Number(mProtein) || 0,
      fat: Number(mFat) || 0,
      photo: mPhoto ?? undefined,
    });
    if (r.ok) {
      setMName('');
      setMPhoto(null);
    }
  };

  const targets = computeTargets(body);
  const today = todayISO();
  const todayMeals = meals.filter((m) => m.dateISO === today && m.kind !== 'progress');
  const totals = todayMeals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, carb: a.carb + m.carb, protein: a.protein + m.protein, fat: a.fat + m.fat }), { kcal: 0, carb: 0, protein: 0, fat: 0 });
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const rangeDays = range === 'daily' ? 1 : range === 'weekly' ? 7 : range === 'monthly' ? 30 : 0;
  const photoLog = meals
    .filter((m) => m.photo)
    .filter((m) => {
      if (rangeDays === 0) return true;
      const days = (Date.now() - new Date(`${m.dateISO}T12:00:00`).getTime()) / 86_400_000;
      return days < rangeDays;
    })
    .slice()
    .sort((a, b) => (a.dateISO + String(a.hour).padStart(2, '0')).localeCompare(b.dateISO + String(b.hour).padStart(2, '0')));

  return (
    <div className="space-y-5">
      <div className="rd-grid grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* ── shield scanner ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card ornate px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Allergen shield · optical scan</SectionLabel>
            <Chip tone="faint">local heuristics · zero egress</Chip>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              placeholder="Dish name — e.g. shrimp Pad Thai"
              className="rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint"
            />
            <input
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="Ingredient hints — peanut sauce, cream…"
              className="rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-seal !py-1.5" onClick={runScan} disabled={scanning}>
              <ScanSearch size={12} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Parsing zones…' : 'Zonal scan'}
            </button>
            <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
              {(Object.keys(PORTIONS) as PortionId[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPortion(p)}
                  title={PORTIONS[p].label}
                  className={`px-2.5 py-1.5 font-monox text-[10px] transition-colors ${portion === p ? 'bg-gold text-coal' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
                >
                  {p === 'small' ? 'S' : p === 'large' ? 'L' : 'M'}
                </button>
              ))}
            </div>
            <button className="btn-ghost !py-1.5" onClick={() => openCam('frame')}>
              <Camera size={12} /> Live frame
            </button>
            <label className="btn-ghost cursor-pointer !py-1.5">
              <ImagePlus size={12} /> Upload frames
              <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => onUpload(e.target.files, 'frame')} />
            </label>
            {frame && (
              <button className="btn-ghost !py-1.5" onClick={() => { setFrame(null); setReport(null); }}>
                <X size={11} /> Drop frame
              </button>
            )}
          </div>

          {/* frame + zone overlays */}
          {(frame || report) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
              {frame && (
                <div className="relative w-full max-w-[280px] overflow-hidden rounded-[5px] border-2 border-ink/25">
                  <img src={frame} alt="scanned frame" className="block h-auto w-full" />
                  {/* measured zone boundaries from the clustering engine */}
                  {zones.map((d, i) => {
                    const bad = zoneUnsafe(d);
                    const col = bad ? '#7E1628' : '#A8861E';
                    return (
                      <div
                        key={d.key + i}
                        className="absolute rounded-[3px] border-2"
                        style={{
                          left: `${d.bbox.x}%`, top: `${d.bbox.y}%`, width: `${d.bbox.w}%`, height: `${d.bbox.h}%`,
                          borderColor: col,
                          background: bad ? 'rgba(126,22,40,0.16)' : 'transparent',
                          boxShadow: `0 0 0 1px rgba(253,251,247,.55) inset, 0 0 16px ${col}80`,
                        }}
                      >
                        <span
                          className="absolute -top-[9px] left-0 whitespace-nowrap px-1 py-px font-monox text-[7px] font-bold tracking-[0.1em]"
                          style={{ background: col, color: '#FDFBF7' }}
                        >
                          {bad ? '⚠ ' : ''}{d.name.toUpperCase()} {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                  {zones.length === 0 && report && report.tier !== 'clear' && (
                    <div className="absolute inset-0" style={{ background: `${TIER_META[report.tier].bar}14` }} />
                  )}
                  {report && (
                    <span
                      className="absolute bottom-1.5 left-1.5 rounded-[3px] px-1.5 py-0.5 font-monox text-[8px] font-bold tracking-[0.16em]"
                      style={{ background: TIER_META[report.tier].bar, color: '#FDFBF7' }}
                    >
                      {report.tier.toUpperCase()} · {zones.length} ZONES
                    </span>
                  )}
                </div>
              )}

              {report && (
                <div className="min-w-0">
                  <div className={`inline-flex items-center gap-2 rounded-[4px] border px-3 py-1.5 font-monox text-[10px] tracking-[0.18em] uppercase ${TIER_META[report.tier].cls}`}>
                    {report.tier === 'clear' ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                    {TIER_META[report.tier].label}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {report.hits.length === 0 && <li className="text-[12px] text-ink2">No filters matched — the plate stands unopposed.</li>}
                    {report.hits.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-ink2">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: TIER_META[h.tier].bar }} />
                        <span>
                          <span className="font-semibold text-ink">{h.term}</span> — {h.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {report.foods.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-monox text-[8.5px] tracking-[0.2em] text-golddeep uppercase">FOODDB detections · {PORTIONS[portion].label}</span>
                        <button onClick={loadToRegistrar} className="btn-ghost !px-2 !py-1 text-[9px]" title="Load detected macros into the registrar">
                          → registrar
                        </button>
                      </div>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {report.foods.map((f) => (
                          <div key={f.key} className="rounded-[4px] border border-ink/12 bg-paper/70 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-[12.5px] font-semibold text-ink">{f.name}</span>
                              <span className={`font-monox text-[7.5px] tracking-[0.14em] uppercase ${f.via === 'pixel' ? 'text-golddeep' : 'text-faint'}`}>
                                {f.via === 'pixel' ? `optical ${Math.round((f.confidence ?? 0.5) * 100)}%` : 'text'}
                              </span>
                            </div>
                            <div className="mt-0.5 font-monox text-[8.5px] tracking-[0.1em] text-ink2">
                              {f.kcal} kcal · {f.protein}p / {f.carb}c / {f.fat}f
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.fpNote && <p className="mt-2.5 font-monox text-[8.5px] tracking-[0.12em] text-faint uppercase">{report.fpNote}</p>}
                  {report.tier !== 'clear' && (
                    <div className="mt-3">
                      <div className="font-monox text-[8.5px] tracking-[0.2em] text-golddeep uppercase">Remedial substitutions</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {report.subs.map((s) => (
                          <span key={s} className="rounded-[3px] border border-[#3f6b3a]/45 bg-[#3f6b3a]/8 px-2 py-1 text-[11px] text-[#33572f]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* ── danger filters ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card px-5 py-5">
          <SectionLabel>Sovereign danger filters</SectionLabel>
          <div className="mt-4 space-y-4">
            {FILTERS.map((f) => (
              <div key={f.key}>
                <div className="font-monox text-[8.5px] tracking-[0.2em] text-faint uppercase">{f.label}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {diet[f.key].map((t) => (
                    <button
                      key={t}
                      onClick={() => removeDietItem(f.key, t)}
                      title="Remove filter"
                      className={`group rounded-[3px] border px-2 py-1 font-monox text-[10px] transition-colors ${
                        f.tier === 'danger' ? 'border-crimson/45 bg-crimson/5 text-crimson' : f.tier === 'warn' ? 'border-[#c07f2a]/50 bg-[#c07f2a]/8 text-[#9a6420]' : 'border-ink/25 bg-ink/4 text-ink2'
                      }`}
                    >
                      {t} <span className="opacity-50 group-hover:opacity-100">×</span>
                    </button>
                  ))}
                  <input
                    value={filterInput[f.key]}
                    onChange={(e) => setFilterInput((p) => ({ ...p, [f.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addDietItem(f.key, filterInput[f.key]);
                        setFilterInput((p) => ({ ...p, [f.key]: '' }));
                      }
                    }}
                    placeholder={diet[f.key].length === 0 ? f.placeholder : '+ add'}
                    className="min-w-24 flex-1 rounded-[3px] border border-dashed border-ink/20 bg-paper/60 px-2 py-1 text-[11px] text-ink placeholder:text-faint"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-ink/10 pt-3 font-monox text-[7.5px] leading-relaxed tracking-[0.16em] text-faint uppercase">
            every frame & dish is cross-referenced natively · no payloads leave the device
          </p>
        </motion.section>
      </div>

      {/* ── meal registrar + ledger ── */}
      <div className="rd-grid grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card px-5 py-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Meal registrar</SectionLabel>
            <UtensilsCrossed size={14} className="text-golddeep" />
          </div>
          <div className="mt-4 space-y-2">
            <input
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              placeholder="Meal name — shield auto-scans on save"
              className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint"
            />
            <div className="grid grid-cols-4 gap-2">
              {([
                ['kcal', mKcal, setMKcal],
                ['carb', mCarb, setMCarb],
                ['protein', mProtein, setMProtein],
                ['fat', mFat, setMFat],
              ] as const).map(([label, v, set]) => (
                <label key={label} className="block">
                  <span className="font-monox text-[8px] tracking-[0.18em] text-faint uppercase">{label}</span>
                  <input
                    value={v}
                    onChange={(e) => set(e.target.value)}
                    inputMode="numeric"
                    className="mt-0.5 w-full rounded-[3px] border border-ink/20 bg-paper px-2 py-1.5 text-center font-monox text-[12px] text-ink"
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-ghost !py-1.5" onClick={() => openCam('meal')}>
                <Camera size={12} /> Snap
              </button>
              <label className="btn-ghost cursor-pointer !py-1.5">
                <ImagePlus size={12} /> Frame
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => onUpload(e.target.files, 'meal')} />
              </label>
              <label className="btn-ghost cursor-pointer !py-1.5 !border-gold/50 !text-golddeep" title="Vault a skin/physique progress frame to the timeline">
                <Aperture size={12} /> Progress
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return;
                    for (const f of Array.from(e.target.files)) {
                      const audit = auditFile(f.name, f.type);
                      if (audit.clean) {
                        const url = f.type.startsWith('video/') ? await videoFrameToDataURL(f) : await fileToDataURL(f);
                        if (url) addMeal({ name: 'Progress frame', kcal: 0, carb: 0, protein: 0, fat: 0, photo: url, kind: 'progress' });
                      } else pushNote('threat', 'Binary signature deflected', `${f.name} quarantined at progress gate.`);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              {mPhoto && <img src={mPhoto} alt="meal frame" className="h-8 w-10 rounded-[3px] border border-ink/25 object-cover" />}
              <button className="btn-seal ml-auto !py-1.5" onClick={submitMeal}>
                <Plus size={12} /> Record
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-ink/12 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-monox text-[9px] tracking-[0.2em] text-faint uppercase">Today against targets</span>
              <span className="font-monox text-[9px] text-golddeep">{totals.kcal} / {targets.kcal} kcal</span>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-14 font-monox text-[8px] tracking-[0.14em] text-faint uppercase">energy</span>
                <Bar pct={targets.kcal ? totals.kcal / targets.kcal : 0} tone={TONES.crimson} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 font-monox text-[8px] tracking-[0.14em] text-faint uppercase">protein</span>
                <Bar pct={targets.proteinG ? totals.protein / targets.proteinG : 0} />
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── today's ledger ── */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="card px-5 py-5">
          <SectionLabel>Meal ledger · today</SectionLabel>
          <ul className="mt-3 divide-y divide-ink/10">
            {todayMeals.length === 0 && <li className="py-8 text-center font-display italic text-faint">No meals recorded — the table awaits.</li>}
            {todayMeals.map((m) => (
              <li key={m.id} className="group flex items-center gap-3 py-2.5">
                {m.photo ? (
                  <img src={m.photo} alt="" className="h-9 w-12 flex-none cursor-pointer rounded-[3px] border border-ink/20 object-cover" onClick={() => setViewer(m)} />
                ) : (
                  <span className="grid h-9 w-12 flex-none place-items-center rounded-[3px] border border-dashed border-ink/20 text-faint">
                    <UtensilsCrossed size={12} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-[14.5px] font-semibold text-ink">{m.name}</span>
                    {m.tier !== 'clear' && <Chip tone={tierChipTone(m.tier)}>{m.tier}</Chip>}
                  </div>
                  <div className="mt-0.5 font-monox text-[9px] tracking-[0.12em] text-faint uppercase">
                    {String(m.hour).padStart(2, '0')}:00 · {m.kcal} kcal · {m.protein}p / {m.carb}c / {m.fat}f
                    {m.flags[0] ? ` · ${m.flags[0]}` : ''}
                  </div>
                </div>
                <button onClick={() => removeMeal(m.id)} title="Vault meal (30-day recoverable)" className="text-faint/60 opacity-0 transition-opacity hover:text-crimson group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      {/* ── visual progression timeline ── */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="card ornate px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Visual progression · time-series frames</SectionLabel>
          <div className="flex items-center gap-1.5">
            {(['daily', 'weekly', 'monthly', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-[3px] border px-2 py-1 font-monox text-[8.5px] tracking-[0.16em] uppercase transition-colors ${range === r ? 'border-crimson bg-crimson text-[#f3e8cf]' : 'border-ink/20 text-ink2 hover:border-gold'}`}
              >
                {r}
              </button>
            ))}
            <Chip tone="faint">
              <Flame size={9} /> {photoLog.length}
            </Chip>
          </div>
        </div>
        {photoLog.length === 0 ? (
          <p className="mt-4 rounded-[4px] border border-dashed border-ink/20 py-8 text-center font-display italic text-faint">
            Attach frames to meals (or the scanner) and a slideable progression strip crystallizes here — skin, face,
            physique, week over week.
          </p>
        ) : (
          <div className="scrollthin mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {photoLog.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setViewer(m)}
                className="group relative w-36 flex-none snap-start overflow-hidden rounded-[5px] border border-ink/20 text-left transition-transform hover:-translate-y-1"
              >
                <img src={m.photo} alt={m.name} className="h-32 w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-coal/80 px-1.5 py-0.5 font-monox text-[8px] tracking-[0.12em] text-gold2">
                  #{String(i + 1).padStart(2, '0')} · {shortDate(m.dateISO)}
                </span>
                <div className="bg-paper px-2 py-1.5">
                  <div className="truncate font-display text-[12px] font-semibold text-ink">{m.name}</div>
                  <div className="font-monox text-[8px] tracking-[0.12em] text-faint uppercase">{String(m.hour).padStart(2, '0')}:00 · {m.kcal} kcal</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── camera modal ── */}
      <AnimatePresence>
        {camOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-coal/70 backdrop-blur-[3px]" onClick={() => { stopCam(); setCamOpen(false); }} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Live camera"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-[90] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-gold/45 bg-coal p-4 shadow-[0_40px_90px_-30px_rgba(28,17,9,0.9)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-monox text-[9px] tracking-[0.28em] text-gold2 uppercase">
                  <Aperture size={12} /> Live optical feed
                </span>
                <button onClick={() => { stopCam(); setCamOpen(false); }} className="rounded-full border border-gold/30 p-1.5 text-[#b8a98e] hover:text-gold2" aria-label="Close camera">
                  <X size={14} />
                </button>
              </div>
              <div className="mt-3 overflow-hidden rounded-[4px] border border-gold/25 bg-black">
                {camError ? (
                  <p className="px-4 py-10 text-center font-display text-[13px] italic text-[#d8c8a8]">{camError}</p>
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="block max-h-[46vh] w-full object-cover" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {!camError && (
                  <button onClick={capture} className="btn-seal flex-1 justify-center">
                    <Aperture size={13} /> Capture frame
                  </button>
                )}
                <label className="btn-ghost cursor-pointer !border-gold/40 !text-gold2">
                  <ImagePlus size={12} /> Upload instead
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      await onUpload(e.target.files, camTarget);
                      stopCam();
                      setCamOpen(false);
                    }}
                  />
                </label>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── frame viewer modal ── */}
      <AnimatePresence>
        {viewer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-coal/70 backdrop-blur-[3px]" onClick={() => setViewer(null)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Frame viewer"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-[90] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-gold/45 bg-paper p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-lg font-semibold text-ink">{viewer.name}</div>
                  <div className="font-monox text-[9px] tracking-[0.16em] text-faint uppercase">
                    {shortDate(viewer.dateISO)} · {String(viewer.hour).padStart(2, '0')}:00 · {viewer.kcal} kcal · {viewer.tier.toUpperCase()}
                  </div>
                </div>
                <button onClick={() => setViewer(null)} className="rounded-full border border-ink/20 p-1.5 text-ink2 hover:border-crimson hover:text-crimson" aria-label="Close viewer">
                  <X size={14} />
                </button>
              </div>
              {viewer.photo && <img src={viewer.photo} alt={viewer.name} className="mt-3 max-h-[52vh] w-full rounded-[4px] border border-ink/20 object-cover" />}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

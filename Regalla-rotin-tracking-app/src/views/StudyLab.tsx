import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, BrainCircuit, FileImage, GraduationCap, History, PenLine, Timer, UploadCloud, X } from 'lucide-react';
import { useRegalia } from '../store';
import { fileToDataURL, pixelFingerprint } from '../lib/media';
import { auditFile, budgetedScanPayload } from '../lib/sentinel';
import { ago } from '../lib/time';
import { Bar, Ring, SectionLabel, TONES } from '../components/bits';

interface MCQ {
  term: string;
  answer: string;
  options: string[];
  correct: number;
}

/** Transform pasted definitions into interactive multiple-choice layouts. */
function forgeQuestions(text: string, count = 6): MCQ[] {
  const lines = text
    .split(/[\n.]+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 24 && l.length <= 220);
  const defs: Array<{ term: string; answer: string }> = [];
  for (const line of lines) {
    const m = line.match(/^([A-Z][\w\s'-]{1,42}?)[\s:]+(?:is|are|was|refers to|means|consists of|—|-|:)\s*(.{12,160})/);
    if (m) defs.push({ term: m[1].trim(), answer: m[2].trim().replace(/[.;]$/, '') });
    if (defs.length >= 14) break;
  }
  if (defs.length < 4) return [];
  const picked = defs.slice(0, count);
  return picked.map((d, i) => {
    const distract = defs.filter((x) => x !== d);
    let h = i * 2654435761 >>> 0;
    const shuffled = [...distract];
    for (let j = shuffled.length - 1; j > 0; j--) {
      h = (h * 1103515245 + 12345) >>> 0;
      const k = h % (j + 1);
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const options = [d.answer, ...shuffled.slice(0, 3).map((x) => x.answer)];
    for (let j = options.length - 1; j > 0; j--) {
      h = (h * 1103515245 + 12345) >>> 0;
      const k = h % (j + 1);
      [options[j], options[k]] = [options[k], options[j]];
    }
    return { term: d.term, answer: d.answer, options, correct: options.indexOf(d.answer) };
  });
}

const grade = (pct: number) => (pct >= 90 ? 'SOVEREIGN' : pct >= 75 ? 'DISTINCTION' : pct >= 50 ? 'PASSING' : 'REMEDIAL');

export default function StudyLab() {
  const study = useRegalia((s) => s.study);
  const addStudyResult = useRegalia((s) => s.addStudyResult);
  const pushNote = useRegalia((s) => s.pushNote);
  const speakOut = useRegalia((s) => s.settings.voiceAssist);

  const [source, setSource] = useState('');
  const [alarm, setAlarm] = useState<string | null>(null);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState<null | { score: number; ms: number }>(null);
  const startedAt = useRef(0);

  const [nbMax, setNbMax] = useState(10);
  const [nbFrame, setNbFrame] = useState<string | null>(null);
  const [nbResult, setNbResult] = useState<null | { marks: number; note: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // live countdown
  useEffect(() => {
    if (questions.length === 0 || finished) return;
    const iv = setInterval(() => setTimeLeft((v) => {
      if (v <= 1) {
        finish();
        return 0;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, finished]);

  const forge = () => {
    const scan = budgetedScanPayload(source);
    if (!scan.clean) {
      setAlarm(scan.vector ?? 'PAYLOAD');
      setTimeout(() => setAlarm(null), 4200);
      return;
    }
    const qs = forgeQuestions(scan.sanitized);
    if (qs.length < 4) {
      setAlarm('NEED 4+ DEFINITION LINES');
      setTimeout(() => setAlarm(null), 4200);
      return;
    }
    setQuestions(qs);
    setIdx(0);
    setPicks({});
    setFinished(null);
    setTimeLeft(qs.length * 45);
    startedAt.current = Date.now();
    pushNote('system', 'Study suite forged', `${qs.length} questions · 45s per question · countdown armed.`);
  };

  const finish = () => {
    setFinished((prev) => {
      if (prev) return prev;
      const correct = questions.reduce((acc, q, i) => acc + (picks[i] === q.correct ? 1 : 0), 0);
      const ms = Date.now() - startedAt.current;
      addStudyResult({ source: 'mcq', title: 'Forged MCQ suite', score: correct, max: questions.length, ms });
      return { score: correct, ms };
    });
  };

  const scoreNb = async (file: File) => {
    const audit = auditFile(file.name, file.type);
    if (!audit.clean) {
      pushNote('threat', 'Binary signature deflected', `${file.name} — executable extension quarantined at the notebook gate.`);
      return;
    }
    const url = await fileToDataURL(file);
    setNbFrame(url);
    const fp = await pixelFingerprint(url);
    if (!fp) {
      setNbResult({ marks: 0, note: 'frame unreadable — no marks distributed' });
      return;
    }
    // Pixel-hash diagnostics — ink-density variance mapped to the mark ceiling.
    const density = Math.min(1, fp.variance * 3.2 + (1 - fp.brightness) * 0.35);
    const marks = Math.round(nbMax * Math.min(0.98, Math.max(0.3, 0.35 + density * 0.75)));
    const note = `pixel-hash diagnostics · ink density ${(density * 100).toFixed(0)}% · brightness ${(fp.brightness * 100).toFixed(0)}%`;
    setNbResult({ marks, note });
    addStudyResult({ source: 'notebook', title: 'Notebook script scan', score: marks, max: nbMax, ms: 0 });
    if (speakOut) pushNote('voice', `Notebook graded — ${marks} of ${nbMax}`, note);
  };

  const mcqPct = finished ? finished.score / questions.length : 0;
  const avg = useMemo(() => (study.length ? study.reduce((a, r) => a + r.score / Math.max(1, r.max), 0) / study.length : 0), [study]);

  const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="rd-grid grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* forge + notebook */}
        <div className="space-y-5">
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card ornate px-5 py-5 md:px-6">
            <div className="flex items-center justify-between">
              <SectionLabel>Test forge · textbook to suite</SectionLabel>
              <BrainCircuit size={15} className="text-golddeep" />
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={6}
              placeholder={'Paste lecture logs or textbook definitions…\nPhotosynthesis is the conversion of light energy into chemical energy.\nMitosis: cell division yielding two identical daughter nuclei.'}
              className={`mt-4 w-full rounded-[4px] border bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-faint ${alarm ? 'alarm !border-crimson' : 'border-ink/25'}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-seal !py-1.5" onClick={forge}>
                <BookOpen size={12} /> Forge MCQ suite
              </button>
              {alarm && <span className="font-monox text-[9px] tracking-[0.18em] text-crimson uppercase">{alarm.startsWith('NEED') ? 'Forge needs ≥4 “Term is definition” lines' : `Guarded · ${alarm}`}</span>}
              {questions.length > 0 && !finished && (
                <span className={`ml-auto rounded-[3px] border px-2 py-1 font-monox text-[10px] tracking-[0.14em] ${timeLeft < 30 ? 'animate-pulse border-crimson/50 text-crimson' : 'border-gold/50 text-golddeep'}`}>
                  <Timer size={11} className="mr-1 inline" /> {mmss(timeLeft)}
                </span>
              )}
            </div>

            {/* live test runner */}
            {questions.length > 0 && (
              <div className="mt-4 border-t border-ink/12 pt-4">
                {!finished ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-monox text-[9px] tracking-[0.2em] text-faint uppercase">
                        Question {idx + 1} / {questions.length}
                      </span>
                      <span className="w-24"><Bar pct={(idx + 1) / questions.length} /></span>
                    </div>
                    <h4 className="mt-3 font-display text-[19px] font-semibold leading-snug text-ink">
                      Which statement defines <span className="gold-text">{questions[idx].term}</span>?
                    </h4>
                    <div className="mt-3 space-y-2">
                      {questions[idx].options.map((opt, oi) => {
                        const picked = picks[idx] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => setPicks((p) => ({ ...p, [idx]: oi }))}
                            className={`flex w-full items-start gap-2.5 rounded-[4px] border px-3 py-2.5 text-left text-[13px] leading-snug transition-all ${
                              picked ? 'border-gold bg-gold/12 text-ink shadow-[0_0_0_2px_rgba(168,134,30,0.25)]' : 'border-ink/15 bg-paper/70 text-ink2 hover:border-gold/60'
                            }`}
                          >
                            <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full border font-monox text-[9px] ${picked ? 'border-gold bg-gold text-coal' : 'border-ink/30 text-faint'}`}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button className="btn-ghost !py-1.5" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                        Back
                      </button>
                      {idx < questions.length - 1 ? (
                        <button className="btn-ghost !py-1.5" onClick={() => setIdx((i) => i + 1)} disabled={picks[idx] === undefined}>
                          Next
                        </button>
                      ) : (
                        <button className="btn-seal !py-1.5" onClick={finish} disabled={Object.keys(picks).length < questions.length}>
                          <GraduationCap size={12} /> Submit script
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-wrap items-center gap-5">
                    <Ring pct={mcqPct} size={104} tone={mcqPct >= 0.5 ? TONES.gold : TONES.crimson}>
                      <div className="text-center">
                        <div className="font-display text-[24px] font-semibold text-ink">{Math.round(mcqPct * 100)}%</div>
                        <div className="font-monox text-[7.5px] tracking-[0.18em] text-faint uppercase">{grade(mcqPct * 100)}</div>
                      </div>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-xl font-semibold text-ink">
                        {finished.score} of {questions.length} correct
                      </div>
                      <p className="mt-1 font-monox text-[9px] tracking-[0.14em] text-faint uppercase">
                        duration {(finished.ms / 1000).toFixed(0)}s · sealed to your progress dashboard
                      </p>
                      <div className="mt-2.5 max-h-36 space-y-1 overflow-y-auto scrollthin pr-1">
                        {questions.map((q, i) => (
                          <div key={i} className={`rounded-[3px] border px-2 py-1.5 text-[11px] leading-snug ${picks[i] === q.correct ? 'border-[#3f6b3a]/40 bg-[#3f6b3a]/6 text-[#33572f]' : 'border-crimson/35 bg-crimson/6 text-crimson'}`}>
                            <span className="font-semibold">{q.term}</span> — {q.answer}
                          </div>
                        ))}
                      </div>
                      <button className="btn-ghost mt-3 !py-1.5" onClick={() => { setQuestions([]); setPicks({}); setFinished(null); }}>
                        Forge anew
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.section>

          {/* notebook scoring */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card px-5 py-5 md:px-6">
            <div className="flex items-center justify-between">
              <SectionLabel>Notebook sheet scoring</SectionLabel>
              <PenLine size={14} className="text-golddeep" />
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block font-monox text-[8.5px] tracking-[0.2em] text-faint uppercase">Max marks</span>
                <input
                  value={nbMax}
                  onChange={(e) => setNbMax(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                  inputMode="numeric"
                  className="w-20 rounded-[4px] border border-ink/25 bg-paper px-2 py-2 text-center font-monox text-[12px] text-ink"
                />
              </label>
              <button className="btn-seal !py-2" onClick={() => fileRef.current?.click()}>
                <UploadCloud size={12} /> Photograph answer sheet
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) scoreNb(f);
                  e.target.value = '';
                }}
              />
              <span className="font-monox text-[8px] leading-relaxed tracking-[0.14em] text-faint uppercase">
                pixel-hash diagnostics distribute
                <br />
                marks against your constraint
              </span>
            </div>
            <AnimatePresence>
              {nbFrame && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex flex-wrap items-start gap-4">
                  <div className="relative">
                    <img src={nbFrame} alt="notebook script" className="h-36 w-48 rounded-[4px] border border-ink/25 object-cover" />
                    <button onClick={() => { setNbFrame(null); setNbResult(null); }} className="absolute -right-2 -top-2 rounded-full border border-crimson/50 bg-paper p-1 text-crimson" aria-label="Discard frame">
                      <X size={11} />
                    </button>
                  </div>
                  {nbResult && (
                    <div>
                      <div className="font-display text-[38px] font-semibold leading-none text-ink">
                        {nbResult.marks}
                        <span className="font-monox text-[11px] text-faint"> / {nbMax}</span>
                      </div>
                      <div className="mt-1 font-monox text-[10px] tracking-[0.18em] text-golddeep uppercase">{grade((nbResult.marks / nbMax) * 100)}</div>
                      <p className="mt-1.5 max-w-56 font-monox text-[8.5px] leading-relaxed tracking-[0.1em] text-faint uppercase">{nbResult.note}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>

        {/* history dashboard */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card px-5 py-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Progress dashboard</SectionLabel>
            <History size={14} className="text-golddeep" />
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-[4px] border border-gold/30 bg-gold/6 p-3.5">
            <Ring pct={avg} size={72} stroke={6} tone={TONES.gold}>
              <span className="font-display text-[15px] font-semibold text-ink">{Math.round(avg * 100)}%</span>
            </Ring>
            <div>
              <div className="font-display text-[15px] font-semibold text-ink">Lifetime examination average</div>
              <p className="mt-0.5 font-monox text-[8.5px] tracking-[0.16em] text-faint uppercase">
                {study.length} result{study.length === 1 ? '' : 's'} sealed · {study.filter((r) => r.source === 'notebook').length} notebook scans
              </p>
            </div>
          </div>
          <ul className="scrollthin mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {study.length === 0 && (
              <li className="rounded-[4px] border border-dashed border-ink/20 py-8 text-center font-display italic text-faint">
                No examinations sealed yet — forge a suite or scan a notebook.
              </li>
            )}
            {study.map((r) => {
              const pct = r.max > 0 ? r.score / r.max : 0;
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-[4px] border border-ink/12 bg-paper/60 px-3 py-2.5">
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-full border ${r.source === 'mcq' ? 'border-gold/50 bg-gold/10 text-golddeep' : 'border-ink/25 bg-parch/50 text-ink2'}`}>
                    {r.source === 'mcq' ? <BookOpen size={13} /> : <FileImage size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[13px] font-semibold text-ink">{r.title}</div>
                    <div className="font-monox text-[8px] tracking-[0.14em] text-faint uppercase">{ago(r.at)}</div>
                  </div>
                  <span className="font-display text-[16px] font-semibold text-ink">
                    {r.score}
                    <span className="font-monox text-[9px] text-faint">/{r.max}</span>
                  </span>
                  <span className={`w-16 text-right font-monox text-[8.5px] tracking-[0.12em] ${pct >= 0.75 ? 'text-golddeep' : pct >= 0.5 ? 'text-ink2' : 'text-crimson'}`}>
                    {grade(pct * 100)}
                  </span>
                </li>
              );
            })}
          </ul>
        </motion.section>
      </div>
    </div>
  );
}

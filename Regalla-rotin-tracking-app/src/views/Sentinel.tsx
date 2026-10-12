import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eraser, Fingerprint, Lock, ScanSearch, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import { useRegalia } from '../store';
import { CLONE_VECTOR, SAMPLE_PROBES, SECURITY_GRADE } from '../lib/sentinel';
import { EXPORT_MAX_READS, EXPORT_WINDOW_MS } from '../lib/types';
import { SCAN_BUDGET_MS } from '../lib/budget';
import { ago } from '../lib/time';
import { Chip, SectionLabel } from '../components/bits';

export default function Sentinel() {
  const score = useRegalia((s) => s.securityScore);
  const threats = useRegalia((s) => s.threats);
  const probe = useRegalia((s) => s.probe);
  const purgeThreats = useRegalia((s) => s.purgeThreats);
  const exportEvents = useRegalia((s) => s.exportEvents);
  const tampered = useRegalia((s) => s.tampered);

  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | { blocked: boolean; vector?: string; ms?: number }>(null);
  const [pulse, setPulse] = useState(0);

  const grade = SECURITY_GRADE(score);
  const L = Math.PI * 84;
  const toneColor = grade.tone === 'gold' ? '#a8861e' : grade.tone === 'amber' ? '#c07f2a' : '#7e1628';
  const readsInWindow = exportEvents.filter((t) => Date.now() - t < EXPORT_WINDOW_MS).length;
  const cloneIncidents = threats.filter((t) => t.vector === CLONE_VECTOR).length;
  const guardThrottled = readsInWindow >= EXPORT_MAX_READS;

  const runProbe = () => {
    if (!value.trim()) return;
    const r = probe(value);
    setResult(r.blocked ? { blocked: true, vector: r.vector, ms: r.ms } : { blocked: false, ms: r.ms });
    setPulse((p) => p + 1);
    if (!r.blocked) setValue('');
  };

  return (
    <div className="space-y-5">
      {tampered && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2.5 rounded-[5px] border border-crimson/60 bg-crimson/10 px-4 py-3"
        >
          <Fingerprint size={15} className="flex-none text-crimson" />
          <span className="font-monox text-[10px] tracking-[0.2em] text-crimson uppercase">
            Cloned/Tampered System Signature — isolation archive engaged · extraction channels throttled
          </span>
        </motion.div>
      )}

      <div className="rd-grid grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        {/* gauge card */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card ornate flex flex-col items-center px-6 py-7">
          <SectionLabel>Perimeter score</SectionLabel>
          <div className="relative mt-6">
            <svg width="220" height="132" viewBox="0 0 200 120">
              <path d="M16 104 A 84 84 0 0 1 184 104" fill="none" stroke="rgba(42,28,16,0.12)" strokeWidth="10" strokeLinecap="round" />
              <motion.path
                d="M16 104 A 84 84 0 0 1 184 104"
                fill="none"
                stroke={toneColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={L}
                animate={{ strokeDashoffset: L * (1 - score / 100) }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
              {Array.from({ length: 9 }, (_, i) => {
                const a = Math.PI - (i / 8) * Math.PI;
                const x1 = 100 + Math.cos(a) * 72;
                const y1 = 104 - Math.sin(a) * 72;
                const x2 = 100 + Math.cos(a) * 78;
                const y2 = 104 - Math.sin(a) * 78;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(42,28,16,0.3)" strokeWidth="1" />;
              })}
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center">
              <div className="font-display text-[44px] font-semibold leading-none text-ink">{score}</div>
              <div className="mt-1 font-monox text-[9px] tracking-[0.3em] uppercase" style={{ color: toneColor }}>
                {grade.label}
              </div>
            </div>
          </div>
          <div className="mt-7 w-full space-y-2 border-t border-ink/12 pt-4">
            {[
              ['Snapshot input', 'rite enlistment'],
              ['Plan registrar', 'window creation'],
              ['Probe console', 'manual payload tests'],
              ['exportGuard', 'structured read throttle'],
            ].map(([name, sub]) => (
              <div key={name} className="flex items-center gap-2.5 text-[12px] text-ink2">
                <Lock size={11} className="flex-none text-golddeep" />
                <span className="font-semibold">{name}</span>
                <span className="text-faint">· {sub}</span>
                <ShieldCheck size={12} className="ml-auto text-gold" />
              </div>
            ))}
            <p className="pt-2 font-monox text-[8.5px] leading-relaxed tracking-[0.16em] text-faint uppercase">
              Breach −7 · clone pattern −10 · clean probe +1 · lattice v2 local
            </p>
          </div>
        </motion.section>

        <div className="space-y-5">
          {/* probe console */}
          <motion.section
            key={pulse}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className={`card px-6 py-6 ${result?.blocked ? 'alarm !border-crimson/60' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Probe console</SectionLabel>
              <span className="flex items-center gap-2">
                <Chip tone="faint">
                  <Timer size={9} /> ceiling {SCAN_BUDGET_MS}ms
                </Chip>
                <span className="relative h-1 w-16 overflow-hidden rounded-full bg-ink/10">
                  <span className="scanbeam absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-gold to-transparent" />
                </span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runProbe()}
                placeholder="Submit a payload for structural inspection…"
                className="min-w-56 flex-1 rounded-[4px] border border-ink/25 bg-paper px-3 py-2 font-monox text-[12px] text-ink placeholder:text-faint"
              />
              <button className="btn-seal" onClick={runProbe}>
                <ScanSearch size={13} /> Probe
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SAMPLE_PROBES.map((p) => (
                <button
                  key={p}
                  onClick={() => setValue(p)}
                  className="rounded-[3px] border border-dashed border-ink/25 bg-parch/40 px-2 py-1 font-monox text-[9.5px] text-ink2 transition-colors hover:border-crimson/50 hover:text-crimson"
                >
                  {p.length > 34 ? p.slice(0, 34) + '…' : p}
                </button>
              ))}
            </div>
            {result && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 flex flex-wrap items-center gap-2 rounded-[4px] border px-3 py-2 font-monox text-[10px] tracking-[0.14em] uppercase ${
                  result.blocked ? 'border-crimson/50 bg-crimson/8 text-crimson' : 'border-gold/50 bg-gold/8 text-golddeep'
                }`}
              >
                {result.blocked ? (
                  <>
                    <ShieldAlert size={13} /> Payload stripped, isolated & logged · {result.vector} · perimeter −7
                  </>
                ) : (
                  <>
                    <ShieldCheck size={13} /> Payload inert — no structural vectors detected · perimeter +1
                  </>
                )}
                {typeof result.ms === 'number' && <span className="text-faint">· scanned {result.ms}ms / {SCAN_BUDGET_MS}ms</span>}
              </motion.p>
            )}
          </motion.section>

          {/* license & cloning watch */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>License & cloning watch</SectionLabel>
              <Chip tone={guardThrottled ? 'crimson' : 'gold'}>{guardThrottled ? 'throttled' : 'armed'}</Chip>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[4px] border border-ink/12 bg-paper/60 px-3.5 py-3">
                <div className="font-monox text-[8px] tracking-[0.2em] text-faint uppercase">Structured reads</div>
                <div className="mt-1 font-display text-xl font-semibold text-ink">
                  {readsInWindow}
                  <span className="font-monox text-[9px] text-faint"> / {EXPORT_MAX_READS} allowed</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full transition-all ${readsInWindow >= EXPORT_MAX_READS ? 'bg-crimson' : 'bg-gold'}`}
                    style={{ width: `${Math.min(100, (readsInWindow / EXPORT_MAX_READS) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[4px] border border-ink/12 bg-paper/60 px-3.5 py-3">
                <div className="font-monox text-[8px] tracking-[0.2em] text-faint uppercase">Isolation archive</div>
                <div className={`mt-1 font-display text-xl font-semibold ${cloneIncidents > 0 ? 'text-crimson' : 'text-ink'}`}>
                  {cloneIncidents}
                  <span className="font-monox text-[9px] text-faint"> signatures</span>
                </div>
                <p className="mt-1 font-monox text-[8px] tracking-[0.14em] text-faint uppercase">cloned/tampered entries</p>
              </div>
              <div className="rounded-[4px] border border-ink/12 bg-paper/60 px-3.5 py-3">
                <div className="font-monox text-[8px] tracking-[0.2em] text-faint uppercase">License matrix</div>
                <div className="mt-1.5 font-display text-[13px] font-semibold leading-tight text-ink">Proprietary · Closed-Source</div>
                <p className="mt-1 font-monox text-[8px] leading-relaxed tracking-[0.12em] text-faint uppercase">
                  single-file build · duplication prohibited
                </p>
              </div>
            </div>
          </motion.section>

          {/* threat ledger */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Arrested payload ledger</SectionLabel>
              <div className="flex items-center gap-2">
                <Chip tone={threats.length > 0 ? 'crimson' : 'gold'}>{threats.length} held</Chip>
                {threats.length > 0 && (
                  <button className="btn-ghost !py-1" onClick={purgeThreats} title="Soft-delete into Recovery Vault">
                    <Eraser size={11} /> Vault purge
                  </button>
                )}
              </div>
            </div>
            <ul className="scrollthin mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {threats.length === 0 && (
                <li className="rounded-[4px] border border-dashed border-ink/20 py-8 text-center font-display italic text-faint">
                  No arrested payloads — the lattice rests.
                </li>
              )}
              {threats.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-[4px] border border-crimson/25 bg-crimson/4 px-3 py-2.5">
                  <ShieldAlert size={12} className="flex-none text-crimson" />
                  <Chip tone="crimson">{t.vector}</Chip>
                  <span className="font-monox text-[9px] tracking-[0.12em] text-faint uppercase">{t.source}</span>
                  <span className="w-full truncate font-monox text-[10.5px] text-ink2 sm:w-auto sm:flex-1">“{t.snippet}”</span>
                  <span className="ml-auto font-monox text-[8.5px] tracking-[0.12em] text-faint">{ago(t.at)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-monox text-[8.5px] leading-relaxed tracking-[0.16em] text-faint uppercase">
              Vectors under watch: script elements · event handlers · js uri · structural embeds · eval · data uri · clone signatures
            </p>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

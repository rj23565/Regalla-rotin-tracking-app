import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArchiveRestore,
  Database,
  Download,
  Eye,
  EyeOff,
  Info,
  Languages,
  RefreshCcw,
  Repeat2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import { useRegalia } from '../store';
import { EXPORT_MAX_READS, EXPORT_WINDOW_MS } from '../lib/types';
import type { TrashKind } from '../lib/types';
import { LANGS, speak } from '../lib/voice';
import { SectionLabel } from '../components/bits';
import type { LangCode } from '../lib/types';

const LANG_ORDER: LangCode[] = ['en', 'ur', 'hi', 'ar', 'es', 'fr'];
const STOPS = [1, 0.85, 0.7];

const KIND_META: Record<TrashKind, { label: string; cls: string }> = {
  rite: { label: 'RITE', cls: 'border-gold/50 text-golddeep bg-gold/10' },
  note: { label: 'NOTE', cls: 'border-ink/25 text-ink2 bg-parch/50' },
  payload: { label: 'PAYLOAD', cls: 'border-crimson/45 text-crimson bg-crimson/5' },
  meal: { label: 'MEAL', cls: 'border-[#3f6b3a]/45 text-[#3f6b3a] bg-[#3f6b3a]/8' },
};

export default function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useRegalia((s) => s.settings);
  const setLanguage = useRegalia((s) => s.setLanguage);
  const setDiscreet = useRegalia((s) => s.setDiscreet);
  const setVoiceAssist = useRegalia((s) => s.setVoiceAssist);
  const setTheme = useRegalia((s) => s.setTheme);
  const theme = useRegalia((s) => s.settings.theme ?? 'light');
  const registerUtterance = useRegalia((s) => s.registerUtterance);
  const registerRepeat = useRegalia((s) => s.registerRepeat);
  const lastPhrase = useRegalia((s) => s.lastPhrase);
  const voiceRepeats = useRegalia((s) => s.voiceRepeats);
  const exportJSON = useRegalia((s) => s.exportJSON);
  const exportEvents = useRegalia((s) => s.exportEvents);
  const trash = useRegalia((s) => s.trash);
  const restoreTrash = useRegalia((s) => s.restoreTrash);
  const destroyTrash = useRegalia((s) => s.destroyTrash);
  const reseed = useRegalia((s) => s.reseed);
  const wipe = useRegalia((s) => s.wipe);

  const [confirmReseed, setConfirmReseed] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const audition = () => {
    const sample = LANGS[settings.language].sample;
    registerUtterance(sample);
    speak(sample, settings.language, settings.voiceRate);
  };

  const repeat = () => {
    const rate = registerRepeat();
    speak(lastPhrase || LANGS[settings.language].sample, settings.language, rate);
  };

  const readsInWindow = exportEvents.filter((t) => Date.now() - t < EXPORT_WINDOW_MS).length;

  const download = () => {
    const json = exportJSON();
    if (json === null) {
      setExportMsg('exportGuard throttled — too many reads');
      setTimeout(() => setExportMsg(null), 4600);
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regalia_v2_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Structured cache exported with license banner');
    setTimeout(() => setExportMsg(null), 3600);
  };

  const rateFill = (settings.voiceRate - 0.7) / 0.3;
  const daysLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-coal/45 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Engine Room settings"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="fixed right-0 top-0 z-[90] flex h-full w-[min(430px,94vw)] flex-col border-l border-gold/40 bg-paper shadow-[-24px_0_60px_-30px_rgba(28,17,9,0.7)]"
          >
            <div className="flex items-center justify-between border-b border-ink/12 px-6 py-5">
              <div>
                <p className="font-monox text-[9px] tracking-[0.28em] text-faint uppercase">Configuration</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-ink">Engine Room</h3>
              </div>
              <button onClick={onClose} className="rounded-full border border-ink/20 p-1.5 text-ink2 transition-colors hover:border-crimson hover:text-crimson" aria-label="Close settings">
                <X size={14} />
              </button>
            </div>

            <div className="scrollthin flex-1 space-y-7 overflow-y-auto px-6 py-6">
              {/* voice guidance */}
              <section>
                <SectionLabel>Voice guidance</SectionLabel>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {LANG_ORDER.map((code) => (
                    <button
                      key={code}
                      onClick={() => setLanguage(code)}
                      className={`flex items-center gap-2 rounded-[4px] border px-3 py-2 text-left transition-colors ${
                        settings.language === code ? 'border-gold bg-gold/10' : 'border-ink/15 bg-paper/60 hover:border-gold/50'
                      }`}
                    >
                      <Languages size={12} className={settings.language === code ? 'text-golddeep' : 'text-faint'} />
                      <span className="font-display text-[13.5px] text-ink">{LANGS[code].name}</span>
                      <span className="ml-auto text-[11px] text-ink2/70">{LANGS[code].native}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-[4px] border border-ink/12 bg-parch/30 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-monox text-[9px] tracking-[0.22em] text-faint uppercase">Cadence</span>
                    <span className={`font-monox text-[11px] font-bold ${settings.voiceRate < 1 ? 'text-crimson' : 'text-golddeep'}`}>
                      {settings.voiceRate.toFixed(2)}×
                    </span>
                  </div>
                  <div className="relative mt-2.5 h-1.5 rounded-full bg-ink/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-crimson via-gold to-gold2 transition-all duration-500"
                      style={{ width: `${rateFill * 100}%` }}
                    />
                    {STOPS.map((s) => (
                      <span key={s} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/30" style={{ left: `${((s - 0.7) / 0.3) * 100}%` }} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between font-monox text-[8px] tracking-[0.14em] text-faint uppercase">
                    <span>1.00×</span>
                    <span>floor 0.70×</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="btn-seal !py-1.5" onClick={audition}>
                      <Volume2 size={12} /> Audition
                    </button>
                    <button className="btn-ghost !py-1.5" onClick={repeat} title="Rapid repeats step cadence down by 0.15×">
                      <Repeat2 size={12} /> Repeat
                    </button>
                    <span className="ml-auto font-monox text-[8.5px] tracking-[0.14em] text-faint uppercase">rapid repeats: {voiceRepeats}</span>
                  </div>
                  <p className="mt-2.5 text-[11px] leading-snug text-ink2/80">
                    Rapid “Repeat” triggers are read as cognitive strain — cadence eases 0.15× per step to 0.70× and a
                    comforting announcement arrives in your guidance tongue.
                  </p>
                </div>

                <button
                  onClick={() => setVoiceAssist(!settings.voiceAssist)}
                  className="mt-3 flex w-full items-center gap-3 rounded-[4px] border border-ink/15 bg-paper/60 px-4 py-3 text-left transition-colors hover:border-gold/60"
                >
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-[4px] border ${settings.voiceAssist ? 'border-gold/60 bg-gold/10 text-golddeep' : 'border-ink/20 text-faint'}`}>
                    <Volume2 size={15} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-[14px] font-semibold text-ink">Accessibility flow</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink2/80">
                      {settings.voiceAssist
                        ? 'Reader matrix active — clean flow order, isolated modals, vocal-optimized density.'
                        : 'Voice Guidance off — standard visual densities engaged.'}
                  </span>
                  </span>
                  <span className={`relative h-5 w-9 flex-none rounded-full border transition-colors ${settings.voiceAssist ? 'border-gold bg-gold/30' : 'border-ink/25 bg-ink/10'}`}>
                    <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${settings.voiceAssist ? 'left-[18px] bg-golddeep' : 'left-[3px] bg-faint'}`} />
                  </span>
                </button>
              </section>

              {/* theme */}
              <section>
                <SectionLabel>Sovereign theme</SectionLabel>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {([
                    ['light', 'Gradient Light', 'Royal off-white & cream', 'linear-gradient(135deg,#FDFBF7,#F6F1E7)', '#2A1810'],
                    ['obsidian', 'Obsidian Dark', 'Velvet black & radiant gold', 'linear-gradient(135deg,#14090C,#0D0407)', '#E8D79A'],
                  ] as const).map(([id, label, sub, bg, fg]) => (
                    <button
                      key={id}
                      onClick={() => setTheme(id)}
                      className={`rounded-[5px] border-2 p-3 text-left transition-all ${theme === id ? 'border-gold ring-2 ring-gold/40' : 'border-line hover:border-gold/60'}`}
                      style={{ background: bg }}
                    >
                      <span className="block font-display text-[14px] font-bold" style={{ color: fg }}>{label}</span>
                      <span className="mt-0.5 block font-monox text-[8.5px] font-bold tracking-[0.12em] uppercase" style={{ color: id === 'light' ? '#7a6752' : '#a89372' }}>
                        {sub}
                      </span>
                      <span className="mt-2 flex gap-1">
                        {['#7E1628', '#A8861E', id === 'light' ? '#E4DACA' : '#4A3320'].map((c) => (
                          <span key={c} className="h-3 w-6 rounded-[2px]" style={{ background: c }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* presence */}
              <section>
                <SectionLabel>Presence</SectionLabel>
                <button
                  onClick={() => setDiscreet(!settings.discreet)}
                  className="mt-4 flex w-full items-center gap-3 rounded-[4px] border border-ink/15 bg-paper/60 px-4 py-3.5 text-left transition-colors hover:border-gold/60"
                >
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-[4px] border ${settings.discreet ? 'border-gold/60 bg-gold/10 text-golddeep' : 'border-ink/20 text-faint'}`}>
                    {settings.discreet ? <EyeOff size={15} /> : <Eye size={15} />}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-[14.5px] font-semibold text-ink">Discreet branding</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2/80">
                      {settings.discreet
                        ? 'Active — all engine references resolve to the moniker “Regalia Engine”.'
                        : 'Off — full regalia marks and titles on display.'}
                    </span>
                  </span>
                  <span className={`relative h-5 w-9 flex-none rounded-full border transition-colors ${settings.discreet ? 'border-gold bg-gold/30' : 'border-ink/25 bg-ink/10'}`}>
                    <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${settings.discreet ? 'left-[18px] bg-golddeep' : 'left-[3px] bg-faint'}`} />
                  </span>
                </button>
              </section>

              {/* recovery vault */}
              <section>
                <SectionLabel>Recovery vault · 30-day sandbox</SectionLabel>
                <ul className="mt-4 space-y-2">
                  {trash.length === 0 && (
                    <li className="rounded-[4px] border border-dashed border-ink/20 py-6 text-center font-display italic text-faint">
                      The vault is empty — nothing awaits recovery.
                    </li>
                  )}
                  {trash.map((t) => {
                    const left = daysLeft(t.expiresAt);
                    const meta = KIND_META[t.kind];
                    return (
                      <li key={t.id} className="flex items-center gap-2.5 rounded-[4px] border border-ink/12 bg-paper/60 px-3 py-2.5">
                        <span className={`flex-none rounded-[3px] border px-1.5 py-0.5 font-monox text-[8px] tracking-[0.16em] ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink2">{t.label}</span>
                        <span className={`flex-none rounded-[3px] border px-1.5 py-0.5 font-monox text-[8.5px] tracking-[0.12em] ${left <= 5 ? 'border-crimson/50 text-crimson' : 'border-ink/20 text-faint'}`}>
                          {left}d
                        </span>
                        <button
                          onClick={() => restoreTrash(t.id)}
                          title="Restore"
                          className="flex-none rounded-[3px] border border-ink/20 p-1 text-ink2 transition-colors hover:border-gold hover:text-golddeep"
                        >
                          <Undo2 size={11} />
                        </button>
                        <button
                          onClick={() => (confirmDestroy === t.id ? (destroyTrash(t.id), setConfirmDestroy(null)) : setConfirmDestroy(t.id))}
                          title={confirmDestroy === t.id ? 'Confirm destruction' : 'Destroy permanently'}
                          className={`flex-none rounded-[3px] border p-1 transition-colors ${confirmDestroy === t.id ? 'border-crimson bg-crimson text-[#f2dda0]' : 'border-crimson/35 text-crimson hover:bg-crimson/8'}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2.5 flex items-start gap-2 text-[11px] leading-snug text-ink2/70">
                  <ArchiveRestore size={12} className="mt-0.5 flex-none text-golddeep" />
                  Deleted rites, notes and payloads rest here for 30 days with countdown badges. Nothing is destroyed
                  on the first pass — the vault sweeps itself only after expiry.
                </p>
              </section>

              {/* data residency */}
              <section>
                <SectionLabel>Data residency & license</SectionLabel>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center gap-2.5 rounded-[4px] border border-ink/12 bg-parch/30 px-3.5 py-2.5">
                    <Database size={13} className="flex-none text-golddeep" />
                    <span className="font-monox text-[10.5px] text-ink2">
                      localStorage key · <span className="font-bold text-crimson">regalia_v2</span>
                    </span>
                    <span className="ml-auto font-monox text-[8.5px] tracking-[0.16em] text-faint uppercase">zero server state</span>
                  </div>
                  <button onClick={download} className="btn-ghost w-full justify-center !py-2.5">
                    <Download size={12} /> Export encrypted arrays as JSON
                  </button>
                  <div className="flex items-center justify-between rounded-[4px] border border-ink/12 px-3 py-2">
                    <span className="flex items-center gap-2 font-monox text-[8.5px] tracking-[0.16em] text-faint uppercase">
                      {exportMsg ? (
                        <span className={exportMsg.startsWith('exportGuard') ? 'text-crimson' : 'text-golddeep'}>{exportMsg}</span>
                      ) : (
                        <>exportGuard armed · {readsInWindow}/{EXPORT_MAX_READS} reads this window</>
                      )}
                    </span>
                    {readsInWindow >= EXPORT_MAX_READS ? <ShieldAlert size={12} className="text-crimson" /> : <ShieldCheck size={12} className="text-gold" />}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => (confirmReseed ? (reseed(), setConfirmReseed(false)) : setConfirmReseed(true))}
                      className={`btn-ghost justify-center !py-2.5 ${confirmReseed ? '!border-gold !text-golddeep' : ''}`}
                    >
                      <RefreshCcw size={12} /> {confirmReseed ? 'Confirm reseed' : 'Reseed demo'}
                    </button>
                    <button
                      onClick={() => (confirmWipe ? wipe() : setConfirmWipe(true))}
                      className={`inline-flex items-center justify-center gap-2 rounded-[4px] border px-3 py-2.5 font-monox text-[10px] uppercase tracking-[0.18em] transition-colors ${
                        confirmWipe ? 'border-crimson bg-crimson text-[#f2dda0]' : 'border-crimson/40 text-crimson hover:bg-crimson/5'
                      }`}
                    >
                      <Trash2 size={12} /> {confirmWipe ? 'Burn it all' : 'Wipe slate'}
                    </button>
                  </div>
                  <p className="flex items-start gap-2 text-[11px] leading-snug text-ink2/70">
                    <Info size={12} className="mt-0.5 flex-none text-faint" />
                    Closed-source single-file architecture under the Regalia Global License Matrix. Mass structured
                    reads trip the Cloned/Tampered System Signature isolation archive.
                  </p>
                </div>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

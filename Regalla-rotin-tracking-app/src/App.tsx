import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  CalendarRange,
  Clock3,
  Dumbbell,
  Fingerprint,
  GraduationCap,
  LayoutGrid,
  ScanLine,
  Settings2,
  ShieldCheck,
  UtensilsCrossed,
  Volume2,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useActivePlan, useRegalia, engineMoniker, useActiveAccount } from './store';
import { dayCompletion, elapsedDays, perfectStreak } from './lib/analytics';
import { todayISO } from './lib/time';
import { primeVoices, speak } from './lib/voice';
import { useDevice } from './lib/device';
import { dd } from './lib/budget';
import { Crest, Wordmark } from './components/Brand';
import Toasts from './components/Toasts';
import Command from './views/Command';
import Timeline from './views/Timeline';
import DayStacks from './views/DayStacks';
import BodyForge from './views/BodyForge';
import DietLab from './views/DietLab';
import Sentinel from './views/Sentinel';
import SettingsDrawer from './views/SettingsDrawer';
import AuthDrawer from './views/AuthDrawer';
import AuthGate from './views/AuthGate';
import AdminPanel from './views/AdminPanel';
import StudyLab from './views/StudyLab';
import ScanLab from './views/ScanLab';
import OmniConsole from './components/OmniConsole';
import { t, isRTL } from './lib/i18n';

type ViewId = 'command' | 'timeline' | 'stacks' | 'forge' | 'diet' | 'scan' | 'study' | 'sentinel';

const NAV: Array<{ id: ViewId; Icon: LucideIcon }> = [
  { id: 'command', Icon: LayoutGrid },
  { id: 'timeline', Icon: Clock3 },
  { id: 'stacks', Icon: CalendarRange },
  { id: 'forge', Icon: Dumbbell },
  { id: 'diet', Icon: UtensilsCrossed },
  { id: 'scan', Icon: ScanLine },
  { id: 'study', Icon: GraduationCap },
  { id: 'sentinel', Icon: ShieldCheck },
];

const VIEW_IDS: ViewId[] = ['command', 'timeline', 'stacks', 'forge', 'diet', 'scan', 'study', 'sentinel'];

const fromHash = (): ViewId => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (VIEW_IDS as string[]).includes(h) ? (h as ViewId) : 'command';
};

export default function App() {
  const [view, setViewRaw] = useState<ViewId>(() => fromHash());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [boot, setBoot] = useState(true);
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const account = useActiveAccount();

  // Serverless navigation — all route switches run through local hash hooks.
  const setView = (v: ViewId) => {
    if (v !== view) window.location.hash = `/${v}`;
  };
  useEffect(() => {
    const onHash = () => setViewRaw(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useActivePlan();
  const habits = useRegalia((s) => s.habits);
  const logs = useRegalia((s) => s.logs);
  const notes = useRegalia((s) => s.notes);
  const settings = useRegalia((s) => s.settings);
  const score = useRegalia((s) => s.securityScore);
  const celebrated = useRegalia((s) => s.celebrated);
  const celebrate = useRegalia((s) => s.celebrate);
  const sweepTrash = useRegalia((s) => s.sweepTrash);
  const registerUtterance = useRegalia((s) => s.registerUtterance);
  const briefFor = useRegalia((s) => s.briefFor);

  const device = useDevice(settings.voiceAssist);

  useEffect(() => {
    primeVoices();
    sweepTrash(); // vault expiry sweep at boot
    useRegalia.getState().integritySweep(); // rolling integrity snapshot — silent auto-repair
    useRegalia.getState().pruneLimited(); // limited-tier retention automation
    const t = setTimeout(() => setBoot(false), 1350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vocal bridge — speak focused controls aloud when Voice Guidance is armed
  useEffect(() => {
    if (!settings.voiceAssist) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const say = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (say) speak(say, settings.language, settings.voiceRate);
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, [settings.voiceAssist, settings.language, settings.voiceRate]);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Dual-theme engine — swaps the entire token layer at the document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme ?? 'light');
  }, [settings.theme]);

  // Low-network resilience — the runtime never leaves local pipeline mode
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Screen-reader flow: mirror engine notes into the isolated live region
  // through the ddCache — zero-latency, no render-loop dependency.
  useEffect(() => {
    const head = notes[0];
    if (head && settings.voiceAssist) {
      const el = dd('regalia-announcer');
      if (el) el.textContent = `${head.title}. ${head.body ?? ''}`;
    }
  }, [notes, settings.voiceAssist]);

  const streak = perfectStreak(plan, habits, logs);
  const today = todayISO();
  const todayC = dayCompletion(plan, habits, logs, today);
  const dayIdx = Math.max(1, Math.min(elapsedDays(plan), plan.duration));

  // Multi-streak verification → escalate confirmation at 7-day milestones
  useEffect(() => {
    if (streak >= 7 && streak % 7 === 0 && !celebrated.includes(streak)) {
      celebrate(streak);
      confetti({
        particleCount: 130,
        spread: 78,
        startVelocity: 34,
        origin: { y: 0.65 },
        colors: ['#a8861e', '#d9c47f', '#7e1628', '#f6f1e7'],
      });
    }
  }, [streak, celebrated, celebrate]);

  const speakBrief = () => {
    const text = briefFor({ done: todayC.done, total: todayC.total, streak, dayIndex: dayIdx, duration: plan.duration });
    registerUtterance(text);
    speak(text, settings.language, settings.voiceRate);
  };

  const moniker = engineMoniker(settings.discreet);
  const reader = device.profile === 'reader';

  const admin = useRegalia((s) => s.admin);

  // ── MANDATORY ACCOUNT BLOCKADE ──
  // Session state evaluates to null (guest residency) → the interface is held
  // behind the auth gate; no metrics, targets or dashboards may be generated.
  if (!account && !admin) {
    return (
      <div className="min-h-screen" data-reader={reader} dir={isRTL(settings.language) ? 'rtl' : undefined}>
        <div id="regalia-announcer" aria-live="polite" role="status" className="srx" />
        <AuthGate />
        <Toasts />
      </div>
    );
  }

  // ── ADMINISTRATIVE ELEVATION ──
  // A bypass-key session overrides user-tier blockades and renders the
  // comprehensive control panel instead of the standard workspace.
  if (admin) {
    return (
      <div className="min-h-screen" data-reader={reader}>
        <div id="regalia-announcer" aria-live="polite" role="status" className="srx" />
        <AdminPanel />
        <Toasts />
      </div>
    );
  }

  const lang = settings.language;
  const say = (key: string) => t(lang, key);

  return (
    <div className="flex min-h-screen" data-reader={reader} dir={isRTL(lang) ? 'rtl' : undefined}>
      <div id="regalia-announcer" aria-live="polite" role="status" className="srx" />

      {/* ── boot veil ── */}
      <AnimatePresence>
        {boot && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 z-[100] grid place-items-center bg-coal"
          >
            <div className="text-center">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                <Crest size={84} discreet={settings.discreet} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6 }}
                className="mt-5 font-display text-3xl font-semibold tracking-[0.42em] text-[#f3ead8]"
              >
                REGALIA
              </motion.div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto mt-4 h-px w-40 origin-center bg-gradient-to-r from-transparent via-gold to-transparent"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-3 font-monox text-[9px] tracking-[0.34em] text-[#b89a68] uppercase"
              >
                local runtime · residency regalia_v2
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── rail: full on desktop matrix, icon strip on tablet matrix ── */}
      <aside className="sticky top-0 hidden h-screen w-16 flex-none flex-col border-r border-gold/25 bg-[linear-gradient(175deg,#251708,#1c1109)] md:flex lg:w-56">
        <div className="flex items-center gap-3 px-3 pb-6 pt-6 lg:px-5">
          <Crest size={device.profile === 'tablet' ? 38 : 42} discreet={settings.discreet} />
          <span className="hidden lg:block">
            <Wordmark discreet={settings.discreet} />
          </span>
        </div>
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent lg:mx-5" />
        <nav className="mt-4 flex-1 space-y-1 px-2 lg:px-3">
          {NAV.map(({ id, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                title={say(`nav_${id}`)}
                aria-label={say(`nav_${id}`)}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex w-full items-center justify-center gap-3 rounded-[4px] px-3 py-2.5 transition-colors lg:justify-start ${
                  active ? 'bg-crimson/25' : 'hover:bg-white/[0.045]'
                }`}
              >
                <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all ${active ? 'bg-gold' : 'bg-transparent'}`} />
                <Icon size={15} className={active ? 'text-gold2' : 'text-[#9b8262] transition-colors group-hover:text-gold2'} />
                <span className={`hidden font-monox text-[10.5px] tracking-[0.24em] uppercase lg:inline ${active ? 'text-[#f3ead8]' : 'text-[#b8a98e]'}`}>
                  {say(`nav_${id}`)}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="px-2 pb-5 lg:px-4">
          <button
            onClick={() => setView('sentinel')}
            title="Perimeter score"
            className="flex w-full items-center justify-center gap-2.5 rounded-[4px] border border-gold/25 bg-black/20 px-3 py-2.5 transition-colors hover:border-gold/50 lg:justify-start"
          >
            <ShieldCheck size={14} className={score >= 70 ? 'text-gold2' : 'text-[#ff9aa8]'} />
            <span className="hidden font-monox text-[9px] tracking-[0.22em] text-[#b8a98e] uppercase lg:inline">Perimeter</span>
            <span className={`font-display text-[15px] font-semibold lg:ml-auto ${score >= 70 ? 'text-gold2' : 'text-[#ff9aa8]'}`}>{score}</span>
          </button>
          <p className="mt-3 hidden px-1 text-center font-monox text-[7.5px] tracking-[0.26em] text-[#7d6547] uppercase lg:block">{moniker}</p>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gold/30 px-4 py-5 md:px-8">
          <div>
            <h1 className="font-display text-[27px] font-semibold leading-none tracking-tight text-ink md:text-[31px]">
              {say(`title_${view}`)}
            </h1>
            <p className="mt-1.5 font-monox text-[9px] tracking-[0.3em] text-faint uppercase">{say(`sub_${view}`)}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {!online && (
              <span className="flex items-center gap-1.5 rounded-[4px] border border-crimson/50 bg-crimson/8 px-2.5 py-1.5 font-monox text-[9px] tracking-[0.18em] text-crimson uppercase">
                <WifiOff size={11} /> offline · local pipeline
              </span>
            )}
            <button
              onClick={() => setAuthOpen(true)}
              title="Sovereign registry"
              className="flex items-center gap-1.5 rounded-[4px] border border-ink/20 bg-paper/70 px-2.5 py-1.5 font-monox text-[10px] tracking-[0.14em] text-ink2 transition-colors hover:border-gold hover:text-golddeep"
            >
              <Fingerprint size={12} className={account ? 'text-golddeep' : 'text-faint'} />
              <span className="hidden sm:inline">{account ? account.username : 'GUEST'}</span>
            </button>
            <span
              className="hidden rounded-[4px] border border-gold/40 bg-gold/8 px-2.5 py-1.5 font-monox text-[9px] tracking-[0.2em] text-golddeep uppercase xl:inline-block"
              title="Device sensor matrix"
            >
              {device.profile} · {device.w}×{device.h}
              {device.touch ? ' · touch' : ''}
            </span>
            <span className="hidden rounded-[4px] border border-ink/20 bg-paper/70 px-2.5 py-1.5 font-monox text-[10px] tracking-[0.18em] text-ink2 sm:inline-block">
              DAY {dayIdx} · {plan.duration}D
            </span>
            <span className="rounded-[4px] border border-ink/20 bg-paper/70 px-2.5 py-1.5 font-monox text-[10px] tabular-nums tracking-[0.14em] text-ink2">
              {now.toLocaleTimeString('en-GB')}
            </span>
            <button onClick={speakBrief} title="Voice briefing" className="btn-ghost !px-2.5 !py-2">
              <Volume2 size={14} />
            </button>
            <button onClick={() => setSettingsOpen(true)} title="Engine room" className="btn-seal !px-2.5 !py-2">
              <Settings2 size={14} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 md:px-8 md:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === 'command' && <Command />}
              {view === 'timeline' && <Timeline />}
              {view === 'stacks' && <DayStacks />}
              {view === 'forge' && <BodyForge />}
              {view === 'diet' && <DietLab />}
              {view === 'scan' && <ScanLab />}
              {view === 'study' && <StudyLab />}
              {view === 'sentinel' && <Sentinel />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── mobile dock (finger-accessible bottom navigation) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-gold/30 bg-coal/95 px-2 py-2 backdrop-blur md:hidden" aria-label="Primary">
        {NAV.map(({ id, Icon }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id)} className="flex flex-col items-center gap-1 px-2 py-1" aria-label={say(`nav_${id}`)} aria-current={active ? 'page' : undefined}>
              <Icon size={17} className={active ? 'text-gold2' : 'text-[#9b8262]'} />
              <span className={`font-monox text-[7px] tracking-[0.18em] uppercase ${active ? 'text-gold2' : 'text-[#7d6547]'}`}>{say(`nav_${id}`)}</span>
            </button>
          );
        })}
      </nav>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AuthDrawer open={authOpen} onClose={() => setAuthOpen(false)} />
      <OmniConsole onNavigate={(v) => setView(v as ViewId)} />
      <Toasts />
    </div>
  );
}

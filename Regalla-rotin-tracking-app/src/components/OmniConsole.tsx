import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CornerDownLeft, Sparkles, X } from 'lucide-react';
import { useRegalia } from '../store';
import { runDirective } from '../lib/agent';
import { dayCompletion, elapsedDays, perfectStreak } from '../lib/analytics';
import { todayISO } from '../lib/time';
import { budgetedScanPayload } from '../lib/sentinel';
import { speak } from '../lib/voice';

interface Line {
  who: 'you' | 'omni';
  text: string;
}

const HINTS = ['seal strength training', 'add rite Quran study evening study', 'log meal chicken rice 520', 'seal all', 'open diet lab', 'read the day'];

export default function OmniConsole({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { who: 'omni', text: 'Omni-agent online. Direct me across routine, diet, fitness, projects and study — in plain words.' },
  ]);
  const [draft, setDraft] = useState('');
  const engine = useRegalia((s) => (s.settings.discreet ? 'Regalia Engine' : 'Regalia Intelligence'));

  const dispatch = (raw: string) => {
    const s = useRegalia.getState();
    const scan = budgetedScanPayload(raw);
    const stamped: Line[] = [{ who: 'you', text: raw.slice(0, 120) }];
    if (!scan.clean) {
      stamped.push({ who: 'omni', text: `Sentinel arrested that string — ${scan.vector}. The console stays sealed.` });
      setLines((l) => [...l, ...stamped].slice(-8));
      s.pushNote('threat', 'Payload breach arrested', `${scan.vector} — stripped at omni console.`);
      useRegalia.setState((st) => ({
        securityScore: Math.max(0, st.securityScore - 7),
        threats: [{ id: `th_${Date.now().toString(36)}`, at: Date.now(), vector: scan.vector ?? 'UNKNOWN', snippet: scan.sanitized.slice(0, 96) || 'empty husk', source: 'Omni console' }, ...st.threats].slice(0, 40),
      }));
      return;
    }
    const out = runDirective(s, scan.sanitized);
    let text = out.reply;
    if (text === '__BRIEF__') {
      const plan = s.plans.find((p) => p.id === s.activePlanId) ?? s.plans[0];
      const tc = dayCompletion(plan, s.habits, s.logs, todayISO());
      const brief = s.briefFor({
        done: tc.done,
        total: tc.total,
        streak: perfectStreak(plan, s.habits, s.logs),
        dayIndex: Math.max(1, Math.min(elapsedDays(plan), plan.duration)),
        duration: plan.duration,
      });
      s.registerUtterance(brief);
      speak(brief, s.settings.language, s.settings.voiceRate);
      text = brief;
    } else if (s.settings.voiceAssist) {
      speak(text, s.settings.language, s.settings.voiceRate);
    }
    stamped.push({ who: 'omni', text });
    setLines((l) => [...l, ...stamped].slice(-8));
    if (out.nav) onNavigate(out.nav);
    setDraft('');
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close omni-agent console' : 'Open omni-agent console'}
        className="fixed bottom-20 left-4 z-[75] grid h-12 w-12 place-items-center rounded-full border border-gold2/70 bg-[radial-gradient(130%_150%_at_30%_25%,#93203a,#7e1628_55%,#5c0f1d)] text-gold2 shadow-[0_16px_34px_-12px_rgba(92,15,29,0.9)] transition-transform hover:scale-105 md:bottom-6"
      >
        <Bot size={20} />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-gold text-coal">
          <Sparkles size={9} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Omni-agent console"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed bottom-[136px] left-4 z-[75] flex w-[min(392px,92vw)] flex-col overflow-hidden rounded-[6px] border border-gold/50 bg-coal shadow-[0_36px_80px_-28px_rgba(28,17,9,0.9)] md:bottom-[84px]"
          >
            <div className="flex items-center justify-between border-b border-gold/25 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-gold/50 bg-crimson/40 text-gold2">
                  <Bot size={14} />
                </span>
                <div>
                  <div className="font-display text-[13.5px] font-semibold text-[#f6f1e7]">Omni-Agent</div>
                  <div className="font-monox text-[7.5px] tracking-[0.22em] text-[#9b8262] uppercase">{engine} · master workspace manager</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-gold/30 p-1 text-[#9b8262] transition-colors hover:text-gold2" aria-label="Close console">
                <X size={12} />
              </button>
            </div>

            <ul className="scrollthin max-h-64 space-y-2.5 overflow-y-auto px-4 py-3.5">
              {lines.map((l, i) => (
                <li key={i} className={`flex ${l.who === 'you' ? 'justify-end' : 'justify-start'}`}>
                  <span
                    className={`max-w-[85%] rounded-[5px] px-3 py-2 text-[12px] leading-snug ${
                      l.who === 'you'
                        ? 'border border-gold/40 bg-gold/15 text-[#f3e8cf]'
                        : 'border border-ink/40 bg-paper/10 text-[#d8c8a8]'
                    }`}
                  >
                    {l.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-1.5 border-t border-gold/20 bg-black/20 px-3 py-2">
              {HINTS.slice(lines.length > 1 ? 3 : 0, lines.length > 1 ? 6 : 3).map((h) => (
                <button key={h} onClick={() => dispatch(h)} className="rounded-[3px] border border-dashed border-[#9b8262]/50 px-2 py-1 font-monox text-[8.5px] text-[#b8a98e] transition-colors hover:border-gold/60 hover:text-gold2">
                  {h}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) dispatch(draft);
              }}
              className="flex items-center gap-2 border-t border-gold/25 px-3 py-2.5"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Direct the workspace…"
                aria-label="Omni directive"
                className="min-w-0 flex-1 rounded-[4px] border border-gold/30 bg-black/30 px-3 py-2 font-monox text-[11.5px] text-[#f3e8cf] placeholder:text-[#7d6547]"
              />
              <button type="submit" className="btn-seal !px-3 !py-2" aria-label="Execute directive">
                <CornerDownLeft size={13} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

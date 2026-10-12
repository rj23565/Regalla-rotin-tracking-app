import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Flame, Info, ShieldAlert } from 'lucide-react';
import { useRegalia } from '../store';
import type { NoteItem } from '../lib/types';

const ICONS = {
  milestone: { Icon: Flame, cls: 'text-gold2 border-gold/60' },
  threat: { Icon: ShieldAlert, cls: 'text-[#ff9aa8] border-crimson/70' },
  voice: { Icon: AudioLines, cls: 'text-gold2 border-gold/50' },
  system: { Icon: Info, cls: 'text-[#d8c8a8] border-[#8a7358]/60' },
} as const;

export default function Toasts() {
  const notes = useRegalia((s) => s.notes);
  const [toasts, setToasts] = useState<NoteItem[]>([]);
  const lastId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const head = notes[0];
    if (head && head.id !== lastId.current) {
      lastId.current = head.id;
      setToasts((t) => [head, ...t].slice(0, 3));
      const timer = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== head.id)), 5600);
      return () => clearTimeout(timer);
    }
  }, [notes]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-5 right-4 z-[70] flex w-[min(360px,92vw)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((n) => {
          const { Icon, cls } = ICONS[n.kind];
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="flex items-start gap-3 rounded-md border border-gold/35 bg-coal px-3.5 py-3 shadow-[0_18px_40px_-16px_rgba(28,17,9,0.8)]"
            >
              <span className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full border ${cls}`}>
                <Icon size={13} className={n.kind === 'milestone' ? 'flame-flicker' : ''} />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[13.5px] font-semibold text-[#f3ead8]">{n.title}</div>
                {n.body && <div className="mt-0.5 text-[11.5px] leading-snug text-[#b8a98e]">{n.body}</div>}
              </div>
              <button
                onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}
                className="ml-auto mt-0.5 text-[#8a7358] transition-colors hover:text-gold2"
                aria-label="Dismiss"
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

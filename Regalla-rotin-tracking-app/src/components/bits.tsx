import type { ReactNode } from 'react';

export const TONES = {
  gold: '#a8861e',
  gold2: '#d9c47f',
  crimson: '#7e1628',
  ink: '#2a1810',
  faint: '#7a6752',
  green: '#3f6b3a',
} as const;

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="label-rule">{children}</div>;
}

export function Ring({
  pct,
  size = 92,
  stroke = 7,
  tone = TONES.gold,
  track = 'rgba(42,28,16,0.12)',
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  tone?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Tick({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`tick ${on ? 'on' : ''} ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5 L6.5 12 L13 4.5" stroke="#f2dda0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function Chip({ tone = 'ink', children }: { tone?: 'ink' | 'gold' | 'crimson' | 'faint'; children: ReactNode }) {
  const map: Record<string, string> = {
    ink: 'border-ink/30 text-ink2',
    gold: 'border-gold/50 text-golddeep bg-gold/10',
    crimson: 'border-crimson/45 text-crimson bg-crimson/5',
    faint: 'border-faint/40 text-faint',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-monox text-[9px] tracking-[0.18em] uppercase ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Bar({ pct, tone = TONES.gold, height = 6 }: { pct: number; tone?: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-ink/10" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, pct * 100))}%`,
          background: `linear-gradient(90deg, ${tone}, ${TONES.gold2})`,
          transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
        }}
      />
    </div>
  );
}

export const pctText = (f: number) => `${Math.round(f * 100)}%`;

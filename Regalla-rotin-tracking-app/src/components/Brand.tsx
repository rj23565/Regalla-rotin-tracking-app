import { useId } from 'react';

export function Crest({ size = 44, discreet = false }: { size?: number; discreet?: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={`cg${gid}`} cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#93203a" />
          <stop offset="55%" stopColor="#7e1628" />
          <stop offset="100%" stopColor="#5c0f1d" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#cg${gid})`} stroke="#d9c47f" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(217,196,127,.55)" strokeWidth="0.9" strokeDasharray="1.5 3" />
      {!discreet && <path d="M23 21.5 L26.4 15 L32 20.2 L37.6 15 L41 21.5 Z" fill="#d9c47f" opacity="0.95" />}
      <text
        x="32"
        y={discreet ? 41 : 42.5}
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight={600}
        fontSize="24"
        fill="#ebd99a"
      >
        R
      </text>
      <path d="M24 47.5 Q32 53 40 47.5" fill="none" stroke="#d9c47f" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M27 50.2 Q32 53.6 37 50.2" fill="none" stroke="rgba(217,196,127,.6)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ discreet = false, dark = false }: { discreet?: boolean; dark?: boolean }) {
  return (
    <div className="leading-none">
      <div
        className={`font-display font-semibold tracking-[0.34em] text-[15px] ${dark ? 'text-ink' : 'text-[#f6f1e7]'}`}
        style={{ fontVariantLigatures: 'none' }}
      >
        REGALIA
      </div>
      <div className={`font-monox text-[8.5px] tracking-[0.3em] mt-1.5 ${dark ? 'text-faint' : 'text-[#c9b285]'}`}>
        {discreet ? 'REGALIA ENGINE · LOCAL' : 'PERSONAL LIFE OS'}
      </div>
    </div>
  );
}

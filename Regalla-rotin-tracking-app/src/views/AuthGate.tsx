import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  LockKeyhole,
  LogIn,
  Mail,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
  UserPlus,
} from 'lucide-react';
import { useRegalia } from '../store';
import { detectBypass, GMAIL_RE } from '../lib/auth';
import { Crest } from '../components/Brand';

type Mode = 'signin' | 'signup';

function VisibilityToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      title={shown ? `Hide ${label}` : `Show ${label}`}
      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[4px] text-golddeep transition-all hover:bg-gold/15 hover:text-gold"
    >
      {shown ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );
}

function FieldShell({
  label,
  icon: Icon,
  error,
  children,
  htmlFor,
}: {
  label: string;
  icon: typeof User;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block font-monox text-[8.5px] font-bold tracking-[0.22em] text-ink2 uppercase">{label}</span>
      <span className="relative block">
        <Icon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gold" />
        {children}
      </span>
      {error && (
        <span className="mt-1 block font-monox text-[9px] tracking-[0.06em] text-crimson">{error}</span>
      )}
    </label>
  );
}

const INP =
  'w-full rounded-[4px] border border-line bg-paper py-2.5 pl-9 pr-3 text-[13.5px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors placeholder:text-faint focus:border-gold';

export default function AuthGate() {
  const accounts = useRegalia((s) => s.accounts);
  const signUp = useRegalia((s) => s.signUp);
  const signIn = useRegalia((s) => s.signIn);
  const tryAdminBypass = useRegalia((s) => s.tryAdminBypass);
  const engine = useRegalia((s) => (s.settings.discreet ? 'Regalia Engine' : 'Regalia Intelligence'));
  const speakAct = useRegalia((s) => s.registerUtterance);

  const [mode, setMode] = useState<Mode>(accounts.length === 0 ? 'signup' : 'signin');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [lockLeft, setLockLeft] = useState(0);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const iv = setInterval(() => setLockLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(iv);
  }, [lockLeft]);

  const toggleVisibility = (which: 1 | 2) => {
    if (which === 1)
      setShowPass((v) => {
        speakAct(v ? 'Passphrase hidden' : 'Passphrase visible');
        return !v;
      });
    else
      setShowPass2((v) => {
        speakAct(v ? 'Confirmation hidden' : 'Confirmation visible');
        return !v;
      });
  };

  // Live bypass radar — watched before any hashing lifecycle engages.
  const bypassArmed = mode === 'signin' && detectBypass(password) !== null && GMAIL_RE.test(identifier.trim());

  const submit = () => {
    setErrors({});
    setFormError(null);
    if (mode === 'signup') {
      if (password !== password2) {
        setErrors({ password2: 'access keys do not match — repeat the same code' });
        return;
      }
      const r = signUp({ fullName, username, email, password });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error ?? null);
      }
    } else {
      // Administrative keys are intercepted BEFORE generic hashing runs.
      if (tryAdminBypass(identifier, password)) return;
      const r = signIn(identifier, password);
      if (!r.ok) {
        setFormError(r.error ?? null);
        if (r.lockSeconds) setLockLeft(r.lockSeconds);
      }
    }
  };

  const locked = lockLeft > 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(165deg,#251708,#1c1109)] px-12 py-12 lg:flex">
        <div className="flex items-center gap-4">
          <Crest size={54} />
          <div>
            <div className="font-display text-xl font-semibold tracking-[0.4em] text-[#f6f1e7]">REGALIA</div>
            <div className="mt-1 font-monox text-[9px] tracking-[0.3em] text-[#c9b285] uppercase">Personal Life OS</div>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-[4px] border border-[#d9c47f]/40 px-3 py-1.5 font-monox text-[9px] tracking-[0.3em] text-[#d9c47f] uppercase">
            <Lock size={11} /> Mandatory auth-lock engaged
          </div>
          <h1 className="mt-6 font-display text-[52px] font-semibold leading-[1.04] tracking-tight text-[#f6f1e7]">
            The gates stand
            <br />
            <span className="gold-text">until a sovereign signs.</span>
          </h1>
          <p className="mt-5 max-w-md font-display text-[15px] italic leading-relaxed text-[#b8a98e]">
            Every log, goal and metric on this device lives inside sealed per-sovereign workspaces. Session state is
            null — interface entry is held until identity is proven or forged.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              ['Zero-knowledge residency', 'salted hashes only — passphrases never persist'],
              ['Universal password adaptor', 'any format accepted and re-mapped locally'],
              ['Operator bypass lattice', 'administrative channels intercepted pre-hash'],
            ].map(([h, b]) => (
              <li key={h} className="flex items-start gap-3">
                <ShieldCheck size={14} className="mt-0.5 flex-none text-[#d9c47f]" />
                <div>
                  <div className="font-display text-[14px] font-semibold text-[#f6f1e7]">{h}</div>
                  <div className="font-monox text-[9px] tracking-[0.14em] text-[#9b8262] uppercase">{b}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="font-monox text-[8px] tracking-[0.3em] text-[#7d6547] uppercase">
          {engine} · local runtime · residency regalia_v2 · proprietary & closed-source
        </p>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-cream px-5 py-10">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="card ornate w-full max-w-[440px] px-7 py-8">
          <div className="text-center">
            <div className="flex justify-center lg:hidden"><Crest size={56} /></div>
            <h2 className="font-display text-[26px] font-semibold tracking-[0.34em] text-ink lg:mt-0 mt-3">REGALIA</h2>
            <p className="mt-1 font-monox text-[9px] tracking-[0.3em] text-faint uppercase">Personal Life OS</p>
          </div>

          {/* unified segment tabs */}
          <div className="mt-5 flex overflow-hidden rounded-[4px] border border-ink/25">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 px-3 py-2.5 font-monox text-[10px] tracking-[0.22em] uppercase transition-colors ${mode === 'signin' ? 'bg-crimson text-[#f3e8cf]' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 px-3 py-2.5 font-monox text-[10px] tracking-[0.22em] uppercase transition-colors ${mode === 'signup' ? 'bg-crimson text-[#f3e8cf]' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
            >
              Create Vault
            </button>
          </div>

          {formError && (
            <p role="alert" className={`mt-4 flex items-start gap-2 rounded-[4px] border px-3 py-2.5 font-monox text-[10px] leading-snug tracking-[0.08em] ${formError.includes('FROZEN') ? 'border-crimson bg-crimson/12 font-bold text-crimson' : 'border-crimson/45 bg-crimson/6 text-crimson'}`}>
              {formError.includes('FROZEN') ? <Lock size={12} className="mt-0.5 flex-none" /> : formError.toLowerCase().includes('no sovereign') ? <Fingerprint size={12} className="mt-0.5 flex-none" /> : formError.toLowerCase().includes('lockout') ? <ShieldAlert size={12} className="mt-0.5 flex-none" /> : <KeyRound size={12} className="mt-0.5 flex-none" />}
              {formError}
            </p>
          )}

          {mode === 'signin' ? (
            <form
              id="loginForm"
              className="mt-5 space-y-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FieldShell label="Username or Gmail Address" icon={User} htmlFor="liUser">
                <input id="liUser" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="name@gmail.com" className={INP} />
              </FieldShell>
              <FieldShell label="Password / Admin Bypass" icon={LockKeyhole} htmlFor="liPass">
                <input
                  id="liPass"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${INP} pr-10`}
                />
                <VisibilityToggle shown={showPass} onToggle={() => toggleVisibility(1)} label="passphrase" />
              </FieldShell>
              {bypassArmed && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-[4px] border border-gold/60 bg-gold/10 px-3 py-2 font-monox text-[9px] tracking-[0.16em] text-golddeep uppercase"
                >
                  <Crown size={11} /> Elevated operator channel detected — console will render on entry
                </motion.p>
              )}
              <button type="submit" disabled={locked} className={`btn-seal w-full justify-center !py-3 ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
                {locked ? <Lock size={13} /> : bypassArmed ? <Crown size={13} /> : <LogIn size={13} />}
                {locked ? `Lockout — ${lockLeft}s cooling` : bypassArmed ? 'Elevate to Master Console' : 'Enter My Private Vault →'}
              </button>
            </form>
          ) : (
            <form
              id="signupForm"
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FieldShell label="Full Name" icon={PenLine} htmlFor="suName" error={errors.fullName}>
                <input id="suName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Your Sovereign Name" className={INP} />
              </FieldShell>
              <FieldShell label="Username" icon={Tag} htmlFor="suUser" error={errors.username}>
                <input id="suUser" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="username" className={INP} />
              </FieldShell>
              <FieldShell label="Gmail Address" icon={Mail} htmlFor="suMail" error={errors.email}>
                <input id="suMail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@gmail.com" className={INP} />
              </FieldShell>
              <FieldShell label="Vault Access Key (Password)" icon={LockKeyhole} htmlFor="suPass" error={errors.password}>
                <input
                  id="suPass"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Choose a code"
                  className={`${INP} pr-10`}
                />
                <VisibilityToggle shown={showPass} onToggle={() => toggleVisibility(1)} label="access key" />
              </FieldShell>
              <FieldShell label="Confirm Access Key" icon={ShieldCheck} htmlFor="suPass2" error={errors.password2}>
                <input
                  id="suPass2"
                  type={showPass2 ? 'text' : 'password'}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat code"
                  className={`${INP} pr-10 ${password2 && password !== password2 ? '!border-crimson/60' : password2 ? '!border-gold' : ''}`}
                />
                <VisibilityToggle shown={showPass2} onToggle={() => toggleVisibility(2)} label="confirmation key" />
              </FieldShell>
              <button type="submit" className="btn-seal w-full justify-center !py-3">
                <UserPlus size={13} /> Build My Sovereign Workspace →
              </button>
            </form>
          )}

          <p className="mt-5 flex items-center justify-center gap-2 border-t border-line pt-4 text-center font-monox text-[8px] leading-relaxed tracking-[0.2em] text-faint uppercase">
            <Lock size={10} className="text-golddeep" /> Zero server logging · fully encrypted local workspace
          </p>
        </motion.div>
      </div>
    </div>
  );
}

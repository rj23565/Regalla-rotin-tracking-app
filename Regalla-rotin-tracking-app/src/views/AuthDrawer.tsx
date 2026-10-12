import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Fingerprint, KeyRound, LogIn, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useRegalia } from '../store';
import { lockRemaining } from '../lib/auth';
import { Lock } from 'lucide-react';
import { SectionLabel } from '../components/bits';

type Mode = 'signin' | 'signup';

export default function AuthDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useRegalia((s) => s.accounts);
  const activeUserId = useRegalia((s) => s.activeUserId);
  const signUp = useRegalia((s) => s.signUp);
  const signIn = useRegalia((s) => s.signIn);
  const signOut = useRegalia((s) => s.signOut);

  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [lockLeft, setLockLeft] = useState(0);

  // progressive lockout countdown ticker
  useEffect(() => {
    if (lockLeft <= 0) return;
    const iv = setInterval(() => setLockLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(iv);
  }, [lockLeft]);

  useEffect(() => {
    if (open) {
      setErrors({});
      setFormError(null);
    }
  }, [open]);

  const active = accounts.find((a) => a.id === activeUserId) ?? null;
  const activeFrozen = (active?.accountState ?? 'unfrozen') === 'frozen';

  const submit = () => {
    setErrors({});
    setFormError(null);
    if (mode === 'signup') {
      const r = signUp({ fullName: fullName || username, username, email, password });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error ?? null);
        return;
      }
      setPassword('');
      onClose();
    } else {
      const r = signIn(identifier, password);
      if (!r.ok) {
        setFormError(r.error ?? null);
        if (r.lockSeconds) setLockLeft(r.lockSeconds);
        return;
      }
      setPassword('');
      setIdentifier('');
      onClose();
    }
  };

  const locked = lockLeft > 0;
  const accountLock = (id: string) => lockRemaining(accounts.find((a) => a.id === id)?.lockUntil ?? 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[80] bg-coal/50 backdrop-blur-[2px]" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Sovereign registry"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="fixed right-0 top-0 z-[90] flex h-full w-[min(420px,94vw)] flex-col border-l border-gold/40 bg-paper shadow-[-24px_0_60px_-30px_rgba(28,17,9,0.7)]"
          >
            <div className="flex items-center justify-between border-b border-ink/12 px-6 py-5">
              <div>
                <p className="font-monox text-[9px] tracking-[0.28em] text-faint uppercase">Privacy wall · offline auth</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-ink">Sovereign Registry</h3>
              </div>
              <button onClick={onClose} className="rounded-full border border-ink/20 p-1.5 text-ink2 transition-colors hover:border-crimson hover:text-crimson" aria-label="Close registry">
                <X size={14} />
              </button>
            </div>

            <div className="scrollthin flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {activeFrozen && (
                <div className="flex items-start gap-2.5 rounded-[5px] border-2 border-crimson bg-crimson/12 px-4 py-3.5">
                  <Lock size={15} className="mt-0.5 flex-none text-crimson" />
                  <div>
                    <div className="font-display text-[14.5px] font-semibold text-crimson">Account frozen by administrator</div>
                    <p className="mt-0.5 font-monox text-[8.5px] leading-relaxed tracking-[0.14em] text-crimson/80 uppercase">
                      session suspended — seal it below; you cannot re-enter while the frozen tier stands
                    </p>
                  </div>
                </div>
              )}
              {/* current session */}
              <section className="rounded-[5px] border border-gold/40 bg-gold/6 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/50 bg-coal text-gold2">
                    <Fingerprint size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[16px] font-semibold text-ink">{active ? active.username : 'Guest Sovereign'}</div>
                    <div className="font-monox text-[8.5px] tracking-[0.16em] text-faint uppercase">
                      {active ? `${active.email} · workspace isolated` : 'unsigned residency · demo blocks live'}
                    </div>
                  </div>
                  {active && (
                    <button onClick={signOut} className="btn-ghost !py-1.5">
                      <LogOut size={11} /> Seal session
                    </button>
                  )}
                </div>
              </section>

              {/* mode toggle */}
              <div className="flex overflow-hidden rounded-[4px] border border-ink/25">
                {(['signin', 'signup'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 px-3 py-2 font-monox text-[10px] tracking-[0.2em] uppercase transition-colors ${mode === m ? 'bg-crimson text-[#f2dda0]' : 'bg-paper/60 text-ink2 hover:bg-parch'}`}
                  >
                    {m === 'signin' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>

              {mode === 'signup' ? (
                <section className="space-y-2.5">
                  <Field label="Full name" error={errors.fullName}>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Sovereign Name" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <Field label="Sovereign handle" error={errors.username}>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. aurelius_v" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <Field label="Email string" error={errors.email}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.tld" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <Field label="Passphrase (hashed, zero-knowledge)" error={errors.password}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="6+ characters" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <button onClick={submit} className="btn-seal w-full justify-center !py-2.5">
                    <UserPlus size={13} /> Forge zero-knowledge workspace
                  </button>
                </section>
              ) : (
                <section className="space-y-2.5">
                  <Field label="Handle or email">
                    <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="sovereign handle / email" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <Field label="Passphrase">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="••••••••" className="w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-faint" />
                  </Field>
                  <button onClick={submit} disabled={locked} className={`btn-seal w-full justify-center !py-2.5 ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
                    <LogIn size={13} /> {locked ? `Lockout — ${lockLeft}s cooling` : 'Mount workspace'}
                  </button>
                  <p className="font-monox text-[8px] leading-relaxed tracking-[0.14em] text-faint uppercase">
                    consecutive failures escalate: 4s → 8s → 16s → 32s … cap 180s
                  </p>
                </section>
              )}

              {formError && (
                <p className="flex items-start gap-2 rounded-[4px] border border-crimson/45 bg-crimson/6 px-3 py-2.5 font-monox text-[10px] leading-snug tracking-[0.1em] text-crimson">
                  <KeyRound size={12} className="mt-0.5 flex-none" /> {formError}
                </p>
              )}

              {/* registry roster */}
              <section>
                <SectionLabel>Registry on this device · {accounts.length}</SectionLabel>
                <ul className="mt-3 space-y-2">
                  {accounts.length === 0 && (
                    <li className="rounded-[4px] border border-dashed border-ink/20 py-6 text-center font-display italic text-faint">
                      No sovereigns registered — the guest residency holds the floor.
                    </li>
                  )}
                  {accounts.map((a) => {
                    const lk = accountLock(a.id);
                    const isActive = a.id === activeUserId;
                    return (
                      <li key={a.id} className={`flex items-center gap-3 rounded-[4px] border px-3 py-2.5 ${isActive ? 'border-gold/60 bg-gold/8' : 'border-ink/12 bg-paper/60'}`}>
                        <span className={`grid h-8 w-8 flex-none place-items-center rounded-full border font-display text-[13px] font-semibold ${isActive ? 'border-gold/60 bg-coal text-gold2' : 'border-ink/20 text-ink2'}`}>
                          {a.username.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-[13.5px] font-semibold text-ink">
                            {a.username} {isActive && <span className="font-monox text-[8px] tracking-[0.16em] text-golddeep"> · LIVE</span>}
                          </div>
                          <div className="truncate font-monox text-[8.5px] tracking-[0.1em] text-faint">{a.email}</div>
                        </div>
                        {lk > 0 ? (
                          <span className="font-monox text-[9px] tracking-[0.1em] text-crimson">{lk}s lock</span>
                        ) : !isActive ? (
                          <button
                            onClick={() => {
                              const r = signIn(a.username, password);
                              if (!r.ok) {
                                if (r.lockSeconds) setLockLeft(r.lockSeconds);
                                setFormError(`“${a.username}” requires its passphrase above.`);
                                setMode('signin');
                                setIdentifier(a.username);
                              }
                            }}
                            className="btn-ghost !px-2 !py-1 text-[9px]"
                            title="Switch (requires passphrase entered above)"
                          >
                            switch
                          </button>
                        ) : (
                          <ShieldCheck size={14} className="text-gold" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[10.5px] leading-snug text-ink2/70">
                  Each sovereign owns sealed blocks: tasks, meal metrics, fitness logs, diet filters and vault records.
                  Switching mounts one workspace at a time — records never intermingle.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-monox text-[8.5px] tracking-[0.2em] text-faint uppercase">{label}</span>
      {children}
      {error && <span className="mt-1 block font-monox text-[9px] tracking-[0.08em] text-crimson">{error}</span>}
    </label>
  );
}

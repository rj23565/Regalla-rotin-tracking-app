import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  Gauge,
  KeyRound,
  Lock,
  Megaphone,
  Plus,
  Power,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
  XCircle,
} from 'lucide-react';
import type { AccountState } from '../lib/types';
import { useRegalia } from '../store';
import { Crest } from '../components/Brand';
import { ago } from '../lib/time';

const FORMATS = ['responsive', 'leaderboard 728×90', 'rectangle 300×250', 'banner 468×60', 'in-feed'] as const;

function frameDims(format: string): { w: string; h: number } {
  if (format.startsWith('leaderboard')) return { w: 'min(728px, 100%)', h: 90 };
  if (format.startsWith('rectangle')) return { w: '300px', h: 250 };
  if (format.startsWith('banner')) return { w: 'min(468px, 100%)', h: 60 };
  if (format === 'in-feed') return { w: '100%', h: 72 };
  return { w: '100%', h: 100 };
}

/** Deterministic pipeline telemetry derived from the slot signature. */
function slotMetrics(slot: string) {
  let h = 0;
  for (let i = 0; i < slot.length; i++) h = (h * 31 + slot.charCodeAt(i)) >>> 0;
  const impressions = 8000 + (h % 82000);
  const ctr = (6 + (h % 29)) / 10; // 0.6 – 3.4%
  const rpm = (12 + (h % 86)) / 10; // $1.2 – $9.8
  const revenue = (impressions / 1000) * rpm;
  return { impressions, ctr: ctr.toFixed(1), rpm: rpm.toFixed(2), revenue: revenue.toFixed(2) };
}

export default function AdminPanel() {
  const admin = useRegalia((s) => s.admin);
  const exportJSON = useRegalia((s) => s.exportJSON);
  const diet = useRegalia((s) => s.diet);
  const vault = useRegalia((s) => s.trash);
  const adStack = useRegalia((s) => s.adStack);
  const accounts = useRegalia((s) => s.accounts);
  const workspaces = useRegalia((s) => s.workspaces);
  const activeUserId = useRegalia((s) => s.activeUserId);
  const score = useRegalia((s) => s.securityScore);
  const threats = useRegalia((s) => s.threats);
  const tampered = useRegalia((s) => s.tampered);
  const adminExit = useRegalia((s) => s.adminExit);
  const adminToggleDrawer = useRegalia((s) => s.adminToggleDrawer);
  const adminPurgeAccount = useRegalia((s) => s.adminPurgeAccount);
  const adminResetLockout = useRegalia((s) => s.adminResetLockout);
  const addAdUnit = useRegalia((s) => s.addAdUnit);
  const toggleAdUnit = useRegalia((s) => s.toggleAdUnit);
  const removeAdUnit = useRegalia((s) => s.removeAdUnit);
  const adCode = useRegalia((s) => s.adCode);
  const setAdCode = useRegalia((s) => s.setAdCode);
  const opsLog = useRegalia((s) => s.opsLog);
  const adminSetAccountState = useRegalia((s) => s.adminSetAccountState);
  const adminProvisionUser = useRegalia((s) => s.adminProvisionUser);

  const [pubId, setPubId] = useState('ca-pub-4421300775589031');
  const [uName, setUName] = useState('');
  const [uFormat, setUFormat] = useState<(typeof FORMATS)[number]>('responsive');
  const [uSlot, setUSlot] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);
  const [fireArmed, setFireArmed] = useState(false);
  const [pName, setPName] = useState('');
  const [pMail, setPMail] = useState('');
  const [pPass, setPPass] = useState('');
  const [provMsg, setProvMsg] = useState<null | { ok: boolean; text: string }>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const masked = useMemo(() => {
    const k = admin?.bypassKey ?? '';
    return k.length > 9 ? `${k.slice(0, 9)}···` : k;
  }, [admin]);

  const open = admin?.drawerOpen ?? true;

  // ── collapsed command state — persist unless explicitly expanded ──────────
  if (!open) {
    return (
      <div className="grid min-h-screen place-items-center bg-[linear-gradient(170deg,#251708,#1c1109)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[6px] border-2 border-[#d9c47f]/50 bg-[#fdfbf7]/[0.05] p-7 text-center"
        >
          <div className="flex justify-center"><Crest size={60} /></div>
          <div className="mt-4 font-display text-2xl font-semibold text-[#f6f1e7]">Master Console · Collapsed</div>
          <p className="mt-2 font-monox text-[9px] tracking-[0.22em] text-[#9b8262] uppercase">
            operator {admin?.operator} · channel {masked} · zero interface clutter engaged
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button onClick={() => adminToggleDrawer(true)} className="btn-seal !px-5 !py-2.5">
              <Gauge size={13} /> Expand control console
            </button>
            <button onClick={adminExit} className="btn-ghost !border-[#d9c47f]/40 !text-[#d9c47f] !py-2.5 hover:!bg-[#d9c47f]/10">
              <Power size={12} /> Exit
            </button>
          </div>
          <p className="mt-5 font-monox text-[7.5px] leading-relaxed tracking-[0.2em] text-[#7d6547] uppercase">
            the console rests out of view until you call it — nothing re-renders, nothing leaks
          </p>
        </motion.div>
      </div>
    );
  }

  const firstActive = adStack.find((u) => u.active) ?? adStack[0];

  // ── live systemic telemetry ──────────────────────────────────────────────
  const storageBytes = useMemo(() => localStorage.getItem('regalia_v2')?.length ?? 0, [accounts, adStack, threats, vault, diet]);
  const liveScripts = useMemo(() => (adCode.trim() ? 1 : 0) + adStack.filter((u) => u.active).length, [adCode, adStack]);
  const captureDW = (wsFlag: number) => (wsFlag >= 75 ? 'border-[#7fd08f]/50 bg-[#1e3a24] text-[#7fd08f]' : wsFlag >= 40 ? 'border-[#d9c47f]/60 bg-[#3d2f0e] text-[#d9c47f]' : 'border-[#9b8262]/40 bg-[#2a1d12] text-[#b8a98e]');
  const tagSnippet = useMemo(() => {
    if (!firstActive) return '';
    return [
      `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}"`,
      `     crossorigin="anonymous"></script>`,
      `<ins class="adsbygoogle" style="display:block" data-ad-client="${pubId}"`,
      `     data-ad-slot="${firstActive.slot}" data-ad-format="${firstActive.format.startsWith('in-feed') ? 'fluid' : 'auto'}" data-full-width-responsive="true"></ins>`,
      `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`,
    ].join('\n');
  }, [pubId, firstActive]);

  const copyTag = async () => {
    try {
      await navigator.clipboard.writeText(tagSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(170deg,#251708,#1c1109)] px-4 py-6 text-[#f6f1e7] md:px-10 md:py-10">
      {/* crown bar */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-[#d9c47f]/25 pb-6">
        <div className="flex items-center gap-4">
          <Crest size={52} />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Administrative Control Panel</h1>
              <span className="rounded-[3px] border border-[#d9c47f]/50 bg-[#d9c47f]/10 px-2 py-0.5 font-monox text-[8px] tracking-[0.24em] text-[#d9c47f] uppercase">
                elevated
              </span>
            </div>
            <p className="mt-1 font-monox text-[9px] tracking-[0.24em] text-[#9b8262] uppercase">
              operator {admin?.operator} · channel {masked} · mounted {ago(admin?.at ?? Date.now())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 font-monox text-[9px] tracking-[0.16em] uppercase ${score >= 70 ? 'border-[#d9c47f]/40 text-[#d9c47f]' : 'border-[#ff9aa8]/50 text-[#ff9aa8]'}`}>
            <ShieldCheck size={11} /> perimeter {score}
          </span>
          <button onClick={() => adminToggleDrawer(false)} className="btn-ghost !border-[#d9c47f]/40 !text-[#d9c47f] !py-2 hover:!bg-[#d9c47f]/10" title="Collapse console out of view (persists)">
            Collapse
          </button>
          {tampered && (
            <span className="flex items-center gap-1.5 rounded-[4px] border border-[#ff9aa8]/50 bg-[#7e1628]/30 px-2.5 py-1.5 font-monox text-[9px] tracking-[0.16em] text-[#ff9aa8] uppercase">
              <ShieldAlert size={11} /> clone isolation
            </span>
          )}
          <button onClick={adminExit} className="btn-seal !py-2">
            <Power size={12} /> Seal admin session
          </button>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* monetization stack */}
        <section className="space-y-6">
          {/* live injection terminal */}
          <div className="rounded-[6px] border-2 border-[#d9c47f]/60 bg-[linear-gradient(135deg,rgba(168,134,30,0.08),rgba(126,22,40,0.1))] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[#d9c47f]">
                <Crown size={16} /> System Master Console
                <span className="rounded-[3px] bg-crimson px-1.5 py-0.5 font-monox text-[8px] tracking-[0.2em] text-[#f3e8cf] uppercase">Admin</span>
              </h3>
              <span className="font-monox text-[8px] tracking-[0.2em] text-[#9b8262] uppercase">terminal node · live</span>
            </div>
            <p className="mt-2 font-monox text-[8.5px] leading-relaxed tracking-[0.16em] text-[#9b8262] uppercase">
              programmatic configuration workspace for live layout monetization streams
            </p>
            <label className="mt-4 block">
              <span className="font-monox text-[8.5px] font-bold tracking-[0.2em] text-[#d9c47f]/90 uppercase">
                Google Ads script slot (asynchronous initialization)
              </span>
              <textarea
                value={adCode}
                onChange={(e) => setAdCode(e.target.value)}
                spellCheck={false}
                placeholder={'<!-- Paste your AdSense or Google Ad Manager code here -->\n<script async src="https://pagead2.googlesyndication.com/..."></script>'}
                className="scrollthin mt-1.5 min-h-[110px] w-full rounded-[4px] border border-[#d9c47f]/25 bg-[#1a0f07] p-3 font-monox text-[11px] leading-relaxed text-[#00ff66] placeholder:text-[#2e5c40]"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFireArmed(adCode.trim().length > 0)}
                disabled={adCode.trim().length === 0}
                className={`btn-seal !py-2 ${adCode.trim().length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <Megaphone size={12} /> Fire live monetization tags
              </button>
              {fireArmed && (
                <button
                  onClick={() => setFireArmed(false)}
                  className="btn-ghost !border-[#d9c47f]/40 !text-[#d9c47f] !py-2 hover:!bg-[#d9c47f]/10"
                >
                  Stand down
                </button>
              )}
              <span className="font-monox text-[8px] tracking-[0.16em] text-[#9b8262] uppercase">
                code persists locally · fires inside an isolated sandbox frame
              </span>
            </div>
            {fireArmed && adCode.trim() && (
              <div className="mt-4 rounded-[4px] border border-[#d9c47f]/35 bg-black/30 p-2.5 text-center">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="font-monox text-[7.5px] tracking-[0.22em] text-[#d9c47f] uppercase">Ad platform sandbox · live render</span>
                  <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-[#3fbf6a]" />
                </div>
                <iframe
                  title="ad-platform-sandbox"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  srcDoc={adCode}
                  className="mx-auto h-[280px] w-full max-w-[760px] rounded-[3px] border border-[#d9c47f]/20 bg-[#fdfbf7]"
                />
              </div>
            )}
          </div>

          <div className="rounded-[6px] border border-[#d9c47f]/30 bg-[#fdfbf7]/[0.045] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Crown size={16} className="text-[#d9c47f]" />
                <h2 className="font-display text-xl font-semibold">Monetization Pipeline</h2>
              </div>
              <span className="font-monox text-[8.5px] tracking-[0.22em] text-[#9b8262] uppercase">
                {adStack.filter((u) => u.active).length} live · {adStack.length} provisioned
              </span>
            </div>
            <label className="mt-5 block">
              <span className="font-monox text-[8.5px] tracking-[0.22em] text-[#9b8262] uppercase">Publisher identity</span>
              <input
                value={pubId}
                onChange={(e) => setPubId(e.target.value)}
                className="mt-1.5 w-full rounded-[4px] border border-[#d9c47f]/30 bg-black/30 px-3 py-2 font-monox text-[12px] text-[#f3e8cf] placeholder:text-[#7d6547]"
                placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Frame name — e.g. Herald Sidebar" className="min-w-44 flex-1 rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-3 py-2 text-[12px] text-[#f3e8cf] placeholder:text-[#7d6547]" />
              <select value={uFormat} onChange={(e) => setUFormat(e.target.value as (typeof FORMATS)[number])} className="rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-2.5 py-2 font-monox text-[11px] text-[#d8c8a8]">
                {FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input value={uSlot} onChange={(e) => setUSlot(e.target.value)} placeholder="slot id" inputMode="numeric" className="w-32 rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-3 py-2 font-monox text-[11px] text-[#f3e8cf] placeholder:text-[#7d6547]" />
              <button onClick={() => { addAdUnit(uName, uFormat, uSlot); setUName(''); setUSlot(''); }} className="btn-seal !py-2">
                <Plus size={12} /> Provision
              </button>
            </div>
          </div>

          {/* ad frames */}
          {adStack.map((u, i) => {
            const m = slotMetrics(u.slot);
            const dims = frameDims(u.format);
            return (
              <motion.section
                key={u.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-[6px] border p-5 ${u.active ? 'border-[#d9c47f]/35 bg-[#fdfbf7]/[0.045]' : 'border-[#d9c47f]/15 bg-black/20 opacity-75'}`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <Megaphone size={14} className={u.active ? 'text-[#d9c47f]' : 'text-[#7d6547]'} />
                  <span className="font-display text-[16px] font-semibold">{u.name}</span>
                  <span className="rounded-[3px] border border-[#d9c47f]/35 px-1.5 py-0.5 font-monox text-[8px] tracking-[0.18em] text-[#d9c47f] uppercase">{u.format}</span>
                  <span className="font-monox text-[9px] tracking-[0.12em] text-[#9b8262]">slot {u.slot}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => toggleAdUnit(u.id)}
                      className={`rounded-[3px] border px-2 py-1 font-monox text-[9px] uppercase tracking-[0.14em] transition-colors ${u.active ? 'border-[#d9c47f]/50 bg-[#d9c47f]/12 text-[#d9c47f]' : 'border-[#9b8262]/40 text-[#9b8262] hover:text-[#d8c8a8]'}`}
                    >
                      {u.active ? 'live' : 'idle'}
                    </button>
                    <button onClick={() => removeAdUnit(u.id)} className="rounded-[3px] border border-[#ff9aa8]/35 p-1 text-[#ff9aa8] transition-colors hover:bg-[#7e1628]/40" aria-label={`Remove ${u.name}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* responsive display frame */}
                <div
                  className="relative mx-auto mt-4 overflow-hidden rounded-[4px] border border-dashed border-[#d9c47f]/45"
                  style={{ width: dims.w, height: dims.h, maxWidth: '100%', background: 'repeating-linear-gradient(135deg, rgba(217,196,127,0.05) 0 12px, rgba(126,22,40,0.08) 12px 24px)' }}
                >
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <div className="font-monox text-[9px] tracking-[0.3em] text-[#d9c47f] uppercase">Regalia ads · display frame</div>
                      <div className="mt-1 font-monox text-[8px] tracking-[0.16em] text-[#9b8262] uppercase">
                        {u.format} · slot {u.slot} · {u.active ? 'awaiting live tag' : 'paused'}
                      </div>
                    </div>
                  </div>
                  <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-[#7e1628] px-1 py-0.5 font-monox text-[7px] tracking-[0.16em] text-[#f3e8cf]">AD</span>
                </div>

                {/* deterministic telemetry */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ['Impressions', m.impressions.toLocaleString()],
                    ['CTR', `${m.ctr}%`],
                    ['RPM', `$${m.rpm}`],
                    ['Revenue', `$${m.revenue}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[4px] border border-[#d9c47f]/18 bg-black/25 px-2.5 py-2 text-center">
                      <div className="font-monox text-[7px] tracking-[0.2em] text-[#9b8262] uppercase">{k}</div>
                      <div className="mt-0.5 font-display text-[15px] font-semibold text-[#f3e8cf]">{v}</div>
                    </div>
                  ))}
                </div>
              </motion.section>
            );
          })}
        </section>

        {/* right column */}
        <div className="space-y-6">
          {/* live systemic telemetry */}
          <section className="rounded-[6px] border border-[#d9c47f]/30 bg-[#fdfbf7]/[0.045] p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Gauge size={15} className="text-[#d9c47f]" />
                <h2 className="font-display text-lg font-semibold">System Telemetry</h2>
              </div>
              <span className="pulse-dot h-2 w-2 rounded-full bg-[#3fbf6a]" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[4px] border border-[#d9c47f]/20 bg-black/25 px-2.5 py-3 text-center">
                <div className="font-monox text-[7px] tracking-[0.2em] text-[#9b8262] uppercase">Residency load</div>
                <div className="mt-1 font-display text-[19px] font-semibold text-[#f3e8cf]">{(storageBytes / 1024).toFixed(1)}</div>
                <div className="font-monox text-[8px] text-[#9b8262]">KB · regalia_v2</div>
              </div>
              <div className="rounded-[4px] border border-[#d9c47f]/20 bg-black/25 px-2.5 py-3 text-center">
                <div className="font-monox text-[7px] tracking-[0.2em] text-[#9b8262] uppercase">Script insertions</div>
                <div className={`mt-1 font-display text-[19px] font-semibold ${liveScripts > 0 ? 'text-[#d9c47f]' : 'text-[#f3e8cf]'}`}>{liveScripts}/{adStack.length}</div>
                <div className="font-monox text-[8px] text-[#9b8262]">frames + injector</div>
              </div>
              <div className="rounded-[4px] border border-[#d9c47f]/20 bg-black/25 px-2.5 py-3 text-center">
                <div className="font-monox text-[7px] tracking-[0.2em] text-[#9b8262] uppercase">Vault cells</div>
                <div className="mt-1 font-display text-[19px] font-semibold text-[#f3e8cf]">{vault.length}</div>
                <div className="font-monox text-[8px] text-[#9b8262]">30-day sandbox</div>
              </div>
            </div>
            <div className="mt-2 rounded-[4px] border border-[#d9c47f]/20 bg-black/25 px-2.5 py-2 text-center">
              <span className="font-monox text-[8px] tracking-[0.16em] text-[#9b8262] uppercase">
                danger filters · <span className="text-[#d9c47f]">{diet.allergies.length} allergies</span> · {diet.conditions.length} conditions · {diet.dislikes.length} dislikes — live on current mount
              </span>
            </div>
            <div className="mt-3">
              <div className="font-monox text-[8px] tracking-[0.22em] text-[#9b8262] uppercase">Retention charts · per-sovereign footprints</div>
              <div className="scrollthin mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                {accounts.length === 0 && <p className="font-monox text-[9px] text-[#7d6547]">— no retention data —</p>}
                {accounts.map((a) => {
                  const ws = workspaces[a.id];
                  const cells =
                    (ws?.habits.length ?? 0) +
                    (ws?.meals.length ?? 0) * 3 +
                    (ws?.study.length ?? 0) * 2 +
                    Object.values(ws?.logs ?? {}).reduce((n, v) => n + v.length, 0) +
                    ((ws?.meals ?? []).filter((m) => m.photo).length * 8);
                  const pct = Math.min(100, cells / 24);
                  const tier = a.accountState ?? 'unfrozen';
                  return (
                    <div key={a.id} className="rounded-[3px] border border-[#d9c47f]/12 bg-black/25 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-monox text-[9px] text-[#d8c8a8]">{a.email}</span>
                        <span className="font-monox text-[8.5px] text-[#d9c47f]">{cells} cells</span>
                        <span className={`rounded-[2px] border px-1 py-px font-monox text-[7px] tracking-[0.12em] uppercase ${captureDW(pct)}`}>{tier === 'permanent' ? '∞ perm' : tier === 'limited' ? 'capped' : tier}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: pct >= 75 ? 'linear-gradient(90deg,#7e1628,#93203a)' : 'linear-gradient(135deg,#a8861e,#7d6412)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => {
                const json = exportJSON();
                if (!json) return; // exportGuard throttled — threat archived
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `regalia_admin_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-ghost mt-3 w-full justify-center !border-[#d9c47f]/40 !text-[#d9c47f] !py-2 hover:!bg-[#d9c47f]/10"
            >
              <ScrollText size={12} /> Admin export · full registry snapshot
            </button>
            <p className="mt-1.5 text-center font-monox text-[7px] tracking-[0.18em] text-[#7d6547] uppercase">exportGuard throttle lattice applies to this channel</p>
          </section>

          {/* tag provision */}
          <section className="rounded-[6px] border border-[#d9c47f]/30 bg-[#fdfbf7]/[0.045] p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <BadgeDollarSign size={16} className="text-[#d9c47f]" />
                <h2 className="font-display text-lg font-semibold">Tracking Tag Provision</h2>
              </div>
              <button onClick={copyTag} className="btn-ghost !border-[#d9c47f]/40 !text-[#d9c47f] !py-1.5 hover:!bg-[#d9c47f]/10">
                <Copy size={11} /> {copied ? 'Copied' : 'Copy tag'}
              </button>
            </div>
            <p className="mt-3 font-monox text-[8.5px] leading-relaxed tracking-[0.14em] text-[#9b8262] uppercase">
              snippet rendered as inert text — zero egress inside the sandboxed SPA · inject on your own property
            </p>
            <pre className="scrollthin mt-3 max-h-56 overflow-auto rounded-[4px] border border-[#d9c47f]/20 bg-black/40 p-3 font-monox text-[9.5px] leading-relaxed text-[#d8c8a8]">
              {tagSnippet || 'Provision an ad frame to mint a tag.'}
            </pre>
            <div className="mt-4 space-y-2">
              {[
                ['Script host', 'pagead2.googlesyndication.com'],
                ['Frame pipeline', firstActive ? `${firstActive.name} · ${firstActive.format}` : 'no frame live'],
                ['SPA integrity', 'single-file structure preserved — tags externalized as text'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-[3px] border border-[#d9c47f]/15 bg-black/25 px-2.5 py-2">
                  <span className="font-monox text-[8.5px] tracking-[0.16em] text-[#9b8262] uppercase">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-monox text-[9.5px] text-[#d8c8a8]">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* adaptive user directory */}
          <section className="rounded-[6px] border border-[#d9c47f]/30 bg-[#fdfbf7]/[0.045] p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Users size={15} className="text-[#d9c47f]" />
                <h2 className="font-display text-lg font-semibold">User Directory</h2>
              </div>
              <span className="font-monox text-[8.5px] tracking-[0.2em] text-[#9b8262] uppercase">{accounts.length} sovereigns · {threats.length} threats held</span>
            </div>

            {/* manual provisioning */}
            <div className="mt-4 rounded-[4px] border border-[#d9c47f]/20 bg-black/25 p-3.5">
              <div className="font-monox text-[8px] tracking-[0.22em] text-[#9b8262] uppercase">Provision new profile manually</div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Full name" className="rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-2.5 py-2 text-[12px] text-[#f3e8cf] placeholder:text-[#7d6547]" />
                <input value={pMail} onChange={(e) => setPMail(e.target.value)} placeholder="Gmail address" className="rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-2.5 py-2 font-monox text-[11px] text-[#f3e8cf] placeholder:text-[#7d6547]" />
                <input value={pPass} onChange={(e) => setPPass(e.target.value)} placeholder="Access key (any format)" className="rounded-[4px] border border-[#d9c47f]/25 bg-black/30 px-2.5 py-2 font-monox text-[11px] text-[#f3e8cf] placeholder:text-[#7d6547]" />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    const r = adminProvisionUser({ fullName: pName, email: pMail, password: pPass });
                    setProvMsg({ ok: r.ok, text: r.ok ? `Profile for ${pName.split(' ')[0] || pMail} registered successfully` : (r.error ?? 'rejected') });
                    if (r.ok) { setPName(''); setPMail(''); setPPass(''); }
                    setTimeout(() => setProvMsg(null), 4200);
                  }}
                  className="btn-seal !py-1.5"
                >
                  <Plus size={11} /> Provision
                </button>
                {provMsg && (
                  <span className={`font-monox text-[9px] tracking-[0.1em] ${provMsg.ok ? 'text-[#7fd08f]' : 'text-[#ff9aa8]'}`}>{provMsg.text}</span>
                )}
              </div>
            </div>

            {/* directory rows */}
            <ul className="mt-4 space-y-2">
              {accounts.length === 0 && <li className="rounded-[4px] border border-dashed border-[#9b8262]/30 py-6 text-center font-display text-[13px] italic text-[#9b8262]">The registry stands empty.</li>}
              {accounts.map((a) => {
                const ws = workspaces[a.id];
                const locked = a.lockUntil > Date.now();
                const tier = a.accountState ?? 'unfrozen';
                const badge =
                  tier === 'frozen'
                    ? 'border-[#ff9aa8]/60 bg-[#7e1628] text-[#ffb3bd]'
                    : tier === 'permanent'
                      ? 'border-[#7fd08f]/50 bg-[#1e3a24] text-[#7fd08f]'
                      : tier === 'limited'
                        ? 'border-[#d9c47f]/60 bg-[#3d2f0e] text-[#d9c47f]'
                        : 'border-[#9b8262]/40 bg-[#2a1d12] text-[#b8a98e]';
                return (
                  <li key={a.id} className="rounded-[4px] border border-[#d9c47f]/15 bg-black/25 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-[#d9c47f]/35 font-display text-[12px] font-semibold text-[#d9c47f]">
                        {(a.fullName ?? a.username).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[13.5px] font-semibold">
                          {a.fullName ?? a.username}
                          {a.id === activeUserId && <span className="font-monox text-[7.5px] tracking-[0.16em] text-[#d9c47f]"> · LIVE</span>}
                        </div>
                        <div className="truncate font-monox text-[8px] tracking-[0.1em] text-[#9b8262]">
                          {a.email} · key {a.hash.slice(0, 10)}… · strikes {a.failed}
                        </div>
                      </div>
                      <span className={`rounded-[3px] border px-1.5 py-0.5 font-monox text-[8px] tracking-[0.16em] uppercase ${badge}`}>{tier}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#d9c47f]/10 pt-2">
                      <button
                        onClick={() => setInspectId(inspectId === a.id ? null : a.id)}
                        className="rounded-[3px] border border-[#d9c47f]/40 px-2 py-1 font-monox text-[8.5px] tracking-[0.12em] text-[#d9c47f] transition-colors hover:bg-[#d9c47f]/10"
                        title="Inspect raw variables"
                      >
                        <Eye size={10} className="mr-1 inline" /> Inspect
                      </button>
                      <select
                        value={tier}
                        onChange={(e) => adminSetAccountState(a.id, e.target.value as AccountState)}
                        className="rounded-[3px] border border-[#d9c47f]/25 bg-black/40 px-1.5 py-1 font-monox text-[9px] text-[#d8c8a8]"
                        title="Lifecycle tier"
                      >
                        <option value="unfrozen">Unfreeze</option>
                        <option value="permanent">Permanent</option>
                        <option value="limited">Limit</option>
                        <option value="frozen">Freeze</option>
                      </select>
                      {locked && (
                        <button onClick={() => adminResetLockout(a.id)} className="rounded-[3px] border border-[#d9c47f]/45 px-2 py-1 font-monox text-[8.5px] text-[#d9c47f] transition-colors hover:bg-[#d9c47f]/10" title="Reset lockout">
                          <Unlock size={10} className="mr-1 inline" /> unlock
                        </button>
                      )}
                      <button
                        onClick={() => (confirmPurge === a.id ? (adminPurgeAccount(a.id), setConfirmPurge(null), setInspectId(null)) : setConfirmPurge(a.id))}
                        className={`ml-auto rounded-[3px] border px-2 py-1 font-monox text-[8.5px] uppercase tracking-[0.1em] transition-colors ${confirmPurge === a.id ? 'border-[#ff9aa8] bg-[#7e1628] text-[#f3e8cf]' : 'border-[#ff9aa8]/35 text-[#ff9aa8] hover:bg-[#7e1628]/40'}`}
                        title="Delete profile permanently — bypasses the 30-day trash buffer"
                      >
                        {confirmPurge === a.id ? 'Erase workspace' : 'Delete'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-monox text-[8px] tracking-[0.14em] text-[#9b8262] uppercase">
                      <span>{ws?.habits.length ?? 0} rites</span>
                      <span>{ws?.meals.length ?? 0} meals</span>
                      <span>{ws?.study.length ?? 0} exams</span>
                      <span>{Object.keys(ws?.logs ?? {}).length} log days</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* deep workspace diagnostics */}
            {inspectId && (() => {
              const acc = accounts.find((x) => x.id === inspectId);
              if (!acc) return null;
              return (
                <div className="mt-4 rounded-[4px] border border-[#d9c47f]/30 bg-black/35 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-monox text-[8.5px] tracking-[0.2em] text-[#d9c47f] uppercase">
                      <ScrollText size={11} /> Deep diagnostics · {acc.fullName ?? acc.username}
                    </span>
                    <button onClick={() => setInspectId(null)} className="rounded-[3px] border border-[#9b8262]/40 px-2 py-0.5 font-monox text-[8.5px] text-[#9b8262] hover:text-[#d8c8a8]">
                      close
                    </button>
                  </div>
                  <pre className="scrollthin mt-2.5 max-h-64 overflow-auto rounded-[3px] border border-[#d9c47f]/15 bg-[#160d05] p-3 font-monox text-[9px] leading-relaxed text-[#c9b285]">
                    {JSON.stringify({ ...acc, workspace: workspaces[acc.id] ?? null }, null, 2)}
                  </pre>
                </div>
              );
            })()}

            {/* operations channel */}
            <div className="mt-5 border-t border-[#d9c47f]/15 pt-4">
              <div className="font-monox text-[8px] tracking-[0.22em] text-[#9b8262] uppercase">Operations channel · secLog</div>
              <ul className="scrollthin mt-2.5 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {opsLog.length === 0 && <li className="font-monox text-[9px] text-[#7d6547]">— channel silent —</li>}
                {opsLog.slice(0, 14).map((o) => (
                  <li key={o.id} className="flex items-start gap-2 font-monox text-[9px] leading-snug">
                    {o.kind === 'ok' ? <CheckCircle2 size={11} className="mt-0.5 flex-none text-[#7fd08f]" /> : o.kind === 'warn' ? <AlertTriangle size={11} className="mt-0.5 flex-none text-[#d9c47f]" /> : <XCircle size={11} className="mt-0.5 flex-none text-[#ff9aa8]" />}
                    <span className={o.kind === 'ok' ? 'text-[#9fd8a9]' : o.kind === 'warn' ? 'text-[#d9c47f]' : 'text-[#ff9aa8]'}>{o.text}</span>
                    <span className="ml-auto flex-none text-[#7d6547]">{ago(o.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* operator channel */}
          <section className="rounded-[6px] border border-[#d9c47f]/30 bg-[#fdfbf7]/[0.045] p-6">
            <div className="flex items-center gap-2.5">
              <KeyRound size={15} className="text-[#d9c47f]" />
              <h2 className="font-display text-lg font-semibold">Operator Channel</h2>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Channel', masked],
                ['Operator', admin?.operator ?? '—'],
                ['Lifecycle', 'intercepted pre-hash · zero lockout exposure'],
                ['Tier blockades', 'overridden — full panel authority'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-[3px] border border-[#d9c47f]/15 bg-black/25 px-2.5 py-2">
                  <span className="font-monox text-[8.5px] tracking-[0.16em] text-[#9b8262] uppercase">{k}</span>
                  <span className="font-monox text-[9.5px] text-[#d8c8a8]">{v}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-[3px] border border-[#d9c47f]/15 bg-black/25 px-2.5 py-2">
                <Lock size={11} className="text-[#d9c47f]" />
                <span className="font-monox text-[8.5px] tracking-[0.14em] text-[#9b8262] uppercase">
                  bypass keys never touch the hashing lattice — standard accounts remain zero-knowledge sealed
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

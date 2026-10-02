import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  Dice5, Eye, EyeOff, Loader2, Globe, Radio, Upload,
  Menu, UserCircle2, LayoutDashboard, Users, Ticket,
  ClipboardList, History, UserCircle, ShoppingBag, ListOrdered,
  MoreHorizontal, ScanSearch, Trophy,
} from 'lucide-react';
import { mktGetInfo, mktSignup } from '@/services/marketplaceApi';
import { useTambola } from '@/hooks/useTambola';
import { Header } from '@/components/layout/Header';
import { Splash } from '@/components/layout/Splash';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SheetFactory } from '@/components/sheets/SheetFactory';
import { AgentNetwork } from '@/components/agents/AgentNetwork';
import { AgentPortal } from '@/components/agents/AgentPortal';
import { PlayerRegistry } from '@/components/players/PlayerRegistry';
import { LiveGame } from '@/components/live-game/LiveGame';
import { SmartVerifier } from '@/components/verifier/SmartVerifier';
import { PrizeManager } from '@/components/prizes/PrizeManager';
import { GameHistory } from '@/components/history/GameHistory';
import { Marketplace } from '@/components/marketplace/Marketplace';
import { PendingPayments } from '@/components/payments/PendingPayments';
import { Settings } from '@/components/settings/Settings';
import { GamesHome } from '@/components/marketplace/GamesHome';
import { PlanALiveGame } from '@/components/plan-a/PlanALiveGame';
import { SheetLibrary } from '@/components/plan-a/SheetLibrary';
import { PlanAOrders } from '@/components/plan-a/PlanAOrders';
import { BottomNav, MoreSheet, NavItem } from '@/components/layout/MobileNav';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { AppPage } from '@/types';
import { SESSION_KEY, type OpSession, getSession } from '@/lib/session';
import './App.css';

type PlanAPage = 'games' | 'orders' | 'live-game' | 'sheets' | 'profile';

// ── Shared nav config ─────────────────────────────────────────────────────────

const PLAN_A_NAV: { page: PlanAPage; label: string; short: string; icon: React.ElementType }[] = [
  { page: 'games',     label: 'My Games',      short: 'Games',   icon: Globe        },
  { page: 'orders',    label: 'Orders',         short: 'Orders',  icon: ListOrdered  },
  { page: 'live-game', label: 'Live Game',      short: 'Live',    icon: Radio        },
  { page: 'sheets',    label: 'Sheet Library',  short: 'Sheets',  icon: Upload       },
  { page: 'profile',   label: 'Profile',        short: 'Profile', icon: UserCircle2  },
];

/* Every Plan B page, in sidebar order. The phone used to reach only the five
 * entries in PLAN_B_MOB below; the rest now live in the More sheet, which
 * renders this same list, so desktop and phone expose identical pages. */
const PLAN_B_SIDE: { page: AppPage; label: string; short?: string; icon: React.ElementType }[] = [
  { page: 'dashboard',        label: 'Dashboard',     short: 'Home',   icon: LayoutDashboard },
  { page: 'sheets',           label: 'Sheet Factory', short: 'Sheets', icon: Ticket          },
  { page: 'agents',           label: 'Agents',        icon: Users           },
  { page: 'players',          label: 'Players',       icon: UserCircle      },
  { page: 'pending-payments', label: 'Orders',        icon: ClipboardList   },
  { page: 'live-game',        label: 'Live Game',     short: 'Live',   icon: Radio           },
  { page: 'verifier',         label: 'Verifier',      icon: ScanSearch      },
  { page: 'prizes',           label: 'Prizes',        icon: Trophy          },
  { page: 'history',          label: 'History',       icon: History         },
  { page: 'settings',         label: 'My Games',      short: 'Games',  icon: Globe           },
  { page: 'profile',          label: 'Profile',       icon: UserCircle2     },
];

/* The four pages an operator touches mid-game get a permanent tab; the fifth
 * slot is the More sheet. */
const PLAN_B_MOB: { page: AppPage; label: string; short: string; icon: React.ElementType }[] = [
  { page: 'dashboard',        label: 'Dashboard', short: 'Home',   icon: LayoutDashboard },
  { page: 'live-game',        label: 'Live Game', short: 'Live',   icon: Radio           },
  { page: 'pending-payments', label: 'Orders',    short: 'Orders', icon: ShoppingBag     },
  { page: 'settings',         label: 'My Games',  short: 'Games',  icon: Globe           },
];

const PLAN_B_MOB_PAGES = new Set<string>(PLAN_B_MOB.map(n => n.page));
/* Plan A calls its order queue 'orders' where Plan B calls it
 * 'pending-payments'; the manifest shortcut carries Plan B's key, so alias it
 * rather than shipping a shortcut that lands on the wrong page. */
const PLAN_A_SHORTCUT_ALIASES: Record<string, PlanAPage> = { 'pending-payments': 'orders' };
const PLAN_A_PAGES = new Set<string>([
  ...PLAN_A_NAV.map(n => n.page),
  ...Object.keys(PLAN_A_SHORTCUT_ALIASES),
]);
const PLAN_B_PAGES = new Set<string>(PLAN_B_SIDE.map(n => n.page));

/* `?page=…` is how the installed app's home-screen shortcuts
 * (manifest.shortcuts in vite.config.ts) open straight onto a page. Returns
 * the requested page once, only if this plan actually has it. */
function useShortcutPage(valid: Set<string>, apply: (page: string) => void) {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('page');
    if (!requested || !valid.has(requested)) return;
    apply(requested);
    // Drop the param so a later reload doesn't yank the operator back here.
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    // Runs once on mount; `valid`/`apply` are stable for a given plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Login ─────────────────────────────────────────────────────────────────────

function Login({ onSuccess }: { onSuccess: (s: OpSession) => void }) {
  const [tab, setTab]       = useState<'login'|'signup'>('login');
  const [key, setKey]       = useState('');
  const [licKey, setLicKey] = useState('');
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [show, setShow]     = useState(false);
  const [status, setStatus] = useState<'idle'|'checking'|'error'>('idle');
  const [err, setErr]       = useState('');
  const [shake, setShake]   = useState(false);
  const ref  = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    setErr(''); setStatus('idle');
    setTimeout(() => (tab === 'login' ? ref : ref2).current?.focus(), 50);
  }, [tab]);

  const doShake = (msg: string) => {
    setStatus('error'); setErr(msg);
    setShake(true); setTimeout(() => setShake(false), 500);
  };

  const connect = async () => {
    const k = key.trim(); if (!k) return;
    setStatus('checking'); setErr('');
    try {
      const info = await mktGetInfo(k);
      const s: OpSession = { apiKey: k, operator: info.operator };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      if (info.operator.plan === 'generate') localStorage.setItem('tukpa-mkt-api-key', k);
      onSuccess(s);
    } catch (e) {
      setKey('');
      doShake(e instanceof Error ? e.message : 'Invalid key');
      setTimeout(() => ref.current?.focus(), 50);
    }
  };

  const signup = async () => {
    const lk = licKey.trim().toUpperCase();
    const n  = name.trim();
    if (!lk) { doShake('Enter your license key'); return; }
    if (!n)  { doShake('Enter your name'); return; }
    setStatus('checking'); setErr('');
    try {
      const res = await mktSignup(lk, n, email.trim() || undefined);
      const apiKey = res.operator.apiKey;
      const info   = await mktGetInfo(apiKey);
      const s: OpSession = { apiKey, operator: info.operator };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      // Login does this too. Without it a Plan B operator who signed up here
      // ran with no marketplace key on this device: My Games came up empty and
      // scheduled games never got a listing to publish.
      if (info.operator.plan === 'generate') localStorage.setItem('tukpa-mkt-api-key', apiKey);
      onSuccess(s);
    } catch (e) {
      doShake(e instanceof Error ? e.message : 'Signup failed');
    }
  };

  const busy = status === 'checking';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)' }}>
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto shadow-lg">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">TukpaMaster</h1>
          <p className="text-white/60 text-sm">Operator Portal</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden" style={shake ? { animation: 'shake .4s ease' } : {}}>
          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {(['login','signup'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-3 text-xs font-black uppercase tracking-wide transition-colors',
                  tab === t ? 'text-violet-700 border-b-2 border-violet-600' : 'text-slate-400 hover:text-slate-600')}>
                {t === 'login' ? 'Login' : 'New Account'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {tab === 'login' ? (
              <>
                <div className="relative">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">API Key</label>
                  <input ref={ref} type={show ? 'text' : 'password'} value={key}
                    onChange={e => { setKey(e.target.value); setStatus('idle'); setErr(''); }}
                    onKeyDown={e => e.key === 'Enter' && connect()}
                    placeholder="Paste your operator API key…"
                    className="w-full border-2 border-slate-100 focus:border-violet-400 rounded-2xl px-4 py-3 pr-10 text-sm font-mono focus:outline-none transition-colors"
                  />
                  <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 bottom-3 text-slate-300 hover:text-slate-500">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {status === 'error' && <p className="text-xs text-red-500 font-medium">✕ {err}</p>}
                <button onClick={connect} disabled={busy || !key.trim()}
                  className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#5b21b6' }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In →'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">License Key</label>
                  <input ref={ref2} type="text" value={licKey}
                    onChange={e => { setLicKey(e.target.value.toUpperCase()); setStatus('idle'); setErr(''); }}
                    onKeyDown={e => e.key === 'Enter' && signup()}
                    placeholder="TBM-XXXX-XXXX-XXXX"
                    className="w-full border-2 border-slate-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none transition-colors uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Your Name</label>
                  <input type="text" value={name}
                    onChange={e => { setName(e.target.value); setStatus('idle'); setErr(''); }}
                    placeholder="Operator / Business name"
                    className="w-full border-2 border-slate-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Email <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setStatus('idle'); setErr(''); }}
                    placeholder="you@example.com"
                    className="w-full border-2 border-slate-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  />
                </div>
                {status === 'error' && <p className="text-xs text-red-500 font-medium">✕ {err}</p>}
                <button onClick={signup} disabled={busy || !licKey.trim() || !name.trim()}
                  className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#5b21b6' }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Account →'}
                </button>
              </>
            )}
            <p className="text-[10px] text-slate-300 text-center">
              <a href="/terms.html" target="_blank" className="underline hover:text-slate-500">Terms &amp; Conditions</a>
              {' · '}
              <a href="/privacy.html" target="_blank" className="underline hover:text-slate-500">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ── Plan A ────────────────────────────────────────────────────────────────────

function PlanAApp({ session, onLogout }: { session: OpSession; onLogout: () => void }) {
  const [page, setPage] = useState<PlanAPage>('games');
  const [splash, setSplash] = useState(true);
  const [menu, setMenu] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplash(false), 1400); return () => clearTimeout(t); }, []);
  useShortcutPage(PLAN_A_PAGES, p => setPage(PLAN_A_SHORTCUT_ALIASES[p] ?? (p as PlanAPage)));

  const pageLabel = PLAN_A_NAV.find(n => n.page === page)?.label ?? 'TukpaMaster';

  function renderPage() {
    switch (page) {
      case 'games':     return <GamesHome apiKey={session.apiKey} initialOperator={session.operator} />;
      case 'orders':    return <PlanAOrders apiKey={session.apiKey} />;
      case 'live-game': return <PlanALiveGame apiKey={session.apiKey} />;
      case 'sheets':    return <SheetLibrary apiKey={session.apiKey} />;
      case 'profile':   return <Settings apiKey={session.apiKey} initOperator={session.operator} onLogout={onLogout} />;
    }
  }

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-[100dvh] w-screen overflow-hidden" style={{ backgroundColor: '#2e1065' }}>

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex w-52 flex-col shrink-0 pl-safe" style={{ background: 'linear-gradient(180deg,#5b21b6,#2e1065)' }}>
          <div className="px-4 py-5 border-b border-white/10 pt-safe">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Dice5 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight">TukpaMaster</p>
                <p className="text-[10px] text-white/40 truncate">{session.operator.name}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {PLAN_A_NAV.map(n => (
              <NavItem key={n.page} page={n.page} label={n.label} icon={n.icon} active={page === n.page} onClick={() => setPage(n.page)} />
            ))}
          </nav>
          <div className="p-3 border-t border-white/10 shrink-0">
            <p className="text-[10px] text-white/25 px-3">Plan A · Own Sheets</p>
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Topbar — pt-safe keeps it clear of the notch in standalone mode */}
          <div className="shrink-0 border-b border-white/5 pt-safe" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div className="h-12 flex items-center gap-2 px-3 md:px-4">
              <button
                className="md:hidden -ml-1 p-2 text-white/60 hover:text-white"
                aria-label="Open menu"
                onClick={() => setMenu(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-white/70 flex-1 truncate">{pageLabel}</span>
            </div>
          </div>
          {/* Page */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:p-6 pb-nav md:pb-6">{renderPage()}</main>
        </div>

        {/* ── Mobile bottom nav ── */}
        <BottomNav
          items={PLAN_A_NAV}
          currentPage={page}
          onSelect={p => setPage(p as PlanAPage)}
        />

        {/* ── Mobile full menu ── */}
        <MoreSheet
          open={menu}
          onClose={() => setMenu(false)}
          title="TukpaMaster"
          subtitle={session.operator.name}
          items={PLAN_A_NAV}
          currentPage={page}
          onSelect={p => setPage(p as PlanAPage)}
          planLabel="Plan A · Own Sheets"
          onLogout={onLogout}
        />

        <Toaster position="top-center" />
      </div>
    </>
  );
}

// ── Plan B ────────────────────────────────────────────────────────────────────

function PlanBApp({ session, onLogout }: { session: OpSession; onLogout: () => void }) {
  const tambola = useTambola();
  const [splash, setSplash] = useState(true);
  const [menu, setMenu] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplash(false), 1400); return () => clearTimeout(t); }, []);
  useShortcutPage(PLAN_B_PAGES, p => tambola.setCurrentPage(p as AppPage));

  const PAGE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard', sheets: 'Sheet Factory', agents: 'Agents',
    players: 'Players', 'live-game': 'Live Game', verifier: 'Verifier',
    prizes: 'Prizes', history: 'History', marketplace: 'Marketplace',
    'pending-payments': 'Orders', settings: 'My Games', profile: 'Profile',
  };

  const renderPage = () => {
    switch (tambola.currentPage) {
      case 'dashboard':        return <Dashboard tambola={tambola} />;
      case 'sheets':           return <SheetFactory tambola={tambola} />;
      case 'agents':           return <AgentNetwork tambola={tambola} />;
      case 'players':          return <PlayerRegistry tambola={tambola} />;
      case 'live-game':        return <LiveGame tambola={tambola} />;
      case 'verifier':         return <SmartVerifier tambola={tambola} />;
      case 'prizes':           return <PrizeManager tambola={tambola} />;
      case 'history':          return <GameHistory tambola={tambola} />;
      case 'marketplace':      return <Marketplace />;
      case 'pending-payments': return <PendingPayments tambola={tambola} />;
      case 'settings':         return <GamesHome apiKey={tambola.mktApiKey ?? ''} />;
      case 'profile':          return <Settings tambola={tambola} onLogout={onLogout} />;
      default:                 return <Dashboard tambola={tambola} />;
    }
  };

  const pending = tambola.stats.pendingOrders;

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-[100dvh] w-screen overflow-hidden" style={{ backgroundColor: '#2e1065' }}>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-52 flex-col shrink-0 pl-safe" style={{ background: 'linear-gradient(180deg,#5b21b6,#2e1065)' }}>
          <div className="px-4 py-5 border-b border-white/10 pt-safe">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Dice5 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight">TukpaMaster</p>
                <p className="text-[10px] text-white/40 truncate">{session.operator.name}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {PLAN_B_SIDE.map(n => (
              <NavItem key={n.page} page={n.page} label={n.label} icon={n.icon}
                active={tambola.currentPage === n.page}
                badge={n.page === 'pending-payments' ? pending : undefined}
                onClick={() => tambola.setCurrentPage(n.page)} />
            ))}
          </nav>
          <div className="p-3 border-t border-white/10 shrink-0">
            <p className="text-[10px] text-white/25 px-3">Plan B · Generate</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Topbar — pt-safe keeps it clear of the notch in standalone mode */}
          <div className="shrink-0 border-b border-white/5 pt-safe" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div className="h-12 flex items-center gap-2 px-3 md:px-4">
              <button
                className="md:hidden -ml-1 p-2 text-white/60 hover:text-white"
                aria-label="Open menu"
                onClick={() => setMenu(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-white/70 flex-1 min-w-0 truncate">
                {PAGE_LABELS[tambola.currentPage] ?? tambola.currentPage}
              </span>
              <Header tambola={tambola} compact />
            </div>
          </div>
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:p-6 pb-nav md:pb-6">{renderPage()}</main>
        </div>

        {/* Mobile bottom nav — four live tabs plus the full menu */}
        <BottomNav
          items={PLAN_B_MOB}
          currentPage={tambola.currentPage}
          onSelect={p => tambola.setCurrentPage(p as AppPage)}
          badges={{ 'pending-payments': pending }}
          onMore={() => setMenu(true)}
          moreOpen={menu}
          moreIcon={MoreHorizontal}
          moreActive={!PLAN_B_MOB_PAGES.has(tambola.currentPage)}
        />

        {/* Mobile full menu — every sidebar page, nothing hidden off-screen */}
        <MoreSheet
          open={menu}
          onClose={() => setMenu(false)}
          title="TukpaMaster"
          subtitle={session.operator.name}
          items={PLAN_B_SIDE}
          currentPage={tambola.currentPage}
          onSelect={p => tambola.setCurrentPage(p as AppPage)}
          badges={{ 'pending-payments': pending }}
          planLabel="Plan B · Generate"
          onLogout={onLogout}
        />

        <Toaster position="top-center" />
      </div>
    </>
  );
}

// ── Gated root ────────────────────────────────────────────────────────────────

function GatedApp() {
  const [session, setSession] = useState<OpSession | null>(getSession);
  const logout = () => { localStorage.removeItem(SESSION_KEY); localStorage.removeItem('tukpa-mkt-api-key'); setSession(null); };
  if (!session) return <Login onSuccess={setSession} />;
  if (session.operator.plan === 'own-sheets') return <PlanAApp session={session} onLogout={logout} />;
  return <PlanBApp session={session} onLogout={logout} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/agent/:agentId" element={<AgentPortal />} />
      <Route path="/agent"          element={<AgentPortal />} />
      <Route path="/marketplace"    element={<Marketplace />} />
      <Route path="/*"              element={<GatedApp />} />
    </Routes>
  );
}

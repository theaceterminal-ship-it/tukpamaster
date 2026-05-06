import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  Dice5, Key, Eye, EyeOff, Loader2, Globe, Radio, Upload, Menu, X, UserCircle2,
} from 'lucide-react';
import { mktGetInfo, type MktOperator } from '@/services/marketplaceApi';
import { useTambola } from '@/hooks/useTambola';
import { Sidebar, MobileBottomNav } from '@/components/layout/Sidebar';
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
import { PlanALiveGame } from '@/components/plan-a/PlanALiveGame';
import { SheetLibrary } from '@/components/plan-a/SheetLibrary';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import './App.css';

const SESSION_KEY = 'tukpa-op-v2';
type OpSession = { apiKey: string; operator: MktOperator };

function getSession(): OpSession | null {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); }
  catch { return null; }
}

// ── Login screen ──────────────────────────────────────────────────────────────

function ApiKeyLogin({ onSuccess }: { onSuccess: (s: OpSession) => void }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const connect = async () => {
    const k = key.trim();
    if (!k) return;
    setStatus('checking'); setErr('');
    try {
      const info = await mktGetInfo(k);
      const s: OpSession = { apiKey: k, operator: info.operator };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      // store with the same key useTambola reads so marketplace data auto-loads for Plan B
      if (info.operator.plan === 'generate') {
        localStorage.setItem('tukpa-mkt-api-key', k);
      }
      onSuccess(s);
    } catch (e) {
      setStatus('error'); setErr(e instanceof Error ? e.message : 'Invalid key');
      setShake(true); setKey('');
      setTimeout(() => setShake(false), 500);
      setTimeout(() => ref.current?.focus(), 50);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ backgroundColor: '#0ea5e9' }}>
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto">
            <Dice5 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">TukpaMaster</h1>
          <p className="text-white/60 text-sm">Operator Portal</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-2xl space-y-3" style={shake ? { animation: 'shake 0.4s ease' } : {}}>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> Operator API Key
          </p>
          <div className="relative">
            <input
              ref={ref}
              type={show ? 'text' : 'password'}
              value={key}
              onChange={e => { setKey(e.target.value); setStatus('idle'); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && connect()}
              placeholder="Paste your API key…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {status === 'error' && <p className="text-xs text-red-500">✕ {err}</p>}
          <button
            onClick={connect}
            disabled={status === 'checking' || !key.trim()}
            className="w-full py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {status === 'checking' ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Sign In'}
          </button>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ── Plan A (Own Sheets) ───────────────────────────────────────────────────────

type PlanAPage = 'games' | 'live-game' | 'sheets' | 'profile';

const PLAN_A_SIDE_NAV: { page: PlanAPage; label: string; icon: React.ElementType }[] = [
  { page: 'games',     label: 'My Games',      icon: Globe         },
  { page: 'live-game', label: 'Live Game',      icon: Radio         },
  { page: 'sheets',    label: 'Sheet Library',  icon: Upload        },
  { page: 'profile',   label: 'Profile',        icon: UserCircle2   },
];

const PLAN_A_MOB_NAV: { page: PlanAPage; label: string; icon: React.ElementType }[] = [
  { page: 'games',     label: 'Games',    icon: Globe       },
  { page: 'live-game', label: 'Live',     icon: Radio       },
  { page: 'sheets',    label: 'Sheets',   icon: Upload      },
  { page: 'profile',   label: 'Profile',  icon: UserCircle2 },
];

const PLAN_A_LABELS: Record<PlanAPage, string> = {
  games:        'My Games',
  'live-game':  'Live Game',
  sheets:       'Sheet Library',
  profile:      'Profile',
};

function PlanAApp({ session, onLogout }: { session: OpSession; onLogout: () => void }) {
  const [page, setPage] = useState<PlanAPage>('games');
  const [splash, setSplash] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { const t = setTimeout(() => setSplash(false), 1500); return () => clearTimeout(t); }, []);

  function renderPage() {
    switch (page) {
      case 'games':     return <Settings apiKey={session.apiKey} initOperator={session.operator} />;
      case 'live-game': return <PlanALiveGame apiKey={session.apiKey} />;
      case 'sheets':    return <SheetLibrary apiKey={session.apiKey} />;
      case 'profile':   return <Settings apiKey={session.apiKey} initOperator={session.operator} initTab="profile" onLogout={onLogout} />;
    }
  }

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-[100dvh] w-screen overflow-hidden" style={{ backgroundColor: '#0ea5e9' }}>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-48 flex-col shrink-0 border-r border-black/10" style={{ backgroundColor: '#0284c7' }}>
          <div className="px-3.5 py-4 border-b border-black/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}>
                <Dice5 className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-none">TukpaMaster</p>
                <p className="text-[9px] text-white/40 truncate mt-0.5">{session.operator.name}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {PLAN_A_SIDE_NAV.map(item => {
              const active = page === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => setPage(item.page)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all',
                    active ? 'bg-black/25 text-white' : 'text-white/55 hover:bg-black/15 hover:text-white'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="h-11 flex items-center px-3 shrink-0 border-b border-black/10" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
            <button className="md:hidden p-1.5 rounded-lg text-white/60 mr-2" onClick={() => setDrawer(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-white/80 flex-1">{PLAN_A_LABELS[page]}</span>
          </div>
          <main className="flex-1 overflow-auto p-4 md:p-5 pb-[72px] md:pb-5">{renderPage()}</main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-black/15"
          style={{ backgroundColor: '#0284c7', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {PLAN_A_MOB_NAV.map(item => {
            const active = page === item.page;
            return (
              <button key={item.page} onClick={() => setPage(item.page)}
                className={cn('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-semibold relative transition-colors', active ? 'text-white' : 'text-white/45')}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />}
              </button>
            );
          })}
        </nav>

        {/* Mobile drawer */}
        {drawer && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <aside className="relative w-60 flex flex-col h-full" style={{ backgroundColor: '#0284c7' }}>
              <div className="px-4 py-4 border-b border-black/10 flex items-center justify-between">
                <p className="font-black text-white text-sm">TukpaMaster</p>
                <button onClick={() => setDrawer(false)} className="text-white/50 p-1"><X className="w-5 h-5" /></button>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                {PLAN_A_SIDE_NAV.map(item => {
                  const active = page === item.page;
                  return (
                    <button key={item.page} onClick={() => { setPage(item.page); setDrawer(false); }}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all', active ? 'bg-black/25 text-white' : 'text-white/55 hover:bg-black/15 hover:text-white')}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        <Toaster position="top-right" />
      </div>
    </>
  );
}

// ── Plan B (Generate per Game) ────────────────────────────────────────────────

function PlanBApp({ session, onLogout }: { session: OpSession; onLogout: () => void }) {
  const tambola = useTambola();
  const [splash, setSplash] = useState(true);

  useEffect(() => { const t = setTimeout(() => setSplash(false), 1500); return () => clearTimeout(t); }, []);

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
      case 'settings':         return <Settings tambola={tambola} />;
      case 'profile':          return <Settings tambola={tambola} initTab="profile" onLogout={onLogout} />;
      default:                 return <Dashboard tambola={tambola} />;
    }
  };

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-[100dvh] w-screen overflow-hidden" style={{ backgroundColor: '#0ea5e9' }}>
        <Sidebar
          currentPage={tambola.currentPage}
          onPageChange={tambola.setCurrentPage}
          pendingCount={tambola.stats.pendingOrders}
          operatorName={session.operator.name}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header tambola={tambola} />
          <main className="flex-1 overflow-auto p-4 md:p-5 pb-[72px] md:pb-5">{renderPage()}</main>
        </div>
        <MobileBottomNav
          currentPage={tambola.currentPage}
          onPageChange={tambola.setCurrentPage}
          pendingCount={tambola.stats.pendingOrders}
        />
        <Toaster position="top-right" />
      </div>
    </>
  );
}

// ── Gated root ────────────────────────────────────────────────────────────────

function GatedApp() {
  const [session, setSession] = useState<OpSession | null>(getSession);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('tukpa-mkt-api-key');
    setSession(null);
  };

  if (!session) return <ApiKeyLogin onSuccess={setSession} />;
  if (session.operator.plan === 'own-sheets') return <PlanAApp session={session} onLogout={handleLogout} />;
  return <PlanBApp session={session} onLogout={handleLogout} />;
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

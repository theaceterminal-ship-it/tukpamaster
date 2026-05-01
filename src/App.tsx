import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Dice5, Key, Eye, EyeOff, Loader2, Globe, Radio, Upload, LogOut } from 'lucide-react';
import { mktGetInfo, type MktOperator } from '@/services/marketplaceApi';
import { useTambola } from '@/hooks/useTambola';
import { Sidebar } from '@/components/layout/Sidebar';
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
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── API Key Login ─────────────────────────────────────────────────────────────

function ApiKeyLogin({ onSuccess }: { onSuccess: (s: OpSession) => void }) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleConnect = async () => {
    const k = key.trim();
    if (!k) return;
    setStatus('checking'); setErrMsg('');
    try {
      const info = await mktGetInfo(k);
      const session: OpSession = { apiKey: k, operator: info.operator };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      if (info.operator.plan === 'generate') {
        localStorage.setItem('tukpa-mkt-key', k);
      }
      onSuccess(session);
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Invalid API key');
      setShake(true); setKey('');
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">TukpaMaster</h1>
          <p className="text-white/70 text-sm">Operator Portal</p>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-2xl space-y-4"
          style={shake ? { animation: 'shake 0.4s ease' } : {}}
        >
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Key className="w-4 h-4" />
            <span className="text-sm font-medium">Enter your Operator API Key</span>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => { setKey(e.target.value); setStatus('idle'); setErrMsg(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="Paste API key…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {status === 'error' && (
            <p className="text-sm text-red-500">✕ {errMsg}</p>
          )}
          <button
            onClick={handleConnect}
            disabled={status === 'checking' || !key.trim()}
            className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {status === 'checking'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              : 'Sign In'
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  );
}

// ── Plan A App (Own Sheets) ───────────────────────────────────────────────────

type PlanAPage = 'market' | 'live-game' | 'load-sheets';

const PLAN_A_NAV: { page: PlanAPage; label: string; icon: React.ElementType }[] = [
  { page: 'market',      label: 'Market',      icon: Globe   },
  { page: 'live-game',   label: 'Live Game',   icon: Radio   },
  { page: 'load-sheets', label: 'Load Sheets', icon: Upload  },
];

const PLAN_A_LABELS: Record<PlanAPage, string> = {
  market:       'Marketplace',
  'live-game':  'Live Game',
  'load-sheets': 'Sheet Library',
};

function PlanAApp({ session, onLogout }: { session: OpSession; onLogout: () => void }) {
  const [page, setPage] = useState<PlanAPage>('market');
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

  function renderPage() {
    switch (page) {
      case 'market':      return <Settings apiKey={session.apiKey} initOperator={session.operator} />;
      case 'live-game':   return <PlanALiveGame apiKey={session.apiKey} />;
      case 'load-sheets': return <SheetLibrary apiKey={session.apiKey} />;
    }
  }

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#0ea5e9' }}>
        {/* Sidebar */}
        <aside className="w-52 flex flex-col shrink-0 border-r border-black/10" style={{ backgroundColor: '#0284c7' }}>
          <div className="px-4 py-5 border-b border-black/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}>
                <Dice5 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-white tracking-tight">TukpaMaster</p>
                <p className="text-[10px] text-white/50 font-medium uppercase tracking-widest">Own Sheets</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
            {PLAN_A_NAV.map(item => {
              const isActive = page === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => setPage(item.page)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-black/25 text-white shadow-inner'
                      : 'text-white/60 hover:bg-black/15 hover:text-white',
                  )}
                >
                  <item.icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-white/50')} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-2.5 border-t border-black/10 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/15">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{session.operator.name}</p>
                <p className="text-[10px] text-white/40">Plan A</p>
              </div>
              <button
                onClick={onLogout}
                className="text-white/40 hover:text-white/80 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className="h-12 flex items-center px-5 shrink-0 border-b border-black/10"
            style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
          >
            <span className="text-sm font-bold text-white/80">{PLAN_A_LABELS[page]}</span>
          </div>
          <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
        </div>

        <Toaster position="top-right" />
      </div>
    </>
  );
}

// ── Plan B App (Generate per Game) ───────────────────────────────────────────

function PlanBApp({ onLogout }: { onLogout: () => void }) {
  const tambola = useTambola();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

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
      default:                 return <Dashboard tambola={tambola} />;
    }
  };

  return (
    <>
      <Splash visible={splash} />
      <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#0ea5e9' }}>
        <Sidebar
          currentPage={tambola.currentPage}
          onPageChange={tambola.setCurrentPage}
          pendingCount={tambola.stats.pendingOrders}
          onLogout={onLogout}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header tambola={tambola} />
          <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
        </div>
        <Toaster position="top-right" />
      </div>
    </>
  );
}

// ── Gated App ─────────────────────────────────────────────────────────────────

function GatedApp() {
  const [session, setSession] = useState<OpSession | null>(getSession);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('tukpa-mkt-key');
    setSession(null);
  };

  if (!session) {
    return <ApiKeyLogin onSuccess={setSession} />;
  }

  if (session.operator.plan === 'own-sheets') {
    return <PlanAApp session={session} onLogout={handleLogout} />;
  }

  return <PlanBApp onLogout={handleLogout} />;
}

// ── Root ──────────────────────────────────────────────────────────────────────

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

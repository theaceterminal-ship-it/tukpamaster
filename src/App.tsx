import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Dice5, Eye, EyeOff, Lock } from 'lucide-react';
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
import { Toaster } from '@/components/ui/sonner';
import './App.css';

const OPERATOR_PASSWORD = 'pass1word2';
const SESSION_KEY = 'tukpa-op-auth';

function OperatorLogin({ onSuccess }: { onSuccess: () => void }) {
  const [value,   setValue]   = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error,   setError]   = useState('');
  const [shake,   setShake]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const attempt = () => {
    if (value === OPERATOR_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onSuccess();
    } else {
      setError('Incorrect password.');
      setShake(true);
      setValue('');
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
          className={`bg-white rounded-2xl p-6 shadow-2xl space-y-4 transition-transform ${shake ? 'animate-bounce' : ''}`}
          style={shake ? { animation: 'shake 0.4s ease' } : {}}
        >
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">Enter operator password</span>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type={showPwd ? 'text' : 'password'}
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="Password"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={attempt}
            disabled={!value.trim()}
            className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            Unlock
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

function OperatorApp() {
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
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header tambola={tambola} />
          <main className="flex-1 overflow-auto p-6">
            {renderPage()}
          </main>
        </div>
        <Toaster position="top-right" />
      </div>
    </>
  );
}

function GatedOperatorApp() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  if (!authed) return <OperatorLogin onSuccess={() => setAuthed(true)} />;
  return <OperatorApp />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/agent/:agentId" element={<AgentPortal />} />
      <Route path="/agent"          element={<AgentPortal />} />
      <Route path="/marketplace"    element={<Marketplace />} />
      <Route path="/*"              element={<GatedOperatorApp />} />
    </Routes>
  );
}

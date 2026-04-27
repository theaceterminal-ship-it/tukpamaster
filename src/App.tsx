import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
      <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#e8622a' }}>
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

export default function App() {
  return (
    <Routes>
      <Route path="/agent/:agentId" element={<AgentPortal />} />
      <Route path="/marketplace"    element={<Marketplace />} />
      <Route path="/*"              element={<OperatorApp />} />
    </Routes>
  );
}

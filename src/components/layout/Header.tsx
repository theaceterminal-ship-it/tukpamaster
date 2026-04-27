import { CircleDot, Gamepad2 } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';

interface HeaderProps {
  tambola: ReturnType<typeof useTambola>;
}

const PAGE_LABELS: Record<string, string> = {
  dashboard:          'Dashboard',
  sheets:             'Sheet Factory',
  agents:             'Agents',
  players:            'Players',
  'live-game':        'Live Game',
  verifier:           'Verifier',
  prizes:             'Prizes',
  history:            'History',
  marketplace:        'Marketplace',
  'pending-payments': 'Payments',
};

export function Header({ tambola }: HeaderProps) {
  const { currentGame, currentPage } = tambola;
  const isLive = currentGame?.status === 'active';

  return (
    <div className="h-12 flex items-center justify-between px-5 shrink-0 border-b border-black/10"
      style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
      <span className="text-sm font-bold text-white/80">
        {PAGE_LABELS[currentPage] ?? currentPage}
      </span>

      <div className="flex items-center gap-3">
        {currentGame && (
          <button
            onClick={() => tambola.setCurrentPage('live-game')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-white/50" />
            <span className="text-xs font-semibold text-white/70 max-w-[120px] truncate">{currentGame.name}</span>
            <span className="text-xs text-white/40 tabular-nums">{currentGame.calledNumbers.length}/90</span>
          </button>
        )}
        {isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20">
            <CircleDot className="w-3 h-3 text-red-300 animate-pulse" />
            <span className="text-xs font-bold text-red-300 uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>
    </div>
  );
}

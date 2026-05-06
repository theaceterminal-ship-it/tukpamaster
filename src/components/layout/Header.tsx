import { CircleDot, Gamepad2 } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';

interface HeaderProps {
  tambola: ReturnType<typeof useTambola>;
  compact?: boolean;
}

export function Header({ tambola, compact }: HeaderProps) {
  const { currentGame } = tambola;
  const isLive = currentGame?.status === 'active';

  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        {currentGame && (
          <button onClick={() => tambola.setCurrentPage('live-game')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="max-w-[100px] truncate">{currentGame.name}</span>
            <span className="text-white/30 tabular-nums">{currentGame.calledNumbers.length}/90</span>
          </button>
        )}
        {isLive && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20">
            <CircleDot className="w-2.5 h-2.5 text-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

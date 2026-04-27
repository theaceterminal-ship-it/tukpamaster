import { useState } from 'react';
import { History, Calendar, DollarSign, Clock, Trophy, TrendingUp, Trash2 } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

interface GameHistoryProps {
  tambola: ReturnType<typeof useTambola>;
}

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

export function GameHistory({ tambola }: GameHistoryProps) {
  const { gameHistory, stats } = tambola;
  const [confirmClear, setConfirmClear] = useState(false);

  const totalPrizeDistributed = gameHistory.reduce((sum, g) => sum + g.totalPrizeDistributed, 0);
  const totalWinners          = gameHistory.reduce((sum, g) => sum + g.winners.length, 0);
  const avgGameDuration       = gameHistory.length > 0
    ? Math.round(gameHistory.reduce((sum, g) => sum + g.duration, 0) / gameHistory.length)
    : 0;

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6" style={{ color: '#0ea5e9' }} />
            Game History
          </h2>
          <p className="text-slate-500 mt-1">View all past games, winners, and statistics.</p>
        </div>
        {gameHistory.length > 0 && (
          <Button
            variant="outline"
            className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="w-4 h-4" /> Clear History
          </Button>
        )}
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clear All History?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 py-2">This will permanently delete all {gameHistory.length} game records. This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
              onClick={() => { tambola.setGameHistory([]); setConfirmClear(false); }}
            >
              Yes, Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-4 w-full">
        {[
          { label: 'Total Games',    value: stats.totalGames,                         icon: History   },
          { label: 'Total Prizes',   value: `₹${totalPrizeDistributed.toLocaleString()}`, icon: DollarSign, str: true },
          { label: 'Total Winners',  value: totalWinners,                             icon: Trophy    },
          { label: 'Avg Duration',   value: `${avgGameDuration} min`,                 icon: Clock, str: true },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={CARD}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
              <s.icon className="w-4 h-4" style={{ color: '#0ea5e9' }} />
            </div>
            <div>
              <p className="text-xl font-black text-slate-800 tabular-nums">
                {s.str ? s.value : (s.value as number).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content: Games list + Activity ── */}
      {gameHistory.length === 0 ? (
        <div className="rounded-2xl p-14 text-center" style={CARD}>
          <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">No games played yet.</p>
          <p className="text-sm text-slate-400 mt-1">Start your first game from the Live Game page!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 w-full items-start">

          {/* Games list — 2 cols wide */}
          <div className="col-span-2 rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">All Games</p>
            <div className="space-y-3">
              {gameHistory.slice().reverse().map(game => (
                <div key={game.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="p-3.5 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{game.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>{new Date(game.date).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{game.duration} min</span>
                          <span>{game.calledNumbersCount} numbers called</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800 tabular-nums">₹{game.totalPrizeDistributed.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{game.winners.length} winner{game.winners.length !== 1 ? 's' : ''}</p>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">Completed</Badge>
                    </div>
                  </div>

                  {game.winners.length > 0 && (
                    <div className="px-3.5 pb-3 pt-2.5 border-t border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {game.winners.map(winner => (
                          <div key={winner.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-emerald-600">
                                {winner.playerName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-slate-700">{winner.playerName}</span>
                            <span className="text-xs text-slate-400">{winner.dividendName}</span>
                            <span className="text-xs font-black text-emerald-600 tabular-nums">₹{winner.prize.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity + summary — 1 col */}
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={CARD}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Activity Heatmap</p>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 28 }, (_, i) => {
                  const dayGames = gameHistory.filter(g => {
                    const date = new Date(g.date);
                    return date.getDay() === (i % 7);
                  }).length;
                  const intensity = Math.min(dayGames * 0.3 + 0.1, 1);
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: `rgba(232,98,42,${intensity})`,
                        color: intensity > 0.5 ? 'white' : '#94a3b8',
                      }}
                    >
                      {dayGames > 0 ? dayGames : ''}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">Activity heatmap · 28 game days</p>
            </div>

            {/* Top earners */}
            <div className="rounded-2xl p-5" style={CARD}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Top Games by Prize</p>
              <div className="space-y-2">
                {[...gameHistory]
                  .sort((a, b) => b.totalPrizeDistributed - a.totalPrizeDistributed)
                  .slice(0, 5)
                  .map((g, i) => (
                    <div key={g.id} className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                        style={{ backgroundColor: i === 0 ? 'rgba(232,98,42,0.12)' : '#f5f5f5', color: i === 0 ? '#0ea5e9' : '#9ca3af' }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{g.name}</p>
                        <p className="text-[11px] text-slate-400">{new Date(g.date).toLocaleDateString()}</p>
                      </div>
                      <span className="text-sm font-black tabular-nums shrink-0" style={{ color: '#0ea5e9' }}>
                        ₹{g.totalPrizeDistributed.toLocaleString()}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

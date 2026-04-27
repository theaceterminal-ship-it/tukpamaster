import { useMemo } from 'react';
import {
  CheckCircle2, XCircle, Radio, Ticket,
  Users, Wallet, Calendar, ArrowRight, Clock,
  TrendingUp, Package, Star, ExternalLink,
} from 'lucide-react';
import type { Dividend, DividendType } from '@/types';
import type { useTambola } from '@/hooks/useTambola';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  tambola: ReturnType<typeof useTambola>;
}

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

const CHIP_COLORS: Record<string, string> = {
  'early-five':        'bg-sky-500/20 text-sky-200 border border-sky-400/30',
  'early-six':         'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30',
  'early-seven':       'bg-blue-500/20 text-blue-200 border border-blue-400/30',
  'top-line':          'bg-orange-500/20 text-orange-200 border border-orange-400/30',
  'middle-line':       'bg-purple-500/20 text-purple-200 border border-purple-400/30',
  'bottom-line':       'bg-pink-500/20 text-pink-200 border border-pink-400/30',
  'corners':           'bg-teal-500/20 text-teal-200 border border-teal-400/30',
  'sheet-corner':      'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30',
  'full-house':        'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
  'second-full-house': 'bg-lime-500/20 text-lime-200 border border-lime-400/30',
  'third-full-house':  'bg-yellow-500/20 text-yellow-200 border border-yellow-400/30',
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Dashboard({ tambola }: DashboardProps) {
  const {
    scheduledGames, sheets, orders, agents,
    currentGame, setCurrentPage,
    confirmOrder, rejectOrder, createGame, linkScheduledGame,
  } = tambola;

  // ── Focused game ────────────────────────────────────────────────────────────
  const focusedGame = useMemo(() => {
    if (!scheduledGames.length) return null;
    if (currentGame?.status === 'active') {
      const linked = scheduledGames.find(g => g.sessionId === currentGame.id);
      if (linked) return linked;
    }
    const now = new Date();
    const todayStr = now.toDateString();
    const today = scheduledGames.find(g => new Date(g.scheduledAt).toDateString() === todayStr);
    if (today) return today;
    const upcoming = [...scheduledGames]
      .filter(g => new Date(g.scheduledAt) > now)
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    if (upcoming.length) return upcoming[0];
    return [...scheduledGames].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0];
  }, [scheduledGames, currentGame]);

  const isLive = !!(currentGame && focusedGame?.sessionId === currentGame.id && currentGame.status === 'active');

  // ── Game-scoped sheets & orders ─────────────────────────────────────────────
  const gameSheets = useMemo(() =>
    focusedGame ? sheets.filter(s => focusedGame.sheetIds.includes(s.id)) : [],
    [focusedGame, sheets]
  );
  const gameOrders = useMemo(() =>
    focusedGame
      ? orders.filter(o => o.sheetIds.some(sid => focusedGame.sheetIds.includes(sid)))
      : [],
    [focusedGame, orders]
  );

  const agentPerf = useMemo(() =>
    agents
      .map(a => {
        const ag = gameSheets.filter(s => s.assignedTo === a.id);
        const sold = ag.filter(s => s.status === 'sold').length;
        return {
          id: a.id, name: a.name, total: ag.length, sold,
          revenue: sold * (focusedGame?.ticketPrice ?? 0),
          pct: ag.length > 0 ? Math.round(sold / ag.length * 100) : 0,
        };
      })
      .filter(a => a.total > 0)
      .sort((a, b) => b.sold - a.sold),
    [agents, gameSheets, focusedGame]
  );

  // ── Collection ──────────────────────────────────────────────────────────────
  const todayStr = new Date().toDateString();
  const todayConfirmed = useMemo(() =>
    orders.filter(o => o.status === 'confirmed' && o.confirmedAt && new Date(o.confirmedAt).toDateString() === todayStr),
    [orders, todayStr]
  );
  const confirmedAmount = todayConfirmed.reduce((s, o) => s + o.amount, 0);
  const allPending      = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
  const pendingAmount   = allPending.reduce((s, o) => s + o.amount, 0);

  // ── Launch ──────────────────────────────────────────────────────────────────
  const handleLaunch = () => {
    if (!focusedGame) return;
    const dividends: Dividend[] = focusedGame.prizes.map((p, i) => ({
      id: `DIV-${Date.now()}-${i}`,
      type: p.type as DividendType,
      name: p.label,
      prize: p.amount,
      claimed: false,
    }));
    if (focusedGame.hasJackpot) {
      dividends.push({ id: `DIV-${Date.now()}-jp`, type: 'full-house', name: 'Jackpot', prize: focusedGame.jackpotAmount, claimed: false });
    }
    const game = createGame(focusedGame.name, focusedGame.sheetIds, dividends);
    linkScheduledGame(focusedGame.id, game.id);
    setCurrentPage('live-game');
  };

  // ── No game ─────────────────────────────────────────────────────────────────
  if (!focusedGame) {
    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
            <p className="text-slate-500 text-sm mt-0.5">Operator overview for today's game.</p>
          </div>
          <Button onClick={() => window.open('/marketplace', '_blank')} variant="outline" className="gap-2 font-semibold">
            <ExternalLink className="w-4 h-4" /> Marketplace
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={CARD}>
            <Calendar className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-black text-gray-900">No game scheduled</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">Schedule a game to see it here as your dashboard hub</p>
            <Button onClick={() => setCurrentPage('live-game')} className="w-full font-bold text-white" style={{ backgroundColor: '#0ea5e9' }}>
              Schedule a Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalSheets = gameSheets.length;
  const sold        = gameSheets.filter(s => s.status === 'sold').length;
  const assigned    = gameSheets.filter(s => s.status === 'assigned').length;
  const available   = gameSheets.filter(s => s.status === 'available').length;
  const revenue     = sold * focusedGame.ticketPrice;
  const gamePending = gameOrders.filter(o => o.status === 'pending').length;
  const soldPct     = totalSheets > 0 ? Math.round((sold / totalSheets) * 100) : 0;
  const assignedPct = totalSheets > 0 ? Math.round((assigned / totalSheets) * 100) : 0;
  const totalPrize  = focusedGame.prizes.reduce((s, p) => s + p.amount, 0) + (focusedGame.hasJackpot ? focusedGame.jackpotAmount : 0);
  const hasBg       = !!focusedGame.backgroundImage;

  return (
    <div className="space-y-4 w-full">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">Operator overview for today's game.</p>
        </div>
        <Button
          onClick={() => window.open('/marketplace', '_blank')}
          variant="outline"
          className="gap-2 font-semibold"
        >
          <ExternalLink className="w-4 h-4" /> Marketplace
        </Button>
      </div>

      {/* ── HERO: Full-width game banner ─────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={hasBg
          ? { backgroundImage: `url(${focusedGame.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' }
        }
      >
        {/* Blobs */}
        {!hasBg && (
          <>
            <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
          </>
        )}
        {hasBg && <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/60 to-slate-900/20 pointer-events-none" />}

        {/* Jackpot badge */}
        {focusedGame.hasJackpot && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-yellow-400/20 border border-yellow-400/50 backdrop-blur-sm rounded-full px-3 py-1 z-10">
            <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
            <span className="text-yellow-200 text-xs font-black uppercase tracking-wide">Jackpot ₹{focusedGame.jackpotAmount.toLocaleString()}</span>
          </div>
        )}

        <div className="relative flex items-center justify-between gap-8 px-7 py-6">
          {/* Left: label + name + chips */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center gap-2">
              {isLive
                ? <><span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" /><span className="text-xs font-bold text-red-300 uppercase tracking-widest">Live Now</span></>
                : <><Calendar className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(focusedGame.scheduledAt).toDateString() === todayStr ? "Today's Game" : "Next Scheduled Game"}
                  </span></>
              }
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-xs text-slate-400">
                {new Date(focusedGame.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' '}at{' '}
                {new Date(focusedGame.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>

            <h1 className="text-3xl font-black text-white uppercase leading-tight tracking-tight truncate">
              {focusedGame.name}
            </h1>

            <div className="flex flex-wrap gap-1.5">
              {focusedGame.prizes.map(p => (
                <span key={p.type} className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/10 shrink-0" />

          {/* Center: prize pool + ticket price */}
          <div className="text-center shrink-0">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Prize Pool</p>
            <p className="text-4xl font-black text-white tabular-nums">₹{totalPrize.toLocaleString()}</p>
            <p className="text-sm font-bold text-amber-400 mt-1">₹{focusedGame.ticketPrice}/sheet</p>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/10 shrink-0" />

          {/* Right: launch CTA */}
          <div className="shrink-0">
            {isLive ? (
              <Button
                onClick={() => setCurrentPage('live-game')}
                className="gap-2.5 font-bold text-white px-6 py-2.5 text-sm"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                <Radio className="w-4 h-4 animate-pulse" /> Open Live Game
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                className="gap-2.5 font-bold text-white px-6 py-2.5 text-sm"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                <Radio className="w-4 h-4" /> Launch Game
              </Button>
            )}
            <button
              onClick={() => setCurrentPage('live-game')}
              className="w-full mt-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
            >
              All games <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 w-full">
        {[
          { label: 'Sheets Sold',    value: sold,                                      icon: Ticket,   color: 'text-emerald-600' },
          { label: 'Available',      value: available,                                 icon: Package,  color: 'text-gray-900' },
          { label: 'Revenue',        value: `₹${revenue.toLocaleString()}`,            icon: Wallet,   color: 'text-gray-900', str: true },
          { label: 'Pending Orders', value: gamePending, icon: Clock, color: gamePending > 0 ? 'text-red-500' : 'text-gray-900', alert: gamePending > 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={CARD}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
              <s.icon className="w-4 h-4" style={{ color: '#0ea5e9' }} />
            </div>
            <div>
              <p className={`text-xl font-black tabular-nums leading-none ${s.color}`}>
                {s.str ? s.value : (s.value as number).toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID: 3 columns, full width ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 w-full">

        {/* ── Col 1: Sheet Sales Overview ─── */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Sheet Sales Overview</p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total',     value: totalSheets, color: 'text-gray-900' },
              { label: 'Assigned',  value: assigned,    color: 'text-blue-600' },
              { label: 'Sold',      value: sold,        color: 'text-emerald-600' },
              { label: 'Available', value: available,   color: 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-2">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${soldPct}%` }} />
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${assignedPct}%` }} />
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Sold {soldPct}%
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Assigned {assignedPct}%
              </span>
              <span className="ml-auto text-sm font-black" style={{ color: '#0ea5e9' }}>
                ₹{revenue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── Col 2: Agent Performance ─── */}
        <div className="rounded-2xl p-5 flex flex-col" style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Agent Performance</p>
            <TrendingUp className="w-4 h-4 text-gray-300" />
          </div>

          {agentPerf.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <Users className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No agents assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {agentPerf.slice(0, 5).map((a, i) => (
                <div key={a.id} className="flex items-center gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ backgroundColor: i === 0 ? 'rgba(232,98,42,0.12)' : '#f5f5f5', color: i === 0 ? '#0ea5e9' : '#9ca3af' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-900 truncate">{a.name}</span>
                      <span className="text-xs text-gray-400 tabular-nums shrink-0 ml-2">{a.sold}/{a.total} · ₹{a.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${a.pct}%`, backgroundColor: '#0ea5e9' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setCurrentPage('agents')}
            className="w-full mt-4 text-xs font-semibold flex items-center justify-center gap-1 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            style={{ color: '#0ea5e9' }}
          >
            Full breakdown <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* ── Col 3: Pending Orders + Today's Collection ─── */}
        <div className="flex flex-col gap-4">

          {/* Pending Orders */}
          <div className="rounded-2xl p-5 flex-1" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pending Orders</p>
              {allPending.length > 0 && (
                <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5">
                  {allPending.length}
                </span>
              )}
            </div>
            {allPending.length === 0 ? (
              <div className="py-3 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <p className="text-sm text-gray-400">All orders cleared</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {allPending.slice(0, 3).map(order => (
                    <div key={order.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{order.playerName}</p>
                        <p className="text-[11px] text-gray-400">
                          {order.sheetIds.length} sheet{order.sheetIds.length !== 1 ? 's' : ''} · ₹{order.amount} · {timeAgo(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => confirmOrder(order.id)} className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center hover:bg-emerald-200 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button onClick={() => rejectOrder(order.id)} className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center hover:bg-red-200 transition-colors">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {allPending.length > 3 && (
                  <button
                    onClick={() => setCurrentPage('pending-payments')}
                    className="w-full mt-2 text-xs font-semibold flex items-center justify-center gap-1 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                    style={{ color: '#0ea5e9' }}
                  >
                    +{allPending.length - 3} more <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Today's Collection */}
          <div className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Today's Collection</p>
              <Wallet className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Confirmed</p>
                <p className="text-2xl font-black text-gray-900 tabular-nums">₹{confirmedAmount.toLocaleString()}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{todayConfirmed.length} order{todayConfirmed.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="w-px self-stretch bg-gray-100" />
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Pending</p>
                <p className="text-2xl font-black tabular-nums" style={{ color: '#0ea5e9' }}>+₹{pendingAmount.toLocaleString()}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{allPending.length} awaiting</p>
              </div>
            </div>
            {allPending.length > 0 && (
              <button
                onClick={() => setCurrentPage('pending-payments')}
                className="w-full mt-3 text-xs font-semibold flex items-center justify-center gap-1 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                style={{ color: '#0ea5e9' }}
              >
                Review payments <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

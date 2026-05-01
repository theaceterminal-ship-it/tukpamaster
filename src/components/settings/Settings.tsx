import { useState, useEffect, useCallback } from 'react';
import {
  Key, CheckCircle, XCircle, Loader2, Link2, Unlink,
  Globe, Plus, Trash2, RefreshCw, ShoppingBag,
  Check, X, Calendar,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import {
  mktGetInfo, mktGetPurchases, mktCreateGame, mktAssignSheets,
  mktSetStatus, mktDeleteGame, mktApprovePurchase,
  type MktGame, type MktPurchase, type MktOperator,
} from '@/services/marketplaceApi';
import { cn } from '@/lib/utils';

interface SettingsProps {
  tambola?: ReturnType<typeof useTambola>;
  apiKey?: string;
  initOperator?: MktOperator;
}

type Tab = 'connect' | 'games' | 'sales';

const PRIZE_TYPES = [
  { type: 'full-house',        label: 'Full House',        def: 5000 },
  { type: 'second-full-house', label: 'Second Full House', def: 3000 },
  { type: 'third-full-house',  label: 'Third Full House',  def: 2000 },
  { type: 'upper-line',        label: 'Upper Line',        def: 1000 },
  { type: 'middle-line',       label: 'Middle Line',       def: 1000 },
  { type: 'bottom-line',       label: 'Bottom Line',       def: 1000 },
  { type: 'ticket-corners',    label: 'Ticket Corners',    def: 500  },
  { type: 'sheet-corner',      label: 'Sheet Corner',      def: 2000 },
  { type: 'early-5',           label: 'Early 5',           def: 500  },
  { type: 'early-6',           label: 'Early 6',           def: 600  },
  { type: 'early-7',           label: 'Early 7',           def: 700  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft:  'bg-slate-100 text-slate-600',
  listed: 'bg-emerald-100 text-emerald-700',
  ended:  'bg-red-100 text-red-600',
};

export function Settings({ tambola, apiKey, initOperator }: SettingsProps) {
  const effectiveKey = apiKey ?? tambola?.mktApiKey ?? '';
  const setEffectiveKey = tambola?.setMktApiKey ?? (() => {});
  const isPlanA = !!apiKey;

  const [tab, setTab] = useState<Tab>(() => {
    if (isPlanA) return 'games';
    return effectiveKey ? 'games' : 'connect';
  });
  const [inputKey, setInputKey] = useState(effectiveKey);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>(effectiveKey ? 'ok' : 'idle');
  const [errMsg, setErrMsg] = useState('');
  const [operator, setOperator] = useState<MktOperator | null>(initOperator ?? null);

  const [games, setGames] = useState<MktGame[]>([]);
  const [purchases, setPurchases] = useState<MktPurchase[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // create-game form
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState('');
  const [cDate, setCDate] = useState('');
  const [cPrice, setCPrice] = useState(100);
  const [cPrizes, setCPrizes] = useState<Record<string, number>>({ 'full-house': 5000 });
  const [creating, setCreating] = useState(false);

  // sheet assignment
  const [assignGame, setAssignGame] = useState<string | null>(null);
  const [assignFrom, setAssignFrom] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);

  const isConnected = keyStatus === 'ok' && !!effectiveKey;
  const availableTabs: Tab[] = isPlanA ? ['games', 'sales'] : ['connect', 'games', 'sales'];

  const loadData = useCallback(async (key = effectiveKey) => {
    if (!key) return;
    setDataLoading(true);
    try {
      const [info, purch] = await Promise.all([
        mktGetInfo(key),
        mktGetPurchases(key),
      ]);
      setOperator(info.operator);
      setGames(info.games);
      setPurchases(purch.purchases);
    } catch {
      // silent — data stays stale
    } finally {
      setDataLoading(false);
    }
  }, [effectiveKey]);

  useEffect(() => {
    if (effectiveKey && keyStatus === 'ok') loadData(effectiveKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectKey() {
    const k = inputKey.trim();
    if (!k) return;
    setKeyStatus('checking'); setErrMsg('');
    try {
      const info = await mktGetInfo(k);
      setEffectiveKey(k);
      setOperator(info.operator);
      setGames(info.games);
      setKeyStatus('ok');
      // load purchases too
      const purch = await mktGetPurchases(k);
      setPurchases(purch.purchases);
      setTab('games');
    } catch (e) {
      setKeyStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  function disconnectKey() {
    setEffectiveKey(''); setInputKey('');
    setKeyStatus('idle'); setOperator(null);
    setGames([]); setPurchases([]);
    setTab('connect');
  }

  async function handleCreateGame() {
    if (!cName.trim() || !effectiveKey) return;
    setCreating(true);
    try {
      const prizes = Object.entries(cPrizes)
        .filter(([, v]) => v > 0)
        .map(([type, amount]) => ({
          name: PRIZE_TYPES.find(p => p.type === type)?.label ?? type,
          amount,
        }));
      const { game } = await mktCreateGame(effectiveKey, {
        name: cName.trim(),
        gameDate: cDate || undefined,
        pricePerSheet: cPrice,
        prizes,
      });
      setGames(prev => [game, ...prev]);
      setShowCreate(false);
      setCName(''); setCDate(''); setCPrice(100); setCPrizes({ 'full-house': 5000 });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignSheets(gameId: string) {
    if (!effectiveKey || !assignFrom || !assignTo) return;
    setAssigning(true);
    try {
      const { game } = await mktAssignSheets(effectiveKey, gameId, Number(assignFrom), Number(assignTo));
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, sheetCount: game.sheetCount } : g));
      setAssignGame(null); setAssignFrom(''); setAssignTo('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to assign sheets');
    } finally {
      setAssigning(false);
    }
  }

  async function handleSetStatus(gameId: string, status: 'listed' | 'draft' | 'ended') {
    if (!effectiveKey) return;
    try {
      await mktSetStatus(effectiveKey, gameId, status);
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, status } : g));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function handleDelete(gameId: string) {
    if (!effectiveKey || !confirm('Delete this game and all its purchases?')) return;
    try {
      await mktDeleteGame(effectiveKey, gameId);
      setGames(prev => prev.filter(g => g.id !== gameId));
      setPurchases(prev => prev.filter(p => p.gameId !== gameId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleApprove(purchaseId: string) {
    if (!effectiveKey) return;
    try {
      await mktApprovePurchase(effectiveKey, purchaseId);
      setPurchases(prev => prev.map(p => p.purchaseId === purchaseId ? { ...p, status: 'approved' } : p));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    }
  }

  // analytics
  const pending  = purchases.filter(p => p.status === 'pending');
  const approved = purchases.filter(p => p.status === 'approved');
  const totalRevenue = approved.reduce((s, p) => s + p.amount, 0);
  const listedCount  = games.filter(g => g.status === 'listed').length;
  const totalSold    = games.reduce((s, g) => s + g.soldCount, 0);

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Marketplace</h2>
          <p className="text-white/50 text-sm mt-0.5">Manage your games on Tungbola Marketplace</p>
        </div>
        {isConnected && (
          <button
            onClick={() => loadData(effectiveKey)}
            disabled={dataLoading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', dataLoading && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/20 rounded-xl p-1">
        {availableTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t ? 'bg-white text-sky-700 shadow' : 'text-white/60 hover:text-white'
            )}
          >
            {t === 'connect' ? 'Connect' : t === 'games' ? 'My Games' : 'Sales'}
          </button>
        ))}
      </div>

      {/* ── CONNECT ── */}
      {tab === 'connect' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-600" />
              <span className="font-bold text-slate-800 text-sm">Marketplace API Key</span>
            </div>

            {isConnected && operator && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-800 text-sm truncate">{operator.name}</p>
                  <p className="text-green-600 text-xs">
                    {operator.plan === 'own-sheets' ? 'Plan A — Own Sheets' : 'Plan B — Generate per Game'}
                  </p>
                </div>
                <button
                  onClick={disconnectKey}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 shrink-0"
                >
                  <Unlink className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="password"
                value={inputKey}
                onChange={e => setInputKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && connectKey()}
                placeholder="Paste your API key…"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                onClick={connectKey}
                disabled={keyStatus === 'checking' || !inputKey.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                style={{ backgroundColor: '#0284c7' }}
              >
                {keyStatus === 'checking'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Link2 className="w-4 h-4" />}
                Connect
              </button>
            </div>

            {keyStatus === 'error' && (
              <p className="text-red-600 text-sm flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> {errMsg}
              </p>
            )}

            <p className="text-xs text-slate-400">
              Get your API key from the TungbolaMarket admin panel → Operators tab.
            </p>
          </div>

          {isConnected && (
            <button
              onClick={() => setTab('games')}
              className="w-full py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0284c7' }}
            >
              <Globe className="w-4 h-4" /> Go to My Games →
            </button>
          )}
        </div>
      )}

      {/* ── MY GAMES ── */}
      {tab === 'games' && (
        <div className="space-y-4">
          {!isConnected ? (
            <NotConnected onConnect={() => setTab('connect')} />
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Games',    value: games.length,           color: 'text-white'       },
                  { label: 'Listed',         value: listedCount,            color: 'text-emerald-300' },
                  { label: 'Sheets Sold',    value: totalSold,              color: 'text-amber-300'   },
                  { label: 'Pending Orders', value: pending.length,         color: pending.length > 0 ? 'text-red-300' : 'text-white' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* New game toggle */}
              <button
                onClick={() => setShowCreate(v => !v)}
                className="w-full py-3 rounded-2xl font-bold text-slate-900 text-sm flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 transition-colors"
              >
                {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showCreate ? 'Cancel' : 'New Marketplace Game'}
              </button>

              {/* Create game form */}
              {showCreate && (
                <div className="bg-white rounded-2xl p-5 space-y-4">
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-600" /> Create Game
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Game Name *</label>
                      <input
                        type="text"
                        value={cName}
                        onChange={e => setCName(e.target.value)}
                        placeholder="e.g. Sunday Mega Tambola"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={cDate}
                        onChange={e => setCDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Price per Sheet (₹)</label>
                    <input
                      type="number"
                      value={cPrice}
                      onChange={e => setCPrice(Number(e.target.value))}
                      min={1}
                      className="w-32 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-2 block">Prizes</label>
                    <div className="space-y-2">
                      {PRIZE_TYPES.map(pt => {
                        const checked = pt.type in cPrizes;
                        return (
                          <div key={pt.type} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setCPrizes(prev => {
                                const n = { ...prev };
                                if (checked) delete n[pt.type]; else n[pt.type] = pt.def;
                                return n;
                              })}
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                checked ? 'bg-sky-500 border-sky-500' : 'border-slate-300'
                              )}
                            >
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <span className={cn('text-sm w-36 shrink-0', checked ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                              {pt.label}
                            </span>
                            {checked && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={cPrizes[pt.type]}
                                  onChange={e => setCPrizes(prev => ({ ...prev, [pt.type]: Number(e.target.value) }))}
                                  min={0}
                                  className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleCreateGame}
                    disabled={creating || !cName.trim()}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#0284c7' }}
                  >
                    {creating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Globe className="w-4 h-4" />}
                    Create &amp; Publish to Marketplace
                  </button>
                </div>
              )}

              {/* Games list */}
              {dataLoading && games.length === 0 ? (
                <LoadingSpinner />
              ) : games.length === 0 ? (
                <div className="bg-white/10 rounded-2xl p-8 text-center space-y-2">
                  <Globe className="w-8 h-8 text-white/30 mx-auto" />
                  <p className="text-white/60 text-sm">No marketplace games yet. Create your first game above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {games.map(g => (
                    <GameCard
                      key={g.id}
                      game={g}
                      isAssigning={assignGame === g.id}
                      assignFrom={assignFrom}
                      assignTo={assignTo}
                      assigning={assigning}
                      plan={operator?.plan}
                      onToggleAssign={() => {
                        setAssignGame(assignGame === g.id ? null : g.id);
                        setAssignFrom(''); setAssignTo('');
                      }}
                      onAssignFromChange={setAssignFrom}
                      onAssignToChange={setAssignTo}
                      onAssign={() => handleAssignSheets(g.id)}
                      onSetStatus={s => handleSetStatus(g.id, s)}
                      onDelete={() => handleDelete(g.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SALES ── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          {!isConnected ? (
            <NotConnected onConnect={() => setTab('connect')} />
          ) : (
            <>
              {/* Revenue stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, color: 'text-emerald-300' },
                  { label: 'Pending',       value: pending.length,                       color: pending.length > 0 ? 'text-amber-300' : 'text-white' },
                  { label: 'Approved',      value: approved.length,                      color: 'text-white' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {dataLoading && purchases.length === 0 ? (
                <LoadingSpinner />
              ) : purchases.length === 0 ? (
                <div className="bg-white/10 rounded-2xl p-8 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-white/30 mx-auto" />
                  <p className="text-white/60 text-sm">No purchases yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...purchases]
                    .sort((a, b) => {
                      if (a.status === 'pending' && b.status !== 'pending') return -1;
                      if (b.status === 'pending' && a.status !== 'pending') return 1;
                      return b.createdAt - a.createdAt;
                    })
                    .map(p => (
                      <PurchaseRow
                        key={p.purchaseId}
                        purchase={p}
                        onApprove={() => handleApprove(p.purchaseId)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotConnected({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="bg-white/10 rounded-2xl p-6 text-center space-y-3">
      <Key className="w-8 h-8 text-white/30 mx-auto" />
      <p className="text-white/60 text-sm">Connect your API key to get started.</p>
      <button onClick={onConnect} className="text-white font-semibold text-sm underline underline-offset-2">
        Go to Connect
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
    </div>
  );
}

function GameCard({
  game, isAssigning, assignFrom, assignTo, assigning, plan,
  onToggleAssign, onAssignFromChange, onAssignToChange, onAssign,
  onSetStatus, onDelete,
}: {
  game: MktGame;
  isAssigning: boolean;
  assignFrom: string;
  assignTo: string;
  assigning: boolean;
  plan?: string;
  onToggleAssign: () => void;
  onAssignFromChange: (v: string) => void;
  onAssignToChange: (v: string) => void;
  onAssign: () => void;
  onSetStatus: (s: 'listed' | 'draft' | 'ended') => void;
  onDelete: () => void;
}) {
  const revenue = game.soldCount * game.pricePerSheet;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-800">{game.name}</p>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[game.status] ?? STATUS_COLORS.draft)}>
              {game.status}
            </span>
          </div>
          {game.gameDate && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {game.gameDate}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="text-xs text-slate-500">
              <span className="font-bold text-slate-700">{game.soldCount}</span>/{game.sheetCount} sheets sold
            </span>
            <span className="text-xs text-slate-400">₹{game.pricePerSheet}/sheet</span>
            {revenue > 0 && (
              <span className="text-xs font-bold text-emerald-600">₹{revenue.toLocaleString()} earned</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {game.status === 'draft' && (
            <>
              <button
                onClick={onToggleAssign}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
              >
                {isAssigning ? 'Cancel' : 'Assign Sheets'}
              </button>
              {game.sheetCount > 0 && (
                <button
                  onClick={() => onSetStatus('listed')}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  List Now
                </button>
              )}
            </>
          )}
          {game.status === 'listed' && (
            <>
              <button
                onClick={() => onSetStatus('draft')}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                Unlist
              </button>
              <button
                onClick={() => onSetStatus('ended')}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                End Game
              </button>
            </>
          )}
          {game.status === 'ended' && (
            <button
              onClick={() => onSetStatus('listed')}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isAssigning && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-3">Assign Sheet Range</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={assignFrom}
              onChange={e => onAssignFromChange(e.target.value)}
              placeholder="From (e.g. 1)"
              min={1}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="number"
              value={assignTo}
              onChange={e => onAssignToChange(e.target.value)}
              placeholder="To (e.g. 100)"
              min={1}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              onClick={onAssign}
              disabled={assigning || !assignFrom || !assignTo}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              style={{ backgroundColor: '#0284c7' }}
            >
              {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Assign
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {plan === 'own-sheets'
              ? 'Sheets from your own library (Plan A).'
              : 'Sheets from the shared pool (Plan B).'}
          </p>
        </div>
      )}
    </div>
  );
}

function PurchaseRow({ purchase: p, onApprove }: { purchase: MktPurchase; onApprove: () => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-800 text-sm">{p.playerName}</p>
          <span className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          )}>
            {p.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{p.phone}</p>
        <p className="text-xs text-slate-500 mt-1">
          {p.quantity} sheet{p.quantity > 1 ? 's' : ''} ·{' '}
          <span className="font-bold text-slate-700">₹{p.amount}</span>
          {p.sheetNums?.length ? ` · Sheets: ${p.sheetNums.join(', ')}` : ''}
        </p>
        <p className="text-xs text-slate-400">{p.gameName}</p>
      </div>
      {p.status === 'pending' && (
        <button
          onClick={onApprove}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: '#0284c7' }}
        >
          <Check className="w-3.5 h-3.5" /> Approve
        </button>
      )}
    </div>
  );
}

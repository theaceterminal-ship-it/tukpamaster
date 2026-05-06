import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Key, CheckCircle, XCircle, Loader2, Link2, Unlink,
  Globe, Plus, RefreshCw, ShoppingBag,
  Check, Calendar, ChevronDown, ChevronUp,
  User, Phone, QrCode, Trash2, AlertTriangle,
  TrendingUp, TicketCheck, Clock, Image,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import {
  mktGetInfo, mktGetPurchases, mktAssignSheets,
  mktSetStatus, mktDeleteGame, mktApprovePurchase,
  type MktGame, type MktPurchase, type MktOperator,
} from '@/services/marketplaceApi';
import { ScheduleGameWizard } from '@/components/marketplace/ScheduleGameWizard';
import { cn } from '@/lib/utils';

interface SettingsProps {
  tambola?: ReturnType<typeof useTambola>;
  apiKey?: string;
  initOperator?: MktOperator;
}

type Tab = 'connect' | 'games' | 'profile';

const STATUS_COLORS: Record<string, string> = {
  draft:  'bg-slate-100 text-slate-600',
  listed: 'bg-emerald-100 text-emerald-700',
  ended:  'bg-red-100 text-red-600',
};

function loadProfile(opId: string) {
  try {
    const raw = localStorage.getItem(`tukpa-profile-${opId}`);
    return raw ? JSON.parse(raw) : { displayName: '', supportPhone: '', qrBase64: null };
  } catch { return { displayName: '', supportPhone: '', qrBase64: null }; }
}

function saveProfile(opId: string, data: { displayName: string; supportPhone: string; qrBase64: string | null }) {
  localStorage.setItem(`tukpa-profile-${opId}`, JSON.stringify(data));
}

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

  const [showWizard, setShowWizard] = useState(false);

  // expanded game card
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  // sheet assignment
  const [assignGame, setAssignGame] = useState<string | null>(null);
  const [assignFrom, setAssignFrom] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);

  // profile tab
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileQr, setProfileQr] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const isConnected = keyStatus === 'ok' && !!effectiveKey;
  const availableTabs: Tab[] = isPlanA
    ? ['games', 'profile']
    : (isConnected ? ['games', 'profile'] : ['connect', 'profile']);

  // load profile when operator known
  useEffect(() => {
    if (operator?.id) {
      const p = loadProfile(operator.id);
      setProfileName(p.displayName ?? '');
      setProfilePhone(p.supportPhone ?? '');
      setProfileQr(p.qrBase64 ?? null);
    }
  }, [operator?.id]);

  const loadData = useCallback(async (key = effectiveKey) => {
    if (!key) return;
    setDataLoading(true);
    try {
      const [info, purch] = await Promise.all([mktGetInfo(key), mktGetPurchases(key)]);
      setOperator(info.operator);
      setGames(info.games);
      setPurchases(purch.purchases);
    } catch { /* silent */ }
    finally { setDataLoading(false); }
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

  async function handleAssignSheets(gameId: string) {
    if (!effectiveKey || !assignFrom || !assignTo) return;
    setAssigning(true);
    try {
      const { game } = await mktAssignSheets(effectiveKey, gameId, Number(assignFrom), Number(assignTo));
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, sheetCount: game.sheetCount } : g));
      setAssignGame(null); setAssignFrom(''); setAssignTo('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setAssigning(false); }
  }

  async function handleSetStatus(gameId: string, status: 'listed' | 'draft' | 'ended') {
    if (!effectiveKey) return;
    try {
      await mktSetStatus(effectiveKey, gameId, status);
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, status } : g));
    } catch (e) { alert(e instanceof Error ? e.message : 'Update failed'); }
  }

  async function handleDelete(gameId: string) {
    if (!effectiveKey || !confirm('Delete this game and all its purchases?')) return;
    try {
      await mktDeleteGame(effectiveKey, gameId);
      setGames(prev => prev.filter(g => g.id !== gameId));
      setPurchases(prev => prev.filter(p => p.gameId !== gameId));
      if (expandedGame === gameId) setExpandedGame(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  }

  async function handleApprove(purchaseId: string) {
    if (!effectiveKey) return;
    try {
      await mktApprovePurchase(effectiveKey, purchaseId);
      setPurchases(prev => prev.map(p => p.purchaseId === purchaseId ? { ...p, status: 'approved' } : p));
    } catch (e) { alert(e instanceof Error ? e.message : 'Approve failed'); }
  }

  function handleSaveProfile() {
    if (!operator?.id) return;
    saveProfile(operator.id, { displayName: profileName, supportPhone: profilePhone, qrBase64: profileQr });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setProfileQr(r.result as string);
    r.readAsDataURL(f);
  }

  // analytics
  const totalRevenue = purchases.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
  const totalPending = purchases.filter(p => p.status === 'pending').length;
  const listedCount  = games.filter(g => g.status === 'listed').length;
  const totalSold    = games.reduce((s, g) => s + g.soldCount, 0);

  return (
    <div className="w-full h-full flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h2 className="text-xl font-black text-white">Marketplace</h2>
          {operator && (
            <p className="text-white/40 text-xs mt-0.5">{operator.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          {isConnected && (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-slate-900 text-sm bg-amber-400 hover:bg-amber-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Game</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/20 rounded-xl p-1 mb-4 shrink-0">
        {availableTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
              tab === t ? 'bg-white text-sky-700 shadow' : 'text-white/60 hover:text-white'
            )}
          >
            {t === 'connect' ? 'Connect' : t === 'games' ? 'My Games' : 'Profile'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto min-h-0 space-y-4">

        {/* ── CONNECT ── */}
        {tab === 'connect' && (
          <div className="space-y-4 max-w-lg">
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
                  {keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Connect
                </button>
              </div>

              {keyStatus === 'error' && (
                <p className="text-red-600 text-sm flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> {errMsg}
                </p>
              )}
              <p className="text-xs text-slate-400">Get your API key from the TungbolaMarket admin panel → Operators tab.</p>
            </div>

            {isConnected && (
              <button onClick={() => setTab('games')} className="w-full py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: '#0284c7' }}>
                <Globe className="w-4 h-4" /> Go to My Games →
              </button>
            )}
          </div>
        )}

        {/* ── MY GAMES ── */}
        {tab === 'games' && (
          <>
            {!isConnected ? (
              <NotConnected onConnect={() => setTab('connect')} />
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  {[
                    { label: 'Total Games',  value: games.length,       color: 'text-white'       },
                    { label: 'Listed',        value: listedCount,        color: 'text-emerald-300' },
                    { label: 'Sheets Sold',   value: totalSold,          color: 'text-amber-300'   },
                    { label: 'Revenue',       value: `₹${totalRevenue.toLocaleString()}`, color: 'text-sky-300' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Global pending alert */}
                {totalPending > 0 && (
                  <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 rounded-xl px-4 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-sm font-semibold">
                      {totalPending} pending order{totalPending > 1 ? 's' : ''} need approval
                    </p>
                  </div>
                )}

                {/* Games list */}
                {dataLoading && games.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                  </div>
                ) : games.length === 0 ? (
                  <div className="bg-white/10 rounded-2xl p-10 text-center space-y-3">
                    <Globe className="w-10 h-10 text-white/20 mx-auto" />
                    <p className="text-white/50 text-sm">No games yet. Tap <strong className="text-white">New Game</strong> to create your first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {games.map(g => {
                      const gamePurchases = purchases.filter(p => p.gameId === g.id);
                      const pendingP = gamePurchases.filter(p => p.status === 'pending');
                      const approvedP = gamePurchases.filter(p => p.status === 'approved');
                      const gameRevenue = approvedP.reduce((s, p) => s + p.amount, 0);
                      const remaining = g.sheetCount - g.soldCount;
                      const pct = g.sheetCount > 0 ? Math.round((g.soldCount / g.sheetCount) * 100) : 0;
                      const isExpanded = expandedGame === g.id;

                      return (
                        <div key={g.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                          {/* Card header — always visible */}
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                {/* Name + status */}
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="font-bold text-slate-800 text-base">{g.name}</p>
                                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[g.status] ?? STATUS_COLORS.draft)}>
                                    {g.status}
                                  </span>
                                  {pendingP.length > 0 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                      ⚠ {pendingP.length} pending
                                    </span>
                                  )}
                                </div>

                                {/* Date */}
                                {g.gameDate && (
                                  <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {g.gameDate}
                                  </p>
                                )}

                                {/* Sheet progress */}
                                {g.sheetCount > 0 && (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-slate-500 font-medium">{g.soldCount} sold · {remaining} remaining</span>
                                      <span className="text-slate-400">{pct}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-sky-500 rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Revenue + price */}
                                <div className="flex items-center gap-3 flex-wrap text-xs">
                                  <span className="text-slate-400">₹{g.pricePerSheet}/sheet</span>
                                  {gameRevenue > 0 && (
                                    <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                                      <TrendingUp className="w-3 h-3" />
                                      ₹{gameRevenue.toLocaleString()} earned
                                    </span>
                                  )}
                                  {g.sheetCount === 0 && (
                                    <span className="text-amber-500 font-medium">No sheets assigned yet</span>
                                  )}
                                </div>
                              </div>

                              {/* Quick action buttons (desktop) */}
                              <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                <StatusActions
                                  status={g.status}
                                  sheetCount={g.sheetCount}
                                  onSetStatus={s => handleSetStatus(g.id, s)}
                                />
                                <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Expand toggle */}
                            <button
                              onClick={() => setExpandedGame(isExpanded ? null : g.id)}
                              className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-semibold transition-colors"
                            >
                              {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Details & Orders</>}
                            </button>
                          </div>

                          {/* Expanded section */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 divide-y divide-slate-100">

                              {/* Mobile status actions */}
                              <div className="px-4 py-3 flex items-center gap-2 flex-wrap sm:hidden">
                                <StatusActions
                                  status={g.status}
                                  sheetCount={g.sheetCount}
                                  onSetStatus={s => handleSetStatus(g.id, s)}
                                />
                                <button onClick={() => handleDelete(g.id)} className="ml-auto p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Assign sheets */}
                              {g.status === 'draft' && (
                                <div className="px-4 py-3">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                    <TicketCheck className="w-3.5 h-3.5" /> Assign Sheet Range
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={assignGame === g.id ? assignFrom : ''}
                                      onChange={e => { setAssignGame(g.id); setAssignFrom(e.target.value); }}
                                      placeholder="From (1)"
                                      min={1}
                                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <span className="text-slate-300">–</span>
                                    <input
                                      type="number"
                                      value={assignGame === g.id ? assignTo : ''}
                                      onChange={e => { setAssignGame(g.id); setAssignTo(e.target.value); }}
                                      placeholder="To (100)"
                                      min={1}
                                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                      onClick={() => handleAssignSheets(g.id)}
                                      disabled={assigning || !assignFrom || !assignTo}
                                      className="px-3 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 flex items-center gap-1"
                                      style={{ backgroundColor: '#0284c7' }}
                                    >
                                      {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                      Assign
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Purchase orders */}
                              <div className="px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    Orders ({gamePurchases.length})
                                  </p>
                                  {approvedP.length > 0 && (
                                    <span className="text-xs text-emerald-600 font-semibold">{approvedP.length} approved</span>
                                  )}
                                </div>

                                {gamePurchases.length === 0 ? (
                                  <p className="text-slate-400 text-xs py-2">No orders yet for this game.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {[...gamePurchases]
                                      .sort((a, b) => {
                                        if (a.status === 'pending' && b.status !== 'pending') return -1;
                                        if (b.status === 'pending' && a.status !== 'pending') return 1;
                                        return b.createdAt - a.createdAt;
                                      })
                                      .map(p => (
                                        <div key={p.purchaseId} className={cn(
                                          'flex items-center gap-3 rounded-xl px-3 py-2.5',
                                          p.status === 'pending' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                        )}>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <p className="font-semibold text-slate-800 text-sm">{p.playerName}</p>
                                              <span className={cn(
                                                'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                                                p.status === 'approved'
                                                  ? 'bg-emerald-100 text-emerald-700'
                                                  : 'bg-amber-100 text-amber-700'
                                              )}>
                                                {p.status === 'approved' ? '✓' : '⏳'}
                                              </span>
                                            </div>
                                            <p className="text-xs text-slate-400">{p.phone}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                              {p.quantity} sheet{p.quantity > 1 ? 's' : ''} · <span className="font-bold text-slate-700">₹{p.amount}</span>
                                              {p.sheetNums?.length ? ` · #${p.sheetNums.join(', ')}` : ''}
                                            </p>
                                          </div>
                                          {p.status === 'pending' && (
                                            <button
                                              onClick={() => handleApprove(p.purchaseId)}
                                              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                                              style={{ backgroundColor: '#0284c7' }}
                                            >
                                              <Check className="w-3 h-3" /> Approve
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-sky-600" /> Operator Profile
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                  <User className="w-3 h-3" /> Display Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your business name shown to players"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Support Phone
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <p className="text-xs text-slate-400 mt-1">Shown to players who need help with their purchase.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                  <QrCode className="w-3 h-3" /> Payment QR Code
                </label>
                <p className="text-xs text-slate-400 mb-2">Your UPI / payment QR — players scan this to pay for sheets.</p>

                {profileQr ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <img src={profileQr} alt="Payment QR" className="w-32 h-32 object-contain border border-slate-200 rounded-xl bg-white p-1" />
                      <div className="space-y-2">
                        <button
                          onClick={() => qrRef.current?.click()}
                          className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-semibold"
                        >
                          <Image className="w-3.5 h-3.5" /> Replace QR
                        </button>
                        <button
                          onClick={() => setProfileQr(null)}
                          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => qrRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 py-6 text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors"
                  >
                    <QrCode className="w-8 h-8" />
                    <span className="text-sm">Tap to upload your QR code image</span>
                  </button>
                )}
                <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
              </div>

              <button
                onClick={handleSaveProfile}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: profileSaved ? '#16a34a' : '#0284c7' }}
              >
                {profileSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
              </button>
            </div>

            {/* Connection status card */}
            {!isPlanA && (
              <div className="bg-white rounded-2xl p-5 space-y-3">
                <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-600" /> Marketplace Connection
                </p>
                {isConnected && operator ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{operator.name}</p>
                      <p className="text-xs text-slate-400">{operator.plan === 'own-sheets' ? 'Plan A' : 'Plan B'}</p>
                    </div>
                    <button onClick={disconnectKey} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <Unlink className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setTab('connect')} className="text-sky-600 font-semibold text-sm underline underline-offset-2">
                    Connect your API key →
                  </button>
                )}
              </div>
            )}

            {/* Clock info */}
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Profile is saved locally on this device.</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Wizard overlay */}
      {showWizard && (
        <ScheduleGameWizard
          apiKey={effectiveKey}
          onCreated={game => { setGames(prev => [game, ...prev]); setShowWizard(false); }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusActions({
  status, sheetCount, onSetStatus,
}: {
  status: string;
  sheetCount: number;
  onSetStatus: (s: 'listed' | 'draft' | 'ended') => void;
}) {
  if (status === 'draft') return (
    <>
      {sheetCount > 0 && (
        <button onClick={() => onSetStatus('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
          List Now
        </button>
      )}
    </>
  );
  if (status === 'listed') return (
    <>
      <button onClick={() => onSetStatus('draft')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100">Unlist</button>
      <button onClick={() => onSetStatus('ended')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">End Game</button>
    </>
  );
  if (status === 'ended') return (
    <button onClick={() => onSetStatus('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Reopen</button>
  );
  return null;
}

function NotConnected({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="bg-white/10 rounded-2xl p-8 text-center space-y-3">
      <Key className="w-8 h-8 text-white/30 mx-auto" />
      <p className="text-white/60 text-sm">Connect your API key to get started.</p>
      <button onClick={onConnect} className="text-white font-semibold text-sm underline underline-offset-2">
        Go to Connect
      </button>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Key, CheckCircle, XCircle, Loader2, Link2, Unlink, Globe, Plus,
  RefreshCw, ShoppingBag, Check, Calendar, ChevronDown, ChevronUp,
  User, Phone, QrCode, Trash2, AlertTriangle, TrendingUp, TicketCheck,
  Image as ImageIcon, LogOut, Wifi, WifiOff,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import {
  mktGetInfo, mktGetPurchases, mktAssignSheets,
  mktSetStatus, mktDeleteGame, mktApprovePurchase,
  type MktGame, type MktPurchase, type MktOperator,
} from '@/services/marketplaceApi';
import { ScheduleGameWizard } from '@/components/marketplace/ScheduleGameWizard';
import { cn } from '@/lib/utils';

export type Tab = 'connect' | 'games' | 'profile';

interface Props {
  tambola?: ReturnType<typeof useTambola>;
  apiKey?: string;
  initOperator?: MktOperator;
  initTab?: Tab;
  onLogout?: () => void;
}

const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  draft:  { dot: 'bg-slate-400',   text: 'text-slate-500',  bg: 'bg-slate-50'   },
  listed: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  ended:  { dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50'     },
};

function lsGet(k: string) { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? {}; } catch { return {}; } }
function lsSet(k: string, v: object) { localStorage.setItem(k, JSON.stringify(v)); }

export function Settings({ tambola, apiKey, initOperator, initTab, onLogout }: Props) {
  const key    = apiKey ?? tambola?.mktApiKey ?? '';
  const setKey = tambola?.setMktApiKey ?? (() => {});
  const isPlanA = !!apiKey;

  const [tab, setTab] = useState<Tab>(() => initTab ?? (isPlanA ? 'games' : (key ? 'games' : 'connect')));
  const [inputKey,  setInputKey]  = useState(key);
  const [keyStatus, setKeyStatus] = useState<'idle'|'checking'|'ok'|'error'>(key ? 'ok' : 'idle');
  const [keyErr,    setKeyErr]    = useState('');
  const [operator,  setOperator]  = useState<MktOperator | null>(initOperator ?? null);
  const [games,     setGames]     = useState<MktGame[]>([]);
  const [purchases, setPurchases] = useState<MktPurchase[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [wizard,    setWizard]    = useState(false);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [aFrom, setAFrom] = useState('');
  const [aTo,   setATo]   = useState('');
  const [aLoading, setALoading] = useState(false);
  // profile
  const [pName,  setPName]  = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pQr,    setPQr]    = useState<string | null>(null);
  const [pSaved, setPSaved] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const connected = keyStatus === 'ok' && !!key;
  const tabs: Tab[] = isPlanA ? ['games','profile'] : (connected ? ['games','profile'] : ['connect','profile']);
  const totalPending = purchases.filter(p => p.status === 'pending').length;

  useEffect(() => {
    if (!operator?.id) return;
    const p = lsGet(`tukpa-profile-${operator.id}`);
    setPName(p.displayName ?? ''); setPPhone(p.supportPhone ?? ''); setPQr(p.qrBase64 ?? null);
  }, [operator?.id]);

  const loadData = useCallback(async (k = key) => {
    if (!k) return;
    setLoading(true);
    try {
      const [info, purch] = await Promise.all([mktGetInfo(k), mktGetPurchases(k)]);
      setOperator(info.operator); setGames(info.games); setPurchases(purch.purchases);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [key]);

  useEffect(() => { if (key && keyStatus === 'ok') loadData(key); }, []); // eslint-disable-line

  async function connect() {
    const k = inputKey.trim(); if (!k) return;
    setKeyStatus('checking'); setKeyErr('');
    try {
      const info = await mktGetInfo(k);
      setKey(k); setOperator(info.operator); setGames(info.games); setKeyStatus('ok');
      const p = await mktGetPurchases(k); setPurchases(p.purchases); setTab('games');
    } catch (e) { setKeyStatus('error'); setKeyErr(e instanceof Error ? e.message : 'Failed'); }
  }

  function disconnect() { setKey(''); setInputKey(''); setKeyStatus('idle'); setOperator(null); setGames([]); setPurchases([]); setTab('connect'); }

  async function assignSheets(gameId: string) {
    if (!key || !aFrom || !aTo) return;
    setALoading(true);
    try {
      const { game } = await mktAssignSheets(key, gameId, +aFrom, +aTo);
      setGames(p => p.map(g => g.id === gameId ? { ...g, sheetCount: game.sheetCount } : g));
      setAFrom(''); setATo('');
    } catch (e) { alert(String(e)); }
    finally { setALoading(false); }
  }

  async function setStatus(gameId: string, status: 'listed'|'draft'|'ended') {
    if (!key) return;
    try { await mktSetStatus(key, gameId, status); setGames(p => p.map(g => g.id === gameId ? { ...g, status } : g)); }
    catch (e) { alert(String(e)); }
  }

  async function deleteGame(gameId: string) {
    if (!key || !confirm('Delete this game and all purchases?')) return;
    try {
      await mktDeleteGame(key, gameId);
      setGames(p => p.filter(g => g.id !== gameId));
      setPurchases(p => p.filter(p => p.gameId !== gameId));
      if (expanded === gameId) setExpanded(null);
    } catch (e) { alert(String(e)); }
  }

  async function approve(purchaseId: string) {
    if (!key) return;
    try { await mktApprovePurchase(key, purchaseId); setPurchases(p => p.map(x => x.purchaseId === purchaseId ? { ...x, status: 'approved' } : x)); }
    catch (e) { alert(String(e)); }
  }

  function saveProfile() {
    if (!operator?.id) return;
    lsSet(`tukpa-profile-${operator.id}`, { displayName: pName, supportPhone: pPhone, qrBase64: pQr });
    setPSaved(true); setTimeout(() => setPSaved(false), 2000);
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-2xl shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all',
              tab === t ? 'bg-white text-sky-700 shadow' : 'text-white/40 hover:text-white/70'
            )}>
            {t === 'connect' ? 'Connect' : t === 'games' ? 'My Games' : 'Profile'}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-auto">

        {/* CONNECT */}
        {tab === 'connect' && (
          <div className="max-w-md space-y-3">
            <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" /> Marketplace API Key
              </p>
              {connected && operator && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{operator.name}</p>
                    <p className="text-emerald-400 text-xs">{operator.plan === 'own-sheets' ? 'Plan A' : 'Plan B'}</p>
                  </div>
                  <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1">
                    <Unlink className="w-3 h-3" /> Disconnect
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && connect()}
                  placeholder="Paste your API key…"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono bg-white/10 border border-white/15 text-white placeholder-white/25 focus:outline-none focus:border-sky-400" />
                <button onClick={connect} disabled={keyStatus === 'checking' || !inputKey.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-40 flex items-center gap-1.5 shrink-0 transition-colors">
                  {keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect
                </button>
              </div>
              {keyStatus === 'error' && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyErr}</p>}
              <p className="text-white/25 text-xs">Get your key from TungbolaMarket admin → Operators tab.</p>
            </div>
            {connected && (
              <button onClick={() => setTab('games')} className="w-full py-3 rounded-2xl font-bold text-white bg-sky-500 hover:bg-sky-400 flex items-center justify-center gap-2 transition-colors">
                <Globe className="w-4 h-4" /> Go to My Games →
              </button>
            )}
          </div>
        )}

        {/* MY GAMES */}
        {tab === 'games' && (
          <>
            {!connected ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <WifiOff className="w-10 h-10 text-white/20" />
                <p className="text-white/40 text-sm">Not connected to marketplace.</p>
                <button onClick={() => setTab('connect')} className="text-sky-400 text-sm font-semibold underline">Connect now →</button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Action bar */}
                <div className="flex items-center gap-2">
                  {connected && operator && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <Wifi className="w-3.5 h-3.5" />
                      <span>{operator.name}</span>
                    </div>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => loadData(key)} disabled={loading}
                    className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  </button>
                  <button onClick={() => setWizard(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> New Game
                  </button>
                </div>

                {/* Pending alert */}
                {totalPending > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 border border-amber-400/20 bg-amber-400/10">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-sm font-semibold flex-1">
                      {totalPending} pending order{totalPending > 1 ? 's' : ''} waiting for approval
                    </p>
                  </div>
                )}

                {/* Game grid */}
                {loading && games.length === 0 ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>
                ) : games.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <Globe className="w-10 h-10 text-white/20" />
                    <p className="text-white/40 text-sm">No games yet. Tap New Game to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {games.map(g => {
                      const gp   = purchases.filter(p => p.gameId === g.id);
                      const pend = gp.filter(p => p.status === 'pending');
                      const appr = gp.filter(p => p.status === 'approved');
                      const rev  = appr.reduce((s, p) => s + p.amount, 0);
                      const left = g.sheetCount - g.soldCount;
                      const pct  = g.sheetCount > 0 ? Math.round(g.soldCount / g.sheetCount * 100) : 0;
                      const st   = STATUS[g.status] ?? STATUS.draft;
                      const open = expanded === g.id;

                      return (
                        <div key={g.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                          <div className="p-4">
                            {/* Name + status */}
                            <div className="flex items-start gap-2 mb-2">
                              <h3 className="font-black text-white text-base leading-tight flex-1">{g.name}</h3>
                              <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize', st.text, st.bg)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', st.dot)} />
                                {g.status}
                              </span>
                            </div>

                            {/* Date */}
                            {g.gameDate && (
                              <p className="text-xs text-white/40 flex items-center gap-1 mb-3">
                                <Calendar className="w-3 h-3" /> {g.gameDate}
                              </p>
                            )}

                            {/* Stats */}
                            {g.sheetCount > 0 ? (
                              <>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <Stat value={g.soldCount}       label="Sold"      color="text-sky-400"     />
                                  <Stat value={left}              label="Remaining" color="text-white"       />
                                  <Stat value={`₹${g.pricePerSheet}`} label="/ sheet" color="text-emerald-400" />
                                </div>
                                <div className="mb-3">
                                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                    <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[11px] mt-1">
                                    <span className="text-white/30">{pct}% sold</span>
                                    {rev > 0 && <span className="text-emerald-400 font-semibold flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" />₹{rev.toLocaleString()}</span>}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-amber-400 font-medium mb-3 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> No sheets assigned yet
                              </p>
                            )}

                            {/* Pending */}
                            {pend.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5 mb-3">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {pend.length} pending order{pend.length > 1 ? 's' : ''}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusBtns status={g.status} sheetCount={g.sheetCount} onSet={s => setStatus(g.id, s)} />
                              <button onClick={() => deleteGame(g.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-auto">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setExpanded(open ? null : g.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                {open ? <><ChevronUp className="w-3.5 h-3.5" />Hide</> : <><ChevronDown className="w-3.5 h-3.5" />Details</>}
                              </button>
                            </div>
                          </div>

                          {/* Expanded */}
                          {open && (
                            <div className="border-t divide-y" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                              {/* Assign sheets */}
                              {g.status === 'draft' && (
                                <div className="px-4 py-3">
                                  <p className="text-[11px] font-bold text-white/30 uppercase tracking-wide mb-2 flex items-center gap-1">
                                    <TicketCheck className="w-3 h-3" /> Assign Sheet Range
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <input type="number" value={aFrom} onChange={e => setAFrom(e.target.value)} placeholder="From"
                                      className="flex-1 rounded-lg px-2.5 py-2 text-sm text-center text-white bg-white/10 border border-white/10 focus:outline-none focus:border-sky-400 [color-scheme:dark]" />
                                    <span className="text-white/20 font-bold">–</span>
                                    <input type="number" value={aTo} onChange={e => setATo(e.target.value)} placeholder="To"
                                      className="flex-1 rounded-lg px-2.5 py-2 text-sm text-center text-white bg-white/10 border border-white/10 focus:outline-none focus:border-sky-400 [color-scheme:dark]" />
                                    <button onClick={() => assignSheets(g.id)} disabled={aLoading || !aFrom || !aTo}
                                      className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-40 flex items-center gap-1 shrink-0 transition-colors">
                                      {aLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Assign
                                    </button>
                                  </div>
                                  {aFrom && aTo && +aTo >= +aFrom && (
                                    <p className="text-xs text-sky-400 font-medium mt-1.5 text-center">{+aTo - +aFrom + 1} sheets will be assigned</p>
                                  )}
                                </div>
                              )}

                              {/* Orders */}
                              <div className="px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[11px] font-bold text-white/30 uppercase tracking-wide flex items-center gap-1">
                                    <ShoppingBag className="w-3 h-3" /> Orders ({gp.length})
                                  </p>
                                  {appr.length > 0 && <span className="text-[11px] text-emerald-400 font-semibold">{appr.length} approved</span>}
                                </div>
                                {gp.length === 0 ? (
                                  <p className="text-white/25 text-xs py-2">No orders for this game.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {[...gp].sort(a => (a.status === 'pending' ? -1 : 1)).map(p => (
                                      <div key={p.purchaseId} className={cn('flex items-center gap-3 rounded-xl px-3 py-2',
                                        p.status === 'pending' ? 'bg-amber-400/10 border border-amber-400/15' : 'bg-white/5'
                                      )}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="font-semibold text-white text-sm">{p.playerName}</p>
                                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                              p.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400')}>
                                              {p.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-white/30">{p.phone}</p>
                                          <p className="text-xs text-white/50 mt-0.5">
                                            {p.quantity} sheet{p.quantity > 1 ? 's' : ''} · <span className="font-bold text-white">₹{p.amount}</span>
                                            {p.sheetNums?.length ? ` · #${p.sheetNums.join(', ')}` : ''}
                                          </p>
                                        </div>
                                        {p.status === 'pending' && (
                                          <button onClick={() => approve(p.purchaseId)}
                                            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 transition-colors">
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
              </div>
            )}
          </>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="max-w-lg space-y-3">
            {/* Operator badge */}
            {operator && (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm truncate">{operator.name}</p>
                  <p className="text-white/30 text-xs">{operator.plan === 'own-sheets' ? 'Plan A · Own Sheets' : 'Plan B · Generate'}</p>
                </div>
                {connected
                  ? <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <WifiOff className="w-4 h-4 text-white/20 shrink-0" />
                }
              </div>
            )}

            <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Display Info</p>

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-semibold block">Business / Display Name</label>
                <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="Shown to players in listings"
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-sky-400" />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> Support Phone</label>
                <input type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+91 98765 43210"
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-sky-400" />
                <p className="text-[11px] text-white/25">Players see this number when they need help.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><QrCode className="w-3 h-3" /> Payment QR Code</label>
                <p className="text-[11px] text-white/25 mb-2">Your UPI / bank QR — players scan this to pay for sheets.</p>
                {pQr ? (
                  <div className="flex items-start gap-3">
                    <img src={pQr} alt="QR" className="w-28 h-28 object-contain rounded-xl bg-white p-1.5 shrink-0" />
                    <div className="space-y-2 pt-1">
                      <button onClick={() => qrRef.current?.click()} className="text-xs text-sky-400 font-semibold flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Replace
                      </button>
                      <button onClick={() => setPQr(null)} className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => qrRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/10 rounded-xl py-6 flex flex-col items-center gap-2 text-white/25 hover:border-sky-400/40 hover:text-sky-400/60 transition-colors">
                    <QrCode className="w-8 h-8" />
                    <span className="text-xs font-medium">Tap to upload your payment QR code</span>
                  </button>
                )}
                <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = () => setPQr(r.result as string); r.readAsDataURL(f);
                }} />
              </div>

              <button onClick={saveProfile}
                className={cn('w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-colors',
                  pSaved ? 'bg-emerald-500' : 'bg-sky-500 hover:bg-sky-400')}>
                {pSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
              </button>
            </div>

            {/* Marketplace connection for Plan B */}
            {!isPlanA && (
              <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-sky-400" /> Marketplace Connection
                </p>
                {connected && operator ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{operator.name}</p>
                      <p className="text-xs text-white/30">{operator.plan === 'own-sheets' ? 'Plan A' : 'Plan B'}</p>
                    </div>
                    <button onClick={disconnect} className="text-xs text-red-400 font-semibold flex items-center gap-1">
                      <Unlink className="w-3 h-3" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setTab('connect')} className="text-sky-400 text-sm font-semibold underline">Connect API key →</button>
                )}
              </div>
            )}

            {/* Sign Out */}
            {onLogout && (
              <button onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white/30 hover:text-red-400 border border-white/10 hover:border-red-400/30 transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            )}
          </div>
        )}
      </div>

      {wizard && (
        <ScheduleGameWizard
          apiKey={key}
          onCreated={game => { setGames(p => [game, ...p]); setWizard(false); }}
          onClose={() => setWizard(false)}
        />
      )}
    </div>
  );
}

// ── Micro components ──────────────────────────────────────────────────────────

function Stat({ value, label, color }: { value: number|string; label: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <p className={cn('text-2xl font-black leading-none', color)}>{value}</p>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function StatusBtns({ status, sheetCount, onSet }: { status: string; sheetCount: number; onSet: (s:'listed'|'draft'|'ended') => void }) {
  if (status === 'draft') return sheetCount > 0 ? (
    <button onClick={() => onSet('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">List Now</button>
  ) : null;
  if (status === 'listed') return (
    <>
      <button onClick={() => onSet('draft')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 transition-colors">Unlist</button>
      <button onClick={() => onSet('ended')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-white/10 text-white/40 hover:bg-white/15 transition-colors">End</button>
    </>
  );
  if (status === 'ended') return (
    <button onClick={() => onSet('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">Reopen</button>
  );
  return null;
}

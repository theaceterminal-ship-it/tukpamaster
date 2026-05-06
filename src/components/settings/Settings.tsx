import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Key, CheckCircle, XCircle, Loader2, Link2, Unlink, Globe, Plus,
  RefreshCw, ShoppingBag, Check, Calendar, ChevronDown, ChevronUp,
  User, Phone, QrCode, Trash2, AlertTriangle, TrendingUp, TicketCheck,
  Image, LogOut, Clock,
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
  initTab?: Tab;
  onLogout?: () => void;
}

type Tab = 'connect' | 'games' | 'profile';

const STATUS_PILL: Record<string, string> = {
  draft:  'bg-slate-100 text-slate-500',
  listed: 'bg-emerald-100 text-emerald-700',
  ended:  'bg-red-100 text-red-500',
};

function loadProfile(id: string) {
  try { return JSON.parse(localStorage.getItem(`tukpa-profile-${id}`) ?? 'null') ?? {}; }
  catch { return {}; }
}
function saveProfile(id: string, data: object) {
  localStorage.setItem(`tukpa-profile-${id}`, JSON.stringify(data));
}

export function Settings({ tambola, apiKey, initOperator, initTab, onLogout }: SettingsProps) {
  const effectiveKey    = apiKey ?? tambola?.mktApiKey ?? '';
  const setEffectiveKey = tambola?.setMktApiKey ?? (() => {});
  const isPlanA         = !!apiKey;

  const [tab, setTab] = useState<Tab>(() =>
    initTab ?? (isPlanA ? 'games' : (effectiveKey ? 'games' : 'connect'))
  );
  const [inputKey,  setInputKey]  = useState(effectiveKey);
  const [keyStatus, setKeyStatus] = useState<'idle'|'checking'|'ok'|'error'>(effectiveKey ? 'ok' : 'idle');
  const [keyErr,    setKeyErr]    = useState('');
  const [operator,  setOperator]  = useState<MktOperator | null>(initOperator ?? null);

  const [games,     setGames]     = useState<MktGame[]>([]);
  const [purchases, setPurchases] = useState<MktPurchase[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  // sheet assignment state
  const [aFrom, setAFrom] = useState('');
  const [aTo,   setATo]   = useState('');
  const [aSaving, setASaving] = useState(false);

  // profile
  const [pName,  setPName]  = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pQr,    setPQr]    = useState<string | null>(null);
  const [pSaved, setPSaved] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const isConnected = keyStatus === 'ok' && !!effectiveKey;

  const tabs: Tab[] = isPlanA
    ? ['games', 'profile']
    : (isConnected ? ['games', 'profile'] : ['connect', 'profile']);

  // load profile when operator known
  useEffect(() => {
    if (!operator?.id) return;
    const p = loadProfile(operator.id);
    setPName(p.displayName ?? '');
    setPPhone(p.supportPhone ?? '');
    setPQr(p.qrBase64 ?? null);
  }, [operator?.id]);

  const loadData = useCallback(async (key = effectiveKey) => {
    if (!key) return;
    setLoading(true);
    try {
      const [info, purch] = await Promise.all([mktGetInfo(key), mktGetPurchases(key)]);
      setOperator(info.operator);
      setGames(info.games);
      setPurchases(purch.purchases);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [effectiveKey]);

  useEffect(() => {
    if (effectiveKey && keyStatus === 'ok') loadData(effectiveKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectKey() {
    const k = inputKey.trim();
    if (!k) return;
    setKeyStatus('checking'); setKeyErr('');
    try {
      const info = await mktGetInfo(k);
      setEffectiveKey(k);
      setOperator(info.operator);
      setGames(info.games);
      setKeyStatus('ok');
      const p = await mktGetPurchases(k);
      setPurchases(p.purchases);
      setTab('games');
    } catch (e) {
      setKeyStatus('error');
      setKeyErr(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  function disconnectKey() {
    setEffectiveKey(''); setInputKey('');
    setKeyStatus('idle'); setOperator(null);
    setGames([]); setPurchases([]);
    setTab('connect');
  }

  async function handleAssign(gameId: string) {
    if (!effectiveKey || !aFrom || !aTo) return;
    setASaving(true);
    try {
      const { game } = await mktAssignSheets(effectiveKey, gameId, +aFrom, +aTo);
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, sheetCount: game.sheetCount } : g));
      setAFrom(''); setATo('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setASaving(false); }
  }

  async function handleStatus(gameId: string, status: 'listed'|'draft'|'ended') {
    if (!effectiveKey) return;
    try {
      await mktSetStatus(effectiveKey, gameId, status);
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, status } : g));
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleDelete(gameId: string) {
    if (!effectiveKey || !confirm('Delete this game?')) return;
    try {
      await mktDeleteGame(effectiveKey, gameId);
      setGames(prev => prev.filter(g => g.id !== gameId));
      setPurchases(prev => prev.filter(p => p.gameId !== gameId));
      if (expanded === gameId) setExpanded(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleApprove(purchaseId: string) {
    if (!effectiveKey) return;
    try {
      await mktApprovePurchase(effectiveKey, purchaseId);
      setPurchases(prev => prev.map(p => p.purchaseId === purchaseId ? { ...p, status: 'approved' } : p));
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  function saveProfileData() {
    if (!operator?.id) return;
    saveProfile(operator.id, { displayName: pName, supportPhone: pPhone, qrBase64: pQr });
    setPSaved(true); setTimeout(() => setPSaved(false), 2000);
  }

  const totalPending = purchases.filter(p => p.status === 'pending').length;

  return (
    <div className="w-full h-full flex flex-col">

      {/* Header row */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="flex-1">
          <h2 className="text-lg font-black text-white leading-tight">
            {tab === 'profile' ? 'Profile' : tab === 'connect' ? 'Connect' : 'My Games'}
          </h2>
        </div>
        {isConnected && tab === 'games' && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => loadData(effectiveKey)} disabled={loading}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
            <button onClick={() => setShowWizard(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-slate-900 text-xs bg-amber-400 hover:bg-amber-300 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Game
            </button>
          </div>
        )}
      </div>

      {/* Tab bar — only show if more than one tab */}
      <div className="flex gap-0.5 bg-black/20 rounded-xl p-0.5 mb-3 shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-1.5 rounded-[10px] text-xs font-bold transition-all capitalize',
              tab === t ? 'bg-white text-sky-700 shadow-sm' : 'text-white/55 hover:text-white'
            )}>
            {t === 'connect' ? 'Connect' : t === 'games' ? 'My Games' : 'Profile'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto space-y-3">

        {/* ── CONNECT ── */}
        {tab === 'connect' && (
          <div className="space-y-3 max-w-md">
            <div className="bg-white rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-600" /> Marketplace API Key
              </p>
              {isConnected && operator && (
                <div className="flex items-center gap-2.5 p-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-green-800 text-sm truncate">{operator.name}</p>
                    <p className="text-green-600 text-xs">{operator.plan === 'own-sheets' ? 'Plan A' : 'Plan B'}</p>
                  </div>
                  <button onClick={disconnectKey} className="text-xs text-red-500 font-semibold flex items-center gap-1 shrink-0">
                    <Unlink className="w-3 h-3" /> Disconnect
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connectKey()} placeholder="Paste API key…"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400" />
                <button onClick={connectKey} disabled={keyStatus === 'checking' || !inputKey.trim()}
                  className="px-3 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  style={{ backgroundColor: '#0284c7' }}>
                  {keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect
                </button>
              </div>
              {keyStatus === 'error' && (
                <p className="text-red-600 text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyErr}</p>
              )}
              <p className="text-[11px] text-slate-400">Get your key from TungbolaMarket admin → Operators tab.</p>
            </div>
            {isConnected && (
              <button onClick={() => setTab('games')} className="w-full py-2.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: '#0284c7' }}>
                <Globe className="w-4 h-4" /> Go to My Games →
              </button>
            )}
          </div>
        )}

        {/* ── MY GAMES ── */}
        {tab === 'games' && (
          <>
            {!isConnected ? (
              <div className="bg-white/10 rounded-2xl p-8 text-center space-y-3">
                <Key className="w-8 h-8 text-white/20 mx-auto" />
                <p className="text-white/50 text-sm">Connect your API key first.</p>
                <button onClick={() => setTab('connect')} className="text-white font-semibold text-sm underline">Go to Connect</button>
              </div>
            ) : (
              <>
                {/* Pending alert banner */}
                {totalPending > 0 && (
                  <button
                    className="w-full flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-xl px-3 py-2 text-left"
                    onClick={() => {
                      // expand first game that has pending
                      const g = games.find(g => purchases.some(p => p.gameId === g.id && p.status === 'pending'));
                      if (g) setExpanded(g.id);
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-sm font-semibold flex-1">
                      {totalPending} order{totalPending > 1 ? 's' : ''} need approval
                    </p>
                    <span className="text-amber-400/60 text-xs">Tap to review →</span>
                  </button>
                )}

                {/* Games */}
                {loading && games.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                  </div>
                ) : games.length === 0 ? (
                  <div className="bg-white/10 rounded-2xl p-10 text-center space-y-2">
                    <Globe className="w-10 h-10 text-white/20 mx-auto" />
                    <p className="text-white/40 text-sm">No games yet. Tap <strong className="text-white">New Game</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {games.map(g => <GameCard
                      key={g.id}
                      game={g}
                      purchases={purchases.filter(p => p.gameId === g.id)}
                      expanded={expanded === g.id}
                      assignFrom={aFrom}
                      assignTo={aTo}
                      assigning={aSaving}
                      onToggle={() => setExpanded(expanded === g.id ? null : g.id)}
                      onAssignFromChange={setAFrom}
                      onAssignToChange={setATo}
                      onAssign={() => handleAssign(g.id)}
                      onStatus={s => handleStatus(g.id, s)}
                      onDelete={() => handleDelete(g.id)}
                      onApprove={handleApprove}
                    />)}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <div className="space-y-3 max-w-md">
            {/* Operator info */}
            {operator && (
              <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{operator.name}</p>
                  <p className="text-white/40 text-xs">{operator.plan === 'own-sheets' ? 'Plan A — Own Sheets' : 'Plan B — Generate'}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 space-y-3.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Display Info</p>

              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">Business / Display Name</label>
                <input type="text" value={pName} onChange={e => setPName(e.target.value)}
                  placeholder="Shown to players in game listings"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Support Phone
                </label>
                <input type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                <p className="text-[11px] text-slate-400 mt-1">Players see this number when they need help.</p>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                  <QrCode className="w-3 h-3" /> Payment QR Code
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Your UPI / bank QR — players scan this to pay for sheets.</p>
                {pQr ? (
                  <div className="flex items-start gap-3">
                    <img src={pQr} alt="QR" className="w-28 h-28 object-contain border border-slate-200 rounded-xl bg-white p-1 shrink-0" />
                    <div className="space-y-1.5 pt-1">
                      <button onClick={() => qrRef.current?.click()}
                        className="text-xs text-sky-600 font-semibold flex items-center gap-1">
                        <Image className="w-3 h-3" /> Replace
                      </button>
                      <button onClick={() => setPQr(null)}
                        className="text-xs text-red-500 font-semibold flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => qrRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-1.5 text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors">
                    <QrCode className="w-7 h-7" />
                    <span className="text-xs">Tap to upload QR image</span>
                  </button>
                )}
                <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = () => setPQr(r.result as string); r.readAsDataURL(f);
                }} />
              </div>

              <button onClick={saveProfileData}
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: pSaved ? '#16a34a' : '#0284c7' }}>
                {pSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
              </button>
            </div>

            {/* Marketplace connection (Plan B only) */}
            {!isPlanA && (
              <div className="bg-white rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-600" /> Marketplace Connection
                </p>
                {isConnected && operator ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{operator.name}</p>
                      <p className="text-xs text-slate-400">{operator.plan === 'own-sheets' ? 'Plan A' : 'Plan B'}</p>
                    </div>
                    <button onClick={disconnectKey} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <Unlink className="w-3 h-3" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setTab('connect')} className="text-sky-600 text-sm font-semibold underline">
                    Connect API key →
                  </button>
                )}
              </div>
            )}

            {/* Storage note */}
            <div className="flex items-center gap-2 text-white/30 text-xs px-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Profile saved locally on this device.</span>
            </div>

            {/* Logout */}
            {onLogout && (
              <button onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white/50 bg-white/10 hover:bg-red-500/20 hover:text-red-300 transition-colors border border-white/10">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            )}
          </div>
        )}
      </div>

      {/* Wizard */}
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

// ── Game Card ─────────────────────────────────────────────────────────────────

function GameCard({
  game: g, purchases, expanded, assignFrom, assignTo, assigning,
  onToggle, onAssignFromChange, onAssignToChange, onAssign,
  onStatus, onDelete, onApprove,
}: {
  game: MktGame;
  purchases: MktPurchase[];
  expanded: boolean;
  assignFrom: string;
  assignTo: string;
  assigning: boolean;
  onToggle: () => void;
  onAssignFromChange: (v: string) => void;
  onAssignToChange: (v: string) => void;
  onAssign: () => void;
  onStatus: (s: 'listed'|'draft'|'ended') => void;
  onDelete: () => void;
  onApprove: (id: string) => void;
}) {
  const pending  = purchases.filter(p => p.status === 'pending');
  const approved = purchases.filter(p => p.status === 'approved');
  const revenue  = approved.reduce((s, p) => s + p.amount, 0);
  const remaining = g.sheetCount - g.soldCount;
  const pct = g.sheetCount > 0 ? Math.round((g.soldCount / g.sheetCount) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* ── Card body ── */}
      <div className="p-4">

        {/* Name + status */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-black text-slate-800 text-base leading-tight flex-1">{g.name}</h3>
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0', STATUS_PILL[g.status] ?? STATUS_PILL.draft)}>
            {g.status}
          </span>
        </div>

        {/* Date */}
        {g.gameDate && (
          <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
            <Calendar className="w-3 h-3" /> {g.gameDate}
          </p>
        )}

        {/* Sold / Remaining / Price — big numbers */}
        {g.sheetCount > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <div className="bg-sky-50 rounded-xl p-2.5 text-center">
                <p className="text-2xl font-black text-sky-600 leading-none">{g.soldCount}</p>
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mt-0.5">Sold</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-2xl font-black text-slate-700 leading-none">{remaining}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Left</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-emerald-600 leading-none">₹{g.pricePerSheet}</p>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mt-0.5">/ sheet</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mb-2.5">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] mt-0.5">
                <span className="text-slate-400">{pct}% sold</span>
                {revenue > 0 && (
                  <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" /> ₹{revenue.toLocaleString()} earned
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-amber-500 font-medium bg-amber-50 rounded-xl px-3 py-2 mb-2.5">
            No sheets assigned — expand to assign
          </p>
        )}

        {/* Pending badge */}
        {pending.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {pending.length} pending order{pending.length > 1 ? 's' : ''} — tap to approve
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusActions status={g.status} sheetCount={g.sheetCount} onSetStatus={onStatus} />
          <button onClick={onDelete} className="ml-auto p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle} className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-semibold transition-colors">
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5" /> Details</>}
          </button>
        </div>
      </div>

      {/* ── Expanded section ── */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">

          {/* Assign sheets (draft only) */}
          {g.status === 'draft' && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TicketCheck className="w-3 h-3" /> Assign Sheet Range
              </p>
              <div className="flex items-center gap-2">
                <input type="number" value={assignFrom} onChange={e => onAssignFromChange(e.target.value)}
                  placeholder="From" min={1}
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-400" />
                <span className="text-slate-300 font-bold">–</span>
                <input type="number" value={assignTo} onChange={e => onAssignToChange(e.target.value)}
                  placeholder="To" min={1}
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-400" />
                <button onClick={onAssign} disabled={assigning || !assignFrom || !assignTo}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1 shrink-0"
                  style={{ backgroundColor: '#0284c7' }}>
                  {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Assign
                </button>
              </div>
              {assignFrom && assignTo && +assignTo >= +assignFrom && (
                <p className="text-xs text-sky-500 font-medium mt-1.5 text-center">
                  {+assignTo - +assignFrom + 1} sheets will be assigned
                </p>
              )}
            </div>
          )}

          {/* Orders */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" /> Orders ({purchases.length})
              </p>
              {approved.length > 0 && (
                <span className="text-[11px] text-emerald-600 font-semibold">{approved.length} approved</span>
              )}
            </div>
            {purchases.length === 0 ? (
              <p className="text-slate-400 text-xs py-1.5">No orders for this game yet.</p>
            ) : (
              <div className="space-y-1.5">
                {[...purchases]
                  .sort((a, b) => (a.status === 'pending' ? -1 : 1) || b.createdAt - a.createdAt)
                  .map(p => (
                    <div key={p.purchaseId} className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2',
                      p.status === 'pending' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">{p.playerName}</p>
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {p.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{p.phone}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.quantity} sheet{p.quantity > 1 ? 's' : ''} ·{' '}
                          <span className="font-bold text-slate-700">₹{p.amount}</span>
                          {p.sheetNums?.length ? ` · #${p.sheetNums.join(', ')}` : ''}
                        </p>
                      </div>
                      {p.status === 'pending' && (
                        <button onClick={() => onApprove(p.purchaseId)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: '#0284c7' }}>
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
}

// ── Status action buttons ─────────────────────────────────────────────────────

function StatusActions({ status, sheetCount, onSetStatus }: {
  status: string; sheetCount: number; onSetStatus: (s: 'listed'|'draft'|'ended') => void;
}) {
  if (status === 'draft') return sheetCount > 0 ? (
    <button onClick={() => onSetStatus('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">List Now</button>
  ) : null;
  if (status === 'listed') return (
    <>
      <button onClick={() => onSetStatus('draft')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100">Unlist</button>
      <button onClick={() => onSetStatus('ended')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200">End</button>
    </>
  );
  if (status === 'ended') return (
    <button onClick={() => onSetStatus('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Reopen</button>
  );
  return null;
}

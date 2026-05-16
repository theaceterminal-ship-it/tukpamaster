import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, RefreshCw, Loader2, AlertTriangle, Calendar,
  ShoppingBag, Check, Trash2, Wifi, WifiOff,
  TicketCheck, TrendingUp, X, IndianRupee, Clock,
} from 'lucide-react';
import {
  mktGetInfo, mktGetPurchases, mktAssignSheets,
  mktSetStatus, mktDeleteGame, mktApprovePurchase, mktRejectPurchase,
  mktSubmitPlatformPayment,
  type MktGame, type MktPurchase, type MktOperator,
} from '@/services/marketplaceApi';
import { ScheduleGameWizard } from '@/components/marketplace/ScheduleGameWizard';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  draft:  { dot: 'bg-slate-400',   text: 'text-slate-500',  bg: 'bg-slate-50'   },
  listed: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  ended:  { dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50'     },
};

interface Props {
  apiKey: string;
  initialOperator?: MktOperator;
}

export function GamesHome({ apiKey, initialOperator }: Props) {
  const [operator,      setOperator]      = useState<MktOperator | null>(initialOperator ?? null);
  const [games,         setGames]         = useState<MktGame[]>([]);
  const [purchases,     setPurchases]     = useState<MktPurchase[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [wizard,        setWizard]        = useState(false);
  const [assignFrom,    setAssignFrom]    = useState<Record<string, string>>({});
  const [assignTo,      setAssignTo]      = useState<Record<string, string>>({});
  const [aLoading,      setALoading]      = useState<string | null>(null);
  const [adminUpiId,    setAdminUpiId]    = useState('');
  const [paymentModal,  setPaymentModal]  = useState<MktGame | null>(null);
  const [utrInput,      setUtrInput]      = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [paySuccess,    setPaySuccess]    = useState(false);
  const [rejecting,     setRejecting]     = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const [info, purch] = await Promise.all([mktGetInfo(apiKey), mktGetPurchases(apiKey)]);
      setOperator(info.operator); setGames(info.games); setPurchases(purch.purchases);
      setAdminUpiId(info.adminUpiId || '');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [apiKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPending = purchases.filter(p => p.status === 'pending').length;

  async function assignSheets(gameId: string) {
    const from = assignFrom[gameId] || '';
    const to   = assignTo[gameId]   || '';
    if (!apiKey || !from || !to) return;
    setALoading(gameId);
    try {
      const { game } = await mktAssignSheets(apiKey, gameId, +from, +to);
      setGames(p => p.map(g => g.id === gameId ? { ...g, sheetCount: game.sheetCount } : g));
      setAssignFrom(p => ({ ...p, [gameId]: '' }));
      setAssignTo(p =>   ({ ...p, [gameId]: '' }));
    } catch (e) { alert(String(e)); }
    finally { setALoading(null); }
  }

  async function setStatus(gameId: string, status: 'listed'|'draft'|'ended') {
    if (!apiKey) return;
    try { await mktSetStatus(apiKey, gameId, status); setGames(p => p.map(g => g.id === gameId ? { ...g, status } : g)); }
    catch (e) { alert(String(e)); }
  }

  async function submitPayment(gameId: string) {
    const utr = utrInput.trim();
    if (!apiKey || !utr) return;
    setPaySubmitting(true);
    try {
      await mktSubmitPlatformPayment(apiKey, gameId, utr);
      setGames(p => p.map(g => g.id === gameId ? { ...g, platformPaymentStatus: 'pending' } : g));
      setPaySuccess(true);
    } catch (e) {
      alert(String(e));
    } finally {
      setPaySubmitting(false);
    }
  }

  function openPaymentModal(game: MktGame) {
    setPaymentModal(game);
    setUtrInput('');
    setPaySuccess(false);
  }

  function closePaymentModal() {
    setPaymentModal(null);
    setUtrInput('');
    setPaySuccess(false);
  }

  async function deleteGame(gameId: string) {
    if (!apiKey || !confirm('Delete this game and all purchases?')) return;
    try {
      await mktDeleteGame(apiKey, gameId);
      setGames(p => p.filter(g => g.id !== gameId));
      setPurchases(p => p.filter(x => x.gameId !== gameId));
    } catch (e) { alert(String(e)); }
  }

  async function approve(purchaseId: string) {
    if (!apiKey) return;
    try { await mktApprovePurchase(apiKey, purchaseId); setPurchases(p => p.map(x => x.purchaseId === purchaseId ? { ...x, status: 'approved' } : x)); }
    catch (e) { alert(String(e)); }
  }

  async function reject(purchaseId: string) {
    if (!apiKey || !confirm('Reject this order?')) return;
    setRejecting(purchaseId);
    try { await mktRejectPurchase(apiKey, purchaseId); setPurchases(p => p.map(x => x.purchaseId === purchaseId ? { ...x, status: 'rejected' } : x)); }
    catch (e) { alert(String(e)); }
    finally { setRejecting(null); }
  }

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <WifiOff className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm text-center">Not connected to marketplace.</p>
        <p className="text-white/25 text-xs text-center">Go to Profile to connect your API key.</p>
      </div>
    );
  }

  const payFee    = paymentModal ? (paymentModal.sheetCount * 1.99).toFixed(2) : '0';
  const payQrUrl  = paymentModal && adminUpiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=${adminUpiId}&pn=TungbolaMarket&am=${payFee}&tn=Listing Fee ${paymentModal.name}&cu=INR`)}`
    : '';
  const payUpiUrl = paymentModal && adminUpiId
    ? `https://tungbola-market.vercel.app/api/pay-redirect?pa=${encodeURIComponent(adminUpiId)}&pn=TungbolaMarket&am=${payFee}&tn=${encodeURIComponent(`Listing Fee ${paymentModal.name}`)}`
    : '';

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Action bar */}
      <div className="flex items-center gap-2 shrink-0">
        {operator && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Wifi className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{operator.name}</span>
          </div>
        )}
        <div className="flex-1" />
        <button onClick={loadData} disabled={loading}
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
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 border border-amber-400/20 bg-amber-400/10 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm font-semibold flex-1">
            {totalPending} pending order{totalPending > 1 ? 's' : ''} waiting for approval
          </p>
        </div>
      )}

      {/* Game grid */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && games.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Globe className="w-10 h-10 text-white/20" />
            <p className="text-white/40 text-sm">No games yet. Tap New Game to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {games.map(g => {
              const gp   = purchases.filter(p => p.gameId === g.id && p.status !== 'rejected');
              const pend = gp.filter(p => p.status === 'pending');
              const appr = gp.filter(p => p.status === 'approved');
              const rev  = appr.reduce((s, p) => s + p.amount, 0);
              const left = g.sheetCount - g.soldCount;
              const pct  = g.sheetCount > 0 ? Math.round(g.soldCount / g.sheetCount * 100) : 0;
              const st   = STATUS[g.status] ?? STATUS.draft;

              return (
                <div key={g.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="font-black text-slate-900 text-base leading-tight flex-1">{g.name}</h3>
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize', st.text, st.bg)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', st.dot)} />
                        {g.status}
                      </span>
                    </div>

                    {g.gameDate && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <Calendar className="w-3 h-3" /> {g.gameDate}
                      </p>
                    )}

                    {g.sheetCount > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <Stat value={g.soldCount}           label="Sold"      color="text-sky-600"     />
                          <Stat value={left}                  label="Remaining" color="text-slate-800"   />
                          <Stat value={`₹${g.pricePerSheet}`} label="/ sheet"   color="text-emerald-600" />
                        </div>
                        <div className="mb-3">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e2e8f0' }}>
                            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] mt-1">
                            <span className="text-slate-400">{pct}% sold</span>
                            {rev > 0 && <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" />₹{rev.toLocaleString()}</span>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-amber-400 font-medium mb-3 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> No sheets assigned yet
                      </p>
                    )}

                    {pend.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {pend.length} pending order{pend.length > 1 ? 's' : ''}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {g.status === 'draft' && g.sheetCount > 0 ? (
                        g.platformPaymentStatus === 'pending' ? (
                          <button onClick={loadData}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                            <Clock className="w-3 h-3" /> Pending verification · tap to refresh
                          </button>
                        ) : (
                          <button onClick={() => openPaymentModal(g)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold text-white bg-emerald-500 hover:bg-emerald-400 transition-colors">
                            <IndianRupee className="w-3 h-3" />
                            Publish · ₹{(g.sheetCount * 1.99).toFixed(2)}
                          </button>
                        )
                      ) : (
                        <StatusBtns status={g.status} sheetCount={g.sheetCount} onSet={s => setStatus(g.id, s)} />
                      )}
                      <button onClick={() => deleteGame(g.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t divide-y" style={{ borderColor: '#e2e8f0' }}>
                    {g.status === 'draft' && (() => {
                      const gFrom = assignFrom[g.id] || '';
                      const gTo   = assignTo[g.id]   || '';
                      return (
                        <div className="px-4 py-3">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <TicketCheck className="w-3 h-3" /> Assign Sheet Range
                          </p>
                          <div className="flex items-center gap-2">
                            <input type="number" value={gFrom}
                              onChange={e => setAssignFrom(p => ({ ...p, [g.id]: e.target.value }))}
                              placeholder="From"
                              className="flex-1 rounded-lg px-2.5 py-2 text-sm text-center text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-sky-400" />
                            <span className="text-slate-300 font-bold">–</span>
                            <input type="number" value={gTo}
                              onChange={e => setAssignTo(p => ({ ...p, [g.id]: e.target.value }))}
                              placeholder="To"
                              className="flex-1 rounded-lg px-2.5 py-2 text-sm text-center text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-sky-400" />
                            <button onClick={() => assignSheets(g.id)} disabled={aLoading === g.id || !gFrom || !gTo}
                              className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-40 flex items-center gap-1 shrink-0 transition-colors">
                              {aLoading === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Assign
                            </button>
                          </div>
                          {gFrom && gTo && +gTo >= +gFrom && (
                            <p className="text-xs text-sky-600 font-medium mt-1.5 text-center">{+gTo - +gFrom + 1} sheets will be assigned</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" /> Orders ({gp.length})
                        </p>
                        {appr.length > 0 && <span className="text-[11px] text-emerald-600 font-semibold">{appr.length} approved</span>}
                      </div>
                      {gp.length === 0 ? (
                        <p className="text-slate-400 text-xs py-2">No orders for this game.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {[...gp].sort(a => (a.status === 'pending' ? -1 : 1)).map(p => (
                            <div key={p.purchaseId} className={cn('flex items-center gap-3 rounded-xl px-3 py-2',
                              p.status === 'pending'  ? 'bg-amber-50 border border-amber-200' :
                              p.status === 'rejected' ? 'bg-red-50 border border-red-100' : 'bg-slate-50'
                            )}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-slate-800 text-sm">{p.playerName}</p>
                                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                    p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    p.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                    'bg-amber-100 text-amber-700')}>
                                    {p.status === 'approved' ? '✓ Approved' : p.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">{p.phone}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {p.quantity} sheet{p.quantity > 1 ? 's' : ''} · <span className="font-bold text-slate-800">₹{p.amount}</span>
                                  {p.sheetNums?.length ? ` · #${p.sheetNums.join(', ')}` : ''}
                                </p>
                              </div>
                              {p.status === 'pending' && (
                                <div className="shrink-0 flex items-center gap-1">
                                  <button onClick={() => approve(p.purchaseId)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 transition-colors">
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                  <button onClick={() => reject(p.purchaseId)} disabled={rejecting === p.purchaseId}
                                    className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 bg-red-50 hover:bg-red-100 disabled:opacity-40 transition-colors">
                                    {rejecting === p.purchaseId ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {wizard && (
        <ScheduleGameWizard
          apiKey={apiKey}
          onCreated={game => { setGames(p => [game, ...p]); setWizard(false); }}
          onClose={() => setWizard(false)}
        />
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            {paySuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Payment Submitted!</h3>
                  <p className="text-sm text-slate-500 mt-1">Your game will go live once admin verifies your payment. Usually within a few minutes.</p>
                </div>
                <button onClick={closePaymentModal}
                  className="w-full py-3 rounded-2xl font-bold text-white text-sm bg-slate-800 hover:bg-slate-700 transition-colors">
                  Got it
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Publish Game</h3>
                  <button onClick={closePaymentModal} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 truncate">{paymentModal.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{paymentModal.sheetCount} sheets × ₹1.99</span>
                    <span className="text-2xl font-black text-emerald-600">₹{(paymentModal.sheetCount * 1.99).toFixed(2)}</span>
                  </div>
                </div>

                {adminUpiId && payQrUrl ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img src={payQrUrl} alt="Pay QR" className="w-40 h-40 rounded-2xl border-2 border-violet-200" />
                    </div>
                    <p className="text-[11px] text-slate-400 text-center">
                      Scan QR · pay to <span className="font-mono font-semibold text-slate-600">{adminUpiId}</span>
                    </p>
                    <a href={payUpiUrl} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-black text-white text-sm bg-violet-600 hover:bg-violet-500 transition-colors">
                      <IndianRupee className="w-4 h-4" /> Open UPI App — ₹{payFee}
                    </a>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                    <p className="text-sm text-amber-700 font-medium">Contact admin for UPI payment details.</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">UTR / Transaction Reference</label>
                  <input
                    type="text"
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value)}
                    placeholder="e.g. 411234567890"
                    className="w-full border-2 border-slate-200 focus:border-sky-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Find this in your UPI app after payment</p>
                </div>

                <button
                  onClick={() => submitPayment(paymentModal.id)}
                  disabled={paySubmitting || utrInput.trim().length < 6}
                  className="w-full py-3 rounded-2xl font-black text-white text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                  {paySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Submit UTR
                </button>

                <p className="text-[11px] text-slate-400 text-center">Your game will go live once admin verifies your payment</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: number|string; label: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5 text-center bg-slate-100">
      <p className={cn('text-2xl font-black leading-none', color)}>{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function StatusBtns({ status, sheetCount, onSet }: { status: string; sheetCount: number; onSet: (s:'listed'|'draft'|'ended') => void }) {
  if (status === 'draft') return sheetCount > 0 ? (
    <button onClick={() => onSet('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">List Now</button>
  ) : null;
  if (status === 'listed') return (
    <>
      <button onClick={() => onSet('draft')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Unlist</button>
      <button onClick={() => onSet('ended')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">End</button>
    </>
  );
  if (status === 'ended') return (
    <button onClick={() => onSet('listed')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Reopen</button>
  );
  return null;
}

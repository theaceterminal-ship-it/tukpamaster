import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  Phone, Hash, IndianRupee, ShoppingBag,
} from 'lucide-react';
import {
  mktGetPurchases, mktApprovePurchase, mktRejectPurchase,
  type MktPurchase,
} from '@/services/marketplaceApi';
import { cn } from '@/lib/utils';

type Tab = 'pending' | 'approved' | 'rejected';

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function PlanAOrders({ apiKey }: { apiKey: string }) {
  const [purchases, setPurchases] = useState<MktPurchase[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [tab, setTab]             = useState<Tab>('pending');
  const [acting, setActing]       = useState<Record<string, 'approving' | 'rejecting'>>({});

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const { purchases: ps } = await mktGetPurchases(apiKey);
      setPurchases(ps);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  async function approve(p: MktPurchase) {
    setActing(a => ({ ...a, [p.purchaseId]: 'approving' }));
    try {
      await mktApprovePurchase(apiKey, p.purchaseId);
      setPurchases(ps => ps.map(x => x.purchaseId === p.purchaseId ? { ...x, status: 'approved' } : x));
      setTab('approved');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActing(a => { const n = { ...a }; delete n[p.purchaseId]; return n; });
    }
  }

  async function reject(p: MktPurchase) {
    if (!confirm(`Reject order from ${p.playerName}?`)) return;
    setActing(a => ({ ...a, [p.purchaseId]: 'rejecting' }));
    try {
      await mktRejectPurchase(apiKey, p.purchaseId);
      setPurchases(ps => ps.map(x => x.purchaseId === p.purchaseId ? { ...x, status: 'rejected' } : x));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActing(a => { const n = { ...a }; delete n[p.purchaseId]; return n; });
    }
  }

  const counts = {
    pending:  purchases.filter(p => p.status === 'pending').length,
    approved: purchases.filter(p => p.status === 'approved').length,
    rejected: purchases.filter(p => p.status === 'rejected').length,
  };

  const visible = purchases.filter(p => p.status === tab);

  return (
    <div className="w-full max-w-2xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Orders</h2>
          <p className="text-white/30 text-xs mt-0.5">Approve or reject player purchases</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/50 hover:text-white transition-colors disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stat tabs */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: 'pending',  label: 'Pending',  count: counts.pending,  color: 'text-amber-400',  bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
          { id: 'approved', label: 'Approved', count: counts.approved, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
          { id: 'rejected', label: 'Rejected', count: counts.rejected, color: 'text-red-400',     bg: 'bg-red-400/10',   border: 'border-red-400/30' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('rounded-xl p-3 text-left border transition-all',
              tab === t.id ? `${t.bg} ${t.border}` : 'bg-white/5 border-white/10 hover:bg-white/8')}>
            <p className={cn('text-2xl font-black tabular-nums', tab === t.id ? t.color : 'text-white/60')}>{t.count}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Error */}
      {err && (
        <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* Orders list */}
      {loading && !purchases.length ? (
        <div className="flex items-center justify-center py-16 text-white/20">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {tab} orders</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(p => {
            const isActing = !!acting[p.purchaseId];
            return (
              <div key={p.purchaseId}
                className="rounded-2xl p-4 space-y-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>

                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm">{p.playerName}</p>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                        p.status === 'pending'  ? 'bg-amber-400/15 text-amber-400' :
                        p.status === 'approved' ? 'bg-emerald-400/15 text-emerald-400' :
                                                  'bg-red-400/15 text-red-400')}>
                        {p.status === 'pending' ? '⏳ Pending' : p.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs mt-0.5 truncate">{p.gameName}</p>
                  </div>
                  <p className="text-white font-black text-sm shrink-0">₹{p.amount.toLocaleString('en-IN')}</p>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <Phone className="w-3 h-3" /> {p.phone}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <Hash className="w-3 h-3" /> {p.quantity} sheet{p.quantity > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <IndianRupee className="w-3 h-3" /> ₹{p.amount / p.quantity}/sheet
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Clock className="w-3 h-3" /> {fmtDate(p.createdAt)}
                  </span>
                </div>

                {/* UTR / sheet nums */}
                {p.utr && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">UTR</span>
                    <code className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded font-mono">{p.utr}</code>
                  </div>
                )}
                {p.sheetNums && p.sheetNums.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">Sheets</span>
                    {p.sheetNums.map(n => (
                      <span key={n} className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">#{n}</span>
                    ))}
                  </div>
                )}

                {/* Actions — only on pending */}
                {p.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => approve(p)} disabled={isActing}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                      {acting[p.purchaseId] === 'approving'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Approve & Send Sheets
                    </button>
                    <button onClick={() => reject(p)} disabled={isActing}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-red-400 border border-red-400/30 hover:bg-red-400/10 disabled:opacity-50 transition-colors">
                      {acting[p.purchaseId] === 'rejecting'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

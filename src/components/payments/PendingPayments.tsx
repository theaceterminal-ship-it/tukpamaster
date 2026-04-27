import { useState } from 'react';
import {
  ClipboardList, CheckCircle2, XCircle, Download,
  Phone, Clock, ChevronDown, ChevronUp, Wallet, Package,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import type { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { buildBulkPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';

interface PendingPaymentsProps {
  tambola: ReturnType<typeof useTambola>;
}

type Tab = 'pending' | 'confirmed' | 'rejected';

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

function OrderCard({ order, tambola, onConfirm, onReject }: {
  order: Order;
  tambola: ReturnType<typeof useTambola>;
  onConfirm?: () => void;
  onReject?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sheets = tambola.sheets.filter(s => order.sheetIds.includes(s.id));

  const downloadTickets = () => {
    if (sheets.length === 0) return;
    const doc = buildBulkPDF(sheets, DEFAULT_LAYOUT);
    doc.save(`tickets-${order.playerName.replace(/\s+/g, '-')}-${order.id}.pdf`);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const statusStyles = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    rejected:  'bg-red-100 text-red-700',
  };

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3.5 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{order.playerName}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[order.status]}`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
            <span className="font-mono text-xs text-slate-400">{order.id}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
            {order.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{order.phone}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(order.createdAt)}</span>
            <span>{order.sheetIds.length} sheets · <strong className="text-slate-600">₹{order.amount}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.status === 'pending' && onConfirm && onReject && (
            <>
              <Button size="sm" onClick={e => { e.stopPropagation(); onConfirm(); }} className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onReject(); }} className="h-8 text-xs text-red-500 hover:bg-red-50 gap-1">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {order.status === 'confirmed' && (
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); downloadTickets(); }} className="h-8 text-xs gap-1">
              <Download className="w-3 h-3" /> Tickets PDF
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2.5 border-t border-slate-100 bg-slate-50 space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">UTR / Transaction ID</span>
              <span className="font-mono text-slate-700">{order.utr || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ordered</span>
              <span className="text-slate-700">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.confirmedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Confirmed</span>
                <span className="text-slate-700">{new Date(order.confirmedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 font-medium">Sheets in this order</p>
            <div className="flex flex-wrap gap-1.5">
              {order.sheetIds.map(id => (
                <span key={id} className="bg-white border border-slate-200 text-slate-700 text-xs font-mono px-2 py-0.5 rounded-full">
                  {id}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingPayments({ tambola }: PendingPaymentsProps) {
  const [tab, setTab] = useState<Tab>('pending');

  const counts = {
    pending:   tambola.orders.filter(o => o.status === 'pending').length,
    confirmed: tambola.orders.filter(o => o.status === 'confirmed').length,
    rejected:  tambola.orders.filter(o => o.status === 'rejected').length,
  };

  const displayed = [...tambola.orders]
    .filter(o => o.status === tab)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const confirmedTotal = tambola.orders.filter(o => o.status === 'confirmed').reduce((s, o) => s + o.amount, 0);
  const pendingTotal   = tambola.orders.filter(o => o.status === 'pending').reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-6 h-6" style={{ color: '#e8622a' }} />
          Pending Payments
        </h2>
        <p className="text-slate-500 mt-1">Review player orders and confirm or reject UPI payments.</p>
      </div>

      {/* ── Stats + UPI settings in one row ── */}
      <div className="grid grid-cols-5 gap-4 w-full">

        {/* 3 stat boxes */}
        <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer" style={CARD} onClick={() => setTab('pending')}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
            <Clock className="w-4 h-4" style={{ color: '#e8622a' }} />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600 tabular-nums">{counts.pending}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pending · ₹{pendingTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer" style={CARD} onClick={() => setTab('confirmed')}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 tabular-nums">{counts.confirmed}</p>
            <p className="text-xs text-gray-400 mt-0.5">Confirmed · ₹{confirmedTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer" style={CARD} onClick={() => setTab('rejected')}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-100">
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-red-600 tabular-nums">{counts.rejected}</p>
            <p className="text-xs text-gray-400 mt-0.5">Rejected</p>
          </div>
        </div>

        {/* UPI settings — spans remaining 2 cols */}
        <div className="col-span-2 rounded-xl p-4 flex items-end gap-3" style={CARD}>
          <div className="flex items-center gap-2 mb-0.5 shrink-0">
            <Wallet className="w-4 h-4" style={{ color: '#e8622a' }} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">Payment Settings</p>
          </div>
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="w-28 shrink-0">
              <label className="text-xs text-slate-400 block mb-1">Price / Sheet (₹)</label>
              <input
                type="text" inputMode="numeric"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={tambola.sheetPrice || ''}
                onChange={e => tambola.setSheetPrice(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="50"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-slate-400 block mb-1">UPI ID</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={tambola.upiSettings.upiId}
                onChange={e => tambola.setUpiSettings({ ...tambola.upiSettings, upiId: e.target.value })}
                placeholder="yourname@upi"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-slate-400 block mb-1">Display Name</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={tambola.upiSettings.merchantName}
                onChange={e => tambola.setUpiSettings({ ...tambola.upiSettings, merchantName: e.target.value })}
                placeholder="Your Name / Business"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Orders list ── */}
      <div className="rounded-2xl overflow-hidden w-full" style={CARD}>
        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 pt-1">
          {(['pending', 'confirmed', 'rejected'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {t}
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {displayed.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400">No {tab} orders.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tambola={tambola}
                  onConfirm={order.status === 'pending' ? () => tambola.confirmOrder(order.id) : undefined}
                  onReject={order.status === 'pending' ? () => tambola.rejectOrder(order.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

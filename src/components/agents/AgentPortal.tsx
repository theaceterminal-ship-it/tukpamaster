import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTambola } from '@/hooks/useTambola';
import type { Sheet } from '@/types';
import {
  Download, Package, ShoppingBag, Dice5, Eye,
  Search, X, Phone, BadgePercent, Wallet, BarChart3,
  ChevronLeft, ChevronRight, Clock, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { buildBulkPDF, buildSheetPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';

type StatusFilter = 'all' | 'available' | 'sold';
const PAGE_SIZE = 100;

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Mark Sold Dialog ─────────────────────────────────────────────────────────

function MarkSoldDialog({ sheet, price, onConfirm }: {
  sheet: Sheet;
  price: number;
  onConfirm: (sheetId: string, name: string, phone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onConfirm(sheet.id, name.trim(), phone.trim());
    setName(''); setPhone('');
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 px-2.5 text-xs gap-1 text-emerald-600 hover:bg-emerald-50 font-medium">
        <ShoppingBag className="w-3 h-3" /> Sell
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" /> Mark as Sold
            </DialogTitle>
          </DialogHeader>
          <div className="py-1 space-y-1 text-sm">
            <div className="bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
              <span className="text-slate-500">Sheet</span>
              <span className="font-mono font-semibold text-slate-700">{sheet.id}</span>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
              <span className="text-slate-500">Sale amount</span>
              <span className="font-semibold text-emerald-600">₹{price}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600">Buyer Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Customer full name" className="mt-1" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Phone (optional)</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={!name.trim()} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
              <ShoppingBag className="w-3.5 h-3.5" /> Confirm Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentPortal() {
  const { agentId } = useParams<{ agentId: string }>();
  const tambola     = useTambola();
  const agent       = tambola.agents.find(a => a.id === agentId);

  const [tab,        setTab]        = useState<StatusFilter>('all');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewId,  setPreviewId]  = useState('');

  const mySheets = useMemo(
    () => tambola.sheets.filter(s => s.assignedTo === agentId),
    [tambola.sheets, agentId],
  );

  const gameBreakdown = useMemo(() => {
    const byGame: Record<string, { id: string; name: string; total: number; sold: number; available: number }> = {};
    mySheets.forEach(s => {
      const gid = s.scheduledGameId;
      if (!gid) return;
      if (!byGame[gid]) {
        const game = tambola.scheduledGames.find(g => g.id === gid);
        byGame[gid] = { id: gid, name: game?.name ?? gid, total: 0, sold: 0, available: 0 };
      }
      byGame[gid].total++;
      if (s.status === 'sold') byGame[gid].sold++;
      else byGame[gid].available++;
    });
    return Object.values(byGame);
  }, [mySheets, tambola.scheduledGames]);

  const soldSheets      = mySheets.filter(s => s.status === 'sold');
  const availableSheets = mySheets.filter(s => s.status !== 'sold');
  const revenue         = soldSheets.reduce((sum, s) => sum + (s.price ?? tambola.sheetPrice), 0);
  const commission      = agent ? Math.round(revenue * agent.commission / 100) : 0;
  const sellPct         = mySheets.length > 0 ? Math.round((soldSheets.length / mySheets.length) * 100) : 0;

  const recentSales = useMemo(() =>
    tambola.players
      .filter(p => p.ticketIds.some(tid => mySheets.some(s => tid.startsWith(s.id + '-'))))
      .slice(-6)
      .reverse(),
    [tambola.players, mySheets],
  );

  const filtered = useMemo(() => {
    const query = search.trim().replace(/^0+/, '');
    return mySheets
      .filter(s => {
        if (tab === 'sold'      && s.status !== 'sold') return false;
        if (tab === 'available' && s.status === 'sold') return false;
        if (query) {
          const num = s.id.replace('SHEET-', '').replace(/^0+/, '');
          return num.includes(query) || s.id.toLowerCase().includes(query.toLowerCase());
        }
        return true;
      })
      .reverse();
  }, [mySheets, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const counts     = { all: mySheets.length, available: availableSheets.length, sold: soldSheets.length };

  const setFilter    = (f: StatusFilter) => { setTab(f); setPage(1); };
  const handleSearch = (v: string)       => { setSearch(v); setPage(1); };

  const openPreview = (sheet: Sheet) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(buildSheetPDF(sheet, DEFAULT_LAYOUT).output('bloburl') as unknown as string);
    setPreviewId(sheet.id);
  };
  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewId('');
  };

  const downloadAll   = () => { if (mySheets.length) buildBulkPDF(mySheets, DEFAULT_LAYOUT).save(`sheets-${agent?.name ?? agentId}.pdf`); };
  const downloadSheet = (s: Sheet) => { buildSheetPDF(s, DEFAULT_LAYOUT).save(`${parseInt(s.id.replace('SHEET-', ''), 10) || 1}.pdf`); };

  // ── Not found ────────────────────────────────────────────────────────────────

  if (!agent) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
      <div className="text-center space-y-3 bg-white rounded-2xl p-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
          <Dice5 className="w-8 h-8" style={{ color: '#0ea5e9' }} />
        </div>
        <p className="text-lg font-bold text-gray-900">Agent not found</p>
        <p className="text-sm text-gray-400">This link may be invalid or the agent was removed.</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#0ea5e9' }}>

      {/* PDF preview */}
      <Dialog open={!!previewUrl} onOpenChange={v => !v && closePreview()}>
        <DialogContent className="max-w-3xl w-[90vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="font-mono text-sm">{previewId}</DialogTitle>
          </DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="flex-1 w-full border-0 rounded-b-lg" />}
        </DialogContent>
      </Dialog>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-black/10 w-full" style={{ backgroundColor: '#0284c7' }}>
        <div className="w-full px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <Dice5 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">TukpaMaster</span>
            <span className="text-white/40 text-sm hidden sm:block">·</span>
            <span className="text-white/60 text-sm hidden sm:block">Agent Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold" style={{ color: '#0284c7' }}>
                {agent.name[0].toUpperCase()}
              </div>
              <span className="text-white text-sm font-medium hidden sm:block">{agent.name}</span>
              <span className="text-white/50 text-xs hidden md:block">· {agent.commission}% comm</span>
            </div>
            <Button onClick={downloadAll} disabled={!mySheets.length} size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-2 shrink-0">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download All</span>
              <span className="text-xs opacity-75">({mySheets.length})</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full px-6 py-5 space-y-5">

        {/* ── Hero banner — full width ── */}
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' }}
        >
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-8 px-7 py-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-xl font-black text-slate-900 shrink-0">
                {agent.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{agent.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{agent.phone}</span>
                  <span className="flex items-center gap-1.5"><BadgePercent className="w-3.5 h-3.5" />{agent.commission}% commission</span>
                </div>
              </div>
            </div>

            <div className="w-px self-stretch bg-white/10 shrink-0" />

            {/* Sell progress */}
            <div className="shrink-0 text-center">
              <p className="text-5xl font-black text-white tabular-nums">{sellPct}%</p>
              <p className="text-xs text-slate-400 mt-1">sold of assigned</p>
              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden mt-2 mx-auto">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${sellPct}%` }} />
              </div>
            </div>

            <div className="w-px self-stretch bg-white/10 shrink-0" />

            {/* Revenue + commission */}
            <div className="shrink-0 text-right space-y-1">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Revenue</p>
                <p className="text-2xl font-black text-white tabular-nums">₹{revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">My Commission</p>
                <p className="text-xl font-black tabular-nums" style={{ color: '#f59e0b' }}>₹{commission.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats strip — full width ── */}
        <div className="grid grid-cols-5 gap-3 w-full">
          {[
            { label: 'Assigned',   value: counts.all,           icon: Package,     color: 'text-slate-800' },
            { label: 'Available',  value: counts.available,     icon: Package,     color: 'text-blue-600' },
            { label: 'Sold',       value: counts.sold,          icon: ShoppingBag, color: 'text-emerald-600' },
            { label: 'Revenue',    value: `₹${revenue.toLocaleString()}`,    icon: Wallet,      color: 'text-purple-600', str: true },
            { label: 'Commission', value: `₹${commission.toLocaleString()}`, icon: BadgePercent, color: 'text-amber-600', str: true },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3.5 flex items-center gap-3" style={CARD}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
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

        {/* ── Main grid: sidebar + sheet list ── */}
        <div className="grid grid-cols-4 gap-4 w-full items-start">

          {/* ── LEFT sidebar ── */}
          <div className="space-y-4">

            {/* Per-game breakdown */}
            {gameBreakdown.length > 0 && (
              <div className="rounded-2xl p-5" style={CARD}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Games</p>
                </div>
                <div className="space-y-3">
                  {gameBreakdown.map(g => {
                    const pct = g.total > 0 ? Math.round((g.sold / g.total) * 100) : 0;
                    return (
                      <div key={g.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[130px]" title={g.name}>{g.name}</p>
                          <span className="text-xs text-gray-400 tabular-nums shrink-0">{g.sold}/{g.total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#0ea5e9' }} />
                        </div>
                        <p className="text-[11px] text-gray-400">{pct}% sold · {g.available} left</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent sales */}
            <div className="rounded-2xl p-5" style={CARD}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Recent Sales</p>
              </div>
              {recentSales.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingBag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No sales yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSales.map(player => {
                    const sheet = mySheets.find(s => player.ticketIds.some(tid => tid.startsWith(s.id + '-')));
                    return (
                      <div key={player.id} className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{player.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{sheet?.id ?? '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-emerald-600 tabular-nums">₹{sheet?.price ?? tambola.sheetPrice}</p>
                          <p className="text-[11px] text-slate-400">{timeAgo(player.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Sheet list (3 cols wide) ── */}
          <div className="col-span-3 rounded-2xl overflow-hidden" style={CARD}>
            {/* Tabs */}
            <div className="flex items-center border-b border-slate-100 px-5 pt-1">
              {(['all', 'available', 'sold'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                    tab === f ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {f}
                  <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">{counts[f]}</span>
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text" inputMode="numeric"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search sheet number…"
                  className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {search && (
                  <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-14">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">
                    {search ? `No sheets matching "${search}"` : `No ${tab === 'all' ? '' : tab + ' '}sheets`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Column header */}
                  <div className="flex items-center gap-3 px-1 pb-2 text-xs text-slate-400 font-medium border-b border-slate-100">
                    <span className="w-24 shrink-0">Sheet ID</span>
                    <span className="w-20 shrink-0">Status</span>
                    <span className="flex-1">Buyer</span>
                    <span className="w-36 text-right shrink-0">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {pageItems.map(sheet => {
                      const buyer  = tambola.players.find(p => p.ticketIds.some(tid => tid.startsWith(sheet.id + '-')));
                      const isSold = sheet.status === 'sold';
                      return (
                        <div key={sheet.id} className="flex items-center gap-3 py-2 px-1 rounded hover:bg-slate-50 transition-colors">
                          <span className="font-mono text-sm text-slate-700 w-24 shrink-0">{sheet.id}</span>
                          <span className={`w-20 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full text-center ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isSold ? 'Sold' : 'Available'}
                          </span>
                          <span className="flex-1 text-sm text-slate-500 truncate">
                            {buyer ? <span className="flex items-center gap-1"><User className="w-3 h-3 shrink-0" />{buyer.name}</span> : '—'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => openPreview(sheet)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => downloadSheet(sheet)} className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-slate-700">
                              <Download className="w-3 h-3" /> PDF
                            </Button>
                            {!isSold && (
                              <MarkSoldDialog sheet={sheet} price={sheet.price ?? tambola.sheetPrice} onConfirm={tambola.markSheetSoldByAgent} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-xs text-slate-500 px-1">{safePage} / {totalPages}</span>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useTambola } from '@/hooks/useTambola';
import type { Agent, Sheet } from '@/types';
import {
  Download, Package, ShoppingBag, Dice5, Eye, EyeOff,
  Search, X, Phone, Wallet, ChevronLeft, ChevronRight,
  User, LogOut, ChevronDown, ChevronUp, Printer, CheckSquare, Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { buildSheetPDF, buildMultiUpPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';

const PAGE_SIZE = 100;

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

// Layouts matching Ticket Printer options
const PRINT_LAYOUTS: { label: string; sheetsPerPage: number }[] = [
  { label: '1 per page',  sheetsPerPage: 1 },
  { label: '2 per page',  sheetsPerPage: 2 },
  { label: '3 per page',  sheetsPerPage: 3 },
  { label: '4 per page',  sheetsPerPage: 4 },
  { label: '6 per page',  sheetsPerPage: 6 },
  { label: '12 per page', sheetsPerPage: 12 },
];


// ─── Mark Sold Dialog ─────────────────────────────────────────────────────────

function MarkSoldDialog({ sheet, price, onConfirm }: {
  sheet: Sheet;
  price: number;
  onConfirm: (sheetId: string, name: string, phone: string) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [name,  setName]  = useState('');
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
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-emerald-600">₹{price}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600">Buyer Name *</Label>
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

// ─── Game Group Card ──────────────────────────────────────────────────────────

function GameGroupCard({
  gameName, sheets, sheetPrice, onSell, onPreview,
}: {
  gameName: string;
  sheets: Sheet[];
  sheetPrice: number;
  onSell: (sheetId: string, name: string, phone: string) => void;
  onPreview: (sheet: Sheet) => void;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [layout,      setLayout]      = useState(2);
  const [template,    setTemplate]    = useState<'compact' | 'classic'>('compact');
  const [downloading, setDownloading] = useState(false);
  const [buyerOpen,   setBuyerOpen]   = useState(false);
  const [buyerName,   setBuyerName]   = useState('');
  const [buyerPhone,  setBuyerPhone]  = useState('');

  const sold      = sheets.filter(s => s.status === 'sold').length;
  const available = sheets.filter(s => s.status !== 'sold').length;
  const revenue   = sheets.filter(s => s.status === 'sold').reduce((sum, s) => sum + (s.price ?? sheetPrice), 0);

  const filtered = useMemo(() => {
    const q = search.trim().replace(/^0+/, '');
    return sheets
      .filter(s => {
        if (!q) return true;
        const num = s.id.replace('SHEET-', '').replace(/^0+/, '');
        return num.includes(q) || s.id.toLowerCase().includes(q.toLowerCase());
      })
      .slice()
      .reverse();
  }, [sheets, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const availablePageItems = pageItems.filter(s => s.status !== 'sold');
  const allPageSelected    = availablePageItems.length > 0 && availablePageItems.every(s => selected.has(s.id));

  const toggleSheet = (id: string, isSold: boolean) => {
    if (isSold) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) availablePageItems.forEach(s => next.delete(s.id));
      else availablePageItems.forEach(s => next.add(s.id));
      return next;
    });
  };

  // Only unsold sheets can be selected; filter defensively on download too
  const selectedSheets = sheets.filter(s => selected.has(s.id) && s.status !== 'sold');

  const openBuyerDialog = () => {
    if (selectedSheets.length === 0 || downloading) return;
    setBuyerName(''); setBuyerPhone('');
    setBuyerOpen(true);
  };

  const handleConfirmSale = () => {
    if (!buyerName.trim()) return;
    setBuyerOpen(false);
    setDownloading(true);
    try {
      const config = { ...DEFAULT_LAYOUT, template };
      buildMultiUpPDF(selectedSheets, layout, config)
        .save(`${gameName.replace(/\s+/g, '-')}-${layout}pp.pdf`);
      selectedSheets.forEach(s => onSell(s.id, buyerName.trim(), buyerPhone.trim()));
      setSelected(new Set());
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
    {/* Buyer info dialog — shown before PDF download */}
    <Dialog open={buyerOpen} onOpenChange={v => { if (!v) setBuyerOpen(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Buyer Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-1 text-sm">
          <div className="bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
            <span className="text-slate-500">Sheets</span>
            <span className="font-semibold text-slate-700">{selectedSheets.length} selected</span>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
            <span className="text-slate-500">Layout</span>
            <span className="font-semibold text-slate-700">{layout} per page</span>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-semibold text-emerald-600">₹{(selectedSheets.length * sheetPrice).toLocaleString()}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-600">Buyer Name *</Label>
            <Input
              value={buyerName}
              onChange={e => setBuyerName(e.target.value)}
              placeholder="Customer full name"
              className="mt-1"
              onKeyDown={e => e.key === 'Enter' && handleConfirmSale()}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Phone (optional)</Label>
            <Input
              value={buyerPhone}
              onChange={e => setBuyerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            onClick={handleConfirmSale}
            disabled={!buyerName.trim()}
            className="gap-2 text-white"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            <Download className="w-3.5 h-3.5" /> Download & Mark Sold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="rounded-2xl overflow-hidden" style={CARD}>
      {/* Game header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 truncate">{gameName}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{sheets.length} sheets</span>
            <span className="text-emerald-600 font-semibold">{sold} sold</span>
            <span className="text-blue-600">{available} left</span>
            <span className="text-amber-600 font-semibold">₹{revenue.toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide' : 'Sheets'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: sheets.length > 0 ? `${Math.round((sold / sheets.length) * 100)}%` : '0%' }} />
      </div>

      {/* Expanded sheet list */}
      {expanded && (
        <div className="p-4 space-y-3 border-t border-slate-100">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search sheet number…"
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Print toolbar — appears when sheets are selected */}
          {selectedSheets.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-wrap">
              <span className="text-sm font-semibold text-blue-800 flex items-center gap-1.5 shrink-0">
                <Printer className="w-4 h-4" />
                {selectedSheets.length} sheet{selectedSheets.length > 1 ? 's' : ''}
              </span>

              {/* Template toggle */}
              <div className="flex items-center gap-1 border border-blue-200 rounded-lg overflow-hidden shrink-0">
                {(['compact', 'classic'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={`text-xs px-2.5 py-1 font-medium capitalize transition-colors ${
                      template === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-blue-600 shrink-0">per page:</span>
                {PRINT_LAYOUTS.map(l => (
                  <button
                    key={l.sheetsPerPage}
                    onClick={() => setLayout(l.sheetsPerPage)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      layout === l.sheetsPerPage
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-blue-200 text-blue-700 hover:border-blue-400'
                    }`}
                  >
                    {l.sheetsPerPage}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  Clear
                </button>
                <Button
                  size="sm"
                  onClick={openBuyerDialog}
                  disabled={downloading}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs h-8"
                >
                  <Download className="w-3 h-3" />
                  {downloading ? 'Downloading…' : `Download ${selectedSheets.length} sheet${selectedSheets.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No sheets found</div>
          ) : (
            <>
              {/* Column header */}
              <div className="flex items-center gap-3 px-1 pb-1 text-xs text-slate-400 font-medium border-b border-slate-100">
                <button onClick={togglePageAll} className="w-5 shrink-0 flex items-center">
                  {allPageSelected
                    ? <CheckSquare className="w-4 h-4 text-blue-600" />
                    : <Square className="w-4 h-4 text-slate-300" />}
                </button>
                <span className="w-24 shrink-0">Sheet ID</span>
                <span className="w-20 shrink-0">Status</span>
                <span className="flex-1">Buyer</span>
                <span className="w-28 text-right shrink-0">Actions</span>
              </div>

              <div className="divide-y divide-slate-50">
                {pageItems.map(sheet => {
                  const isSold    = sheet.status === 'sold';
                  const isChecked = selected.has(sheet.id) && !isSold;
                  return (
                    <div
                      key={sheet.id}
                      className={`flex items-center gap-3 py-2 px-1 rounded transition-colors cursor-default ${isChecked ? 'bg-blue-50' : isSold ? 'opacity-60' : 'hover:bg-slate-50'}`}
                    >
                      <button
                        onClick={() => toggleSheet(sheet.id, isSold)}
                        disabled={isSold}
                        className="w-5 shrink-0 flex items-center disabled:cursor-not-allowed"
                      >
                        {isChecked
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className={`w-4 h-4 ${isSold ? 'text-slate-200' : 'text-slate-300 hover:text-slate-400'}`} />}
                      </button>
                      <span className="font-mono text-xs text-slate-700 w-24 shrink-0">{sheet.id}</span>
                      <span className={`w-20 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full text-center ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isSold ? 'Sold' : 'Available'}
                      </span>
                      <span className="flex-1 text-xs text-slate-500 truncate">
                        {isSold ? <span className="flex items-center gap-1"><User className="w-3 h-3 shrink-0" />Sold</span> : '—'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => onPreview(sheet)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => buildSheetPDF(sheet, { ...DEFAULT_LAYOUT, template }).save(`${sheet.id}.pdf`)} className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-slate-700">
                          <Download className="w-3 h-3" />
                        </Button>
                        {!isSold && (
                          <MarkSoldDialog sheet={sheet} price={sheet.price ?? sheetPrice} onConfirm={onSell} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-slate-500">{safePage}/{totalPages}</span>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function AgentLogin({ onLogin }: { onLogin: (agent: Agent) => void }) {
  const tambola  = useTambola();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = () => {
    setError('');
    setLoading(true);
    const agent = tambola.agents.find(
      a => a.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') && a.password === password,
    );
    setTimeout(() => {
      setLoading(false);
      if (agent) onLogin(agent);
      else setError('Invalid phone number or password.');
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0ea5e9' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-white/20">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Agent Portal</h1>
          <p className="text-white/70 text-sm">Sign in to access your dashboard</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-2xl space-y-4">
          <div>
            <Label className="text-slate-600">Phone Number</Label>
            <Input className="mt-1" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <Label className="text-slate-600">Password</Label>
            <div className="relative mt-1">
              <Input type={showPwd ? 'text' : 'password'} placeholder="Your portal password" value={password} className="pr-9" onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full font-bold text-white" style={{ backgroundColor: '#0ea5e9' }} disabled={!phone.trim() || !password.trim() || loading} onClick={handleLogin}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AgentDashboard({ agent, onLogout }: { agent: Agent; onLogout: () => void }) {
  const tambola = useTambola();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewId,  setPreviewId]  = useState('');

  // All sheets assigned to this agent, excluding ones from completed games
  const completedGameIds = new Set(tambola.gameHistory.map(g => g.id));
  const endedScheduledIds = new Set(
    tambola.scheduledGames.filter(g => g.sessionId && completedGameIds.has(g.sessionId)).map(g => g.id),
  );

  const mySheets = useMemo(
    () => tambola.sheets.filter(s =>
      s.assignedTo === agent.id &&
      !(s.scheduledGameId && endedScheduledIds.has(s.scheduledGameId)),
    ),
    [tambola.sheets, agent.id, endedScheduledIds],
  );

  // Group by scheduledGameId; skip sheets not linked to any scheduled game
  const gameGroups = useMemo(() => {
    const groups: Record<string, { id: string; name: string; sheets: Sheet[] }> = {};
    mySheets.forEach(s => {
      if (!s.scheduledGameId) return;
      const gid = s.scheduledGameId;
      if (!groups[gid]) {
        const game = tambola.scheduledGames.find(g => g.id === gid);
        if (!game) return;
        groups[gid] = { id: gid, name: game.name, sheets: [] };
      }
      groups[gid].sheets.push(s);
    });
    return Object.values(groups).sort((a, b) => {
      const ga = tambola.scheduledGames.find(g => g.id === a.id);
      const gb = tambola.scheduledGames.find(g => g.id === b.id);
      return new Date(ga?.scheduledAt ?? 0).getTime() - new Date(gb?.scheduledAt ?? 0).getTime();
    });
  }, [mySheets, tambola.scheduledGames]);

  const totalSold    = mySheets.filter(s => s.status === 'sold').length;
  const totalRevenue = mySheets.filter(s => s.status === 'sold').reduce((sum, s) => sum + (s.price ?? tambola.sheetPrice), 0);

  const openPreview = (sheet: Sheet) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(buildSheetPDF(sheet, DEFAULT_LAYOUT).output('bloburl') as unknown as string);
    setPreviewId(sheet.id);
  };
  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewId('');
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#0ea5e9' }}>

      {/* PDF preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={v => !v && closePreview()}>
        <DialogContent className="max-w-3xl w-[90vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="font-mono text-sm">{previewId}</DialogTitle>
          </DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="flex-1 w-full border-0 rounded-b-lg" />}
        </DialogContent>
      </Dialog>

      {/* Header */}
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
            </div>
            <Button onClick={onLogout} size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5">
              <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full px-6 py-5 space-y-5">

        {/* Hero summary */}
        <div className="relative w-full overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' }}>
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-8 px-7 py-6">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-xl font-black text-slate-900 shrink-0">
                {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{agent.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{agent.phone}</span>
                </div>
              </div>
            </div>
            <div className="w-px self-stretch bg-white/10 shrink-0" />
            <div className="shrink-0 text-center">
              <p className="text-4xl font-black text-white tabular-nums">{mySheets.length}</p>
              <p className="text-xs text-slate-400 mt-1">total sheets</p>
            </div>
            <div className="w-px self-stretch bg-white/10 shrink-0" />
            <div className="shrink-0 text-right space-y-1">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Sold</p>
                <p className="text-2xl font-black text-emerald-400 tabular-nums">{totalSold}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Revenue</p>
                <p className="text-xl font-black text-amber-400 tabular-nums">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { label: 'Total Sheets',    value: mySheets.length,                                           icon: Package, color: 'text-slate-800' },
            { label: 'Sold',            value: totalSold,                                                 icon: ShoppingBag, color: 'text-emerald-600' },
            { label: 'Total Revenue',   value: `₹${totalRevenue.toLocaleString()}`,                       icon: Wallet, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3.5 flex items-center gap-3" style={CARD}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(14,165,233,0.1)' }}>
                <s.icon className="w-4 h-4" style={{ color: '#0ea5e9' }} />
              </div>
              <div>
                <p className={`text-xl font-black tabular-nums leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Per-game groups */}
        {mySheets.length === 0 ? (
          <div className="rounded-2xl p-14 text-center" style={CARD}>
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500">No active sheets assigned to you.</p>
            <p className="text-slate-400 text-sm mt-1">Sheets for completed games are automatically cleared.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gameGroups.map(group => (
              <GameGroupCard
                key={group.id}
                gameName={group.name}
                sheets={group.sheets}
                sheetPrice={tambola.sheetPrice}
                onSell={tambola.markSheetSoldByAgent}
                onPreview={openPreview}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AgentPortal() {
  const [agent, setAgent] = useState<Agent | null>(null);
  return agent
    ? <AgentDashboard agent={agent} onLogout={() => setAgent(null)} />
    : <AgentLogin onLogin={setAgent} />;
}

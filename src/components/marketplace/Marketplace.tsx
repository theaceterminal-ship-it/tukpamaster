import { useState, useEffect, useMemo } from 'react';
import { useTambola } from '@/hooks/useTambola';
import type { Order, ScheduledGame } from '@/types';
import QRCode from 'qrcode';
import {
  Search, X, ChevronRight, Dice5, CheckCircle2, QrCode, Copy,
  Ticket, AlertCircle, Calendar, Clock, Star, ShoppingCart,
  ArrowLeft, Trophy, Zap, Radio, Sparkles, Download, Phone,
  ClipboardList, Loader2, XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildBulkPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';
import type { Sheet } from '@/types';

type Step = 'home' | 'picker' | 'details' | 'pay' | 'submitted' | 'orders';

const PICKER_PAGE = 60;

const TICKET_COLORS = [
  '#f97316', '#0ea5e9', '#a855f7',
  '#22c55e', '#ec4899', '#eab308',
  '#14b8a6', '#ef4444',
];

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

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Starting now';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h away`;
  if (h > 0) return `${h}h ${m}m away`;
  return `${m}m away`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── UPI QR ──────────────────────────────────────────────────────────────────

function UpiQrBlock({ upiId, merchantName, amount, orderId }: {
  upiId: string; merchantName: string; amount: number; orderId: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=${orderId}&cu=INR`;

  useEffect(() => {
    if (!upiId) return;
    QRCode.toDataURL(upiUri, { width: 220, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [upiUri, upiId]);

  if (!upiId) return (
    <div className="text-center py-6 text-slate-500 text-sm">
      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
      UPI not configured. Contact the operator.
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {qrDataUrl
        ? <img src={qrDataUrl} alt="UPI QR" className="w-52 h-52 rounded-xl border border-slate-200 shadow" />
        : <div className="w-52 h-52 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center"><QrCode className="w-10 h-10 text-slate-300" /></div>
      }
      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 w-full max-w-xs">
        <span className="flex-1 text-sm font-mono text-slate-700 truncate">{upiId}</span>
        <button onClick={() => navigator.clipboard.writeText(upiId)} className="text-blue-500 hover:text-blue-700">
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <a href={upiUri} className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg text-center transition-colors">
        Open UPI App
      </a>
      <p className="text-xs text-slate-400 text-center">Scan with any UPI app or tap "Open UPI App"</p>
    </div>
  );
}

// ─── Ticket Card ─────────────────────────────────────────────────────────────

function TicketCard({ sheet, price, selected, onToggle }: {
  sheet: Sheet; price: number; selected: boolean; onToggle: () => void;
}) {
  const num    = parseInt(sheet.id.replace('SHEET-', ''), 10);
  const bgColor = TICKET_COLORS[num % TICKET_COLORS.length];
  const isDark  = ['#eab308'].includes(bgColor);

  const barcodeHeights = [5, 9, 4, 8, 6, 10, 3, 7, 5, 9, 4, 8, 6, 3, 9, 5];

  return (
    <button
      onClick={onToggle}
      className={`relative flex rounded-2xl overflow-hidden transition-all active:scale-[0.97] select-none w-full ${
        selected
          ? 'ring-4 ring-amber-400 shadow-xl shadow-amber-200 scale-[1.02]'
          : 'shadow-md hover:shadow-xl hover:scale-[1.01]'
      }`}
      style={{ height: 100 }}
    >
      {/* Left coloured section */}
      <div
        className="flex-[3] relative flex flex-col justify-between px-4 py-3"
        style={{ backgroundColor: bgColor }}
      >
        {selected && (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center z-10">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        )}
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-black/50' : 'text-white/60'}`}>
          TukpaMaster
        </p>
        <p className={`text-3xl font-black leading-none tabular-nums ${isDark ? 'text-black' : 'text-white'}`}
           style={{ textShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.25)' }}>
          {String(num).padStart(4, '0')}
        </p>
        <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-black/40' : 'text-white/50'}`}>
          Tambola Sheet
        </p>
      </div>

      {/* Perforated divider */}
      <div className="relative flex flex-col items-center justify-center" style={{ width: 18, backgroundColor: bgColor }}>
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white/40" />
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-100 z-10" />
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-100 z-10" />
      </div>

      {/* Right stub */}
      <div className="flex-[2] bg-white flex flex-col items-center justify-center gap-1.5 px-3 py-2">
        <div className="flex gap-[2px] items-end">
          {barcodeHeights.map((h, i) => (
            <div key={i} className="rounded-sm bg-slate-800" style={{ width: 2, height: h + 4 }} />
          ))}
        </div>
        <p className="text-slate-800 text-sm font-black">₹{price}</p>
        <p className="text-slate-400 text-[9px] uppercase tracking-widest">per sheet</p>
      </div>
    </button>
  );
}

// ─── Trade-Fair Hero ──────────────────────────────────────────────────────────

function TradeFairHero({ name, date, time, prizePool, availableCount, price, countdown, isLive, calledCount, prizes, hasJackpot, jackpotAmount, onCTA }: {
  name: string; date?: string; time?: string; prizePool: number;
  availableCount: number; price: number; countdown?: string;
  isLive?: boolean; calledCount?: number;
  prizes?: { label: string; amount: number; type: string }[];
  hasJackpot?: boolean; jackpotAmount?: number;
  onCTA: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl cursor-pointer group select-none"
      onClick={onCTA}
      style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 40%, #0284c7 100%)', minHeight: 380 }}
    >
      {/* Cloud blobs */}
      <div className="absolute top-0 inset-x-0 pointer-events-none">
        <div className="absolute top-3 left-8 w-28 h-14 bg-white/60 rounded-full blur-2xl" />
        <div className="absolute top-1 right-16 w-36 h-16 bg-white/50 rounded-full blur-2xl" />
        <div className="absolute top-6 left-1/3 w-24 h-10 bg-white/40 rounded-full blur-xl" />
      </div>

      {/* Jackpot badge */}
      {hasJackpot && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-yellow-400 rounded-full px-3 py-1 z-10 shadow-lg">
          <Star className="w-3.5 h-3.5 text-yellow-900 fill-yellow-900" />
          <span className="text-yellow-900 text-xs font-black uppercase tracking-wide">Jackpot ₹{jackpotAmount?.toLocaleString()}</span>
        </div>
      )}

      <div className="relative px-6 sm:px-10 pt-8 pb-8 flex flex-col gap-4">

        {/* Status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {isLive ? (
            <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-md shadow-md uppercase tracking-widest">
              <Radio className="w-3 h-3 animate-pulse" /> LIVE NOW
            </span>
          ) : countdown ? (
            <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur border border-white/40 text-white text-xs font-bold px-3 py-1.5 rounded-md">
              <Zap className="w-3 h-3 text-yellow-300" /> {countdown}
            </span>
          ) : null}
          {isLive && calledCount !== undefined && (
            <span className="text-sky-200 text-xs font-medium">{calledCount}/90 numbers called</span>
          )}
        </div>

        {/* Game name — huge */}
        <div>
          <p className="text-sky-200 text-xs font-bold uppercase tracking-[0.25em] mb-1">Tonight's Game</p>
          <h1 className="text-5xl sm:text-7xl font-black text-white leading-[0.9] uppercase"
              style={{ textShadow: '3px 4px 0 rgba(0,0,0,0.18), 0 0 40px rgba(0,0,0,0.1)' }}>
            {name}
          </h1>
        </div>

        {/* Prize pool banner */}
        <div className="flex items-stretch rounded-xl overflow-hidden shadow-xl w-fit">
          <div className="bg-red-600 px-4 py-3 flex items-center">
            <p className="text-white text-xs font-black uppercase tracking-widest rotate-0">Prize<br />Pool</p>
          </div>
          <div className="bg-orange-500 px-6 py-3 flex items-center">
            <p className="text-white text-4xl font-black tabular-nums" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              ₹{prizePool.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Prize chips */}
        {prizes && prizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prizes.slice(0, 5).map(p => (
              <span key={p.type} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
                {p.label} ₹{p.amount.toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {/* Info row */}
        <div className="flex flex-wrap gap-3">
          {date && (
            <div className="bg-black/20 backdrop-blur-sm border border-white/20 text-white rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Date</p>
                <p className="text-sm font-black">{date}</p>
              </div>
            </div>
          )}
          {time && (
            <div className="bg-black/20 backdrop-blur-sm border border-white/20 text-white rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Time</p>
                <p className="text-sm font-black">{time}</p>
              </div>
            </div>
          )}
          <div className="bg-black/20 backdrop-blur-sm border border-white/20 text-white rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <Ticket className="w-4 h-4 text-amber-300 shrink-0" />
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">Available</p>
              <p className="text-sm font-black">{availableCount} @ ₹{price}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div>
          <button className="flex items-center gap-2 bg-amber-400 group-hover:bg-amber-300 transition-colors text-slate-900 font-black px-8 py-3.5 rounded-2xl text-base shadow-xl shadow-amber-500/30 mt-1">
            Get Your Tickets <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Marketplace() {
  const tambola = useTambola();
  const [step, setStep]     = useState<Step>('home');
  const [cart, setCart]     = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(0);
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [utr, setUtr]       = useState('');
  const [order, setOrder]   = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { currentGame, scheduledGames, sheets, sheetPrice, upiSettings, gameHistory } = tambola;

  const [pickerGame, setPickerGame] = useState<ScheduledGame | null>(null);

  const availableSheets = useMemo(() => sheets.filter(s => s.status === 'available'), [sheets]);
  const todayStr = new Date().toDateString();

  const heroGame = (currentGame && (currentGame.status === 'active' || currentGame.status === 'setup'))
    ? currentGame : null;

  const todayScheduled = useMemo(() =>
    scheduledGames
      .filter(g => new Date(g.scheduledAt).toDateString() === todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [scheduledGames, todayStr]
  );

  const upcoming = useMemo(() =>
    scheduledGames
      .filter(g => new Date(g.scheduledAt) > new Date() && new Date(g.scheduledAt).toDateString() !== todayStr)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [scheduledGames, todayStr]
  );

  const totalPrizeEver = useMemo(() =>
    gameHistory.reduce((s, g) => s + g.totalPrizeDistributed, 0), [gameHistory]);

  const price = pickerGame?.ticketPrice ?? sheetPrice;
  const total = cart.size * price;

  const pickerAvailable = useMemo(() =>
    pickerGame
      ? availableSheets.filter(s => pickerGame.sheetIds.includes(s.id))
      : availableSheets,
    [pickerGame, availableSheets]
  );

  const searchNum = useMemo(() => {
    const s = search.trim().replace(/\D/g, '');
    return s ? parseInt(s, 10) : NaN;
  }, [search]);

  const searchSheet = useMemo(() => {
    if (isNaN(searchNum)) return null;
    const pool = pickerGame ? sheets.filter(s => pickerGame.sheetIds.includes(s.id)) : sheets;
    return pool.find(s => parseInt(s.id.replace('SHEET-', ''), 10) === searchNum) ?? null;
  }, [searchNum, sheets, pickerGame]);

  const pagedAvailable = useMemo(() =>
    pickerAvailable.slice(pickerPage * PICKER_PAGE, (pickerPage + 1) * PICKER_PAGE),
    [pickerAvailable, pickerPage]
  );
  const totalPickerPages = Math.ceil(pickerAvailable.length / PICKER_PAGE);

  const toggleCart = (id: string) => {
    setCart(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSubmitOrder = async () => {
    if (!name.trim() || cart.size === 0) return;
    const newOrder = await tambola.createOrder(name.trim(), phone.trim(), [...cart], utr || undefined, price);
    setOrder(newOrder);
    setStep('submitted');
  };

  const copyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPicker = (game?: ScheduledGame) => {
    setPickerGame(game ?? null);
    setCart(new Set());
    setSearch('');
    setPickerPage(0);
    setStep('picker');
  };

  const downloadOrderPDF = (o: Order) => {
    const orderSheets = tambola.sheets.filter(s => o.sheetIds.includes(s.id));
    if (orderSheets.length === 0) return;
    const doc = buildBulkPDF(orderSheets, { ...DEFAULT_LAYOUT, eventName: 'TukpaMaster' });
    doc.save(`tickets-${o.id}.pdf`);
  };

  const openOrders = (prefillPhone?: string) => {
    if (prefillPhone) setLookupPhone(prefillPhone);
    setHasSearched(false);
    setStep('orders');
  };

  const myOrders = useMemo(() =>
    hasSearched && lookupPhone.trim()
      ? tambola.orders.filter(o => o.phone.replace(/\D/g, '') === lookupPhone.trim().replace(/\D/g, ''))
      : [],
    [hasSearched, lookupPhone, tambola.orders]
  );

  // ─── Shared header ──────────────────────────────────────────────────────────
  const Header = ({ back, title }: { back?: () => void; title?: string }) => (
    <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-lg">
      <div className="w-full px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {back && (
            <button onClick={back} className="text-slate-400 hover:text-white mr-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <Dice5 className="w-5 h-5 text-slate-900" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-white tracking-tight">TukpaMaster</span>
              <span className="text-slate-400 text-xs hidden sm:inline">{title ?? 'Marketplace'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!back && cart.size === 0 && (
            <button
              onClick={() => openOrders()}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">My Orders</span>
            </button>
          )}
          {cart.size > 0 && (
            <button
              onClick={() => setStep('details')}
              className="flex items-center gap-2 bg-amber-500 text-slate-900 font-semibold px-3 py-1.5 rounded-lg text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{cart.size} sheets ·</span> ₹{total}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );

  // ─── HOME ────────────────────────────────────────────────────────────────────

  if (step === 'home') return (
    <div className="min-h-screen bg-slate-100">
      <Header />

      <div className="w-full px-4 sm:px-6 py-6 sm:py-8 space-y-10">

        {/* ── HERO ── */}
        {heroGame ? (
          <TradeFairHero
            name={heroGame.name}
            prizePool={heroGame.totalPrizePool}
            availableCount={availableSheets.length}
            price={price}
            isLive={heroGame.status === 'active'}
            calledCount={heroGame.calledNumbers.length}
            hasJackpot={heroGame.dividends.some(d => d.prize >= 5000)}
            jackpotAmount={heroGame.dividends.find(d => d.name === 'Jackpot')?.prize}
            prizes={heroGame.dividends.map(d => ({ label: d.name, amount: d.prize, type: d.type }))}
            onCTA={() => openPicker()}
          />

        ) : todayScheduled.length > 0 ? (
          <TradeFairHero
            name={todayScheduled[0].name}
            date={formatDate(todayScheduled[0].scheduledAt)}
            time={formatTime(todayScheduled[0].scheduledAt)}
            prizePool={todayScheduled[0].estimatedPrizePool}
            availableCount={availableSheets.filter(s => todayScheduled[0].sheetIds.includes(s.id)).length}
            price={todayScheduled[0].ticketPrice}
            countdown={formatCountdown(todayScheduled[0].scheduledAt)}
            hasJackpot={todayScheduled[0].hasJackpot}
            jackpotAmount={todayScheduled[0].jackpotAmount}
            prizes={todayScheduled[0].prizes.map(p => ({ label: p.label, amount: p.amount, type: p.type }))}
            onCTA={() => openPicker(todayScheduled[0])}
          />

        ) : (
          /* ── WELCOME STATE ── */
          <div className="space-y-6">
            <div
              className="relative overflow-hidden rounded-3xl min-h-[380px] flex items-center"
              style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 40%, #0284c7 100%)' }}
            >
              <div className="absolute top-3 left-8 w-28 h-14 bg-white/50 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-1 right-16 w-36 h-16 bg-white/40 rounded-full blur-2xl pointer-events-none" />

              <div className="relative w-full px-6 sm:px-12 py-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
                <div className="space-y-5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-2xl bg-amber-400/40 blur-xl animate-pulse" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl">
                      <Dice5 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sky-200 text-xs font-bold uppercase tracking-[0.25em]">Welcome to</p>
                    <h1 className="text-5xl sm:text-6xl font-black text-white leading-none uppercase mt-1"
                        style={{ textShadow: '3px 4px 0 rgba(0,0,0,0.15)' }}>
                      Tukpa<br />Master
                    </h1>
                    <p className="text-sky-100 text-base mt-3 max-w-sm leading-relaxed">
                      The most exciting way to play Tambola. Browse games, buy tickets, and win big prizes.
                    </p>
                  </div>
                  {upcoming.length > 0 && (
                    <button
                      onClick={() => openPicker(upcoming[0])}
                      className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-6 py-3 rounded-2xl shadow-xl transition-colors"
                    >
                      Next: {upcoming[0].name} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="hidden lg:grid grid-rows-3 gap-4 mt-6 lg:mt-0">
                  {[
                    { icon: Trophy,    label: 'Total Prize Distributed', value: `₹${totalPrizeEver.toLocaleString()}`, color: 'text-amber-400' },
                    { icon: Ticket,    label: 'Games Hosted',            value: String(gameHistory.length),            color: 'text-emerald-400' },
                    { icon: Sparkles, label: 'Available Sheets',         value: String(availableSheets.length),        color: 'text-purple-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* How it works */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" /> How It Works
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '01', icon: Ticket,  title: 'Pick Your Sheets', desc: 'Browse available sheet numbers and select the ones you like.', color: 'bg-amber-100 text-amber-600' },
                  { step: '02', icon: QrCode,  title: 'Pay via UPI',       desc: 'Scan the QR code or enter UPI ID and pay instantly.',         color: 'bg-blue-100 text-blue-600' },
                  { step: '03', icon: Trophy,  title: 'Win Big Prizes',    desc: 'Download your PDF tickets and join the live game to win.',    color: 'bg-emerald-100 text-emerald-600' },
                ].map(s => (
                  <div key={s.step} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className={`w-11 h-11 ${s.color} rounded-xl flex items-center justify-center`}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <span className="text-3xl font-black text-slate-100">{s.step}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.title}</p>
                      <p className="text-slate-500 text-sm mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UPCOMING GAMES ── */}
        {upcoming.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Upcoming Games</h2>
              <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">{upcoming.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(g => (
                <div
                  key={g.id}
                  onClick={() => openPicker(g)}
                  className="relative overflow-hidden rounded-2xl cursor-pointer group"
                  style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', minHeight: 160 }}
                >
                  <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl" />
                  <div className="relative p-5 flex flex-col justify-between h-full gap-3">
                    <div>
                      <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                        <Calendar className="w-3 h-3" /> {formatDate(g.scheduledAt)} · {formatTime(g.scheduledAt)}
                      </span>
                      <h3 className="text-xl font-black text-white uppercase mt-1">{g.name}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-xs">Prize Pool</p>
                        <p className="text-amber-300 font-black text-lg">₹{g.estimatedPrizePool.toLocaleString()}</p>
                      </div>
                      <span className="bg-amber-500 group-hover:bg-amber-400 transition-colors text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
                        Buy <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cart.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-2xl z-30">
          <div className="w-full flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">{cart.size} sheet{cart.size > 1 ? 's' : ''} selected</p>
              <p className="text-xl font-black text-slate-800">₹{total}</p>
            </div>
            <Button onClick={() => setStep('details')} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold gap-2 px-6 py-3 text-base">
              Checkout <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ── PICKER ───────────────────────────────────────────────────────────────────

  if (step === 'picker') return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header with search */}
      <div className="bg-slate-900 text-white sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setStep('home')} className="text-slate-400 hover:text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => { setSearch(e.target.value); setPickerPage(0); }}
              placeholder="Search sheet number (e.g. 42)"
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {cart.size > 0 && (
            <button
              onClick={() => setStep('details')}
              className="shrink-0 flex items-center gap-1.5 bg-amber-500 text-slate-900 font-bold px-3 py-1.5 rounded-lg text-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cart.size} sheets ·</span> ₹{total}
            </button>
          )}
        </div>
        <div className="w-full px-4 sm:px-6 pb-2.5 flex items-center gap-4 text-xs text-slate-400 flex-wrap">
          {pickerGame && (
            <span className="text-amber-300 font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {pickerGame.name} ·
            </span>
          )}
          <span className="text-emerald-400 font-semibold">{pickerAvailable.length} available</span>
          <span>·</span>
          <span>₹{price} per sheet</span>
          {cart.size > 0 && <span className="ml-auto text-amber-300 font-semibold">{cart.size} selected</span>}
        </div>
      </div>

      <div className="flex-1 w-full px-4 sm:px-6 py-5 lg:grid lg:grid-cols-4 lg:gap-8 lg:items-start">

        {/* Sidebar (desktop only) */}
        <div className="hidden lg:block space-y-4">
          {cart.size > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected Sheets</p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {[...cart].sort().map(id => {
                  const n = parseInt(id.replace('SHEET-', ''), 10);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleCart(id)}
                      className="bg-amber-100 text-amber-800 text-xs font-mono px-2 py-0.5 rounded-full hover:bg-red-100 hover:text-red-700 transition-colors"
                    >
                      {String(n).padStart(4, '0')} ×
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-semibold">{cart.size} × ₹{price}</span>
                <span className="text-base font-black text-slate-800">₹{total}</span>
              </div>
              <Button onClick={() => setStep('details')} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold gap-2">
                Checkout <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center space-y-2">
              <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-400 text-sm">No sheets selected yet</p>
              <p className="text-xs text-slate-400">Click any ticket to add it</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {pickerGame ? pickerGame.name : 'Availability'}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Available</span>
                <span className="font-bold text-emerald-600">{pickerAvailable.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total in Game</span>
                <span className="font-bold text-slate-400">{pickerGame ? pickerGame.sheetIds.length : sheets.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Price Each</span>
                <span className="font-bold text-slate-700">₹{price}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main ticket grid */}
        <div className="lg:col-span-3">
          {search.trim() ? (
            <div>
              {searchSheet ? (
                <div className="space-y-3 max-w-sm">
                  <p className="text-xs text-slate-400">Result for "{search.trim()}"</p>
                  {searchSheet.status === 'available' ? (
                    <TicketCard
                      sheet={searchSheet}
                      price={price}
                      selected={cart.has(searchSheet.id)}
                      onToggle={() => toggleCart(searchSheet.id)}
                    />
                  ) : (
                    <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 opacity-60 cursor-not-allowed text-center">
                      <p className="text-2xl font-black text-slate-400">{searchSheet.id.replace('SHEET-', '')}</p>
                      <p className="text-sm font-semibold text-red-500 mt-1">Sold Out</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 space-y-2">
                  <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-500 font-medium">Sheet #{search.replace(/\D/g, '')} not found</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {pickerAvailable.length === 0 ? (
                <div className="text-center py-20 space-y-2">
                  <Ticket className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No sheets available right now.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
                    {pagedAvailable.map(s => (
                      <TicketCard
                        key={s.id}
                        sheet={s}
                        price={price}
                        selected={cart.has(s.id)}
                        onToggle={() => toggleCart(s.id)}
                      />
                    ))}
                  </div>

                  {totalPickerPages > 1 && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <button
                        onClick={() => setPickerPage(p => Math.max(0, p - 1))}
                        disabled={pickerPage === 0}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-white"
                      >
                        ← Prev
                      </button>
                      <span className="text-sm text-slate-500 font-medium">
                        {pickerPage + 1} / {totalPickerPages}
                      </span>
                      <button
                        onClick={() => setPickerPage(p => Math.min(totalPickerPages - 1, p + 1))}
                        disabled={pickerPage >= totalPickerPages - 1}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-white"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile sticky checkout */}
      {cart.size > 0 && (
        <div className="lg:hidden sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">{cart.size} sheet{cart.size > 1 ? 's' : ''}</p>
              <p className="text-xl font-black text-slate-800">₹{total}</p>
            </div>
            <Button onClick={() => setStep('details')} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold gap-2 px-6">
              Checkout <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ── DETAILS ──────────────────────────────────────────────────────────────────

  if (step === 'details') return (
    <div className="min-h-screen bg-slate-50">
      <Header back={() => setStep(cart.size > 0 ? 'picker' : 'home')} title="Your Details" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Order Summary</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {[...cart].sort().map(id => (
                <span key={id} className="bg-amber-100 text-amber-800 text-xs font-mono px-2 py-0.5 rounded-full">
                  {id.replace('SHEET-', '')}
                </span>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-sm font-semibold">
              <span className="text-slate-600">{cart.size} sheets × ₹{price}</span>
              <span className="text-lg text-slate-800">₹{total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label htmlFor="buyer-name">Your Name <span className="text-red-500">*</span></Label>
              <Input id="buyer-name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="buyer-phone">WhatsApp / Phone</Label>
              <Input id="buyer-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
            </div>
          </CardContent>
        </Card>
        <Button
          onClick={() => setStep('pay')}
          disabled={!name.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 text-base"
        >
          Continue to Payment · ₹{total}
        </Button>
      </div>
    </div>
  );

  // ── PAY ───────────────────────────────────────────────────────────────────────

  if (step === 'pay') return (
    <div className="min-h-screen bg-slate-50">
      <Header back={() => setStep('details')} title={`Pay ₹${total}`} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-center font-semibold text-slate-700 mb-4">
              Scan & pay ₹{total} to complete your order
            </p>
            <UpiQrBlock
              upiId={upiSettings.upiId}
              merchantName={upiSettings.merchantName || 'TukpaMaster'}
              amount={total}
              orderId={`ORDER-${Date.now()}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">After payment, enter your Transaction ID</p>
            <div>
              <Label htmlFor="utr">UPI Transaction ID (UTR)</Label>
              <Input id="utr" value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 123456789012" className="mt-1 font-mono" />
              <p className="text-xs text-slate-400 mt-1">Find this in your UPI app under payment history.</p>
            </div>
            <Button
              onClick={handleSubmitOrder}
              disabled={!utr.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
            >
              Submit for Confirmation
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ── SUBMITTED ─────────────────────────────────────────────────────────────────

  if (step === 'submitted') {
    const liveOrder = tambola.orders.find(o => o.id === order?.id) ?? order;
    const isConfirmed = liveOrder?.status === 'confirmed';
    const isRejected  = liveOrder?.status === 'rejected';

    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Order Submitted" />
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-5">
          <div className="text-center space-y-3">
            {isConfirmed ? (
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            ) : isRejected ? (
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              </div>
            )}
            <h2 className="text-3xl font-black text-slate-800">
              {isConfirmed ? 'Payment Confirmed!' : isRejected ? 'Order Rejected' : 'Order Submitted!'}
            </h2>
            <p className="text-slate-500 leading-relaxed">
              {isConfirmed
                ? 'Your tickets are confirmed. Download your PDF below!'
                : isRejected
                ? 'Your order was rejected. Please contact the operator.'
                : 'Waiting for the operator to verify your payment. This page updates automatically.'}
            </p>
          </div>

          {isConfirmed && liveOrder && (
            <button
              onClick={() => downloadOrderPDF(liveOrder)}
              className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-lg transition-colors shadow-lg shadow-emerald-500/25"
            >
              <Download className="w-6 h-6" /> Download Ticket PDF
            </button>
          )}

          {liveOrder && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Order ID</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800">{liveOrder.id}</span>
                    <button onClick={copyOrderId} className="text-blue-500">
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-bold ${isConfirmed ? 'text-emerald-600' : isRejected ? 'text-red-500' : 'text-amber-600'}`}>
                    {isConfirmed ? '✓ Confirmed' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                  </span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Name</span><span className="font-medium">{liveOrder.playerName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Sheets</span><span className="font-medium">{liveOrder.sheetIds.length} sheets</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Amount</span><span className="font-bold text-slate-800 text-base">₹{liveOrder.amount}</span></div>
                {liveOrder.utr && <div className="flex justify-between text-sm"><span className="text-slate-500">UTR</span><span className="font-mono text-xs text-slate-600">{liveOrder.utr}</span></div>}
              </CardContent>
            </Card>
          )}

          {!isConfirmed && !isRejected && phone && (
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4 text-sm text-slate-600 flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-700">Need to close this page?</p>
                  <p className="mt-1">Come back and tap <strong>My Orders</strong> — enter <span className="font-mono font-semibold">{phone}</span> to find your order.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <button
            onClick={() => { setStep('home'); setCart(new Set()); setName(''); setPhone(''); setUtr(''); }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2 font-medium"
          >
            ← Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  // ── ORDERS LOOKUP ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <Header back={() => setStep('home')} title="My Orders" />
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Check My Orders</h2>
          <p className="text-slate-500 text-sm">Enter the phone number you used when ordering.</p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label htmlFor="lookup-phone" className="flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Number
              </Label>
              <div className="flex gap-2">
                <Input
                  id="lookup-phone"
                  value={lookupPhone}
                  onChange={e => { setLookupPhone(e.target.value); setHasSearched(false); }}
                  onKeyDown={e => e.key === 'Enter' && lookupPhone.trim() && setHasSearched(true)}
                  placeholder="+91 98765 43210"
                  className="flex-1"
                />
                <Button
                  onClick={() => setHasSearched(true)}
                  disabled={!lookupPhone.trim()}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5"
                >
                  Find
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasSearched && (
          myOrders.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-semibold">No orders found</p>
              <p className="text-sm text-slate-400">Check the number and try again.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{myOrders.length} order{myOrders.length > 1 ? 's' : ''} found</p>
              {[...myOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(o => {
                const confirmed = o.status === 'confirmed';
                const rejected  = o.status === 'rejected';
                return (
                  <Card key={o.id} className={confirmed ? 'border-emerald-200' : rejected ? 'border-red-200' : 'border-amber-200'}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-slate-400">{o.id}</p>
                          <p className="font-bold text-slate-800 mt-0.5">{o.sheetIds.length} sheet{o.sheetIds.length > 1 ? 's' : ''} · ₹{o.amount}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          confirmed ? 'bg-emerald-100 text-emerald-700' :
                          rejected  ? 'bg-red-100 text-red-600' :
                                      'bg-amber-100 text-amber-700'
                        }`}>
                          {confirmed ? '✓ Confirmed' : rejected ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {o.sheetIds.slice(0, 12).map(id => (
                          <span key={id} className="bg-slate-100 text-slate-600 text-xs font-mono px-2 py-0.5 rounded-full">
                            {id.replace('SHEET-', '')}
                          </span>
                        ))}
                        {o.sheetIds.length > 12 && (
                          <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">+{o.sheetIds.length - 12} more</span>
                        )}
                      </div>
                      {confirmed ? (
                        <button
                          onClick={() => downloadOrderPDF(o)}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download Ticket PDF
                        </button>
                      ) : rejected ? (
                        <p className="text-xs text-red-500 text-center">Order rejected — contact the operator.</p>
                      ) : (
                        <p className="text-xs text-amber-600 text-center">Waiting for operator confirmation…</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

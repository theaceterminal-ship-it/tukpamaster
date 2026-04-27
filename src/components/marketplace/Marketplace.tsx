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
import { GameCard } from '@/components/live-game/ScheduleGameDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildBulkPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';

type Step = 'home' | 'picker' | 'details' | 'pay' | 'submitted' | 'orders';

const PICKER_PAGE = 120;

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

const PRIZE_DOT: Record<string, string> = {
  'early-five':  'bg-sky-400',
  'top-line':    'bg-orange-400',
  'middle-line': 'bg-purple-400',
  'bottom-line': 'bg-pink-400',
  'corners':     'bg-teal-400',
  'full-house':  'bg-emerald-400',
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

  // Which scheduled game is the picker open for (null = heroGame / all available)
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

  // Effective price: scheduled game's ticketPrice or global sheetPrice
  const price = pickerGame?.ticketPrice ?? sheetPrice;
  const total = cart.size * price;

  // Sheets available for the current picker context
  const pickerAvailable = useMemo(() =>
    pickerGame
      ? availableSheets.filter(s => pickerGame.sheetIds.includes(s.id))
      : availableSheets,
    [pickerGame, availableSheets]
  );

  // Picker: exact numeric search within picker context
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

  const handleSubmitOrder = () => {
    if (!name.trim() || cart.size === 0) return;
    const newOrder = tambola.createOrder(name.trim(), phone.trim(), [...cart], utr || undefined, price);
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
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="w-full px-4 sm:px-6 py-6 sm:py-8 space-y-10">

        {/* ── HERO: ACTIVE / SETUP GAME ── */}
        {heroGame ? (
          <div
            onClick={() => openPicker()}
            className="relative overflow-hidden rounded-3xl cursor-pointer group select-none"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)' }}
          >
            {/* Blobs */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
            <div className="absolute bottom-10 left-1/3 w-48 h-48 rounded-full bg-orange-400/10 blur-2xl pointer-events-none" />

            {/* Jackpot badge */}
            {heroGame.dividends.some(d => d.prize >= 5000) && (
              <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-yellow-400/15 border border-yellow-400/40 backdrop-blur-sm rounded-full px-3 py-1 z-10">
                <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                <span className="text-yellow-200 text-xs font-bold tracking-wide uppercase">Jackpot</span>
              </div>
            )}

            {/* Two-column layout on desktop */}
            <div className="relative lg:grid lg:grid-cols-5">
              {/* Left: main content */}
              <div className="lg:col-span-3 px-6 sm:px-8 py-8 sm:py-10 space-y-5">
                {/* Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  {heroGame.status === 'active' ? (
                    <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/40 text-red-300 text-xs font-bold px-3 py-1 rounded-full">
                      <Radio className="w-3 h-3 animate-pulse" /> LIVE NOW
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                      <Zap className="w-3 h-3" /> STARTING SOON
                    </span>
                  )}
                  <span className="text-slate-500 text-xs">{heroGame.calledNumbers.length}/90 called</span>
                </div>

                {/* Game name */}
                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-none tracking-tight uppercase">
                    {heroGame.name}
                  </h1>
                  <p className="text-slate-400 text-sm mt-2">
                    {availableSheets.length} tickets available · ₹{price} each
                  </p>
                </div>

                {/* Prize chips (mobile: visible; desktop: hidden since breakdown is in right panel) */}
                <div className="flex flex-wrap gap-2 lg:hidden">
                  {heroGame.dividends.slice(0, 4).map(d => (
                    <span key={d.id} className={`text-xs font-semibold px-3 py-1 rounded-full ${CHIP_COLORS[d.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
                      {d.name} <span className="opacity-80">₹{d.prize.toLocaleString()}</span>
                    </span>
                  ))}
                </div>

                {/* Prize pool + CTA */}
                <div className="flex items-end justify-between pt-2 flex-wrap gap-4">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Prize Pool</p>
                    <p className="text-5xl sm:text-6xl font-black text-white leading-none">
                      ₹{heroGame.totalPrizePool.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-amber-500 group-hover:bg-amber-400 transition-colors text-slate-900 font-black px-6 py-3 rounded-2xl text-base flex items-center gap-2 shadow-lg shadow-amber-500/25">
                    Browse Tickets
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Right: prize breakdown — desktop only */}
              <div className="hidden lg:flex lg:col-span-2 border-l border-white/10 px-7 py-10 flex-col justify-center space-y-1">
                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4">Prize Breakdown</p>
                {heroGame.dividends.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${PRIZE_DOT[d.type] ?? 'bg-white'}`} />
                      <span className="text-slate-300 text-sm">{d.name}</span>
                      {d.claimed && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Claimed</span>}
                    </div>
                    <span className={`font-bold text-sm ${d.claimed ? 'text-slate-500 line-through' : 'text-amber-300'}`}>
                      ₹{d.prize.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-slate-400 text-xs uppercase tracking-widest">Total</span>
                  <span className="text-white font-black text-lg">₹{heroGame.totalPrizePool.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

        ) : todayScheduled.length > 0 ? (
          /* Today scheduled — use GameCard as full-width hero */
          <div className="relative">
            <div className="overflow-hidden rounded-3xl">
              {/* Stretch GameCard to full-width hero proportions */}
              <div
                className="relative overflow-hidden"
                style={todayScheduled[0].backgroundImage
                  ? { backgroundImage: `url(${todayScheduled[0].backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 340 }
                  : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)', minHeight: 340 }
                }
              >
                {!todayScheduled[0].backgroundImage && (
                  <>
                    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
                  </>
                )}
                {todayScheduled[0].backgroundImage && (
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/60 to-slate-900/25 pointer-events-none" />
                )}

                {/* Jackpot badge */}
                {todayScheduled[0].hasJackpot && (
                  <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/50 backdrop-blur-sm rounded-full px-3 py-1 z-10">
                    <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-yellow-200 text-xs font-black uppercase tracking-wide">Jackpot</span>
                  </div>
                )}

                <div className="relative lg:grid lg:grid-cols-5 min-h-[340px]">
                  <div className="lg:col-span-3 px-6 sm:px-10 py-10 flex flex-col justify-end gap-4">
                    <span className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full w-fit">
                      <Calendar className="w-3 h-3" /> TODAY · {formatTime(todayScheduled[0].scheduledAt)}
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none">
                      {todayScheduled[0].name}
                    </h1>
                    {/* Prize chips */}
                    <div className="flex flex-wrap gap-2">
                      {todayScheduled[0].prizes.map(p => (
                        <span key={p.type} className={`text-xs font-semibold px-3 py-1 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
                          {p.label} <span className="opacity-80">₹{p.amount.toLocaleString()}</span>
                        </span>
                      ))}
                      {todayScheduled[0].hasJackpot && (
                        <span className="text-xs font-black px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-200 border border-yellow-400/40">
                          ⭐ Jackpot ₹{todayScheduled[0].jackpotAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Total Prize Pool</p>
                        <p className="text-5xl font-black text-white">₹{todayScheduled[0].estimatedPrizePool.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-xs">{todayScheduled[0].sheetIds.length.toLocaleString()} sheets</p>
                        <p className="text-amber-400 font-bold">₹{todayScheduled[0].ticketPrice}/sheet</p>
                        <p className="text-amber-400 text-sm font-semibold mt-0.5">{formatCountdown(todayScheduled[0].scheduledAt)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openPicker(todayScheduled[0])}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-black px-6 py-3 rounded-2xl text-sm flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/25"
                    >
                      Browse Tickets <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Countdown visual on desktop */}
                  <div className="hidden lg:flex lg:col-span-2 items-center justify-center p-10">
                    <div className="text-center space-y-3">
                      <div className="w-32 h-32 rounded-full border-4 border-amber-500/30 flex items-center justify-center mx-auto relative">
                        <div className="absolute inset-2 rounded-full border-2 border-dashed border-amber-500/20 animate-spin-slow" />
                        <Calendar className="w-12 h-12 text-amber-400" />
                      </div>
                      <p className="text-white font-bold text-lg">{formatCountdown(todayScheduled[0].scheduledAt)}</p>
                      <p className="text-slate-500 text-sm">until game starts</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        ) : (
          /* ── EMPTY STATE: WELCOME ART ── */
          <div className="space-y-6">
            {/* Welcome banner */}
            <div
              className="relative overflow-hidden rounded-3xl min-h-[420px] sm:min-h-[480px] flex items-center"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
            >
              {/* Blobs */}
              <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
              <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl" />

              {/* Floating decorative tickets */}
              <div className="absolute top-8 right-12 w-16 h-24 rounded-lg border-2 border-white/10 bg-white/5 rotate-12 animate-float-delay hidden sm:block" />
              <div className="absolute bottom-16 right-1/3 w-12 h-18 rounded-lg border border-amber-400/20 bg-amber-500/5 -rotate-6 animate-float hidden md:block" />
              <div className="absolute top-16 left-1/4 w-10 h-16 rounded-lg border border-purple-400/20 bg-purple-500/5 rotate-3 animate-float-slow hidden lg:block" />
              {/* Dice pips decoration */}
              <div className="absolute top-6 left-6 opacity-10">
                <div className="grid grid-cols-3 gap-1.5 w-16">
                  {[1,0,1,0,1,0,1,0,1].map((v,i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${v ? 'bg-amber-400' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="absolute bottom-8 right-8 opacity-10">
                <div className="grid grid-cols-2 gap-2 w-10">
                  {[1,1,1,1].map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-full bg-purple-400" />
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="relative w-full px-6 sm:px-12 py-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
                <div className="space-y-6">
                  {/* Animated dice icon */}
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-2xl bg-amber-500/30 blur-xl animate-pulse" />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl animate-float">
                      <Dice5 className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  <div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                      Welcome to<br />
                      <span className="text-amber-400">TukpaMaster</span>
                    </h1>
                    <p className="text-slate-400 text-lg mt-3 max-w-md leading-relaxed">
                      The most exciting way to play Tambola. Browse games, buy tickets, and win big prizes — all online.
                    </p>
                  </div>

                  {upcoming.length > 0 && (
                    <div className="max-w-sm">
                      <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Next Game
                      </p>
                      <GameCard
                        name={upcoming[0].name}
                        scheduledAt={upcoming[0].scheduledAt}
                        backgroundImage={upcoming[0].backgroundImage}
                        prizes={upcoming[0].prizes}
                        hasJackpot={upcoming[0].hasJackpot}
                        jackpotAmount={upcoming[0].jackpotAmount}
                        totalPrize={upcoming[0].estimatedPrizePool}
                        sheetCount={upcoming[0].sheetIds.length}
                        ticketPrice={upcoming[0].ticketPrice}
                      />
                    </div>
                  )}
                </div>

                {/* Right side: stats + steps on desktop */}
                <div className="hidden lg:grid grid-rows-3 gap-4 mt-6 lg:mt-0">
                  {[
                    { icon: Trophy, label: 'Total Prize Distributed', value: `₹${totalPrizeEver.toLocaleString()}`, color: 'text-amber-400' },
                    { icon: Ticket, label: 'Games Hosted', value: String(gameHistory.length), color: 'text-emerald-400' },
                    { icon: Sparkles, label: 'Available Sheets Right Now', value: String(availableSheets.length), color: 'text-purple-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/6 backdrop-blur border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile stats row */}
            <div className="grid grid-cols-3 gap-3 lg:hidden">
              {[
                { icon: Trophy, label: 'Prize Distributed', value: `₹${totalPrizeEver > 0 ? (totalPrizeEver / 1000).toFixed(0) + 'K' : '0'}`, color: 'text-amber-600', bg: 'bg-amber-50' },
                { icon: Ticket, label: 'Games Hosted', value: String(gameHistory.length), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { icon: Sparkles, label: 'Available Now', value: String(availableSheets.length), color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                  <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" /> How It Works
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '01', icon: Ticket, title: 'Pick Your Sheets', desc: 'Browse available sheet numbers and select the ones you like.', color: 'bg-amber-100 text-amber-600' },
                  { step: '02', icon: QrCode, title: 'Pay via UPI', desc: 'Scan the QR code or enter UPI ID and pay instantly.', color: 'bg-blue-100 text-blue-600' },
                  { step: '03', icon: Trophy, title: 'Win Big Prizes', desc: 'Download your PDF tickets and join the live game to win.', color: 'bg-emerald-100 text-emerald-600' },
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
            {/* Desktop grid */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {upcoming.map(g => (
                <GameCard
                  key={g.id}
                  name={g.name}
                  scheduledAt={g.scheduledAt}
                  backgroundImage={g.backgroundImage}
                  prizes={g.prizes}
                  hasJackpot={g.hasJackpot}
                  jackpotAmount={g.jackpotAmount}
                  totalPrize={g.estimatedPrizePool}
                  sheetCount={g.sheetIds.length}
                  ticketPrice={g.ticketPrice}
                  onClick={() => openPicker(g)}
                />
              ))}
            </div>
            {/* Mobile horizontal scroll */}
            <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {upcoming.map(g => (
                <div key={g.id} className="shrink-0 w-72">
                  <GameCard
                    name={g.name}
                    scheduledAt={g.scheduledAt}
                    backgroundImage={g.backgroundImage}
                    prizes={g.prizes}
                    hasJackpot={g.hasJackpot}
                    jackpotAmount={g.jackpotAmount}
                    totalPrize={g.estimatedPrizePool}
                    sheetCount={g.sheetIds.length}
                    ticketPrice={g.ticketPrice}
                    onClick={() => openPicker(g)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── QUICK SHEET GRID (when game exists) ── */}
        {heroGame && availableSheets.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Quick Pick</h2>
              <button onClick={() => openPicker()} className="text-amber-600 text-sm font-semibold hover:text-amber-700 flex items-center gap-1">
                View all {availableSheets.length} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-15 gap-2">
              {availableSheets.slice(0, 30).map(s => {
                const num = parseInt(s.id.replace('SHEET-', ''), 10);
                const sel = cart.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleCart(s.id)}
                    className={`rounded-xl py-2.5 text-center text-xs font-bold border-2 transition-all active:scale-95 ${
                      sel
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md scale-105'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    {String(num).padStart(4, '0')}
                  </button>
                );
              })}
              {availableSheets.length > 30 && (
                <button
                  onClick={() => openPicker()}
                  className="rounded-xl py-2.5 text-center text-xs font-bold border-2 border-dashed border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 col-span-2"
                >
                  +{availableSheets.length - 30}
                </button>
              )}
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
              <Calendar className="w-3 h-3" /> {pickerGame.name}
              <span className="mx-1">·</span>
            </span>
          )}
          <span className="text-emerald-400 font-semibold">{pickerAvailable.length} available</span>
          <span>·</span>
          <span>{pickerGame ? (pickerGame.sheetIds.length - pickerAvailable.length) : sheets.filter(s => s.status === 'sold').length} sold</span>
          <span>·</span>
          <span>₹{price} per sheet</span>
          {cart.size > 0 && <span className="ml-auto text-amber-300 font-semibold">{cart.size} selected</span>}
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="flex-1 w-full px-4 sm:px-6 py-5 lg:grid lg:grid-cols-4 lg:gap-8 lg:items-start">

        {/* Sidebar (desktop only) */}
        <div className="hidden lg:block space-y-4">
          {/* Cart summary */}
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
              <p className="text-xs text-slate-400">Click any sheet number to add it</p>
            </div>
          )}

          {/* Stats */}
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
            {pickerAvailable.length > 0 && (pickerGame ? pickerGame.sheetIds.length : sheets.length) > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${(pickerAvailable.length / (pickerGame ? pickerGame.sheetIds.length : sheets.length)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {Math.round((pickerAvailable.length / (pickerGame ? pickerGame.sheetIds.length : sheets.length)) * 100)}% still available
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="lg:col-span-3">
          {search.trim() ? (
            /* Search result */
            <div>
              {searchSheet ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Showing result for "{search.trim()}"</p>
                  {searchSheet.status === 'available' ? (
                    <button
                      onClick={() => toggleCart(searchSheet.id)}
                      className={`w-full sm:max-w-xs rounded-2xl border-2 p-6 text-left transition-all ${
                        cart.has(searchSheet.id)
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white border-amber-300 text-slate-800 hover:bg-amber-50'
                      }`}
                    >
                      <p className="text-4xl font-black">{searchSheet.id.replace('SHEET-', '')}</p>
                      <p className={`text-sm mt-1 font-semibold ${cart.has(searchSheet.id) ? 'text-white/80' : 'text-emerald-600'}`}>
                        {cart.has(searchSheet.id) ? 'Selected — click to remove' : `Available · ₹${price}`}
                      </p>
                    </button>
                  ) : (
                    <div className="w-full sm:max-w-xs rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 opacity-60 cursor-not-allowed">
                      <p className="text-4xl font-black text-slate-400">{searchSheet.id.replace('SHEET-', '')}</p>
                      <p className="text-sm mt-1 font-semibold text-red-500">Sold Out</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 space-y-2">
                  <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-500 font-medium">Sheet #{search.replace(/\D/g, '')} not found</p>
                  <p className="text-sm text-slate-400">Try a different number</p>
                </div>
              )}
            </div>
          ) : (
            /* Paginated grid */
            <>
              {pickerAvailable.length === 0 ? (
                <div className="text-center py-20 space-y-2">
                  <Ticket className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No sheets available right now.</p>
                  {pickerGame && <p className="text-xs text-slate-400">All sheets for this game have been sold or are unavailable.</p>}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2 mb-5">
                    {pagedAvailable.map(s => {
                      const num = parseInt(s.id.replace('SHEET-', ''), 10);
                      const sel = cart.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleCart(s.id)}
                          className={`rounded-xl py-3 text-center text-xs font-bold border-2 transition-all active:scale-95 ${
                            sel
                              ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          {String(num).padStart(4, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {totalPickerPages > 1 && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <button
                        onClick={() => setPickerPage(p => Math.max(0, p - 1))}
                        disabled={pickerPage === 0}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                      >
                        ← Prev
                      </button>
                      <span className="text-sm text-slate-500 font-medium">
                        {pickerPage + 1} / {totalPickerPages}
                      </span>
                      <button
                        onClick={() => setPickerPage(p => Math.min(totalPickerPages - 1, p + 1))}
                        disabled={pickerPage >= totalPickerPages - 1}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
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

          {/* Status banner */}
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
                ? 'Your tickets are confirmed. Download your PDF below and bring them to the game!'
                : isRejected
                ? 'Your order was rejected. Please contact the operator for assistance.'
                : 'Waiting for the operator to verify your payment. This page updates automatically.'}
            </p>
          </div>

          {/* Download button — shown immediately when confirmed */}
          {isConfirmed && liveOrder && (
            <button
              onClick={() => downloadOrderPDF(liveOrder)}
              className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-lg transition-colors shadow-lg shadow-emerald-500/25"
            >
              <Download className="w-6 h-6" />
              Download Ticket PDF
            </button>
          )}

          {/* Order detail card */}
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

          {/* Pending info */}
          {!isConfirmed && !isRejected && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5"><Trophy className="w-4 h-4" /> What happens next?</p>
                <p>1. Operator verifies your UPI payment</p>
                <p>2. This page updates automatically when confirmed</p>
                <p>3. Download your ticket PDF right here</p>
              </CardContent>
            </Card>
          )}

          {/* Come back later note — only when pending */}
          {!isConfirmed && !isRejected && phone && (
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4 text-sm text-slate-600 flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-700">Need to close this page?</p>
                  <p className="mt-1">Come back to marketplace and tap <strong>My Orders</strong> in the top bar — enter your phone number <span className="font-mono font-semibold">{phone}</span> to find this order and download your tickets once confirmed.</p>
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
          <p className="text-slate-500 text-sm">Enter the phone number you used when ordering to find your tickets.</p>
        </div>

        {/* Phone lookup */}
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

        {/* Results */}
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
                      {/* Header row */}
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

                      {/* Sheet numbers */}
                      <div className="flex flex-wrap gap-1">
                        {o.sheetIds.slice(0, 12).map(id => (
                          <span key={id} className="bg-slate-100 text-slate-600 text-xs font-mono px-2 py-0.5 rounded-full">
                            {id.replace('SHEET-', '')}
                          </span>
                        ))}
                        {o.sheetIds.length > 12 && (
                          <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                            +{o.sheetIds.length - 12} more
                          </span>
                        )}
                      </div>

                      {/* Download / status message */}
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

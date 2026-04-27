import { useState, useEffect, useMemo } from 'react';
import { useTambola } from '@/hooks/useTambola';
import type { Order, ScheduledGame } from '@/types';
import QRCode from 'qrcode';
import {
  Search, X, ChevronRight, Dice5, CheckCircle2, QrCode, Copy,
  Ticket, AlertCircle, Calendar, Clock, Star, ShoppingCart,
  ArrowLeft, Trophy, Radio, Sparkles, Download, Phone,
  ClipboardList, Loader2, XCircle, MessageCircle, Gift,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildSheetPDF, DEFAULT_LAYOUT } from '@/lib/pdfRenderer';
import type { Sheet } from '@/types';

type Step = 'home' | 'game-detail' | 'picker' | 'details' | 'pay' | 'submitted' | 'orders';

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

function calcCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Starting now!';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function useLiveCountdown(iso: string): string {
  const [text, setText] = useState(() => calcCountdown(iso));
  useEffect(() => {
    const id = setInterval(() => setText(calcCountdown(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);
  return text;
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

// ─── Live-countdown wrapper ───────────────────────────────────────────────────

function LiveCountdownBadge({ iso }: { iso: string }) {
  const text = useLiveCountdown(iso);
  const soon  = new Date(iso).getTime() - Date.now() < 3600000;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg border ${
      soon
        ? 'bg-red-500/20 border-red-400/50 text-red-200 animate-pulse'
        : 'bg-white/15 border-white/30 text-white'
    }`}>
      <Clock className="w-3 h-3" /> {text}
    </span>
  );
}

// ─── Trade-Fair Hero ──────────────────────────────────────────────────────────

function TradeFairHero({
  name, scheduledAt, prizePool, availableCount, totalSheets, price,
  isLive, calledCount, prizes, hasJackpot, jackpotAmount,
  jackpotThingName, jackpotThingPhoto, backgroundImage, whatsappNumber, onCTA,
}: {
  name: string; scheduledAt?: string; prizePool: number;
  availableCount: number; totalSheets?: number; price: number;
  isLive?: boolean; calledCount?: number;
  prizes?: { label: string; amount: number; type: string; thingName?: string; thingPhoto?: string }[];
  hasJackpot?: boolean; jackpotAmount?: number;
  jackpotThingName?: string; jackpotThingPhoto?: string;
  backgroundImage?: string; whatsappNumber?: string;
  onCTA: () => void;
}) {
  const hasBg = !!backgroundImage;
  const fullHouse = prizes?.find(p => p.type === 'full-house');
  const otherPrizes = prizes?.filter(p => p.type !== 'full-house') ?? [];
  const hasPhysicalJackpot = hasJackpot && !!jackpotThingName;
  const hasPhysicalFH = !!fullHouse?.thingName;

  return (
    <div
      className="relative overflow-hidden rounded-3xl cursor-pointer group select-none"
      onClick={onCTA}
      style={hasBg
        ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 440 }
        : { background: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 40%, #0284c7 100%)', minHeight: 440 }
      }
    >
      {/* Overlay */}
      {hasBg
        ? <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/75" />
        : (
          <div className="absolute top-0 inset-x-0 pointer-events-none">
            <div className="absolute top-3 left-8 w-28 h-14 bg-white/60 rounded-full blur-2xl" />
            <div className="absolute top-1 right-16 w-36 h-16 bg-white/50 rounded-full blur-2xl" />
            <div className="absolute top-6 left-1/3 w-24 h-10 bg-white/40 rounded-full blur-xl" />
          </div>
        )
      }

      <div className="relative px-5 sm:px-8 pt-6 pb-6 flex flex-col gap-4">

        {/* Top row: status + jackpot badge */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isLive ? (
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-md uppercase tracking-widest">
                <Radio className="w-3 h-3 animate-pulse" /> LIVE NOW
              </span>
            ) : scheduledAt ? (
              <LiveCountdownBadge iso={scheduledAt} />
            ) : null}
            {isLive && calledCount !== undefined && (
              <span className="text-sky-200 text-xs font-medium bg-black/20 px-2 py-1 rounded-md">{calledCount}/90 called</span>
            )}
          </div>
          {hasJackpot && (
            <div className="flex items-center gap-1.5 bg-yellow-400 rounded-full px-3 py-1 shadow-lg shrink-0">
              <Star className="w-3.5 h-3.5 text-yellow-900 fill-yellow-900" />
              <span className="text-yellow-900 text-xs font-black uppercase tracking-wide">
                {hasPhysicalJackpot ? jackpotThingName : `Jackpot ₹${jackpotAmount?.toLocaleString()}`}
              </span>
            </div>
          )}
        </div>

        {/* Game name */}
        <div>
          {scheduledAt && !isLive && (
            <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-1">
              {new Date(scheduledAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {new Date(scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          )}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-black text-white uppercase leading-[0.9]"
            style={{ textShadow: '2px 3px 0 rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.2)' }}
          >
            {name}
          </h1>
        </div>

        {/* Hero prize — Full House or total pool */}
        <div className="flex flex-wrap items-start gap-4">
          {fullHouse ? (
            <div className="flex items-stretch rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-emerald-700 px-4 py-3 flex flex-col justify-center">
                <p className="text-emerald-200 text-[10px] font-black uppercase tracking-widest leading-tight">Full<br />House</p>
              </div>
              <div className="bg-emerald-500 px-5 py-3 flex flex-col justify-center">
                {hasPhysicalFH ? (
                  <div className="flex items-center gap-2">
                    {fullHouse.thingPhoto && (
                      <img src={fullHouse.thingPhoto} alt={fullHouse.thingName} className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-300 shrink-0" />
                    )}
                    <div>
                      <p className="text-[10px] text-emerald-200 uppercase tracking-widest font-bold">Win a</p>
                      <p className="text-xl font-black text-white leading-tight">{fullHouse.thingName}</p>
                      <p className="text-emerald-200 text-xs">+ ₹{fullHouse.amount.toLocaleString()} cash</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-white text-4xl font-black tabular-nums" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    ₹{fullHouse.amount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-stretch rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-red-700 px-4 py-3 flex items-center"><p className="text-white text-[10px] font-black uppercase tracking-widest">Prize<br />Pool</p></div>
              <div className="bg-red-500 px-5 py-3 flex items-center">
                <p className="text-white text-4xl font-black tabular-nums">₹{prizePool.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Jackpot physical prize photo */}
          {hasPhysicalJackpot && jackpotThingPhoto && (
            <div className="flex items-center gap-3 bg-yellow-400/15 border border-yellow-400/40 rounded-2xl p-3">
              <img src={jackpotThingPhoto} alt={jackpotThingName} className="w-14 h-14 rounded-xl object-cover border-2 border-yellow-400 shrink-0" />
              <div>
                <p className="text-yellow-300 text-[10px] uppercase tracking-widest font-bold">⭐ Jackpot Prize</p>
                <p className="text-white font-black text-base leading-tight">{jackpotThingName}</p>
                {jackpotAmount ? <p className="text-yellow-200 text-xs">₹{jackpotAmount.toLocaleString()} cash value</p> : null}
              </div>
            </div>
          )}
        </div>

        {/* Other prize chips */}
        {otherPrizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {otherPrizes.map(p => (
              <span key={p.type} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
                {p.thingName ? <Gift className="w-3 h-3" /> : null}
                {p.label}{p.thingName ? `: ${p.thingName}` : ` ₹${p.amount.toLocaleString()}`}
              </span>
            ))}
            {hasJackpot && !hasPhysicalJackpot && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-yellow-400/20 text-yellow-200 border border-yellow-400/40">
                ⭐ Jackpot ₹{jackpotAmount?.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Info strip */}
        <div className="flex flex-wrap gap-2">
          <div className="bg-black/25 backdrop-blur-sm border border-white/20 text-white rounded-xl px-3 py-2 flex items-center gap-2">
            <Ticket className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div>
              <p className="text-[9px] text-white/50 uppercase tracking-widest leading-none">Available</p>
              <p className="text-sm font-black leading-tight">{availableCount}{totalSheets ? `/${totalSheets}` : ''} sheets</p>
            </div>
          </div>
          <div className="bg-black/25 backdrop-blur-sm border border-white/20 text-white rounded-xl px-3 py-2 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div>
              <p className="text-[9px] text-white/50 uppercase tracking-widest leading-none">Price</p>
              <p className="text-sm font-black leading-tight">₹{price}/sheet</p>
            </div>
          </div>
          {fullHouse && (
            <div className="bg-black/25 backdrop-blur-sm border border-white/20 text-white rounded-xl px-3 py-2 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <div>
                <p className="text-[9px] text-white/50 uppercase tracking-widest leading-none">Total Pool</p>
                <p className="text-sm font-black leading-tight">₹{prizePool.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA + WhatsApp */}
        <div className="flex flex-wrap gap-3 items-center mt-1">
          <button
            className="flex items-center gap-2 bg-amber-400 group-hover:bg-amber-300 active:scale-95 transition-all text-slate-900 font-black px-7 py-3.5 rounded-2xl text-base shadow-xl shadow-amber-500/30"
            onClick={e => { e.stopPropagation(); onCTA(); }}
          >
            Get Your Tickets <ChevronRight className="w-5 h-5" />
          </button>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 active:scale-95 transition-all text-white font-bold px-5 py-3.5 rounded-2xl text-sm shadow-lg"
              onClick={e => e.stopPropagation()}
            >
              <MessageCircle className="w-4 h-4" /> Support
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upcoming Game Card ───────────────────────────────────────────────────────

function UpcomingGameCard({ game, whatsapp, onPick }: { game: ScheduledGame; whatsapp?: string; onPick: () => void }) {
  const countdown = useLiveCountdown(game.scheduledAt);
  const fh = game.prizes.find(p => p.type === 'full-house');
  const hasBg = !!game.backgroundImage;
  const soon = new Date(game.scheduledAt).getTime() - Date.now() < 3600000;

  return (
    <div
      onClick={onPick}
      className="relative overflow-hidden rounded-2xl cursor-pointer group active:scale-[0.98] transition-all shadow-lg hover:shadow-xl"
      style={hasBg
        ? { backgroundImage: `url(${game.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 220 }
        : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', minHeight: 220 }
      }
    >
      {/* Overlay */}
      {hasBg
        ? <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/80" />
        : <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
      }

      <div className="relative p-4 flex flex-col h-full gap-3" style={{ minHeight: 220 }}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg ${
            soon ? 'bg-red-500/30 text-red-200 border border-red-400/40 animate-pulse' : 'bg-white/10 text-white/80 border border-white/20'
          }`}>
            <Clock className="w-2.5 h-2.5" /> {countdown}
          </span>
          {game.hasJackpot && (
            <span className="flex items-center gap-1 bg-yellow-400/20 border border-yellow-400/40 text-yellow-200 text-[10px] font-black px-2 py-1 rounded-full shrink-0">
              ⭐ {game.jackpotThingName ?? `₹${game.jackpotAmount.toLocaleString()}`}
            </span>
          )}
        </div>

        {/* Date line */}
        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">
          {new Date(game.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {new Date(game.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>

        {/* Game name */}
        <h3 className="text-2xl font-black text-white uppercase leading-tight"
            style={{ textShadow: '1px 2px 0 rgba(0,0,0,0.4)' }}>
          {game.name}
        </h3>

        {/* Full house prize */}
        {fh && (
          <div className="flex items-center gap-2">
            {fh.thingPhoto
              ? <img src={fh.thingPhoto} alt={fh.thingName} className="w-9 h-9 rounded-lg object-cover border-2 border-emerald-400 shrink-0" />
              : null
            }
            <div>
              <p className="text-emerald-400 text-[10px] uppercase tracking-widest font-bold">Full House</p>
              <p className="text-white font-black text-lg leading-none">
                {fh.thingName ? fh.thingName : `₹${fh.amount.toLocaleString()}`}
              </p>
            </div>
          </div>
        )}

        {/* Prize chips */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {game.prizes.filter(p => p.type !== 'full-house').slice(0, 3).map(p => (
            <span key={p.type} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/70 border border-white/20'}`}>
              {p.label} {p.thingName ? `(${p.thingName})` : `₹${p.amount.toLocaleString()}`}
            </span>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Sheets</p>
              <p className="text-white font-bold text-sm">{game.sheetIds.length} @ ₹{game.ticketPrice}</p>
            </div>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                onClick={e => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" /> Help
              </a>
            )}
          </div>
          <span className="bg-amber-500 group-hover:bg-amber-400 transition-colors text-slate-900 text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1">
            Buy <ChevronRight className="w-3 h-3" />
          </span>
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
  const [lookupPhone,  setLookupPhone]  = useState('');
  const [hasSearched,  setHasSearched]  = useState(false);
  const [lookupGameId, setLookupGameId] = useState('');

  const { currentGame, scheduledGames, sheets, sheetPrice, upiSettings, gameHistory, loading } = tambola;

  const [pickerGame, setPickerGame] = useState<ScheduledGame | null>(null);
  const [detailGame, setDetailGame] = useState<ScheduledGame | null>(null);

  const endedScheduledIds = useMemo(() => {
    const completedIds = new Set(gameHistory.map(g => g.id));
    return new Set(scheduledGames.filter(g => g.sessionId && completedIds.has(g.sessionId)).map(g => g.id));
  }, [gameHistory, scheduledGames]);

  const availableSheets = useMemo(() =>
    sheets.filter(s => s.status === 'available' && !(s.scheduledGameId && endedScheduledIds.has(s.scheduledGameId))),
    [sheets, endedScheduledIds],
  );

  const heroGame = (currentGame && (currentGame.status === 'active' || currentGame.status === 'setup'))
    ? currentGame : null;

  // All upcoming games sorted by time (nearest first)
  const allUpcoming = useMemo(() =>
    scheduledGames
      .filter(g => !g.sessionId)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [scheduledGames]
  );

  const nearestScheduled = allUpcoming[0] ?? null;
  const upcoming = allUpcoming.slice(1);

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

  const openDetail = (game: ScheduledGame) => {
    setDetailGame(game);
    setStep('game-detail');
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
    // Download each sheet as its own PDF (one file per sheet)
    orderSheets.forEach((sheet, i) => {
      setTimeout(() => {
        buildSheetPDF(sheet, { ...DEFAULT_LAYOUT, eventName: 'TukpaMaster' }).save(`ticket-${sheet.id}.pdf`);
      }, i * 300);
    });
  };


  const openOrders = (prefillPhone?: string) => {
    if (prefillPhone) setLookupPhone(prefillPhone);
    setHasSearched(false);
    setStep('orders');
  };

  const myOrders = useMemo(() => {
    if (!hasSearched || !lookupPhone.trim() || !lookupGameId) return [];
    return tambola.orders.filter(o =>
      o.phone.replace(/\D/g, '') === lookupPhone.trim().replace(/\D/g, '') &&
      o.sheetIds.some(sid => {
        const sheet = tambola.sheets.find(s => s.id === sid);
        return sheet?.scheduledGameId === lookupGameId;
      })
    );
  }, [hasSearched, lookupPhone, lookupGameId, tambola.orders, tambola.sheets]);

  const lookupGame = useMemo(
    () => tambola.scheduledGames.find(g => g.id === lookupGameId) ?? null,
    [lookupGameId, tambola.scheduledGames]
  );
  const lookupGameEnded = useMemo(() => {
    if (!lookupGame?.sessionId) return false;
    return tambola.gameHistory.some(h => h.id === lookupGame.sessionId);
  }, [lookupGame, tambola.gameHistory]);

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

  // ─── LOADING ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 40%, #0284c7 100%)' }}>
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-white font-bold text-lg tracking-wide">Loading games…</p>
    </div>
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
            availableCount={availableSheets.filter(s => heroGame.sheetIds.includes(s.id)).length}
            totalSheets={heroGame.sheetIds.length}
            price={price}
            isLive={heroGame.status === 'active'}
            calledCount={heroGame.calledNumbers.length}
            hasJackpot={heroGame.dividends.some(d => d.name === 'Jackpot')}
            jackpotAmount={heroGame.dividends.find(d => d.name === 'Jackpot')?.prize}
            prizes={heroGame.dividends.map(d => ({ label: d.name, amount: d.prize, type: d.type }))}
            whatsappNumber={upiSettings.whatsappNumber}
            onCTA={() => openPicker()}
          />

        ) : nearestScheduled ? (
          <TradeFairHero
            name={nearestScheduled.name}
            scheduledAt={nearestScheduled.scheduledAt}
            prizePool={nearestScheduled.estimatedPrizePool}
            availableCount={availableSheets.filter(s => nearestScheduled.sheetIds.includes(s.id)).length}
            totalSheets={nearestScheduled.sheetIds.length}
            price={nearestScheduled.ticketPrice}
            hasJackpot={nearestScheduled.hasJackpot}
            jackpotAmount={nearestScheduled.jackpotAmount}
            jackpotThingName={nearestScheduled.jackpotThingName}
            jackpotThingPhoto={nearestScheduled.jackpotThingPhoto}
            prizes={nearestScheduled.prizes}
            backgroundImage={nearestScheduled.backgroundImage}
            whatsappNumber={upiSettings.whatsappNumber}
            onCTA={() => openDetail(nearestScheduled)}
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
                      onClick={() => openDetail(upcoming[0])}
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
              <span className="bg-sky-100 text-sky-600 text-xs font-semibold px-2 py-0.5 rounded-full">{upcoming.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(g => <UpcomingGameCard key={g.id} game={g} whatsapp={upiSettings.whatsappNumber} onPick={() => openDetail(g)} />)}
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

  // ── GAME DETAIL ──────────────────────────────────────────────────────────────

  if (step === 'game-detail' && detailGame) {
    const g = detailGame;
    const hasBg = !!g.backgroundImage;
    const gAvailable = availableSheets.filter(s => g.sheetIds.includes(s.id)).length;

    const PRIZE_ICONS: Record<string, string> = {
      'early-five': '5️⃣', 'early-six': '6️⃣', 'early-seven': '7️⃣',
      'top-line': '🔝', 'middle-line': '〰️', 'bottom-line': '⬇️',
      'corners': '🔲', 'sheet-corner': '🏆', 'full-house': '🏠',
      'second-full-house': '🥈', 'third-full-house': '🥉',
    };

    return (
      <div className="min-h-screen bg-slate-100">
        <Header back={() => setStep('home')} title={g.name} />

        {/* Hero banner */}
        <div
          className="relative overflow-hidden"
          style={hasBg
            ? { backgroundImage: `url(${g.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 200 }
            : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', minHeight: 200 }
          }
        >
          {hasBg && <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/80" />}
          {!hasBg && <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />}
          <div className="relative px-5 py-6 flex flex-col gap-2">
            <LiveCountdownBadge iso={g.scheduledAt} />
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase leading-tight mt-1"
                style={{ textShadow: '2px 3px 0 rgba(0,0,0,0.4)' }}>{g.name}</h1>
            <p className="text-white/60 text-sm font-semibold">
              {new Date(g.scheduledAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              {new Date(g.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4 max-w-2xl mx-auto">

          {/* Prize List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> Prize List
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {g.prizes.map(p => (
                <div key={p.type} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xl w-7 shrink-0 text-center">{PRIZE_ICONS[p.type] ?? '🎯'}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">{p.label}</p>
                    {p.thingName && <p className="text-xs text-slate-500 mt-0.5">Prize: {p.thingName}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.thingPhoto && <img src={p.thingPhoto} alt={p.thingName} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
                    <div className="text-right">
                      {p.thingName
                        ? <p className="text-sm font-black text-emerald-600">{p.thingName}</p>
                        : <p className="text-lg font-black text-slate-800">₹{p.amount.toLocaleString()}</p>
                      }
                      {p.thingName && p.amount > 0 && <p className="text-xs text-slate-400">+ ₹{p.amount.toLocaleString()}</p>}
                    </div>
                  </div>
                </div>
              ))}
              {g.hasJackpot && (
                <div className="flex items-center gap-3 px-5 py-3 bg-yellow-50">
                  <span className="text-xl w-7 shrink-0 text-center">⭐</span>
                  <div className="flex-1">
                    <p className="font-black text-yellow-800 text-sm">Jackpot</p>
                    {g.jackpotThingName && <p className="text-xs text-yellow-600 mt-0.5">Prize: {g.jackpotThingName}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {g.jackpotThingPhoto && <img src={g.jackpotThingPhoto} alt={g.jackpotThingName} className="w-10 h-10 rounded-lg object-cover border-2 border-yellow-400" />}
                    <div className="text-right">
                      {g.jackpotThingName
                        ? <p className="text-sm font-black text-yellow-700">{g.jackpotThingName}</p>
                        : <p className="text-lg font-black text-yellow-700">₹{g.jackpotAmount.toLocaleString()}</p>
                      }
                      {g.jackpotThingName && g.jackpotAmount > 0 && <p className="text-xs text-yellow-500">+ ₹{g.jackpotAmount.toLocaleString()}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Total */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Prize Pool</p>
              <p className="text-xl font-black text-slate-800">₹{g.estimatedPrizePool.toLocaleString()}</p>
            </div>
          </div>

          {/* Ticket Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Ticket className="w-3.5 h-3.5 text-sky-500" /> Ticket Info
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-sky-600">{gAvailable}</p>
                <p className="text-xs text-slate-500 mt-0.5">Available</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-slate-700">{g.sheetIds.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Sheets</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-emerald-600">₹{g.ticketPrice}</p>
                <p className="text-xs text-slate-500 mt-0.5">Per Sheet</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3 pb-6">
            <button
              onClick={() => openPicker(g)}
              disabled={gAvailable === 0}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-slate-900 font-black px-6 py-4 rounded-2xl text-lg shadow-xl shadow-amber-200"
            >
              {gAvailable === 0 ? 'Sold Out' : <><Ticket className="w-5 h-5" /> Pick Your Tickets <ChevronRight className="w-5 h-5" /></>}
            </button>
            {upiSettings.whatsappNumber && (
              <a
                href={`https://wa.me/${upiSettings.whatsappNumber}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold py-3.5 rounded-2xl text-base shadow-lg"
              >
                <MessageCircle className="w-5 h-5" /> Contact Support on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                <span className="font-bold text-slate-400">{pickerGame?.sheetIds.length ?? 0}</span>
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
              <Download className="w-6 h-6" /> Download {liveOrder.sheetIds.length} Ticket PDF{liveOrder.sheetIds.length > 1 ? 's' : ''}
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
      <Header back={() => setStep('home')} title="My Tickets" />
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Find My Tickets</h2>
          <p className="text-slate-500 text-sm">Select the game you bought tickets for, then enter your phone.</p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            {/* Step 1: Select game */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-slate-700">
                <Ticket className="w-3.5 h-3.5" /> 1. Select Game
              </Label>
              <select
                value={lookupGameId}
                onChange={e => { setLookupGameId(e.target.value); setHasSearched(false); }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— Choose a game —</option>
                {[...tambola.scheduledGames]
                  .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                  .map(g => {
                    const ended = g.sessionId && tambola.gameHistory.some(h => h.id === g.sessionId);
                    return (
                      <option key={g.id} value={g.id}>
                        {g.name} · {new Date(g.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{ended ? ' (Ended)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Step 2: Phone number */}
            <div>
              <Label htmlFor="lookup-phone" className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> 2. Your Phone Number
              </Label>
              <div className="flex gap-2">
                <Input
                  id="lookup-phone"
                  value={lookupPhone}
                  onChange={e => { setLookupPhone(e.target.value); setHasSearched(false); }}
                  onKeyDown={e => e.key === 'Enter' && lookupPhone.trim() && lookupGameId && setHasSearched(true)}
                  placeholder="+91 98765 43210"
                  className="flex-1"
                  disabled={!lookupGameId}
                />
                <Button
                  onClick={() => setHasSearched(true)}
                  disabled={!lookupPhone.trim() || !lookupGameId}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5"
                >
                  Find
                </Button>
              </div>
            </div>

            {/* Ended game warning */}
            {lookupGameEnded && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>This game has ended. You can view your order history but <strong>downloads are no longer available</strong> for this game.</span>
              </div>
            )}
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
                        lookupGameEnded ? (
                          <p className="text-xs text-amber-600 text-center font-medium">Game ended — download not available.</p>
                        ) : (
                          <button
                            onClick={() => downloadOrderPDF(o)}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                          >
                            <Download className="w-4 h-4" /> Download {o.sheetIds.length} PDF{o.sheetIds.length > 1 ? 's' : ''}
                          </button>
                        )
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

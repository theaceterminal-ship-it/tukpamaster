import { useState, useRef, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar, Star, Image, Upload, X, Zap, Trophy, CheckCircle2, Circle,
} from 'lucide-react';

// ─── Prize type definitions ───────────────────────────────────────────────────

const ALL_PRIZE_TYPES = [
  { type: 'early-five',         label: 'Early Five',     default: 500,  color: 'bg-sky-100 border-sky-300 text-sky-800' },
  { type: 'early-six',          label: 'Early Six',      default: 600,  color: 'bg-cyan-100 border-cyan-300 text-cyan-800' },
  { type: 'early-seven',        label: 'Early Seven',    default: 700,  color: 'bg-blue-100 border-blue-300 text-blue-800' },
  { type: 'top-line',           label: 'Top Line',       default: 1000, color: 'bg-orange-100 border-orange-300 text-orange-800' },
  { type: 'middle-line',        label: 'Middle Line',    default: 1000, color: 'bg-purple-100 border-purple-300 text-purple-800' },
  { type: 'bottom-line',        label: 'Bottom Line',    default: 1000, color: 'bg-pink-100 border-pink-300 text-pink-800' },
  { type: 'corners',            label: 'Corners',        default: 500,  color: 'bg-teal-100 border-teal-300 text-teal-800' },
  { type: 'sheet-corner',       label: 'Sheet Corner',   default: 2000, color: 'bg-indigo-100 border-indigo-300 text-indigo-800' },
  { type: 'full-house',         label: 'Full House',     default: 5000, color: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
  { type: 'second-full-house',  label: '2nd Full House', default: 3000, color: 'bg-lime-100 border-lime-300 text-lime-800' },
  { type: 'third-full-house',   label: '3rd Full House', default: 2000, color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
] as const;

// ─── Image compression helper ─────────────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 900, MAX_H = 450;
        let w = img.width, h = img.height;
        const r = Math.min(MAX_W / w, MAX_H / h);
        if (r < 1) { w = Math.round(w * r); h = Math.round(h * r); }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScheduleGameDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTicketPrice: number;
  onSchedule: (input: {
    name: string;
    scheduledAt: string;
    backgroundImage?: string;
    prizes: { type: string; label: string; amount: number; thingName?: string; thingPhoto?: string }[];
    hasJackpot: boolean;
    jackpotAmount: number;
    jackpotThingName?: string;
    jackpotThingPhoto?: string;
    sheetIds: string[];
    ticketPrice: number;
  }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleGameDialog({
  open, onClose, defaultTicketPrice, onSchedule,
}: ScheduleGameDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Basic
  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgUrlDraft, setBgUrlDraft] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [ticketPrice, setTicketPrice] = useState(String(defaultTicketPrice || 50));

  // Prizes
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(['early-five', 'top-line', 'middle-line', 'bottom-line', 'full-house'])
  );
  const [prizeAmounts, setPrizeAmounts] = useState<Record<string, number>>(
    Object.fromEntries(ALL_PRIZE_TYPES.map(t => [t.type, t.default]))
  );
  const [hasJackpot, setHasJackpot] = useState(false);
  const [jackpotAmount, setJackpotAmount] = useState(10000);

  // Physical prizes
  const prizePhotoRef = useRef<HTMLInputElement>(null);
  const jackpotPhotoRef = useRef<HTMLInputElement>(null);
  const [fullHouseThingName, setFullHouseThingName] = useState('');
  const [fullHouseThingPhoto, setFullHouseThingPhoto] = useState('');
  const [jackpotThingName, setJackpotThingName] = useState('');
  const [jackpotThingPhoto, setJackpotThingPhoto] = useState('');
  const [prizePhotoLoading, setPrizePhotoLoading] = useState(false);
  const [jackpotPhotoLoading, setJackpotPhotoLoading] = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────

  const activePrizes = useMemo(() =>
    ALL_PRIZE_TYPES
      .filter(t => activeTypes.has(t.type))
      .map(t => ({
        type: t.type, label: t.label, amount: prizeAmounts[t.type] ?? t.default,
        thingName:  t.type === 'full-house' && fullHouseThingName  ? fullHouseThingName  : undefined,
        thingPhoto: t.type === 'full-house' && fullHouseThingPhoto ? fullHouseThingPhoto : undefined,
      })),
    [activeTypes, prizeAmounts, fullHouseThingName, fullHouseThingPhoto]
  );

  const totalPrize = useMemo(() =>
    activePrizes.reduce((s, p) => s + p.amount, 0) + (hasJackpot ? jackpotAmount : 0),
    [activePrizes, hasJackpot, jackpotAmount]
  );

  const canSubmit = name.trim() && scheduledAt;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const setPrize = (type: string, val: string) => {
    const n = parseInt(val.replace(/\D/g, '')) || 0;
    setPrizeAmounts(prev => ({ ...prev, [type]: n }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    const dataUrl = await compressImage(file);
    setBgImage(dataUrl);
    setBgUrlDraft('');
    setImageLoading(false);
    e.target.value = '';
  };

  const applyUrl = () => {
    if (bgUrlDraft.trim()) { setBgImage(bgUrlDraft.trim()); }
  };

  const clearImage = () => { setBgImage(''); setBgUrlDraft(''); };

  const handlePrizePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPrizePhotoLoading(true);
    const compressed = await compressImage(file);
    setFullHouseThingPhoto(compressed);
    setPrizePhotoLoading(false);
    e.target.value = '';
  };

  const handleJackpotPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setJackpotPhotoLoading(true);
    const compressed = await compressImage(file);
    setJackpotThingPhoto(compressed);
    setJackpotPhotoLoading(false);
    e.target.value = '';
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSchedule({
      name: name.trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      backgroundImage: bgImage || undefined,
      prizes: activePrizes,
      hasJackpot,
      jackpotAmount: hasJackpot ? jackpotAmount : 0,
      jackpotThingName: hasJackpot && jackpotThingName ? jackpotThingName : undefined,
      jackpotThingPhoto: hasJackpot && jackpotThingPhoto ? jackpotThingPhoto : undefined,
      sheetIds: [],
      ticketPrice: parseInt(ticketPrice) || defaultTicketPrice || 50,
    });
    // Reset
    setName(''); setScheduledAt(''); setBgImage(''); setBgUrlDraft('');
    setTicketPrice(String(defaultTicketPrice || 50));
    setActiveTypes(new Set(['early-five', 'top-line', 'middle-line', 'bottom-line', 'full-house']));
    setPrizeAmounts(Object.fromEntries(ALL_PRIZE_TYPES.map(t => [t.type, t.default])));
    setHasJackpot(false); setJackpotAmount(10000);
    setFullHouseThingName(''); setFullHouseThingPhoto('');
    setJackpotThingName(''); setJackpotThingPhoto('');
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-amber-500" />
              Schedule a Game
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-7">

          {/* ── SECTION 1: Game Details ── */}
          <section className="space-y-4">
            <SectionLabel icon={<Zap className="w-4 h-4" />} title="Game Details" />

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Game Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Saturday Night Special"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600">Ticket Price (₹ per sheet)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500 font-semibold text-lg">₹</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={ticketPrice}
                  onChange={e => setTicketPrice(e.target.value.replace(/\D/g, ''))}
                  placeholder="50"
                  className="text-lg font-bold w-28"
                />
              </div>
            </div>

            {/* Background image */}
            <div>
              <Label className="text-xs font-semibold text-slate-600">Thumbnail Background Image</Label>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">Shows on the marketplace game card. Paste a URL or upload a photo.</p>

              {bgImage ? (
                <div className="relative rounded-xl overflow-hidden h-36 bg-slate-100 group">
                  <img src={bgImage} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-3">
                    <span className="text-white font-bold text-sm truncate">{name || 'Game Preview'}</span>
                  </div>
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      ref={urlInputRef}
                      value={bgUrlDraft}
                      onChange={e => setBgUrlDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyUrl()}
                      placeholder="https://example.com/image.jpg"
                      className="text-sm flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={applyUrl} disabled={!bgUrlDraft.trim()}>
                      <Image className="w-3.5 h-3.5 mr-1.5" /> Use URL
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="text-center">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={imageLoading}
                      className="gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {imageLoading ? 'Compressing...' : 'Upload Photo'}
                    </Button>
                    <p className="text-xs text-slate-400 mt-1.5">Auto-compressed to ~100KB</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION 2: Prize Configuration ── */}
          <section className="space-y-4">
            <SectionLabel icon={<Trophy className="w-4 h-4" />} title="Prize Configuration" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALL_PRIZE_TYPES.map(t => {
                const active = activeTypes.has(t.type);
                return (
                  <div
                    key={t.type}
                    className={`rounded-xl border-2 p-3 transition-all cursor-pointer ${
                      active ? `${t.color} shadow-sm` : 'bg-slate-50 border-slate-200 opacity-50'
                    }`}
                    onClick={() => toggleType(t.type)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">{t.label}</span>
                      {active
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <Circle className="w-4 h-4 shrink-0 text-slate-400" />
                      }
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <span className="text-xs font-semibold">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={prizeAmounts[t.type] ?? t.default}
                        onChange={e => setPrize(t.type, e.target.value)}
                        disabled={!active}
                        className="w-full bg-transparent border-0 outline-none text-sm font-bold p-0 disabled:opacity-40"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full House physical prize option */}
            {activeTypes.has('full-house') && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Full House — Physical Prize (optional)
                </p>
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={fullHouseThingName}
                    onChange={e => setFullHouseThingName(e.target.value)}
                    placeholder="e.g. iPhone 16, Royal Enfield…"
                    className="flex-1 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  />
                  <input ref={prizePhotoRef} type="file" accept="image/*" className="hidden" onChange={handlePrizePhotoUpload} />
                  {fullHouseThingPhoto
                    ? <div className="relative shrink-0">
                        <img src={fullHouseThingPhoto} alt="prize" className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-400" />
                        <button onClick={() => setFullHouseThingPhoto('')} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">×</button>
                      </div>
                    : <button
                        type="button"
                        onClick={() => prizePhotoRef.current?.click()}
                        disabled={prizePhotoLoading}
                        className="shrink-0 text-xs text-emerald-600 border border-emerald-300 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {prizePhotoLoading ? '…' : '+ Photo'}
                      </button>
                  }
                </div>
              </div>
            )}

            {/* Jackpot */}
            <div
              className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                hasJackpot
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 shadow-md shadow-yellow-100'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
              onClick={() => setHasJackpot(v => !v)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className={`w-5 h-5 ${hasJackpot ? 'text-yellow-500 fill-yellow-400' : 'text-slate-400'}`} />
                  <span className={`font-black text-sm uppercase tracking-wide ${hasJackpot ? 'text-yellow-800' : 'text-slate-500'}`}>
                    Jackpot Prize
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className={`text-sm font-bold ${hasJackpot ? 'text-yellow-800' : 'text-slate-400'}`}>₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={jackpotAmount}
                    onChange={e => setJackpotAmount(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                    disabled={!hasJackpot}
                    className={`w-28 text-right bg-transparent border-b outline-none text-lg font-black disabled:opacity-40 ${
                      hasJackpot ? 'border-yellow-400 text-yellow-800' : 'border-slate-200 text-slate-400'
                    }`}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>

            {/* Jackpot physical prize option */}
            {hasJackpot && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 space-y-2">
                <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />
                  Jackpot — Physical Prize (optional)
                </p>
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={jackpotThingName}
                    onChange={e => setJackpotThingName(e.target.value)}
                    placeholder="e.g. Royal Enfield Bullet, Samsung TV…"
                    className="flex-1 border border-yellow-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                  />
                  <input ref={jackpotPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleJackpotPhotoUpload} />
                  {jackpotThingPhoto
                    ? <div className="relative shrink-0">
                        <img src={jackpotThingPhoto} alt="jackpot" className="w-10 h-10 rounded-lg object-cover border-2 border-yellow-400" />
                        <button onClick={() => setJackpotThingPhoto('')} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">×</button>
                      </div>
                    : <button
                        type="button"
                        onClick={() => jackpotPhotoRef.current?.click()}
                        disabled={jackpotPhotoLoading}
                        className="shrink-0 text-xs text-yellow-700 border border-yellow-300 rounded-lg px-2.5 py-1.5 hover:bg-yellow-100 disabled:opacity-50"
                      >
                        {jackpotPhotoLoading ? '…' : '+ Photo'}
                      </button>
                  }
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ backgroundColor: 'rgba(232,98,42,0.08)', border: '1px solid rgba(232,98,42,0.2)' }}>
              <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#0ea5e9' }}>Total Prize Pool</span>
              <span className="font-black text-2xl text-gray-900">₹{totalPrize.toLocaleString()}</span>
            </div>
          </section>

          {/* ── Preview thumbnail ── */}
          {name && (
            <section className="space-y-2">
              <SectionLabel icon={<Image className="w-4 h-4" />} title="Marketplace Thumbnail Preview" />
              <GameCard
                name={name}
                scheduledAt={scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString()}
                backgroundImage={bgImage}
                prizes={activePrizes}
                hasJackpot={hasJackpot}
                jackpotAmount={jackpotAmount}
                totalPrize={totalPrize}
                sheetCount={0}
                ticketPrice={parseInt(ticketPrice) || 50}
                preview
              />
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold gap-2 min-w-[160px]"
            >
              <Calendar className="w-4 h-4" />
              Schedule Game
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
      <span className="text-amber-500">{icon}</span>
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

// ─── Shared GameCard (used in preview + marketplace) ──────────────────────────

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

export function GameCard({
  name, scheduledAt, backgroundImage, prizes, hasJackpot, jackpotAmount,
  totalPrize, sheetCount, ticketPrice, preview = false, onClick,
}: {
  name: string;
  scheduledAt: string;
  backgroundImage?: string;
  prizes: { type: string; label: string; amount: number }[];
  hasJackpot: boolean;
  jackpotAmount: number;
  totalPrize: number;
  sheetCount: number;
  ticketPrice: number;
  preview?: boolean;
  onClick?: () => void;
}) {
  const hasBg = !!backgroundImage;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-transform ${
        preview ? 'max-w-sm' : 'w-full'
      } ${onClick ? 'cursor-pointer hover:scale-[1.015] active:scale-[0.99]' : ''}`}
      style={hasBg
        ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' }
      }
    >
      {/* Blobs (only when no bg image) */}
      {!hasBg && (
        <>
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Overlay gradient */}
      {hasBg && (
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/60 to-slate-900/20 pointer-events-none" />
      )}

      {/* Jackpot badge */}
      {hasJackpot && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-400/20 border border-yellow-400/50 backdrop-blur-sm rounded-full px-2.5 py-1 z-10">
          <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          <span className="text-yellow-200 text-xs font-black uppercase tracking-wide">Jackpot</span>
        </div>
      )}

      <div className="relative p-4 sm:p-5 space-y-3">
        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          <span>{new Date(scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="mx-1">·</span>
          <span>{new Date(scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>

        {/* Game name */}
        <h3 className="text-xl font-black text-white uppercase leading-tight">{name}</h3>

        {/* Prize chips */}
        <div className="flex flex-wrap gap-1.5">
          {prizes.slice(0, 4).map(p => (
            <span key={p.type} className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CHIP_COLORS[p.type] ?? 'bg-white/10 text-white/80 border border-white/20'}`}>
              {p.label}
            </span>
          ))}
          {hasJackpot && (
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200 border border-yellow-400/40">
              ⭐ Jackpot ₹{jackpotAmount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-end justify-between pt-1 border-t border-white/10">
          <div>
            <p className="text-slate-400 text-xs">Total Prize Pool</p>
            <p className="text-2xl font-black text-white">₹{totalPrize.toLocaleString()}</p>
          </div>
          <div className="text-right">
            {sheetCount > 0 && <p className="text-slate-400 text-xs">{sheetCount.toLocaleString()} sheets</p>}
            <p className="text-amber-400 font-bold text-sm">₹{ticketPrice}/sheet</p>
          </div>
        </div>

        {/* Buy CTA — only when card is clickable */}
        {onClick && (
          <div className="pt-1">
            <div className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors">
              Buy Tickets
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

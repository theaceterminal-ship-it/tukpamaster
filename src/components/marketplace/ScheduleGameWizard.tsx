import { useState, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2,
  Trophy, Image, Calendar, IndianRupee, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  mktCreateGame, mktAssignSheets, mktUploadThumbnail,
  type MktGame,
} from '@/services/marketplaceApi';

// ── Prize presets ────────────────────────────────────────────────────────────

const PRIZE_PRESETS = [
  { type: 'full-house',        emoji: '👑', label: 'Full House',        def: 5000 },
  { type: 'second-full-house', emoji: '🥈', label: '2nd Full House',    def: 3000 },
  { type: 'third-full-house',  emoji: '🥉', label: '3rd Full House',    def: 2000 },
  { type: 'upper-line',        emoji: '⬆️', label: 'Upper Line',        def: 1000 },
  { type: 'middle-line',       emoji: '➡️', label: 'Middle Line',       def: 1000 },
  { type: 'bottom-line',       emoji: '⬇️', label: 'Bottom Line',       def: 1000 },
  { type: 'ticket-corners',    emoji: '🔲', label: 'Ticket Corners',    def: 500  },
  { type: 'sheet-corner',      emoji: '🏁', label: 'Sheet Corner',      def: 2000 },
  { type: 'early-5',           emoji: '5️⃣', label: 'Early 5',           def: 500  },
  { type: 'early-6',           emoji: '6️⃣', label: 'Early 6',           def: 600  },
  { type: 'early-7',           emoji: '7️⃣', label: 'Early 7',           def: 700  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingTier { qty: number; price: number }

interface Props {
  apiKey: string;
  onCreated: (game: MktGame) => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(dt: string): string {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dt; }
}

function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < step ? 'w-5 h-2 bg-sky-400' :
            i === step ? 'w-7 h-2 bg-sky-500' :
            'w-2 h-2 bg-white/20'
          )}
        />
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function ScheduleGameWizard({ apiKey, onCreated, onClose }: Props) {
  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName]         = useState('');
  const [datetime, setDatetime] = useState('');
  const [joinTime, setJoinTime] = useState('');

  // Step 2
  const [price, setPrice]               = useState(100);
  const [variablePricing, setVariable]  = useState(false);
  const [tiers, setTiers]               = useState<PricingTier[]>([{ qty: 5, price: 450 }]);
  const [thumbFile, setThumbFile]       = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [description, setDescription]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [prizes, setPrizes] = useState<Record<string, number>>({ 'full-house': 5000 });

  // Step 4
  const [sheetFrom, setSheetFrom] = useState('');
  const [sheetTo, setSheetTo]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');

  // ── navigation helpers ──

  const canNext = [
    name.trim().length > 0,
    price >= 1,
    Object.keys(prizes).length > 0,
    true, // step 4 — always can try
  ][step] ?? true;

  function pickThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setThumbFile(f);
    const reader = new FileReader();
    reader.onload = () => setThumbPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function addTier() {
    setTiers(t => [...t, { qty: 10, price: 900 }]);
  }

  function removeTier(i: number) {
    setTiers(t => t.filter((_, idx) => idx !== i));
  }

  function updateTier(i: number, field: keyof PricingTier, val: number) {
    setTiers(t => t.map((tier, idx) => idx === i ? { ...tier, [field]: val } : tier));
  }

  function togglePrize(type: string, def: number) {
    setPrizes(prev => {
      const n = { ...prev };
      if (type in n) delete n[type];
      else n[type] = def;
      return n;
    });
  }

  // ── create game ──

  async function handleCreate() {
    if (!apiKey || !sheetFrom || !sheetTo) return;
    setSaving(true); setSaveErr('');
    try {
      // upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (thumbFile) {
        const b64 = await toBase64(thumbFile);
        const { url } = await mktUploadThumbnail(apiKey, thumbFile.name, b64);
        thumbnailUrl = url;
      }

      const prizesArr = Object.entries(prizes)
        .filter(([, v]) => v > 0)
        .map(([type, amount]) => ({
          name: PRIZE_PRESETS.find(p => p.type === type)?.label ?? type,
          kind: 'cash' as const,
          amount,
        }));

      const gameDate = datetime
        ? new Date(datetime).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : null;

      const { game } = await mktCreateGame(apiKey, {
        name: name.trim(),
        gameDate,
        gameDateRaw: datetime || null,
        joinTime: joinTime || null,
        pricePerSheet: price,
        pricingTiers: variablePricing && tiers.length > 0 ? tiers : undefined,
        description: description.trim() || undefined,
        prizes: prizesArr,
        thumbnail: thumbnailUrl,
      });

      await mktAssignSheets(apiKey, game.id, Number(sheetFrom), Number(sheetTo));

      onCreated({ ...game, sheetCount: Number(sheetTo) - Number(sheetFrom) + 1 });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setSaving(false);
    }
  }

  const STEP_LABELS = ['Details', 'Pricing', 'Prizes', 'Sheets'];

  // ── render ──

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1a2e] flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 border-b border-white/10">
        <button
          onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
          className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-base leading-tight">Schedule Game</p>
          <p className="text-white/40 text-xs">Step {step + 1} of 4 — {STEP_LABELS[step]}</p>
        </div>
        <StepDots step={step} total={4} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* ── Step 1: Details ── */}
        {step === 0 && (
          <div className="space-y-4">
            <SectionHead icon={<Calendar className="w-4 h-4" />} title="Game Details" />

            <Field label="Game Name *">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sunday Mega Tambola"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                autoFocus
              />
            </Field>

            <Field label="Date & Time">
              <input
                type="datetime-local"
                value={datetime}
                onChange={e => setDatetime(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:dark]"
              />
            </Field>

            <Field label="Join / Register By">
              <input
                type="time"
                value={joinTime}
                onChange={e => setJoinTime(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:dark]"
              />
              <p className="text-white/30 text-xs mt-1">Time by which players must register</p>
            </Field>
          </div>
        )}

        {/* ── Step 2: Pricing & Thumbnail ── */}
        {step === 1 && (
          <div className="space-y-4">
            <SectionHead icon={<IndianRupee className="w-4 h-4" />} title="Pricing & Thumbnail" />

            <Field label="Price per Sheet (₹) *">
              <input
                type="number"
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                min={1}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:dark]"
              />
            </Field>

            {/* Variable pricing toggle */}
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-white text-sm font-semibold">Variable Pricing</span>
              </div>
              <button
                onClick={() => setVariable(v => !v)}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  variablePricing ? 'bg-sky-500' : 'bg-white/20'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  variablePricing ? 'translate-x-7' : 'translate-x-1'
                )} />
              </button>
            </div>

            {variablePricing && (
              <div className="space-y-2">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide">Pricing Tiers</p>
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-white/40 text-xs">Buy</span>
                      <input
                        type="number"
                        value={tier.qty}
                        onChange={e => updateTier(i, 'qty', Number(e.target.value))}
                        min={1}
                        className="w-12 bg-transparent text-white text-sm font-bold focus:outline-none"
                      />
                      <span className="text-white/40 text-xs">sheets for ₹</span>
                      <input
                        type="number"
                        value={tier.price}
                        onChange={e => updateTier(i, 'price', Number(e.target.value))}
                        min={1}
                        className="w-20 bg-transparent text-white text-sm font-bold focus:outline-none"
                      />
                    </div>
                    <button onClick={() => removeTier(i)} className="p-2 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTier}
                  className="flex items-center gap-2 text-sky-400 text-sm font-semibold hover:text-sky-300 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Tier
                </button>
              </div>
            )}

            {/* Thumbnail */}
            <Field label="Game Thumbnail">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full bg-white/5 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 py-6 hover:border-sky-400/50 transition-colors"
              >
                {thumbPreview ? (
                  <img src={thumbPreview} alt="" className="w-32 h-20 object-cover rounded-lg" />
                ) : (
                  <>
                    <Image className="w-8 h-8 text-white/20" />
                    <span className="text-white/40 text-sm">Tap to pick image</span>
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickThumb}
              />
              {thumbPreview && (
                <button
                  onClick={() => { setThumbFile(null); setThumbPreview(null); }}
                  className="text-xs text-red-400 hover:text-red-300 mt-1"
                >
                  Remove image
                </button>
              )}
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add a short description for players…"
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
              />
            </Field>
          </div>
        )}

        {/* ── Step 3: Prizes ── */}
        {step === 2 && (
          <div className="space-y-4">
            <SectionHead icon={<Trophy className="w-4 h-4" />} title="Prize Selection" />
            <p className="text-white/50 text-sm">Tap a prize to add it. Enter the prize money.</p>

            <div className="grid grid-cols-2 gap-2">
              {PRIZE_PRESETS.map(pt => {
                const selected = pt.type in prizes;
                return (
                  <div
                    key={pt.type}
                    className={cn(
                      'rounded-2xl border-2 p-3 cursor-pointer transition-all select-none',
                      selected
                        ? 'border-sky-500 bg-sky-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    )}
                    onClick={() => togglePrize(pt.type, pt.def)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{pt.emoji}</span>
                      <span className={cn('text-xs font-bold leading-tight', selected ? 'text-white' : 'text-white/50')}>
                        {pt.label}
                      </span>
                    </div>
                    {selected && (
                      <div
                        className="flex items-center gap-1 mt-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="text-white/60 text-xs">₹</span>
                        <input
                          type="number"
                          value={prizes[pt.type]}
                          onChange={e => setPrizes(p => ({ ...p, [pt.type]: Number(e.target.value) }))}
                          min={0}
                          className="w-full bg-white/10 border border-sky-400/40 rounded-lg px-2 py-1 text-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-sky-400 [color-scheme:dark]"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {Object.keys(prizes).length === 0 && (
              <p className="text-amber-400 text-xs text-center">Select at least one prize to continue.</p>
            )}
          </div>
        )}

        {/* ── Step 4: Assign Sheets + Summary ── */}
        {step === 3 && (
          <div className="space-y-4">
            <SectionHead icon={<Layers className="w-4 h-4" />} title="Assign Sheets" />

            {/* Summary card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
              <Row label="Name" value={name} />
              {datetime && <Row label="Date" value={fmtDatetime(datetime)} />}
              {joinTime  && <Row label="Join by" value={fmtTime(joinTime)} />}
              <Row label="Price" value={`₹${price}/sheet`} />
              {variablePricing && tiers.length > 0 && (
                <Row label="Tiers" value={tiers.map(t => `${t.qty} for ₹${t.price}`).join(' · ')} />
              )}
              <Row label="Prizes" value={`${Object.keys(prizes).length} selected`} />
              {thumbPreview && (
                <div className="flex items-center gap-2 pt-1">
                  <img src={thumbPreview} alt="" className="w-12 h-8 object-cover rounded-lg" />
                  <span className="text-white/40 text-xs truncate">{thumbFile?.name}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Sheet Range</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={sheetFrom}
                  onChange={e => setSheetFrom(e.target.value)}
                  placeholder="From"
                  min={1}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:dark]"
                />
                <span className="text-white/30 text-lg font-bold">–</span>
                <input
                  type="number"
                  value={sheetTo}
                  onChange={e => setSheetTo(e.target.value)}
                  placeholder="To"
                  min={1}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:dark]"
                />
              </div>
              {sheetFrom && sheetTo && Number(sheetTo) >= Number(sheetFrom) && (
                <p className="text-sky-400 text-xs text-center mt-2 font-semibold">
                  {Number(sheetTo) - Number(sheetFrom) + 1} sheets will be assigned
                </p>
              )}
            </div>

            {saveErr && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl px-4 py-3">{saveErr}</p>
            )}
          </div>
        )}

      </div>

      {/* Footer CTA */}
      <div className="px-4 pb-safe-bottom pb-6 pt-3 border-t border-white/10">
        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="w-full py-4 rounded-2xl font-black text-slate-900 text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#f59e0b' }}
          >
            Next <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={saving || !sheetFrom || !sheetTo || !name.trim()}
            className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            {saving
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating…</>
              : <><Check className="w-5 h-5" /> Create Game</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Micro helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/50 text-xs font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sky-400">{icon}</span>
      <h3 className="text-white font-black text-lg">{title}</h3>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-white/40 text-xs w-16 shrink-0 pt-0.5">{label}</span>
      <span className="text-white text-xs font-semibold flex-1">{value}</span>
    </div>
  );
}

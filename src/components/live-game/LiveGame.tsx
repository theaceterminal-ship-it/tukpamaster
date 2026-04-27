import { useState, useRef } from 'react';
import {
  Radio, Play, RotateCcw, Volume2, VolumeX, Trophy,
  Calendar, Clock, Rocket, ShieldCheck, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Package,
  TrendingUp, Banknote,
} from 'lucide-react';
import { ScheduleGameDialog } from './ScheduleGameDialog';
import type { useTambola } from '@/hooks/useTambola';
import type { ScheduledGame, Dividend, DividendType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { verifyDividend } from '@/lib/tambola';

interface LiveGameProps {
  tambola: ReturnType<typeof useTambola>;
}

// ─── Number lingo ─────────────────────────────────────────────────────────────

const NUMBER_LINGO: Record<number, string> = {
  1:'Lone Ranger',2:'One Little Duck',3:'Cup of Tea',4:'Knock at the Door',
  5:'Man Alive',6:'Chopsticks',7:'Lucky Seven',8:'Garden Gate',9:'Doctors Orders',
  10:'Big Ben',11:'Legs Eleven',12:'One Dozen',13:'Unlucky for Some',
  14:'Valentines Day',15:'Young and Keen',16:'Sweet Sixteen',17:'Dancing Queen',
  18:'Coming of Age',19:'Goodbye Teens',20:'One Score',21:'Key of the Door',
  22:'Two Little Ducks',23:'Thee and Me',24:'Two Dozen',25:'Silver Jubilee',
  26:'Pick and Mix',27:'Gateway to Heaven',28:'Over Weight',29:'Rise and Shine',
  30:'Dirty Gertie',31:'Get Up and Run',32:'Buckle My Shoe',33:'All the Threes',
  34:'Ask for More',35:'Jump and Jive',36:'Three Dozen',37:'More than Eleven',
  38:'Christmas Cake',39:'Steps',40:'Naughty Forty',41:'Time for Fun',
  42:'Winnie the Pooh',43:'Down on Your Knees',44:'Droopy Drawers',
  45:'Halfway There',46:'Up to Tricks',47:'Four and Seven',48:'Four Dozen',
  49:'PC',50:'Half a Century',51:'Tweak of the Thumb',52:'Danny La Rue',
  53:'Here Comes Herbie',54:'Man at the Door',55:'Snakes Alive',
  56:'Was She Worth It',57:'Heinz Varieties',58:'Make Them Wait',
  59:'Brighton Line',60:'Five Dozen',61:'Bakers Bun',62:'Turn the Screw',
  63:'Tickle Me',64:'Red Raw',65:'Old Age Pension',66:'Clickety Click',
  67:'Stairway to Heaven',68:'Saving Grace',69:'Either Way Up',
  70:'Three Score and Ten',71:'Bang on the Drum',72:'Six Dozen',
  73:'Queen Bee',74:'Hit the Floor',75:'Strive and Strive',
  76:'Trombones',77:'Two Little Crutches',78:'Heavens Gate',79:'One More Time',
  80:'Four Score',81:'Stop and Run',82:'Straight On Through',83:'Time for Tea',
  84:'Seven Dozen',85:'Staying Alive',86:'Between the Sticks',87:'Torquay in Devon',
  88:'Two Fat Ladies',89:'Nearly There',90:'Top of the Shop',
};

const DIVIDEND_OPTIONS = [
  { value: 'early-five',         label: 'Early Five' },
  { value: 'top-line',           label: 'Top Line' },
  { value: 'middle-line',        label: 'Middle Line' },
  { value: 'bottom-line',        label: 'Bottom Line' },
  { value: 'corners',            label: 'Corners' },
  { value: 'full-house',         label: 'Full House' },
  { value: 'second-full-house',  label: '2nd Full House' },
  { value: 'third-full-house',   label: '3rd Full House' },
  { value: 'center',             label: 'Center (Laddu)' },
  { value: 'pyramid',            label: 'Pyramid' },
  { value: 'star',               label: 'Star' },
  { value: 'plus',               label: 'Plus' },
  { value: 'cross',              label: 'Cross' },
];

// ─── Inline Verifier ──────────────────────────────────────────────────────────

function InlineVerifier({ tambola }: { tambola: ReturnType<typeof useTambola> }) {
  const { sheets, currentGame, claimDividend } = tambola;
  const [open,       setOpen]       = useState(false);
  const [ticketId,   setTicketId]   = useState('');
  const [claimType,  setClaimType]  = useState('');
  const [result,     setResult]     = useState<{ valid: boolean; reason: string } | null>(null);
  const [claimName,  setClaimName]  = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimed,    setClaimed]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const calledNumbers = currentGame?.calledNumbers ?? [];
  const calledSet     = new Set(calledNumbers);

  // dividends available in this game session
  const dividendOptions = currentGame
    ? DIVIDEND_OPTIONS.filter(opt =>
        currentGame.dividends.some(d => d.type === opt.value)
      )
    : DIVIDEND_OPTIONS;

  const unclaimedTypes = new Set(
    currentGame?.dividends.filter(d => !d.claimed).map(d => d.type) ?? [],
  );

  const handleVerify = () => {
    setResult(null);
    setClaimed(false);
    setClaimName('');
    setClaimPhone('');
    if (!ticketId.trim() || !claimType) return;

    let ticket = null;
    for (const sheet of sheets) {
      const t = sheet.tickets.find(t => t.id === ticketId.trim());
      if (t) { ticket = t; break; }
    }
    if (!ticket) {
      setResult({ valid: false, reason: 'Ticket not found.' });
      return;
    }
    if (calledNumbers.length === 0) {
      setResult({ valid: false, reason: 'No numbers called yet.' });
      return;
    }
    const div = currentGame?.dividends.find(d => d.type === claimType);
    if (div?.claimed) {
      setResult({ valid: false, reason: `Already claimed by ${div.winner}.` });
      return;
    }
    const valid = verifyDividend(ticket, calledNumbers, claimType);
    setResult({
      valid,
      reason: valid
        ? `Valid! All required numbers for "${DIVIDEND_OPTIONS.find(o => o.value === claimType)?.label}" have been called.`
        : `Not valid — required numbers not all called yet.`,
    });
  };

  const handleClaim = async () => {
    if (!claimName.trim() || !currentGame) return;
    const div = currentGame.dividends.find(d => d.type === claimType);
    if (!div) return;
    await claimDividend(div.id, `${claimName.trim()}${claimPhone.trim() ? ` (${claimPhone.trim()})` : ''}`);
    setClaimed(true);
  };

  const reset = () => {
    setTicketId(''); setClaimType(''); setResult(null);
    setClaimName(''); setClaimPhone(''); setClaimed(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            Claim Verifier
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 pt-0">

          {/* Prizes status */}
          <div className="grid grid-cols-2 gap-1.5">
            {currentGame?.dividends.map(d => (
              <div
                key={d.id}
                className={cn(
                  'flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg',
                  d.claimed ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200',
                )}
              >
                <span className={d.claimed ? 'text-emerald-700 line-through' : 'text-slate-600'}>
                  {d.name}
                </span>
                {d.claimed
                  ? <span className="text-emerald-600 font-medium truncate max-w-[80px]" title={d.winner}>{d.winner}</span>
                  : <span className="text-slate-400">₹{d.prize}</span>
                }
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ticket ID</Label>
                <Input
                  ref={inputRef}
                  value={ticketId}
                  onChange={e => { setTicketId(e.target.value); setResult(null); setClaimed(false); }}
                  placeholder="SHEET-0001-01"
                  className="mt-1 text-xs h-8 font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                />
              </div>
              <div>
                <Label className="text-xs">Claim Type</Label>
                <select
                  value={claimType}
                  onChange={e => { setClaimType(e.target.value); setResult(null); setClaimed(false); }}
                  className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 h-8"
                >
                  <option value="">Select prize…</option>
                  {dividendOptions.map(opt => {
                    const isUnclaimed = unclaimedTypes.has(opt.value as DividendType);
                    return (
                      <option key={opt.value} value={opt.value} disabled={!isUnclaimed}>
                        {opt.label}{!isUnclaimed ? ' ✓ claimed' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <Button
              onClick={handleVerify}
              disabled={!ticketId.trim() || !claimType}
              size="sm"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Verify Claim
            </Button>

            {/* Result */}
            {result && !claimed && (
              <div className={cn(
                'rounded-lg p-3 flex items-start gap-2.5',
                result.valid ? 'bg-emerald-50 border border-emerald-300' : 'bg-red-50 border border-red-200',
              )}>
                {result.valid
                  ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  <p className={cn('text-xs font-semibold', result.valid ? 'text-emerald-800' : 'text-red-700')}>
                    {result.valid ? 'Valid Claim!' : 'Invalid Claim'}
                  </p>
                  <p className={cn('text-xs mt-0.5', result.valid ? 'text-emerald-700' : 'text-red-600')}>
                    {result.reason}
                  </p>
                  {result.valid && (
                    <div className="mt-2 space-y-1.5">
                      <Input
                        value={claimName}
                        onChange={e => setClaimName(e.target.value)}
                        placeholder="Winner name *"
                        className="h-7 text-xs"
                        onKeyDown={e => e.key === 'Enter' && handleClaim()}
                      />
                      <Input
                        value={claimPhone}
                        onChange={e => setClaimPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="h-7 text-xs"
                      />
                      <Button
                        onClick={handleClaim}
                        disabled={!claimName.trim()}
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                      >
                        Confirm Claim
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {claimed && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-center space-y-1">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-emerald-800">Claimed by {claimName}!</p>
                <Button onClick={reset} size="sm" variant="outline" className="text-xs h-6 mt-1">
                  Verify Another
                </Button>
              </div>
            )}

            {/* Ticket preview */}
            {ticketId.trim() && (() => {
              let ticket = null;
              for (const sheet of sheets) {
                const t = sheet.tickets.find(t => t.id === ticketId.trim());
                if (t) { ticket = t; break; }
              }
              if (!ticket) return null;
              return (
                <div className="border border-slate-100 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400 font-mono mb-1.5">{ticket.id}</p>
                  <div className="space-y-0.5">
                    {ticket.numbers.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-0.5">
                        {row.map((num, cIdx) => (
                          <div
                            key={cIdx}
                            className={cn(
                              'w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded border',
                              num === null
                                ? 'bg-slate-50 border-slate-100 text-transparent'
                                : calledSet.has(num)
                                ? 'bg-amber-100 border-amber-400 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-700',
                            )}
                          >
                            {num ?? ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Per-game inventory (setup screen) ────────────────────────────────────────

function GameInventory({ game, tambola }: { game: ScheduledGame; tambola: ReturnType<typeof useTambola> }) {
  const gameSheets = tambola.sheets.filter(s => game.sheetIds.includes(s.id));
  const sold       = gameSheets.filter(s => s.status === 'sold').length;
  const assigned   = gameSheets.filter(s => s.status === 'assigned').length;
  const available  = gameSheets.filter(s => s.status === 'available').length;
  const collection = gameSheets
    .filter(s => s.status === 'sold')
    .reduce((sum, s) => sum + (s.price ?? tambola.sheetPrice), 0);

  return (
    <div className="grid grid-cols-4 gap-2 mt-2 px-3 pb-3">
      {[
        { label: 'Total',     value: gameSheets.length, icon: Package,   color: 'text-slate-700' },
        { label: 'Sold',      value: sold,              icon: TrendingUp, color: 'text-emerald-600' },
        { label: 'Assigned',  value: assigned,          icon: Package,   color: 'text-blue-600' },
        { label: 'Available', value: available,         icon: Package,   color: 'text-slate-400' },
      ].map(s => (
        <div key={s.label} className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
          <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-slate-400">{s.label}</p>
        </div>
      ))}
      <div className="col-span-4 bg-emerald-50 rounded-lg px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
          <Banknote className="w-3 h-3" /> Collection
        </span>
        <span className="text-sm font-black text-emerald-700">₹{collection.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LiveGame({ tambola }: LiveGameProps) {
  const {
    currentGame, createGame, startGame, callNumber, endGame, resetGame,
    sheets, scheduleGame, scheduledGames, removeScheduledGame, rescheduleGame, linkScheduledGame,
  } = tambola;

  const [gameName,      setGameName]      = useState('');
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [rescheduleId,  setRescheduleId]  = useState<string | null>(null);
  const [rescheduleAt,  setRescheduleAt]  = useState('');
  const [soundEnabled,  setSoundEnabled]  = useState(true);
  const [showSetup,     setShowSetup]     = useState(!currentGame);
  const [manualNum,     setManualNum]     = useState('');
  const [callError,     setCallError]     = useState('');
  const [lastCalled,    setLastCalled]    = useState<number | null>(null);
  const numInputRef = useRef<HTMLInputElement>(null);

  const pendingScheduled = scheduledGames.filter(g => !g.sessionId);

  // ── Setup handlers ──────────────────────────────────────────────────────────

  const handleCreateGame = async () => {
    if (!gameName.trim()) return;
    await createGame(gameName.trim(), sheets.map(s => s.id));
    setShowSetup(false);
  };

  const handleLaunchScheduled = async (g: ScheduledGame) => {
    const dividends: Dividend[] = g.prizes.map((p, i) => ({
      id: `DIV-${Date.now()}-${i}`,
      type: p.type as DividendType,
      name: p.label,
      prize: p.amount,
      claimed: false,
    }));
    if (g.hasJackpot) dividends.push({
      id: `DIV-${Date.now()}-jp`, type: 'full-house',
      name: 'Jackpot', prize: g.jackpotAmount, claimed: false,
    });
    const game = await createGame(g.name, g.sheetIds, dividends);
    linkScheduledGame(g.id, game.id);
    setShowSetup(false);
  };

  // ── Manual number call ──────────────────────────────────────────────────────

  const handleCallNumber = async () => {
    const n = parseInt(manualNum, 10);
    if (isNaN(n) || n < 1 || n > 90) {
      setCallError('Enter a number between 1 and 90.');
      return;
    }
    if (currentGame?.calledNumbers.includes(n)) {
      setCallError(`${n} was already called.`);
      return;
    }
    setCallError('');
    setManualNum('');
    setLastCalled(n);
    await callNumber(n);
    if (soundEnabled) {
      const utt = new SpeechSynthesisUtterance(String(n));
      utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    }
    setTimeout(() => numInputRef.current?.focus(), 50);
  };

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (showSetup || !currentGame) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Radio className="w-6 h-6 text-red-500" /> Live Game Studio
          </h2>
          <p className="text-slate-500 mt-1">Set up and host your Tukpa game session.</p>
        </div>

        {/* Scheduled games */}
        {pendingScheduled.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="w-4 h-4 text-amber-500" /> Launch a Scheduled Game
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-2">
              {[...pendingScheduled]
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map(g => (
                  <div key={g.id} className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                    <div className="flex items-center gap-3 py-2.5 px-3">
                      {g.backgroundImage && (
                        <img src={g.backgroundImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(g.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          {' · '}₹{g.estimatedPrizePool.toLocaleString()} pool · {g.sheetIds.length} sheets
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {g.prizes.slice(0, 3).map(p => (
                            <span key={p.type} className="text-xs bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                              {p.label} {p.thingName ? `(${p.thingName})` : `₹${p.amount}`}
                            </span>
                          ))}
                          {g.hasJackpot && <span className="text-xs bg-yellow-100 border border-yellow-300 text-yellow-700 px-1.5 py-0.5 rounded-full">⭐ Jackpot</span>}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleLaunchScheduled(g)} className="bg-red-500 hover:bg-red-600 text-white gap-1.5 text-xs shrink-0">
                        <Play className="w-3 h-3" /> Launch
                      </Button>
                    </div>

                    {/* Per-game inventory */}
                    <GameInventory game={g} tambola={tambola} />

                    {/* Reschedule / Delete */}
                    {rescheduleId === g.id ? (
                      <div className="flex items-center gap-2 px-3 pb-3">
                        <input
                          type="datetime-local"
                          value={rescheduleAt}
                          onChange={e => setRescheduleAt(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <Button size="sm" onClick={async () => { if (rescheduleAt) { await rescheduleGame(g.id, new Date(rescheduleAt).toISOString()); setRescheduleId(null); setRescheduleAt(''); }}} disabled={!rescheduleAt} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setRescheduleId(null); setRescheduleAt(''); }} className="text-xs">Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 pb-2.5">
                        <button onClick={() => { setRescheduleId(g.id); setRescheduleAt(new Date(g.scheduledAt).toISOString().slice(0, 16)); }} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                          <Clock className="w-3 h-3" /> Reschedule
                        </button>
                        <button onClick={() => { if (window.confirm(`Delete "${g.name}"?`)) removeScheduledGame(g.id); }} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors">
                          <span>🗑</span> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Ad-hoc game */}
        <Card>
          <CardHeader>
            <CardTitle>{pendingScheduled.length > 0 ? 'Or Create Ad-hoc Game' : 'Create New Game'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="game-name">Game Name</Label>
              <Input id="game-name" value={gameName} onChange={e => setGameName(e.target.value)} placeholder="e.g., Sunday Evening Tukpa" className="mt-1" />
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Available Sheets</span>
              <span className="font-medium">{sheets.length}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateGame} disabled={!gameName.trim()} className="flex-1 bg-red-500 hover:bg-red-600 gap-2">
                <Play className="w-4 h-4" /> Start Live Now
              </Button>
              <Button variant="outline" onClick={() => setSchedDialogOpen(true)} className="gap-2 text-slate-600">
                <Calendar className="w-4 h-4" /> Schedule
              </Button>
            </div>
            <ScheduleGameDialog open={schedDialogOpen} onClose={() => setSchedDialogOpen(false)} defaultTicketPrice={tambola.sheetPrice} onSchedule={scheduleGame} />
          </CardContent>
        </Card>

        {/* Previously launched */}
        {scheduledGames.filter(g => g.sessionId).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-slate-400" /> Previously Launched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scheduledGames.filter(g => g.sessionId).map(g => (
                  <div key={g.id} className="flex items-center justify-between py-2 px-3 border border-slate-100 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{g.name}</p>
                      <p className="text-xs text-slate-400">{new Date(g.scheduledAt).toLocaleString()} · Launched</p>
                    </div>
                    <button onClick={() => removeScheduledGame(g.id)} className="text-slate-300 hover:text-red-400 text-xs ml-3">Remove</button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tambola.gameHistory.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Games</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tambola.gameHistory.slice(-3).reverse().map(game => (
                  <div key={game.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm font-medium">{game.name}</span>
                    <span className="text-xs text-slate-500">{new Date(game.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Active game ─────────────────────────────────────────────────────────────

  const isActive  = currentGame.status === 'active';
  const calledSet = new Set(currentGame.calledNumbers);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">{currentGame.name}</h2>
          <Badge variant={isActive ? 'destructive' : 'secondary'} className="gap-1">
            {isActive && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
            {currentGame.status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(v => !v)}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          {isActive ? (
            <Button variant="destructive" size="sm" onClick={() => { endGame(); setShowSetup(true); }}>
              End Game
            </Button>
          ) : (
            <div className="flex gap-2">
              {currentGame.status === 'setup' && (
                <Button className="bg-red-500 hover:bg-red-600 gap-2" onClick={startGame}>
                  <Play className="w-4 h-4" /> Start Game
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { resetGame(); setShowSetup(true); }}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Number board */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Number Board</span>
              <span className="text-slate-500 font-normal">{currentGame.calledNumbers.length}/90 called</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 90 }, (_, i) => i + 1).map(num => {
                const isCalled = calledSet.has(num);
                const isLast   = lastCalled === num;
                return (
                  <motion.div
                    key={num}
                    initial={isLast ? { scale: 0.5 } : false}
                    animate={{ scale: 1 }}
                    className={cn(
                      'aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all duration-300',
                      isLast
                        ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-300'
                        : isCalled
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {num}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Current number display */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-red-600 mb-2">Current Number</p>
              <AnimatePresence mode="wait">
                {lastCalled ? (
                  <motion.div
                    key={lastCalled}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <p className="text-6xl font-black text-red-600">{lastCalled}</p>
                    <p className="text-xs text-red-500 mt-2">{NUMBER_LINGO[lastCalled]}</p>
                  </motion.div>
                ) : (
                  <p className="text-4xl font-bold text-red-300">--</p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Manual number entry */}
          <Card className={cn(!isActive && 'opacity-60')}>
            <CardContent className="p-4 space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-widest">Call Number</Label>
              <div className="flex gap-2">
                <Input
                  ref={numInputRef}
                  type="number"
                  min={1}
                  max={90}
                  value={manualNum}
                  onChange={e => { setManualNum(e.target.value); setCallError(''); }}
                  onKeyDown={e => e.key === 'Enter' && isActive && handleCallNumber()}
                  placeholder="1 – 90"
                  disabled={!isActive}
                  className="text-center font-bold text-lg"
                />
                <Button
                  onClick={handleCallNumber}
                  disabled={!isActive || !manualNum.trim()}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 shrink-0"
                >
                  Call
                </Button>
              </div>
              {callError && <p className="text-xs text-red-500">{callError}</p>}
              {!isActive && currentGame.status === 'setup' && (
                <p className="text-xs text-slate-400 text-center">Start the game to call numbers.</p>
              )}
            </CardContent>
          </Card>

          {/* Called numbers history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Called Numbers ({currentGame.calledNumbers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {currentGame.calledNumbers.slice().reverse().map((num, idx) => (
                  <span
                    key={num}
                    className={cn(
                      'inline-flex items-center justify-center w-8 h-8 text-xs font-bold rounded',
                      idx === 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Prizes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Prizes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentGame.dividends.map(div => (
                  <div
                    key={div.id}
                    className={cn(
                      'flex items-center justify-between py-1.5 px-2 rounded text-sm',
                      div.claimed ? 'bg-emerald-50' : 'bg-slate-50',
                    )}
                  >
                    <span className={div.claimed ? 'text-emerald-700 line-through text-xs' : 'text-slate-700 text-xs'}>
                      {div.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">₹{div.prize}</span>
                      {div.claimed && div.winner && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5">
                          {div.winner}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inline verifier */}
      <InlineVerifier tambola={tambola} />
    </div>
  );
}

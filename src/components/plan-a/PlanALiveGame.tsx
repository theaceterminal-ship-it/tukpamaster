import { useState, useRef } from 'react';
import {
  Radio, Play, RotateCcw, Volume2, VolumeX, Trophy,
  ShieldCheck, CheckCircle, ChevronDown, ChevronUp,
  Loader2, ExternalLink, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { mktGetSheet } from '@/services/marketplaceApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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

type PlanAPrize = {
  id: string;
  name: string;
  amount: number;
  claimed: boolean;
  winner?: string;
};

type PlanAGameState = {
  id: string;
  name: string;
  status: 'active' | 'ended';
  calledNumbers: number[];
  prizes: PlanAPrize[];
  startedAt: number;
};

const GAME_KEY = 'tukpa-planA-game';

const PRIZE_DEFAULTS = [
  { name: 'Full House',        amount: 5000 },
  { name: 'Second Full House', amount: 3000 },
  { name: 'Upper Line',        amount: 1000 },
  { name: 'Middle Line',       amount: 1000 },
  { name: 'Bottom Line',       amount: 1000 },
  { name: 'Ticket Corners',    amount: 500  },
  { name: 'Early 5',           amount: 500  },
];

interface Props { apiKey: string; }

export function PlanALiveGame({ apiKey }: Props) {
  const [game, setGame] = useLocalStorage<PlanAGameState | null>(GAME_KEY, null);

  if (!game || game.status === 'ended') {
    return <SetupScreen onStart={setGame} prevGame={game} />;
  }
  return <ActiveGame game={game} setGame={setGame} apiKey={apiKey} />;
}

// ── Setup Screen ──────────────────────────────────────────────────────────────

function SetupScreen({
  onStart, prevGame,
}: {
  onStart: (g: PlanAGameState) => void;
  prevGame?: PlanAGameState | null;
}) {
  const [name, setName] = useState('');
  const [prizes, setPrizes] = useState(
    PRIZE_DEFAULTS.map((p, i) => ({ id: `p${i}`, ...p, checked: true }))
  );

  const handleStart = () => {
    if (!name.trim()) return;
    const game: PlanAGameState = {
      id: Date.now().toString(36),
      name: name.trim(),
      status: 'active',
      calledNumbers: [],
      prizes: prizes
        .filter(p => p.checked)
        .map(p => ({ id: p.id, name: p.name, amount: p.amount, claimed: false })),
      startedAt: Date.now(),
    };
    onStart(game);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Radio className="w-6 h-6 text-red-500" /> Live Game
        </h2>
        <p className="text-slate-500 mt-1 text-sm">Start a standalone tambola session.</p>
      </div>

      {prevGame && prevGame.status === 'ended' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          Previous game &quot;{prevGame.name}&quot; ended · {prevGame.calledNumbers.length} numbers called
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Game Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sunday Tambola"
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-2 block">Prizes</Label>
            <div className="space-y-2">
              {prizes.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPrizes(prev =>
                      prev.map((px, j) => j === i ? { ...px, checked: !px.checked } : px)
                    )}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      p.checked ? 'bg-sky-500 border-sky-500' : 'border-slate-300',
                    )}
                  >
                    {p.checked && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <span className={cn('text-sm w-36 shrink-0', p.checked ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                    {p.name}
                  </span>
                  {p.checked && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        value={p.amount}
                        onChange={e => setPrizes(prev =>
                          prev.map((px, j) => j === i ? { ...px, amount: Number(e.target.value) } : px)
                        )}
                        min={0}
                        className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={!name.trim() || !prizes.some(p => p.checked)}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold gap-2"
          >
            <Play className="w-4 h-4" /> Start Game
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Active Game ───────────────────────────────────────────────────────────────

function ActiveGame({
  game, setGame, apiKey,
}: {
  game: PlanAGameState;
  setGame: (g: PlanAGameState | null) => void;
  apiKey: string;
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualNum, setManualNum] = useState('');
  const [callError, setCallError] = useState('');
  const [lastCalled, setLastCalled] = useState<number | null>(
    game.calledNumbers[game.calledNumbers.length - 1] ?? null
  );
  const numInputRef = useRef<HTMLInputElement>(null);

  const calledSet = new Set(game.calledNumbers);

  const handleCallNumber = () => {
    const n = parseInt(manualNum, 10);
    if (isNaN(n) || n < 1 || n > 90) {
      setCallError('Enter a number between 1 and 90.');
      return;
    }
    if (calledSet.has(n)) {
      setCallError(`${n} was already called.`);
      return;
    }
    setCallError('');
    setManualNum('');
    setLastCalled(n);
    setGame({ ...game, calledNumbers: [...game.calledNumbers, n] });
    if (soundEnabled) {
      const utt = new SpeechSynthesisUtterance(String(n));
      utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    }
    setTimeout(() => numInputRef.current?.focus(), 50);
  };

  const handleEndGame = () => {
    if (!confirm('End this game?')) return;
    setGame({ ...game, status: 'ended' });
  };

  const handleReset = () => {
    if (!confirm('Reset all numbers and claims?')) return;
    setGame({
      ...game,
      calledNumbers: [],
      prizes: game.prizes.map(p => ({ ...p, claimed: false, winner: undefined })),
    });
    setLastCalled(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">{game.name}</h2>
          <Badge variant="destructive" className="gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(v => !v)}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} title="Reset numbers">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={handleEndGame}>
            End Game
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Number board */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Number Board</span>
              <span className="text-slate-500 font-normal">{game.calledNumbers.length}/90 called</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 90 }, (_, i) => i + 1).map(num => {
                const isCalled = calledSet.has(num);
                const isLast = lastCalled === num;
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
          {/* Current number */}
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

          {/* Call number */}
          <Card>
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
                  onKeyDown={e => e.key === 'Enter' && handleCallNumber()}
                  placeholder="1 – 90"
                  className="text-center font-bold text-lg"
                  autoFocus
                />
                <Button
                  onClick={handleCallNumber}
                  disabled={!manualNum.trim()}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 shrink-0"
                >
                  Call
                </Button>
              </div>
              {callError && <p className="text-xs text-red-500">{callError}</p>}
            </CardContent>
          </Card>

          {/* Called numbers history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Called ({game.calledNumbers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {game.calledNumbers.slice().reverse().map((num, idx) => (
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
                {game.prizes.map(prize => (
                  <div
                    key={prize.id}
                    className={cn(
                      'flex items-center justify-between py-1.5 px-2 rounded text-sm',
                      prize.claimed ? 'bg-emerald-50' : 'bg-slate-50',
                    )}
                  >
                    <span className={prize.claimed ? 'text-emerald-700 line-through text-xs' : 'text-slate-700 text-xs'}>
                      {prize.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">₹{prize.amount}</span>
                      {prize.claimed && prize.winner && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5">
                          {prize.winner}
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

      {/* Claim Recorder */}
      <ClaimRecorder game={game} setGame={setGame} apiKey={apiKey} />
    </div>
  );
}

// ── Claim Recorder ────────────────────────────────────────────────────────────

function ClaimRecorder({
  game, setGame, apiKey,
}: {
  game: PlanAGameState;
  setGame: (g: PlanAGameState) => void;
  apiKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [sheetNum, setSheetNum] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedPrize, setSelectedPrize] = useState('');
  const [winnerName, setWinnerName] = useState('');
  const [recorded, setRecorded] = useState(false);

  const unclaimed = game.prizes.filter(p => !p.claimed);

  const handleLookup = async () => {
    if (!sheetNum) return;
    setLookupLoading(true); setLookupError(''); setSheetUrl('');
    try {
      const { sheet } = await mktGetSheet(apiKey, Number(sheetNum));
      setSheetUrl(sheet.u);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Sheet not found in library');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRecord = () => {
    if (!selectedPrize || !winnerName.trim()) return;
    setGame({
      ...game,
      prizes: game.prizes.map(p =>
        p.id === selectedPrize ? { ...p, claimed: true, winner: winnerName.trim() } : p
      ),
    });
    setRecorded(true);
    setTimeout(() => {
      setRecorded(false);
      setSheetNum(''); setSheetUrl(''); setSelectedPrize(''); setWinnerName('');
      setLookupError('');
    }, 2000);
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOpen(v => !v)}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            Claim Recorder
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-normal">
              {unclaimed.length} prize{unclaimed.length !== 1 ? 's' : ''} remaining
            </span>
            {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0">
          {/* Prize status grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {game.prizes.map(p => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg',
                  p.claimed ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200',
                )}
              >
                <span className={p.claimed ? 'text-emerald-700 line-through' : 'text-slate-600'}>{p.name}</span>
                {p.claimed
                  ? <span className="text-emerald-600 font-medium truncate max-w-[80px]" title={p.winner}>{p.winner}</span>
                  : <span className="text-slate-400">₹{p.amount}</span>
                }
              </div>
            ))}
          </div>

          {recorded ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-emerald-800">Claim recorded!</p>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              {/* Sheet lookup */}
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Sheet Lookup (optional)
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    type="number"
                    value={sheetNum}
                    onChange={e => { setSheetNum(e.target.value); setSheetUrl(''); setLookupError(''); }}
                    placeholder="Sheet #"
                    className="text-sm h-8"
                    min={1}
                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLookup}
                    disabled={lookupLoading || !sheetNum}
                    className="h-8 gap-1.5 shrink-0"
                  >
                    {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
                  </Button>
                  {sheetNum && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setSheetNum(''); setSheetUrl(''); setLookupError(''); }}
                      className="h-8 px-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {lookupError && <p className="text-xs text-red-500 mt-1">{lookupError}</p>}
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-sky-600 hover:text-sky-800 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" /> Open Sheet PDF
                  </a>
                )}
              </div>

              {/* Record claim */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prize</Label>
                  <select
                    value={selectedPrize}
                    onChange={e => setSelectedPrize(e.target.value)}
                    className="mt-1.5 w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 h-8"
                  >
                    <option value="">Select prize…</option>
                    {unclaimed.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Winner Name</Label>
                  <Input
                    value={winnerName}
                    onChange={e => setWinnerName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="mt-1.5 h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && handleRecord()}
                  />
                </div>
              </div>
              <Button
                onClick={handleRecord}
                disabled={!selectedPrize || !winnerName.trim()}
                size="sm"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Record Claim
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

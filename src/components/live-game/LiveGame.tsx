import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Play, RotateCcw, Settings, Volume2, VolumeX, Zap, Trophy, ChevronRight, Calendar, Clock, Rocket } from 'lucide-react';
import { ScheduleGameDialog } from './ScheduleGameDialog';
import type { useTambola } from '@/hooks/useTambola';
import type { ScheduledGame, Dividend, DividendType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveGameProps {
  tambola: ReturnType<typeof useTambola>;
}

export function LiveGame({ tambola }: LiveGameProps) {
  const { currentGame, createGame, startGame, callNumber, endGame, resetGame, sheets, setCurrentPage, scheduleGame, scheduledGames, removeScheduledGame, rescheduleGame, linkScheduledGame } = tambola;
  const [gameName, setGameName] = useState('');
  const [autoCall, setAutoCall] = useState(false);
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [callInterval, setCallInterval] = useState(5);
  const [lastCalled, setLastCalled] = useState<number | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [showSetup, setShowSetup] = useState(!currentGame);
  const autoCallRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scheduled games not yet launched
  const pendingScheduled = scheduledGames.filter(g => !g.sessionId);

  const handleCreateGame = async () => {
    if (gameName.trim()) {
      const allSheetIds = sheets.map(s => s.id);
      await createGame(gameName.trim(), allSheetIds);
      setShowSetup(false);
    }
  };

  const handleLaunchScheduled = async (g: ScheduledGame) => {
    const dividends: Dividend[] = g.prizes.map((p, i) => ({
      id: `DIV-${Date.now()}-${i}`,
      type: p.type as DividendType,
      name: p.label,
      prize: p.amount,
      claimed: false,
    }));
    if (g.hasJackpot) {
      dividends.push({
        id: `DIV-${Date.now()}-jp`,
        type: 'full-house',
        name: 'Jackpot',
        prize: g.jackpotAmount,
        claimed: false,
      });
    }
    const game = await createGame(g.name, g.sheetIds, dividends);
    linkScheduledGame(g.id, game.id);
    setShowSetup(false);
  };

  const getNextNumber = useCallback(() => {
    if (!currentGame || currentGame.calledNumbers.length >= 90) return null;
    
    const available = Array.from({ length: 90 }, (_, i) => i + 1)
      .filter(n => !currentGame.calledNumbers.includes(n));
    
    if (available.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  }, [currentGame]);

  const handleCallNumber = useCallback(() => {
    if (isCalling || !currentGame) return;
    
    setIsCalling(true);
    const num = getNextNumber();
    
    if (num !== null) {
      setTimeout(() => {
        callNumber(num);
        setLastCalled(num);
        setIsCalling(false);
        
        if (soundEnabled) {
          playNumberSound(num);
        }
      }, 800);
    } else {
      setIsCalling(false);
    }
  }, [currentGame, getNextNumber, callNumber, soundEnabled, isCalling]);

  const playNumberSound = (num: number) => {
    const utterance = new SpeechSynthesisUtterance(String(num));
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Auto-call effect
  useEffect(() => {
    if (autoCall && currentGame?.status === 'active') {
      autoCallRef.current = setInterval(() => {
        const num = getNextNumber();
        if (num !== null) {
          callNumber(num);
          setLastCalled(num);
          if (soundEnabled) playNumberSound(num);
        }
      }, callInterval * 1000);
    }
    
    return () => {
      if (autoCallRef.current) {
        clearInterval(autoCallRef.current);
      }
    };
  }, [autoCall, currentGame?.status, callInterval, getNextNumber, callNumber, soundEnabled]);

  // Number lingo map
  const numberLingo: Record<number, string> = {
    1: 'One - Lone Ranger',
    2: 'Two - One Little Duck',
    3: 'Three - Cup of Tea',
    4: 'Four - Knock at the Door',
    5: 'Five - Man Alive',
    6: 'Six - Chopsticks',
    7: 'Seven - Lucky Seven',
    8: 'Eight - Garden Gate',
    9: 'Nine - Doctors Orders',
    10: 'Ten - Big Ben',
    11: 'Eleven - Legs Eleven',
    12: 'Twelve - One Dozen',
    13: 'Thirteen - Unlucky for Some',
    14: 'Fourteen - Valentines Day',
    15: 'Fifteen - Young and Keen',
    16: 'Sixteen - Sweet Sixteen',
    17: 'Seventeen - Dancing Queen',
    18: 'Eighteen - Coming of Age',
    19: 'Nineteen - Goodbye Teens',
    20: 'Twenty - One Score',
    21: 'Twenty One - Key of the Door',
    22: 'Twenty Two - Two Little Ducks',
    23: 'Twenty Three - Thee and Me',
    24: 'Twenty Four - Two Dozen',
    25: 'Twenty Five - Silver Jubilee',
    26: 'Twenty Six - Pick and Mix',
    27: 'Twenty Seven - Gateway to Heaven',
    28: 'Twenty Eight - Over Weight',
    29: 'Twenty Nine - Rise and Shine',
    30: 'Thirty - Dirty Gertie',
    31: 'Thirty One - Get Up and Run',
    32: 'Thirty Two - Buckle My Shoe',
    33: 'Thirty Three - All the Threes',
    34: 'Thirty Four - Ask for More',
    35: 'Thirty Five - Jump and Jive',
    36: 'Thirty Six - Three Dozen',
    37: 'Thirty Seven - More than Eleven',
    38: 'Thirty Eight - Christmas Cake',
    39: 'Thirty Nine - Steps',
    40: 'Forty - Naughty Forty',
    41: 'Forty One - Time for Fun',
    42: 'Forty Two - Winnie the Pooh',
    43: 'Forty Three - Down on Your Knees',
    44: 'Forty Four - Droopy Drawers',
    45: 'Forty Five - Halfway There',
    46: 'Forty Six - Up to Tricks',
    47: 'Forty Seven - Four and Seven',
    48: 'Forty Eight - Four Dozen',
    49: 'Forty Nine - PC',
    50: 'Fifty - Half a Century',
    51: 'Fifty One - Tweak of the Thumb',
    52: 'Fifty Two - Danny La Rue',
    53: 'Fifty Three - Here Comes Herbie',
    54: 'Fifty Four - Man at the Door',
    55: 'Fifty Five - Snakes Alive',
    56: 'Fifty Six - Was She Worth It',
    57: 'Fifty Seven - Heinz Varieties',
    58: 'Fifty Eight - Make Them Wait',
    59: 'Fifty Nine - Brighton Line',
    60: 'Sixty - Five Dozen',
    61: 'Sixty One - Bakers Bun',
    62: 'Sixty Two - Turn the Screw',
    63: 'Sixty Three - Tickle Me',
    64: 'Sixty Four - Red Raw',
    65: 'Sixty Five - Old Age Pension',
    66: 'Sixty Six - Clickety Click',
    67: 'Sixty Seven - Stairway to Heaven',
    68: 'Sixty Eight - Saving Grace',
    69: 'Sixty Nine - Either Way Up',
    70: 'Seventy - Three Score and Ten',
    71: 'Seventy One - Bang on the Drum',
    72: 'Seventy Two - Six Dozen',
    73: 'Seventy Three - Queen Bee',
    74: 'Seventy Four - Hit the Floor',
    75: 'Seventy Five - Strive and Strive',
    76: 'Seventy Six - Trombones',
    77: 'Seventy Seven - Two Little Crutches',
    78: 'Seventy Eight - Heavens Gate',
    79: 'Seventy Nine - One More Time',
    80: 'Eighty - Four Score',
    81: 'Eighty One - Stop and Run',
    82: 'Eighty Two - Straight On Through',
    83: 'Eighty Three - Time for Tea',
    84: 'Eighty Four - Seven Dozen',
    85: 'Eighty Five - Staying Alive',
    86: 'Eighty Six - Between the Sticks',
    87: 'Eighty Seven - Torquay in Devon',
    88: 'Eighty Eight - Two Fat Ladies',
    89: 'Eighty Nine - Nearly There',
    90: 'Ninety - Top of the Shop',
  };

  if (showSetup || !currentGame) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Radio className="w-6 h-6 text-red-500" />
            Live Game Studio
          </h2>
          <p className="text-slate-500 mt-1">Set up and host your Tukpa game session.</p>
        </div>

        {/* ── Launch a scheduled game ── */}
        {pendingScheduled.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="w-4 h-4 text-amber-500" /> Launch a Scheduled Game
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...pendingScheduled].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).map(g => (
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
                  {/* Reschedule / Delete bar */}
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
                      <button
                        onClick={() => { setRescheduleId(g.id); setRescheduleAt(new Date(g.scheduledAt).toISOString().slice(0, 16)); }}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Clock className="w-3 h-3" /> Reschedule
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete "${g.name}"? This cannot be undone.`)) removeScheduledGame(g.id); }}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <span>🗑</span> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Ad-hoc game ── */}
        <Card>
          <CardHeader>
            <CardTitle>{pendingScheduled.length > 0 ? 'Or Create Ad-hoc Game' : 'Create New Game'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="game-name">Game Name</Label>
              <Input
                id="game-name"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., Sunday Evening Tukpa"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Available Sheets</span>
              <span className="font-medium">{sheets.length}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Total Tickets</span>
              <span className="font-medium">{sheets.reduce((acc, s) => acc + s.tickets.length, 0)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateGame}
                disabled={!gameName.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 gap-2"
              >
                <Zap className="w-4 h-4" />
                Start Live Now
              </Button>
              <Button
                variant="outline"
                onClick={() => setSchedDialogOpen(true)}
                className="gap-2 text-slate-600"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </Button>
            </div>

            <ScheduleGameDialog
              open={schedDialogOpen}
              onClose={() => setSchedDialogOpen(false)}
              defaultTicketPrice={tambola.sheetPrice}
              onSchedule={scheduleGame}
            />
          </CardContent>
        </Card>

        {/* ── Already-launched scheduled games ── */}
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
                      <p className="text-xs text-slate-400">
                        {new Date(g.scheduledAt).toLocaleString()} · Launched
                      </p>
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
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
            </CardHeader>
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

  const isActive = currentGame.status === 'active';
  const calledSet = new Set(currentGame.calledNumbers);

  return (
    <div className="space-y-4">
      {/* Game Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">{currentGame.name}</h2>
          <Badge variant={isActive ? 'destructive' : 'secondary'} className="gap-1">
            {isActive && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
            {currentGame.status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Game Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Label>Auto Call</Label>
                  <Switch checked={autoCall} onCheckedChange={setAutoCall} />
                </div>
                {autoCall && (
                  <div>
                    <Label>Call Interval (seconds)</Label>
                    <Input 
                      type="number" 
                      value={callInterval} 
                      onChange={(e) => setCallInterval(Number(e.target.value))}
                      min={3}
                      max={30}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>Sound</Label>
                  <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {isActive ? (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                endGame();
                setShowSetup(true);
              }}
            >
              End Game
            </Button>
          ) : (
            <div className="flex gap-2">
              {currentGame.status === 'setup' && (
                <Button 
                  className="bg-red-500 hover:bg-red-600 gap-2"
                  onClick={() => {
                    startGame();
                  }}
                >
                  <Play className="w-4 h-4" />
                  Start Game
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  resetGame();
                  setShowSetup(true);
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Number Board */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Number Board</span>
              <span className="text-slate-500 font-normal">
                {currentGame.calledNumbers.length}/90 called
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                const isCalled = calledSet.has(num);
                const isLastCalled = lastCalled === num;
                
                return (
                  <motion.div
                    key={num}
                    initial={isLastCalled ? { scale: 0.5 } : false}
                    animate={{ scale: 1 }}
                    className={cn(
                      'aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all duration-300',
                      isLastCalled 
                        ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-300'
                        : isCalled
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    )}
                  >
                    {num}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Controls & Info */}
        <div className="space-y-4">
          {/* Current Number Display */}
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
                    <p className="text-xs text-red-500 mt-2">{numberLingo[lastCalled]}</p>
                  </motion.div>
                ) : (
                  <p className="text-4xl font-bold text-red-300">--</p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Call Button */}
          <Button
            onClick={handleCallNumber}
            disabled={!isActive || isCalling || currentGame.calledNumbers.length >= 90}
            className={cn(
              'w-full h-16 text-lg font-bold gap-2 transition-all',
              isActive 
                ? 'bg-red-500 hover:bg-red-600 shadow-lg hover:shadow-xl'
                : 'bg-slate-300'
            )}
          >
            {isCalling ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <Zap className="w-6 h-6" />
              </motion.div>
            ) : (
              <Zap className="w-6 h-6" />
            )}
            {isCalling ? 'Rolling...' : 'Call Next Number'}
          </Button>

          {/* Auto Call Toggle */}
          {isActive && (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium">Auto Call</span>
              <Switch checked={autoCall} onCheckedChange={setAutoCall} />
            </div>
          )}

          {/* Called Numbers History */}
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
                      idx === 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700'
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
                <Trophy className="w-4 h-4 text-amber-500" />
                Prizes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentGame.dividends.map((div) => (
                  <div 
                    key={div.id} 
                    className={cn(
                      'flex items-center justify-between py-1.5 px-2 rounded text-sm',
                      div.claimed ? 'bg-emerald-50' : 'bg-slate-50'
                    )}
                  >
                    <span className={div.claimed ? 'text-emerald-700 line-through' : 'text-slate-700'}>
                      {div.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Rs. {div.prize}</span>
                      {div.claimed && div.winner && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                          {div.winner}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Link to Verifier */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setCurrentPage('verifier')}
          >
            <ChevronRight className="w-4 h-4" />
            Go to Smart Verifier
          </Button>
        </div>
      </div>
    </div>
  );
}

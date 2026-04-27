import { useState } from 'react';
import { Trophy, Plus, DollarSign, CheckCircle } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import type { Dividend } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PrizeManagerProps {
  tambola: ReturnType<typeof useTambola>;
}

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

const DIVIDEND_TYPES = [
  { value: 'early-five',   label: 'Early Five' },
  { value: 'early-six',    label: 'Early Six' },
  { value: 'early-seven',  label: 'Early Seven' },
  { value: 'top-line',     label: 'Top Line' },
  { value: 'middle-line',  label: 'Middle Line' },
  { value: 'bottom-line',  label: 'Bottom Line' },
  { value: 'corners',      label: 'Corners' },
  { value: 'sheet-corner', label: 'Sheet Corner' },
  { value: 'full-house',   label: 'Full House' },
  { value: 'second-full-house', label: '2nd Full House' },
  { value: 'third-full-house',  label: '3rd Full House' },
  { value: 'center',       label: 'Center (Laddu)' },
  { value: 'pyramid',      label: 'Pyramid' },
  { value: 'star',         label: 'Star' },
  { value: 'plus',         label: 'Plus' },
  { value: 'cross',        label: 'Cross' },
];

export function PrizeManager({ tambola }: PrizeManagerProps) {
  const { currentGame, claimDividend } = tambola;
  const [isAddOpen,        setIsAddOpen]        = useState(false);
  const [isClaimOpen,      setIsClaimOpen]      = useState(false);
  const [selectedDividend, setSelectedDividend] = useState('');
  const [winnerName,       setWinnerName]       = useState('');
  const [newPrizeType,     setNewPrizeType]     = useState('');
  const [newPrizeAmount,   setNewPrizeAmount]   = useState('');
  const [customPrizes,     setCustomPrizes]     = useState<Dividend[]>([]);

  const allDividends = currentGame
    ? [...currentGame.dividends, ...customPrizes.filter(cp => !currentGame.dividends.some(d => d.type === cp.type))]
    : customPrizes;

  const handleClaim = () => {
    if (selectedDividend && winnerName.trim() && currentGame) {
      claimDividend(selectedDividend, winnerName.trim());
      setSelectedDividend(''); setWinnerName(''); setIsClaimOpen(false);
    }
  };

  const handleAddPrize = () => {
    if (newPrizeType && newPrizeAmount) {
      const newDividend: Dividend = {
        id: `DIV-CUSTOM-${Date.now()}`,
        type: newPrizeType as Dividend['type'],
        name: DIVIDEND_TYPES.find(d => d.value === newPrizeType)?.label || newPrizeType,
        prize: Number(newPrizeAmount),
        claimed: false,
      };
      setCustomPrizes(prev => [...prev, newDividend]);
      setNewPrizeType(''); setNewPrizeAmount(''); setIsAddOpen(false);
    }
  };

  const totalPrizePool  = allDividends.reduce((sum, d) => sum + d.prize, 0);
  const claimedPrizes   = allDividends.filter(d => d.claimed);
  const unclaimedPrizes = allDividends.filter(d => !d.claimed);

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-6 h-6" style={{ color: '#e8622a' }} />
            Prize Manager
          </h2>
          <p className="text-slate-500 mt-1">Configure prize categories, track winners, and manage payouts.</p>
        </div>
        <div className="flex gap-2">
          {currentGame && (
            <Dialog open={isClaimOpen} onOpenChange={setIsClaimOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CheckCircle className="w-4 h-4" /> Claim Prize
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Claim a Prize</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Select Prize</Label>
                    <Select value={selectedDividend} onValueChange={setSelectedDividend}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a prize category" /></SelectTrigger>
                      <SelectContent>
                        {currentGame.dividends.filter(d => !d.claimed).map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name} - ₹{d.prize}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Winner Name</Label>
                    <Input value={winnerName} onChange={e => setWinnerName(e.target.value)} placeholder="Enter winner's name" className="mt-1" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleClaim} className="font-bold text-white" style={{ backgroundColor: '#e8622a' }}>Confirm Claim</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold text-white" style={{ backgroundColor: '#e8622a' }}>
                <Plus className="w-4 h-4" /> Add Prize
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Custom Prize</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Prize Type</Label>
                  <Select value={newPrizeType} onValueChange={setNewPrizeType}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {DIVIDEND_TYPES.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prize Amount (₹)</Label>
                  <Input type="number" value={newPrizeAmount} onChange={e => setNewPrizeAmount(e.target.value)} placeholder="Enter amount" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAddPrize} className="font-bold text-white" style={{ backgroundColor: '#e8622a' }}>Add Prize</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { label: 'Total Prize Pool', value: `₹${totalPrizePool.toLocaleString()}`, icon: DollarSign, color: 'text-gray-900' },
          { label: 'Claimed',          value: claimedPrizes.length,                  icon: CheckCircle, color: 'text-emerald-600' },
          { label: 'Remaining',        value: unclaimedPrizes.length,                icon: Trophy,      color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={CARD}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
              <s.icon className="w-4 h-4" style={{ color: '#e8622a' }} />
            </div>
            <div>
              <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content: Prizes list + Winners side by side ── */}
      <div className="grid grid-cols-3 gap-4 w-full items-start">

        {/* Prizes list — 2 cols wide */}
        <div className="col-span-2 rounded-2xl p-5" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">All Prizes</p>
          {allDividends.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No prizes configured.</p>
              <p className="text-sm text-slate-400">Add prize categories for your game.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allDividends.map(dividend => (
                <div
                  key={dividend.id}
                  className={cn(
                    'flex items-center justify-between p-3.5 border rounded-xl',
                    dividend.claimed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', dividend.claimed ? 'bg-emerald-100' : 'bg-amber-100')}>
                      {dividend.claimed
                        ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                        : <Trophy className="w-4 h-4 text-amber-600" />
                      }
                    </div>
                    <div>
                      <p className={cn('font-medium text-sm', dividend.claimed && 'line-through text-slate-400')}>
                        {dividend.name}
                      </p>
                      {dividend.winner && <p className="text-xs text-emerald-600">Winner: {dividend.winner}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-base font-black tabular-nums', dividend.claimed ? 'text-emerald-600' : 'text-slate-800')}>
                      ₹{dividend.prize.toLocaleString()}
                    </span>
                    {dividend.claimed
                      ? <Badge className="bg-emerald-100 text-emerald-700 text-xs">Claimed</Badge>
                      : <Badge variant="secondary" className="text-xs">Open</Badge>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Winners summary — 1 col */}
        <div className="rounded-2xl p-5" style={CARD}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Winners</p>
          </div>
          {claimedPrizes.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No prizes claimed yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {claimedPrizes.map(prize => (
                <div key={prize.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-600">
                        {prize.winner?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-[120px]">{prize.winner}</p>
                      <p className="text-xs text-slate-400">{prize.name}</p>
                    </div>
                  </div>
                  <span className="font-black text-emerald-600 tabular-nums text-sm shrink-0">₹{prize.prize.toLocaleString()}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-400">Total paid out</span>
                <span className="font-black text-slate-800 tabular-nums">₹{claimedPrizes.reduce((s, p) => s + p.prize, 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

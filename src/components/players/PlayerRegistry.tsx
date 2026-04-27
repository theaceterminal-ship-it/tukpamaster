import { useState } from 'react';
import { UserCircle, Plus, Phone, Ticket, Search, Users, TrendingUp } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PlayerRegistryProps {
  tambola: ReturnType<typeof useTambola>;
}

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

export function PlayerRegistry({ tambola }: PlayerRegistryProps) {
  const [name,            setName]            = useState('');
  const [phone,           setPhone]           = useState('');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedPlayer,  setSelectedPlayer]  = useState('');
  const [selectedTicket,  setSelectedTicket]  = useState('');
  const [isAddOpen,       setIsAddOpen]       = useState(false);
  const [isAssignOpen,    setIsAssignOpen]    = useState(false);

  const handleAddPlayer = () => {
    if (name.trim() && phone.trim()) {
      tambola.addPlayer(name.trim(), phone.trim());
      setName(''); setPhone(''); setIsAddOpen(false);
    }
  };

  const handleAssignTicket = () => {
    if (selectedPlayer && selectedTicket) {
      tambola.assignTicketToPlayer(selectedPlayer, selectedTicket);
      setSelectedPlayer(''); setSelectedTicket(''); setIsAssignOpen(false);
    }
  };

  const unassignedTickets = tambola.sheets.flatMap(s =>
    s.tickets.filter(t => !tambola.players.some(p => p.ticketIds.includes(t.id)))
  );

  const filteredPlayers = tambola.players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const totalWinnings = tambola.players.reduce((s, p) => s + p.totalWinnings, 0);
  const totalTickets  = tambola.players.reduce((s, p) => s + p.ticketIds.length, 0);

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCircle className="w-6 h-6" style={{ color: '#0ea5e9' }} />
            Player Registry
          </h2>
          <p className="text-slate-500 mt-1">Register players, assign tickets, and track participation.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Ticket className="w-4 h-4" /> Assign Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Ticket to Player</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Select Player</Label>
                  <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a player" /></SelectTrigger>
                    <SelectContent>
                      {tambola.players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Select Ticket</Label>
                  <Select value={selectedTicket} onValueChange={setSelectedTicket}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a ticket" /></SelectTrigger>
                    <SelectContent>
                      {unassignedTickets.map(t => <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAssignTicket} className="font-bold text-white" style={{ backgroundColor: '#0ea5e9' }}>Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold text-white" style={{ backgroundColor: '#0ea5e9' }}>
                <Plus className="w-4 h-4" /> Add Player
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Player</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Player name" className="mt-1" />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAddPlayer} className="font-bold text-white" style={{ backgroundColor: '#0ea5e9' }}>Add Player</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Main: 2-column layout ── */}
      <div className="grid grid-cols-4 gap-4 w-full items-start">

        {/* ── Left sidebar: stats + search ── */}
        <div className="space-y-4">

          {/* Stats */}
          <div className="rounded-2xl p-5 space-y-3" style={CARD}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Overview</p>
            {[
              { label: 'Total Players', value: tambola.players.length,          icon: Users,     color: 'text-slate-800' },
              { label: 'Total Tickets', value: totalTickets,                    icon: Ticket,    color: 'text-blue-600' },
              { label: 'Total Winnings', value: `₹${totalWinnings.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', str: true },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: '#0ea5e9' }} />
                </div>
                <div>
                  <p className={`text-lg font-black tabular-nums ${s.color}`}>
                    {s.str ? s.value : (s.value as number).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Search</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Name or phone…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery && (
              <p className="text-xs text-slate-400 mt-2">{filteredPlayers.length} result{filteredPlayers.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* ── Right: players list (3 cols wide) ── */}
        <div className="col-span-3 rounded-2xl p-5" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            All Players ({filteredPlayers.length})
          </p>
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-14">
              <UserCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {tambola.players.length === 0 ? 'No players registered yet.' : 'No players match your search.'}
              </p>
              {tambola.players.length === 0 && <p className="text-sm text-slate-400 mt-1">Add your first player to get started.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlayers.map(player => (
                <div key={player.id} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-600">
                        {player.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{player.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{player.phone}</span>
                        <span className="flex items-center gap-1"><Ticket className="w-3 h-3" />{player.ticketIds.length} tickets</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right shrink-0">
                    <div>
                      <p className="text-sm font-black text-slate-800 tabular-nums">{player.totalGames}</p>
                      <p className="text-xs text-slate-400">Games</p>
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-600 tabular-nums">₹{player.totalWinnings.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Winnings</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

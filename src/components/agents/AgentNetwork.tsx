import { useState } from 'react';
import {
  Users, Plus, Phone, Trash2, Package, TrendingUp,
  Download, ExternalLink, ChevronRight,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import type { Agent } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { buildBulkPDF } from '@/lib/pdfRenderer';
import type { LayoutConfig } from '@/lib/pdfRenderer';

interface AgentNetworkProps {
  tambola: ReturnType<typeof useTambola>;
}

const DEFAULT_CONFIG: LayoutConfig = {
  template: 'compact',
  eventName: 'Silver Tambola Hub',
  showWatermark: false,
  watermarkText: '',
};

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.8) inset',
  border: '1px solid rgba(0,0,0,0.07)',
};

// ─── Add Agent Dialog ────────────────────────────────────────────────────────

function AddAgentDialog({ onAdd }: { onAdd: (name: string, phone: string, commission: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('10');

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) return;
    onAdd(name.trim(), phone.trim(), Number(commission));
    setName(''); setPhone(''); setCommission('10');
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2 font-bold text-white" style={{ backgroundColor: '#e8622a' }}>
        <Plus className="w-4 h-4" /> Add Agent
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Agent name" className="mt-1" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
            </div>
            <div>
              <Label>Commission (%)</Label>
              <Input type="number" value={commission} onChange={e => setCommission(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmit} className="font-bold text-white" style={{ backgroundColor: '#e8622a' }}>Add Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Assign Sheets Dialog ────────────────────────────────────────────────────

interface AssignDialogProps {
  agent: Agent;
  maxSheet: number;
  onAssign: (agentId: string, from: number, to: number) => number;
}

function AssignSheetsDialog({ agent, maxSheet, onAssign }: AssignDialogProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const fromN = parseInt(from) || 0;
  const toN   = parseInt(to)   || 0;
  const valid = fromN > 0 && toN >= fromN;

  const handleAssign = () => {
    if (!valid) return;
    const count = onAssign(agent.id, fromN, toN);
    setResult(count);
  };

  const handleClose = () => {
    setOpen(false);
    setFrom(''); setTo(''); setResult(null);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1 h-8 text-xs">
        <Package className="w-3 h-3" /> Assign Sheets
      </Button>
      <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Sheets to {agent.name}</DialogTitle>
          </DialogHeader>
          {result !== null ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">{result} sheets assigned</p>
              <p className="text-sm text-slate-500">SHEET-{String(fromN).padStart(4,'0')} → SHEET-{String(toN).padStart(4,'0')}</p>
              {result === 0 && <p className="text-xs text-amber-600">No available sheets found in that range.</p>}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-500">
                Enter a sheet number range. Only <span className="font-semibold text-slate-700">available</span> sheets in
                the range will be assigned. Max sheet: <span className="font-semibold">{maxSheet}</span>.
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs">From sheet #</Label>
                  <Input type="text" inputMode="numeric" value={from} onChange={e => setFrom(e.target.value.replace(/\D/g,''))} placeholder="1" className="mt-1" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">To sheet #</Label>
                  <Input type="text" inputMode="numeric" value={to} onChange={e => setTo(e.target.value.replace(/\D/g,''))} placeholder="500" className="mt-1" />
                </div>
              </div>
              {valid && (
                <p className="text-xs text-slate-500">
                  Range: SHEET-{String(fromN).padStart(4,'0')} to SHEET-{String(toN).padStart(4,'0')}
                  {' '}({toN - fromN + 1} max sheets)
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {result !== null ? 'Close' : 'Cancel'}
            </Button>
            {result === null && (
              <Button onClick={handleAssign} disabled={!valid} className="font-bold text-white" style={{ backgroundColor: '#e8622a' }}>
                Assign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AgentNetwork({ tambola }: AgentNetworkProps) {
  const maxSheet = tambola.sheets.length > 0
    ? Math.max(...tambola.sheets.map(s => parseInt(s.id.replace('SHEET-',''),10)))
    : 0;

  const downloadAgentSheets = (agent: Agent) => {
    const agentSheets = tambola.sheets.filter(s => s.assignedTo === agent.id);
    if (agentSheets.length === 0) return;
    const doc = buildBulkPDF(agentSheets, DEFAULT_CONFIG);
    doc.save(`agent-${agent.name.replace(/\s+/g,'-')}-sheets.pdf`);
  };

  const agentStats = (agent: Agent) => {
    const assigned = tambola.sheets.filter(s => s.assignedTo === agent.id);
    const sold      = assigned.filter(s => s.status === 'sold').length;
    const available = assigned.filter(s => s.status !== 'sold').length;
    const revenue   = assigned
      .filter(s => s.status === 'sold')
      .reduce((sum, s) => sum + (s.price ?? tambola.sheetPrice), 0);
    const commission = Math.round(revenue * agent.commission / 100);
    return { total: assigned.length, sold, available, revenue, commission };
  };

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6" style={{ color: '#e8622a' }} />
            Agent Network
          </h2>
          <p className="text-slate-500 mt-1">Manage agents, assign sheet ranges, track sales.</p>
        </div>
        <AddAgentDialog onAdd={tambola.addAgent} />
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { label: 'Total Agents',   value: tambola.agents.length,                                                      icon: Users },
          { label: 'Assigned',       value: tambola.sheets.filter(s => s.status === 'assigned').length,                 icon: Package },
          { label: 'Sold via Agent', value: tambola.sheets.filter(s => s.status === 'sold' && s.assignedTo).length,     icon: TrendingUp },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4 flex items-center gap-3" style={CARD}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(232,98,42,0.1)' }}>
              <c.icon className="w-4 h-4" style={{ color: '#e8622a' }} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Agents grid ── */}
      {tambola.agents.length === 0 ? (
        <div className="rounded-2xl p-14 text-center" style={CARD}>
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No agents yet. Add your first agent above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 w-full">
          {tambola.agents.map(agent => {
            const stats = agentStats(agent);
            const agentUrl = `${window.location.origin}/agent/${agent.id}`;
            return (
              <div key={agent.id} className="rounded-2xl p-5" style={CARD}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-blue-600">
                        {agent.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{agent.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</span>
                        <span>{agent.commission}% commission</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AssignSheetsDialog agent={agent} maxSheet={maxSheet} onAssign={tambola.assignSheetsByRange} />
                    <Button size="sm" variant="outline" onClick={() => downloadAgentSheets(agent)} disabled={stats.total === 0} className="gap-1 h-8 text-xs">
                      <Download className="w-3 h-3" /> PDF ({stats.total})
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(agentUrl, '_blank')} className="gap-1 h-8 text-xs">
                      <ExternalLink className="w-3 h-3" /> Portal
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => tambola.removeAgent(agent.id)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Assigned',   value: stats.total,      color: 'text-slate-700' },
                    { label: 'Available',  value: stats.available,  color: 'text-blue-600' },
                    { label: 'Sold',       value: stats.sold,       color: 'text-emerald-600' },
                    { label: 'Commission', value: `₹${stats.commission}`, color: 'text-amber-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-lg py-1.5 px-2">
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Agent portal link */}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate font-mono">{agentUrl}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(agentUrl)}
                    className="ml-auto text-blue-500 hover:underline whitespace-nowrap flex items-center gap-1 shrink-0"
                  >
                    Copy <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  Ticket, Plus, Download, Grid3x3, Trash2, ChevronLeft, ChevronRight,
  Eye, Search, X, Calendar, AlertTriangle, ChevronDown,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import type { Sheet, Agent, Player } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { jsPDF } from 'jspdf';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateType = 'classic' | 'compact';
type StatusFilter = 'all' | 'available' | 'assigned' | 'sold';

interface LayoutConfig {
  template:      TemplateType;
  eventName:     string;
  showWatermark: boolean;
  watermarkText: string;
}

interface SheetFactoryProps {
  tambola: ReturnType<typeof useTambola>;
}

// ─── Color palettes ──────────────────────────────────────────────────────────

const CLASSIC_COLORS: [number, number, number][] = [
  [21, 101, 192], [21, 101, 192], [21, 101, 192],
  [112, 48, 160], [192, 0, 0],   [215, 90, 0],
];

const COMPACT_COLORS: [number, number, number][] = [
  [219, 48, 130], [34, 139, 34], [34, 139, 34],
  [112, 48, 160], [192, 0, 0],   [200, 100, 0],
];

// ─── PDF helpers ─────────────────────────────────────────────────────────────

function drawGrid(
  doc: jsPDF, gridX: number, gridY: number,
  contentW: number, colW: number, rowH: number, gridH: number,
  r: number, g: number, b: number,
) {
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.55);
  doc.rect(gridX, gridY, contentW, gridH);
  for (let row = 1; row < 3; row++)
    doc.line(gridX, gridY + row * rowH, gridX + contentW, gridY + row * rowH);
  for (let col = 1; col < 9; col++)
    doc.line(gridX + col * colW, gridY, gridX + col * colW, gridY + gridH);
}

function drawNumbers(
  doc: jsPDF, ticket: Sheet['tickets'][0],
  gridX: number, gridY: number, colW: number, rowH: number, fontSize = 16,
) {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 9; col++) {
      const num = ticket.numbers[row][col];
      if (num !== null)
        doc.text(String(num), gridX + col * colW + colW / 2, gridY + row * rowH + rowH * 0.64, { align: 'center' });
    }
}

function renderClassicPDF(doc: jsPDF, sheet: Sheet, config: LayoutConfig) {
  const pageW = 210, mL = 12, cW = pageW - mL * 2;
  const colW = cW / 9, rowH = 10, gridH = 30, blockH = 43;
  const sheetNum = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
  const firstTicketNum = (sheetNum - 1) * 6 + 1;

  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text(config.eventName, pageW / 2, 14, { align: 'center' });
  let yPos = 22;
  for (let i = 0; i < sheet.tickets.length; i++) {
    const ticket = sheet.tickets[i];
    const [r, g, b] = CLASSIC_COLORS[i % 6];
    const ticketNum = String(firstTicketNum + i).padStart(3, '0');
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90);
    doc.text(ticketNum, mL + cW, yPos + 3.5, { align: 'right' });
    const gridY = yPos + 5;
    drawGrid(doc, mL, gridY, cW, colW, rowH, gridH, r, g, b);
    drawNumbers(doc, ticket, mL, gridY, colW, rowH, 16);
    const fY = gridY + gridH + 4.5;
    if (config.showWatermark && config.watermarkText) {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
      doc.text(config.watermarkText, mL, fY);
    }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text(config.eventName, pageW / 2, fY, { align: 'center' });
    yPos += blockH;
  }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text(`Sheet No. ${sheetNum}`, pageW / 2, 291, { align: 'center' });
}

function renderCompactPDF(doc: jsPDF, sheet: Sheet, config: LayoutConfig) {
  const pageW = 210, pageH = 297, sbW = 18;
  const cellW = 15, cellH = 13, gridW = 9 * cellW, gridH = 3 * cellH;
  const gL = sbW + (pageW - sbW - gridW) / 2, gCx = gL + gridW / 2;
  const blockH = 48, startY = 6;
  const sheetNum = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
  const firstTicketNum = (sheetNum - 1) * 6 + 1;

  const sbX = sbW / 2;
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text(`Sheet No. ${sheetNum}`, sbX, pageH / 2, { angle: 90, align: 'center' });
  let yPos = startY;
  for (let i = 0; i < sheet.tickets.length; i++) {
    const ticket = sheet.tickets[i];
    const [r, g, b] = COMPACT_COLORS[i % 6];
    const ticketNum = String(firstTicketNum + i).padStart(3, '0');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text(config.eventName, gCx, yPos + 5, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90);
    doc.text(ticketNum, gL + gridW, yPos + 5, { align: 'right' });
    const gridY = yPos + 7;
    drawGrid(doc, gL, gridY, gridW, cellW, cellH, gridH, r, g, b);
    drawNumbers(doc, ticket, gL, gridY, cellW, cellH, 18);
    yPos += blockH;
  }
}

// ─── Sheet row sub-component ──────────────────────────────────────────────────

interface SheetRowProps {
  sheet: Sheet;
  agent?: Agent;
  buyers: Player[];
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onExport: () => void;
  onPreview: () => void;
}

const STATUS_PILL: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  assigned:  'bg-blue-100 text-blue-700 hover:bg-blue-200',
  sold:      'bg-purple-100 text-purple-700 hover:bg-purple-200',
};

function SheetRow({ sheet, agent, buyers, isSelected, onToggle, onDelete, onExport, onPreview }: SheetRowProps) {
  const label = sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1);
  return (
    <div className={`flex items-center gap-3 py-2 px-1 rounded transition-colors ${isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
      <input type="checkbox" className="w-3.5 h-3.5 accent-amber-500 shrink-0" checked={isSelected} onChange={onToggle} />
      <span className="font-mono text-sm text-slate-700 w-24 shrink-0">{sheet.id}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${STATUS_PILL[sheet.status]}`}>
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" side="right">
          {sheet.status === 'available' && <p className="text-slate-500 text-xs">Not yet assigned to any agent.</p>}
          {sheet.status === 'assigned' && (
            agent ? (
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-800 text-sm">{agent.name}</p>
                <p className="text-slate-500 text-xs">{agent.phone}</p>
                <p className="text-xs text-blue-600 mt-1">Commission: {agent.commission}%</p>
              </div>
            ) : <p className="text-slate-500 text-xs">Agent data not found.</p>
          )}
          {sheet.status === 'sold' && (
            buyers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sold to</p>
                {buyers.map(b => (
                  <div key={b.id}>
                    <p className="font-semibold text-slate-800 text-sm">{b.name}</p>
                    <p className="text-slate-500 text-xs">{b.phone}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-xs">No buyer details on record.</p>
          )}
        </PopoverContent>
      </Popover>
      <span className="flex-1 text-sm text-slate-500 truncate">
        {sheet.status === 'assigned' && agent?.name}
        {sheet.status === 'sold' && buyers.map(b => b.name).join(', ')}
      </span>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={onPreview} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50">
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport} className="h-7 px-2 text-xs gap-1 text-slate-600">
          <Download className="w-3 h-3" />PDF
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 100;
const DEFAULT_EVENT_NAME = 'TukpaMaster';

export function SheetFactory({ tambola }: SheetFactoryProps) {
  const [selectedGameId,  setSelectedGameId]  = useState<string>('');
  const [sheetCountStr,   setSheetCountStr]   = useState('1');
  const [printGameName,   setPrintGameName]   = useState(true);
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('all');
  const [search,          setSearch]          = useState('');
  const [page,            setPage]            = useState(1);
  const [selected,        setSelected]        = useState<Set<string>>(new Set());
  const [previewUrl,      setPreviewUrl]      = useState<string | null>(null);
  const [previewId,       setPreviewId]       = useState('');

  const [config, setConfig] = useState<LayoutConfig>({
    template:      'compact',
    eventName:     DEFAULT_EVENT_NAME,
    showWatermark: false,
    watermarkText: '',
  });

  const updateConfig = (patch: Partial<LayoutConfig>) =>
    setConfig(prev => ({ ...prev, ...patch }));

  const switchTemplate = (t: TemplateType) =>
    updateConfig({ template: t });

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedGame = tambola.scheduledGames.find(g => g.id === selectedGameId);

  // Effective event name for PDF output
  const effectiveEventName = printGameName && selectedGame
    ? selectedGame.name
    : config.eventName;

  const effectiveConfig: LayoutConfig = { ...config, eventName: effectiveEventName };

  // Sheets scoped to selected game
  const gameSheets = useMemo(
    () => tambola.sheets.filter(s => s.scheduledGameId === selectedGameId),
    [tambola.sheets, selectedGameId],
  );

  // Orphan sheets (no game assigned) — for cleanup banner
  const orphanSheets = useMemo(
    () => tambola.sheets.filter(s => !s.scheduledGameId),
    [tambola.sheets],
  );

  const counts = {
    all:       gameSheets.length,
    available: gameSheets.filter(s => s.status === 'available').length,
    assigned:  gameSheets.filter(s => s.status === 'assigned').length,
    sold:      gameSheets.filter(s => s.status === 'sold').length,
  };

  const filteredSheets = useMemo(() => {
    const query = search.trim().replace(/^0+/, '');
    const base = gameSheets.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!query) return true;
      const num = s.id.replace('SHEET-', '').replace(/^0+/, '');
      return num.includes(query) || s.id.toLowerCase().includes(query.toLowerCase());
    });
    return [...base].reverse();
  }, [gameSheets, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSheets.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSheets = filteredSheets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageAllSel = pageSheets.length > 0 && pageSheets.every(s => selected.has(s.id));
  const sheetCount = parseInt(sheetCountStr) || 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits || digits === '0') setSheetCountStr('');
    else setSheetCountStr(String(Math.min(5000, parseInt(digits))));
  };

  const handleGenerate = () => {
    if (!sheetCount || !selectedGameId) return;
    tambola.generateSheetsForGame(selectedGameId, sheetCount);
    setStatusFilter('all');
    setPage(1);
  };

  const setFilter = (f: StatusFilter) => { setStatusFilter(f); setPage(1); };
  const handleSearch = (v: string)    => { setSearch(v); setPage(1); };

  const makeDoc = (sheet: Sheet) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    if (effectiveConfig.template === 'classic') renderClassicPDF(doc, sheet, effectiveConfig);
    else renderCompactPDF(doc, sheet, effectiveConfig);
    return doc;
  };

  const exportToPDF = (sheet: Sheet) => {
    const num = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
    makeDoc(sheet).save(`${num}.pdf`);
  };

  const openPreview = (sheet: Sheet) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(makeDoc(sheet).output('bloburl') as unknown as string);
    setPreviewId(sheet.id);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewId('');
  };

  const deleteSheet = (id: string) => {
    tambola.deleteSheetsById([id]);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const deleteSelected = () => {
    tambola.deleteSheetsById([...selected]);
    setSelected(new Set());
  };

  const deleteAllStatus = (status: Exclude<StatusFilter, 'all'>) => {
    if (!window.confirm(`Delete all ${status} sheets for this game (${counts[status]})? This cannot be undone.`)) return;
    const ids = gameSheets.filter(s => s.status === status).map(s => s.id);
    tambola.deleteSheetsById(ids);
    setSelected(new Set());
  };

  const cleanupOrphans = () => {
    if (!window.confirm(`Delete ${orphanSheets.length} orphan sheets (not linked to any game)? This cannot be undone.`)) return;
    tambola.deleteSheetsById(orphanSheets.map(s => s.id));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectPage = () => {
    const ids = pageSheets.map(s => s.id);
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allSel) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id));
      return n;
    });
  };

  // Reset selection when game changes
  const handleGameChange = (gid: string) => {
    setSelectedGameId(gid);
    setSelected(new Set());
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 w-full">

      {/* PDF preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={v => !v && closePreview()}>
        <DialogContent className="max-w-3xl w-[90vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="font-mono text-sm text-slate-700">{previewId} — Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="flex-1 w-full rounded-b-lg border-0" title="Sheet Preview" />}
        </DialogContent>
      </Dialog>

      {/* Page heading */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Grid3x3 className="w-6 h-6" style={{ color: '#0ea5e9' }} /> Sheet Factory
        </h2>
        <p className="text-slate-500 mt-1">Generate sheets for a scheduled game · 6 tickets per sheet · all 90 numbers covered</p>
      </div>

      {/* ── When no game is selected: just the selector ── */}
      {!selectedGame ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <Label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Select Game
              </Label>
              {tambola.scheduledGames.length === 0 ? (
                <div className="flex items-center gap-3 py-3 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500">
                  <Calendar className="w-4 h-4 text-slate-300 shrink-0" />
                  No scheduled games yet.
                  <button
                    onClick={() => tambola.setCurrentPage('live-game')}
                    className="ml-auto text-amber-600 font-semibold hover:text-amber-700 whitespace-nowrap"
                  >
                    Schedule one →
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedGameId}
                    onChange={e => handleGameChange(e.target.value)}
                    className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="">— Choose a game —</option>
                    {[...tambola.scheduledGames]
                      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} · {new Date(g.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {g.sheetIds.length} sheets
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Grid3x3 className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Select a game above to manage its sheets</p>
            <p className="text-xs text-slate-400">Sheets are always tied to a specific game</p>
          </div>
        </div>
      ) : (
        /* ── 2-COLUMN LAYOUT once game is selected ── */
        <div className="grid grid-cols-3 gap-4 w-full items-start">

          {/* ── LEFT: controls panel ── */}
          <div className="space-y-4">

            {/* Game selector */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <Label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Game
                </Label>
                <div className="relative">
                  <select
                    value={selectedGameId}
                    onChange={e => handleGameChange(e.target.value)}
                    className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2 pr-8 text-sm font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="">— Choose a game —</option>
                    {[...tambola.scheduledGames]
                      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} · {new Date(g.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Stats grid */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: 'Generated', value: counts.all,       color: 'text-slate-800' },
                    { label: 'Available', value: counts.available,  color: 'text-emerald-600' },
                    { label: 'Assigned',  value: counts.assigned,   color: 'text-blue-600' },
                    { label: 'Sold',      value: counts.sold,       color: 'text-purple-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-lg font-black text-amber-600 tabular-nums">₹{selectedGame.estimatedPrizePool.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Prize Pool</p>
                </div>
              </CardContent>
            </Card>

          {/* ── Settings + Generate ── */}
          <Card>
            <CardContent className="pt-4 space-y-4">

              {/* Row 1: template + print toggle + watermark */}
              <div className="flex flex-wrap items-end gap-3">

                {/* Template toggle */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Template</Label>
                  <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm font-medium">
                    {(['compact', 'classic'] as TemplateType[]).map((t, i) => (
                      <button
                        key={t}
                        onClick={() => switchTemplate(t)}
                        className={`px-4 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                          config.template === t ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print game name toggle */}
                <div className="flex items-center gap-2 pb-0.5">
                  <Switch id="game-name-print" checked={printGameName} onCheckedChange={setPrintGameName} />
                  <Label htmlFor="game-name-print" className="text-xs text-slate-600 cursor-pointer">
                    Print game name on sheet
                    {printGameName && selectedGame && (
                      <span className="ml-1.5 text-amber-600 font-semibold">"{selectedGame.name}"</span>
                    )}
                  </Label>
                </div>

                {/* Custom event name — only visible when game name print is OFF */}
                {!printGameName && (
                  <div className="flex-1 min-w-48">
                    <Label className="text-xs text-slate-500 mb-1.5 block">Custom Header Text</Label>
                    <Input
                      value={config.eventName}
                      onChange={e => updateConfig({ eventName: e.target.value })}
                      placeholder="e.g. TukpaMaster"
                    />
                  </div>
                )}

                {/* Watermark */}
                <div className="flex items-center gap-2 pb-0.5">
                  <Switch id="wm" checked={config.showWatermark} onCheckedChange={v => updateConfig({ showWatermark: v })} />
                  <Label htmlFor="wm" className="text-xs text-slate-600 cursor-pointer">Watermark</Label>
                  {config.showWatermark && (
                    <Input
                      value={config.watermarkText}
                      onChange={e => updateConfig({ watermarkText: e.target.value })}
                      placeholder="watermark text"
                      className="w-36 h-8 text-sm"
                    />
                  )}
                </div>
              </div>

              {/* Row 2: generate */}
              <div className="flex items-end gap-3 pt-3 border-t border-slate-100">
                <div className="w-40">
                  <Label className="text-xs text-slate-500 mb-1.5 block">Sheets to Generate</Label>
                  <Input
                    type="text" inputMode="numeric"
                    value={sheetCountStr}
                    onChange={handleCountChange}
                    placeholder="e.g. 500"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!sheetCount}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Generate {sheetCount > 0 ? `${sheetCount} ` : ''}
                  {sheetCount === 1 ? 'Sheet' : 'Sheets'}
                </Button>
                <p className="text-xs text-slate-400 pb-1">
                  Will be added to <span className="font-semibold text-slate-600">{selectedGame.name}</span>
                </p>
              </div>

            </CardContent>
          </Card>
          </div>

          <div className="col-span-2 space-y-3">

          {orphanSheets.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="flex-1 text-amber-800">
                <span className="font-semibold">{orphanSheets.length} orphan sheet{orphanSheets.length > 1 ? 's' : ''}</span> not linked to any game.
              </p>
              <button onClick={cleanupOrphans} className="text-amber-700 font-semibold hover:text-red-700 whitespace-nowrap">
                Clean up →
              </button>
            </div>
          )}

          {/* ── Sheets list ── */}
          <Card className="overflow-hidden">

            {/* Status filter tabs */}
            <CardHeader className="pb-0 px-0">
              <div className="flex items-center border-b border-slate-200 px-4">
                {(['all', 'available', 'assigned', 'sold'] as StatusFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`pb-3 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      statusFilter === f
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                      {counts[f]}
                    </span>
                  </button>
                ))}

                {/* Bulk actions */}
                <div className="ml-auto flex items-center gap-2 pb-2.5">
                  {selected.size > 0 && (
                    <>
                      <span className="text-xs text-slate-500">{selected.size} selected</span>
                      <Button size="sm" variant="destructive" onClick={deleteSelected} className="h-7 text-xs">
                        <Trash2 className="w-3 h-3 mr-1" /> Delete {selected.size}
                      </Button>
                    </>
                  )}
                  {selected.size === 0 && statusFilter !== 'all' && counts[statusFilter] > 0 && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deleteAllStatus(statusFilter as Exclude<StatusFilter, 'all'>)}
                      className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete all {statusFilter} ({counts[statusFilter]})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-3">
              {/* Search */}
              {gameSheets.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text" inputMode="numeric"
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search by sheet number…"
                    className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                  {search && (
                    <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {filteredSheets.length === 0 ? (
                <div className="text-center py-10">
                  <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {search
                      ? `No sheets matching "${search}".`
                      : statusFilter === 'all'
                      ? `No sheets generated for ${selectedGame.name} yet.`
                      : `No ${statusFilter} sheets for this game.`}
                  </p>
                  {!search && statusFilter === 'all' && (
                    <p className="text-sm text-slate-400 mt-1">Use the form above to generate sheets for this game.</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Column header */}
                  <div className="flex items-center gap-3 px-1 pb-2 text-xs text-slate-400 font-medium border-b border-slate-100">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-amber-500 shrink-0" checked={pageAllSel} onChange={toggleSelectPage} />
                    <span className="w-24 shrink-0">Sheet ID</span>
                    <span className="w-20 shrink-0">Status</span>
                    <span className="flex-1">Assigned To / Buyer</span>
                    <span className="w-28 text-right shrink-0">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {pageSheets.map(sheet => {
                      const agent  = tambola.agents.find(a => a.id === sheet.assignedTo);
                      const buyers = tambola.players.filter(p =>
                        p.ticketIds.some(tid => tid.startsWith(sheet.id + '-'))
                      );
                      return (
                        <SheetRow
                          key={sheet.id}
                          sheet={sheet}
                          agent={agent}
                          buyers={buyers}
                          isSelected={selected.has(sheet.id)}
                          onToggle={() => toggleSelect(sheet.id)}
                          onDelete={() => deleteSheet(sheet.id)}
                          onExport={() => exportToPDF(sheet)}
                          onPreview={() => openPreview(sheet)}
                        />
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredSheets.length)} of {filteredSheets.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        {(() => {
                          const nums: number[] = [];
                          if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) nums.push(i); }
                          else if (safePage <= 3) { nums.push(1, 2, 3, 4, 5); }
                          else if (safePage >= totalPages - 2) { for (let i = totalPages - 4; i <= totalPages; i++) nums.push(i); }
                          else { for (let i = safePage - 2; i <= safePage + 2; i++) nums.push(i); }
                          return nums.map(p => (
                            <Button key={p} size="sm" variant="outline" className={`h-7 w-7 p-0 text-xs ${safePage === p ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600' : ''}`} onClick={() => setPage(p)}>
                              {p}
                            </Button>
                          ));
                        })()}
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

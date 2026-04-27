import { jsPDF } from 'jspdf';
import type { Sheet } from '@/types';

export type TemplateType = 'classic' | 'compact';

export interface LayoutConfig {
  template: TemplateType;
  eventName: string;
  showWatermark: boolean;
  watermarkText: string;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  template: 'compact',
  eventName: 'Silver Tambola Hub',
  showWatermark: false,
  watermarkText: '',
};

const CLASSIC_COLORS: [number, number, number][] = [
  [21, 101, 192], [21, 101, 192], [21, 101, 192],
  [112,  48, 160], [192,   0,   0], [215,  90,   0],
];

const COMPACT_COLORS: [number, number, number][] = [
  [219,  48, 130], [ 34, 139,  34], [ 34, 139,  34],
  [112,  48, 160], [192,   0,   0], [200, 100,   0],
];

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
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      const num = ticket.numbers[row][col];
      if (num !== null)
        doc.text(String(num), gridX + col * colW + colW / 2, gridY + row * rowH + rowH * 0.64, { align: 'center' });
    }
  }
}

export function renderClassicSheet(doc: jsPDF, sheet: Sheet, config: LayoutConfig) {
  const pageW = 210, mL = 12;
  const cW = pageW - mL * 2, colW = cW / 9;
  const rowH = 10, gridH = 30, blockH = 43;
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

export function renderCompactSheet(doc: jsPDF, sheet: Sheet, config: LayoutConfig) {
  const pageW = 210, pageH = 297, sbW = 18;
  const cellW = 15, cellH = 13;
  const gridW = 9 * cellW, gridH = 3 * cellH;
  const gL = sbW + (pageW - sbW - gridW) / 2;
  const gCx = gL + gridW / 2;
  const blockH = 48, startY = 6;
  const sheetNum = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
  const firstTicketNum = (sheetNum - 1) * 6 + 1;

  // Sidebar strip with sheet number
  doc.setFillColor(243, 244, 246);
  doc.rect(0, 0, sbW, pageH, 'F');
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
  doc.text(`Sheet No. ${sheetNum}`, sbW / 2, pageH / 2, { angle: 90, align: 'center' });

  // Sheet number footer — always visible, horizontal
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text(`Sheet No. ${sheetNum}`, pageW / 2, pageH - 4, { align: 'center' });

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

export function buildSheetPDF(sheet: Sheet, config: LayoutConfig): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  if (config.template === 'classic') renderClassicSheet(doc, sheet, config);
  else renderCompactSheet(doc, sheet, config);
  return doc;
}

export function buildBulkPDF(sheets: Sheet[], config: LayoutConfig): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  sheets.forEach((sheet, i) => {
    if (i > 0) doc.addPage();
    if (config.template === 'classic') renderClassicSheet(doc, sheet, config);
    else renderCompactSheet(doc, sheet, config);
  });
  return doc;
}

// ─── Multi-up layout (replicates Ticket Printer grid logic) ──────────────────

// Classic style scaled to cell (ox, oy) — natural box: 186 × 270mm
function renderClassicSheetScaled(
  doc: jsPDF, sheet: Sheet, config: LayoutConfig,
  ox: number, oy: number, scale: number,
) {
  const sheetNum       = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
  const firstTicketNum = (sheetNum - 1) * 6 + 1;
  const cW             = 186 * scale;
  const colW           = cW / 9;
  const rowH           = 10 * scale;
  const gridH          = 30 * scale;
  const blockH         = 43 * scale;

  // Event name header
  doc.setFontSize(Math.max(4, 14 * scale));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(config.eventName, ox + cW / 2, oy + 6 * scale, { align: 'center' });

  let yPos = oy + 8 * scale;

  for (let i = 0; i < sheet.tickets.length; i++) {
    const [r, g, b] = CLASSIC_COLORS[i % 6];
    const ticketNum = String(firstTicketNum + i).padStart(3, '0');

    doc.setFontSize(Math.max(3, 7 * scale));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(ticketNum, ox + cW, yPos + 3.5 * scale, { align: 'right' });

    const gridY = yPos + 5 * scale;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(Math.max(0.08, 0.55 * scale));
    doc.rect(ox, gridY, cW, gridH);
    for (let row = 1; row < 3; row++)
      doc.line(ox, gridY + row * rowH, ox + cW, gridY + row * rowH);
    for (let col = 1; col < 9; col++)
      doc.line(ox + col * colW, gridY, ox + col * colW, gridY + gridH);

    doc.setFontSize(Math.max(4, 16 * scale));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const num = sheet.tickets[i].numbers[row][col];
        if (num !== null)
          doc.text(String(num), ox + col * colW + colW / 2, gridY + row * rowH + rowH * 0.64, { align: 'center' });
      }
    }

    yPos += blockH;
  }

  doc.setFontSize(Math.max(3, 8 * scale));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Sheet #${sheetNum}`, ox + cW / 2, yPos + 2 * scale, { align: 'center' });
}


function getGridConfig(n: number): { cols: number; rows: number; orientation: 'portrait' | 'landscape' } {
  switch (n) {
    case 1:  return { cols: 1, rows: 1, orientation: 'portrait'  };
    case 2:  return { cols: 2, rows: 1, orientation: 'landscape' };
    case 3:  return { cols: 3, rows: 1, orientation: 'landscape' };
    case 4:  return { cols: 4, rows: 1, orientation: 'landscape' };
    case 5:  return { cols: 5, rows: 1, orientation: 'landscape' };
    case 6:  return { cols: 3, rows: 2, orientation: 'landscape' };
    case 12: return { cols: 6, rows: 2, orientation: 'landscape' };
    default: {
      const cols = Math.ceil(Math.sqrt(n));
      return { cols, rows: Math.ceil(n / cols), orientation: 'landscape' };
    }
  }
}

// Renders one sheet scaled to fit inside a cell at (ox, oy) with given scale factor
function renderSheetScaled(
  doc: jsPDF, sheet: Sheet, config: LayoutConfig,
  ox: number, oy: number, scale: number,
) {
  const sheetNum       = parseInt(sheet.id.replace('SHEET-', ''), 10) || 1;
  const firstTicketNum = (sheetNum - 1) * 6 + 1;

  // Compact-style scaled layout — tight bounding box (no centering gap or page margins)
  const sbW    = 18 * scale;
  const cW     = 15 * scale;
  const rH     = 13 * scale;
  const gridW  = 9 * cW;
  const gridH  = 3 * rH;
  const gL     = ox + sbW;          // left-align grid against sidebar
  const headerH = 7 * scale;        // header row for sheet number
  const blockH = 48 * scale;
  let   yPos   = oy + headerH;

  // Sidebar background
  doc.setFillColor(243, 244, 246);
  doc.rect(ox, oy, sbW, headerH + 6 * blockH, 'F');

  // Sheet number — horizontal text in sidebar header area
  doc.setFontSize(Math.max(5, 11 * scale));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(`#${sheetNum}`, ox + sbW / 2, oy + headerH * 0.7, { align: 'center' });

  for (let i = 0; i < sheet.tickets.length; i++) {
    const ticket     = sheet.tickets[i];
    const [r, g, b]  = COMPACT_COLORS[i % 6];
    const ticketNum  = String(firstTicketNum + i).padStart(3, '0');
    const gCx        = gL + gridW / 2;

    // Event name (skip at very small scale to avoid clutter)
    if (scale > 0.28) {
      doc.setFontSize(Math.max(3, 11 * scale));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(config.eventName, gCx, yPos + 5 * scale, { align: 'center' });
    }

    // Ticket number
    doc.setFontSize(Math.max(3, 8 * scale));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(ticketNum, gL + gridW, yPos + 5 * scale, { align: 'right' });

    // Grid
    const gridY = yPos + 7 * scale;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(Math.max(0.08, 0.55 * scale));
    doc.rect(gL, gridY, gridW, gridH);
    for (let row = 1; row < 3; row++)
      doc.line(gL, gridY + row * rH, gL + gridW, gridY + row * rH);
    for (let col = 1; col < 9; col++)
      doc.line(gL + col * cW, gridY, gL + col * cW, gridY + gridH);

    // Numbers
    doc.setFontSize(Math.max(4, 16 * scale));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const num = ticket.numbers[row][col];
        if (num !== null)
          doc.text(String(num), gL + col * cW + cW / 2, gridY + row * rH + rH * 0.64, { align: 'center' });
      }
    }

    yPos += blockH;
  }
}

export function buildMultiUpPDF(sheets: Sheet[], sheetsPerPage: number, config: LayoutConfig): jsPDF {
  const { cols, rows, orientation } = getGridConfig(sheetsPerPage);
  const pageW  = orientation === 'landscape' ? 297 : 210;
  const pageH  = orientation === 'landscape' ? 210 : 297;
  const margin = sheetsPerPage <= 2 ? 5 : 3;
  const gap    = sheetsPerPage <= 2 ? 4 : 2;
  const cellW  = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH  = (pageH - margin * 2 - gap * (rows - 1)) / rows;

  // Natural content bounds: compact = sidebar(18)+grid(135) × 7mm header+6×48mm; classic = 186 × 270mm
  const isClassic = config.template === 'classic';
  const NATURAL_W = isClassic ? 186 : 153;
  const NATURAL_H = isClassic ? 270 : 295;
  const scale     = Math.min(cellW / NATURAL_W, cellH / NATURAL_H);
  const scaledW   = NATURAL_W * scale;
  const scaledH   = NATURAL_H * scale;

  const doc        = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  const totalPages = Math.ceil(sheets.length / sheetsPerPage);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();
    const batch = sheets.slice(pageIdx * sheetsPerPage, (pageIdx + 1) * sheetsPerPage);
    batch.forEach((sheet, pos) => {
      const col = pos % cols;
      const row = Math.floor(pos / cols);
      const ox  = margin + col * (cellW + gap) + (cellW - scaledW) / 2;
      const oy  = margin + row * (cellH + gap) + (cellH - scaledH) / 2;
      if (isClassic) renderClassicSheetScaled(doc, sheet, config, ox, oy, scale);
      else           renderSheetScaled(doc, sheet, config, ox, oy, scale);
    });
  }

  return doc;
}

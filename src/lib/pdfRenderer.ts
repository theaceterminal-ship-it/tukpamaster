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

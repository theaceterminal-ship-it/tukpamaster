import type { Ticket, Sheet } from '@/types';

// ─── Ticket lookup (Claim Verifier) ────────────────────────────────────────────
//
// The internal ticket id ("SHEET-0601-03") is never what a player reads off
// their actual ticket. SheetFactory's PDF prints a *global sequential* number
// per ticket instead — see renderClassicPDF/renderCompactPDF:
//   firstTicketNum = (sheetNum - 1) * 6 + 1;  ticketNum = firstTicketNum + i
// e.g. sheet 601's 3rd ticket prints "3603", nothing about "SHEET-0601-03".
// A bare number could also be the "Sheet No." printed at the sheet's edge,
// which is ambiguous on its own (a sheet has 6 different tickets). This tries,
// in order: the internal id verbatim, the printed global ticket number
// (unambiguous — resolves to exactly one ticket), then falls back to treating
// it as a bare sheet number and reports the ambiguity instead of a bare
// "not found" so the operator knows what to ask the player for next.

export type TicketLookup =
  | { status: 'found'; ticket: Ticket }
  | { status: 'ambiguous-sheet'; sheetLabel: string; ticketNums: number[] }
  | { status: 'not-found' };

export function findTicketByAnyId(sheets: Sheet[], rawInput: string): TicketLookup {
  const input = rawInput.trim();
  if (!input) return { status: 'not-found' };

  // 1. Exact internal id, as before (still works if someone has it memorized/logged).
  for (const sheet of sheets) {
    const t = sheet.tickets.find(t => t.id.toUpperCase() === input.toUpperCase());
    if (t) return { status: 'found', ticket: t };
  }

  const digits = input.replace(/\D/g, '');
  if (!digits) return { status: 'not-found' };
  const g = parseInt(digits, 10);
  if (!g || g < 1) return { status: 'not-found' };

  // 2. Printed global sequential ticket number: invert
  //    g = (sheetNum - 1) * 6 + position  =>  sheetNum = ceil(g/6), position = g - (sheetNum-1)*6
  const sheetNum = Math.ceil(g / 6);
  const position = g - (sheetNum - 1) * 6;
  const expectedId = `SHEET-${String(sheetNum).padStart(4, '0')}-${String(position).padStart(2, '0')}`;
  for (const sheet of sheets) {
    const t = sheet.tickets.find(t => t.id === expectedId);
    if (t) return { status: 'found', ticket: t };
  }

  // 3. Bare "Sheet No." — ambiguous (6 tickets/sheet), surface what to ask for.
  const sheetId = `SHEET-${digits.padStart(4, '0')}`;
  const matchedSheet = sheets.find(s => s.id === sheetId);
  if (matchedSheet) {
    const first = (g - 1) * 6 + 1;
    return {
      status: 'ambiguous-sheet',
      sheetLabel: String(g),
      ticketNums: matchedSheet.tickets.map((_, i) => first + i),
    };
  }

  return { status: 'not-found' };
}

// Column ranges: col 0 = 1-9, col 1 = 10-19, ..., col 8 = 80-90
const COL_RANGES: [number, number][] = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
  [50, 59], [60, 69], [70, 79], [80, 90]
];

// Numbers in each column range
const COL_COUNTS = COL_RANGES.map(([min, max]) => max - min + 1);
// = [9, 10, 10, 10, 10, 10, 10, 10, 11]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a 6×9 distribution matrix where:
//   - Each entry is 1 or 2 (numbers from that column for that ticket)
//   - Column j sums to COL_COUNTS[j]   (all numbers used)
//   - Every row sums to 15             (each ticket has 15 numbers)
//
// Strategy: start every cell at 1 (base), then greedily assign "extras"
// (COL_COUNTS[col]-6 per column) by processing columns largest-first
// and assigning each column's extras to the tickets with the most remaining need.
// This always succeeds in one pass with no retries.
function buildDistribution(): number[][] {
  const colExtras = COL_COUNTS.map(c => c - 6); // [3,4,4,4,4,4,4,4,5]
  const need = new Array(6).fill(6);            // extras still needed per ticket
  const assigned = Array.from({ length: 6 }, () => new Array(9).fill(0));

  // Process columns in descending-extras order (handles scarce columns first)
  const colOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8])
    .sort((a, b) => colExtras[b] - colExtras[a]);

  for (const col of colOrder) {
    const n = colExtras[col];
    // Assign this column's extras to the n tickets with highest remaining need
    const eligible = shuffle([0, 1, 2, 3, 4, 5])
      .filter(t => need[t] > 0)
      .sort((a, b) => need[b] - need[a]);
    for (let i = 0; i < n; i++) {
      assigned[eligible[i]][col] = 1;
      need[eligible[i]]--;
    }
  }

  // Base 1 + extras → each entry is 1 or 2
  return Array.from({ length: 6 }, (_, t) => assigned[t].map(e => 1 + e));
}

// Generate a valid tambola sheet (6 tickets, all 90 numbers used exactly once).
// Each ticket: 3 rows × 9 columns, each row has exactly 5 filled cells,
// numbers in each column are in ascending order top-to-bottom.
export function generateSheet(sheetId: string): Sheet {
  // 1. Build a valid distribution matrix (always succeeds in one pass)
  const dist = buildDistribution();

  // 2. For each column, shuffle its numbers and assign to tickets per dist
  //    colNums[col][ticket] = sorted array of numbers for that ticket/column
  const colNums: number[][][] = [];
  for (let col = 0; col < 9; col++) {
    const [min, max] = COL_RANGES[col];
    const all = shuffle(Array.from({ length: max - min + 1 }, (_, i) => min + i));
    const perTicket: number[][] = [];
    let idx = 0;
    for (let t = 0; t < 6; t++) {
      const count = dist[t][col];
      perTicket.push(all.slice(idx, idx + count).sort((a, b) => a - b));
      idx += count;
    }
    colNums.push(perTicket);
  }

  // 3. Arrange each ticket's numbers into a 3×9 grid with 5 per row.
  //
  //    Because every ticket has exactly 6 "double" columns (count=2) and
  //    3 "single" columns (count=1), we can guarantee 5 per row by:
  //      - Assigning row-pairs {0,1},{0,2},{1,2} to doubles (2 of each)
  //        → each row gets exactly 4 double-column cells
  //      - Assigning one single column to each row
  //        → each row gets exactly 1 single-column cell
  //      Total per row: 4 + 1 = 5 ✓
  //
  //    Numbers within each column appear in ascending order (smaller num → lower row index).
  const tickets: Ticket[] = [];

  for (let t = 0; t < 6; t++) {
    const grid: (number | null)[][] = [
      new Array(9).fill(null),
      new Array(9).fill(null),
      new Array(9).fill(null),
    ];

    const doubles: number[] = [];
    const singles: number[] = [];
    for (let col = 0; col < 9; col++) {
      (dist[t][col] === 2 ? doubles : singles).push(col);
    }

    // Shuffle the fixed row-pair template and apply to shuffled double columns
    const pairTemplate: [number, number][] = [[0, 1], [0, 1], [0, 2], [0, 2], [1, 2], [1, 2]];
    const pairs = shuffle(pairTemplate) as [number, number][];
    const dblCols = shuffle(doubles);
    for (let i = 0; i < 6; i++) {
      const col = dblCols[i];
      const [r0, r1] = pairs[i];
      grid[r0][col] = colNums[col][t][0]; // smaller → upper row
      grid[r1][col] = colNums[col][t][1]; // larger  → lower row
    }

    // Each single column goes to a distinct row (one per row)
    const sglCols = shuffle(singles);
    for (let i = 0; i < 3; i++) {
      grid[i][sglCols[i]] = colNums[sglCols[i]][t][0];
    }

    tickets.push({
      id: `${sheetId}-${String(t + 1).padStart(2, '0')}`,
      sheetId,
      numbers: grid,
      markedNumbers: new Set(),
    });
  }

  return {
    id: sheetId,
    tickets,
    createdAt: new Date().toISOString(),
    status: 'available',
  };
}

// Generate multiple sheets
export function generateSheets(count: number, startId: number = 1): Sheet[] {
  const sheets: Sheet[] = [];
  for (let i = 0; i < count; i++) {
    const sheetId = `SHEET-${String(startId + i).padStart(4, '0')}`;
    sheets.push(generateSheet(sheetId));
  }
  return sheets;
}

// Verify if a ticket has a specific dividend
export function verifyDividend(
  ticket: Ticket,
  calledNumbers: number[],
  dividendType: string
): boolean {
  const calledSet = new Set(calledNumbers);
  const grid = ticket.numbers;

  switch (dividendType) {
    case 'early-five': {
      let count = 0;
      for (const row of grid) for (const num of row) if (num !== null && calledSet.has(num)) count++;
      return count >= 5;
    }
    case 'top-line': {
      const nums = grid[0].filter((n): n is number => n !== null);
      return nums.every(n => calledSet.has(n));
    }
    case 'middle-line': {
      const nums = grid[1].filter((n): n is number => n !== null);
      return nums.every(n => calledSet.has(n));
    }
    case 'bottom-line': {
      const nums = grid[2].filter((n): n is number => n !== null);
      return nums.every(n => calledSet.has(n));
    }
    case 'corners': {
      const topRow = grid[0].filter((n): n is number => n !== null);
      const botRow = grid[2].filter((n): n is number => n !== null);
      if (topRow.length < 2 || botRow.length < 2) return false;
      const corners = [topRow[0], topRow[topRow.length - 1], botRow[0], botRow[botRow.length - 1]];
      return corners.every(n => calledSet.has(n));
    }
    case 'full-house': {
      for (const row of grid) for (const num of row) if (num !== null && !calledSet.has(num)) return false;
      return true;
    }
    case 'center': {
      const center = grid[1][4];
      return center !== null && calledSet.has(center);
    }
    case 'pyramid': {
      const pyramidNums = [
        getNthNumber(grid[0], 3),
        getNthNumber(grid[1], 2), getNthNumber(grid[1], 4),
        getNthNumber(grid[2], 1), getNthNumber(grid[2], 3), getNthNumber(grid[2], 5),
      ];
      return pyramidNums.every(n => n !== null && calledSet.has(n));
    }
    case 'star': {
      const topNums = grid[0].filter((n): n is number => n !== null);
      const midNums = grid[1].filter((n): n is number => n !== null);
      const botNums = grid[2].filter((n): n is number => n !== null);
      const starNums = [topNums[0], topNums[2], topNums[4], ...midNums, botNums[0], botNums[2], botNums[4]];
      return starNums.every(n => n !== null && calledSet.has(n));
    }
    case 'plus': {
      const plusNums = [
        getNthNumber(grid[0], 3),
        getNthNumber(grid[1], 2), getNthNumber(grid[1], 3), getNthNumber(grid[1], 4),
        getNthNumber(grid[2], 3),
      ];
      return plusNums.every(n => n !== null && calledSet.has(n));
    }
    case 'cross': {
      const topNums = grid[0].filter((n): n is number => n !== null);
      const botNums = grid[2].filter((n): n is number => n !== null);
      const crossNums = [topNums[0], topNums[4], getNthNumber(grid[1], 3), botNums[0], botNums[4]];
      return crossNums.every(n => n !== null && calledSet.has(n));
    }
    default:
      return false;
  }
}

function getNthNumber(row: (number | null)[], n: number): number | null {
  const nums = row.filter((x): x is number => x !== null);
  return nums[n - 1] ?? null;
}

export function getAllValidDividends(ticket: Ticket, calledNumbers: number[]): string[] {
  const types = [
    'early-five', 'top-line', 'middle-line', 'bottom-line',
    'corners', 'full-house', 'center', 'pyramid', 'star', 'plus', 'cross',
  ];
  return types.filter(type => verifyDividend(ticket, calledNumbers, type));
}

export function formatTicketId(id: string): string {
  return id;
}

export function sheetToText(sheet: Sheet): string {
  let text = `🎲 TUKPA TAMBOLA - Sheet ${sheet.id}\n`;
  text += `${'='.repeat(40)}\n\n`;
  for (const ticket of sheet.tickets) {
    text += `Ticket: ${ticket.id}\n${'-'.repeat(30)}\n`;
    for (const row of ticket.numbers) {
      text += row.map(n => (n === null ? '  .' : String(n).padStart(3))).join(' ') + '\n';
    }
    text += '\n';
  }
  return text;
}

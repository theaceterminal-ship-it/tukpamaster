// Tukpa/Tambola Game Types

export interface Ticket {
  id: string;
  sheetId: string;
  numbers: (number | null)[][];
  markedNumbers: Set<number>;
}

export interface Sheet {
  id: string;
  tickets: Ticket[];
  createdAt: string;
  assignedTo?: string;
  status: 'available' | 'assigned' | 'sold';
  price?: number;
  orderId?: string;
  scheduledGameId?: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  gmail?: string;
  password: string;
  commission: number;
  sheetsAssigned: string[];
  totalSales: number;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  phone: string;
  ticketIds: string[];
  totalGames: number;
  totalWinnings: number;
  createdAt: string;
}

export interface Order {
  id: string;
  playerName: string;
  phone: string;
  sheetIds: string[];
  amount: number;
  utr?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  confirmedAt?: string;
}

export interface UpiSettings {
  upiId: string;
  merchantName: string;
  whatsappNumber?: string;
}

export type DividendType =
  | 'early-five' | 'early-six' | 'early-seven'
  | 'top-line' | 'middle-line' | 'bottom-line'
  | 'corners' | 'sheet-corner'
  | 'full-house' | 'second-full-house' | 'third-full-house'
  | 'center' | 'pyramid' | 'star' | 'plus' | 'cross';

export interface Dividend {
  id: string;
  type: DividendType;
  name: string;
  prize: number;
  winner?: string;
  claimed: boolean;
  claimedAt?: string;
}

export interface GameSession {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'paused' | 'completed';
  calledNumbers: number[];
  currentNumber: number | null;
  dividends: Dividend[];
  players: string[];
  startTime?: string;
  endTime?: string;
  sheetIds: string[];
  totalPrizePool: number;
  pricePerSheet?: number;
  scheduledAt?: string;
}

export interface GameHistory {
  id: string;
  date: string;
  name: string;
  totalPlayers: number;
  calledNumbersCount: number;
  winners: Winner[];
  totalPrizeDistributed: number;
  duration: number;
}

export interface Winner {
  id: string;
  playerName: string;
  ticketId: string;
  dividendName: string;
  prize: number;
  claimedAt: string;
}

export interface ScheduledGamePrize {
  type: string;
  label: string;
  amount: number;
  thingName?: string;
  thingPhoto?: string;
}

export interface ScheduledGame {
  id: string;
  name: string;
  scheduledAt: string;
  backgroundImage?: string;
  prizes: ScheduledGamePrize[];
  hasJackpot: boolean;
  jackpotAmount: number;
  jackpotThingName?: string;
  jackpotThingPhoto?: string;
  sheetIds: string[];
  ticketPrice: number;
  estimatedPrizePool: number;
  sessionId?: string;
}

export type AppPage =
  | 'dashboard' | 'sheets' | 'agents' | 'players'
  | 'live-game' | 'verifier' | 'prizes' | 'history'
  | 'marketplace' | 'pending-payments' | 'settings';

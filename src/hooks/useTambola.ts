import { useLocalStorage } from './useLocalStorage';
import { generateSheet, verifyDividend } from '@/lib/tambola';
import type {
  Sheet, Agent, Player, GameSession, GameHistory,
  Winner, Dividend, AppPage, Order, UpiSettings, ScheduledGame, ScheduledGamePrize,
} from '@/types';
import { useCallback } from 'react';

const DEFAULT_DIVIDENDS: Omit<Dividend, 'id'>[] = [
  { type: 'early-five',   name: 'Early Five',   prize: 100,  claimed: false },
  { type: 'top-line',     name: 'Top Line',      prize: 200,  claimed: false },
  { type: 'middle-line',  name: 'Middle Line',   prize: 200,  claimed: false },
  { type: 'bottom-line',  name: 'Bottom Line',   prize: 200,  claimed: false },
  { type: 'corners',      name: 'Corners',       prize: 300,  claimed: false },
  { type: 'full-house',   name: 'Full House',    prize: 1000, claimed: false },
];

export function useTambola() {
  const [sheets,       setSheets]       = useLocalStorage<Sheet[]>('tukpa-sheets', []);
  const [agents,       setAgents]       = useLocalStorage<Agent[]>('tukpa-agents', []);
  const [players,      setPlayers]      = useLocalStorage<Player[]>('tukpa-players', []);
  const [orders,       setOrders]       = useLocalStorage<Order[]>('tukpa-orders', []);
  const [currentGame,  setCurrentGame]  = useLocalStorage<GameSession | null>('tukpa-current-game', null);
  const [gameHistory,  setGameHistory]  = useLocalStorage<GameHistory[]>('tukpa-history', []);
  const [currentPage,  setCurrentPage]  = useLocalStorage<AppPage>('tukpa-page', 'dashboard');
  const [sheetPrice,      setSheetPrice]      = useLocalStorage<number>('tukpa-sheet-price', 50);
  const [upiSettings,     setUpiSettings]     = useLocalStorage<UpiSettings>('tukpa-upi-settings', { upiId: '', merchantName: '' });
  const [scheduledGames,  setScheduledGames]  = useLocalStorage<ScheduledGame[]>('tukpa-scheduled', []);

  // ── Sheet generation ───────────────────────────────────────────────────────

  const generateSingleSheet = useCallback(() => {
    const id = sheets.length + 1;
    const sheet = generateSheet(`SHEET-${String(id).padStart(4, '0')}`);
    const priced = { ...sheet, price: sheetPrice };
    setSheets(prev => [...prev, priced]);
    return priced;
  }, [sheets.length, setSheets, sheetPrice]);

  const generateMultipleSheets = useCallback((count: number) => {
    const startId = sheets.length + 1;
    const newSheets: Sheet[] = [];
    for (let i = 0; i < count; i++) {
      const sheet = generateSheet(`SHEET-${String(startId + i).padStart(4, '0')}`);
      newSheets.push({ ...sheet, price: sheetPrice });
    }
    setSheets(prev => [...prev, ...newSheets]);
    return newSheets;
  }, [sheets.length, setSheets, sheetPrice]);

  const generateSheetsForGame = useCallback((gameId: string, count: number) => {
    const startId = sheets.length + 1;
    const newSheets: Sheet[] = [];
    for (let i = 0; i < count; i++) {
      const sheet = generateSheet(`SHEET-${String(startId + i).padStart(4, '0')}`);
      newSheets.push({ ...sheet, price: sheetPrice, scheduledGameId: gameId });
    }
    const newIds = newSheets.map(s => s.id);
    setSheets(prev => [...prev, ...newSheets]);
    setScheduledGames(prev => prev.map(g =>
      g.id === gameId ? { ...g, sheetIds: [...g.sheetIds, ...newIds] } : g
    ));
    return newSheets;
  }, [sheets.length, setSheets, sheetPrice, setScheduledGames]);

  const deleteSheetsById = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const toRemove = sheets.filter(s => idSet.has(s.id) && s.scheduledGameId);
    const gameUpdates: Record<string, Set<string>> = {};
    toRemove.forEach(s => {
      const gid = s.scheduledGameId!;
      if (!gameUpdates[gid]) gameUpdates[gid] = new Set();
      gameUpdates[gid].add(s.id);
    });
    setSheets(prev => prev.filter(s => !idSet.has(s.id)));
    if (Object.keys(gameUpdates).length > 0) {
      setScheduledGames(prev => prev.map(g =>
        gameUpdates[g.id]
          ? { ...g, sheetIds: g.sheetIds.filter(id => !gameUpdates[g.id].has(id)) }
          : g
      ));
    }
  }, [sheets, setSheets, setScheduledGames]);

  // ── Agent operations ───────────────────────────────────────────────────────

  const assignSheetToAgent = useCallback((sheetId: string, agentId: string) => {
    setSheets(prev => prev.map(s =>
      s.id === sheetId ? { ...s, assignedTo: agentId, status: 'assigned' as const } : s
    ));
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, sheetsAssigned: [...a.sheetsAssigned, sheetId] } : a
    ));
  }, [setSheets, setAgents]);

  const assignSheetsByRange = useCallback((agentId: string, fromNum: number, toNum: number) => {
    const toAssign = sheets.filter(s => {
      if (s.status !== 'available') return false;
      const n = parseInt(s.id.replace('SHEET-', ''), 10);
      return n >= fromNum && n <= toNum;
    });
    const ids = toAssign.map(s => s.id);
    setSheets(prev => prev.map(s =>
      ids.includes(s.id) ? { ...s, assignedTo: agentId, status: 'assigned' as const } : s
    ));
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, sheetsAssigned: [...a.sheetsAssigned, ...ids] } : a
    ));
    return ids.length;
  }, [sheets, setSheets, setAgents]);

  const addAgent = useCallback((name: string, phone: string, commission: number) => {
    const agent: Agent = {
      id: `AGENT-${Date.now()}`,
      name, phone, commission,
      sheetsAssigned: [], totalSales: 0,
      createdAt: new Date().toISOString(),
    };
    setAgents(prev => [...prev, agent]);
    return agent;
  }, [setAgents]);

  const removeAgent = useCallback((agentId: string) => {
    setAgents(prev => prev.filter(a => a.id !== agentId));
    setSheets(prev => prev.map(s =>
      s.assignedTo === agentId ? { ...s, assignedTo: undefined, status: 'available' as const } : s
    ));
  }, [setAgents, setSheets]);

  // ── Player operations ──────────────────────────────────────────────────────

  const addPlayer = useCallback((name: string, phone: string, ticketIds: string[] = []) => {
    const player: Player = {
      id: `PLAYER-${Date.now()}`,
      name, phone, ticketIds,
      totalGames: 0, totalWinnings: 0,
      createdAt: new Date().toISOString(),
    };
    setPlayers(prev => [...prev, player]);
    return player;
  }, [setPlayers]);

  const assignTicketToPlayer = useCallback((playerId: string, ticketId: string) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, ticketIds: [...p.ticketIds, ticketId] } : p
    ));
  }, [setPlayers]);

  // ── Order / payment operations ─────────────────────────────────────────────

  const createOrder = useCallback((
    playerName: string, phone: string, sheetIds: string[], utr?: string, pricePerSheet?: number,
  ): Order => {
    const order: Order = {
      id: `ORDER-${Date.now()}`,
      playerName, phone, sheetIds,
      amount: sheetIds.length * (pricePerSheet ?? sheetPrice),
      utr,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setOrders(prev => [...prev, order]);
    // Mark sheets as pending (reuse 'assigned' status with orderId tag)
    setSheets(prev => prev.map(s =>
      sheetIds.includes(s.id) ? { ...s, orderId: order.id, status: 'assigned' as const } : s
    ));
    return order;
  }, [setOrders, setSheets, sheetPrice]);

  const confirmOrder = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'confirmed' as const, confirmedAt: new Date().toISOString() } : o
    ));

    // Create player record and mark sheets sold
    const ticketIds = order.sheetIds.flatMap(sid => {
      const sheet = sheets.find(s => s.id === sid);
      return sheet ? sheet.tickets.map(t => t.id) : [];
    });
    const player = addPlayer(order.playerName, order.phone, ticketIds);
    setSheets(prev => prev.map(s =>
      order.sheetIds.includes(s.id)
        ? { ...s, status: 'sold' as const, orderId }
        : s
    ));
    // Update sold agent sheets count if assigned via agent
    const agentId = sheets.find(s => s.id === order.sheetIds[0])?.assignedTo;
    if (agentId) {
      const revenue = order.amount;
      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, totalSales: a.totalSales + revenue } : a
      ));
    }
    return player;
  }, [orders, sheets, addPlayer, setOrders, setSheets, setAgents]);

  const rejectOrder = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'rejected' as const } : o
    ));
    // Free the sheets back to available
    setSheets(prev => prev.map(s =>
      order.sheetIds.includes(s.id)
        ? { ...s, status: 'available' as const, orderId: undefined, assignedTo: undefined }
        : s
    ));
  }, [orders, setOrders, setSheets]);

  // ── Mark sheet sold by agent directly ─────────────────────────────────────

  const markSheetSoldByAgent = useCallback((sheetId: string, buyerName: string, buyerPhone: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const ticketIds = sheet.tickets.map(t => t.id);
    addPlayer(buyerName, buyerPhone, ticketIds);
    setSheets(prev => prev.map(s =>
      s.id === sheetId ? { ...s, status: 'sold' as const } : s
    ));
    const agentId = sheet.assignedTo;
    if (agentId) {
      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, totalSales: a.totalSales + (sheet.price ?? sheetPrice) } : a
      ));
    }
  }, [sheets, addPlayer, setSheets, setAgents, sheetPrice]);

  // ── Game operations ────────────────────────────────────────────────────────

  const createGame = useCallback((name: string, sheetIds: string[], customDividends?: Dividend[]) => {
    const dividends = customDividends || DEFAULT_DIVIDENDS.map((d, i) => ({ ...d, id: `DIV-${Date.now()}-${i}` }));
    const game: GameSession = {
      id: `GAME-${Date.now()}`,
      name, status: 'setup',
      calledNumbers: [], currentNumber: null,
      dividends, players: [], sheetIds,
      totalPrizePool: dividends.reduce((s, d) => s + d.prize, 0),
      pricePerSheet: sheetPrice,
    };
    setCurrentGame(game);
    return game;
  }, [setCurrentGame, sheetPrice]);

  const startGame = useCallback(() => {
    setCurrentGame(prev => prev ? { ...prev, status: 'active', startTime: new Date().toISOString() } : null);
  }, [setCurrentGame]);

  const callNumber = useCallback((number: number) => {
    setCurrentGame(prev => {
      if (!prev || prev.calledNumbers.includes(number)) return prev;
      return { ...prev, currentNumber: number, calledNumbers: [...prev.calledNumbers, number] };
    });
  }, [setCurrentGame]);

  const claimDividend = useCallback((dividendId: string, playerName: string) => {
    setCurrentGame(prev => {
      if (!prev) return null;
      return {
        ...prev,
        dividends: prev.dividends.map(d =>
          d.id === dividendId ? { ...d, claimed: true, winner: playerName, claimedAt: new Date().toISOString() } : d
        ),
      };
    });
  }, [setCurrentGame]);

  const endGame = useCallback(() => {
    setCurrentGame(prev => {
      if (!prev) return null;
      const endedGame = { ...prev, status: 'completed' as const, endTime: new Date().toISOString() };
      const winners: Winner[] = prev.dividends
        .filter(d => d.claimed && d.winner)
        .map(d => ({
          id: `WIN-${Date.now()}-${d.id}`,
          playerName: d.winner!,
          ticketId: '',
          dividendName: d.name,
          prize: d.prize,
          claimedAt: d.claimedAt!,
        }));
      const history: GameHistory = {
        id: prev.id,
        date: prev.startTime || new Date().toISOString(),
        name: prev.name,
        totalPlayers: prev.players.length,
        calledNumbersCount: prev.calledNumbers.length,
        winners,
        totalPrizeDistributed: winners.reduce((s, w) => s + w.prize, 0),
        duration: prev.startTime
          ? Math.round((Date.now() - new Date(prev.startTime).getTime()) / 60000) : 0,
      };
      setGameHistory(h => [...h, history]);
      return endedGame;
    });
  }, [setCurrentGame, setGameHistory]);

  const resetGame = useCallback(() => setCurrentGame(null), [setCurrentGame]);

  // ── Scheduled games ────────────────────────────────────────────────────────

  const scheduleGame = useCallback((input: {
    name: string;
    scheduledAt: string;
    backgroundImage?: string;
    prizes: ScheduledGamePrize[];
    hasJackpot: boolean;
    jackpotAmount: number;
    sheetIds: string[];
    ticketPrice: number;
  }): ScheduledGame => {
    const estimatedPrizePool =
      input.prizes.reduce((s, p) => s + p.amount, 0) +
      (input.hasJackpot ? input.jackpotAmount : 0);
    const game: ScheduledGame = { ...input, id: `SCHED-${Date.now()}`, estimatedPrizePool };
    setScheduledGames(prev => [...prev, game]);
    // Stamp all assigned sheets so agents can see which game they belong to
    setSheets(prev => prev.map(s =>
      input.sheetIds.includes(s.id) ? { ...s, scheduledGameId: game.id } : s
    ));
    return game;
  }, [setScheduledGames, setSheets]);

  const removeScheduledGame = useCallback((id: string) => {
    setScheduledGames(prev => prev.filter(g => g.id !== id));
    // Unlink sheets from the removed game
    setSheets(prev => prev.map(s =>
      s.scheduledGameId && scheduledGames.find(g => g.id === s.scheduledGameId)?.id === id
        ? { ...s, scheduledGameId: undefined }
        : s
    ));
  }, [setScheduledGames, setSheets, scheduledGames]);

  const linkScheduledGame = useCallback((scheduledId: string, sessionId: string) => {
    setScheduledGames(prev => prev.map(g =>
      g.id === scheduledId ? { ...g, sessionId } : g
    ));
  }, [setScheduledGames]);

  // ── Verification ───────────────────────────────────────────────────────────

  const verifyTicketClaim = useCallback((ticketId: string, calledNumbers: number[], dividendType: string) => {
    let ticket = null;
    for (const sheet of sheets) {
      ticket = sheet.tickets.find(t => t.id === ticketId);
      if (ticket) break;
    }
    if (!ticket) return { valid: false, reason: 'Ticket not found' };
    const isValid = verifyDividend(ticket, calledNumbers, dividendType);
    return { valid: isValid, reason: isValid ? 'Valid claim!' : 'Numbers not fully called or pattern not matched' };
  }, [sheets]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    totalSheets:     sheets.length,
    totalAgents:     agents.length,
    totalPlayers:    players.length,
    totalGames:      gameHistory.length,
    activeGame:      currentGame?.status === 'active',
    totalRevenue:    gameHistory.reduce((s, g) => s + g.totalPrizeDistributed, 0),
    availableSheets: sheets.filter(s => s.status === 'available').length,
    soldSheets:      sheets.filter(s => s.status === 'sold').length,
    pendingOrders:   orders.filter(o => o.status === 'pending').length,
  };

  return {
    sheets, agents, players, orders, currentGame, gameHistory, currentPage, stats,
    sheetPrice, setSheetPrice, upiSettings, setUpiSettings,
    scheduledGames, scheduleGame, removeScheduledGame, linkScheduledGame,
    setCurrentPage,
    generateSingleSheet, generateMultipleSheets, generateSheetsForGame, deleteSheetsById,
    assignSheetToAgent, assignSheetsByRange,
    addAgent, removeAgent,
    addPlayer, assignTicketToPlayer,
    createOrder, confirmOrder, rejectOrder, markSheetSoldByAgent,
    createGame, startGame, callNumber, claimDividend, endGame, resetGame,
    verifyTicketClaim,
    setSheets, setAgents, setPlayers, setCurrentGame, setGameHistory, setOrders,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocalStorage } from './useLocalStorage';
import { generateSheet, verifyDividend } from '@/lib/tambola';
import {
  mktGenerateSheets, mktGetSheets, mktCreateGame, mktSetStatus, mktUploadThumbnail,
  type MktGenSheet,
} from '@/services/marketplaceApi';
import type {
  Sheet, Agent, Player, GameSession, GameHistory,
  Winner, Dividend, AppPage, Order, UpiSettings, ScheduledGame, ScheduledGamePrize,
} from '@/types';

// ─── DB → TypeScript mappers ──────────────────────────────────────────────────

function dbToSheet(row: Record<string, unknown>): Sheet {
  return {
    id: row.id as string,
    tickets: row.tickets as Sheet['tickets'],
    status: row.status as Sheet['status'],
    assignedTo: (row.assigned_to as string) ?? undefined,
    scheduledGameId: (row.game_id as string) ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

// Marketplace-generated sheet → the same Sheet/Ticket shape everything else in
// this app already works with (SheetFactory, PDF export, search…), so nothing
// downstream needs to know or care where a sheet's data actually came from.
function mktSheetToSheet(s: MktGenSheet): Sheet {
  const id = `SHEET-${String(s.n).padStart(4, '0')}`;
  return {
    id,
    tickets: [...s.tickets]
      .sort((a, b) => a.pos - b.pos)
      .map(t => ({
        id: `${id}-${String(t.pos).padStart(2, '0')}`,
        sheetId: id,
        numbers: t.numbers,
        markedNumbers: new Set<number>(),
      })),
    status: (s.status as Sheet['status']) || 'available',
    createdAt: new Date(s.createdAt || Date.now()).toISOString(),
    scheduledGameId: s.gameId ?? undefined,
  };
}

function dbToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    whatsapp: (row.whatsapp as string) ?? '',
    gmail: (row.gmail as string) ?? '',
    password: (row.password as string) ?? '',
    commission: row.commission as number,
    sheetsAssigned: [],
    totalSales: (row.total_winnings as number) ?? 0,
    createdAt: new Date().toISOString(),
  };
}

function dbToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    ticketIds: (row.ticket_ids as string[]) ?? [],
    totalGames: (row.total_games as number) ?? 0,
    totalWinnings: (row.total_winnings as number) ?? 0,
    createdAt: new Date().toISOString(),
  };
}

function dbToOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    playerName: row.player_name as string,
    phone: (row.phone as string) ?? '',
    sheetIds: (row.sheet_ids as string[]) ?? [],
    amount: row.amount as number,
    status: row.status as Order['status'],
    utr: (row.utr as string) ?? undefined,
    createdAt: row.created_at as string,
    confirmedAt: (row.confirmed_at as string) ?? undefined,
  };
}

function dbToScheduledGame(row: Record<string, unknown>): ScheduledGame {
  return {
    id: row.id as string,
    name: row.name as string,
    scheduledAt: row.scheduled_at as string,
    ticketPrice: (row.ticket_price as number) ?? 0,
    sheetIds: (row.sheet_ids as string[]) ?? [],
    prizes: (row.prizes as ScheduledGamePrize[]) ?? [],
    hasJackpot: (row.has_jackpot as boolean) ?? false,
    jackpotAmount: (row.jackpot_amount as number) ?? 0,
    jackpotThingName: (row.jackpot_thing_name as string) ?? undefined,
    jackpotThingPhoto: (row.jackpot_thing_photo as string) ?? undefined,
    estimatedPrizePool: (row.estimated_prize_pool as number) ?? 0,
    backgroundImage: (row.background_image as string) ?? undefined,
    sessionId: (row.session_id as string) ?? undefined,
  };
}

function dbToGameSession(row: Record<string, unknown>): GameSession {
  const calledNumbers = (row.called_numbers as number[]) ?? [];
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as GameSession['status'],
    calledNumbers,
    currentNumber: calledNumbers[calledNumbers.length - 1] ?? null,
    dividends: (row.dividends as Dividend[]) ?? [],
    players: [],
    sheetIds: (row.sheet_ids as string[]) ?? [],
    totalPrizePool: (row.total_prize_pool as number) ?? 0,
    startTime: (row.created_at as string) ?? undefined,
    endTime: (row.ended_at as string) ?? undefined,
  };
}

function dbToGameHistory(row: Record<string, unknown>): GameHistory {
  return {
    id: row.id as string,
    name: row.name as string,
    date: row.date as string,
    duration: (row.duration as number) ?? 0,
    totalPrizeDistributed: (row.total_prize_distributed as number) ?? 0,
    winners: (row.winners as Winner[]) ?? [],
    calledNumbersCount: (row.called_numbers_count as number) ?? 0,
    totalPlayers: ((row.winners as Winner[]) ?? []).length,
  };
}

// ─── TypeScript → DB mappers ──────────────────────────────────────────────────

function sheetToDb(s: Sheet) {
  return { id: s.id, tickets: s.tickets, status: s.status, assigned_to: s.assignedTo ?? null, game_id: s.scheduledGameId ?? null };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_DIVIDENDS: Omit<Dividend, 'id'>[] = [
  { type: 'early-five',  name: 'Early Five',  prize: 100,  claimed: false },
  { type: 'top-line',    name: 'Top Line',     prize: 200,  claimed: false },
  { type: 'middle-line', name: 'Middle Line',  prize: 200,  claimed: false },
  { type: 'bottom-line', name: 'Bottom Line',  prize: 200,  claimed: false },
  { type: 'corners',     name: 'Corners',      prize: 300,  claimed: false },
  { type: 'full-house',  name: 'Full House',   prize: 1000, claimed: false },
];

export function useTambola() {
  const [sheets,         setSheets]         = useState<Sheet[]>([]);
  const [agents,         setAgents]         = useState<Agent[]>([]);
  const [players,        setPlayers]        = useState<Player[]>([]);
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [currentGame,    setCurrentGameState] = useState<GameSession | null>(null);
  const [gameHistory,    setGameHistoryState] = useState<GameHistory[]>([]);
  const [sheetPrice,     setSheetPriceState]  = useState<number>(50);
  const [upiSettings,    setUpiSettingsState] = useState<UpiSettings>({ upiId: '', merchantName: '' });
  const [scheduledGames, setScheduledGames]   = useState<ScheduledGame[]>([]);
  const [loading,        setLoading]          = useState(true);
  const [currentPage, setCurrentPage] = useLocalStorage<AppPage>('tukpa-page', 'dashboard');
  const [mktApiKey, setMktApiKey] = useLocalStorage<string>('tukpa-mkt-api-key', '');

  // Keep latest sheets in a ref for callbacks that close over stale state
  const sheetsRef = useRef<Sheet[]>([]);
  sheetsRef.current = sheets;
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchSheets = useCallback(async () => {
    // Paginate to bypass Supabase's default 1000-row limit
    const all: Sheet[] = [];
    let from = 0;
    const BATCH = 1000;
    while (true) {
      const { data } = await supabase.from('sheets').select('*').range(from, from + BATCH - 1);
      if (!data || data.length === 0) break;
      all.push(...data.map(dbToSheet));
      if (data.length < BATCH) break;
      from += BATCH;
    }
    // Merge, don't replace — this also re-runs on every realtime change to the
    // legacy sheets table, and a blind setSheets(all) would wipe out
    // marketplace-sourced sheets (fetchMktSheets) loaded since then.
    const freshIds = new Set(all.map(s => s.id));
    setSheets(prev => [...prev.filter(s => !freshIds.has(s.id)), ...all]);
  }, []);

  // Sheets generated server-side against the shared marketplace (see
  // mktGenerateSheets) — merged in alongside the legacy local ones so nothing
  // about existing sheets/games changes; only new generation targets this.
  const fetchMktSheets = useCallback(async () => {
    if (!mktApiKey) return;
    try {
      const { sheets: mktSheets } = await mktGetSheets(mktApiKey);
      const converted = mktSheets.map(mktSheetToSheet);
      const freshIds = new Set(converted.map(c => c.id));
      // Replace any previously-loaded copies of these same sheets with fresh
      // data; everything else (legacy local sheets) is left untouched.
      setSheets(prev => [...prev.filter(s => !freshIds.has(s.id)), ...converted]);
    } catch { /* not connected, or offline — leave local sheets as they are */ }
  }, [mktApiKey]);

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase.from('agents').select('*');
    if (data) setAgents(data.map(dbToAgent));
  }, []);

  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase.from('players').select('*');
    if (data) setPlayers(data.map(dbToPlayer));
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data.map(dbToOrder));
  }, []);

  const fetchScheduledGames = useCallback(async () => {
    const { data } = await supabase.from('scheduled_games').select('*');
    if (data) setScheduledGames(data.map(dbToScheduledGame));
  }, []);

  const fetchGameSession = useCallback(async () => {
    const { data } = await supabase.from('game_sessions').select('*').neq('status', 'completed').limit(1);
    setCurrentGameState(data && data.length > 0 ? dbToGameSession(data[0]) : null);
  }, []);

  const fetchGameHistory = useCallback(async () => {
    const { data } = await supabase.from('game_history').select('*').order('date', { ascending: false });
    if (data) setGameHistoryState(data.map(dbToGameHistory));
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
      const price = data.find(r => r.key === 'sheet_price');
      const upi   = data.find(r => r.key === 'upi_settings');
      if (price) setSheetPriceState(price.value as number);
      if (upi)   setUpiSettingsState(upi.value as UpiSettings);
    }
  }, []);

  // ─── Initial load + realtime ────────────────────────────────────────────────

  useEffect(() => {
    const loadAll = async () => {
      // fetchSheets first, on its own — both it and fetchMktSheets write to the
      // same sheets state; running them concurrently races (whichever's
      // setSheets call lands last would win and the other's data vanishes).
      // fetchMktSheets merges onto whatever fetchSheets already set, so
      // sequencing them removes the race entirely.
      await fetchSheets();
      await Promise.all([
        fetchMktSheets(), fetchAgents(), fetchPlayers(), fetchOrders(),
        fetchScheduledGames(), fetchGameSession(), fetchGameHistory(), fetchSettings(),
      ]);
      setLoading(false);
    };
    loadAll();

    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets' },         fetchSheets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' },         fetchAgents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' },        fetchPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },         fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_games'}, fetchScheduledGames)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' },  fetchGameSession)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_history' },   fetchGameHistory)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' },       fetchSettings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSheets, fetchMktSheets, fetchAgents, fetchPlayers, fetchOrders, fetchScheduledGames, fetchGameSession, fetchGameHistory, fetchSettings]);

  // ─── Settings ───────────────────────────────────────────────────────────────

  const setSheetPrice = useCallback(async (price: number) => {
    setSheetPriceState(price);
    await supabase.from('settings').upsert({ key: 'sheet_price', value: price });
  }, []);

  const setUpiSettings = useCallback(async (s: UpiSettings) => {
    setUpiSettingsState(s);
    await supabase.from('settings').upsert({ key: 'upi_settings', value: s });
  }, []);

  // ─── Sheet generation ───────────────────────────────────────────────────────

  const generateSingleSheet = useCallback(async () => {
    const id    = sheetsRef.current.length + 1;
    const sheet = generateSheet(`SHEET-${String(id).padStart(4, '0')}`);
    const priced = { ...sheet, price: sheetPrice };
    setSheets(prev => [...prev, priced]);
    await supabase.from('sheets').insert(sheetToDb(priced));
    return priced;
  }, [sheetPrice]);

  const generateMultipleSheets = useCallback(async (count: number) => {
    const startId   = sheetsRef.current.length + 1;
    const newSheets: Sheet[] = [];
    for (let i = 0; i < count; i++) {
      const sheet = generateSheet(`SHEET-${String(startId + i).padStart(4, '0')}`);
      newSheets.push({ ...sheet, price: sheetPrice });
    }
    setSheets(prev => [...prev, ...newSheets]);
    await supabase.from('sheets').insert(newSheets.map(sheetToDb));
    return newSheets;
  }, [sheetPrice]);

  const generateSheetsForGame = useCallback(async (gameId: string, count: number, mktGameId?: string) => {
    // Marketplace-connected: generate server-side (RNG can't be tampered with
    // client-side, and these tickets become verifiable via mktVerifyClaim).
    // New games from here on should always take this path.
    if (mktApiKey) {
      // Pass the real marketplace game id when this scheduled game already has
      // one (see scheduleGame) — that's what lets the sheets actually count
      // toward the listing's sheetFrom/sheetTo/sheetCount server-side, instead
      // of generating untagged. Falls back to the local id (ad-hoc, untagged)
      // if this game was scheduled before connecting to the marketplace.
      const { sheetFrom, sheetTo } = await mktGenerateSheets(mktApiKey, count, mktGameId || gameId);
      const { sheets: fresh } = await mktGetSheets(mktApiKey, { from: sheetFrom, to: sheetTo });
      // The local scheduled-game id is always what the rest of this app's UI
      // (SheetFactory, GameInventory) groups sheets by, regardless of whether
      // the server also tagged them to a real marketplace game.
      const newSheets = fresh.map(s => ({ ...mktSheetToSheet(s), scheduledGameId: gameId }));
      const newIds = newSheets.map(s => s.id);
      setSheets(prev => [...prev, ...newSheets]);
      setScheduledGames(prev => prev.map(g => g.id === gameId ? { ...g, sheetIds: [...g.sheetIds, ...newIds] } : g));
      return newSheets;
    }

    // Legacy local path — unchanged, for operators not yet connected to the marketplace.
    const startId   = sheetsRef.current.length + 1;
    const newSheets: Sheet[] = [];
    for (let i = 0; i < count; i++) {
      const sheet = generateSheet(`SHEET-${String(startId + i).padStart(4, '0')}`);
      newSheets.push({ ...sheet, price: sheetPrice, scheduledGameId: gameId });
    }
    const newIds = newSheets.map(s => s.id);
    setSheets(prev => [...prev, ...newSheets]);
    setScheduledGames(prev => prev.map(g => g.id === gameId ? { ...g, sheetIds: [...g.sheetIds, ...newIds] } : g));
    await supabase.from('sheets').insert(newSheets.map(s => ({ ...sheetToDb(s), game_id: gameId })));
    const current = scheduledGames.find(g => g.id === gameId);
    const updatedIds = [...(current?.sheetIds ?? []), ...newIds];
    await supabase.from('scheduled_games').update({ sheet_ids: updatedIds }).eq('id', gameId);
    await fetchScheduledGames();
    return newSheets;
  }, [sheetPrice, fetchScheduledGames, mktApiKey]);

  const deleteSheetsById = useCallback(async (ids: string[]) => {
    setSheets(prev => prev.filter(s => !ids.includes(s.id)));
    await supabase.from('sheets').delete().in('id', ids);
  }, []);

  // ─── Agent operations ────────────────────────────────────────────────────────

  const addAgent = useCallback(async (name: string, phone: string, commission: number, whatsapp = '', gmail = '', password = '') => {
    const agent: Agent = { id: `AGENT-${Date.now()}`, name, phone, whatsapp, gmail, password, commission, sheetsAssigned: [], totalSales: 0, createdAt: new Date().toISOString() };
    setAgents(prev => [...prev, agent]);
    await supabase.from('agents').insert({ id: agent.id, name, phone, whatsapp, gmail, password, commission, total_games: 0, total_winnings: 0 });
    return agent;
  }, []);

  const removeAgent = useCallback(async (agentId: string) => {
    setAgents(prev => prev.filter(a => a.id !== agentId));
    setSheets(prev => prev.map(s => s.assignedTo === agentId ? { ...s, assignedTo: undefined, status: 'available' as const } : s));
    await supabase.from('agents').delete().eq('id', agentId);
    await supabase.from('sheets').update({ assigned_to: null, status: 'available' }).eq('assigned_to', agentId);
  }, []);

  const assignSheetToAgent = useCallback(async (sheetId: string, agentId: string) => {
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, assignedTo: agentId, status: 'assigned' as const } : s));
    await supabase.from('sheets').update({ assigned_to: agentId, status: 'assigned' }).eq('id', sheetId);
  }, []);

  const assignSheetsByRange = useCallback(async (agentId: string, fromNum: number, toNum: number) => {
    const toAssign = sheetsRef.current.filter(s => {
      if (s.status !== 'available') return false;
      const n = parseInt(s.id.replace('SHEET-', ''), 10);
      return n >= fromNum && n <= toNum;
    });
    const ids = toAssign.map(s => s.id);
    setSheets(prev => prev.map(s => ids.includes(s.id) ? { ...s, assignedTo: agentId, status: 'assigned' as const } : s));
    // Batch DB updates to avoid URL length limits with large IN clauses
    const BATCH = 50;
    for (let i = 0; i < ids.length; i += BATCH) {
      await supabase.from('sheets')
        .update({ assigned_to: agentId, status: 'assigned' })
        .in('id', ids.slice(i, i + BATCH));
    }
    return ids.length;
  }, []);

  // ─── Player operations ───────────────────────────────────────────────────────

  const addPlayer = useCallback(async (name: string, phone: string, ticketIds: string[] = []) => {
    const player: Player = { id: `PLAYER-${Date.now()}`, name, phone, ticketIds, totalGames: 0, totalWinnings: 0, createdAt: new Date().toISOString() };
    setPlayers(prev => [...prev, player]);
    await supabase.from('players').insert({ id: player.id, name, phone, ticket_ids: ticketIds, total_games: 0, total_winnings: 0 });
    return player;
  }, []);

  const assignTicketToPlayer = useCallback(async (playerId: string, ticketId: string) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, ticketIds: [...p.ticketIds, ticketId] } : p));
    const player = players.find(p => p.id === playerId);
    if (player) {
      await supabase.from('players').update({ ticket_ids: [...player.ticketIds, ticketId] }).eq('id', playerId);
    }
  }, [players]);

  // ─── Order operations ────────────────────────────────────────────────────────

  const createOrder = useCallback(async (playerName: string, phone: string, sheetIds: string[], utr?: string, pricePerSheet?: number): Promise<Order> => {
    const order: Order = {
      id: `ORDER-${Date.now()}`,
      playerName, phone, sheetIds,
      amount: sheetIds.length * (pricePerSheet ?? sheetPrice),
      utr, status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setOrders(prev => [...prev, order]);
    setSheets(prev => prev.map(s => sheetIds.includes(s.id) ? { ...s, orderId: order.id, status: 'assigned' as const } : s));
    await supabase.from('orders').insert({
      id: order.id, player_name: playerName, phone, sheet_ids: sheetIds,
      amount: order.amount, utr: utr ?? null, status: 'pending',
    });
    await supabase.from('sheets').update({ status: 'assigned' }).in('id', sheetIds);
    return order;
  }, [sheetPrice]);

  const confirmOrder = useCallback(async (orderId: string) => {
    const order = ordersRef.current.find(o => o.id === orderId);
    if (!order) return;
    const now = new Date().toISOString();
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'confirmed' as const, confirmedAt: now } : o));
    setSheets(prev => prev.map(s => order.sheetIds.includes(s.id) ? { ...s, status: 'sold' as const } : s));

    const ticketIds = sheetsRef.current
      .filter(s => order.sheetIds.includes(s.id))
      .flatMap(s => s.tickets.map(t => t.id));
    const player = await addPlayer(order.playerName, order.phone, ticketIds);

    await supabase.from('orders').update({ status: 'confirmed', confirmed_at: now }).eq('id', orderId);
    await supabase.from('sheets').update({ status: 'sold' }).in('id', order.sheetIds);

    const agentId = sheetsRef.current.find(s => order.sheetIds.includes(s.id))?.assignedTo;
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      const newTotal = (agent?.totalSales ?? 0) + order.amount;
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, totalSales: newTotal } : a));
      await supabase.from('agents').update({ total_winnings: newTotal }).eq('id', agentId);
    }
    return player;
  }, [agents, addPlayer]);

  const rejectOrder = useCallback(async (orderId: string) => {
    const order = ordersRef.current.find(o => o.id === orderId);
    if (!order) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'rejected' as const } : o));
    setSheets(prev => prev.map(s => order.sheetIds.includes(s.id) ? { ...s, status: 'available' as const, orderId: undefined, assignedTo: undefined } : s));
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
    await supabase.from('sheets').update({ status: 'available', assigned_to: null }).in('id', order.sheetIds);
  }, []);

  // ─── Mark sold by agent ──────────────────────────────────────────────────────

  const markSheetSoldByAgent = useCallback(async (sheetId: string, buyerName: string, buyerPhone: string) => {
    const sheet = sheetsRef.current.find(s => s.id === sheetId);
    if (!sheet) return;
    const ticketIds = sheet.tickets.map(t => t.id);
    await addPlayer(buyerName, buyerPhone, ticketIds);
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, status: 'sold' as const } : s));
    await supabase.from('sheets').update({ status: 'sold' }).eq('id', sheetId);
    const agentId = sheet.assignedTo;
    if (agentId) {
      const revenue = sheet.price ?? sheetPrice;
      const agent = agents.find(a => a.id === agentId);
      const newTotal = (agent?.totalSales ?? 0) + revenue;
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, totalSales: newTotal } : a));
      await supabase.from('agents').update({ total_winnings: newTotal }).eq('id', agentId);
    }
  }, [agents, addPlayer, sheetPrice]);

  // ─── Game operations ─────────────────────────────────────────────────────────

  const createGame = useCallback(async (
    name: string, sheetIds: string[], customDividends?: Dividend[],
    mktGameId?: string, joinLink?: string, joinDetails?: string,
  ) => {
    const dividends = customDividends || DEFAULT_DIVIDENDS.map((d, i) => ({ ...d, id: `DIV-${Date.now()}-${i}` }));
    const game: GameSession = {
      id: `GAME-${Date.now()}`, name, status: 'setup',
      calledNumbers: [], currentNumber: null,
      dividends, players: [], sheetIds,
      totalPrizePool: dividends.reduce((s, d) => s + d.prize, 0),
      pricePerSheet: sheetPrice,
      mktGameId, joinLink, joinDetails,
    };
    setCurrentGameState(game);
    await supabase.from('game_sessions').insert({
      id: game.id, name, sheet_ids: sheetIds, dividends,
      called_numbers: [], status: 'setup', total_prize_pool: game.totalPrizePool,
    });
    return game;
  }, [sheetPrice]);

  const startGame = useCallback(async () => {
    setCurrentGameState(prev => prev ? { ...prev, status: 'active', startTime: new Date().toISOString() } : null);
    if (currentGame) await supabase.from('game_sessions').update({ status: 'active' }).eq('id', currentGame.id);
  }, [currentGame]);

  const callNumber = useCallback(async (number: number) => {
    setCurrentGameState(prev => {
      if (!prev || prev.calledNumbers.includes(number)) return prev;
      return { ...prev, currentNumber: number, calledNumbers: [...prev.calledNumbers, number] };
    });
    if (currentGame && !currentGame.calledNumbers.includes(number)) {
      const newCalled = [...currentGame.calledNumbers, number];
      await supabase.from('game_sessions').update({ called_numbers: newCalled }).eq('id', currentGame.id);
    }
  }, [currentGame]);

  const claimDividend = useCallback(async (dividendId: string, playerName: string) => {
    setCurrentGameState(prev => {
      if (!prev) return null;
      return { ...prev, dividends: prev.dividends.map(d => d.id === dividendId ? { ...d, claimed: true, winner: playerName, claimedAt: new Date().toISOString() } : d) };
    });
    if (currentGame) {
      const newDividends = currentGame.dividends.map(d => d.id === dividendId ? { ...d, claimed: true, winner: playerName, claimedAt: new Date().toISOString() } : d);
      await supabase.from('game_sessions').update({ dividends: newDividends }).eq('id', currentGame.id);
    }
  }, [currentGame]);

  const endGame = useCallback(async () => {
    if (!currentGame) return;
    const winners: Winner[] = currentGame.dividends
      .filter(d => d.claimed && d.winner)
      .map(d => ({ id: `WIN-${Date.now()}-${d.id}`, playerName: d.winner!, ticketId: '', dividendName: d.name, prize: d.prize, claimedAt: d.claimedAt! }));
    const history: GameHistory = {
      id: currentGame.id,
      date: currentGame.startTime || new Date().toISOString(),
      name: currentGame.name,
      totalPlayers: currentGame.players.length,
      calledNumbersCount: currentGame.calledNumbers.length,
      winners,
      totalPrizeDistributed: winners.reduce((s, w) => s + w.prize, 0),
      duration: currentGame.startTime ? Math.round((Date.now() - new Date(currentGame.startTime).getTime()) / 60000) : 0,
    };
    setCurrentGameState(prev => prev ? { ...prev, status: 'completed', endTime: new Date().toISOString() } : null);
    setGameHistoryState(prev => [history, ...prev]);
    await supabase.from('game_sessions').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', currentGame.id);
    await supabase.from('game_history').insert({
      id: history.id, name: history.name, date: history.date, duration: history.duration,
      total_prize_distributed: history.totalPrizeDistributed, winners: history.winners,
      called_numbers_count: history.calledNumbersCount,
    });
  }, [currentGame]);

  const resetGame = useCallback(async () => {
    if (currentGame) await supabase.from('game_sessions').update({ status: 'completed' }).eq('id', currentGame.id);
    setCurrentGameState(null);
  }, [currentGame]);

  // ─── Scheduled games ─────────────────────────────────────────────────────────

  const scheduleGame = useCallback(async (input: {
    name: string; scheduledAt: string; backgroundImage?: string;
    prizes: ScheduledGamePrize[]; hasJackpot: boolean; jackpotAmount: number;
    jackpotThingName?: string; jackpotThingPhoto?: string;
    sheetIds: string[]; ticketPrice: number;
    joinLink?: string; joinDetails?: string;
  }): Promise<ScheduledGame> => {
    const estimatedPrizePool = input.prizes.reduce((s, p) => s + p.amount, 0) + (input.hasJackpot ? input.jackpotAmount : 0);
    let game: ScheduledGame = { ...input, id: `SCHED-${Date.now()}`, estimatedPrizePool };
    setScheduledGames(prev => [...prev, game]);
    setSheets(prev => prev.map(s => input.sheetIds.includes(s.id) ? { ...s, scheduledGameId: game.id } : s));
    const { error } = await supabase.from('scheduled_games').insert({
      id: game.id, name: game.name, scheduled_at: game.scheduledAt,
      ticket_price: game.ticketPrice, sheet_ids: game.sheetIds,
      prizes: game.prizes, has_jackpot: game.hasJackpot, jackpot_amount: game.jackpotAmount,
      jackpot_thing_name: game.jackpotThingName ?? null,
      jackpot_thing_photo: game.jackpotThingPhoto ?? null,
      estimated_prize_pool: estimatedPrizePool, background_image: game.backgroundImage ?? null,
    });
    if (error) console.error('[scheduleGame] Supabase error:', error);
    if (input.sheetIds.length > 0) {
      const { error: e2 } = await supabase.from('sheets').update({ game_id: game.id }).in('id', input.sheetIds);
      if (e2) console.error('[scheduleGame] sheets update error:', e2);
    }

    // Marketplace-connected: also create a real listing (draft — not visible
    // to players until explicitly listed) so this game can be found/purchased
    // through the shared marketplace and announced on the operator's Telegram
    // channel, same as Plan A. Best-effort: local scheduling still succeeds
    // even if this fails (e.g. offline).
    if (mktApiKey) {
      try {
        let thumbnail: string | null = input.backgroundImage || null;
        if (thumbnail?.startsWith('data:')) {
          const uploaded = await mktUploadThumbnail(mktApiKey, `${game.id}.jpg`, thumbnail.split(',')[1] ?? '');
          thumbnail = uploaded.url;
        }
        const mktPrizes = [
          ...input.prizes.map(p => ({ name: p.label, kind: p.thingName ? 'physical' : 'cash', amount: p.amount })),
          ...(input.hasJackpot ? [{ name: 'Jackpot', kind: input.jackpotThingName ? 'physical' : 'cash', amount: input.jackpotAmount }] : []),
        ];
        const d = new Date(input.scheduledAt);
        const { game: mktGame } = await mktCreateGame(mktApiKey, {
          name: input.name,
          gameDate: d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          gameDateRaw: input.scheduledAt,
          joinLink: input.joinLink || null,
          joinDetails: input.joinDetails || null,
          pricePerSheet: input.ticketPrice,
          prizes: mktPrizes,
          thumbnail,
        });
        game = { ...game, mktGameId: mktGame.id };
        setScheduledGames(prev => prev.map(g => g.id === game.id ? game : g));
      } catch (e) {
        console.error('[scheduleGame] marketplace create-game failed (local schedule still saved):', e);
      }
    }

    return game;
  }, [mktApiKey]);

  // Makes a scheduled game's marketplace listing publicly visible/purchasable
  // and broadcasts it to the operator's Telegram channel — deliberately
  // separate from going live, so players can buy ahead of game night instead
  // of only finding out when the operator starts calling numbers.
  const listScheduledGame = useCallback(async (id: string) => {
    const game = scheduledGames.find(g => g.id === id);
    if (!game?.mktGameId || !mktApiKey) throw new Error('Connect your marketplace API key in Profile first.');
    await mktSetStatus(mktApiKey, game.mktGameId, 'listed');
  }, [scheduledGames, mktApiKey]);

  const removeScheduledGame = useCallback(async (id: string) => {
    setScheduledGames(prev => prev.filter(g => g.id !== id));
    setSheets(prev => prev.filter(s => s.scheduledGameId !== id));
    await supabase.from('sheets').delete().eq('game_id', id);
    await supabase.from('scheduled_games').delete().eq('id', id);
  }, []);

  const rescheduleGame = useCallback(async (id: string, newScheduledAt: string) => {
    setScheduledGames(prev => prev.map(g => g.id === id ? { ...g, scheduledAt: newScheduledAt } : g));
    await supabase.from('scheduled_games').update({ scheduled_at: newScheduledAt }).eq('id', id);
  }, []);

  const linkScheduledGame = useCallback(async (scheduledId: string, sessionId: string) => {
    setScheduledGames(prev => prev.map(g => g.id === scheduledId ? { ...g, sessionId } : g));
    await supabase.from('scheduled_games').update({ session_id: sessionId }).eq('id', scheduledId);
  }, []);

  // ─── Game history management ─────────────────────────────────────────────────

  const setGameHistory = useCallback(async (historyOrFn: GameHistory[] | ((prev: GameHistory[]) => GameHistory[])) => {
    const newHistory = typeof historyOrFn === 'function' ? historyOrFn(gameHistory) : historyOrFn;
    setGameHistoryState(newHistory);
    await supabase.from('game_history').delete().neq('id', '___nonexistent___');
    if (newHistory.length > 0) {
      await supabase.from('game_history').insert(newHistory.map(h => ({
        id: h.id, name: h.name, date: h.date, duration: h.duration,
        total_prize_distributed: h.totalPrizeDistributed, winners: h.winners,
        called_numbers_count: h.calledNumbersCount,
      })));
    }
  }, [gameHistory]);

  // ─── Verification ────────────────────────────────────────────────────────────

  const verifyTicketClaim = useCallback((ticketId: string, calledNumbers: number[], dividendType: string) => {
    let ticket = null;
    for (const sheet of sheetsRef.current) {
      ticket = sheet.tickets.find(t => t.id === ticketId);
      if (ticket) break;
    }
    if (!ticket) return { valid: false, reason: 'Ticket not found' };
    const isValid = verifyDividend(ticket, calledNumbers, dividendType);
    return { valid: isValid, reason: isValid ? 'Valid claim!' : 'Numbers not fully called or pattern not matched' };
  }, []);

  // ─── Stats ───────────────────────────────────────────────────────────────────

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
    loading,
    sheets, agents, players, orders, currentGame, gameHistory, currentPage, stats,
    sheetPrice, setSheetPrice, upiSettings, setUpiSettings,
    scheduledGames, scheduleGame, listScheduledGame, removeScheduledGame, rescheduleGame, linkScheduledGame,
    mktApiKey, setMktApiKey,
    setCurrentPage,
    generateSingleSheet, generateMultipleSheets, generateSheetsForGame, deleteSheetsById,
    assignSheetToAgent, assignSheetsByRange,
    addAgent, removeAgent,
    addPlayer, assignTicketToPlayer,
    createOrder, confirmOrder, rejectOrder, markSheetSoldByAgent,
    createGame, startGame, callNumber, claimDividend, endGame, resetGame,
    verifyTicketClaim,
    setSheets: async (s: Sheet[]) => { setSheets(s); },
    setAgents: async (a: Agent[]) => { setAgents(a); },
    setPlayers: async (p: Player[]) => { setPlayers(p); },
    setCurrentGame: setCurrentGameState,
    setGameHistory,
    setOrders: async (o: Order[]) => { setOrders(o); },
  };
}

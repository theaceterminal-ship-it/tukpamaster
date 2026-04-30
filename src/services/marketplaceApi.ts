// Tungbola Marketplace API client — connects operator portal to tungbola-market.vercel.app

const BASE = 'https://tungbola-market.vercel.app/api/operator';

async function post(apiKey: string, body: Record<string, unknown>) {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, apiKey }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export interface MktOperator {
  id: string;
  name: string;
  plan: 'own-sheets' | 'generate';
}

export interface MktGame {
  id: string;
  name: string;
  gameDate: string | null;
  status: 'draft' | 'listed' | 'ended';
  sheetCount: number;
  soldCount: number;
  pricePerSheet: number;
  createdAt: number;
}

export interface MktPurchase {
  purchaseId: string;
  playerName: string;
  phone: string;
  pin: string;
  gameId: string;
  gameName: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'approved';
  createdAt: number;
  sheetNums?: number[];
}

export async function mktGetInfo(apiKey: string): Promise<{ operator: MktOperator; games: MktGame[] }> {
  return post(apiKey, { action: 'get-info' });
}

export async function mktGetPurchases(apiKey: string): Promise<{ purchases: MktPurchase[] }> {
  return post(apiKey, { action: 'get-purchases' });
}

export async function mktCreateGame(
  apiKey: string,
  game: { name: string; gameDate?: string; pricePerSheet: number; description?: string; prizes?: unknown[] }
): Promise<{ game: MktGame }> {
  return post(apiKey, { action: 'create-game', ...game });
}

export async function mktAssignSheets(
  apiKey: string, gameId: string, sheetFrom: number, sheetTo: number
): Promise<{ game: MktGame; sheetsFound: number }> {
  return post(apiKey, { action: 'assign-sheets', gameId, sheetFrom, sheetTo });
}

export async function mktSetStatus(
  apiKey: string, gameId: string, status: 'listed' | 'ended' | 'draft'
): Promise<void> {
  return post(apiKey, { action: 'set-status', gameId, status });
}

export async function mktDeleteGame(apiKey: string, gameId: string): Promise<void> {
  return post(apiKey, { action: 'delete-game', gameId });
}

export async function mktApprovePurchase(apiKey: string, purchaseId: string): Promise<void> {
  return post(apiKey, { action: 'approve-purchase', purchaseId });
}

export async function mktCallNumber(
  apiKey: string, gameId: string, number: number
): Promise<void> {
  return post(apiKey, { action: 'call-number', gameId, number });
}

export async function mktResetLive(apiKey: string, gameId: string): Promise<void> {
  return post(apiKey, { action: 'reset-live', gameId });
}

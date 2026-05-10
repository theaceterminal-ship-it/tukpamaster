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
  platformPaymentStatus: 'pending' | 'verified' | 'rejected' | null;
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
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  sheetNums?: number[];
}

export interface MktPayment {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  amount: number;
  sheetCount: number;
  utr: string;
  createdAt: number;
}

export async function mktGetInfo(apiKey: string): Promise<{ operator: MktOperator; games: MktGame[]; adminUpiId: string }> {
  return post(apiKey, { action: 'get-info' });
}

export async function mktGetPurchases(apiKey: string): Promise<{ purchases: MktPurchase[] }> {
  return post(apiKey, { action: 'get-purchases' });
}

export async function mktCreateGame(
  apiKey: string,
  game: {
    name: string;
    gameDate?: string | null;
    gameDateRaw?: string | null;
    joinTime?: string | null;
    pricePerSheet: number;
    pricingTiers?: { qty: number; price: number }[];
    description?: string;
    prizes?: unknown[];
    thumbnail?: string | null;
  }
): Promise<{ game: MktGame }> {
  return post(apiKey, { action: 'create-game', ...game });
}

export async function mktUploadThumbnail(
  apiKey: string,
  filename: string,
  base64Data: string,
): Promise<{ url: string }> {
  return post(apiKey, { action: 'upload-thumbnail', filename, data: base64Data });
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

export async function mktRejectPurchase(apiKey: string, purchaseId: string): Promise<void> {
  return post(apiKey, { action: 'reject-purchase', purchaseId });
}

export async function mktCallNumber(
  apiKey: string, gameId: string, number: number
): Promise<void> {
  return post(apiKey, { action: 'call-number', gameId, number });
}

export async function mktResetLive(apiKey: string, gameId: string): Promise<void> {
  return post(apiKey, { action: 'reset-live', gameId });
}

export async function mktUploadSheet(
  apiKey: string,
  sheetNum: number,
  filename: string,
  base64Data: string,
): Promise<{ url: string; n: number }> {
  return post(apiKey, { action: 'upload-sheet', sheetNum, filename, data: base64Data });
}

export async function mktSheetLibraryStats(
  apiKey: string,
): Promise<{ count: number; plan: string }> {
  return post(apiKey, { action: 'sheet-library-stats' });
}

export async function mktGetSheet(
  apiKey: string,
  sheetNum: number,
): Promise<{ sheet: { n: number; f: string; u: string } }> {
  return post(apiKey, { action: 'get-sheet', sheetNum });
}

export async function mktRegisterSheet(
  apiKey: string,
  sheetNum: number,
  filename: string,
  url: string,
): Promise<{ sheet: { n: number; f: string; u: string } }> {
  return post(apiKey, { action: 'register-sheet', sheetNum, filename, url });
}

export async function mktSubmitPlatformPayment(
  apiKey: string, gameId: string, utr: string
): Promise<{ paymentId: string; amount: number; sheetCount: number }> {
  return post(apiKey, { action: 'submit-platform-payment', gameId, utr });
}

export async function mktGetGamePayment(
  apiKey: string, gameId: string
): Promise<{ payment: MktPayment | null }> {
  return post(apiKey, { action: 'get-game-payment', gameId });
}

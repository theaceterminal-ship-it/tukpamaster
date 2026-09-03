// Shared operator-session storage — kept out of App.tsx so components (e.g. Settings)
// can read/patch the cached session without creating a circular import with App.tsx.
import type { MktOperator } from '@/services/marketplaceApi';

export const SESSION_KEY = 'tukpa-op-v2';
export type OpSession = { apiKey: string; operator: MktOperator };

export function getSession(): OpSession | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); }
  catch { return null; }
}

// Merge partial operator fields into the cached session (used after a successful
// profile save, so a reload doesn't show stale data from signup/login time).
export function patchSessionOperator(patch: Partial<MktOperator>) {
  const session = getSession();
  if (!session) return;
  session.operator = { ...session.operator, ...patch };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

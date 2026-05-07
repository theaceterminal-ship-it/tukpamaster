import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, XCircle, Loader2, Link2, Unlink, Globe,
  User, Phone, QrCode, Trash2, Check,
  Image as ImageIcon, LogOut, Wifi, WifiOff,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import {
  mktGetInfo,
  type MktOperator,
} from '@/services/marketplaceApi';
import { cn } from '@/lib/utils';

interface Props {
  tambola?: ReturnType<typeof useTambola>;
  apiKey?: string;
  initOperator?: MktOperator;
  onLogout?: () => void;
}

function lsGet(k: string) { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? {}; } catch { return {}; } }
function lsSet(k: string, v: object) { localStorage.setItem(k, JSON.stringify(v)); }

export function Settings({ tambola, apiKey, initOperator, onLogout }: Props) {
  const mktKey    = apiKey ?? tambola?.mktApiKey ?? '';
  const setMktKey = tambola?.setMktApiKey ?? (() => {});
  const isPlanA   = !!apiKey;

  const [inputKey,  setInputKey]  = useState(mktKey);
  const [keyStatus, setKeyStatus] = useState<'idle'|'checking'|'ok'|'error'>(mktKey ? 'ok' : 'idle');
  const [keyErr,    setKeyErr]    = useState('');
  const [operator,  setOperator]  = useState<MktOperator | null>(initOperator ?? null);
  const [pName,  setPName]  = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pQr,    setPQr]    = useState<string | null>(null);
  const [pSaved, setPSaved] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const connected = keyStatus === 'ok' && !!mktKey;

  useEffect(() => {
    const id = initOperator?.id ?? operator?.id;
    if (!id) return;
    const p = lsGet(`tukpa-profile-${id}`);
    setPName(p.displayName ?? ''); setPPhone(p.supportPhone ?? ''); setPQr(p.qrBase64 ?? null);
  }, [initOperator?.id, operator?.id]);

  async function connect() {
    const k = inputKey.trim(); if (!k) return;
    setKeyStatus('checking'); setKeyErr('');
    try {
      const info = await mktGetInfo(k);
      setMktKey(k); setOperator(info.operator); setKeyStatus('ok');
    } catch (e) { setKeyStatus('error'); setKeyErr(e instanceof Error ? e.message : 'Failed'); }
  }

  function disconnect() {
    setMktKey(''); setInputKey(''); setKeyStatus('idle'); setOperator(null);
  }

  function saveProfile() {
    const id = initOperator?.id ?? operator?.id;
    if (!id) return;
    lsSet(`tukpa-profile-${id}`, { displayName: pName, supportPhone: pPhone, qrBase64: pQr });
    setPSaved(true); setTimeout(() => setPSaved(false), 2000);
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="max-w-lg space-y-3 pb-4">

        {/* Operator badge */}
        {(operator ?? initOperator) && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm truncate">{(operator ?? initOperator)!.name}</p>
              <p className="text-white/30 text-xs">{(operator ?? initOperator)!.plan === 'own-sheets' ? 'Plan A · Own Sheets' : 'Plan B · Generate'}</p>
            </div>
            {connected
              ? <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              : <WifiOff className="w-4 h-4 text-white/20 shrink-0" />
            }
          </div>
        )}

        {/* Profile form */}
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Display Info</p>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold block">Business / Display Name</label>
            <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="Shown to players in listings"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-sky-400" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> Support Phone</label>
            <input type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+91 98765 43210"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-sky-400" />
            <p className="text-[11px] text-white/25">Players see this number when they need help.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><QrCode className="w-3 h-3" /> Payment QR Code</label>
            <p className="text-[11px] text-white/25 mb-2">Your UPI / bank QR — players scan this to pay for sheets.</p>
            {pQr ? (
              <div className="flex items-start gap-3">
                <img src={pQr} alt="QR" className="w-28 h-28 object-contain rounded-xl bg-white p-1.5 shrink-0" />
                <div className="space-y-2 pt-1">
                  <button onClick={() => qrRef.current?.click()} className="text-xs text-sky-400 font-semibold flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Replace
                  </button>
                  <button onClick={() => setPQr(null)} className="text-xs text-red-400 font-semibold flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => qrRef.current?.click()}
                className="w-full border-2 border-dashed border-white/10 rounded-xl py-6 flex flex-col items-center gap-2 text-white/25 hover:border-sky-400/40 hover:text-sky-400/60 transition-colors">
                <QrCode className="w-8 h-8" />
                <span className="text-xs font-medium">Tap to upload your payment QR code</span>
              </button>
            )}
            <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const r = new FileReader(); r.onload = () => setPQr(r.result as string); r.readAsDataURL(f);
            }} />
          </div>

          <button onClick={saveProfile}
            className={cn('w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-colors',
              pSaved ? 'bg-emerald-500' : 'bg-sky-500 hover:bg-sky-400')}>
            {pSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
          </button>
        </div>

        {/* Marketplace connection — Plan B only */}
        {!isPlanA && (
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-sky-400" /> Marketplace API Key
            </p>

            {connected && operator ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{operator.name}</p>
                  <p className="text-emerald-400 text-xs">Connected</p>
                </div>
                <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1">
                  <Unlink className="w-3 h-3" /> Disconnect
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && connect()}
                    placeholder="Paste your API key…"
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono bg-white/10 border border-white/15 text-white placeholder-white/25 focus:outline-none focus:border-sky-400" />
                  <button onClick={connect} disabled={keyStatus === 'checking' || !inputKey.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-40 flex items-center gap-1.5 shrink-0 transition-colors">
                    {keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect
                  </button>
                </div>
                {keyStatus === 'error' && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyErr}</p>}
                <p className="text-white/25 text-xs">Get your key from TungbolaMarket admin → Operators tab.</p>
              </>
            )}
          </div>
        )}

        {/* Sign Out */}
        {onLogout && (
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white/30 hover:text-red-400 border border-white/10 hover:border-red-400/30 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        )}
      </div>
    </div>
  );
}

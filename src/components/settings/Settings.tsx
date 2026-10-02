import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle, XCircle, Loader2, Link2, Unlink, Globe,
  User, Phone, Check, LogOut, Wifi, WifiOff, IndianRupee, Video,
} from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import {
  mktGetInfo, mktUpdateProfile, mktZoomAuthUrl, mktZoomDisconnect,
  type MktOperator,
} from '@/services/marketplaceApi';
import { cn } from '@/lib/utils';
import { patchSessionOperator } from '@/lib/session';

interface Props {
  tambola?: ReturnType<typeof useTambola>;
  apiKey?: string;
  initOperator?: MktOperator;
  onLogout?: () => void;
}

export function Settings({ tambola, apiKey, initOperator, onLogout }: Props) {
  const mktKey  = apiKey ?? tambola?.mktApiKey ?? '';
  const isPlanA = !!apiKey;

  const [reloadKey, setReloadKey] = useState(0);
  const [operator,  setOperator]  = useState<MktOperator | null>(initOperator ?? null);
  const [opLoading, setOpLoading] = useState(false);
  const [opErr,     setOpErr]     = useState('');

  const [pName,    setPName]    = useState('');
  const [pPhone,   setPPhone]   = useState('');
  const [pUpiId,   setPUpiId]   = useState('');
  const [pSaving,  setPSaving]  = useState(false);
  const [pSaved,   setPSaved]   = useState(false);
  const [pErr,     setPErr]     = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [zoomConnected, setZoomConnected]   = useState(false);
  const [zoomWorking,   setZoomWorking]     = useState(false);
  const [zoomErr,       setZoomErr]         = useState('');

  const activeOp  = operator ?? initOperator ?? null;
  const connected = !!mktKey && !!activeOp;

  // Populate form from operator data (server-side truth, takes priority).
  // Depends on the object itself (not just .id) so a fresh fetch — e.g. the
  // mount refresh below — re-populates the form even though the id is unchanged.
  useEffect(() => {
    if (!activeOp) return;
    setPName(activeOp.displayName ?? '');
    setPPhone(activeOp.supportPhone ?? '');
    setPUpiId(activeOp.upiId ?? '');
    setZoomConnected(activeOp.zoomConnected ?? false);
  }, [activeOp]);

  // initOperator is only a snapshot cached at login/signup time, and Plan B
  // isn't given one at all — so without this fetch `activeOp` stays null there,
  // which silently turned off the marketplace half of saveProfile: the UPI id
  // only ever reached the local settings row and never the account every other
  // device (and every player) reads. Refresh on mount for both plans so this
  // page reflects server truth.
  useEffect(() => {
    if (!mktKey) return;
    let cancelled = false;
    setOpLoading(true);
    mktGetInfo(mktKey)
      .then(info => { if (!cancelled) { setOperator(info.operator); setOpErr(''); } })
      .catch(e => { if (!cancelled) setOpErr(e instanceof Error ? e.message : 'Could not reach the marketplace'); })
      .finally(() => { if (!cancelled) setOpLoading(false); });
    return () => { cancelled = true; };
  }, [mktKey, reloadKey]);

  // Handle ?zoom=connected redirect back from Zoom OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zoomParam = params.get('zoom');
    if (zoomParam === 'connected') {
      setZoomConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (zoomParam === 'error') {
      setZoomErr(params.get('msg') || 'Zoom connection failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // For Plan B without marketplace connection: populate from local tambola state
  useEffect(() => {
    if (activeOp || isPlanA) return;
    if (tambola?.upiSettings?.upiId) setPUpiId(tambola.upiSettings.upiId);
    if (tambola?.upiSettings?.merchantName) setPName(tambola.upiSettings.merchantName);
  }, []);

  // Live QR preview
  useEffect(() => {
    const id = pUpiId.trim();
    if (!id) { setQrDataUrl(''); return; }
    const uri = `upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent(pName.trim() || id)}&cu=INR`;
    QRCode.toDataURL(uri, { width: 180, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [pUpiId, pName]);

  function retryConnection() {
    setReloadKey(n => n + 1);
  }

  async function saveProfile() {
    const canApi   = !!mktKey && !!activeOp;
    const canLocal = !isPlanA && !!tambola?.setUpiSettings;
    if (!canApi && !canLocal) return;

    setPSaving(true); setPErr(''); setPSaved(false);
    try {
      if (canApi) {
        const profile = {
          displayName:  pName.trim()  || null,
          supportPhone: pPhone.trim() || null,
          upiId:        pUpiId.trim() || null,
        };
        await mktUpdateProfile(mktKey, profile);
        // The session cached in localStorage (from login/signup) isn't otherwise
        // refreshed, so a reload would show blank/stale fields even though the
        // save succeeded server-side. Both plans read from it, so patch both.
        patchSessionOperator(profile);
        setOperator(prev => (prev ? { ...prev, ...profile } : prev));
      }
      if (canLocal) {
        await tambola!.setUpiSettings({
          upiId:        pUpiId.trim(),
          merchantName: pName.trim(),
          whatsappNumber: tambola!.upiSettings?.whatsappNumber,
        });
      }
      setPSaved(true); setTimeout(() => setPSaved(false), 2500);
    } catch (e) {
      setPErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setPSaving(false);
    }
  }

  const canSave = isPlanA ? !!activeOp : true;
  // Plan B can still save a local-only copy, but the operator should know the
  // marketplace didn't get it rather than seeing a bare "Saved!".
  const localOnly = !isPlanA && !!mktKey && !activeOp && !opLoading;

  async function connectZoom() {
    if (!mktKey) return;
    setZoomWorking(true); setZoomErr('');
    try {
      const { url } = await mktZoomAuthUrl(mktKey);
      window.location.href = url;
    } catch (e) {
      setZoomErr(e instanceof Error ? e.message : 'Failed');
      setZoomWorking(false);
    }
  }

  async function disconnectZoom() {
    if (!mktKey) return;
    setZoomWorking(true);
    try {
      await mktZoomDisconnect(mktKey);
      setZoomConnected(false);
    } catch (e) {
      setZoomErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setZoomWorking(false);
    }
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="max-w-lg space-y-3 pb-4">

        {/* Operator badge */}
        {activeOp && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm truncate">{activeOp.name}</p>
              <p className="text-white/30 text-xs">{activeOp.plan === 'own-sheets' ? 'Plan A · Own Sheets' : 'Plan B · Generate'}</p>
            </div>
            {connected
              ? <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              : <WifiOff className="w-4 h-4 text-white/20 shrink-0" />
            }
          </div>
        )}

        {/* Profile form */}
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Your Profile</p>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold block">Business / Display Name</label>
            <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="Shown to players in listings"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-400" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> Support Phone</label>
            <input type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+91 98765 43210"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-400" />
            <p className="text-[11px] text-white/25">Players see this number when they need help.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 font-semibold flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Your UPI ID</label>
            <input type="text" value={pUpiId} onChange={e => setPUpiId(e.target.value)} placeholder="yourname@upi"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-400 font-mono" />
            <p className="text-[11px] text-white/25">Players scan a QR generated from this ID to pay for your games.</p>
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2 mt-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <img src={qrDataUrl} alt="UPI QR preview" className="rounded-lg" style={{ width: 180, height: 180 }} />
                <p className="text-[11px] text-white/30 text-center">Preview QR · Scan to verify UPI ID</p>
              </div>
            )}
          </div>

          {pErr && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> {pErr}</p>}
          {localOnly && (
            <p className="text-amber-300/90 text-xs flex items-start gap-1.5">
              <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
              Marketplace unreachable — saving here keeps a local copy only. Players and your other
              devices won't see this UPI id until the connection above succeeds.
            </p>
          )}

          <button onClick={saveProfile} disabled={pSaving || !canSave}
            className={cn('w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-colors',
              pSaved ? 'bg-emerald-500' : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-40')}>
            {pSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
          </button>
          {isPlanA && !activeOp && (
            <p className="text-[11px] text-white/30 text-center">Connect your API key above to save profile.</p>
          )}
        </div>

        {/* Marketplace connection — Plan B only. The key is the one this device
            signed in with, so there is nothing to paste; what matters is
            whether the account is actually reachable right now. */}
        {!isPlanA && (
          <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-violet-400" /> Marketplace
            </p>

            {opLoading ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Loader2 className="w-4 h-4 text-white/40 animate-spin shrink-0" />
                <p className="text-white/50 text-sm">Checking your account…</p>
              </div>
            ) : activeOp ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{activeOp.name}</p>
                  <p className="text-emerald-400 text-xs">Connected · games and profile sync to all your devices</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">Not reachable</p>
                    <p className="text-red-300/80 text-xs break-words">{opErr || 'Your games and profile will not sync until this succeeds.'}</p>
                  </div>
                </div>
                <button onClick={retryConnection}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 flex items-center justify-center gap-1.5 transition-colors">
                  <Link2 className="w-4 h-4" /> Retry
                </button>
              </>
            )}
          </div>
        )}

        {/* Zoom Integration — only when API key is connected */}
        {!!mktKey && (
          <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Video className="w-3 h-3 text-blue-400" /> Zoom Integration
            </p>
            {zoomConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-sm text-white font-semibold">Zoom account connected</p>
                </div>
                <button onClick={disconnectZoom} disabled={zoomWorking}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 disabled:opacity-40">
                  {zoomWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />} Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-white/30">Connect your Zoom account so you can schedule meetings directly when creating games — the join link, Meeting ID and passcode will auto-fill.</p>
                <button onClick={connectZoom} disabled={zoomWorking}
                  className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors">
                  {zoomWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                  Connect Zoom Account
                </button>
              </div>
            )}
            {zoomErr && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> {zoomErr}</p>}
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

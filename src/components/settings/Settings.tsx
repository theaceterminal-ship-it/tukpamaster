import { useState } from 'react';
import { Key, CheckCircle, XCircle, Loader2, Link2, Unlink, Radio } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import { mktGetInfo } from '@/services/marketplaceApi';

interface SettingsProps {
  tambola: ReturnType<typeof useTambola>;
}

export function Settings({ tambola }: SettingsProps) {
  const { mktApiKey, setMktApiKey, mktGameId, setMktGameId } = tambola;

  const [inputKey, setInputKey]   = useState(mktApiKey);
  const [inputGameId, setInputGameId] = useState(mktGameId);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>(mktApiKey ? 'ok' : 'idle');
  const [opName, setOpName]       = useState('');
  const [opPlan, setOpPlan]       = useState('');
  const [errMsg, setErrMsg]       = useState('');

  async function connectKey() {
    const k = inputKey.trim();
    if (!k) return;
    setKeyStatus('checking'); setErrMsg('');
    try {
      const data = await mktGetInfo(k);
      setMktApiKey(k);
      setOpName(data.operator.name);
      setOpPlan(data.operator.plan === 'own-sheets' ? 'Plan A — Own Sheets' : 'Plan B — Generate per Game');
      setKeyStatus('ok');
    } catch (e: unknown) {
      setKeyStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  function disconnectKey() {
    setMktApiKey(''); setInputKey('');
    setKeyStatus('idle'); setOpName(''); setOpPlan('');
  }

  function saveGameId() {
    setMktGameId(inputGameId.trim());
  }

  function clearGameId() {
    setMktGameId(''); setInputGameId('');
  }

  const isConnected = keyStatus === 'ok' && mktApiKey;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-black text-white">Settings</h2>
        <p className="text-white/50 text-sm mt-0.5">Connect to Tungbola Marketplace for live number sync</p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-sky-600" />
          <span className="font-bold text-slate-800 text-sm">Marketplace API Key</span>
        </div>

        {isConnected && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800 text-sm truncate">{opName || 'Connected'}</p>
              {opPlan && <p className="text-green-600 text-xs">{opPlan}</p>}
            </div>
            <button
              onClick={disconnectKey}
              className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 shrink-0"
            >
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={inputKey}
            onChange={e => setInputKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connectKey()}
            placeholder="Paste your API key…"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            onClick={connectKey}
            disabled={keyStatus === 'checking' || !inputKey.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            style={{ backgroundColor: '#0284c7' }}
          >
            {keyStatus === 'checking'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Link2 className="w-4 h-4" />}
            Connect
          </button>
        </div>

        {keyStatus === 'error' && (
          <p className="text-red-600 text-sm flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />{errMsg}
          </p>
        )}

        <p className="text-xs text-slate-400">
          Get your API key from the TungbolaMarket admin panel → Operators tab.
        </p>
      </div>

      {/* Marketplace Game ID for live sync */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500" />
          <span className="font-bold text-slate-800 text-sm">Live Number Sync</span>
          {mktGameId && (
            <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
              Active
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500">
          Link a TungbolaMarket game ID here. Every number called in Live Game will instantly sync to Tungbola players watching that game.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={inputGameId}
            onChange={e => setInputGameId(e.target.value)}
            placeholder="Paste Marketplace game ID…"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            onClick={saveGameId}
            disabled={!inputGameId.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 shrink-0"
            style={{ backgroundColor: '#0284c7' }}
          >
            Save
          </button>
        </div>

        {mktGameId && (
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <p className="text-xs text-slate-500 font-medium">Linked game ID</p>
              <code className="text-xs font-mono text-slate-700">{mktGameId}</code>
            </div>
            <button onClick={clearGameId} className="text-xs text-red-500 font-semibold hover:text-red-700">
              Clear
            </button>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Find the game ID on the Marketplace tab after creating a game, or copy it from the TungbolaMarket admin panel.
        </p>
      </div>

      {/* Status summary */}
      <div className="bg-white/10 rounded-2xl p-4 space-y-2">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Connection Status</p>
        <div className="flex items-center gap-2">
          {isConnected
            ? <CheckCircle className="w-4 h-4 text-green-300" />
            : <XCircle className="w-4 h-4 text-white/30" />}
          <span className="text-sm text-white/70">
            Marketplace API {isConnected ? 'connected' : 'not connected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mktGameId
            ? <CheckCircle className="w-4 h-4 text-green-300" />
            : <XCircle className="w-4 h-4 text-white/30" />}
          <span className="text-sm text-white/70">
            Live sync {mktGameId ? 'active' : 'not configured'}
          </span>
        </div>
      </div>
    </div>
  );
}

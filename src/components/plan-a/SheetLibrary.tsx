import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Loader2, CheckCircle, AlertCircle, X,
  FileText, RefreshCw, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import JSZip from 'jszip';
import { upload } from '@vercel/blob/client';
import { mktSheetLibraryStats, mktRegisterSheet } from '@/services/marketplaceApi';

const HANDLE_UPLOAD_URL = 'https://tungbola-market.vercel.app/api/operator';
const CONCURRENCY = 20;

interface Props { apiKey: string; }

type QueueTask = {
  file: File;
  num: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
};

function parseSheetNum(filename: string): number | null {
  const nums = filename.replace(/\.pdf$/i, '').match(/\d+/g);
  return nums ? parseInt(nums[nums.length - 1]) : null;
}

export function SheetLibrary({ apiKey }: Props) {
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [resultMsg, setResultMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await mktSheetLibraryStats(apiKey);
      setLibraryCount(data.count);
    } catch {
      setLibraryCount(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setExtractMsg('');

    setExtracting(true);
    let collected: QueueTask[] = [];

    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().match(/\.(jpg|jpeg|png)$/));
    const zips = files.filter(f => f.name.toLowerCase().endsWith('.zip'));

    pdfs.forEach(f => {
      const num = parseSheetNum(f.name);
      if (num && num >= 1 && num <= 9999) collected.push({ file: f, num, status: 'pending' });
    });

    for (const zipFile of zips) {
      setExtractMsg(`Extracting ${zipFile.name}…`);
      try {
        const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
        const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
        zip.forEach((path, entry) => {
          if (!entry.dir && path.toLowerCase().endsWith('.pdf')) entries.push({ path, entry });
        });
        for (let i = 0; i < entries.length; i++) {
          if (i % 50 === 0) {
            setExtractMsg(`Extracting ${zipFile.name}… ${i}/${entries.length}`);
            await new Promise(r => setTimeout(r, 0));
          }
          const filename = entries[i].path.split('/').pop()!.split('\\').pop()!;
          const num = parseSheetNum(filename);
          if (!num || num < 1 || num > 9999) continue;
          const ab = await entries[i].entry.async('arraybuffer');
          collected.push({ file: new File([ab], filename, { type: 'application/pdf' }), num, status: 'pending' });
        }
      } catch (err) {
        setExtracting(false);
        setExtractMsg(`ZIP error: ${err instanceof Error ? err.message : 'Failed to read ZIP'}`);
        return;
      }
    }

    // Deduplicate by sheet number (keep first)
    const seen = new Set<number>();
    collected = collected.filter(t => { if (seen.has(t.num)) return false; seen.add(t.num); return true; });

    setExtracting(false);
    if (!collected.length) {
      setExtractMsg('No valid sheets found — filenames must contain a number (e.g. sheet-042.pdf).');
      return;
    }
    setExtractMsg(`${collected.length} sheet${collected.length !== 1 ? 's' : ''} ready to upload`);

    setTasks(prev => {
      const existingNums = new Set(prev.map(t => t.num));
      return [...prev, ...collected.filter(c => !existingNums.has(c.num))];
    });
  };

  const updateTask = useCallback((num: number, update: Partial<QueueTask>) => {
    setTasks(prev => prev.map(t => t.num === num ? { ...t, ...update } : t));
  }, []);

  const handleUploadAll = async () => {
    const pending = tasks.filter(t => t.status === 'pending');
    if (!pending.length) return;

    setUploading(true);
    setResultMsg('');
    setDone(0); setFailed(0);
    const total = pending.length;
    setUploadTotal(total);

    let doneCount = 0;
    let failCount = 0;
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= total) break;
        const task = pending[i];
        updateTask(task.num, { status: 'uploading' });
        try {
          const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
          const ext = task.file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
          const pathname = `tungbola/op-sheets/${String(task.num).padStart(5, '0')}-${id}.${ext}`;
          const blob = await upload(pathname, task.file, {
            access: 'public',
            handleUploadUrl: HANDLE_UPLOAD_URL,
            clientPayload: JSON.stringify({ apiKey, sheetNum: task.num, filename: task.file.name }),
          });
          await mktRegisterSheet(apiKey, task.num, task.file.name, blob.url);
          updateTask(task.num, { status: 'done' });
          doneCount++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed';
          updateTask(task.num, { status: 'error', error: msg });
          failCount++;
        }
        setDone(doneCount);
        setFailed(failCount);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    setUploading(false);
    if (failCount === 0) {
      setResultMsg(`✓ ${doneCount} sheet${doneCount !== 1 ? 's' : ''} uploaded!`);
    } else {
      setResultMsg(`${doneCount} uploaded · ${failCount} failed`);
    }
    loadStats();
  };

  const removeTask = (num: number) => setTasks(prev => prev.filter(t => t.num !== num));
  const clearDone = () => setTasks(prev => prev.filter(t => t.status !== 'done'));
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const doneInQueue = tasks.filter(t => t.status === 'done').length;
  const progress = uploadTotal > 0 ? Math.round(((done + failed) / uploadTotal) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Sheet Library</h2>
          <p className="text-white/50 text-sm mt-0.5">
            Upload ZIP archives or individual PDFs — {CONCURRENCY} concurrent uploads.
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/10 rounded-xl p-4 text-center">
          {statsLoading
            ? <Loader2 className="w-6 h-6 text-white/50 animate-spin mx-auto" />
            : <p className="text-3xl font-black text-white">{(libraryCount ?? 0).toLocaleString()}</p>
          }
          <p className="text-white/50 text-xs mt-1">In Library</p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-emerald-300">{done}</p>
          <p className="text-white/50 text-xs mt-1">Uploaded</p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 text-center">
          <p className={`text-3xl font-black ${failed > 0 ? 'text-red-300' : 'text-white/30'}`}>{failed}</p>
          <p className="text-white/50 text-xs mt-1">Failed</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors select-none"
            onClick={() => !extracting && !uploading && fileInputRef.current?.click()}
          >
            {extracting ? (
              <>
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">{extractMsg || 'Extracting…'}</p>
              </>
            ) : (
              <>
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  Drop <strong>ZIP archives</strong> or individual <strong>PDFs / images</strong>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Sheet # auto-detected from filename — <code className="bg-slate-100 px-1 rounded">sheet-042.pdf</code> → #42
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multiple ZIPs supported · {CONCURRENCY} parallel uploads
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.zip,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Status messages */}
          {extractMsg && !extracting && (
            <p className={`text-sm font-medium ${extractMsg.startsWith('ZIP error') || extractMsg.startsWith('No valid') ? 'text-red-600' : 'text-emerald-700'}`}>
              {extractMsg}
            </p>
          )}
          {resultMsg && !uploading && (
            <p className={`text-sm font-medium ${resultMsg.includes('failed') ? 'text-amber-600' : 'text-emerald-700'}`}>
              {resultMsg}
            </p>
          )}

          {/* Upload progress bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Uploading {done + failed} / {uploadTotal}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue */}
          {tasks.length > 0 && (
            <>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {tasks.map(task => (
                  <div
                    key={task.num}
                    className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{task.file.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400">Sheet</span>
                        <input
                          type="number"
                          value={task.num}
                          onChange={e => setTasks(prev =>
                            prev.map(t => t.num === task.num ? { ...t, num: Number(e.target.value) } : t)
                          )}
                          min={1}
                          max={9999}
                          disabled={task.status !== 'pending'}
                          className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:bg-slate-100"
                        />
                        <span className="text-[10px] text-slate-400">
                          {(task.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {task.error && (
                        <span className="text-[10px] text-red-500 max-w-[90px] truncate" title={task.error}>
                          {task.error}
                        </span>
                      )}
                      {task.status === 'pending' && !uploading && (
                        <button onClick={() => removeTask(task.num)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {task.status === 'uploading' && <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />}
                      {task.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {task.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                {pendingCount > 0 && (
                  <Button
                    onClick={handleUploadAll}
                    disabled={uploading || extracting}
                    className="flex-1 gap-2 font-bold text-white"
                    style={{ backgroundColor: '#0284c7' }}
                  >
                    {uploading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {done + failed}/{uploadTotal}</>
                      : <><Upload className="w-4 h-4" /> Upload {pendingCount.toLocaleString()} Sheet{pendingCount !== 1 ? 's' : ''}</>
                    }
                  </Button>
                )}
                {doneInQueue > 0 && !uploading && (
                  <button
                    onClick={clearDone}
                    className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    Clear done ({doneInQueue})
                  </button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

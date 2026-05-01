import { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle, X, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mktUploadSheet, mktSheetLibraryStats } from '@/services/marketplaceApi';

interface Props { apiKey: string; }

type QueueItem = {
  file: File;
  sheetNum: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
};

export function SheetLibrary({ apiKey }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await mktSheetLibraryStats(apiKey);
      setCount(data.count);
    } catch {
      setCount(0);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const items: QueueItem[] = files.map((f, i) => {
      const match = f.name.match(/(\d+)/);
      const sheetNum = match ? parseInt(match[1], 10) : (queue.length + i + 1);
      return { file: f, sheetNum, status: 'pending' };
    });
    setQueue(prev => [...prev, ...items]);
    e.target.value = '';
  };

  const updateItem = (idx: number, update: Partial<QueueItem>) => {
    setQueue(prev => prev.map((item, i) => i === idx ? { ...item, ...update } : item));
  };

  const removeItem = (idx: number) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUploadAll = async () => {
    const pending = queue.filter(q => q.status === 'pending');
    if (!pending.length) return;
    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== 'pending') continue;
      updateItem(i, { status: 'uploading' });
      try {
        const base64 = await fileToBase64(queue[i].file);
        await mktUploadSheet(apiKey, queue[i].sheetNum, queue[i].file.name, base64);
        updateItem(i, { status: 'done' });
        uploaded++;
      } catch (e) {
        updateItem(i, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
      }
    }
    setUploading(false);
    if (uploaded > 0) loadStats();
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const doneCount = queue.filter(q => q.status === 'done').length;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Sheet Library</h2>
          <p className="text-white/50 text-sm mt-0.5">Upload pre-printed sheets to your marketplace library.</p>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/10 rounded-xl p-4 text-center">
          {statsLoading ? (
            <Loader2 className="w-6 h-6 text-white/50 animate-spin mx-auto" />
          ) : (
            <p className="text-3xl font-black text-white">{count ?? 0}</p>
          )}
          <p className="text-white/50 text-xs mt-1">Sheets in Library</p>
        </div>
        <div className="bg-white/10 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-amber-300">{doneCount}</p>
          <p className="text-white/50 text-xs mt-1">Uploaded this session</p>
        </div>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Click to select PDF or image files</p>
            <p className="text-xs text-slate-400 mt-1">
              Sheet # auto-detected from filename (e.g. <code>sheet-042.pdf</code> → #42)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {queue.length > 0 && (
            <>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {queue.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{item.file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">Sheet #</span>
                        <input
                          type="number"
                          value={item.sheetNum}
                          onChange={e => updateItem(i, { sheetNum: Number(e.target.value) })}
                          min={1}
                          disabled={item.status !== 'pending'}
                          className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                    <div className="shrink-0">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => removeItem(i)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />}
                      {item.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {item.status === 'error' && (
                        <div title={item.error}>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pendingCount > 0 && (
                <Button
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="w-full gap-2 font-bold text-white"
                  style={{ backgroundColor: '#0284c7' }}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload {pendingCount} Sheet{pendingCount !== 1 ? 's' : ''}
                </Button>
              )}

              {pendingCount === 0 && doneCount > 0 && (
                <button
                  onClick={() => setQueue([])}
                  className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear completed
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

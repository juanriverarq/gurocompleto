import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import saasApi from 'src/services/saasApi';

export interface RuntSyncProgress {
  index: number;
  total: number;
  placa: string;
  status: string;
  success: number;
  failed: number;
  skipped: number;
  message?: string;
}

export interface RuntSyncDone {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  cancelled?: boolean;
  batches?: number;
}

interface RuntSyncContextType {
  loading: boolean;
  stopping: boolean;
  progress: RuntSyncProgress | null;
  done: RuntSyncDone | null;
  start: (opts: { onlyPending: boolean; limit: number }) => void;
  stop: () => void;
  clearDone: () => void;
}

const defaultValue: RuntSyncContextType = {
  loading: false,
  stopping: false,
  progress: null,
  done: null,
  start: () => {},
  stop: () => {},
  clearDone: () => {},
};

const RuntSyncContext = createContext<RuntSyncContextType>(defaultValue);

export const useRuntSync = () => useContext(RuntSyncContext);

export const RuntSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<RuntSyncProgress | null>(null);
  const [done, setDone] = useState<RuntSyncDone | null>(null);
  const onDoneCallbacksRef = useRef<Array<() => void>>([]);
  const abortCtrlRef = useRef<AbortController | null>(null);
  // Accumulators across consecutive batches (auto-chain)
  const cumulativeRef = useRef({ total: 0, success: 0, failed: 0, skipped: 0, batches: 0 });
  const stopRequestedRef = useRef(false);
  const optsRef = useRef<{ onlyPending: boolean; limit: number } | null>(null);

  const runBatch = useCallback(() => {
    const opts = optsRef.current;
    if (!opts) return;
    abortCtrlRef.current = new AbortController();
    saasApi.syncRuntMasivoStream(
      { ...opts, signal: abortCtrlRef.current.signal },
      (data) => {
        const c = cumulativeRef.current;
        // Show cumulative counts in the progress widget
        setProgress({
          ...data,
          success: c.success + (data.success || 0),
          failed: c.failed + (data.failed || 0),
          skipped: c.skipped + (data.skipped || 0),
        });
      },
      (data) => {
        const c = cumulativeRef.current;
        c.total += data.total || 0;
        c.success += data.success || 0;
        c.failed += data.failed || 0;
        c.skipped += data.skipped || 0;
        c.batches += 1;
        abortCtrlRef.current = null;

        const batchSize = opts.limit;
        const batchProcessedAll = (data.total || 0) >= batchSize;
        const userCancelled = data.cancelled || stopRequestedRef.current;

        // Auto-chain: if this batch was full AND not cancelled AND there might be more
        if (!userCancelled && batchProcessedAll) {
          // Continue with next batch
          setTimeout(() => runBatch(), 150);
        } else {
          // Done for real — no more pending OR user cancelled
          setDone({
            total: c.total,
            success: c.success,
            failed: c.failed,
            skipped: c.skipped,
            cancelled: userCancelled,
            batches: c.batches,
          });
          setProgress(null);
          setLoading(false);
          setStopping(false);
          stopRequestedRef.current = false;
          onDoneCallbacksRef.current.forEach((cb) => cb());
          onDoneCallbacksRef.current = [];
        }
      },
      (err) => {
        const c = cumulativeRef.current;
        setDone({
          total: c.total,
          success: c.success,
          failed: c.failed + 1,
          skipped: c.skipped,
          batches: c.batches,
        });
        setProgress(null);
        setLoading(false);
        setStopping(false);
        stopRequestedRef.current = false;
        abortCtrlRef.current = null;
        console.error('RUNT sync error:', err);
      },
    );
  }, []);

  const start = useCallback((opts: { onlyPending: boolean; limit: number }) => {
    if (loading) return;
    setLoading(true);
    setStopping(false);
    setDone(null);
    setProgress(null);
    cumulativeRef.current = { total: 0, success: 0, failed: 0, skipped: 0, batches: 0 };
    stopRequestedRef.current = false;
    optsRef.current = opts;
    runBatch();
  }, [loading, runBatch]);

  const stop = useCallback(() => {
    if (!loading) return;
    stopRequestedRef.current = true;
    setStopping(true);
    if (abortCtrlRef.current) {
      try { abortCtrlRef.current.abort(); } catch { /* ignore */ }
    }
  }, [loading]);

  const clearDone = useCallback(() => setDone(null), []);

  return (
    <RuntSyncContext.Provider value={{ loading, stopping, progress, done, start, stop, clearDone }}>
      {children}
    </RuntSyncContext.Provider>
  );
};

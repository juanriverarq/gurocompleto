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

  const runBatch = useCallback(async () => {
    const opts = optsRef.current;
    if (!opts) return;
    abortCtrlRef.current = new AbortController();

    // Mostrar progreso "indeterminado" mientras se procesa el batch (el modo
    // JSON no envía actualizaciones por-vehículo; sólo contadores al final).
    const c = cumulativeRef.current;
    setProgress({
      index: 0,
      total: opts.limit,
      placa: '',
      status: 'processing',
      success: c.success,
      failed: c.failed,
      skipped: c.skipped,
      message: 'Procesando lote...',
    });

    try {
      const data = await saasApi.syncRuntMasivoJson({ ...opts, signal: abortCtrlRef.current.signal });
      abortCtrlRef.current = null;

      const batchTotal = data.total || 0;
      const batchSuccess = data.success_count || 0;
      const batchFailed = data.failed || 0;
      const batchSkipped = data.skipped || 0;

      c.total += batchTotal;
      c.success += batchSuccess;
      c.failed += batchFailed;
      c.skipped += batchSkipped;
      c.batches += 1;

      const batchProcessedAll = batchTotal >= opts.limit;
      const userCancelled = stopRequestedRef.current;

      if (!userCancelled && batchProcessedAll) {
        // Mostrar progreso acumulado entre lotes
        setProgress({
          index: c.total,
          total: c.total + opts.limit, // approx — siguiente lote
          placa: '',
          status: 'processing',
          success: c.success,
          failed: c.failed,
          skipped: c.skipped,
        });
        setTimeout(() => { runBatch(); }, 150);
      } else {
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
    } catch (err: any) {
      abortCtrlRef.current = null;
      // Cancelación explícita por el usuario
      if (err?.name === 'AbortError' || stopRequestedRef.current) {
        const c2 = cumulativeRef.current;
        setDone({
          total: c2.total,
          success: c2.success,
          failed: c2.failed,
          skipped: c2.skipped,
          cancelled: true,
          batches: c2.batches,
        });
      } else {
        const c2 = cumulativeRef.current;
        setDone({
          total: c2.total,
          success: c2.success,
          failed: c2.failed + 1,
          skipped: c2.skipped,
          batches: c2.batches,
        });
        console.error('RUNT sync error:', err);
      }
      setProgress(null);
      setLoading(false);
      setStopping(false);
      stopRequestedRef.current = false;
    }
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

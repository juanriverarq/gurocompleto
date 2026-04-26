import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import saasApi from '../../../../services/saasApi';

import suraLogo from '../../../../assets/images/logoscompanias/sura.png';
import bolivarLogo from '../../../../assets/images/logoscompanias/bolivar.png';
import hdiLogo from '../../../../assets/images/logoscompanias/hdi.png';
import estadoLogo from '../../../../assets/images/logoscompanias/estado.png';
import equidadLogo from '../../../../assets/images/logoscompanias/equidad.png';
import axaLogo from '../../../../assets/images/logoscompanias/axa.png';
import mapfreLogo from '../../../../assets/images/logoscompanias/mapfre.png';
import allianzLogo from '../../../../assets/images/logoscompanias/allianz.png';

const LOGOS: Record<string, string> = {
  sura: suraLogo,
  bolivar: bolivarLogo,
  hdi: hdiLogo,
  'seguros-del-estado': estadoLogo,
  'la-equidad': equidadLogo,
  equidad: equidadLogo,
  'axa-colpatria': axaLogo,
  axa: axaLogo,
  mapfre: mapfreLogo,
  allianz: allianzLogo,
};
const NAMES: Record<string, string> = {
  sura: 'Sura',
  bolivar: 'Bolívar',
  hdi: 'HDI',
  'axa-colpatria': 'AXA',
  'seguros-del-estado': 'Estado',
  'la-equidad': 'La Equidad',
  equidad: 'La Equidad',
  axa: 'AXA',
  mapfre: 'Mapfre',
  allianz: 'Allianz',
};

interface Connection {
  insurer_code: string; status: string; last_error?: string; last_sync_at?: string;
  auto_reconnect_available?: boolean; credentials_valid?: boolean; ttl_seconds?: number | null;
}
interface SyncBatch {
  batch_id: string;
  overall_status: string;
  started_at: string;
  finished_at: string | null;
  insurers: Record<string, { status: string; types: string[]; progress?: any; error?: string }>;
}

const relativeTime = (iso: string | null) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

const InsurerStatus = () => {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [history, setHistory] = useState<SyncBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'connections' | 'history'>('connections');
  const [cancellingBatchId, setCancellingBatchId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const reconnectCount = connections.filter((c) => c.status === 'reconnect_required' || c.status === 'error').length;

  /** Terminal en DB; evita spinner eterno si overall_status quedó desincronizado. */
  const isTerminalSyncStatus = (s: string | undefined) =>
    s === 'completed' || s === 'failed' || s === 'cancelled';

  const batchHasLiveJobs = (b: SyncBatch) => {
    const rows = Object.values(b.insurers || {});
    if (rows.length === 0) return b.overall_status === 'processing';
    return rows.some((row) => !isTerminalSyncStatus(row?.status));
  };

  /** Alinea etiqueta/icono con filas reales si el overall del API quedó obsoleto. */
  const effectiveBatchStatus = (b: SyncBatch): string => {
    const rows = Object.values(b.insurers || {});
    if (rows.length === 0) return b.overall_status;
    if (rows.some((row) => !isTerminalSyncStatus(row?.status))) return b.overall_status;
    if (rows.every((row) => row?.status === 'completed')) return 'completed';
    if (rows.every((row) => row?.status === 'cancelled')) return 'cancelled';
    if (rows.every((row) => row?.status === 'failed')) return 'failed';
    return 'partial';
  };

  const hasActiveSyncs = history.some((b) => b.overall_status === 'processing' && batchHasLiveJobs(b));

  const load = useCallback(async () => {
    try {
      const [connRes, histRes] = await Promise.all([
        saasApi.getInsurerConnections(),
        saasApi.getSyncHistory(10),
      ]);
      if (Array.isArray(connRes?.data)) setConnections(connRes.data);
      if (Array.isArray(histRes?.data)) setHistory(histRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, hasActiveSyncs ? 5000 : 30000);
    return () => clearInterval(iv);
  }, [load, hasActiveSyncs]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const statusBadge = (conn: Connection) => {
    const s = conn.status;
    if (s === 'connected') return { icon: 'solar:check-circle-bold', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Conectada' };
    if (s === 'credentials_invalid' || conn.credentials_valid === false) return { icon: 'solar:shield-warning-bold', color: 'text-red-400', bg: 'bg-red-500/10', label: 'Credenciales' };
    if ((s === 'reconnect_required' || s === 'error') && conn.auto_reconnect_available) return { icon: 'svg-spinners:ring-resize', color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Reconectando...' };
    if (s === 'reconnect_required' || s === 'error') return { icon: 'solar:danger-triangle-bold', color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Reconectar' };
    if (s === 'disconnected') return { icon: 'solar:close-circle-bold', color: 'text-neutral-500', bg: 'bg-neutral-500/10', label: 'Desconectada' };
    return { icon: 'solar:question-circle-bold', color: 'text-neutral-500', bg: 'bg-neutral-500/10', label: s };
  };

  const syncStatusInfo = (s: string) => {
    switch (s) {
      case 'completed': return { icon: 'solar:check-circle-bold', color: 'text-emerald-400', label: 'Completada' };
      case 'processing': return { icon: 'svg-spinners:ring-resize', color: 'text-[#573CFF]', label: 'En proceso' };
      case 'partial': return { icon: 'solar:danger-triangle-bold', color: 'text-amber-400', label: 'Parcial' };
      case 'failed': return { icon: 'solar:danger-triangle-bold', color: 'text-red-400', label: 'Fallida' };
      case 'cancelled': return { icon: 'solar:stop-circle-bold', color: 'text-amber-300', label: 'Detenida' };
      case 'pending': return { icon: 'solar:clock-circle-bold', color: 'text-neutral-400', label: 'Pendiente' };
      default: return { icon: 'solar:clock-circle-bold', color: 'text-neutral-400', label: s };
    }
  };

  const cancelBatch = async (batchId: string) => {
    try {
      setCancellingBatchId(batchId);
      await saasApi.cancelSync(batchId);
      await load();
    } catch {
      // ignore to keep dropdown resilient
    } finally {
      setCancellingBatchId(null);
    }
  };

  const iconColor = reconnectCount > 0
    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
    : hasActiveSyncs
      ? 'text-[#573CFF] bg-[#573CFF]/10'
      : 'text-gray-500 dark:text-gray-300 hover:text-[#573CFF] hover:bg-[#573CFF]/10';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative h-10 w-10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer transition-colors ${iconColor}`}
      >
        {hasActiveSyncs ? (
          <Icon icon="svg-spinners:ring-resize" width="18" />
        ) : (
          <Icon
            icon={reconnectCount > 0 ? 'solar:danger-triangle-bold-duotone' : 'solar:shield-check-bold-duotone'}
            width="20"
          />
        )}
        {reconnectCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
            {reconnectCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[380px] rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111112] shadow-xl dark:shadow-2xl z-[999] overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-neutral-800/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Integraciones</h3>
              <div className="flex items-center gap-2">
                {hasActiveSyncs && (
                  <button
                    onClick={() => {
                      const activeBatch = history.find((b) => b.overall_status === 'processing' && batchHasLiveJobs(b));
                      if (activeBatch) cancelBatch(activeBatch.batch_id);
                    }}
                    disabled={!!cancellingBatchId}
                    className="text-[11px] px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                  >
                    {cancellingBatchId ? 'Deteniendo...' : 'Detener'}
                  </button>
                )}
                <button
                  onClick={() => { setOpen(false); nav('/apps/integraciones/apis-aseguradoras'); }}
                  className="text-[11px] text-[#573CFF] dark:text-[#a78bfa] hover:text-[#4b31e6] dark:hover:text-white transition-colors"
                >
                  Ver todo
                </button>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setTab('connections')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'connections' ? 'bg-[#573CFF]/15 text-[#573CFF] dark:text-[#a78bfa]' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-neutral-300'}`}
              >
                Conexiones
                {reconnectCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">{reconnectCount}</span>}
              </button>
              <button
                onClick={() => setTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'history' ? 'bg-[#573CFF]/15 text-[#a78bfa]' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Sincronizaciones
                {hasActiveSyncs && <span className="ml-1.5 w-2 h-2 rounded-full bg-[#573CFF] inline-block animate-pulse" />}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Icon icon="svg-spinners:ring-resize" width={24} className="text-[#573CFF]" />
              </div>
            ) : tab === 'connections' ? (
              connections.length === 0 ? (
                <div className="py-10 text-center">
                  <Icon icon="solar:shield-check-bold-duotone" width={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-neutral-500">Sin aseguradoras conectadas</p>
                  <button
                    onClick={() => { setOpen(false); nav('/apps/integraciones/apis-aseguradoras'); }}
                    className="mt-2 text-[11px] text-[#573CFF] dark:text-[#a78bfa] hover:text-[#4b31e6] dark:hover:text-white"
                  >
                    Conectar aseguradora
                  </button>
                </div>
              ) : (
                <div className="py-1">
                  {connections.map((conn) => {
                    const badge = statusBadge(conn);
                    return (
                      <div
                        key={conn.insurer_code}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                        onClick={() => { setOpen(false); nav('/apps/integraciones/apis-aseguradoras'); }}
                      >
                        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
                          {LOGOS[conn.insurer_code] ? (
                            <img src={LOGOS[conn.insurer_code]} alt="" className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="text-[8px] font-bold text-[#111]">{(NAMES[conn.insurer_code] || conn.insurer_code).slice(0, 3)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-gray-900 dark:text-white font-medium">{NAMES[conn.insurer_code] || conn.insurer_code}</p>
                          {conn.last_error && conn.status !== 'connected' && (
                            <p className="text-[10px] text-amber-400/80 truncate">{conn.last_error}</p>
                          )}
                          {conn.last_sync_at && conn.status === 'connected' && (
                            <p className="text-[10px] text-neutral-500">Sync: {relativeTime(conn.last_sync_at)}</p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.color}`}>
                          <Icon icon={badge.icon} width={12} />
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              history.length === 0 ? (
                <div className="py-10 text-center">
                  <Icon icon="solar:refresh-bold-duotone" width={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-neutral-500">Sin sincronizaciones recientes</p>
                </div>
              ) : (
                <div className="py-1">
                  {history.map((batch) => {
                    const si = syncStatusInfo(effectiveBatchStatus(batch));
                    const insurerCodes = Object.keys(batch.insurers);
                    const types = new Set<string>();
                    Object.values(batch.insurers).forEach((i) => i.types?.forEach((t: string) => types.add(t)));

                    const isProcessing = batch.overall_status === 'processing' && batchHasLiveJobs(batch);

                    return (
                      <div key={batch.batch_id} className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800/40 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon icon={si.icon} width={16} className={si.color} />
                            <span className={`text-xs font-medium ${si.color}`}>{si.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 dark:text-neutral-600">{relativeTime(batch.started_at)}</span>
                            {isProcessing && (
                              <button
                                onClick={() => cancelBatch(batch.batch_id)}
                                disabled={cancellingBatchId === batch.batch_id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                              >
                                {cancellingBatchId === batch.batch_id ? '...' : 'Detener'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Insurer pills */}
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {insurerCodes.map((code) => {
                            const ist = batch.insurers[code];
                            const isi = syncStatusInfo(ist.status);
                            return (
                              <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800/80 text-[10px]">
                                {LOGOS[code] && (
                                  <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-700 shrink-0">
                                    <img src={LOGOS[code]} alt="" className="w-2 h-2 object-contain" />
                                  </div>
                                )}
                                <span className="text-gray-700 dark:text-neutral-300">{NAMES[code] || code}</span>
                                <Icon icon={isi.icon} width={10} className={isi.color} />
                              </span>
                            );
                          })}
                        </div>

                        {/* Types synced */}
                        <p className="text-[10px] text-gray-400 dark:text-neutral-600">
                          {Array.from(types).map((t) => t === 'clientes' ? 'Clientes' : t === 'polizas' ? 'Pólizas' : 'Cartera').join(', ')}
                        </p>

                        {/* Show errors inline */}
                        {Object.entries(batch.insurers).map(([code, ist]) => {
                          if (!ist.error) return null;
                          return (
                            <p key={code} className="text-[10px] text-red-400/80 mt-1 truncate">
                              {NAMES[code] || code}: {ist.error}
                            </p>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurerStatus;

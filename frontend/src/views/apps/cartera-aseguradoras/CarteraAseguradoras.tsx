import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import saasApi from '../../../services/saasApi';
import suraLogo from '../../../assets/images/logoscompanias/sura.png';
import bolivarLogo from '../../../assets/images/logoscompanias/bolivar.png';
import hdiLogo from '../../../assets/images/logoscompanias/hdi.png';
import axaLogo from '../../../assets/images/logoscompanias/axa.png';
import estadoLogo from '../../../assets/images/logoscompanias/estado.png';
import equidadLogo from '../../../assets/images/logoscompanias/equidad.png';
import mapfreLogo from '../../../assets/images/logoscompanias/mapfre.png';
import qualitasLogo from '../../../assets/images/logoscompanias/qualitas.svg';
import allianzLogo from '../../../assets/images/logoscompanias/allianz.png';

// ─── Types ───────────────────────────────────────────────────────
// Cada fila representa UNA PÓLIZA con sus cuotas pendientes consolidadas.
// El backend agrupa múltiples filas de cuotas en una sola.
interface CarteraRow {
  id: number;
  insurer_code: string;
  insurer_name: string;
  policy_number: string;
  client_name: string;
  client_document: string;
  client_doc_type: string | null;
  ramo: string | null;
  product_name: string | null;

  // Valores de prima (varios ángulos):
  //   - prima_poliza : prima real contratada (de `polizas.premium_amount`). 0 si no hay match.
  //   - prima_cuotas : suma de importes SOLO de las cuotas pendientes.
  //   - prima_total  : usar prima_poliza si > 0, sino fallback a prima_cuotas.
  prima_total: number;
  prima_poliza?: number;
  prima_cuotas?: number;

  valor_pendiente: number;              // saldo real pendiente (suma de cuotas por pagar)
  valor_pagado: number;                 // abonos SOLO de cuotas pendientes
  valor_pagado_total?: number;          // prima_poliza - valor_pendiente (si prima_poliza > 0)
  bonificacion: number;
  dias_mora: number;                    // MAX de días de mora entre cuotas
  rango_mora: string;
  fecha_inicio_vigencia: string | null;
  fecha_expedicion: string | null;
  fecha_vencimiento: string | null;     // próxima cuota por vencer (MIN)
  proxima_cuota_vence?: string | null;
  ultima_cuota_vence?: string | null;   // última cuota por vencer (MAX)
  numero_recibo: string | null;
  numero_pagare: string | null;
  cuotas_pagadas: number | null;
  cuotas_mora: number | null;
  total_cuotas: number | null;
  cuotas_pendientes?: number;           // cuotas con saldo (count del backend)
  synced_at: string | null;
}

interface CuotaDetalle {
  id: number;
  numero_recibo: string | null;
  numero_pagare: string | null;
  prima_total: number | string;
  valor_pagado: number | string;
  valor_pendiente: number | string;
  fecha_vencimiento: string | null;
  fecha_inicio_vigencia: string | null;
  dias_mora: number;
  rango_mora: string;
}

interface Stats {
  totals: { items: number; cuotas_pendientes?: number; valor_pendiente: number; total_primas: number; last_sync: string | null };
  tab_counts: Record<string, number>;
  by_insurer: { insurer_code: string; insurer_name: string; count: number; total_pendiente: number; max_dias_mora: number }[];
}

const TABS = [
  { key: 'todos', label: 'Todos', icon: 'solar:list-bold-duotone' },
  { key: 'mora_90_plus', label: '+90 días', icon: 'solar:danger-triangle-bold-duotone', color: '#ef4444' },
  { key: 'mora_90', label: '61-90 días', icon: 'solar:shield-warning-bold-duotone', color: '#f97316' },
  { key: 'mora_60', label: '31-60 días', icon: 'solar:bell-bold-duotone', color: '#eab308' },
  { key: 'mora_30', label: '1-30 días', icon: 'solar:clock-circle-bold-duotone', color: '#3b82f6' },
  { key: 'al_dia', label: 'Al día', icon: 'solar:check-circle-bold-duotone', color: '#22c55e' },
];

const INSURER_LOGOS: Record<string, string> = {
  sura: suraLogo,
  bolivar: bolivarLogo,
  hdi: hdiLogo,
  'axa-colpatria': axaLogo,
  'seguros-del-estado': estadoLogo,
  'la-equidad': equidadLogo,
  mapfre: mapfreLogo,
  qualitas: qualitasLogo,
  allianz: allianzLogo,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const moraBadge = (dias: number) => {
  if (dias <= 0) return { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', label: 'Al día' };
  if (dias <= 30) return { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', label: `${dias}d` };
  if (dias <= 60) return { bg: 'bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', label: `${dias}d` };
  if (dias <= 90) return { bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', label: `${dias}d` };
  return { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400', label: `${dias}d` };
};

const moraColor = (dias: number) => {
  if (dias <= 0) return '#22c55e';
  if (dias <= 30) return '#3b82f6';
  if (dias <= 60) return '#eab308';
  if (dias <= 90) return '#f97316';
  return '#ef4444';
};

// ─── Component ───────────────────────────────────────────────────
const CarteraAseguradoras: React.FC = () => {
  const nav = useNavigate();
  const [items, setItems] = useState<CarteraRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [insurerFilter, setInsurerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 });
  const [syncing, setSyncing] = useState(false);
  const [syncBatchId, setSyncBatchId] = useState<string | null>(null);
  const [cancellingSync, setCancellingSync] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [msDiagLoading, setMsDiagLoading] = useState(false);
  const [msDiagText, setMsDiagText] = useState('');
  const [detailRow, setDetailRow] = useState<CarteraRow | null>(null);
  const [detailComisiones, setDetailComisiones] = useState<{ items: any[]; totales: any } | null>(null);
  const [detailComisionesLoading, setDetailComisionesLoading] = useState(false);
  const [detailCuotas, setDetailCuotas] = useState<{ items: CuotaDetalle[]; totales: any } | null>(null);
  const [detailCuotasLoading, setDetailCuotasLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Cargar comisiones + cuotas de la póliza cuando se abre el modal
  useEffect(() => {
    if (!detailRow?.policy_number) {
      setDetailComisiones(null);
      setDetailCuotas(null);
      return;
    }
    let cancelled = false;
    const pn = detailRow.policy_number;

    setDetailComisionesLoading(true);
    setDetailComisiones(null);
    saasApi.getRecibosComisionesByPolicy(pn)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setDetailComisiones(res.data);
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setDetailComisionesLoading(false); });

    setDetailCuotasLoading(true);
    setDetailCuotas(null);
    saasApi.getCarteraAseguradorasCuotas(pn)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setDetailCuotas(res.data);
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setDetailCuotasLoading(false); });

    return () => { cancelled = true; };
  }, [detailRow?.policy_number]);

  const loadStats = useCallback(async () => {
    try {
      const res = await saasApi.getCarteraAseguradorasStats(insurerFilter || undefined);
      if (res.success && res.data) setStats(res.data);
    } catch { /* ignore */ }
  }, [insurerFilter]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saasApi.getCarteraAseguradoras({
        page, per_page: 25, tab: activeTab, search, insurer: insurerFilter || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data.items || []);
        setPagination(res.data.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 25 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, activeTab, search, insurerFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const isBrowserFetchFailure = (msg: string) =>
    msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed');

  const runMicroserviceDiag = async () => {
    setMsDiagLoading(true);
    setMsDiagText('');
    try {
      const r = await saasApi.getMicroservicioReachability();
      if (!r.success || !r.data) {
        setMsDiagText(r.message || 'Sin respuesta del diagnóstico.');
        return;
      }
      const d = r.data;
      if (d.reachable) {
        setMsDiagText(
          `Servidor → microservicio: OK (${d.configured_base || '—'}, ${d.latency_ms ?? '?'} ms, HTTP ${d.http_status ?? '—'}). ${d.hint || ''}`,
        );
      } else {
        setMsDiagText(`Servidor → microservicio: NO alcanzable. ${d.error || ''} ${d.hint || ''}`.trim());
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setMsDiagText(
        isBrowserFetchFailure(m)
          ? 'No se pudo llamar al API de diagnóstico (mismo problema que al sincronizar: navegador ↔ Laravel).'
          : `Diagnóstico: ${m}`,
      );
    } finally {
      setMsDiagLoading(false);
    }
  };

  const startSync = async () => {
    setSyncing(true);
    setSyncMsg('Iniciando sincronización...');
    setMsDiagText('');
    try {
      const connRes = await saasApi.getInsurerConnections();
      const connected = (connRes.data || []).filter((c: any) => c.status === 'connected').map((c: any) => c.insurer_code);
      if (connected.length === 0) { setSyncMsg('No hay aseguradoras conectadas.'); setSyncing(false); return; }
      const res = await saasApi.syncInsurers(connected, ['cartera']);
      const batchId = res.data?.batch_id;
      if (!batchId) { setSyncMsg('Error: no se recibió identificador.'); setSyncing(false); return; }
      setSyncBatchId(batchId);

      setSyncMsg('Sincronizando en segundo plano...');
      if (pollRef.current) clearInterval(pollRef.current);

      const poll = async () => {
        try {
          const sr = await saasApi.getSyncStatus(batchId);
          if (!sr.success || !sr.data) return;
          const { overall_status, details } = sr.data;

          if (overall_status === 'completed' || overall_status === 'failed' || overall_status === 'partial' || overall_status === 'cancelled') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            const parts: string[] = [];
            for (const [code, d] of Object.entries(details) as [string, any][]) {
              const p = d?.progress?.cartera;
              if (d?.error) parts.push(`${code}: ${d.error}`);
              else if (p) parts.push(`${code}: ${p.created} nuevos, ${p.updated} actualizados`);
              else if (d?.status === 'completed') parts.push(`${code}: sin datos de cartera`);
            }
            setSyncMsg(parts.join(' | ') || 'Sincronización completada');
            setSyncing(false);
            setSyncBatchId(null);
            loadStats(); loadItems();
          } else {
            const processing = Object.entries(details).find(([, d]: any) => d.status === 'processing');
            if (processing) setSyncMsg(`Sincronizando ${processing[0]}...`);
          }
        } catch { /* keep polling */ }
      };

      poll();
      pollRef.current = setInterval(poll, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isBrowserFetchFailure(msg)) {
        setSyncMsg(
          'El navegador no recibió respuesta del API (Failed to fetch). Suele ser URL del backend, servidor caído, CORS o tiempo de espera agotado — no indica por sí solo si el microservicio de aseguradoras está arriba. Usa «Diagnóstico servidor → microservicio» para comprobar si PHP alcanza MICROSERVICIO_API_URL.',
        );
      } else {
        setSyncMsg(msg || 'Error de conexión');
      }
      setSyncing(false);
      setSyncBatchId(null);
    }
  };

  const cancelSync = async () => {
    if (!syncBatchId || cancellingSync) return;
    try {
      setCancellingSync(true);
      await saasApi.cancelSync(syncBatchId);
      setSyncMsg('Solicitud de detención enviada...');
    } finally {
      setCancellingSync(false);
    }
  };

  const availableInsurers = useMemo(() => stats?.by_insurer || [], [stats]);

  // ─── Detail Modal ────────────────────────────────────────────
  const renderDetailModal = () => {
    if (!detailRow) return null;
    const r = detailRow;
    const mora = moraBadge(r.dias_mora);
    const mc = moraColor(r.dias_mora);

    const Field = ({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) => (
      <div>
        <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className={`text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
      </div>
    );

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={() => setDetailRow(null)}>
        <div
          className="relative w-full max-w-xl mx-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111112] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar with mora color accent */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${mc}, ${mc}66)` }} />

          <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-neutral-800/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-transparent">
                  {INSURER_LOGOS[r.insurer_code] ? (
                    <img src={INSURER_LOGOS[r.insurer_code]} alt="" className="w-7 h-7 object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-[#111]">{r.insurer_name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{r.client_name || 'Sin nombre'}</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">{r.insurer_name} · {r.client_doc_type || 'DOC'} {r.client_document}</p>
                </div>
              </div>
              <button onClick={() => setDetailRow(null)} className="w-8 h-8 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors">
                <Icon icon="solar:close-circle-linear" width={20} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Montos principales + mora */}
            {(() => {
              const primaReal = Number(r.prima_poliza ?? 0);
              const pagadoTotal = Number(r.valor_pagado_total ?? 0);
              const hasPrimaReal = primaReal > 0;
              const pendiente = Number(r.valor_pendiente);
              const primaMostrar = hasPrimaReal ? primaReal : Number(r.prima_total);
              const pctAvance = hasPrimaReal && primaReal > 0
                ? Math.min(100, Math.round((pagadoTotal / primaReal) * 100))
                : 0;

              return (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div
                      className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center"
                      title={hasPrimaReal ? 'Prima anual contratada (desde tabla pólizas)' : 'Sin prima de póliza: se muestra suma de cuotas pendientes'}
                    >
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">
                        {hasPrimaReal ? 'Prima póliza' : 'Prima (cuotas)'}
                      </p>
                      <p className="text-base font-bold text-gray-600 dark:text-neutral-300 tabular-nums">{fmt(primaMostrar)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center" title="Prima pagada por el tomador">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Pagado</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(pagadoTotal)}</p>
                    </div>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-center" title="Saldo pendiente por cobrar">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Pendiente</p>
                      <p className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(pendiente)}</p>
                    </div>
                    <div className="rounded-xl border p-3 text-center flex flex-col items-center justify-center" style={{ borderColor: `${mc}40`, backgroundColor: `${mc}08` }}>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Mora</p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${mora.bg} ${mora.text}`}>
                        {r.dias_mora <= 0 ? 'Al día' : `${r.dias_mora}d`}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de pago (solo cuando hay prima real) */}
                  {hasPrimaReal && primaReal > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-[11px] text-gray-500 dark:text-neutral-500">
                        <span>Avance de pago</span>
                        <span className="font-semibold">{pctAvance}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${pctAvance}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Policy info */}
            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Información de póliza</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Número de póliza" value={r.policy_number} mono />
                <Field label="Ramo" value={r.ramo} />
                <Field label="Producto" value={r.product_name} />
                <Field label="Bonificación" value={r.bonificacion > 0 ? fmt(r.bonificacion) : '—'} />
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Fechas</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <Field label="Inicio vigencia" value={fmtDate(r.fecha_inicio_vigencia)} />
                <Field label="Expedición" value={fmtDate(r.fecha_expedicion)} />
                <Field
                  label={detailCuotas && detailCuotas.items.length > 1 ? 'Próxima cuota' : 'Vencimiento'}
                  value={fmtDate(r.proxima_cuota_vence ?? r.fecha_vencimiento)}
                />
              </div>
            </div>

            {/* Cuotas — desglose real basado en cada fila de cartera */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider">
                  Cuotas pendientes
                </p>
                {detailCuotas && detailCuotas.items.length > 0 && (
                  <span className="text-[10px] text-gray-500 dark:text-neutral-500">
                    {detailCuotas.items.length} cuota{detailCuotas.items.length !== 1 ? 's' : ''} · Saldo {fmt(detailCuotas.totales.valor_pendiente)}
                  </span>
                )}
              </div>

              {detailCuotasLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500 py-2">
                  <Icon icon="svg-spinners:ring-resize" width={14} />
                  Cargando cuotas...
                </div>
              ) : !detailCuotas || detailCuotas.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/40 p-4 text-center">
                  <Icon icon="solar:calendar-linear" width={24} className="mx-auto text-gray-300 dark:text-neutral-700 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-neutral-500">Sin cuotas pendientes sincronizadas.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                        <th className="px-2 py-1.5 text-left font-medium">#</th>
                        <th className="px-2 py-1.5 text-left font-medium">Recibo</th>
                        <th className="px-2 py-1.5 text-left font-medium">Vence</th>
                        <th className="px-2 py-1.5 text-center font-medium">Mora</th>
                        <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                        <th className="px-2 py-1.5 text-right font-medium">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                      {detailCuotas.items.map((c, idx) => {
                        const vp = typeof c.valor_pendiente === 'string' ? parseFloat(c.valor_pendiente) : c.valor_pendiente;
                        const pt = typeof c.prima_total === 'string' ? parseFloat(c.prima_total) : c.prima_total;
                        return (
                          <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/40">
                            <td className="px-2 py-1.5 text-gray-400 dark:text-neutral-600 tabular-nums">{idx + 1}</td>
                            <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-neutral-400">{c.numero_recibo || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-500 dark:text-neutral-500 whitespace-nowrap">{fmtDate(c.fecha_vencimiento)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {c.dias_mora > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-500 dark:text-red-400">
                                  {c.dias_mora}d
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-neutral-700">—</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-neutral-300">{fmt(pt)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{fmt(vp)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-neutral-950/60 border-t border-gray-200 dark:border-neutral-800 text-[11px] font-semibold">
                        <td colSpan={4} className="px-2 py-1.5 text-right text-gray-500 dark:text-neutral-400 uppercase text-[10px]">Total pendiente</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-neutral-400">{fmt(detailCuotas.totales.prima_total)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{fmt(detailCuotas.totales.valor_pendiente)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {r.numero_pagare && (
                <div className="mt-3"><Field label="Nº Pagaré" value={r.numero_pagare} mono /></div>
              )}
            </div>

            {r.numero_recibo && (
              <div>
                <Field label="Nº Recibo / Contrato" value={r.numero_recibo} mono />
              </div>
            )}

            {/* Comisiones de esta póliza */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider">Recibos y comisiones</p>
                {(() => {
                  const n = Number(detailComisiones?.totales?.recibos ?? 0);
                  return n > 0 ? (
                    <span className="text-[10px] text-gray-500 dark:text-neutral-500">
                      {n} recibo{n !== 1 ? 's' : ''}
                    </span>
                  ) : null;
                })()}
              </div>

              {detailComisionesLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500 py-2">
                  <Icon icon="svg-spinners:ring-resize" width={14} />
                  Cargando recibos...
                </div>
              ) : !detailComisiones || detailComisiones.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/40 p-4 text-center">
                  <Icon icon="solar:document-text-linear" width={24} className="mx-auto text-gray-300 dark:text-neutral-700 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-neutral-500">
                    Sin recibos sincronizados para esta póliza.
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">
                    Ejecuta "Sincronizar comisiones" para traer histórico.
                  </p>
                </div>
              ) : (
                <>
                  {/* Totales mini */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-neutral-950/60 border border-gray-200 dark:border-neutral-800 p-2 text-center">
                      <p className="text-[9px] text-gray-400 dark:text-neutral-500 uppercase">Pagado</p>
                      <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300 tabular-nums">{fmt(detailComisiones.totales.valor_pagado)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-center">
                      <p className="text-[9px] text-gray-400 dark:text-neutral-500 uppercase">Comisión</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(detailComisiones.totales.valor_comision)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-neutral-950/60 border border-gray-200 dark:border-neutral-800 p-2 text-center">
                      <p className="text-[9px] text-gray-400 dark:text-neutral-500 uppercase">Prima neta</p>
                      <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300 tabular-nums">{fmt(detailComisiones.totales.prima_neta)}</p>
                    </div>
                  </div>

                  {/* Lista compacta de recibos */}
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                          <th className="px-2 py-1.5 text-left font-medium">Recibo</th>
                          <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                          <th className="px-2 py-1.5 text-right font-medium">Pagado</th>
                          <th className="px-2 py-1.5 text-right font-medium">%</th>
                          <th className="px-2 py-1.5 text-right font-medium">Comisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                        {detailComisiones.items.slice(0, 10).map((c: any) => (
                          <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/40">
                            <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-neutral-400">{c.numero_recibo || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-500 dark:text-neutral-500 whitespace-nowrap">{fmtDate(c.fecha_recaudo)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-neutral-300">{fmt(Number(c.valor_pagado_tomador))}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-neutral-500">{Number(c.porcentaje_comision).toFixed(1)}%</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmt(Number(c.valor_comision))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detailComisiones.items.length > 10 && (
                      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/40 text-[10px] text-center text-gray-500 dark:text-neutral-500">
                        + {detailComisiones.items.length - 10} recibos más · Ver en <button onClick={() => { setDetailRow(null); nav('/apps/comisiones/por-poliza?policy=' + encodeURIComponent(r.policy_number)); }} className="text-[#573CFF] hover:underline">Comisiones</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Sync info */}
            <div className="pt-2 border-t border-gray-200 dark:border-neutral-800/60">
              <p className="text-[10px] text-gray-500 dark:text-neutral-600">
                Sincronizado: {fmtDate(r.synced_at)} · Fuente: {r.insurer_name}
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800/60 flex items-center justify-end gap-2">
            {r.client_document && (
              <button
                onClick={() => { setDetailRow(null); nav(`/apps/seguros/clientes?search=${encodeURIComponent(r.client_document)}`); }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
              >
                <Icon icon="solar:user-linear" width={14} />
                Ver cliente
              </button>
            )}
            {r.policy_number && (
              <button
                onClick={() => { setDetailRow(null); nav(`/apps/seguros/polizas?search=${encodeURIComponent(r.policy_number)}`); }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
              >
                <Icon icon="solar:shield-check-linear" width={14} />
                Ver póliza
              </button>
            )}
            <button
              onClick={() => setDetailRow(null)}
              className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-xs text-white font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Cartera Aseguradoras</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Cartera consolidada sincronizada automáticamente desde tus compañías de seguros.
            {stats?.totals?.last_sync && (
              <span className="ml-2 text-gray-400 dark:text-neutral-500 text-xs">Última sync: {fmtDate(stats.totals.last_sync)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && syncBatchId && (
            <button
              onClick={cancelSync}
              disabled={cancellingSync}
              className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-amber-300 transition-colors"
            >
              <Icon icon={cancellingSync ? 'svg-spinners:ring-resize' : 'solar:stop-circle-bold'} width={18} />
              {cancellingSync ? 'Deteniendo...' : 'Detener'}
            </button>
          )}
          <button
            type="button"
            onClick={runMicroserviceDiag}
            disabled={msDiagLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800/80 hover:bg-gray-200 dark:hover:bg-neutral-800 disabled:opacity-60 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-neutral-300 transition-colors"
            title="Comprueba si el backend puede conectar a MICROSERVICIO_API_URL"
          >
            <Icon icon={msDiagLoading ? 'svg-spinners:ring-resize' : 'solar:server-path-bold-duotone'} width={16} />
            Diagnóstico microservicio
          </button>
          <button
            onClick={startSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Icon icon={syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-bold-duotone'} width={18} />
            {syncing ? 'Sincronizando...' : 'Sincronizar cartera'}
          </button>
        </div>
      </div>

      {(syncMsg || msDiagText) && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/80 px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 space-y-2">
          {syncMsg && <p>{syncMsg}</p>}
          {msDiagText && (
            <p className={`text-xs text-gray-500 dark:text-neutral-400 ${syncMsg ? 'border-t border-gray-200 dark:border-neutral-800 pt-2 mt-2' : ''}`}>{msDiagText}</p>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon="solar:wallet-bold-duotone" iconColor="#573CFF" label="Total pendiente" value={fmt(stats.totals.valor_pendiente)} sub={`${stats.totals.items} registros`} />
          <StatCard icon="solar:danger-triangle-bold-duotone" iconColor="#ef4444" label="En mora +90 días" value={String(stats.tab_counts.mora_90_plus || 0)} sub="registros críticos" />
          <StatCard icon="solar:clock-circle-bold-duotone" iconColor="#f97316" label="Mora 31-90 días" value={String((stats.tab_counts.mora_60 || 0) + (stats.tab_counts.mora_90 || 0))} sub="atención requerida" />
          <StatCard icon="solar:check-circle-bold-duotone" iconColor="#22c55e" label="Al día" value={String(stats.tab_counts.al_dia || 0)} sub="sin mora" />
        </div>
      )}

      {/* Insurer pills */}
      {availableInsurers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => { setInsurerFilter(''); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!insurerFilter ? 'bg-[#573CFF] text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'}`}
          >Todas</button>
          {availableInsurers.map((ins) => (
            <button
              key={ins.insurer_code}
              onClick={() => { setInsurerFilter(ins.insurer_code === insurerFilter ? '' : ins.insurer_code); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${insurerFilter === ins.insurer_code ? 'bg-[#573CFF] text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {INSURER_LOGOS[ins.insurer_code] && (
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-700 shrink-0">
                  <img src={INSURER_LOGOS[ins.insurer_code]} alt="" className="w-3 h-3 object-contain" />
                </div>
              )}
              {ins.insurer_name}
              <span className="opacity-60">({ins.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 overflow-hidden shadow-sm dark:shadow-none">
        <div className="flex items-center border-b border-gray-200 dark:border-neutral-800 overflow-x-auto">
          {TABS.map((tab) => {
            const count = stats?.tab_counts?.[tab.key] ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-[#573CFF] text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'}`}
              >
                <Icon icon={tab.icon} width={16} style={tab.color && isActive ? { color: tab.color } : undefined} />
                {tab.label}
                <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#573CFF]/20 text-[#573CFF] dark:text-[#a78bfa]' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-neutral-800/60">
          <div className="relative flex-1 max-w-sm">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" width={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, documento o póliza..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:border-[#573CFF] focus:outline-none transition-colors"
            />
          </div>
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-700 dark:text-neutral-300 transition-colors">Buscar</button>
          <button onClick={() => { loadStats(); loadItems(); }} className="rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 border border-gray-300 dark:border-neutral-700 px-2.5 py-2 text-gray-600 dark:text-neutral-400 transition-colors" title="Refrescar">
            <Icon icon="solar:refresh-linear" width={18} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Icon icon="svg-spinners:ring-resize" width={32} className="text-[#573CFF]" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-500">
              <Icon icon="solar:inbox-bold-duotone" width={48} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">Sin registros de cartera</p>
              <p className="text-xs mt-1">Sincroniza con tus aseguradoras para ver la cartera aquí.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                  <th className="px-4 py-3 font-medium">Aseguradora</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Póliza</th>
                  <th className="px-4 py-3 font-medium">Ramo</th>
                  <th className="px-4 py-3 font-medium text-right">Prima</th>
                  <th className="px-4 py-3 font-medium text-right">Pendiente</th>
                  <th className="px-4 py-3 font-medium text-center">Mora</th>
                  <th className="px-4 py-3 font-medium">Vigencia</th>
                  <th className="px-4 py-3 font-medium">Cuotas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800/60">
                {items.map((row) => {
                  const mora = moraBadge(row.dias_mora);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDetailRow(row)}
                      className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {INSURER_LOGOS[row.insurer_code] ? (
                            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                              <img src={INSURER_LOGOS[row.insurer_code]} alt="" className="w-4 h-4 object-contain" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-md bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-gray-600 dark:text-neutral-300">{row.insurer_name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-sm text-gray-700 dark:text-neutral-300">{row.insurer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium max-w-[180px] truncate">{row.client_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 font-mono">{row.client_document || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 font-mono">{row.policy_number || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 max-w-[140px] truncate">{row.ramo || row.product_name || '—'}</td>
                      <td
                        className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 text-right tabular-nums"
                        title={Number(row.prima_poliza ?? 0) > 0
                          ? 'Prima anual contratada'
                          : 'Sin prima en póliza — se muestra suma de cuotas pendientes'}
                      >
                        {fmt(row.prima_total)}
                        {!Number(row.prima_poliza ?? 0) && (
                          <span className="ml-1 text-[9px] text-amber-500 dark:text-amber-400/80 align-top" title="Prima inferida desde cuotas">*</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-semibold text-right tabular-nums">{fmt(row.valor_pendiente)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${mora.bg} ${mora.text}`}>{mora.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
                        {!row.fecha_inicio_vigencia && !row.fecha_vencimiento ? (
                          '—'
                        ) : (
                          <span className="whitespace-nowrap">
                            {fmtDate(row.fecha_inicio_vigencia)}
                            {row.fecha_vencimiento ? (
                              <>
                                <span className="text-gray-400 dark:text-neutral-600 mx-1">→</span>
                                {fmtDate(row.fecha_vencimiento)}
                              </>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
                        {(row.cuotas_pendientes ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${(row.cuotas_pendientes ?? 0) > 1 ? 'bg-[#573CFF]/15 text-[#573CFF]' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'}`}>
                              {row.cuotas_pendientes}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-neutral-600">pend.</span>
                            {row.total_cuotas != null && row.total_cuotas > 0 && (
                              <span className="text-[10px] text-gray-400 dark:text-neutral-600">de {row.total_cuotas}</span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
            <span className="text-xs text-gray-500 dark:text-neutral-500">
              Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1}-{Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg px-2.5 py-1.5 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                <Icon icon="solar:alt-arrow-left-linear" width={16} />
              </button>
              {Array.from({ length: Math.min(pagination.last_page, 7) }, (_, i) => {
                let pageNum: number;
                if (pagination.last_page <= 7) pageNum = i + 1;
                else if (page <= 4) pageNum = i + 1;
                else if (page >= pagination.last_page - 3) pageNum = pagination.last_page - 6 + i;
                else pageNum = page - 3 + i;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${page === pageNum ? 'bg-[#573CFF] text-white' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))} disabled={page >= pagination.last_page} className="rounded-lg px-2.5 py-1.5 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                <Icon icon="solar:alt-arrow-right-linear" width={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {renderDetailModal()}
    </div>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────
const StatCard: React.FC<{ icon: string; iconColor: string; label: string; value: string; sub: string }> = ({
  icon, iconColor, label, value, sub,
}) => (
  <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 p-4 shadow-sm dark:shadow-none">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}20` }}>
        <Icon icon={icon} width={18} style={{ color: iconColor }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-neutral-500 font-medium">{label}</span>
    </div>
    <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
    <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">{sub}</p>
  </div>
);

export default CarteraAseguradoras;

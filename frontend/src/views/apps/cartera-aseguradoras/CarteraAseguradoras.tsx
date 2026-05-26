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
import mundialLogo from '../../../assets/images/logoscompanias/mundial.svg';

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
  // IDs internos de Guro — se llenan vía LEFT JOIN, pueden ser null si la cartera
  // del importador no tiene cliente/póliza vinculados en Guro todavía.
  poliza_id: number | null;
  client_id: number | null;
  ramo: string | null;
  product_name: string | null;

  // Asesor/vendedor de la póliza (puede haber hasta 2). Vienen del LEFT JOIN
  // con polizas; null si la póliza no está vinculada en Guro o no tiene vendedor.
  seller_id: number | null;
  seller_name: string | null;
  seller_id_2: number | null;
  seller_name_2: string | null;

  // Valores de prima (varios ángulos):
  //   - prima_poliza : prima real contratada (de `polizas.premium_amount`). 0 si no hay match.
  //   - prima_cuotas : suma de importes SOLO de las cuotas pendientes.
  //   - prima_total  : prima real de póliza; null si no está disponible.
  prima_total: number | null;
  prima_poliza?: number;
  prima_cuotas?: number;
  importe_cuotas?: number;
  prima_disponible?: boolean | number;
  tipo_cobro?: 'financiada' | 'contado' | string;
  forma_pago?: string | null;
  medio_pago?: string | null;
  banco?: string | null;
  tipo_cuenta?: string | null;
  cuenta_bancaria?: string | null;
  dias_cancelacion?: number | string | null;
  tipo_cobro_fuente?: string | null;
  linea_financiacion?: string | null;
  clasificacion?: string | null;
  convenio?: string | null;
  placa?: string | null;

  valor_pendiente: number;              // saldo real pendiente (suma de cuotas por pagar)
  valor_pagado: number;                 // abonos SOLO de cuotas pendientes
  valor_pagado_total?: number;          // prima_poliza - valor_pendiente (si prima_poliza > 0)
  valor_iva?: number;
  valor_gastos_emision?: number;
  valor_tasa_runt?: number;
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
  mundial: mundialLogo,
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
  // Filtro de vinculación con Guro: 'all' (default), 'linked' (con cliente Y póliza
  // vinculados), 'unlinked' (alguno de los dos falta).
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [insurerFilter, setInsurerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 });
  const [syncing, setSyncing] = useState(false);
  const [syncBatchId, setSyncBatchId] = useState<string | null>(null);
  const [cancellingSync, setCancellingSync] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [msDiagText, setMsDiagText] = useState('');
  const [detailRow, setDetailRow] = useState<CarteraRow | null>(null);
  const [detailComisiones, setDetailComisiones] = useState<{ items: any[]; totales: any } | null>(null);
  const [detailComisionesLoading, setDetailComisionesLoading] = useState(false);
  const [detailCuotas, setDetailCuotas] = useState<{ items: CuotaDetalle[]; totales: any } | null>(null);
  const [detailCuotasLoading, setDetailCuotasLoading] = useState(false);
  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportTab, setExportTab] = useState<string>('todos');
  const [exportLinkFilter, setExportLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [exportSellerFilter, setExportSellerFilter] = useState<'all' | 'with' | 'without'>('all');
  const [exportInsurer, setExportInsurer] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInsurer, setImportInsurer] = useState('');
  const [importReplace, setImportReplace] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importMapping, setImportMapping] = useState<Record<string, number | null>>({});
  const [importMsg, setImportMsg] = useState('');
  const [accionesOpen, setAccionesOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const importInsurerOptions = useMemo(() => {
    const fixed = [
      { insurer_code: 'sura', insurer_name: 'SURA' },
      { insurer_code: 'hdi', insurer_name: 'HDI' },
      { insurer_code: 'bolivar', insurer_name: 'Bolívar' },
      { insurer_code: 'allianz', insurer_name: 'Allianz' },
      { insurer_code: 'qualitas', insurer_name: 'Qualitas' },
      { insurer_code: 'mapfre', insurer_name: 'Mapfre' },
      { insurer_code: 'axa-colpatria', insurer_name: 'AXA Colpatria' },
      { insurer_code: 'sbs', insurer_name: 'SBS' },
      { insurer_code: 'zurich', insurer_name: 'Zurich' },
      { insurer_code: 'previsora', insurer_name: 'Previsora' },
      { insurer_code: 'mundial', insurer_name: 'Mundial' },
      { insurer_code: 'bbva', insurer_name: 'BBVA' },
      { insurer_code: 'seguros-del-estado', insurer_name: 'Seguros del Estado' },
      { insurer_code: 'equidad', insurer_name: 'Equidad' },
    ];
    const byCode = new Map<string, { insurer_code: string; insurer_name: string }>();
    // Fixed list PRIMERO para que sus nombres canónicos ("SURA", "HDI"…) ganen
    // sobre cualquier insurer_name potencialmente sucio en cartera_aseguradoras
    // (e.g. "ARL SURA" del sync). Aún incluimos by_insurer para insurers nuevos
    // no presentes en el fixed list.
    [...fixed, ...(stats?.by_insurer || [])].forEach((ins: any) => {
      const code = String(ins.insurer_code || '').trim();
      if (!code || byCode.has(code)) return;
      byCode.set(code, { insurer_code: code, insurer_name: ins.insurer_name || code.toUpperCase() });
    });
    return Array.from(byCode.values());
  }, [stats?.by_insurer]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await saasApi.exportCarteraAseguradoras({
        tab: exportTab !== 'todos' ? exportTab : undefined,
        insurer: exportInsurer || undefined,
        link_filter: exportLinkFilter,
        seller_filter: exportSellerFilter,
      });
      // Descargar el blob como CSV
      const filenameParts = ['cartera'];
      if (exportTab !== 'todos') filenameParts.push(exportTab);
      if (exportLinkFilter !== 'all') filenameParts.push(exportLinkFilter);
      if (exportSellerFilter !== 'all') filenameParts.push(`asesor_${exportSellerFilter}`);
      filenameParts.push(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
      const filename = filenameParts.join('_') + '.csv';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (e: any) {
      alert('Error al exportar: ' + (e?.message || 'desconocido'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportPreview = async () => {
    if (!importFile || !importInsurer) {
      setImportMsg('Selecciona compañía y archivo.');
      return;
    }
    setImportLoading(true);
    setImportMsg('Analizando archivo...');
    try {
      const res = await saasApi.previewCarteraAseguradorasImport(importFile, importInsurer);
      setImportPreview(res.data);
      setImportMapping(res.data?.mapping || {});
      setImportMsg(`Detectadas ${res.data?.detected_rows || 0} filas. Revisa el mapeo antes de importar.`);
    } catch (e: any) {
      setImportMsg(e?.message || 'Error analizando archivo');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importFile || !importInsurer) return;
    setImportLoading(true);
    setImportMsg('Importando cartera...');
    try {
      const res = await saasApi.importCarteraAseguradoras(importFile, {
        insurer_code: importInsurer,
        mapping: importMapping,
        replace: importReplace,
      });
      setImportMsg(res.message || 'Importación completada');
      await loadStats();
      await loadItems();
    } catch (e: any) {
      setImportMsg(e?.message || 'Error importando archivo');
    } finally {
      setImportLoading(false);
    }
  };

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
      const res = await saasApi.getCarteraAseguradorasStats(insurerFilter || undefined, linkFilter);
      if (res.success && res.data) setStats(res.data);
    } catch { /* ignore */ }
  }, [insurerFilter, linkFilter]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saasApi.getCarteraAseguradoras({
        page, per_page: 25, tab: activeTab, search, insurer: insurerFilter || undefined, link_filter: linkFilter,
      });
      if (res.success && res.data) {
        setItems(res.data.items || []);
        setPagination(res.data.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 25 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, activeTab, search, insurerFilter, linkFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const isBrowserFetchFailure = (msg: string) =>
    msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed');

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
              else if (p?.error) parts.push(`${code}: ${p.error}`);
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

  const clearData = async () => {
    const scope = insurerFilter || 'todas las aseguradoras';
    if (!window.confirm(`¿Eliminar datos de cartera de ${scope}? Luego podrás resincronizar.`)) return;
    setSyncing(true);
    setSyncMsg('Eliminando datos de cartera...');
    try {
      const res = await saasApi.deleteCarteraAseguradorasData({ insurer: insurerFilter || undefined });
      setSyncMsg(res.message || `Eliminados ${res.data?.deleted ?? 0} registros`);
      setPage(1);
      await loadStats();
      await loadItems();
    } catch (e: any) {
      setSyncMsg(e?.message || 'Error eliminando datos');
    } finally {
      setSyncing(false);
    }
  };

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
              const primaReal = Number(r.prima_total ?? r.prima_poliza ?? 0);
              const pagadoTotal = Number(r.valor_pagado_total ?? 0);
              const hasPrimaReal = Boolean(r.prima_disponible) && primaReal > 0;
              const pendiente = Number(r.valor_pendiente);
              const importeCuotas = Number(r.importe_cuotas ?? r.prima_cuotas ?? 0);
              // Avance = pagado / facturado (pagado + pendiente). Es el % de lo
              // efectivamente facturado que ya está cobrado, sin depender de la
              // prima del contrato (que en planes mensuales recurrentes puede
              // ser menor que las cuotas acumuladas).
              const facturado = pagadoTotal + pendiente;
              const pctAvance = facturado > 0
                ? Math.min(100, Math.round((pagadoTotal / facturado) * 100))
                : 0;

              return (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div
                      className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center"
                      title={hasPrimaReal ? 'Prima anual contratada (desde tabla pólizas)' : 'La aseguradora no entregó prima real de póliza para este registro'}
                    >
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">
                        Prima póliza
                      </p>
                      <p className="text-base font-bold text-gray-600 dark:text-neutral-300 tabular-nums">{hasPrimaReal ? fmt(primaReal) : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center" title="Importe reportado por las cuotas/recibos pendientes sincronizados">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Importe cuotas</p>
                      <p className="text-base font-bold text-gray-600 dark:text-neutral-300 tabular-nums">{importeCuotas > 0 ? fmt(importeCuotas) : '—'}</p>
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
                <Field label="Tipo de cobro" value={r.tipo_cobro === 'financiada' ? 'Financiada' : 'Contado'} />
                <Field label="Periodicidad" value={r.forma_pago} />
                <Field label="Medio pago" value={r.medio_pago} />
                <Field label="Bonificación" value={r.bonificacion > 0 ? fmt(r.bonificacion) : '—'} />
              </div>
            </div>

            {(r.banco || r.tipo_cuenta || r.cuenta_bancaria || r.dias_cancelacion != null || r.tipo_cobro_fuente || r.linea_financiacion || r.clasificacion || r.convenio || r.placa) && (
              <div>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Información de cobro</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label="Cobro fuente" value={r.tipo_cobro_fuente} />
                  <Field label="Línea financiación" value={r.linea_financiacion} />
                  <Field label="Clasificación" value={r.clasificacion} />
                  <Field label="Convenio" value={r.convenio} />
                  <Field label="Placa" value={r.placa} mono />
                  <Field label="Banco" value={r.banco} />
                  <Field label="Tipo cuenta" value={r.tipo_cuenta} />
                  <Field label="Cuenta" value={r.cuenta_bancaria} mono />
                  <Field label="Días cancelación" value={r.dias_cancelacion != null ? String(r.dias_cancelacion) : '—'} />
                </div>
              </div>
            )}

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
          {/* Acciones dropdown */}
          <div className="relative">
            <button
              onClick={() => setAccionesOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-neutral-200 transition-colors"
            >
              <Icon icon="solar:menu-dots-bold-duotone" width={18} />
              Acciones
              <Icon icon="solar:alt-arrow-down-bold" width={14} className={`transition-transform ${accionesOpen ? 'rotate-180' : ''}`} />
            </button>
            {accionesOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAccionesOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => { setAccionesOpen(false); setExportOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Icon icon="solar:download-bold-duotone" width={16} className="text-gray-500 dark:text-neutral-400" />
                    Exportar
                  </button>
                  <button
                    onClick={() => { setAccionesOpen(false); setImportOpen(true); setImportInsurer(insurerFilter || ''); setImportMsg(''); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Icon icon="solar:upload-bold-duotone" width={16} className="text-gray-500 dark:text-neutral-400" />
                    Importar Excel
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-neutral-800" />
                  <button
                    onClick={() => { setAccionesOpen(false); clearData(); }}
                    disabled={syncing}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-colors"
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" width={16} />
                    Limpiar datos
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={startSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Icon icon={syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-bold-duotone'} width={18} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
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

          {/* Filtro sutil vínculo con Guro */}
          <div className="ml-auto inline-flex items-center gap-0 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 overflow-hidden" title="Filtrar por vínculo con clientes/pólizas en Guro">
            {([
              { v: 'all', label: 'Todos' },
              { v: 'linked', label: 'Vinculados' },
              { v: 'unlinked', label: 'Sin vincular' },
            ] as const).map((opt, idx) => (
              <button
                key={opt.v}
                onClick={() => { setLinkFilter(opt.v); setPage(1); }}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${idx > 0 ? 'border-l border-gray-300 dark:border-neutral-700' : ''} ${
                  linkFilter === opt.v
                    ? 'bg-[#573CFF] text-white'
                    : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
            <table className="w-full min-w-[1380px] table-fixed text-left">
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[240px]" />
                <col className="w-[145px]" />
                <col className="w-[150px]" />
                <col className="w-[170px]" />
                <col className="w-[180px]" />
                <col className="w-[130px]" />
                <col className="w-[135px]" />
                <col className="w-[105px]" />
                <col className="w-[230px]" />
                <col className="w-[125px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                  <th className="px-4 py-3 font-medium">Aseguradora</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Póliza</th>
                  <th className="px-4 py-3 font-medium">Ramo</th>
                  <th className="px-4 py-3 font-medium">Asesor</th>
                  <th className="px-4 py-3 font-medium text-right">Prima póliza</th>
                  <th className="px-4 py-3 font-medium text-right">Pendiente</th>
                  <th className="px-4 py-3 font-medium text-center">Mora</th>
                  <th className="px-4 py-3 font-medium">Vigencia</th>
                  <th className="px-4 py-3 font-medium">Cobro</th>
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
                        <div className="flex min-w-0 items-center gap-2">
                          {INSURER_LOGOS[row.insurer_code] ? (
                            <div className="w-5 h-5 shrink-0 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                              <img src={INSURER_LOGOS[row.insurer_code]} alt="" className="w-4 h-4 object-contain" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 shrink-0 rounded-md bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-gray-600 dark:text-neutral-300">{row.insurer_name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="min-w-0 truncate text-sm text-gray-700 dark:text-neutral-300" title={row.insurer_name}>{row.insurer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {row.client_name ? (
                          row.client_id ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); nav(`/apps/seguros/clientes?open_client_id=${row.client_id}`); }}
                              className="truncate block max-w-full text-left text-[#573CFF] dark:text-[#8a76ff] hover:underline focus:outline-none focus:underline"
                              title={`Abrir ${row.client_name}`}
                            >
                              {row.client_name}
                            </button>
                          ) : (
                            <div
                              className="truncate text-gray-500 dark:text-neutral-400 italic"
                              title="Cliente no vinculado en Guro (existe en cartera de aseguradora pero no en tu CRM)"
                            >
                              {row.client_name} <span className="text-[10px] not-italic">⚠</span>
                            </div>
                          )
                        ) : (
                          <div className="text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 font-mono">
                        <div className="truncate" title={row.client_document || undefined}>{row.client_document || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {row.policy_number ? (
                          row.poliza_id ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); nav(`/apps/seguros/polizas?open_poliza_id=${row.poliza_id}`); }}
                              className="truncate block max-w-full text-left text-[#573CFF] dark:text-[#8a76ff] hover:underline focus:outline-none focus:underline"
                              title={`Abrir póliza ${row.policy_number}`}
                            >
                              {row.policy_number}
                            </button>
                          ) : (
                            <div
                              className="truncate text-gray-500 dark:text-neutral-400 italic"
                              title="Póliza no vinculada en Guro (existe en cartera de aseguradora pero no en tus pólizas)"
                            >
                              {row.policy_number} <span className="text-[10px] not-italic">⚠</span>
                            </div>
                          )
                        ) : (
                          <div className="text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
                        <div className="truncate" title={row.ramo || row.product_name || undefined}>{row.ramo || row.product_name || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">
                        {row.seller_name ? (
                          <div
                            className="truncate"
                            title={
                              row.seller_name_2
                                ? `${row.seller_name} / ${row.seller_name_2}`
                                : row.seller_name
                            }
                          >
                            {row.seller_name}
                            {row.seller_name_2 && (
                              <span className="text-gray-400 dark:text-neutral-500"> / {row.seller_name_2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 text-right tabular-nums"
                        title={Boolean(row.prima_disponible) && Number(row.prima_total ?? row.prima_poliza ?? 0) > 0
                          ? 'Prima anual contratada'
                          : 'Sin prima real disponible desde la aseguradora ni póliza vinculada'}
                      >
                        {Boolean(row.prima_disponible) && Number(row.prima_total ?? row.prima_poliza ?? 0) > 0
                          ? fmt(Number(row.prima_total ?? row.prima_poliza ?? 0))
                          : '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-gray-900 dark:text-white font-semibold text-right tabular-nums"
                        title={(() => {
                          const iva = Number(row.valor_iva ?? 0);
                          const gastos = Number(row.valor_gastos_emision ?? 0);
                          const runt = Number(row.valor_tasa_runt ?? 0);
                          const prima = Number(row.prima_cuotas ?? row.prima_total ?? row.prima_poliza ?? 0);
                          if (!iva && !gastos && !runt) return undefined;
                          const parts: string[] = [];
                          if (prima > 0) parts.push(`Prima: ${fmt(prima)}`);
                          if (iva > 0) parts.push(`IVA: ${fmt(iva)}`);
                          if (gastos > 0) parts.push(`Gastos emisión: ${fmt(gastos)}`);
                          if (runt > 0) parts.push(`Tasa RUNT: ${fmt(runt)}`);
                          const calc = prima + iva + gastos + runt;
                          const total = Number(row.valor_pendiente);
                          const ok = Math.abs(calc - total) < 1;
                          parts.push(`Total: ${fmt(total)}${ok ? ' ✓' : ' ⚠ (difiere del calculado)'}`);
                          return parts.join('\n');
                        })()}
                      >
                        {fmt(row.valor_pendiente)}
                        {(Number(row.valor_iva ?? 0) > 0 || Number(row.valor_gastos_emision ?? 0) > 0 || Number(row.valor_tasa_runt ?? 0) > 0) && (
                          <span className="ml-1 text-[10px] text-blue-400 dark:text-blue-500 cursor-help" title="Ver desglose">ⓘ</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${mora.bg} ${mora.text}`}>{mora.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
                        {!row.fecha_inicio_vigencia && !row.fecha_vencimiento ? (
                          '—'
                        ) : (
                          <span className="block truncate whitespace-nowrap" title={`${fmtDate(row.fecha_inicio_vigencia)}${row.fecha_vencimiento ? ` → ${fmtDate(row.fecha_vencimiento)}` : ''}`}>
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
                          <span className="inline-flex flex-col gap-1 whitespace-nowrap">
                            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tipo_cobro === 'financiada' ? 'bg-[#573CFF]/15 text-[#573CFF]' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                              <Icon icon={row.tipo_cobro === 'financiada' ? 'solar:calendar-mark-bold-duotone' : 'solar:card-bold-duotone'} width={12} />
                              {row.tipo_cobro === 'financiada' ? 'Financiada' : 'Contado'}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-neutral-600">
                              {row.cuotas_pendientes} pend.
                              {row.total_cuotas != null && row.total_cuotas > 0 ? ` de ${row.total_cuotas}` : ''}
                            </span>
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

      {/* Export Modal */}
      {exportOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4"
          onClick={() => !exportLoading && setExportOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Exportar cartera
                </h2>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                  CSV con los filtros que selecciones — útil para reportes y depuración.
                </p>
              </div>
              <button
                onClick={() => !exportLoading && setExportOpen(false)}
                disabled={exportLoading}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <Icon icon="solar:close-circle-linear" width={22} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Mora */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">
                  Estado de mora
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TABS.map((t) => {
                    const active = exportTab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setExportTab(t.key)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#573CFF] border-[#573CFF] text-white'
                            : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-gray-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vínculo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">
                  Vínculo con Guro (cliente + póliza)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'all', label: 'Todos', hint: 'sin filtrar' },
                    { v: 'linked', label: 'Vinculados', hint: 'con cliente y póliza' },
                    { v: 'unlinked', label: 'Sin vincular', hint: 'pendientes de agregar' },
                  ].map((opt) => {
                    const active = exportLinkFilter === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setExportLinkFilter(opt.v as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                          active
                            ? 'bg-[#573CFF] border-[#573CFF] text-white'
                            : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-gray-300'
                        }`}
                        title={opt.hint}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-gray-500 dark:text-neutral-500'}`}>
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asesor */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">
                  Asesor / Vendedor
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'all', label: 'Cualquiera', hint: 'sin filtrar' },
                    { v: 'with', label: 'Con asesor', hint: 'tiene asignado' },
                    { v: 'without', label: 'Sin asesor', hint: 'falta asignar' },
                  ].map((opt) => {
                    const active = exportSellerFilter === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setExportSellerFilter(opt.v as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                          active
                            ? 'bg-[#573CFF] border-[#573CFF] text-white'
                            : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-gray-300'
                        }`}
                        title={opt.hint}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-gray-500 dark:text-neutral-500'}`}>
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aseguradora (opcional, reusa el filtro de pantalla) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">
                  Aseguradora (opcional)
                </label>
                <select
                  value={exportInsurer}
                  onChange={(e) => setExportInsurer(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Todas las aseguradoras</option>
                  {(stats?.by_insurer || []).map((ins) => (
                    <option key={ins.insurer_code} value={ins.insurer_code}>
                      {ins.insurer_name} ({ins.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/50 flex items-center justify-between rounded-b-2xl">
              <button
                onClick={() => setExportOpen(false)}
                disabled={exportLoading}
                className="text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex items-center gap-2 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <Icon icon={exportLoading ? 'svg-spinners:ring-resize' : 'solar:download-bold'} width={16} />
                {exportLoading ? 'Generando CSV...' : 'Descargar CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
      {importOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !importLoading && setImportOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#573CFF]/10 flex items-center justify-center">
                  <Icon icon="solar:upload-bold-duotone" width={20} className="text-[#573CFF]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Importar cartera</h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">Excel o CSV · automapeo de columnas</p>
                </div>
              </div>
              <button onClick={() => !importLoading && setImportOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <Icon icon="solar:close-bold" width={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* 1. Seleccionar aseguradora */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-3">1. Selecciona la aseguradora</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {importInsurerOptions.map((ins) => {
                    const logo = INSURER_LOGOS[ins.insurer_code];
                    const selected = importInsurer === ins.insurer_code;
                    return (
                      <button
                        key={ins.insurer_code}
                        onClick={() => setImportInsurer(ins.insurer_code)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          selected
                            ? 'border-[#573CFF] bg-[#573CFF]/8 shadow-sm shadow-[#573CFF]/20'
                            : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-[#573CFF]/40 hover:bg-[#573CFF]/5 dark:hover:border-neutral-600'
                        }`}
                      >
                        <div className="w-14 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm border border-gray-200 dark:border-neutral-600 px-1.5">
                          {logo ? (
                            <img src={logo} alt={ins.insurer_name} className="max-h-7 max-w-full w-auto object-contain" />
                          ) : (
                            <span className="text-[9px] font-bold text-gray-500 uppercase">{ins.insurer_code.slice(0, 4)}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium leading-tight text-center ${selected ? 'text-[#573CFF]' : 'text-gray-600 dark:text-neutral-400'}`}>
                          {ins.insurer_name}
                        </span>
                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-[#573CFF]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Subir archivo */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-3">2. Archivo Excel / CSV</p>
                <label className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all p-6 ${
                  importFile
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border-gray-300 dark:border-neutral-700 hover:border-[#573CFF] hover:bg-[#573CFF]/5 bg-white dark:bg-neutral-800/30'
                }`}>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }}
                  />
                  {importFile ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Icon icon="solar:file-check-bold-duotone" width={28} className="text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{importFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{(importFile.size / 1024).toFixed(0)} KB · Haz clic para cambiar</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                        <Icon icon="solar:cloud-upload-bold-duotone" width={28} className="text-gray-400 dark:text-neutral-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">Arrastra o haz clic para seleccionar</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">.xlsx · .xls · .csv</p>
                      </div>
                    </>
                  )}
                </label>
              </div>

              {/* Opción reemplazar */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${importReplace ? 'bg-[#573CFF]' : 'bg-gray-200 dark:bg-neutral-700'}`}
                  onClick={() => setImportReplace(r => !r)}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${importReplace ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-neutral-300">Reemplazar cartera existente de esta compañía</span>
              </label>

              {/* Botón analizar */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleImportPreview}
                  disabled={importLoading || !importFile || !importInsurer}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-neutral-200 transition-colors"
                >
                  <Icon icon={importLoading ? 'svg-spinners:ring-resize' : 'solar:magic-stick-3-bold-duotone'} width={16} />
                  {importLoading ? 'Analizando...' : 'Analizar y automapear'}
                </button>
                {importMsg && <span className="text-xs text-gray-500 dark:text-neutral-500">{importMsg}</span>}
              </div>

              {/* Preview & mapping */}
              {importPreview && (
                <div className="space-y-5 pt-2 border-t border-gray-200 dark:border-neutral-800">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-3">Mapeo de columnas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {Object.entries(importPreview.fields || {}).map(([field, label]) => (
                        <label key={field} className="grid grid-cols-2 items-center gap-2 text-xs">
                          <span className="text-gray-700 dark:text-neutral-400 truncate">{String(label)}</span>
                          <select
                            value={importMapping[field] ?? ''}
                            onChange={(e) => setImportMapping((m) => ({ ...m, [field]: e.target.value === '' ? null : Number(e.target.value) }))}
                            className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs text-gray-900 dark:text-white"
                          >
                            <option value="">No mapear</option>
                            {(importPreview.headers || []).map((h: string, idx: number) => (
                              <option key={`${field}-${idx}`} value={idx}>{h}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-3">Vista previa</h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-neutral-950">
                          <tr>{(importPreview.headers || []).slice(0, 10).map((h: string, i: number) => <th key={i} className="px-3 py-2 text-left text-gray-600 dark:text-neutral-400 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {(importPreview.sample_rows || []).map((row: any[], i: number) => (
                            <tr key={i} className="border-t border-gray-200 dark:border-neutral-800 even:bg-gray-50 dark:even:bg-neutral-800/30">
                              {row.slice(0, 10).map((v, j) => <td key={j} className="px-3 py-2 text-gray-700 dark:text-neutral-300 whitespace-nowrap">{String(v ?? '')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/50 flex items-center justify-between gap-3">
              <button onClick={() => setImportOpen(false)} disabled={importLoading} className="text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={importLoading || !importPreview || !importFile || !importInsurer}
                className="flex items-center gap-2 rounded-xl bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm shadow-[#573CFF]/30"
              >
                <Icon icon={importLoading ? 'svg-spinners:ring-resize' : 'solar:upload-bold'} width={16} />
                Importar cartera
              </button>
            </div>
          </div>
        </div>
      )}
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

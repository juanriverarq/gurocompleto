import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import saasApi from '../../../services/saasApi';
import { getRamoLabel } from '../../../utils/ramoLabels';
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
interface ComisionRow {
  id: number;
  insurer_code: string;
  insurer_name: string;
  anio: string;
  mes: string;
  ramo_codigo: string | null;
  producto: string | null;
  policy_number: string | null;
  numero_recibo: string | null;
  client_name: string | null;
  client_document: string | null;
  oficina: string | null;
  fecha_recaudo: string | null;
  fecha_pago_asesor: string | null;
  prima_neta: string | number;
  valor_pagado_tomador: string | number;
  porcentaje_comision: string | number;
  valor_comision: string | number;
  estado: string;
  concepto: string | null;
  subramo: string | null;
  synced_at: string | null;
}

interface Stats {
  totals: {
    items: number;
    total_comision: number;
    total_pagado: number;
    total_prima_neta: number;
    last_sync: string | null;
  };
  by_insurer: {
    insurer_code: string;
    insurer_name: string;
    count: number;
    total_comision: number;
    total_pagado: number;
  }[];
  by_periodo: { anio: string; mes: string; count: number; total_comision: number }[];
  by_ramo: { ramo_codigo: string | null; count: number; total_comision: number }[];
}

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

const fmt = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(isNaN(num) ? 0 : num);
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MESES = [
  { v: '01', label: 'Enero' }, { v: '02', label: 'Febrero' }, { v: '03', label: 'Marzo' },
  { v: '04', label: 'Abril' }, { v: '05', label: 'Mayo' }, { v: '06', label: 'Junio' },
  { v: '07', label: 'Julio' }, { v: '08', label: 'Agosto' }, { v: '09', label: 'Septiembre' },
  { v: '10', label: 'Octubre' }, { v: '11', label: 'Noviembre' }, { v: '12', label: 'Diciembre' },
];

const StatCard: React.FC<{
  icon: string; iconColor: string; label: string; value: string; sub?: string;
}> = ({ icon, iconColor, label, value, sub }) => (
  <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 p-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}20` }}>
        <Icon icon={icon} width={20} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-[11px] text-gray-500 dark:text-neutral-500">{sub}</p>}
      </div>
    </div>
  </div>
);

// ─── Component ───────────────────────────────────────────────────
const ComisionesAseguradoras: React.FC = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const now = new Date();
  const initialAnio = String(now.getFullYear());
  const initialMes = String(now.getMonth() + 1).padStart(2, '0');

  const [items, setItems] = useState<ComisionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(searchParams.get('anio') || initialAnio);
  const [mes, setMes] = useState(searchParams.get('mes') || initialMes);
  const [insurerFilter, setInsurerFilter] = useState(searchParams.get('insurer') || '');
  const [ramoFilter, setRamoFilter] = useState(searchParams.get('ramo') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [policyFilter, setPolicyFilter] = useState(searchParams.get('policy') || '');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 });

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [detailRow, setDetailRow] = useState<ComisionRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await saasApi.getRecibosComisionesStats({
        insurer: insurerFilter || undefined,
        anio, mes,
      });
      if (res.success && res.data) setStats(res.data);
    } catch { /* ignore */ }
  }, [insurerFilter, anio, mes]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saasApi.getRecibosComisiones({
        page, per_page: 25, search,
        insurer: insurerFilter || undefined,
        anio, mes,
        ramo: ramoFilter || undefined,
        policy: policyFilter || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data.items || []);
        setPagination(res.data.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 25 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search, insurerFilter, anio, mes, ramoFilter, policyFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const startSync = async () => {
    setSyncing(true);
    setSyncMsg(`Sincronizando comisiones ${anio}/${mes}...`);
    try {
      const res = await saasApi.syncRecibosComisiones({ anio, mes, ramo: '00T' });
      if (res.success) {
        const summary = res.data?.summary || {};
        const parts: string[] = [];
        for (const [code, d] of Object.entries(summary) as [string, any][]) {
          if (d?.error) parts.push(`${code}: ${d.error}`);
          else if (d?.total_fetched != null) parts.push(`${code}: ${d.total_fetched} recibos`);
        }
        setSyncMsg(parts.join(' · ') || 'Sincronización completada');
        await loadStats();
        await loadItems();
      } else {
        setSyncMsg(res.message || 'Error en sincronización');
      }
    } catch (e: any) {
      setSyncMsg(e?.message || 'Error de conexión');
    } finally {
      setSyncing(false);
    }
  };

  const availableInsurers = useMemo(() => stats?.by_insurer || [], [stats]);
  const availableRamos = useMemo(() => stats?.by_ramo || [], [stats]);

  // Años disponibles (año actual y 2 anteriores)
  const anios = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2].map(String);
  }, [now]);

  // ─── Detail Modal ────────────────────────────────────────────
  const renderDetailModal = () => {
    if (!detailRow) return null;
    const r = detailRow;
    const valorComision = typeof r.valor_comision === 'string' ? parseFloat(r.valor_comision) : r.valor_comision;
    const mc = '#22c55e'; // verde para comisiones

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
                  <p className="text-xs text-gray-500 dark:text-neutral-500">{r.insurer_name} · Recibo {r.numero_recibo || '—'}</p>
                </div>
              </div>
              <button onClick={() => setDetailRow(null)} className="w-8 h-8 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors">
                <Icon icon="solar:close-circle-linear" width={20} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Montos */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Prima neta</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(r.prima_neta)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Pagado</p>
                <p className="text-lg font-bold text-gray-600 dark:text-neutral-300">{fmt(r.valor_pagado_tomador)}</p>
              </div>
              <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${mc}40`, backgroundColor: `${mc}08` }}>
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Comisión</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(valorComision)}</p>
                <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5">{Number(r.porcentaje_comision).toFixed(2)}%</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Recibo</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Nº Recibo" value={r.numero_recibo} mono />
                <Field label="Nº Póliza" value={r.policy_number} mono />
                <Field label="Ramo" value={r.ramo_codigo ? `${getRamoLabel(r.ramo_codigo, r.insurer_code)} (${r.ramo_codigo})` : null} />
                <Field label="Producto" value={r.producto} />
                <Field label="Fecha de recaudo" value={fmtDate(r.fecha_recaudo)} />
                <Field label="Fecha pago asesor" value={fmtDate(r.fecha_pago_asesor)} />
                <Field label="Período" value={`${r.mes}/${r.anio}`} />
                <Field label="Oficina" value={r.oficina} />
              </div>
            </div>

            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Cliente</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Nombre" value={r.client_name} />
                <Field label="Documento" value={r.client_document} mono />
              </div>
            </div>

            {r.estado && (
              <div>
                <Field label="Estado" value={r.estado} />
              </div>
            )}

            <div className="pt-2 border-t border-gray-200 dark:border-neutral-800/60">
              <p className="text-[10px] text-gray-500 dark:text-neutral-600">
                Sincronizado: {fmtDate(r.synced_at)} · Fuente: {r.insurer_name}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800/60 flex items-center justify-end gap-2">
            {r.policy_number && (
              <button
                onClick={() => { setDetailRow(null); nav(`/apps/cartera/aseguradoras?search=${encodeURIComponent(r.policy_number!)}`); }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
              >
                <Icon icon="solar:wallet-linear" width={14} />
                Ver en cartera
              </button>
            )}
            {r.policy_number && (
              <button
                onClick={() => { setDetailRow(null); nav(`/apps/seguros/polizas?search=${encodeURIComponent(r.policy_number!)}`); }}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Comisiones por aseguradora</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Recibos y comisiones sincronizados desde los portales de tus aseguradoras.
            {stats?.totals?.last_sync && (
              <span className="ml-2 text-gray-400 dark:text-neutral-500 text-xs">Última sync: {fmtDate(stats.totals.last_sync)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Icon icon={syncing ? 'svg-spinners:ring-resize' : 'solar:refresh-bold-duotone'} width={18} />
            {syncing ? 'Sincronizando...' : `Sincronizar ${MESES.find(m => m.v === mes)?.label || mes} ${anio}`}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/80 px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">
          {syncMsg}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon="solar:dollar-minimalistic-bold-duotone" iconColor="#22c55e" label="Comisión total" value={fmt(stats.totals.total_comision)} sub={`${stats.totals.items} recibos`} />
          <StatCard icon="solar:banknote-2-bold-duotone" iconColor="#3b82f6" label="Pagado tomador" value={fmt(stats.totals.total_pagado)} sub="suma recaudo" />
          <StatCard icon="solar:chart-square-bold-duotone" iconColor="#8b5cf6" label="Prima neta" value={fmt(stats.totals.total_prima_neta)} sub="valor facturado" />
          <StatCard icon="solar:calendar-bold-duotone" iconColor="#f97316" label="Período" value={`${MESES.find(m => m.v === mes)?.label || mes} ${anio}`} sub={stats.totals.items > 0 ? 'con recibos' : 'sin data'} />
        </div>
      )}

      {/* Selector período + aseguradora + ramo */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Año */}
        <select
          value={anio}
          onChange={(e) => { setAnio(e.target.value); setPage(1); }}
          className="rounded-lg bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-xs text-gray-700 dark:text-neutral-300 focus:border-[#573CFF] focus:outline-none"
        >
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {/* Mes */}
        <select
          value={mes}
          onChange={(e) => { setMes(e.target.value); setPage(1); }}
          className="rounded-lg bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-xs text-gray-700 dark:text-neutral-300 focus:border-[#573CFF] focus:outline-none"
        >
          {MESES.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
        </select>

        <div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-1" />

        {/* Píldoras de aseguradora */}
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

        {policyFilter && (
          <>
            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-1" />
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#573CFF]/15 text-[#573CFF] border border-[#573CFF]/30">
              <Icon icon="solar:shield-check-linear" width={12} />
              Póliza: {policyFilter}
              <button onClick={() => { setPolicyFilter(''); setPage(1); }} className="ml-1 hover:text-red-500">
                <Icon icon="solar:close-circle-linear" width={14} />
              </button>
            </span>
          </>
        )}
      </div>

      {/* Contenido principal */}
      <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 overflow-hidden shadow-sm dark:shadow-none">
        {/* Ramos como filtro secundario */}
        {availableRamos.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-200 dark:border-neutral-800 overflow-x-auto">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-neutral-500 mr-2">Ramo:</span>
            <button
              onClick={() => { setRamoFilter(''); setPage(1); }}
              className={`whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-medium ${!ramoFilter ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-500 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
            >Todos</button>
            {availableRamos.map((r) => {
              // Usar la aseguradora filtrada o 'sura' como default (la mayoría de ramos son Sura por ahora)
              const ramoName = getRamoLabel(r.ramo_codigo, insurerFilter || 'sura');
              return (
                <button
                  key={r.ramo_codigo || 'null'}
                  onClick={() => { setRamoFilter(r.ramo_codigo === ramoFilter ? '' : (r.ramo_codigo || '')); setPage(1); }}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-medium ${ramoFilter === r.ramo_codigo ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-500 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
                  title={r.ramo_codigo || 'sin ramo'}
                >
                  {ramoName || 'sin ramo'} <span className="opacity-60">({r.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-neutral-800/60">
          <div className="relative flex-1 max-w-sm">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" width={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, documento, póliza o recibo..."
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
              <p className="text-sm font-medium">Sin recibos de comisión</p>
              <p className="text-xs mt-1">Sincroniza el período seleccionado para ver recibos aquí.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                  <th className="px-4 py-3 font-medium">Aseguradora</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Póliza</th>
                  <th className="px-4 py-3 font-medium">Recibo</th>
                  <th className="px-4 py-3 font-medium">Ramo</th>
                  <th className="px-4 py-3 font-medium">Recaudo</th>
                  <th className="px-4 py-3 font-medium text-right">Pagado</th>
                  <th className="px-4 py-3 font-medium text-right">%</th>
                  <th className="px-4 py-3 font-medium text-right">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800/60">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDetailRow(row)}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                          {INSURER_LOGOS[row.insurer_code] ? (
                            <img src={INSURER_LOGOS[row.insurer_code]} alt="" className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="text-[9px] font-bold text-[#111]">{row.insurer_name.charAt(0)}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-neutral-300 hidden md:inline">{row.insurer_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-[200px] truncate" title={row.client_name || ''}>{row.client_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-neutral-500">{row.client_document || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-neutral-400">{row.policy_number || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-neutral-400">{row.numero_recibo || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-neutral-400" title={row.ramo_codigo || ''}>{getRamoLabel(row.ramo_codigo, row.insurer_code)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500 whitespace-nowrap">{fmtDate(row.fecha_recaudo)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-700 dark:text-neutral-300">{fmt(row.valor_pagado_tomador)}</td>
                    <td className="px-4 py-3 text-xs text-right tabular-nums text-gray-500 dark:text-neutral-500">{Number(row.porcentaje_comision).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmt(row.valor_comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && items.length > 0 && pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-neutral-800/60 text-xs text-gray-500 dark:text-neutral-500">
            <span>Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1}–{Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.current_page === 1}
                className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-40 text-gray-600 dark:text-neutral-400"
              ><Icon icon="solar:alt-arrow-left-linear" width={14} /></button>
              <span className="px-3">{pagination.current_page} / {pagination.last_page}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                disabled={pagination.current_page === pagination.last_page}
                className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-40 text-gray-600 dark:text-neutral-400"
              ><Icon icon="solar:alt-arrow-right-linear" width={14} /></button>
            </div>
          </div>
        )}
      </div>

      {renderDetailModal()}
    </div>
  );
};

export default ComisionesAseguradoras;

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from 'src/hooks/use-toast';
import {
  carteraSimpleService,
  type Cuota,
  type GroupKey,
  type TimelineStats,
  type Accion,
  type CarteraSettings,
} from 'src/services/carteraSimpleService';

// ─── Helpers ────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysFromToday = (d: string | null, today: string): number | null => {
  if (!d) return null;
  const a = new Date(today + 'T00:00:00').getTime();
  const b = new Date(d + 'T00:00:00').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const moraBadge = (dias: number | null) => {
  if (dias === null) return { bg: 'bg-gray-500/15', text: 'text-gray-500 dark:text-neutral-400', label: '—' };
  if (dias > 0) return { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', label: `En ${dias}d` };
  if (dias === 0) return { bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', label: 'Hoy' };
  if (dias >= -30) return { bg: 'bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', label: `${Math.abs(dias)}d` };
  if (dias >= -90) return { bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', label: `${Math.abs(dias)}d` };
  return { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400', label: `${Math.abs(dias)}d` };
};

const moraColor = (dias: number | null) => {
  if (dias === null || dias > 7) return '#22c55e';
  if (dias > 0) return '#3b82f6';
  if (dias === 0) return '#f97316';
  if (dias >= -30) return '#eab308';
  if (dias >= -90) return '#f97316';
  return '#ef4444';
};

// ─── Tabs ─────────────────────────────────────────────────────────────
type TabKey = 'todos' | 'vencidas' | 'hoy' | 'proximos_7' | 'por_pagar' | 'comision' | 'cerradas';

const TABS: { key: TabKey; label: string; icon: string; color?: string; groups: GroupKey[] }[] = [
  { key: 'todos', label: 'Todos', icon: 'solar:list-bold-duotone', groups: ['vencidas', 'hoy', 'proximos_7', 'proximos_30', 'sin_fecha'] },
  { key: 'vencidas', label: 'Vencidas', icon: 'solar:danger-triangle-bold-duotone', color: '#ef4444', groups: ['vencidas'] },
  { key: 'hoy', label: 'Hoy', icon: 'solar:bell-bing-bold-duotone', color: '#f97316', groups: ['hoy'] },
  { key: 'proximos_7', label: 'Próximos 7d', icon: 'solar:calendar-bold-duotone', color: '#eab308', groups: ['proximos_7'] },
  { key: 'por_pagar', label: 'Por pagar aseg.', icon: 'solar:transfer-horizontal-bold-duotone', color: '#a855f7', groups: ['por_pagar_aseguradora'] },
  { key: 'comision', label: 'Comisiones x cobrar', icon: 'solar:hand-money-bold-duotone', color: '#10b981', groups: ['comision_por_cobrar'] },
  { key: 'cerradas', label: 'Cerradas', icon: 'solar:check-circle-bold-duotone', color: '#22c55e', groups: ['cerradas'] },
];

type ActionKey = 'cobrar' | 'pagar_aseguradora' | 'cobrar_comision';

const getPrimaryAction = (cuota: Cuota): { action: ActionKey; label: string; icon: string } | null => {
  if (cuota.recibo_anulado) return null;
  if (!cuota.recaudado_en_oficina && !cuota.recaudado_aseguradora && !cuota.recibo_pago_directo) {
    return { action: 'cobrar', label: 'Cobrar', icon: 'solar:wallet-money-bold' };
  }
  if (cuota.recaudado_en_oficina && !cuota.recaudado_aseguradora) {
    return { action: 'pagar_aseguradora', label: 'Pagar aseg.', icon: 'solar:transfer-horizontal-bold' };
  }
  if (cuota.recaudado_aseguradora && !cuota.comisionada) {
    return { action: 'cobrar_comision', label: 'Cobrar com.', icon: 'solar:hand-money-bold' };
  }
  return null;
};

const getSaldo = (c: Cuota): number => {
  if (c.recaudado_aseguradora) {
    return c.comisionada ? 0 : Math.max(0, c.comision_a_recibir - c.comision_recibida);
  }
  if (c.recaudado_en_oficina) return c.saldo_pendiente_aseguradora;
  return c.saldo_pendiente_oficina;
};

// ─── Stat Card ───────────────────────────────────────────────────
const StatCard: React.FC<{
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
}> = ({ icon, iconColor, label, value, sub, onClick }) => (
  <button
    onClick={onClick}
    className={`text-left rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 p-4 shadow-sm dark:shadow-none transition-colors ${onClick ? 'hover:border-gray-300 dark:hover:border-neutral-700 cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}20` }}>
        <Icon icon={icon} width={18} style={{ color: iconColor }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-neutral-500 font-medium">{label}</span>
    </div>
    <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums">{value}</p>
    <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">{sub}</p>
  </button>
);

// ─── Main Component ─────────────────────────────────────────────────
const Cartera: React.FC = () => {
  const { toast } = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const polizaFilter = searchParams.get('poliza') || '';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Cuota[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [today, setToday] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('todos');
  const [searchInput, setSearchInput] = useState(polizaFilter);
  const [search, setSearch] = useState(polizaFilter);

  // Modals
  const [detailRow, setDetailRow] = useState<Cuota | null>(null);
  const [payModal, setPayModal] = useState<{ cuota: Cuota; action: ActionKey } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CarteraSettings>({ auto_cobrar_comision: false });
  const [savingSettings, setSavingSettings] = useState(false);

  // Cargar items
  const cargar = useCallback(async (q: string, tab: TabKey) => {
    setLoading(true);
    try {
      const tabConfig = TABS.find((t) => t.key === tab);
      const groupParam = tabConfig && tabConfig.groups.length === 1 ? tabConfig.groups[0] : undefined;
      const res = await carteraSimpleService.timeline({ search: q || undefined, group: groupParam, limit: 100 });
      if (res.success) {
        setStats(res.stats);
        setToday(res.today);
        // Aplanar items según grupos del tab
        const allItems: Cuota[] = [];
        const seen = new Set<number>();
        for (const groupKey of tabConfig?.groups || []) {
          const list = res.data[groupKey] || [];
          for (const c of list) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              allItems.push(c);
            }
          }
        }
        setItems(allItems);
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.response?.data?.message || 'No se pudo cargar la cartera',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar(search, activeTab);
    carteraSimpleService.getSettings().then((res) => {
      if (res.success) setSettings(res.data);
    }).catch(() => {});
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce de search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      cargar(searchInput, activeTab);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarSettings = async (next: Partial<CarteraSettings>) => {
    setSavingSettings(true);
    try {
      const res = await carteraSimpleService.updateSettings(next);
      if (res.success) {
        setSettings(res.data);
        toast({ title: 'Preferencia guardada' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  const openPayModal = (cuota: Cuota, action: ActionKey, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const monto =
      action === 'cobrar'
        ? cuota.saldo_pendiente_oficina
        : action === 'pagar_aseguradora'
        ? cuota.saldo_pendiente_aseguradora
        : cuota.comision_a_recibir - cuota.comision_recibida;
    setPayForm({
      monto: String(Math.max(0, monto)),
      metodo_pago: 'efectivo',
      referencia: '',
      fecha: new Date().toISOString().split('T')[0],
      observaciones: '',
    });
    setPayModal({ cuota, action });
    setDetailRow(null);
  };

  const ejecutarPago = async (modo?: 'oficina' | 'directo') => {
    if (!payModal) return;
    const { cuota, action } = payModal;
    const monto = parseFloat(payForm.monto || '0');
    if (monto <= 0) {
      toast({ title: 'Error', description: 'Monto inválido', variant: 'destructive' });
      return;
    }

    let accion: Accion = 'recaudar_oficina';
    if (action === 'cobrar') accion = modo === 'directo' ? 'pagar_directo' : 'recaudar_oficina';
    else if (action === 'pagar_aseguradora') accion = 'pagar_aseguradora';
    else if (action === 'cobrar_comision') accion = 'cobrar_comision';

    setPaying(true);
    try {
      const res = await carteraSimpleService.pagar(cuota.id, {
        accion,
        monto,
        metodo_pago: payForm.metodo_pago,
        referencia: payForm.referencia || undefined,
        fecha: payForm.fecha,
        observaciones: payForm.observaciones || undefined,
      });
      if (res.success) {
        const numRecibo = res.data?.numero_recibo;
        toast({
          title: 'Listo',
          description: numRecibo ? `Recibo #${numRecibo} generado` : 'Operación registrada',
        });
        setPayModal(null);
        await cargar(search, activeTab);
      } else {
        throw new Error(res.message || 'Error');
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.response?.data?.message || e.message || 'No se pudo procesar',
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  const avisar = async (cuota: Cuota, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await carteraSimpleService.avisar(cuota.id);
      toast({
        title: res.success ? 'Aviso enviado' : 'Error',
        description: res.success
          ? `Recordatorio enviado a ${cuota.cliente_nombre}`
          : res.message || 'No se pudo enviar',
        variant: res.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo enviar',
        variant: 'destructive',
      });
    }
  };

  const anular = async (cuota: Cuota, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`¿Anular cuota ${cuota.poliza_numero}?\n\nEsto la marcará como anulada permanentemente.`)) return;
    try {
      const res = await carteraSimpleService.anular(cuota.id);
      if (res.success) {
        toast({ title: 'Anulada' });
        await cargar(search, activeTab);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo anular',
        variant: 'destructive',
      });
    }
  };

  // Revertir el último paso del flujo
  const revertir = async (cuota: Cuota, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const pasoLabel = cuota.comisionada
      ? 'devolver la comisión a "por cobrar"'
      : cuota.recaudado_aseguradora
      ? 'revertir el pago a aseguradora'
      : cuota.recaudado_en_oficina
      ? 'revertir el recaudo de oficina'
      : null;
    if (!pasoLabel) {
      toast({
        title: 'Sin paso para revertir',
        description: 'Esta cuota está pendiente. Usa "Anular" desde el detalle.',
      });
      return;
    }
    if (!confirm(`¿${pasoLabel.charAt(0).toUpperCase() + pasoLabel.slice(1)}?`)) return;
    try {
      const res = await carteraSimpleService.revertirPaso(cuota.id);
      if (res.success) {
        toast({ title: 'Listo', description: res.message });
        await cargar(search, activeTab);
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo revertir', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo revertir',
        variant: 'destructive',
      });
    }
  };

  // ¿La cuota tiene paso para revertir?
  const tieneRevertible = (c: Cuota) =>
    !c.recibo_anulado && (c.comisionada || c.recaudado_aseguradora || c.recaudado_en_oficina);

  const labelRevertir = (c: Cuota) =>
    c.comisionada
      ? 'Descomisionar'
      : c.recaudado_aseguradora
      ? 'Revertir pago aseg.'
      : c.recaudado_en_oficina
      ? 'Revertir recaudo'
      : 'Revertir';

  // Stats por tab
  const tabCounts = useMemo(() => {
    if (!stats) return {} as Record<TabKey, number>;
    return {
      todos: stats.vencidas_count + stats.hoy_count + stats.proximos_7_count + stats.proximos_30_count,
      vencidas: stats.vencidas_count,
      hoy: stats.hoy_count,
      proximos_7: stats.proximos_7_count,
      por_pagar: stats.por_pagar_aseguradora_count,
      comision: stats.comision_por_cobrar_count,
      cerradas: 0,
    } as Record<TabKey, number>;
  }, [stats]);

  // ─── Detail Modal ───────────────────────────────────────────
  const renderDetailModal = () => {
    if (!detailRow) return null;
    const r = detailRow;
    const days = daysFromToday(r.fecha_limite_pago, today);
    const mora = moraBadge(days);
    const mc = moraColor(days);
    const saldo = getSaldo(r);
    const primary = getPrimaryAction(r);

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
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {r.cliente_nombre || 'Sin cliente'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                  {r.aseguradora_nombre || '—'} · {r.cliente_documento || '—'}
                </p>
              </div>
              <button
                onClick={() => setDetailRow(null)}
                className="w-8 h-8 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              >
                <Icon icon="solar:close-circle-linear" width={20} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Stats principales */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/60 p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Prima cuota</p>
                <p className="text-base font-bold text-gray-600 dark:text-neutral-300 tabular-nums">{fmt(r.prima_total_pago)}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Recaudado</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(r.valor_recaudado_oficina)}</p>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-center">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Saldo</p>
                <p className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(saldo)}</p>
              </div>
            </div>

            {/* Estado actual */}
            <div className="rounded-xl border p-3" style={{ borderColor: `${mc}40`, backgroundColor: `${mc}08` }}>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase mb-1">Estado</p>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${mora.bg} ${mora.text}`}>
                  {mora.label}
                </span>
                <span className="text-xs text-gray-600 dark:text-neutral-400">
                  {r.recibo_anulado ? 'Anulada' :
                   r.es_anticipo ? 'Anticipo' :
                   r.recibo_pago_directo ? 'Pago directo' :
                   r.comisionada ? 'Cerrada' :
                   r.recaudado_aseguradora ? 'Comisión x cobrar' :
                   r.recaudado_en_oficina ? 'Por pagar a aseguradora' :
                   'Pendiente'}
                </span>
              </div>
            </div>

            {/* Info póliza */}
            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Póliza</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Número" value={r.poliza_numero} mono />
                <Field label="Ramo" value={r.ramo_principal} />
                <Field label="Cuota" value={r.numero_pago || '—'} />
                <Field label="Renovación" value={r.numero_renovacion ? `R${r.numero_renovacion}` : '—'} />
                {r.vendedor_nombre && <Field label="Vendedor" value={r.vendedor_nombre} />}
                {r.forma_pago && <Field label="Forma pago" value={r.forma_pago} />}
              </div>
            </div>

            {/* Fechas */}
            <div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Fechas</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <Field label="Vencimiento" value={fmtDate(r.fecha_limite_pago)} />
                <Field label="Recaudado" value={fmtDate(r.fecha_recaudado_oficina)} />
                <Field label="Pago aseg." value={fmtDate(r.fecha_pago_aseguradora)} />
              </div>
            </div>

            {/* Comisión info */}
            {r.comision_a_recibir > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-medium uppercase tracking-wider mb-3">Comisión</p>
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <Field label="A recibir" value={fmt(r.comision_a_recibir)} />
                  <Field label="Recibida" value={fmt(r.comision_recibida)} />
                  <Field label="Pendiente" value={fmt(Math.max(0, r.comision_a_recibir - r.comision_recibida))} />
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800/60 flex items-center justify-between gap-2 flex-wrap">
            {/* Acciones secundarias a la izquierda */}
            <div className="flex items-center gap-2 flex-wrap">
              {tieneRevertible(r) && (
                <button
                  onClick={(e) => { revertir(r, e); setDetailRow(null); }}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 font-medium transition-colors"
                  title={labelRevertir(r)}
                >
                  <Icon icon="solar:undo-left-bold" width={14} />
                  {labelRevertir(r)}
                </button>
              )}
              {!r.recaudado_en_oficina && !r.recaudado_aseguradora && !r.comisionada && !r.recibo_anulado && (
                <button
                  onClick={(e) => { anular(r, e); setDetailRow(null); }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400 font-medium transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" width={14} />
                  Anular
                </button>
              )}
            </div>
            {/* Acciones primarias a la derecha */}
            <div className="flex items-center gap-2 flex-wrap">
              {r.cliente_id && (
                <button
                  onClick={() => { setDetailRow(null); nav(`/apps/seguros/clientes?search=${encodeURIComponent(r.cliente_documento || '')}`); }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
                >
                  <Icon icon="solar:user-linear" width={14} />
                  Cliente
                </button>
              )}
              {r.poliza_id && (
                <button
                  onClick={() => { setDetailRow(null); nav(`/apps/seguros/polizas/editar/${r.poliza_id}`); }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
                >
                  <Icon icon="solar:shield-check-linear" width={14} />
                  Póliza
                </button>
              )}
              {!r.recaudado_en_oficina && !r.recibo_anulado && r.poliza_id && (
                <button
                  onClick={(e) => avisar(r, e)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium transition-colors"
                >
                  <Icon icon="solar:chat-round-call-bold" width={14} />
                  WhatsApp
                </button>
              )}
              {primary && (
                <button
                  onClick={(e) => openPayModal(r, primary.action, e)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-xs text-white font-medium transition-colors"
                >
                  <Icon icon={primary.icon} width={14} />
                  {primary.label}
                </button>
              )}
            </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Cartera</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Todas tus cuotas pendientes en un solo lugar.
            {today && <span className="ml-2 text-gray-400 dark:text-neutral-500 text-xs">Hoy: {fmtDate(today)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/apps/cartera/aseguradoras"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
          >
            <Icon icon="solar:buildings-bold-duotone" width={14} />
            Aseguradoras
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors"
            title="Preferencias"
          >
            <Icon icon="solar:settings-bold-duotone" width={14} />
            Preferencias
          </button>
          <button
            onClick={() => cargar(search, activeTab)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2 text-xs text-white font-medium transition-colors"
          >
            <Icon icon={loading ? 'svg-spinners:ring-resize' : 'solar:refresh-bold-duotone'} width={14} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon="solar:danger-triangle-bold-duotone"
            iconColor="#ef4444"
            label="Vencidas"
            value={String(stats.vencidas_count)}
            sub={fmt(stats.vencidas_monto)}
            onClick={() => setActiveTab('vencidas')}
          />
          <StatCard
            icon="solar:transfer-horizontal-bold-duotone"
            iconColor="#a855f7"
            label="Por pagar aseguradora"
            value={String(stats.por_pagar_aseguradora_count)}
            sub={fmt(stats.por_pagar_aseguradora_monto)}
            onClick={() => setActiveTab('por_pagar')}
          />
          <StatCard
            icon="solar:hand-money-bold-duotone"
            iconColor="#10b981"
            label="Comisiones x cobrar"
            value={String(stats.comision_por_cobrar_count)}
            sub={fmt(stats.comision_por_cobrar_monto)}
            onClick={() => setActiveTab('comision')}
          />
          <StatCard
            icon="solar:calendar-bold-duotone"
            iconColor="#3b82f6"
            label="Próximos 7 días"
            value={String(stats.proximos_7_count)}
            sub="cuotas por vencer"
            onClick={() => setActiveTab('proximos_7')}
          />
        </div>
      )}

      {/* Container con tabs + tabla */}
      <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 overflow-hidden shadow-sm dark:shadow-none">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200 dark:border-neutral-800 overflow-x-auto">
          {TABS.map((tab) => {
            const count = tabCounts[tab.key] ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-[#573CFF] text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'}`}
              >
                <Icon icon={tab.icon} width={16} style={tab.color && isActive ? { color: tab.color } : undefined} />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#573CFF]/20 text-[#573CFF] dark:text-[#a78bfa]' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-neutral-800/60">
          <div className="relative flex-1 max-w-sm">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" width={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, documento, póliza, aseguradora..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:border-[#573CFF] focus:outline-none transition-colors"
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto tabular-nums">
            {items.length} {items.length === 1 ? 'cuota' : 'cuotas'}
          </span>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Icon icon="svg-spinners:ring-resize" width={32} className="text-[#573CFF]" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-500">
              <Icon icon="solar:check-circle-bold-duotone" width={48} className="mb-3 text-emerald-400 opacity-60" />
              <p className="text-sm font-medium">¡Todo al día!</p>
              <p className="text-xs mt-1">No hay cuotas en este filtro.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Póliza</th>
                  <th className="px-4 py-3 font-medium">Aseguradora / Ramo</th>
                  <th className="px-4 py-3 font-medium">Vence</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800/60">
                {items.map((row) => {
                  const days = daysFromToday(row.fecha_limite_pago, today);
                  const mora = moraBadge(days);
                  const saldo = getSaldo(row);
                  const primary = getPrimaryAction(row);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDetailRow(row)}
                      className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium max-w-[180px] truncate">
                        {row.cliente_nombre || '—'}
                        {row.numero_renovacion > 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold">
                            R{row.numero_renovacion}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 font-mono">{row.cliente_documento || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 font-mono">
                        {row.poliza_numero || '—'}
                        {row.numero_pago && (
                          <span className="ml-1.5 text-[10px] text-gray-400 dark:text-neutral-600">·{row.numero_pago}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[180px] truncate">
                        <div className="text-gray-700 dark:text-neutral-300">{row.aseguradora_nombre || '—'}</div>
                        <div className="text-[11px] text-gray-400 dark:text-neutral-500">{row.ramo_principal || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                        {fmtDate(row.fecha_limite_pago)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-semibold text-right tabular-nums">
                        {fmt(saldo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${mora.bg} ${mora.text}`}>
                          {mora.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {primary && (
                            <button
                              onClick={(e) => openPayModal(row, primary.action, e)}
                              className="flex items-center gap-1 rounded-md bg-[#573CFF] hover:bg-[#4b31e6] px-2 py-1 text-[11px] text-white font-medium transition-colors"
                              title={primary.label}
                            >
                              <Icon icon={primary.icon} width={12} />
                              {primary.label}
                            </button>
                          )}
                          {!row.recaudado_en_oficina && !row.recibo_anulado && row.poliza_id && (
                            <button
                              onClick={(e) => avisar(row, e)}
                              className="w-7 h-7 rounded-md border border-gray-200 dark:border-neutral-800 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-400 dark:text-neutral-500 flex items-center justify-center transition-colors"
                              title="WhatsApp"
                            >
                              <Icon icon="solar:chat-round-call-bold" width={12} />
                            </button>
                          )}
                          {tieneRevertible(row) && (
                            <button
                              onClick={(e) => revertir(row, e)}
                              className="w-7 h-7 rounded-md border border-gray-200 dark:border-neutral-800 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 text-gray-400 dark:text-neutral-500 flex items-center justify-center transition-colors"
                              title={labelRevertir(row)}
                            >
                              <Icon icon="solar:undo-left-bold" width={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {renderDetailModal()}

      {/* Payment Modal */}
      {payModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={() => !paying && setPayModal(null)}>
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111112] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-[#573CFF] to-[#4b31e6]" />
            <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-neutral-800/60">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {payModal.action === 'cobrar' && 'Registrar pago'}
                {payModal.action === 'pagar_aseguradora' && 'Pagar a aseguradora'}
                {payModal.action === 'cobrar_comision' && 'Cobrar comisión'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                {payModal.cuota.cliente_nombre} · {payModal.cuota.poliza_numero}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Monto</label>
                <input
                  type="number"
                  value={payForm.monto}
                  onChange={(e) => setPayForm({ ...payForm, monto: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-base font-semibold text-gray-900 dark:text-white tabular-nums focus:border-[#573CFF] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Método</label>
                  <select
                    value={payForm.metodo_pago}
                    onChange={(e) => setPayForm({ ...payForm, metodo_pago: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white focus:border-[#573CFF] focus:outline-none"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                    <option value="pse">PSE</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Fecha</label>
                  <input
                    type="date"
                    value={payForm.fecha}
                    onChange={(e) => setPayForm({ ...payForm, fecha: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white focus:border-[#573CFF] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Referencia (opcional)</label>
                <input
                  type="text"
                  value={payForm.referencia}
                  onChange={(e) => setPayForm({ ...payForm, referencia: e.target.value })}
                  placeholder="Nro. comprobante o transacción"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white focus:border-[#573CFF] focus:outline-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800/60 flex items-center justify-end gap-2 flex-wrap">
              <button onClick={() => setPayModal(null)} disabled={paying} className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-600 dark:text-neutral-300 transition-colors">
                Cancelar
              </button>
              {payModal.action === 'cobrar' ? (
                <>
                  <button
                    onClick={() => ejecutarPago('directo')}
                    disabled={paying}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 px-3 py-2 text-xs text-gray-700 dark:text-neutral-300 font-medium transition-colors"
                  >
                    <Icon icon="solar:card-send-bold" width={14} />
                    Pagó directo a aseguradora
                  </button>
                  <button
                    onClick={() => ejecutarPago('oficina')}
                    disabled={paying}
                    className="flex items-center gap-1.5 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2 text-xs text-white font-medium transition-colors"
                  >
                    <Icon icon={paying ? 'svg-spinners:ring-resize' : 'solar:buildings-bold'} width={14} />
                    Recibí en oficina
                  </button>
                </>
              ) : (
                <button
                  onClick={() => ejecutarPago()}
                  disabled={paying}
                  className="flex items-center gap-1.5 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2 text-xs text-white font-medium transition-colors"
                >
                  <Icon icon={paying ? 'svg-spinners:ring-resize' : 'solar:check-circle-bold'} width={14} />
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Settings Modal */}
      {settingsOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111112] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-[#573CFF] to-[#4b31e6]" />
            <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-neutral-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:settings-bold-duotone" className="text-[#573CFF]" width={20} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preferencias</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              >
                <Icon icon="solar:close-circle-linear" width={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.auto_cobrar_comision}
                  disabled={savingSettings}
                  onChange={(e) => guardarSettings({ auto_cobrar_comision: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded text-[#573CFF] focus:ring-[#573CFF]"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Cobrar comisión automáticamente
                  </div>
                  <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                    Al pagar a la aseguradora, la comisión se marca como cobrada de inmediato.
                  </div>
                </div>
              </label>
              <div className="text-[11px] text-gray-500 dark:text-neutral-500 bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl flex items-start gap-2">
                <Icon icon="solar:info-circle-bold" className="text-blue-500 shrink-0 mt-0.5" width={14} />
                <span>Las preferencias se aplican a partir del próximo registro. No modifican pagos anteriores.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800/60 flex items-center justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-xs text-white font-medium transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default Cartera;

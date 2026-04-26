import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Spinner, Modal, Button, TextInput, Select, Label, Badge } from 'flowbite-react';
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
const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v || 0);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return d;
  }
};

const daysFromToday = (d: string | null, today: string): number | null => {
  if (!d) return null;
  const a = new Date(today + 'T00:00:00').getTime();
  const b = new Date(d + 'T00:00:00').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

// ─── Group metadata ─────────────────────────────────────────────────
const GROUP_META: Record<
  GroupKey,
  { title: string; icon: string; color: string; subtitle: string; defaultOpen: boolean }
> = {
  vencidas: {
    title: 'Vencidas',
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'text-red-600',
    subtitle: 'Cobra YA — el cliente está en mora',
    defaultOpen: true,
  },
  hoy: {
    title: 'Vencen hoy',
    icon: 'solar:bell-bing-bold-duotone',
    color: 'text-orange-600',
    subtitle: 'Avísale al cliente o regístra el pago',
    defaultOpen: true,
  },
  proximos_7: {
    title: 'Próximos 7 días',
    icon: 'solar:calendar-bold-duotone',
    color: 'text-amber-600',
    subtitle: 'Anticipa con un recordatorio',
    defaultOpen: true,
  },
  proximos_30: {
    title: 'Próximos 30 días',
    icon: 'solar:calendar-mark-bold-duotone',
    color: 'text-blue-600',
    subtitle: 'Programación normal',
    defaultOpen: false,
  },
  sin_fecha: {
    title: 'Sin fecha definida',
    icon: 'solar:question-circle-bold-duotone',
    color: 'text-gray-500',
    subtitle: 'Pendientes sin vencimiento — revisa o asigna fecha',
    defaultOpen: false,
  },
  por_pagar_aseguradora: {
    title: 'Recaudadas — pagar a aseguradora',
    icon: 'solar:transfer-horizontal-bold-duotone',
    color: 'text-purple-600',
    subtitle: 'Ya recibiste el dinero, transfiérelo a la aseguradora',
    defaultOpen: false,
  },
  comision_por_cobrar: {
    title: 'Comisiones por cobrar',
    icon: 'solar:hand-money-bold-duotone',
    color: 'text-emerald-600',
    subtitle: 'La aseguradora ya cobró, ahora cobra tu comisión',
    defaultOpen: false,
  },
  cerradas: {
    title: 'Cerradas (últimos 30 días)',
    icon: 'solar:check-circle-bold-duotone',
    color: 'text-green-600',
    subtitle: 'Histórico — todo cerrado',
    defaultOpen: false,
  },
};

const ORDER: GroupKey[] = [
  'vencidas',
  'hoy',
  'proximos_7',
  'proximos_30',
  'sin_fecha',
  'por_pagar_aseguradora',
  'comision_por_cobrar',
  'cerradas',
];

// ─── Action mapping ─────────────────────────────────────────────────
type ActionKey = 'cobrar' | 'pagar_aseguradora' | 'cobrar_comision';

const getPrimaryAction = (cuota: Cuota): { action: ActionKey; label: string; icon: string } | null => {
  if (cuota.recibo_anulado) return null;
  if (!cuota.recaudado_en_oficina && !cuota.recaudado_aseguradora && !cuota.recibo_pago_directo) {
    return { action: 'cobrar', label: 'Cobrar', icon: 'solar:wallet-money-bold' };
  }
  if (cuota.recaudado_en_oficina && !cuota.recaudado_aseguradora) {
    return { action: 'pagar_aseguradora', label: 'Pagar a aseguradora', icon: 'solar:transfer-horizontal-bold' };
  }
  if (cuota.recaudado_aseguradora && !cuota.comisionada) {
    return { action: 'cobrar_comision', label: 'Cobrar comisión', icon: 'solar:hand-money-bold' };
  }
  return null;
};

// ─── Cuota Card ─────────────────────────────────────────────────────
interface CuotaCardProps {
  cuota: Cuota;
  today: string;
  onAction: (cuota: Cuota, action: ActionKey) => void;
  onAvisar: (cuota: Cuota) => void;
  onAnular: (cuota: Cuota) => void;
}

const CuotaCard: React.FC<CuotaCardProps> = ({ cuota, today, onAction, onAvisar, onAnular }) => {
  const primary = getPrimaryAction(cuota);
  const days = daysFromToday(cuota.fecha_limite_pago, today);
  const saldo = cuota.recaudado_aseguradora
    ? cuota.comisionada
      ? 0
      : cuota.comision_a_recibir - cuota.comision_recibida
    : cuota.recaudado_en_oficina
    ? cuota.saldo_pendiente_aseguradora
    : cuota.saldo_pendiente_oficina;

  const venceLabel = (() => {
    if (!cuota.fecha_limite_pago) return null;
    if (days === null) return null;
    if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
    if (days === 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    return `Vence en ${days} días`;
  })();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/apps/seguros/polizas/editar/${cuota.poliza_id}`}
              className="font-semibold text-gray-900 dark:text-white hover:text-primary truncate"
            >
              {cuota.poliza_numero || `Cuota #${cuota.id}`}
            </Link>
            {cuota.numero_pago && (
              <Badge color="indigo" size="xs">
                Cuota {cuota.numero_pago}
              </Badge>
            )}
            {cuota.numero_renovacion > 0 && (
              <Badge color="purple" size="xs">
                R{cuota.numero_renovacion}
              </Badge>
            )}
          </div>

          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {cuota.cliente_nombre || 'Sin cliente'}
            {cuota.cliente_documento && (
              <span className="text-gray-400 text-xs ml-2">{cuota.cliente_documento}</span>
            )}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
            {cuota.aseguradora_nombre && <span>{cuota.aseguradora_nombre}</span>}
            {cuota.ramo_principal && (
              <>
                <span>·</span>
                <span>{cuota.ramo_principal}</span>
              </>
            )}
            {cuota.fecha_limite_pago && (
              <>
                <span>·</span>
                <span>{fmtDate(cuota.fecha_limite_pago)}</span>
              </>
            )}
          </div>

          {venceLabel && (
            <div
              className={`text-xs mt-1.5 font-medium ${
                days! < 0 ? 'text-red-600' : days === 0 ? 'text-orange-600' : 'text-gray-500'
              }`}
            >
              {venceLabel}
            </div>
          )}
        </div>

        {/* Monto + acciones */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {fmt(saldo)}
            </div>
            {cuota.prima_total_pago > 0 && saldo !== cuota.prima_total_pago && (
              <div className="text-xs text-gray-400">de {fmt(cuota.prima_total_pago)}</div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {primary && (
              <Button
                size="xs"
                color="primary"
                onClick={() => onAction(cuota, primary.action)}
                className="!bg-primary hover:!bg-primaryemphasis"
              >
                <Icon icon={primary.icon} className="mr-1" width={14} />
                {primary.label}
              </Button>
            )}

            {!cuota.recaudado_en_oficina && !cuota.recibo_anulado && cuota.poliza_id && (
              <Button
                size="xs"
                color="light"
                outline
                onClick={() => onAvisar(cuota)}
                title="Enviar recordatorio por WhatsApp"
              >
                <Icon icon="solar:chat-round-call-bold" width={14} />
              </Button>
            )}

            {!cuota.recibo_anulado && (
              <Button
                size="xs"
                color="light"
                outline
                onClick={() => onAnular(cuota)}
                title="Anular cuota"
              >
                <Icon icon="solar:close-circle-bold" width={14} className="text-red-500" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────
const Cartera: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const polizaFilter = searchParams.get('poliza') || '';

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Partial<Record<GroupKey, Cuota[]>>>({});
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [today, setToday] = useState<string>('');
  const [search, setSearch] = useState(polizaFilter);
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(
    new Set(ORDER.filter((k) => GROUP_META[k].defaultOpen)),
  );

  // Modal de pago
  const [payModal, setPayModal] = useState<{ cuota: Cuota; action: ActionKey } | null>(null);
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CarteraSettings>({ auto_cobrar_comision: false });
  const [savingSettings, setSavingSettings] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  const cargar = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await carteraSimpleService.timeline({ search: q || undefined });
      if (res.success) {
        setGroups(res.data);
        setStats(res.stats);
        setToday(res.today);
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
    cargar(search);
    // Cargar settings al montar
    carteraSimpleService.getSettings().then((res) => {
      if (res.success) setSettings(res.data);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarSettings = async (next: Partial<CarteraSettings>) => {
    setSavingSettings(true);
    try {
      const res = await carteraSimpleService.updateSettings(next);
      if (res.success) {
        setSettings(res.data);
        toast({ title: 'Preferencia guardada' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => cargar(search), 300);
    return () => clearTimeout(t);
  }, [search, cargar]);

  const toggleGroup = (k: GroupKey) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const openPayModal = (cuota: Cuota, action: ActionKey) => {
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
    if (action === 'cobrar') {
      accion = modo === 'directo' ? 'pagar_directo' : 'recaudar_oficina';
    } else if (action === 'pagar_aseguradora') {
      accion = 'pagar_aseguradora';
    } else if (action === 'cobrar_comision') {
      accion = 'cobrar_comision';
    }

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
        await cargar(search);
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

  const avisar = async (cuota: Cuota) => {
    try {
      const res = await carteraSimpleService.avisar(cuota.id);
      toast({
        title: res.success ? 'Aviso enviado' : 'Error',
        description: res.success
          ? `Recordatorio enviado a ${cuota.cliente_nombre}`
          : res.message || 'No se pudo enviar',
        variant: res.success ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.response?.data?.message || 'No se pudo enviar el aviso',
        variant: 'destructive',
      });
    }
  };

  const anular = async (cuota: Cuota) => {
    if (!confirm(`¿Anular cuota ${cuota.poliza_numero} (${fmt(cuota.saldo_pendiente_oficina)})?`)) return;
    try {
      const res = await carteraSimpleService.anular(cuota.id);
      if (res.success) {
        toast({ title: 'Anulada' });
        await cargar(search);
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.response?.data?.message || 'No se pudo anular',
        variant: 'destructive',
      });
    }
  };

  // Stats hero
  const heroStats = useMemo(
    () => [
      {
        label: 'Vencidas',
        count: stats?.vencidas_count || 0,
        monto: stats?.vencidas_monto || 0,
        color: 'text-red-600',
        bg: 'bg-red-50 dark:bg-red-950/30',
        icon: 'solar:danger-triangle-bold',
        action: () => setOpenGroups(new Set(['vencidas'])),
      },
      {
        label: 'Por pagar a aseguradora',
        count: stats?.por_pagar_aseguradora_count || 0,
        monto: stats?.por_pagar_aseguradora_monto || 0,
        color: 'text-purple-600',
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        icon: 'solar:transfer-horizontal-bold',
        action: () => setOpenGroups(new Set(['por_pagar_aseguradora'])),
      },
      {
        label: 'Comisiones x cobrar',
        count: stats?.comision_por_cobrar_count || 0,
        monto: stats?.comision_por_cobrar_monto || 0,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        icon: 'solar:hand-money-bold',
        action: () => setOpenGroups(new Set(['comision_por_cobrar'])),
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" className="text-primary" width={28} />
            Cartera
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todas tus cuotas pendientes en un solo lugar
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            to="/apps/cartera/aseguradoras"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <Icon icon="solar:buildings-bold" width={14} />
            Cartera Aseguradoras
          </Link>
          <Button
            color="light"
            size="xs"
            onClick={() => setSettingsOpen(true)}
            title="Preferencias de cartera"
          >
            <Icon icon="solar:settings-bold-duotone" width={16} />
          </Button>
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {heroStats.map((s) => (
          <button
            key={s.label}
            onClick={s.action}
            className={`${s.bg} rounded-xl p-4 text-left hover:shadow-md transition-shadow border border-transparent hover:border-current/20`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon={s.icon} className={s.color} width={24} />
              <span className={`text-2xl font-bold ${s.color}`}>{s.count}</span>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">{s.label}</div>
            <div className={`text-sm font-semibold mt-1 ${s.color}`}>{fmt(s.monto)}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon
          icon="solar:magnifer-linear"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width={18}
        />
        <TextInput
          type="text"
          placeholder="Buscar cliente, póliza, documento, aseguradora..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          sizing="md"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Groups */}
      {!loading && (
        <div className="space-y-3">
          {ORDER.map((key) => {
            const items = groups[key] || [];
            if (items.length === 0) return null;
            const meta = GROUP_META[key];
            const isOpen = openGroups.has(key);
            const totalMonto = items.reduce((s, c) => {
              const v = c.recaudado_aseguradora
                ? c.comisionada
                  ? 0
                  : c.comision_a_recibir - c.comision_recibida
                : c.recaudado_en_oficina
                ? c.saldo_pendiente_aseguradora
                : c.saldo_pendiente_oficina;
              return s + v;
            }, 0);

            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon icon={meta.icon} className={meta.color} width={28} />
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {meta.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {meta.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-bold ${meta.color}`}>{items.length}</div>
                      <div className="text-xs text-gray-500">{fmt(totalMonto)}</div>
                    </div>
                    <Icon
                      icon={isOpen ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                      className="text-gray-400"
                      width={20}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/30">
                    {items.map((cuota) => (
                      <CuotaCard
                        key={cuota.id}
                        cuota={cuota}
                        today={today}
                        onAction={openPayModal}
                        onAvisar={avisar}
                        onAnular={anular}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {Object.values(groups).every((g) => !g || g.length === 0) && (
            <div className="text-center py-16 text-gray-500">
              <Icon
                icon="solar:check-circle-bold-duotone"
                className="mx-auto mb-3 text-green-400"
                width={64}
              />
              <p className="text-lg font-medium">¡Todo al día!</p>
              <p className="text-sm">No hay cuotas pendientes con esos filtros.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de pago */}
      <Modal show={!!payModal} onClose={() => setPayModal(null)} size="md">
        <Modal.Header>
          {payModal?.action === 'cobrar' && 'Registrar pago'}
          {payModal?.action === 'pagar_aseguradora' && 'Pagar a aseguradora'}
          {payModal?.action === 'cobrar_comision' && 'Cobrar comisión'}
        </Modal.Header>
        <Modal.Body>
          {payModal && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{payModal.cuota.cliente_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Póliza:</span>
                  <span className="font-medium">{payModal.cuota.poliza_numero}</span>
                </div>
                {payModal.cuota.numero_pago && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cuota:</span>
                    <span className="font-medium">{payModal.cuota.numero_pago}</span>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="monto">Monto *</Label>
                <TextInput
                  id="monto"
                  type="number"
                  value={payForm.monto}
                  onChange={(e) => setPayForm({ ...payForm, monto: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="metodo">Método</Label>
                  <Select
                    id="metodo"
                    value={payForm.metodo_pago}
                    onChange={(e) => setPayForm({ ...payForm, metodo_pago: e.target.value })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                    <option value="pse">PSE</option>
                    <option value="otro">Otro</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fecha">Fecha</Label>
                  <TextInput
                    id="fecha"
                    type="date"
                    value={payForm.fecha}
                    onChange={(e) => setPayForm({ ...payForm, fecha: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ref">Referencia (opcional)</Label>
                <TextInput
                  id="ref"
                  value={payForm.referencia}
                  onChange={(e) => setPayForm({ ...payForm, referencia: e.target.value })}
                  placeholder="Nro. comprobante o transacción"
                />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="flex-col sm:flex-row gap-2">
          {payModal?.action === 'cobrar' ? (
            <>
              <Button
                color="primary"
                onClick={() => ejecutarPago('oficina')}
                disabled={paying}
                className="!bg-primary hover:!bg-primaryemphasis flex-1"
              >
                {paying ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:buildings-bold" className="mr-2" width={16} />}
                Recibí en oficina
              </Button>
              <Button
                color="light"
                onClick={() => ejecutarPago('directo')}
                disabled={paying}
                className="flex-1"
              >
                <Icon icon="solar:card-send-bold" className="mr-2" width={16} />
                Pagó directo a aseguradora
              </Button>
            </>
          ) : (
            <Button
              color="primary"
              onClick={() => ejecutarPago()}
              disabled={paying}
              className="!bg-primary hover:!bg-primaryemphasis"
            >
              {paying ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:check-circle-bold" className="mr-2" width={16} />}
              Confirmar
            </Button>
          )}
          <Button color="gray" onClick={() => setPayModal(null)} disabled={paying}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Settings */}
      <Modal show={settingsOpen} onClose={() => setSettingsOpen(false)} size="md">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:settings-bold-duotone" className="text-primary" width={22} />
            Preferencias de cartera
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <input
                type="checkbox"
                checked={settings.auto_cobrar_comision}
                disabled={savingSettings}
                onChange={(e) => guardarSettings({ auto_cobrar_comision: e.target.checked })}
                className="mt-1 w-5 h-5 rounded text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  Cobrar comisión automáticamente
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Cuando registres un pago a la aseguradora, la comisión se marca como cobrada
                  inmediatamente. Te ahorra un click extra por cada póliza.
                </div>
              </div>
            </label>

            <div className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" className="text-blue-500 shrink-0 mt-0.5" width={16} />
              <span>
                Las preferencias se aplican a partir del próximo registro. Los pagos anteriores
                no se modifican.
              </span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => setSettingsOpen(false)} className="!bg-primary hover:!bg-primaryemphasis">
            Listo
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Cartera;

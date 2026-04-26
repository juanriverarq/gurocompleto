import React, { useEffect, useState, useMemo } from 'react';
import { Card, Badge, Spinner, Button, Modal, TextInput, Select, Label, Table, Tooltip } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import api from 'src/config/api';
import { useToast } from 'src/hooks/use-toast';
import { printRecibo, type ReciboPrintData, type BrokerPrintData } from 'src/views/apps/cartera/printRecibo';

interface Pago {
  id: number;
  poliza_id: number;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  tipo_recaudo: 'oficina' | 'aseguradora';
  metodo_pago?: string;
  referencia_pago?: string;
  fecha_pago: string;
  estado: 'pagado' | 'parcial' | 'pendiente';
  observaciones?: string;
  cartera_item_id?: number;
}

interface Recibo {
  id: number;
  numero_recibo: string;
  tipo: string;
  tipo_recaudo: string;
  forma_pago?: string;
  valor_recaudado_en_oficina?: number;
  valor_a_pagar?: number;
  fecha_realizo_pago_oficina?: string;
  recibo_anulado: boolean;
  activo: boolean;
  observaciones?: string;
  created_at: string;
  pago_poliza_id?: number;
}

interface CarteraItemSS {
  id: number;
  poliza_id: number;
  numero_pago?: string;
  anexo_numero?: string;
  prima_total_pago: number;
  valor_recaudado_oficina: number;
  saldo_pendiente_oficina: number;
  saldo_pendiente_aseguradora: number;
  valor_pagado_aseguradora: number;
  comision_a_recibir: number;
  estado_cartera: string;
  recaudado_en_oficina: boolean;
  recaudado_aseguradora: boolean;
  comisionada: boolean;
  recibo_pago_directo: boolean;
  fecha_limite_pago?: string;
  softseguros_pago_id?: number;
}

interface CuotaSimulada {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  estado: 'pagado' | 'parcial' | 'pendiente' | 'vencido';
  pagos: Pago[];
  montoPagado: number;
  montoPendiente: number;
  anexo_numero?: string;
  carteraItemId?: number;
}

type Props = {
  polizaId: string;
  clienteId?: string;
  primaTotal: number;
  primaNeta?: number;
  periodicidad?: string;
  fechaInicio: string;
  fechaFin: string;
  formaPago?: string;
  numeroPoliza: string;
  clienteNombre?: string;
  aseguradoraNombre?: string;
  ramoNombre?: string;
  installmentsCount?: number | null;
};

const PERIODICIDAD_MESES: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const formatDate = (d: string) => {
  if (!d) return '-';
  try {
    const [y, m, day] = d.split('T')[0].split('-');
    return `${day}/${m}/${y}`;
  } catch {
    return d;
  }
};

const PagosPoliza: React.FC<Props> = ({
  polizaId,
  clienteId,
  primaTotal,
  primaNeta,
  periodicidad,
  fechaInicio,
  fechaFin,
  formaPago,
  numeroPoliza,
  clienteNombre,
  aseguradoraNombre,
  ramoNombre,
  installmentsCount,
}) => {
  const { toast } = useToast();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [carteraItems, setCarteraItems] = useState<CarteraItemSS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<CuotaSimulada | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<Recibo | null>(null);
  const [printFormatRecibo, setPrintFormatRecibo] = useState<Recibo | null>(null);
  const [brokerInfo, setBrokerInfo] = useState<BrokerPrintData | null>(null);

  const [nuevoPago, setNuevoPago] = useState({
    monto: '',
    tipo_recaudo: 'oficina' as 'oficina' | 'aseguradora' | 'directo',
    metodo_pago: 'efectivo',
    referencia_pago: '',
    observaciones: '',
  });

  // Edición de pago existente
  const [showEditModal, setShowEditModal] = useState(false);
  const [pagoEditando, setPagoEditando] = useState<Pago | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [editPago, setEditPago] = useState({
    fecha_pago: '',
    monto: '',
    metodo_pago: 'efectivo',
    referencia_pago: '',
    observaciones: '',
  });

  // Edición de la cuota (cartera_item) — fecha vencimiento, monto, comisión
  const [showEditCuotaModal, setShowEditCuotaModal] = useState(false);
  const [cuotaEditando, setCuotaEditando] = useState<CuotaSimulada | null>(null);
  const [guardandoCuota, setGuardandoCuota] = useState(false);
  const [editCuota, setEditCuota] = useState({
    fecha_limite_pago: '',
    prima_total_pago: '',
    comision_a_recibir: '',
  });

  // Cargar pagos y recibos existentes
  const loadData = async () => {
    try {
      setLoading(true);
      const [pagosRes, recibosRes, carteraRes] = await Promise.all([
        api.get(`/saas/polizas/${polizaId}/pagos`),
        api.get(`/saas/cartera/recibos-caja`, { params: { poliza_id: polizaId, per_page: 100 } }).catch(() => null),
        api.get(`/saas/polizas/${polizaId}/cartera-items`).catch(() => null),
      ]);
      if (pagosRes.data?.success) {
        setPagos(pagosRes.data.data || []);
      }
      if (recibosRes?.data?.success) {
        setRecibos(recibosRes.data.data || []);
      }
      if (carteraRes?.data?.success) {
        setCarteraItems(carteraRes.data.data || []);
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Load broker info for recibo printing
    api.get('/saas/broker/profile').then(res => {
      const b = res.data;
      if (b?.success) {
        setBrokerInfo({
          nombre: b.legal_name || b.name || 'Agencia de Seguros',
          nit: b.document_number || '',
          logo_url: b.logo_url,
          direccion: b.address,
          ciudad: b.city || '',
          telefono: b.phone,
          email: b.email,
        });
      }
    }).catch(() => {});
  }, [polizaId]);

  // Build cuotas from cartera_items (real SS data) when available, otherwise simulate
  const cuotas = useMemo<CuotaSimulada[]>(() => {
    // If we have cartera_items from SS, use them as real cuotas
    if (carteraItems.length > 0) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      return carteraItems.map((ci, idx) => {
        const monto = parseFloat(String(ci.prima_total_pago)) || 0;
        const recaudado = parseFloat(String(ci.valor_recaudado_oficina)) || 0;
        const pendiente = parseFloat(String(ci.saldo_pendiente_oficina)) || 0;
        const fechaVenc = ci.fecha_limite_pago ? ci.fecha_limite_pago.split('T')[0] : fechaInicio;

        let estado: CuotaSimulada['estado'] = 'pendiente';
        if (ci.estado_cartera === 'comision_recibida' || ci.estado_cartera === 'comision_por_cobrar' || ci.estado_cartera === 'por_pagar') {
          estado = 'pagado';
        } else if (recaudado > 0 && pendiente > 0) {
          estado = 'parcial';
        } else if (pendiente > 0 && fechaVenc && new Date(fechaVenc + 'T00:00:00') < hoy) {
          estado = 'vencido';
        }

        // Parse numero_pago "2/9" -> 2
        const numPago = ci.numero_pago ? parseInt(ci.numero_pago.split('/')[0]) : idx + 1;

        return {
          numero: numPago,
          fechaVencimiento: fechaVenc,
          monto: Math.round(monto),
          estado,
          pagos: [], // Real pagos are in the historial below
          montoPagado: Math.round(recaudado),
          montoPendiente: Math.round(pendiente),
          anexo_numero: ci.anexo_numero || undefined,
          carteraItemId: ci.id,
        };
      });
    }

    // Fallback: simulate cuotas from periodicidad (for polizas without cartera_items)
    const periodo = periodicidad?.toLowerCase() || 'anual';
    const meses = PERIODICIDAD_MESES[periodo] || 12;

    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return [];

    const diffMs = fin.getTime() - inicio.getTime();
    const diffMeses = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    const numCuotas = (installmentsCount && installmentsCount > 0) ? installmentsCount : Math.max(1, Math.round(diffMeses / meses));
    const montoCuota = primaTotal / numCuotas;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const todosLosPagos = [...pagos].sort(
      (a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime(),
    );

    let saldoAcumulado = 0;
    const result: CuotaSimulada[] = [];

    for (let i = 0; i < numCuotas; i++) {
      const fechaVenc = new Date(inicio);
      fechaVenc.setMonth(fechaVenc.getMonth() + meses * i);
      const fechaVencStr = fechaVenc.toISOString().split('T')[0];

      const fechaLimiteSuperior = new Date(inicio);
      fechaLimiteSuperior.setMonth(fechaLimiteSuperior.getMonth() + meses * (i + 1));

      const pagosEnRango = todosLosPagos.filter((p) => {
        const fp = new Date(p.fecha_pago);
        return fp >= fechaVenc && fp < fechaLimiteSuperior;
      });

      const pagadoEnCuota = pagosEnRango.reduce((sum, p) => sum + (p.monto_pagado || 0), 0);
      saldoAcumulado += pagadoEnCuota;

      const montoAcumuladoRequerido = montoCuota * (i + 1);
      const cubierto = Math.min(saldoAcumulado, montoAcumuladoRequerido);
      const pendienteEnCuota = Math.max(0, montoAcumuladoRequerido - cubierto);

      let estado: CuotaSimulada['estado'] = 'pendiente';
      if (pendienteEnCuota <= 0.5) {
        estado = 'pagado';
      } else if (
        pagadoEnCuota > 0 ||
        (saldoAcumulado > montoCuota * i && saldoAcumulado < montoAcumuladoRequerido)
      ) {
        estado = 'parcial';
      } else if (fechaVenc < hoy) {
        estado = 'vencido';
      }

      result.push({
        numero: i + 1,
        fechaVencimiento: fechaVencStr,
        monto: Math.round(montoCuota),
        estado,
        pagos: pagosEnRango,
        montoPagado: Math.round(Math.min(pagadoEnCuota, montoCuota)),
        montoPendiente: Math.round(pendienteEnCuota),
      });
    }

    return result;
  }, [periodicidad, fechaInicio, fechaFin, primaTotal, pagos, installmentsCount, carteraItems]);

  // Estadísticas
  const stats = useMemo(() => {
    let totalPagado: number;
    let totalPendiente: number;
    if (carteraItems.length > 0) {
      totalPagado = cuotas.reduce((s, c) => s + c.montoPagado, 0);
      totalPendiente = cuotas.reduce((s, c) => s + c.montoPendiente, 0);
    } else {
      totalPagado = pagos.reduce((s, p) => s + (parseFloat(String(p.monto_pagado)) || 0), 0);
      totalPendiente = Math.max(0, (primaTotal || 0) - totalPagado);
    }
    const cuotasPagadas = cuotas.filter((c) => c.estado === 'pagado').length;
    const cuotasVencidas = cuotas.filter((c) => c.estado === 'vencido').length;
    const totalPrima = carteraItems.length > 0 ? cuotas.reduce((s, c) => s + c.monto, 0) : (primaTotal || 0);
    return { totalPagado, totalPendiente, cuotasPagadas, cuotasVencidas, totalCuotas: cuotas.length, totalPrima };
  }, [cuotas, pagos, primaTotal, carteraItems]);

  // Registrar pago + generar recibo
  const handleRegistrarPago = async () => {
    if (!nuevoPago.monto || parseFloat(nuevoPago.monto) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido', variant: 'destructive' });
      return;
    }

    try {
      setRegistrando(true);
      const monto = parseFloat(nuevoPago.monto);
      const fechaPago = cuotaSeleccionada?.fechaVencimiento || new Date().toISOString().split('T')[0];
      const obs = nuevoPago.observaciones || `Pago cuota #${cuotaSeleccionada?.numero} - ${numeroPoliza}`;

      // Registrar PagoPoliza (backend auto-generates ReciboCaja)
      const body: Record<string, any> = {
        tipo_recaudo: nuevoPago.tipo_recaudo === 'directo' ? 'aseguradora_directo' : nuevoPago.tipo_recaudo,
        monto,
        metodo_pago: nuevoPago.metodo_pago,
        referencia_pago: nuevoPago.referencia_pago || undefined,
        fecha_pago: fechaPago,
        observaciones: obs,
      };
      // Link payment to specific cartera_item (cuota) when available
      if (cuotaSeleccionada?.carteraItemId) {
        body.cartera_item_id = cuotaSeleccionada.carteraItemId;
      }
      const pagoRes = await api.post(`/saas/polizas/${polizaId}/pagos`, body);

      if (!pagoRes.data?.success) {
        throw new Error(pagoRes.data?.message || 'Error al registrar pago');
      }

      // Backend auto-generates recibo — read from response
      const reciboData = pagoRes.data?.data?.recibo;
      const numeroRecibo = pagoRes.data?.data?.numero_recibo;
      const reciboMsg = numeroRecibo ? ` — Recibo #${numeroRecibo} generado` : '';

      toast({
        title: 'Pago registrado',
        description: `El pago se ha registrado correctamente${reciboMsg}`,
      });

      setShowPagoModal(false);
      setNuevoPago({ monto: '', tipo_recaudo: 'oficina', metodo_pago: 'efectivo', referencia_pago: '', observaciones: '' });
      setCuotaSeleccionada(null);
      await loadData();

      // Auto-open print modal if recibo was generated
      if (reciboData) {
        setPrintFormatRecibo({
          id: reciboData.id,
          numero_recibo: reciboData.numero_recibo,
          tipo: 'recibo',
          tipo_recaudo: reciboData.tipo_recaudo || 'oficina',
          forma_pago: reciboData.forma_pago,
          valor_recaudado_en_oficina: reciboData.valor_recaudado_en_oficina,
          valor_a_pagar: reciboData.valor_a_pagar,
          fecha_realizo_pago_oficina: reciboData.fecha,
          recibo_anulado: false,
          activo: true,
          observaciones: reciboData.observaciones,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || e.message || 'Error al registrar',
        variant: 'destructive',
      });
    } finally {
      setRegistrando(false);
    }
  };

  // Abrir modal para editar un pago existente
  const abrirModalEditar = (pago: Pago) => {
    setPagoEditando(pago);
    setEditPago({
      fecha_pago: (pago.fecha_pago || '').split('T')[0],
      monto: String(pago.monto_pagado || ''),
      metodo_pago: pago.metodo_pago || 'efectivo',
      referencia_pago: pago.referencia_pago || '',
      observaciones: pago.observaciones || '',
    });
    setShowEditModal(true);
  };

  // Guardar edición de pago
  const handleGuardarEdicion = async () => {
    if (!pagoEditando) return;
    if (!editPago.monto || parseFloat(editPago.monto) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido', variant: 'destructive' });
      return;
    }
    if (!editPago.fecha_pago) {
      toast({ title: 'Error', description: 'Ingresa una fecha de pago válida', variant: 'destructive' });
      return;
    }
    try {
      setGuardandoEdicion(true);
      const res = await api.put(`/saas/polizas/${polizaId}/pagos/${pagoEditando.id}`, {
        fecha_pago: editPago.fecha_pago,
        monto: parseFloat(editPago.monto),
        metodo_pago: editPago.metodo_pago,
        referencia_pago: editPago.referencia_pago || null,
        observaciones: editPago.observaciones || null,
      });
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Error al actualizar');
      }
      toast({ title: 'Pago actualizado', description: 'El pago ha sido modificado correctamente' });
      setShowEditModal(false);
      setPagoEditando(null);
      await loadData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || e.message || 'No se pudo actualizar',
        variant: 'destructive',
      });
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Abrir modal para editar cuota (cartera_item)
  const abrirModalEditarCuota = (cuota: CuotaSimulada) => {
    setCuotaEditando(cuota);
    setEditCuota({
      fecha_limite_pago: cuota.fechaVencimiento || '',
      prima_total_pago: String(cuota.monto || ''),
      comision_a_recibir: '',
    });
    setShowEditCuotaModal(true);
  };

  // Guardar edición de cuota
  const handleGuardarCuota = async () => {
    if (!cuotaEditando?.carteraItemId) {
      toast({ title: 'Error', description: 'Esta cuota no se puede editar (sin cartera_item)', variant: 'destructive' });
      return;
    }
    if (!editCuota.fecha_limite_pago) {
      toast({ title: 'Error', description: 'Ingresa una fecha de vencimiento válida', variant: 'destructive' });
      return;
    }
    if (!editCuota.prima_total_pago || parseFloat(editCuota.prima_total_pago) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido', variant: 'destructive' });
      return;
    }
    try {
      setGuardandoCuota(true);
      const body: Record<string, any> = {
        fecha_limite_pago: editCuota.fecha_limite_pago,
        prima_total_pago: parseFloat(editCuota.prima_total_pago),
      };
      if (editCuota.comision_a_recibir) {
        body.comision_a_recibir = parseFloat(editCuota.comision_a_recibir);
      }
      const res = await api.put(
        `/saas/polizas/${polizaId}/cartera-items/${cuotaEditando.carteraItemId}`,
        body,
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Error al actualizar cuota');
      }
      toast({ title: 'Cuota actualizada', description: 'Los cambios se guardaron correctamente' });
      setShowEditCuotaModal(false);
      setCuotaEditando(null);
      await loadData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || e.message || 'No se pudo actualizar',
        variant: 'destructive',
      });
    } finally {
      setGuardandoCuota(false);
    }
  };

  // Revertir un pago
  const handleRevertirPago = async (pagoId: number) => {
    if (!confirm('¿Está seguro de revertir este pago?')) return;
    try {
      await api.delete(`/saas/polizas/${polizaId}/pagos/${pagoId}`);
      toast({ title: 'Pago revertido', description: 'El pago ha sido revertido' });
      await loadData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Error al revertir',
        variant: 'destructive',
      });
    }
  };

  const abrirModalPago = (cuota: CuotaSimulada) => {
    setCuotaSeleccionada(cuota);
    setUltimoRecibo(null);
    setNuevoPago({
      monto: String(cuota.montoPendiente),
      tipo_recaudo: 'oficina',
      metodo_pago: 'efectivo',
      referencia_pago: '',
      observaciones: `Pago cuota #${cuota.numero} - ${numeroPoliza}`,
    });
    setShowPagoModal(true);
  };

  const estadoBadge = (estado: CuotaSimulada['estado']) => {
    switch (estado) {
      case 'pagado':
        return (
          <Badge color="success" size="sm">
            <Icon icon="solar:check-circle-bold" width={12} className="mr-1" />
            Pagado
          </Badge>
        );
      case 'parcial':
        return (
          <Badge color="warning" size="sm">
            <Icon icon="solar:clock-circle-bold" width={12} className="mr-1" />
            Parcial
          </Badge>
        );
      case 'vencido':
        return (
          <Badge color="failure" size="sm">
            <Icon icon="solar:danger-triangle-bold" width={12} className="mr-1" />
            Vencido
          </Badge>
        );
      default:
        return (
          <Badge color="gray" size="sm">
            <Icon icon="solar:clock-circle-bold" width={12} className="mr-1" />
            Pendiente
          </Badge>
        );
    }
  };

  const tipoRecaudoBadge = (tipo: string) => {
    switch (tipo) {
      case 'oficina':
        return <Badge color="indigo" size="sm">Oficina</Badge>;
      case 'aseguradora':
        return <Badge color="purple" size="sm">Aseguradora</Badge>;
      case 'directo':
        return <Badge color="blue" size="sm">Pago Directo</Badge>;
      default:
        return <Badge color="gray" size="sm">{tipo}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
        <span className="ml-2 text-gray-500">Cargando pagos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="!p-0">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Prima Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalPrima || primaTotal)}</p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Pagado</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(stats.totalPagado)}</p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Pendiente</p>
            <p className="text-sm font-bold text-red-600">{formatCurrency(stats.totalPendiente)}</p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Cuotas</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {stats.cuotasPagadas}/{stats.totalCuotas}
            </p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Periodicidad</p>
            <p className="text-sm font-bold text-indigo-600 capitalize">{periodicidad || 'Anual'}</p>
          </div>
        </Card>
      </div>

      {/* Barra de progreso */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Progreso de pago</span>
          <span>{primaTotal > 0 ? Math.round((stats.totalPagado / primaTotal) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${primaTotal > 0 ? Math.min(100, (stats.totalPagado / primaTotal) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Tabla de cuotas */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Plan de Pagos — {cuotas.length} cuota{cuotas.length !== 1 ? 's' : ''}
          </h3>
          <div className="flex items-center gap-2">
            {stats.cuotasVencidas > 0 && (
              <Badge color="failure" size="sm">
                {stats.cuotasVencidas} vencida{stats.cuotasVencidas !== 1 ? 's' : ''}
              </Badge>
            )}
            <Link to="/apps/cartera/recibos-caja" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Icon icon="solar:document-text-bold" width={14} />
              Ver Recibos
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table striped>
            <Table.Head>
              <Table.HeadCell className="w-12">#</Table.HeadCell>
              {carteraItems.length > 0 && <Table.HeadCell>Anexo</Table.HeadCell>}
              <Table.HeadCell>Vencimiento</Table.HeadCell>
              <Table.HeadCell className="text-right">Valor Cuota</Table.HeadCell>
              <Table.HeadCell className="text-right">Pagado</Table.HeadCell>
              <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell className="w-28">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {cuotas.map((cuota, idx) => (
                <Table.Row
                  key={cuota.carteraItemId || `cuota-${idx}`}
                  className={`bg-white dark:border-gray-700 dark:bg-gray-800 ${cuota.estado === 'vencido' ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                >
                  <Table.Cell className="font-medium text-gray-900 dark:text-white text-center">
                    {cuota.numero}
                  </Table.Cell>
                  {carteraItems.length > 0 && (
                    <Table.Cell className="text-xs text-gray-500 max-w-[150px] truncate">
                      {cuota.anexo_numero || '—'}
                    </Table.Cell>
                  )}
                  <Table.Cell className="whitespace-nowrap">{formatDate(cuota.fechaVencimiento)}</Table.Cell>
                  <Table.Cell className="text-right font-medium">{formatCurrency(cuota.monto)}</Table.Cell>
                  <Table.Cell className="text-right text-green-600 font-medium">
                    {cuota.montoPagado > 0 ? formatCurrency(cuota.montoPagado) : '-'}
                  </Table.Cell>
                  <Table.Cell className="text-right text-red-600 font-medium">
                    {cuota.montoPendiente > 0 ? formatCurrency(cuota.montoPendiente) : '-'}
                  </Table.Cell>
                  <Table.Cell>{estadoBadge(cuota.estado)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      {cuota.estado !== 'pagado' && (
                        <Tooltip content="Registrar pago">
                          <Button size="xs" color="success" onClick={() => abrirModalPago(cuota)}>
                            <Icon icon="solar:wallet-money-bold" width={14} />
                          </Button>
                        </Tooltip>
                      )}
                      {cuota.carteraItemId && (
                        <Tooltip content="Editar cuota (fecha / monto)">
                          <Button size="xs" color="warning" outline onClick={() => abrirModalEditarCuota(cuota)}>
                            <Icon icon="solar:pen-bold" width={14} />
                          </Button>
                        </Tooltip>
                      )}
                      {(() => {
                        // Pagos asociados a esta cuota: si hay, ofrecer editar el pago más reciente
                        const pagosCuota = cuota.carteraItemId
                          ? pagos.filter(p => p.cartera_item_id === cuota.carteraItemId)
                          : cuota.pagos;
                        if (pagosCuota.length === 0) return null;
                        const ultimoPago = [...pagosCuota].sort(
                          (a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
                        )[0];
                        return (
                          <Tooltip content={`Editar pago (fecha / monto) — ${pagosCuota.length} pago(s)`}>
                            <Button size="xs" color="info" outline onClick={() => abrirModalEditar(ultimoPago)}>
                              <Icon icon="solar:dollar-minimalistic-bold" width={14} />
                            </Button>
                          </Tooltip>
                        );
                      })()}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Historial de pagos */}
      {pagos.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Historial de Recaudos
          </h3>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Fecha</Table.HeadCell>
                {carteraItems.length > 0 && <Table.HeadCell>Cuota</Table.HeadCell>}
                <Table.HeadCell className="text-right">Monto</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Método</Table.HeadCell>
                <Table.HeadCell>Referencia</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Recibo</Table.HeadCell>
                <Table.HeadCell className="w-16"></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {pagos.map((pago) => (
                  <Table.Row key={pago.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap">{formatDate(pago.fecha_pago)}</Table.Cell>
                    {carteraItems.length > 0 && (
                      <Table.Cell className="text-xs">
                        {(() => {
                          const ci = carteraItems.find(c => c.id === pago.cartera_item_id);
                          return ci?.numero_pago || '—';
                        })()}
                      </Table.Cell>
                    )}
                    <Table.Cell className="text-right font-medium text-green-600">
                      {formatCurrency(pago.monto_pagado)}
                    </Table.Cell>
                    <Table.Cell>{tipoRecaudoBadge(pago.tipo_recaudo)}</Table.Cell>
                    <Table.Cell className="capitalize">{pago.metodo_pago || '-'}</Table.Cell>
                    <Table.Cell className="text-xs text-gray-500">{pago.referencia_pago || '-'}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          pago.estado === 'pagado'
                            ? 'success'
                            : pago.estado === 'parcial'
                              ? 'warning'
                              : 'gray'
                        }
                        size="sm"
                      >
                        {pago.estado}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {(() => {
                        const r = recibos.find(rc => rc.pago_poliza_id === pago.id);
                        if (r && !r.recibo_anulado) {
                          return (
                            <Tooltip content={`Imprimir Recibo #${r.numero_recibo}`}>
                              <Button size="xs" color="blue" outline onClick={() => setPrintFormatRecibo(r)}>
                                <Icon icon="solar:printer-bold" width={12} className="mr-1" />
                                #{r.numero_recibo}
                              </Button>
                            </Tooltip>
                          );
                        }
                        if (r?.recibo_anulado) {
                          return <Badge color="failure" size="sm">Anulado</Badge>;
                        }
                        return <span className="text-gray-400 text-xs">—</span>;
                      })()}
                    </Table.Cell>
                    <Table.Cell>
                      <Tooltip content="Revertir pago">
                        <Button size="xs" color="failure" outline onClick={() => handleRevertirPago(pago.id)}>
                          <Icon icon="solar:undo-left-bold" width={12} />
                        </Button>
                      </Tooltip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Card>
      )}

      {/* Recibos generados */}
      {recibos.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recibos de Caja ({recibos.length})
            </h3>
            <Link
              to="/apps/cartera/recibos-caja"
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Recibo #</Table.HeadCell>
                <Table.HeadCell>Fecha</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell className="text-right">Valor</Table.HeadCell>
                <Table.HeadCell>Forma Pago</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell className="w-16"></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {recibos.map((recibo) => (
                  <Table.Row key={recibo.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="font-medium text-gray-900 dark:text-white">
                      #{recibo.numero_recibo}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      {formatDate(recibo.fecha_realizo_pago_oficina || recibo.created_at)}
                    </Table.Cell>
                    <Table.Cell>{tipoRecaudoBadge(recibo.tipo_recaudo)}</Table.Cell>
                    <Table.Cell className="text-right font-medium">
                      {formatCurrency(recibo.valor_recaudado_en_oficina || recibo.valor_a_pagar || 0)}
                    </Table.Cell>
                    <Table.Cell className="capitalize">{recibo.forma_pago || '-'}</Table.Cell>
                    <Table.Cell>
                      {recibo.recibo_anulado ? (
                        <Badge color="failure" size="sm">Anulado</Badge>
                      ) : recibo.activo ? (
                        <Badge color="success" size="sm">Activo</Badge>
                      ) : (
                        <Badge color="gray" size="sm">Inactivo</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Tooltip content="Imprimir recibo">
                        <Button size="xs" color="light" onClick={() => setPrintFormatRecibo(recibo)}>
                          <Icon icon="solar:printer-bold" width={12} />
                        </Button>
                      </Tooltip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Card>
      )}

      {/* Print Format Selection Modal */}
      <Modal show={!!printFormatRecibo} onClose={() => setPrintFormatRecibo(null)} size="sm">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:printer-bold-duotone" width={20} className="text-blue-500" />
            Imprimir Recibo #{printFormatRecibo?.numero_recibo}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona el formato de impresión:</p>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => {
                if (printFormatRecibo) {
                  const data: ReciboPrintData = {
                    numero_recibo: printFormatRecibo.numero_recibo,
                    fecha: printFormatRecibo.fecha_realizo_pago_oficina || printFormatRecibo.created_at,
                    cliente_nombre: clienteNombre || null,
                    cliente_documento: null,
                    poliza_numero: numeroPoliza,
                    aseguradora_nombre: aseguradoraNombre || null,
                    ramo_nombre: ramoNombre || null,
                    forma_pago: printFormatRecibo.forma_pago || null,
                    moneda: 'COP',
                    valor_recaudado_en_oficina: printFormatRecibo.valor_recaudado_en_oficina || printFormatRecibo.valor_a_pagar || 0,
                    es_anticipo: false,
                    observaciones: printFormatRecibo.observaciones || null,
                  };
                  printRecibo(data, brokerInfo || { nombre: 'Agencia de Seguros', nit: '' }, 'media_carta');
                  setPrintFormatRecibo(null);
                }
              }}
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:document-bold-duotone" className="text-blue-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-600">Media Carta</p>
                <p className="text-xs text-gray-400">Sin copia, tamaño reducido</p>
              </div>
            </button>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => {
                if (printFormatRecibo) {
                  const data: ReciboPrintData = {
                    numero_recibo: printFormatRecibo.numero_recibo,
                    fecha: printFormatRecibo.fecha_realizo_pago_oficina || printFormatRecibo.created_at,
                    cliente_nombre: clienteNombre || null,
                    cliente_documento: null,
                    poliza_numero: numeroPoliza,
                    aseguradora_nombre: aseguradoraNombre || null,
                    ramo_nombre: ramoNombre || null,
                    forma_pago: printFormatRecibo.forma_pago || null,
                    moneda: 'COP',
                    valor_recaudado_en_oficina: printFormatRecibo.valor_recaudado_en_oficina || printFormatRecibo.valor_a_pagar || 0,
                    es_anticipo: false,
                    observaciones: printFormatRecibo.observaciones || null,
                  };
                  printRecibo(data, brokerInfo || { nombre: 'Agencia de Seguros', nit: '' }, 'carta');
                  setPrintFormatRecibo(null);
                }
              }}
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:copy-bold-duotone" className="text-indigo-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600">Carta Completa (con copia)</p>
                <p className="text-xs text-gray-400">Original + copia en hoja completa</p>
              </div>
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Modal registrar pago */}
      <Modal show={showPagoModal} onClose={() => setShowPagoModal(false)} size="md">
        <Modal.Header>Registrar Pago — Cuota #{cuotaSeleccionada?.numero}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Póliza:</span>
                <span className="font-medium">{numeroPoliza}</span>
              </div>
              {clienteNombre && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{clienteNombre}</span>
                </div>
              )}
              {aseguradoraNombre && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Aseguradora:</span>
                  <span className="font-medium">{aseguradoraNombre}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valor cuota:</span>
                <span className="font-medium">{formatCurrency(cuotaSeleccionada?.monto || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pendiente:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(cuotaSeleccionada?.montoPendiente || 0)}
                </span>
              </div>
            </div>

            {/* Tipo de recaudo */}
            <div>
              <Label htmlFor="tipo_recaudo">Tipo de recaudo *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {([
                  { value: 'oficina', label: 'Oficina', icon: 'solar:buildings-bold', desc: 'Pago recibido en oficina' },
                  { value: 'aseguradora', label: 'Aseguradora', icon: 'solar:shield-bold', desc: 'Pago vía aseguradora' },
                  { value: 'directo', label: 'Pago Directo', icon: 'solar:card-send-bold', desc: 'Cliente pagó directo' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNuevoPago({ ...nuevoPago, tipo_recaudo: opt.value })}
                    className={`flex flex-col items-center p-2.5 rounded-lg border-2 transition-all text-center ${
                      nuevoPago.tipo_recaudo === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      icon={opt.icon}
                      width={20}
                      className={nuevoPago.tipo_recaudo === opt.value ? 'text-blue-600' : 'text-gray-400'}
                    />
                    <span
                      className={`text-xs font-medium mt-1 ${
                        nuevoPago.tipo_recaudo === opt.value
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="monto">Monto a pagar *</Label>
              <TextInput
                id="monto"
                type="number"
                value={nuevoPago.monto}
                onChange={(e) => setNuevoPago({ ...nuevoPago, monto: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="metodo_pago">Método de pago</Label>
              <Select
                id="metodo_pago"
                value={nuevoPago.metodo_pago}
                onChange={(e) => setNuevoPago({ ...nuevoPago, metodo_pago: e.target.value })}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="consignacion">Consignación</option>
                <option value="debito_automatico">Débito Automático</option>
                <option value="otro">Otro</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="referencia">Referencia / Comprobante</Label>
              <TextInput
                id="referencia"
                value={nuevoPago.referencia_pago}
                onChange={(e) => setNuevoPago({ ...nuevoPago, referencia_pago: e.target.value })}
                placeholder="Número de comprobante o referencia"
              />
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <textarea
                id="observaciones"
                value={nuevoPago.observaciones}
                onChange={(e) => setNuevoPago({ ...nuevoPago, observaciones: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 text-sm"
                rows={2}
                placeholder="Notas adicionales"
              />
            </div>

            {/* Info de recibo */}
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Icon icon="solar:document-text-bold" width={16} className="mt-0.5 flex-shrink-0" />
              <span>Se generará automáticamente un recibo de caja que podrás consultar en Cartera &gt; Recibos de Caja.</span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleRegistrarPago} disabled={registrando}>
            {registrando ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Icon icon="solar:check-circle-bold" width={16} className="mr-2" />
            )}
            Registrar Pago y Generar Recibo
          </Button>
          <Button color="gray" onClick={() => setShowPagoModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal editar pago existente */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} size="md">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:pen-bold-duotone" width={20} className="text-amber-500" />
            Editar Pago {pagoEditando ? `#${pagoEditando.id}` : ''}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" width={16} className="mt-0.5 shrink-0" />
              <span>
                Estás forzando la fecha o el monto de un pago ya registrado.
                Los recibos vinculados y la cartera se sincronizarán automáticamente.
              </span>
            </div>

            <div>
              <Label htmlFor="edit_fecha_pago">Fecha de pago *</Label>
              <TextInput
                id="edit_fecha_pago"
                type="date"
                value={editPago.fecha_pago}
                onChange={(e) => setEditPago({ ...editPago, fecha_pago: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_monto">Monto *</Label>
              <TextInput
                id="edit_monto"
                type="number"
                step="0.01"
                min="0.01"
                value={editPago.monto}
                onChange={(e) => setEditPago({ ...editPago, monto: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_metodo">Método de pago</Label>
                <Select
                  id="edit_metodo"
                  value={editPago.metodo_pago}
                  onChange={(e) => setEditPago({ ...editPago, metodo_pago: e.target.value })}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="pse">PSE</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_referencia">Referencia</Label>
                <TextInput
                  id="edit_referencia"
                  value={editPago.referencia_pago}
                  onChange={(e) => setEditPago({ ...editPago, referencia_pago: e.target.value })}
                  placeholder="Nro. transacción"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_observaciones">Observaciones</Label>
              <TextInput
                id="edit_observaciones"
                value={editPago.observaciones}
                onChange={(e) => setEditPago({ ...editPago, observaciones: e.target.value })}
                placeholder="Notas adicionales"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="warning" onClick={handleGuardarEdicion} disabled={guardandoEdicion}>
            {guardandoEdicion ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Icon icon="solar:diskette-bold" width={16} className="mr-2" />
            )}
            Guardar Cambios
          </Button>
          <Button color="gray" onClick={() => setShowEditModal(false)} disabled={guardandoEdicion}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal editar cuota (cartera_item) */}
      <Modal show={showEditCuotaModal} onClose={() => setShowEditCuotaModal(false)} size="md">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:calendar-bold-duotone" width={20} className="text-amber-500" />
            Editar Cuota {cuotaEditando ? `#${cuotaEditando.numero}` : ''}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" width={16} className="mt-0.5 shrink-0" />
              <span>
                Modifica la fecha de vencimiento, el monto o la comisión de esta cuota.
                Los saldos se recalcularán automáticamente.
              </span>
            </div>

            <div>
              <Label htmlFor="edit_cuota_fecha">Fecha de vencimiento *</Label>
              <TextInput
                id="edit_cuota_fecha"
                type="date"
                value={editCuota.fecha_limite_pago}
                onChange={(e) => setEditCuota({ ...editCuota, fecha_limite_pago: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_cuota_monto">Monto de la cuota *</Label>
              <TextInput
                id="edit_cuota_monto"
                type="number"
                step="0.01"
                min="0"
                value={editCuota.prima_total_pago}
                onChange={(e) => setEditCuota({ ...editCuota, prima_total_pago: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_cuota_comision">Comisión a recibir (opcional)</Label>
              <TextInput
                id="edit_cuota_comision"
                type="number"
                step="0.01"
                min="0"
                value={editCuota.comision_a_recibir}
                onChange={(e) => setEditCuota({ ...editCuota, comision_a_recibir: e.target.value })}
                placeholder="Dejar vacío para conservar la actual"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="warning" onClick={handleGuardarCuota} disabled={guardandoCuota}>
            {guardandoCuota ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Icon icon="solar:diskette-bold" width={16} className="mr-2" />
            )}
            Guardar Cuota
          </Button>
          <Button color="gray" onClick={() => setShowEditCuotaModal(false)} disabled={guardandoCuota}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PagosPoliza;

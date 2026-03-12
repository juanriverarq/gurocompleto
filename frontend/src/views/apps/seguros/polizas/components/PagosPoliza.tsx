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
}

interface CuotaSimulada {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  estado: 'pagado' | 'parcial' | 'pendiente' | 'vencido';
  pagos: Pago[];
  montoPagado: number;
  montoPendiente: number;
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
};

const PERIODICIDAD_MESES: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

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
}) => {
  const { toast } = useToast();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
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

  // Cargar pagos y recibos existentes
  const loadData = async () => {
    try {
      setLoading(true);
      const [pagosRes, recibosRes] = await Promise.all([
        api.get(`/saas/polizas/${polizaId}/pagos`),
        api.get(`/saas/cartera/recibos-caja`, { params: { poliza_id: polizaId, per_page: 100 } }).catch(() => null),
      ]);
      if (pagosRes.data?.success) {
        setPagos(pagosRes.data.data || []);
      }
      if (recibosRes?.data?.success) {
        setRecibos(recibosRes.data.data || []);
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

  // Generar cuotas simuladas según periodicidad
  const cuotas = useMemo<CuotaSimulada[]>(() => {
    const periodo = periodicidad?.toLowerCase() || 'anual';
    const meses = PERIODICIDAD_MESES[periodo] || 12;

    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return [];

    const diffMs = fin.getTime() - inicio.getTime();
    const diffMeses = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    const numCuotas = Math.max(1, Math.round(diffMeses / meses));
    const montoCuota = primaTotal / numCuotas;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // All pagos ordered by date
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
  }, [periodicidad, fechaInicio, fechaFin, primaTotal, pagos]);

  // Estadísticas
  const stats = useMemo(() => {
    const totalPagado = pagos.reduce((s, p) => s + (p.monto_pagado || 0), 0);
    const totalPendiente = Math.max(0, primaTotal - totalPagado);
    const cuotasPagadas = cuotas.filter((c) => c.estado === 'pagado').length;
    const cuotasVencidas = cuotas.filter((c) => c.estado === 'vencido').length;
    return { totalPagado, totalPendiente, cuotasPagadas, cuotasVencidas, totalCuotas: cuotas.length };
  }, [cuotas, pagos, primaTotal]);

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
      const pagoRes = await api.post(`/saas/polizas/${polizaId}/pagos`, {
        tipo_recaudo: nuevoPago.tipo_recaudo === 'directo' ? 'aseguradora_directo' : nuevoPago.tipo_recaudo,
        monto,
        metodo_pago: nuevoPago.metodo_pago,
        referencia_pago: nuevoPago.referencia_pago || undefined,
        fecha_pago: fechaPago,
        observaciones: obs,
      });

      if (!pagoRes.data?.success) {
        throw new Error(pagoRes.data?.message || 'Error al registrar pago');
      }

      // Backend auto-generates recibo — read from response
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
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(primaTotal)}</p>
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
              <Table.HeadCell>Vencimiento</Table.HeadCell>
              <Table.HeadCell className="text-right">Valor Cuota</Table.HeadCell>
              <Table.HeadCell className="text-right">Pagado</Table.HeadCell>
              <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell className="w-28">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {cuotas.map((cuota) => (
                <Table.Row
                  key={cuota.numero}
                  className={`bg-white dark:border-gray-700 dark:bg-gray-800 ${cuota.estado === 'vencido' ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                >
                  <Table.Cell className="font-medium text-gray-900 dark:text-white text-center">
                    {cuota.numero}
                  </Table.Cell>
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
                      {cuota.pagos.length > 0 && (
                        <Tooltip content={`${cuota.pagos.length} pago(s) registrado(s)`}>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => {
                              setCuotaSeleccionada(cuota);
                            }}
                          >
                            <Icon icon="solar:eye-bold" width={14} />
                          </Button>
                        </Tooltip>
                      )}
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
                <Table.HeadCell className="text-right">Monto</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Método</Table.HeadCell>
                <Table.HeadCell>Referencia</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Observaciones</Table.HeadCell>
                <Table.HeadCell className="w-16"></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {pagos.map((pago) => (
                  <Table.Row key={pago.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap">{formatDate(pago.fecha_pago)}</Table.Cell>
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
                    <Table.Cell className="text-xs text-gray-500 max-w-[200px] truncate">
                      {pago.observaciones || '-'}
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
    </div>
  );
};

export default PagosPoliza;

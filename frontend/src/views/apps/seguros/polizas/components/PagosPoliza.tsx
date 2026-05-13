import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Spinner, Badge, Button } from 'flowbite-react';
import { useToast } from 'src/hooks/use-toast';
import {
  carteraSimpleService,
  type Cuota,
} from 'src/services/carteraSimpleService';

interface Props {
  polizaId: string;
  numeroPoliza: string;
  primaTotal?: number;
  // Resto props ignoradas — se mantienen por compatibilidad con EditarPoliza
  [k: string]: any;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number | string | null | undefined) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(num(v));

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
};

/**
 * Pagos (mini-vista).
 *
 * Reemplaza la versión anterior de 1290 líneas con un resumen compacto
 * que linkea a la nueva pantalla unificada /apps/cartera para acciones
 * y detalle.
 */
const PagosPoliza: React.FC<Props> = ({ polizaId: _polizaId, numeroPoliza, primaTotal }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ monto: string; fecha: string }>({ monto: '', fecha: '' });

  const loadCuotas = async (aliveCheck?: () => boolean) => {
    try {
      setLoading(true);
      const res = await carteraSimpleService.timeline({ search: numeroPoliza, limit: 200 });
      if (aliveCheck && !aliveCheck()) return;
      const all: Cuota[] = [];
      const seen = new Set<number>();
      Object.values(res.data || {}).forEach((items) => {
        (items || []).forEach((c) => {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            all.push(c);
          }
        });
      });
      const filtered = all.filter((c) => c.poliza_numero === numeroPoliza);
      setCuotas(filtered);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.response?.data?.message || 'No se pudieron cargar las cuotas',
        variant: 'destructive',
      });
    } finally {
      if (!aliveCheck || aliveCheck()) setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void loadCuotas(() => alive);
    return () => {
      alive = false;
    };
  }, [numeroPoliza, toast]);

  const startEdit = (c: Cuota) => {
    setEditingId(c.id);
    setEditValues({
      monto: String(num(c.prima_total_pago) || ''),
      fecha: c.fecha_limite_pago || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ monto: '', fecha: '' });
  };

  const saveEdit = async (c: Cuota) => {
    const monto = num(editValues.monto);
    if (monto <= 0) {
      toast({ title: 'Monto inválido', description: 'El valor de la cuota debe ser mayor a cero.', variant: 'destructive' });
      return;
    }
    setSavingId(c.id);
    try {
      const res = await carteraSimpleService.actualizarCuotaPoliza(_polizaId, c.id, {
        prima_total_pago: monto,
        fecha_limite_pago: editValues.fecha || null,
      });
      if (res.success) {
        toast({ title: 'Cuota actualizada', description: 'El valor y la fecha de cobro fueron actualizados.' });
        cancelEdit();
        await loadCuotas();
      } else {
        toast({ title: 'No se pudo actualizar', description: res.message || 'Intenta nuevamente.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({
        title: 'Error al actualizar cuota',
        description: e?.response?.data?.message || e?.message || 'No se pudo actualizar',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  // Resumen
  const totales = cuotas.reduce(
    (acc, c) => {
      acc.total += num(c.prima_total_pago);
      acc.recaudado += num(c.valor_recaudado_oficina);
      acc.pendiente += c.recaudado_aseguradora ? 0 : c.recaudado_en_oficina ? 0 : num(c.saldo_pendiente_oficina);
      acc.pagadoAseg += num(c.valor_pagado_aseguradora);
      acc.comisionPend += c.recaudado_aseguradora && !c.comisionada ? num(c.comision_a_recibir) - num(c.comision_recibida) : 0;
      return acc;
    },
    { total: 0, recaudado: 0, pendiente: 0, pagadoAseg: 0, comisionPend: 0 },
  );

  const getEstadoBadge = (c: Cuota) => {
    if (c.recibo_anulado) return <Badge color="failure" size="xs">Anulada</Badge>;
    if (c.es_anticipo) return <Badge color="indigo" size="xs">Anticipo</Badge>;
    if (c.recibo_pago_directo) return <Badge color="purple" size="xs">Directo</Badge>;
    if (c.comisionada) return <Badge color="success" size="xs">Cerrada</Badge>;
    if (c.recaudado_aseguradora) return <Badge color="warning" size="xs">Comisión x cobrar</Badge>;
    if (c.recaudado_en_oficina) return <Badge color="info" size="xs">Por pagar aseg.</Badge>;
    return <Badge color="gray" size="xs">Pendiente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con link a cartera */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {cuotas.length} cuota{cuotas.length === 1 ? '' : 's'} encontrada{cuotas.length === 1 ? '' : 's'}
        </div>
        <Link to={`/apps/cartera?poliza=${encodeURIComponent(numeroPoliza)}`}>
          <Button size="xs" color="primary" className="!bg-primary hover:!bg-primaryemphasis">
            <Icon icon="solar:wallet-bold" className="mr-1" width={14} />
            Ver en Cartera
          </Button>
        </Link>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Prima total</div>
          <div className="text-lg font-bold">{fmt(totales.total || primaTotal || 0)}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
          <div className="text-xs text-gray-500">Recaudado</div>
          <div className="text-lg font-bold text-blue-600">{fmt(totales.recaudado)}</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3">
          <div className="text-xs text-gray-500">Pendiente cobrar</div>
          <div className="text-lg font-bold text-orange-600">{fmt(totales.pendiente)}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
          <div className="text-xs text-gray-500">Comisión x cobrar</div>
          <div className="text-lg font-bold text-emerald-600">{fmt(totales.comisionPend)}</div>
        </div>
      </div>

      {/* Tabla de cuotas */}
      {cuotas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Icon icon="solar:document-text-bold-duotone" className="mx-auto mb-2 text-gray-300" width={48} />
          <p>No hay cuotas registradas para esta póliza.</p>
          <p className="text-xs mt-1">Las cuotas aparecen aquí cuando la póliza tiene un plan de pago configurado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Cuota</th>
                <th className="px-3 py-2 text-left">Vencimiento</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {cuotas.map((c) => {
                const isEditing = editingId === c.id;
                const saldo = c.recaudado_aseguradora
                  ? c.comisionada
                    ? 0
                    : num(c.comision_a_recibir) - num(c.comision_recibida)
                  : c.recaudado_en_oficina
                  ? num(c.saldo_pendiente_aseguradora)
                  : num(c.saldo_pendiente_oficina);
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-medium">
                      {c.numero_pago || `#${c.id}`}
                      {c.numero_renovacion > 0 && (
                        <Badge color="purple" size="xs" className="ml-2 inline-flex">
                          R{c.numero_renovacion}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editValues.fecha}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, fecha: e.target.value }))}
                          className="w-36 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                        />
                      ) : (
                        fmtDate(c.fecha_limite_pago)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={editValues.monto}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, monto: e.target.value }))}
                          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-right text-xs dark:border-gray-700 dark:bg-gray-800"
                        />
                      ) : (
                        fmt(c.prima_total_pago)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(saldo)}</td>
                    <td className="px-3 py-2">{getEstadoBadge(c)}</td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="xs" color="success" disabled={savingId === c.id} onClick={() => void saveEdit(c)}>
                            {savingId === c.id ? <Spinner size="xs" /> : <Icon icon="solar:check-bold" width={14} />}
                          </Button>
                          <Button size="xs" color="light" disabled={savingId === c.id} onClick={cancelEdit}>
                            <Icon icon="solar:close-circle-bold" width={14} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="xs" color="light" onClick={() => startEdit(c)}>
                            <Icon icon="solar:pen-bold" width={14} />
                          </Button>
                          <Link to={`/apps/cartera?poliza=${encodeURIComponent(numeroPoliza)}`}>
                            <Button size="xs" color="light">
                              <Icon icon="solar:arrow-right-bold" width={14} />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center pt-2">
        Para registrar pagos, anular o enviar avisos, usa la nueva pantalla{' '}
        <Link to={`/apps/cartera?poliza=${encodeURIComponent(numeroPoliza)}`} className="text-primary hover:underline">
          Cartera
        </Link>
        .
      </div>
    </div>
  );
};

export default PagosPoliza;

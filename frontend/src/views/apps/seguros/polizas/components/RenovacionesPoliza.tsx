import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Spinner, Table, Tooltip } from 'flowbite-react';
import { polizaService } from 'src/services/polizaService';
import { Icon } from '@iconify/react';

interface Props {
  polizaId: string;
}

interface HistItem {
  tipo?: string;
  fecha?: string;
  usuario?: string | null;
  canal?: string | null;
  resultado?: string | null;
  observaciones?: string | null;
  proximo_contacto?: string | null;
  detalle?: string | null;
  descripcion?: string | null;
  metadata?: any;
}

const canalBadgeColor = (canal?: string | null) => {
  switch (canal) {
    case 'phone_call': return 'info';
    case 'email': return 'purple';
    case 'whatsapp': return 'green';
    case 'in_person': return 'warning';
    case 'sms': return 'gray';
    default: return 'gray';
  }
};

const canalLabel = (canal?: string | null) => {
  switch (canal) {
    case 'phone_call': return 'Llamada';
    case 'email': return 'Correo';
    case 'whatsapp': return 'WhatsApp';
    case 'in_person': return 'Presencial';
    case 'sms': return 'SMS';
    default: return canal || '-';
  }
};

const resultadoBadge = (resultado?: string | null) => {
  switch (resultado) {
    case 'successful': return { color: 'success', label: 'Exitoso' };
    case 'no_answer': return { color: 'gray', label: 'No contesta' };
    case 'unreachable': return { color: 'warning', label: 'No disponible' };
    case 'needs_info': return { color: 'info', label: 'Solicita info' };
    case 'not_interested': return { color: 'failure', label: 'No interesado' };
    default: return { color: 'gray', label: resultado || '-' } as any;
  }
};

const tipoIcon = (tipo?: string) => {
  if (tipo === 'contacto') return <Icon icon="solar:phone-bold" height={16} />;
  if (tipo === 'renovacion') return <Icon icon="solar:refresh-bold" height={16} />;
  return <Icon icon="solar:document-bold-duotone" height={16} />;
};

const RenovacionesPoliza: React.FC<Props> = ({ polizaId }) => {
  const [items, setItems] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<'todos' | 'contacto' | 'renovacion'>('todos');

  const toggle = (idx: number) => setOpen((s) => ({ ...s, [idx]: !s[idx] }));
  const truncate = (s?: string | null, n: number = 120) => {
    if (!s) return '';
    return s.length > n ? s.substring(0, n - 1) + '…' : s;
  };

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const res = await polizaService.getHistorialRenovaciones(polizaId);
      if (res?.success && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistorial(); }, [polizaId]);

  // Escuchar evento global para refrescar historial tras contacto/renovación
  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<{ polizaId?: string }>;
      if (!custom.detail || !custom.detail.polizaId) return;
      if (String(custom.detail.polizaId) === String(polizaId)) {
        fetchHistorial();
      }
    };
    window.addEventListener('renovaciones:historial:refresh', handler as EventListener);
    return () => window.removeEventListener('renovaciones:historial:refresh', handler as EventListener);
  }, [polizaId]);

  const itemsFiltrados = useMemo(() => {
    if (filter === 'todos') return items;
    return items.filter(i => i.tipo === filter);
  }, [items, filter]);

  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const formatDateHeader = (d: Date) => {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (sameDay(d, hoy)) return 'Hoy';
    if (sameDay(d, ayer)) return 'Ayer';
    return d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; indices: number[] }>();
    itemsFiltrados.forEach((it, idx) => {
      const dt = it.fecha ? new Date(it.fecha) : new Date(0);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const label = formatDateHeader(dt);
      if (!map.has(key)) map.set(key, { label, indices: [] });
      map.get(key)!.indices.push(idx);
    });
    return Array.from(map.values());
  }, [itemsFiltrados]);

  if (loading) {
    return (
      <div className="flex items-center text-gray-500"><Spinner size="sm" /><span className="ml-2">Cargando renovaciones...</span></div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="text-sm text-gray-500">Sin registros de renovaciones</div>;
  }

  return (
    <div className="space-y-2">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <button onClick={() => setFilter('todos')} className={`px-3 py-1 text-xs ${filter==='todos'?'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900':'bg-white dark:bg-darkgray text-gray-700'}`}>Todos</button>
          <button onClick={() => setFilter('contacto')} className={`px-3 py-1 text-xs border-l border-gray-200 dark:border-gray-700 ${filter==='contacto'?'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900':'bg-white dark:bg-darkgray text-gray-700'}`}>Contactos</button>
          <button onClick={() => setFilter('renovacion')} className={`px-3 py-1 text-xs border-l border-gray-200 dark:border-gray-700 ${filter==='renovacion'?'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900':'bg-white dark:bg-darkgray text-gray-700'}`}>Renovaciones</button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" color="light" onClick={() => {
            const allOpen: Record<number, boolean> = {};
            itemsFiltrados.forEach((_, idx) => allOpen[idx] = true);
            setOpen(allOpen);
          }}>Expandir todo</Button>
          <Button size="xs" color="light" onClick={() => setOpen({})}>Colapsar todo</Button>
        </div>
      </div>

      {/* Lista agrupada por fecha */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {grupos.map((g, gi) => (
          <div key={gi} className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="bg-gray-50 dark:bg-[#1f2937] text-xs font-medium px-3 py-1 text-gray-700 dark:text-gray-200">{g.label}</div>
            {g.indices.map((localIdx) => {
              const it = itemsFiltrados[localIdx];
              const resumenContacto = it.tipo === 'contacto'
                ? `${canalLabel(it.canal)} • ${resultadoBadge(it.resultado).label}` + (it.proximo_contacto ? ` • Próx: ${new Date(it.proximo_contacto).toLocaleDateString('es-CO')}` : '')
                : truncate(it.detalle || it.descripcion || it.observaciones || '', 90);
              const resumenRenovacion = it.metadata && (it.metadata.nuevo_numero_poliza || it.metadata.nueva_fecha_vencimiento || typeof it.metadata.nuevo_valor_prima !== 'undefined')
                ? `${it.metadata.nuevo_numero_poliza ? `Nueva póliza ${it.metadata.nuevo_numero_poliza}` : ''}`
                  + `${it.metadata.nueva_fecha_vencimiento ? ` • Vence: ${new Date(it.metadata.nueva_fecha_vencimiento).toLocaleDateString('es-CO')}` : ''}`
                  + `${typeof it.metadata.nuevo_valor_prima !== 'undefined' ? ` • Prima: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(it.metadata.nuevo_valor_prima))}` : ''}`
                : '';
              const isOpen = !!open[localIdx];
              return (
                <div key={`${gi}-${localIdx}`} className="px-3 py-2">
                  <button type="button" onClick={() => toggle(localIdx)} className="w-full flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      {tipoIcon(it.tipo)}
                      <span className="text-xs font-medium capitalize truncate">{it.tipo || 'evento'}</span>
                      {it.tipo === 'contacto' && (
                        <div className="flex items-center gap-1">
                          <Badge size="xs" color={canalBadgeColor(it.canal)}>{canalLabel(it.canal)}</Badge>
                          <Badge size="xs" color={resultadoBadge(it.resultado).color}>{resultadoBadge(it.resultado).label}</Badge>
                        </div>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{truncate(resumenContacto || resumenRenovacion, 100)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">{it.fecha ? new Date(it.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      <Icon icon={isOpen ? 'solar:alt-arrow-up-line-duotone' : 'solar:alt-arrow-down-line-duotone'} height={16} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="space-y-2">
                        {it.tipo === 'contacto' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={canalBadgeColor(it.canal)}>{canalLabel(it.canal)}</Badge>
                            <Badge color={resultadoBadge(it.resultado).color}>{resultadoBadge(it.resultado).label}</Badge>
                            {it.proximo_contacto && (
                              <Tooltip content="Próximo contacto">
                                <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                  <Icon icon="solar:calendar-bold-duotone" height={14} />
                                  {new Date(it.proximo_contacto).toLocaleString('es-CO')}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-700 dark:text-gray-300">
                            {it.detalle || it.descripcion || '—'}
                          </div>
                        )}
                        {it.observaciones && (
                          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {it.observaciones}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {it.usuario && (
                          <div className="text-xs text-gray-500">Registrado por: <span className="font-medium text-gray-700 dark:text-gray-300">{it.usuario}</span></div>
                        )}
                        {it.metadata && (it.metadata.nueva_poliza_id || it.metadata.nuevo_numero_poliza || it.metadata.nuevo_valor_prima || it.metadata.nueva_fecha_vencimiento) && (
                          <div className="text-xs">
                            <div className="text-gray-500 mb-1">Datos de renovación</div>
                            <Table>
                              <Table.Body>
                                {it.metadata.nuevo_numero_poliza && (
                                  <Table.Row>
                                    <Table.Cell className="font-medium">Número nueva póliza</Table.Cell>
                                    <Table.Cell>{it.metadata.nuevo_numero_poliza}</Table.Cell>
                                  </Table.Row>
                                )}
                                {it.metadata.nueva_fecha_vencimiento && (
                                  <Table.Row>
                                    <Table.Cell className="font-medium">Nueva fecha vencimiento</Table.Cell>
                                    <Table.Cell>{new Date(it.metadata.nueva_fecha_vencimiento).toLocaleDateString('es-CO')}</Table.Cell>
                                  </Table.Row>
                                )}
                                {typeof it.metadata.nuevo_valor_prima !== 'undefined' && (
                                  <Table.Row>
                                    <Table.Cell className="font-medium">Nueva prima</Table.Cell>
                                    <Table.Cell>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(it.metadata.nuevo_valor_prima))}</Table.Cell>
                                  </Table.Row>
                                )}
                              </Table.Body>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RenovacionesPoliza;

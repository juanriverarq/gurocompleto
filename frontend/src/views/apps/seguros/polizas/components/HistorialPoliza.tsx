import React, { useEffect, useState } from 'react';
import { Table, Badge, Spinner } from 'flowbite-react';
import { polizaService } from 'src/services/polizaService';

interface Props {
  polizaId: string;
  polizaDetalle: any;
}

const HistorialPoliza: React.FC<Props> = ({ polizaId, polizaDetalle }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const res = await polizaService.getHistorialRenovaciones(polizaId);
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, [polizaId]);

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

  if (loading) {
    return (
      <div className="flex items-center text-gray-500"><Spinner size="sm" /><span className="ml-2">Cargando historial...</span></div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="text-sm text-gray-500">Sin registros de historial</div>;
  }

  const human = (it: any) => {
    if (it.tipo === 'contacto') {
      const partes = [it.canal, it.resultado, it.observaciones].filter(Boolean);
      return partes.join(' • ');
    }
    if (it.tipo === 'renovacion') {
      const nuevo = it?.metadata?.nuevo_numero_poliza || it?.metadata?.policy_number || polizaDetalle?.numero_poliza || '';
      const anterior = it?.metadata?.numero_poliza_anterior || '';
      const nuevaFecha = it?.metadata?.nueva_fecha_vencimiento ? new Date(it.metadata.nueva_fecha_vencimiento).toLocaleDateString('es-CO') : '';
      const partes: string[] = ['Renovación procesada'];
      if (anterior || nuevo) partes.push(`Número anterior: ${anterior || '-'} / Nuevo número: ${nuevo || '-'}`);
      if (nuevaFecha) partes.push(`Nueva fecha vencimiento: ${nuevaFecha}`);
      return partes.join(' • ');
    }
    return it.detalle || 'Evento';
  };

  const tipoBadge = (tipo?: string) => {
    const map: Record<string, { color: any; label: string }> = {
      contacto: { color: 'info', label: 'Contacto' },
      renovacion: { color: 'success', label: 'Renovación' },
    };
    const t = tipo ? map[tipo] : undefined;
    return <Badge color={t?.color || 'gray'}>{t?.label || 'Evento'}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Head>
          <Table.HeadCell>Fecha</Table.HeadCell>
          <Table.HeadCell>Tipo</Table.HeadCell>
          <Table.HeadCell>Detalle</Table.HeadCell>
          <Table.HeadCell>Usuario</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {items.map((it, idx) => (
            <Table.Row key={idx}>
              <Table.Cell>{it.fecha ? new Date(it.fecha).toLocaleString('es-CO') : '-'}</Table.Cell>
              <Table.Cell>{tipoBadge(it.tipo)}</Table.Cell>
              <Table.Cell className="max-w-[520px] truncate" title={human(it)}>{human(it)}</Table.Cell>
              <Table.Cell>{it.usuario || '-'}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};

export default HistorialPoliza;



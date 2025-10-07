import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saasApi } from '../../../services/saasApi';
import { ClienteSaaS } from '../../../types/saas';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Card, CardContent } from '../../../components/shadcn-ui/Default-Ui/card';
import { Icon as IconifyIcon } from '@iconify/react';

const DetalleCliente: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteSaaS | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await saasApi.getCliente(id as string);
        if (res.success && res.data) setCliente(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar cliente');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const getNombre = (c: ClienteSaaS) => {
    if (c.tipo === 'PERSONA' && c.persona) return `${c.persona.nombres} ${c.persona.apellidos}`;
    if (c.tipo === 'EMPRESA' && c.empresa) return c.empresa.razon_social;
    if (c.tipo === 'CONSORCIO' && c.consorcio) return c.consorcio.nombre_consorcio;
    return 'Sin nombre';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando cliente...</span>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error || 'Cliente no encontrado'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getNombre(cliente)}</h1>
          <p className="text-gray-600">Código: {cliente.codigo_cliente}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/apps/saas/clientes')}>Volver</Button>
          <Button onClick={() => navigate(`/apps/saas/clientes/${cliente.id}/editar`)}>Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Contacto</h3>
            <div className="text-sm text-gray-700">Email: {cliente.email || '-'}</div>
            <div className="text-sm text-gray-700">Teléfono: {cliente.telefono || '-'}</div>
            <div className="text-sm text-gray-700">Ciudad: {cliente.ciudad || '-'}</div>
            <div className="text-sm text-gray-700">Dirección: {cliente.direccion || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Estado</h3>
            <div className="text-sm text-gray-700">Estado: {cliente.estado}</div>
            <div className="text-sm text-gray-700">Total pólizas: {cliente.total_polizas}</div>
            <div className="text-sm text-gray-700">Prima anual: ${cliente.prima_total_anual?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetalleCliente;



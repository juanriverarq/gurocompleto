import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert, Tabs } from 'flowbite-react';
import { HiArrowLeft } from 'react-icons/hi';
import NuevoCliente from './NuevoCliente';
import ArchivosCliente from 'src/views/apps/seguros/clientes/components/ArchivosCliente';
import TareasAsociadas from '../components/TareasAsociadas';
import { clienteService, type Cliente } from 'src/services/clienteService';

const EditarCliente: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) { setError('ID inválido'); setLoading(false); return; }
      try {
        setLoading(true);
        const res = await clienteService.getCliente(id);
        if (res.success && res.data) setCliente(res.data);
        else setError(res.message || 'No se pudo cargar el cliente');
      } catch (e) {
        setError('Error al cargar el cliente');
      } finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
        <span className="ml-2 text-sm text-gray-500">Cargando cliente...</span>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="space-y-4 py-8">
        <Alert color="failure">
          <div className="flex items-center">
            <span className="font-medium">Error:</span>
            <span className="ml-2">{error || 'Cliente no encontrado'}</span>
          </div>
        </Alert>
        <Button color="gray" onClick={() => navigate('/apps/seguros/clientes')}>
          <HiArrowLeft className="w-4 h-4 mr-2" />
          Volver a Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Button size="xs" color="light" onClick={() => navigate('/apps/seguros/clientes')}>
          <HiArrowLeft className="w-3 h-3 mr-1" />
          Clientes
        </Button>
        <div className="text-xs text-gray-500">
          {cliente.nombre} {cliente.apellidos} &middot; {(cliente as any).cuit || ''}
        </div>
      </div>

      <Tabs>
        <Tabs.Item active title="Cliente">
          <NuevoCliente clienteToEdit={cliente} isEditMode={true} onSaveSuccess={() => navigate('/apps/seguros/clientes')} />
        </Tabs.Item>
        <Tabs.Item title="Tareas">
          <TareasAsociadas
            clientId={id}
            clientName={cliente.nombre + (cliente.apellidos ? ' ' + cliente.apellidos : '')}
          />
        </Tabs.Item>
        <Tabs.Item title="Archivos">
          <ArchivosCliente clienteId={id!} />
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default EditarCliente;

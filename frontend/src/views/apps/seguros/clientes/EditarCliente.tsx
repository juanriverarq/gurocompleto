import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Alert, Tabs } from 'flowbite-react';
import { HiArrowLeft } from 'react-icons/hi';
import NuevoCliente from './NuevoCliente';
import ArchivosCliente from 'src/views/apps/seguros/clientes/components/ArchivosCliente';
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
      <div className="space-y-6">
        <Card>
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Cargando cliente...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="space-y-6">
        <Card>
          <Alert color="failure">
            <div className="flex items-center">
              <span className="font-medium">Error:</span>
              <span className="ml-2">{error || 'Cliente no encontrado'}</span>
            </div>
          </Alert>
          <div className="mt-4">
            <Button color="gray" onClick={() => navigate('/apps/seguros/clientes')}>
              <HiArrowLeft className="w-4 h-4 mr-2" />
              Volver a Clientes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button color="gray" onClick={() => navigate('/apps/seguros/clientes')}>
          <HiArrowLeft className="w-4 h-4 mr-2" />
          Volver a Clientes
        </Button>
        <div className="text-sm text-gray-500">Editando cliente: <strong>{cliente.nombre} {cliente.apellidos}</strong></div>
      </div>

      <Tabs>
        <Tabs.Item active title="Cliente">
          <Card>
            <div className="p-2">
              <NuevoCliente clienteToEdit={cliente} isEditMode={true} onSaveSuccess={() => navigate('/apps/seguros/clientes')} />
            </div>
          </Card>
        </Tabs.Item>
        <Tabs.Item title="Archivos">
          <ArchivosCliente clienteId={id!} />
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default EditarCliente;

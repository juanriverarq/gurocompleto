import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Alert, Tabs } from 'flowbite-react';
import { HiArrowLeft } from 'react-icons/hi';
import { polizaService, type Poliza } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import NuevaPoliza from './NuevaPoliza';
import ArchivosPoliza from './components/ArchivosPoliza';
import AnexosPoliza from './components/AnexosPoliza';
import ComisionesPoliza from './components/ComisionesPoliza';

const EditarPoliza: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar póliza
  useEffect(() => {
    const loadPoliza = async () => {
      if (!id) {
        setError('ID de póliza no válido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await polizaService.getPoliza(id);
        if (response.success && response.data) {
          setPoliza(response.data);
        } else {
          setError('No se pudo cargar la póliza');
        }
      } catch (error) {
        setError('Error al cargar la póliza');
      } finally {
        setLoading(false);
      }
    };

    loadPoliza();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Cargando póliza...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !poliza) {
    return (
      <div className="space-y-6">
        <Card>
          <Alert color="failure">
            <div className="flex items-center">
              <span className="font-medium">Error:</span>
              <span className="ml-2">{error || 'Póliza no encontrada'}</span>
            </div>
          </Alert>
          <div className="mt-4">
            <Button
              color="gray"
              onClick={() => navigate('/apps/seguros/polizas')}
            >
              <HiArrowLeft className="w-4 h-4 mr-2" />
              Volver a Pólizas
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          color="gray"
          onClick={() => navigate('/apps/seguros/polizas')}
        >
          <HiArrowLeft className="w-4 h-4 mr-2" />
          Volver a Pólizas
        </Button>
        <div className="text-sm text-gray-500">
          Editando póliza: <strong>{poliza.numero_poliza}</strong>
        </div>
      </div>

      <Tabs>
        <Tabs.Item active title="Póliza">
          <NuevaPoliza 
            polizaToEdit={poliza}
            isEditMode={true}
            onSaveSuccess={() => {
              toast({
                title: "Póliza actualizada",
                description: "La póliza se ha actualizado correctamente",
                variant: "default",
              });
              navigate('/apps/seguros/polizas');
            }}
          />
        </Tabs.Item>
        <Tabs.Item title="Anexos">
          <AnexosPoliza polizaId={poliza.id!} numeroPoliza={poliza.numero_poliza} />
        </Tabs.Item>
        <Tabs.Item title="Archivos">
          <ArchivosPoliza polizaId={poliza.id!} />
        </Tabs.Item>
        <Tabs.Item title="Liquidación de Comisiones">
          <ComisionesPoliza 
            polizaId={poliza.id!} 
            numeroPoliza={poliza.numero_poliza}
            vendedorId={poliza.vendedor_id}
            vendedorId2={poliza.vendedor_id_2}
            vendedorNombre={poliza.vendedor}
            vendedor2Nombre={poliza.vendedor_2}
            aseguradoraNombre={poliza.aseguradora_nombre || poliza.aseguradora}
            ramoNombre={poliza.ramo_nombre || poliza.ramo_principal}
            clienteNombre={poliza.nombre_completo_cliente || poliza.nombres_cliente}
          />
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default EditarPoliza; 
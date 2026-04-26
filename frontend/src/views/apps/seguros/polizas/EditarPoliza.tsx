import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Alert, Tabs } from 'flowbite-react';
import { HiArrowLeft, HiRefresh, HiDownload } from 'react-icons/hi';
import { polizaService, type Poliza } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import NuevaPoliza from './NuevaPoliza';
import ArchivosPoliza from './components/ArchivosPoliza';
import AnexosPoliza from './components/AnexosPoliza';
import ComisionesPoliza from './components/ComisionesPoliza';
import VinculadosPoliza from './components/VinculadosPoliza';
import PagosPoliza from './components/PagosPoliza';
import CoberturasPolizaTab from './components/CoberturasPolizaTab';
import TareasAsociadas from '../components/TareasAsociadas';

const EditarPoliza: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>('individual');
  const [syncing, setSyncing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      await polizaService.downloadCaratulaPdf(id);
    } catch (e) {
      toast({
        title: 'Error al descargar carátula',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleResync = async () => {
    if (!id || !poliza?.sync_source) return;
    setSyncing(true);
    try {
      const res = await polizaService.syncPolizaDetail(id, { async: false });
      if (res.success) {
        const failed = res.data?.detail_sync_status === 'failed';
        toast({
          title: failed ? 'Sincronización falló' : 'Póliza sincronizada',
          description: failed
            ? res.data?.detail_sync_error || 'Revisa el estado en coberturas.'
            : `Coberturas: ${res.data?.coverages_count ?? 0}`,
          variant: failed ? 'destructive' : 'default',
        });
        await loadPoliza();
      } else {
        toast({ title: 'No se pudo sincronizar', description: res.message || 'Error desconocido', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error al sincronizar', description: e instanceof Error ? e.message : 'Error desconocido', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // Cargar póliza
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
        setCurrentCategory(response.data.policy_category || 'individual');
      } else {
        setError('No se pudo cargar la póliza');
      }
    } catch (error) {
      setError('Error al cargar la póliza');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Button
          color="gray"
          size="xs"
          onClick={() => navigate('/apps/seguros/polizas')}
        >
          <HiArrowLeft className="w-3 h-3 mr-1" />
          Pólizas
        </Button>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            <strong>{poliza.numero_poliza}</strong> — {poliza.aseguradora_nombre || poliza.aseguradora || ''} / {poliza.ramo_nombre || poliza.ramo_principal || ''}
          </div>
          {poliza.sync_source && (
            <>
              <Button
                color="light"
                size="xs"
                disabled={syncing}
                onClick={() => void handleResync()}
                title="Resincronizar desde aseguradora"
              >
                {syncing ? <Spinner size="xs" className="mr-1" /> : <HiRefresh className="w-3 h-3 mr-1" />}
                {syncing ? 'Sincronizando…' : 'Resincronizar'}
              </Button>
              {poliza.sync_source === 'hdi' && (
                <Button
                  color="light"
                  size="xs"
                  disabled={downloadingPdf}
                  onClick={() => void handleDownloadPdf()}
                  title="Descargar carátula PDF desde HDI"
                >
                  {downloadingPdf ? <Spinner size="xs" className="mr-1" /> : <HiDownload className="w-3 h-3 mr-1" />}
                  {downloadingPdf ? 'Descargando…' : 'Carátula PDF'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs>
        <Tabs.Item active title="Póliza">
          <NuevaPoliza 
            polizaToEdit={poliza}
            isEditMode={true}
            onCategoryChange={(cat) => setCurrentCategory(cat)}
            onSaveSuccess={async () => {
              toast({
                title: "Póliza actualizada",
                description: "La póliza se ha actualizado correctamente",
                variant: "default",
              });
              // Recargar la póliza para reflejar cambios (ej. categoría)
              await loadPoliza();
            }}
          />
        </Tabs.Item>
        <Tabs.Item title="Anexos">
          <AnexosPoliza polizaId={poliza.id!} numeroPoliza={poliza.numero_poliza} />
        </Tabs.Item>
        <Tabs.Item title="Archivos">
          <ArchivosPoliza polizaId={poliza.id!} />
        </Tabs.Item>
        <Tabs.Item title="Coberturas">
          <CoberturasPolizaTab poliza={poliza} onRefresh={loadPoliza} />
        </Tabs.Item>
        {currentCategory === 'colectiva' && (
          <Tabs.Item title="Vinculados">
            <VinculadosPoliza polizaId={poliza.id!} />
          </Tabs.Item>
        )}
        <Tabs.Item title="Pagos">
          <PagosPoliza
            key={`pagos-${poliza.id}-${poliza.updated_at || ''}`}
            polizaId={String(poliza.id!)}
            clienteId={poliza.cliente_id ? String(poliza.cliente_id) : undefined}
            primaTotal={poliza.total || (poliza.prima_neta + (poliza.iva || 0))}
            primaNeta={poliza.prima_neta}
            periodicidad={poliza.periodicidad_pago}
            fechaInicio={poliza.fecha_inicio}
            fechaFin={poliza.fecha_fin}
            formaPago={poliza.forma_pago}
            numeroPoliza={poliza.numero_poliza}
            clienteNombre={poliza.nombre_completo_cliente || poliza.nombres_cliente}
            aseguradoraNombre={poliza.aseguradora_nombre || poliza.aseguradora}
            ramoNombre={poliza.ramo_nombre || poliza.ramo_principal}
            installmentsCount={poliza.installments_count}
          />
        </Tabs.Item>
        <Tabs.Item title="Comisiones">
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
        <Tabs.Item title="Tareas">
          <TareasAsociadas
            polizaId={poliza.id}
            clientId={poliza.cliente_id}
            polizaNumber={poliza.numero_poliza}
            clientName={poliza.nombre_completo_cliente || poliza.nombres_cliente}
          />
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default EditarPoliza; 
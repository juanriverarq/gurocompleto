import React, { useState } from 'react';
import { Button, Badge, Spinner, Table } from 'flowbite-react';
import { polizaService, type Poliza } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Sincronizando…',
  completed: 'Actualizado',
  partial: 'Parcial',
  failed: 'Error',
  not_applicable: 'No aplica',
};

function statusColor(
  s?: string | null
): 'success' | 'failure' | 'warning' | 'info' | 'gray' {
  switch (s) {
    case 'completed':
      return 'success';
    case 'partial':
      return 'warning';
    case 'failed':
      return 'failure';
    case 'processing':
      return 'info';
    case 'not_applicable':
      return 'gray';
    default:
      return 'gray';
  }
}

type Props = {
  poliza: Poliza;
  onRefresh: () => Promise<void>;
};

const CoberturasPolizaTab: React.FC<Props> = ({ poliza, onRefresh }) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const canResync = Boolean(poliza.sync_source) && poliza.detail_sync_status !== 'not_applicable';
  const coverages = poliza.coverages ?? [];

  const handleResync = async () => {
    if (!poliza.id) return;
    setSyncing(true);
    try {
      const res = await polizaService.syncPolizaDetail(String(poliza.id), { async: false });
      if (res.success && res.data?.async) {
        toast({
          title: 'Sincronización en cola',
          description: 'El detalle se actualizará en segundo plano.',
        });
      } else if (res.success) {
        const failed = res.data?.detail_sync_status === 'failed';
        toast({
          title: failed ? 'Sincronización falló' : 'Detalle actualizado',
          description: failed
            ? res.data?.detail_sync_error || 'Revisa el estado en la póliza.'
            : `Coberturas: ${res.data?.coverages_count ?? 0}`,
          variant: failed ? 'destructive' : 'default',
        });
        await onRefresh();
      } else {
        toast({
          title: 'No se pudo sincronizar',
          description: res.message || 'Error desconocido',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Error al sincronizar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Estado detalle</span>
          <Badge color={statusColor(poliza.detail_sync_status)}>
            {statusLabel[poliza.detail_sync_status || ''] ||
              (poliza.detail_sync_status ? String(poliza.detail_sync_status) : 'Sin sincronizar')}
          </Badge>
          {poliza.detail_sync_at && (
            <span className="text-xs text-gray-500">
              {new Date(poliza.detail_sync_at).toLocaleString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          color="blue"
          disabled={!canResync || syncing}
          onClick={() => void handleResync()}
        >
          {syncing ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Sincronizando…
            </>
          ) : (
            'Actualizar desde aseguradora'
          )}
        </Button>
      </div>

      {poliza.detail_sync_status === 'not_applicable' && (
        <p className="text-sm text-gray-500">
          Esta aseguradora no expone un endpoint de detalle — las coberturas se gestionan directamente en el portal.
        </p>
      )}

      {!canResync && poliza.detail_sync_status !== 'not_applicable' && (
        <p className="text-sm text-gray-600">
          Solo las pólizas traídas por el sincronizador de aseguradoras pueden pedir detalle y coberturas
          desde el portal.
        </p>
      )}

      {poliza.detail_sync_error && poliza.detail_sync_status === 'failed' && (
        <p className="text-sm text-red-600">{poliza.detail_sync_error}</p>
      )}

      {coverages.length === 0 ? (
        <p className="text-sm text-gray-500">
          {canResync
            ? 'No hay coberturas guardadas. Usa «Actualizar desde aseguradora».'
            : 'No hay coberturas para mostrar.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Nombre</Table.HeadCell>
              <Table.HeadCell>Tipo</Table.HeadCell>
              <Table.HeadCell>Código</Table.HeadCell>
              <Table.HeadCell>Valor asegurado</Table.HeadCell>
              <Table.HeadCell>Deducible</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {coverages.map((c) => (
                <Table.Row key={c.id ?? `${c.coverage_code}-${c.coverage_name}`}>
                  <Table.Cell className="whitespace-normal max-w-xs">
                    {c.coverage_name || '—'}
                  </Table.Cell>
                  <Table.Cell>{c.coverage_type || '—'}</Table.Cell>
                  <Table.Cell>{c.coverage_code || '—'}</Table.Cell>
                  <Table.Cell>
                    {c.insured_value != null && c.insured_value !== ''
                      ? String(c.insured_value)
                      : '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-normal max-w-sm">
                    {c.deductible ||
                      (c.deductible_value != null ? String(c.deductible_value) : null) ||
                      (c.deductible_percentage != null
                        ? `${c.deductible_percentage} %`
                        : null) ||
                      '—'}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CoberturasPolizaTab;

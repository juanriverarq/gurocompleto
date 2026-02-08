import React, { useEffect, useState } from 'react';
import { Button, Alert, Modal, Spinner, Card, Badge } from 'flowbite-react';
import { Icon as IconifyIcon } from '@iconify/react';
import TitleCard from 'src/components/shared/TitleBorderCard';
import salesFunnelService, {
  SalesFunnelLead,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS,
} from 'src/services/salesFunnelService';

// Configuración visual para cada etapa
const STAGE_CONFIG = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-800', icon: 'solar:user-bold-duotone' },
  contacted: {
    label: 'Contactado',
    color: 'bg-blue-100 text-blue-800',
    icon: 'solar:phone-bold-duotone',
  },
  qualified: {
    label: 'Calificado',
    color: 'bg-indigo-100 text-indigo-800',
    icon: 'solar:check-circle-bold-duotone',
  },
  presentation: {
    label: 'Presentación',
    color: 'bg-purple-100 text-purple-800',
    icon: 'solar:presentation-graph-bold-duotone',
  },
  proposal: {
    label: 'Propuesta',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'solar:document-text-bold-duotone',
  },
  negotiation: {
    label: 'Negociación',
    color: 'bg-orange-100 text-orange-800',
    icon: 'solar:handshake-bold-duotone',
  },
  closed_won: {
    label: 'Ganado',
    color: 'bg-green-100 text-green-800',
    icon: 'solar:star-bold-duotone',
  },
  closed_lost: {
    label: 'Perdido',
    color: 'bg-red-100 text-red-800',
    icon: 'solar:close-circle-bold-duotone',
  },
};

interface DetalleNegocioModalProps {
  show: boolean;
  onClose: () => void;
  leadId: number;
  onEdit?: () => void;
}

const DetalleNegocioModal: React.FC<DetalleNegocioModalProps> = ({
  show,
  onClose,
  leadId,
  onEdit,
}) => {
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<SalesFunnelLead | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para cambio de estado rápido
  const [showStateModal, setShowStateModal] = useState(false);
  const [newState, setNewState] = useState<string>('');
  const [changingState, setChangingState] = useState(false);

  // Cargar datos del lead cuando se abre el modal
  useEffect(() => {
    if (show && leadId) {
      const load = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await salesFunnelService.getLead(leadId);
          setLead(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Error al cargar negocio');
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  }, [show, leadId]);

  const formatCurrency = (value: number) => {
    const numValue = Number(value) || 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Función para cambiar etapa del negocio
  const handleChangeState = () => {
    setNewState(lead?.stage || 'lead');
    setShowStateModal(true);
  };

  // Confirmar cambio de etapa
  const confirmStateChange = async () => {
    if (!lead || !newState) return;

    try {
      setChangingState(true);
      await salesFunnelService.moveToStage(lead.id, newState);

      // Actualizar el lead local
      setLead((prev) => (prev ? { ...prev, stage: newState } : null));
      setShowStateModal(false);
      setNewState('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar etapa');
    } finally {
      setChangingState(false);
    }
  };

  const stageConfig = STAGE_CONFIG[lead?.stage as keyof typeof STAGE_CONFIG] || STAGE_CONFIG.lead;

  return (
    <>
      <Modal show={show} onClose={onClose} size="6xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:user-bold-duotone" className="w-6 h-6 text-blue-600" />
            <span>Detalle del Negocio</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="max-h-[75vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
                <span className="ml-3">Cargando negocio...</span>
              </div>
            ) : error && !lead ? (
              <Alert color="failure">{error}</Alert>
            ) : lead ? (
              <div className="space-y-6">
                {/* Header con información principal */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <IconifyIcon icon="solar:user-bold-duotone" className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {lead.full_name || `${lead.first_name} ${lead.last_name}`}
                      </h2>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge
                          className={`${stageConfig.color} px-3 py-1 rounded-full text-sm font-medium`}
                        >
                          <IconifyIcon icon={stageConfig.icon} className="w-4 h-4 mr-1 inline" />
                          {stageConfig.label}
                        </Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Etapa: {STAGES[lead.stage as keyof typeof STAGES] || lead.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Métricas rápidas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Valor Potencial</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(lead.potential_value || 0)}
                        </p>
                      </div>
                      <IconifyIcon
                        icon="solar:dollar-bold-duotone"
                        className="w-8 h-8 text-green-500"
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Probabilidad</p>
                        <p className="text-lg font-bold text-blue-600">
                          {lead.close_probability || 0}%
                        </p>
                      </div>
                      <IconifyIcon
                        icon="solar:chart-bold-duotone"
                        className="w-8 h-8 text-blue-500"
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Calidad</p>
                        <p className="text-sm font-bold text-orange-600">
                          {QUALITY_RATINGS[lead.quality_rating as keyof typeof QUALITY_RATINGS] ||
                            lead.quality_rating}
                        </p>
                      </div>
                      <IconifyIcon
                        icon="solar:star-bold-duotone"
                        className="w-8 h-8 text-orange-500"
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Puntuación</p>
                        <p className="text-lg font-bold text-purple-600">{lead.lead_score || 0}</p>
                      </div>
                      <IconifyIcon
                        icon="solar:medal-star-bold-duotone"
                        className="w-8 h-8 text-purple-500"
                      />
                    </div>
                  </Card>
                </div>

                {/* Información de contacto */}
                <TitleCard title="Información de Contacto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:letter-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.email || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:phone-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Teléfono</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.phone || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:document-text-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Documento</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.document_number
                            ? `${lead.document_type || ''} ${lead.document_number}`
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:map-point-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Ubicación</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.city && lead.department
                            ? `${lead.city}, ${lead.department}`
                            : lead.city || lead.department || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </TitleCard>

                {/* Detalles del negocio */}
                <TitleCard title="Detalles del Negocio">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:shield-check-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Tipo de Seguro</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {INSURANCE_TYPES[lead.insurance_type as keyof typeof INSURANCE_TYPES] ||
                            lead.insurance_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:graph-up-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Origen</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {LEAD_SOURCES[lead.lead_source as keyof typeof LEAD_SOURCES] ||
                            lead.lead_source}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:calendar-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Fecha de Cierre Esperada</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(lead.expected_close_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconifyIcon
                        icon="solar:clock-circle-bold-duotone"
                        className="w-5 h-5 text-gray-400"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Días en Etapa Actual</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.days_in_current_stage || 0} días
                        </p>
                      </div>
                    </div>
                  </div>
                </TitleCard>

                {/* Notas */}
                {lead.notes && (
                  <TitleCard title="Notas">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  </TitleCard>
                )}
              </div>
            ) : null}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="light" onClick={onClose} className="rounded-[10px]">
            Cerrar
          </Button>
          <Button
            type="button"
            color="secondary"
            onClick={handleChangeState}
            className="rounded-[10px]"
          >
            <IconifyIcon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 mr-2" />
            Cambiar Estado
          </Button>
          <Button
            type="button"
            onClick={onEdit}
            color="primary"
            className="rounded-[10px]"
          >
            <IconifyIcon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para cambiar etapa */}
      <Modal show={showStateModal} onClose={() => setShowStateModal(false)} size="md">
        <Modal.Header>Cambiar Etapa del Negocio</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Selecciona la nueva etapa para:{' '}
                <strong>{lead?.full_name || `${lead?.first_name} ${lead?.last_name}`}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(STAGE_CONFIG).map(([key, stage]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    newState === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setNewState(key)}
                >
                  <div className="flex items-center gap-3">
                    <IconifyIcon icon={stage.icon} className="w-5 h-5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{stage.label}</div>
                      <div className="text-xs text-gray-500">
                        {key === 'lead' && 'Lead inicial sin contactar'}
                        {key === 'contacted' && 'Se ha establecido contacto inicial'}
                        {key === 'qualified' && 'Lead calificado con potencial'}
                        {key === 'presentation' && 'Presentación del producto realizada'}
                        {key === 'proposal' && 'Propuesta comercial enviada'}
                        {key === 'negotiation' && 'En proceso de negociación activa'}
                        {key === 'closed_won' && 'Negocio ganado y cerrado'}
                        {key === 'closed_lost' && 'Negocio perdido'}
                      </div>
                    </div>
                    {newState === key && (
                      <IconifyIcon
                        icon="solar:check-circle-bold"
                        className="w-5 h-5 text-blue-600 ml-auto"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowStateModal(false)} disabled={changingState}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={confirmStateChange}
            disabled={changingState || !newState}
            className=""
          >
            {changingState ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Cambiando...
              </>
            ) : (
              'Cambiar Etapa'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DetalleNegocioModal;

import React, { useEffect, useState } from 'react';
import { Card, Button, Spinner, Alert, Modal, Badge, Dropdown } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { Icon as IconifyIcon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
// @ts-ignore
import SimpleBar from 'simplebar-react';
import salesFunnelService, {
  SalesFunnelLead,
  STAGES,
  formatCurrency,
} from 'src/services/salesFunnelService';
import { IconDots } from '@tabler/icons-react';
import NuevoNegocioModal from 'src/components/saas/sales-funnel/NuevoNegocioModal';
import EditarNegocioModal from 'src/components/saas/sales-funnel/EditarNegocioModal';
import DetalleNegocioModal from 'src/components/saas/sales-funnel/DetalleNegocioModal';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

// Configuración visual para cada etapa del Kanban
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
    label: 'Cotización',
    color: 'bg-purple-100 text-purple-800',
    icon: 'solar:presentation-graph-bold-duotone',
  },
  proposal: {
    label: 'Asesoría',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'solar:document-text-bold-duotone',
  },
  negotiation: {
    label: 'Seguimiento',
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

// Colores de fondo para las columnas
const STAGE_BACKGROUNDS = {
  lead: 'bg-gray-50 dark:bg-gray-800',
  contacted: 'bg-blue-50 dark:bg-blue-900/20',
  qualified: 'bg-indigo-50 dark:bg-indigo-900/20',
  presentation: 'bg-purple-50 dark:bg-purple-900/20',
  proposal: 'bg-yellow-50 dark:bg-yellow-900/20',
  negotiation: 'bg-orange-50 dark:bg-orange-900/20',
  closed_won: 'bg-green-50 dark:bg-green-900/20',
  closed_lost: 'bg-red-50 dark:bg-red-900/20',
};

const SalesFunnelKanban: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission ? hasPermission('embudo_ventas', 'crear') : false;
  const canEdit = hasPermission ? hasPermission('embudo_ventas', 'editar') : false;
  const [leads, setLeads] = useState<SalesFunnelLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingLead, setMovingLead] = useState<number | null>(null);

  // Estados para cambio de estado
  const [showStateModal, setShowStateModal] = useState(false);
  const [leadToChangeState, setLeadToChangeState] = useState<SalesFunnelLead | null>(null);
  const [newState, setNewState] = useState<string>('');
  const [changingState, setChangingState] = useState(false);

  // Estado para modal de nuevo negocio
  const [showNuevoNegocioModal, setShowNuevoNegocioModal] = useState(false);

  // Estados para modales de editar y detalle
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  // Estados para eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<SalesFunnelLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cargar leads
  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await salesFunnelService.getLeads({ per_page: 1000 }); // Cargar todos
      setLeads(response.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar leads por etapa
  const leadsByStage = Object.keys(STAGES).reduce((acc, stage) => {
    acc[stage] = leads.filter((lead) => lead.stage === stage);
    return acc;
  }, {} as Record<string, SalesFunnelLead[]>);

  // Manejar drag & drop
  const handleDragEnd = async (result: any) => {
    if (!canEdit) {
      return;
    }
    const { source, destination, draggableId } = result;

    // Si no hay destino o es el mismo lugar, no hacer nada
    if (
      !destination ||
      (source.droppableId === destination.droppableId && source.index === destination.index)
    ) {
      return;
    }

    const leadId = parseInt(draggableId);
    const newStage = destination.droppableId;

    try {
      setMovingLead(leadId);

      // Actualizar optimísticamente en el UI
      setLeads((prevLeads) =>
        prevLeads.map((lead) => (lead.id === leadId ? { ...lead, stage: newStage } : lead)),
      );

      // Actualizar en el backend
      await salesFunnelService.moveToStage(leadId, newStage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al mover lead');
      // Revertir cambio en caso de error
      loadLeads();
    } finally {
      setMovingLead(null);
    }
  };

  // Función para cambiar etapa del negocio
  const handleChangeState = (lead: SalesFunnelLead) => {
    setLeadToChangeState(lead);
    setNewState(lead.stage);
    setShowStateModal(true);
  };

  // Función para eliminar negocio
  const handleDeleteClick = (lead: SalesFunnelLead) => {
    setLeadToDelete(lead);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!leadToDelete) return;

    try {
      setDeleting(true);
      await salesFunnelService.deleteLead(leadToDelete.id);
      await loadLeads();
      setShowDeleteModal(false);
      setLeadToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar negocio');
    } finally {
      setDeleting(false);
    }
  };

  // Confirmar cambio de etapa
  const confirmStateChange = async () => {
    if (!leadToChangeState || !newState) return;

    try {
      setChangingState(true);
      // Cambiar la etapa (esto moverá el lead a otra columna)
      await salesFunnelService.moveToStage(leadToChangeState.id, newState);

      // Recargar los leads para reflejar el cambio
      await loadLeads();

      setShowStateModal(false);
      setLeadToChangeState(null);
      setNewState('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar etapa');
    } finally {
      setChangingState(false);
    }
  };

  // Calcular estadísticas
  const estadisticas = {
    total: leads.length,
    porEtapa: Object.keys(STAGES).reduce((acc, stage) => {
      acc[stage] = leadsByStage[stage]?.length || 0;
      return acc;
    }, {} as Record<string, number>),
    valorTotal: leads.reduce((sum, lead) => sum + (Number(lead.potential_value) || 0), 0),
    probabilidadPromedio:
      leads.length > 0
        ? leads.reduce((sum, lead) => sum + (Number(lead.close_probability) || 0), 0) / leads.length
        : 0,
  };

  return (
    <PermissionGate
      route="/apps/saas/sales-funnel/kanban"
      action="ver"
      fallback={
        <div className="p-6 text-center text-gray-500">No tienes permisos para ver Negocios.</div>
      }
    >
      <div className="space-y-6">
        {/* Título */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Negocios - Vista Kanban
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Arrastra y suelta para cambiar la etapa de los negocios
          </p>
        </div>

        {error && (
          <Alert color="failure" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Negocios</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticas.total}</p>
              </div>
              <IconifyIcon
                icon="solar:target-bold-duotone"
                className="w-6 h-6 md:w-8 md:h-8 text-blue-500"
              />
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Nuevos</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  {estadisticas.porEtapa.lead || 0}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Calificados</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  {estadisticas.porEtapa.qualified || 0}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-sm md:text-lg font-bold text-purple-600">
                  {formatCurrency(estadisticas.valorTotal)}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs md:text-sm">$</span>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4 col-span-2 sm:col-span-3 md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Prob. Promedio</p>
                <p className="text-lg md:text-2xl font-bold text-red-600">
                  {Math.round(estadisticas.probabilidadPromedio)}%
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Header de Controles */}
        <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px] p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => navigate('/apps/saas/sales-funnel/lista')}
                className="h-10 px-4 rounded-[10px]"
              >
                <IconifyIcon icon="solar:list-bold" className="w-4 h-4 mr-2" />
                Ver Lista
              </Button>
              <Button
                color="light"
                onClick={loadLeads}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <IconifyIcon
                  icon="solar:refresh-bold-duotone"
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>

            {canCreate && (
              <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setShowNuevoNegocioModal(true)}>Nuevo Negocio</HeroButton>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3">Cargando negocios...</span>
          </div>
        ) : (
          <SimpleBar style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-6 pb-6">
                {Object.entries(STAGES).map(([stageKey, stageName]) => (
                  <Droppable droppableId={stageKey} key={stageKey}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`rounded-lg w-[300px] p-5 ${
                          STAGE_BACKGROUNDS[stageKey as keyof typeof STAGE_BACKGROUNDS]
                        } ${snapshot.isDraggingOver ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        {/* Header de la columna */}
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h6 className="text-base font-semibold text-gray-900 dark:text-white">
                              {stageName}
                            </h6>
                            <p className="text-xs text-gray-500">
                              {leadsByStage[stageKey]?.length || 0} negocios
                            </p>
                          </div>
                          <Badge color="gray" className="rounded-full">
                            {leadsByStage[stageKey]?.length || 0}
                          </Badge>
                        </div>

                        {/* Lista de leads */}
                        <div className="flex flex-col gap-3">
                          {leadsByStage[stageKey]?.map((lead, index) => {
                            const stageConfig =
                              STAGE_CONFIG[lead.stage as keyof typeof STAGE_CONFIG] ||
                              STAGE_CONFIG.lead;

                            return (
                              <Draggable
                                key={lead.id}
                                draggableId={String(lead.id)}
                                index={index}
                                isDragDisabled={!canEdit || movingLead === lead.id}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white dark:bg-dark rounded-md shadow-md dark:shadow-dark-md p-4 cursor-move ${
                                      snapshot.isDragging ? 'ring-2 ring-blue-400 shadow-lg' : ''
                                    } ${movingLead === lead.id ? 'opacity-50' : ''}`}
                                  >
                                    {/* Header de la tarjeta */}
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex-1">
                                        <h5 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                                          {lead.full_name || `${lead.first_name} ${lead.last_name}`}
                                        </h5>
                                        <p className="text-xs text-gray-500">#{lead.id}</p>
                                      </div>
                                      <Dropdown
                                        label=""
                                        dismissOnClick={false}
                                        renderTrigger={() => (
                                          <span className="btn-circle-hover cursor-pointer p-0 rounded-full h-6 w-6">
                                            <IconDots size={18} />
                                          </span>
                                        )}
                                      >
                                        <Dropdown.Item
                                          onClick={() => {
                                            setSelectedLeadId(lead.id);
                                            setShowDetalleModal(true);
                                          }}
                                          className="flex gap-2 items-center"
                                        >
                                          <IconifyIcon icon="solar:eye-bold-duotone" height={15} />
                                          Ver Detalles
                                        </Dropdown.Item>
                                        {canEdit && (
                                          <Dropdown.Item
                                            onClick={() => {
                                              setSelectedLeadId(lead.id);
                                              setShowEditarModal(true);
                                            }}
                                            className="flex gap-2 items-center"
                                          >
                                            <IconifyIcon
                                              icon="solar:pen-new-square-bold-duotone"
                                              height={15}
                                            />
                                            Editar
                                          </Dropdown.Item>
                                        )}
                                        <Dropdown.Divider />
                                        {canEdit && (
                                          <Dropdown.Item
                                            onClick={() => handleChangeState(lead)}
                                            className="flex gap-2 items-center"
                                          >
                                            <IconifyIcon
                                              icon="solar:refresh-circle-bold-duotone"
                                              height={15}
                                            />
                                            Cambiar Estado
                                          </Dropdown.Item>
                                        )}
                                        {canEdit && (
                                          <>
                                            <Dropdown.Divider />
                                            <Dropdown.Item
                                              onClick={() => handleDeleteClick(lead)}
                                              className="flex gap-2 items-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                              <IconifyIcon
                                                icon="solar:trash-bin-trash-bold-duotone"
                                                height={15}
                                              />
                                              Eliminar
                                            </Dropdown.Item>
                                          </>
                                        )}
                                      </Dropdown>
                                    </div>

                                    {/* Información de contacto */}
                                    <div className="space-y-2 mb-3">
                                      {lead.email && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                          <IconifyIcon
                                            icon="solar:letter-bold-duotone"
                                            className="w-3 h-3"
                                          />
                                          <span className="truncate">{lead.email}</span>
                                        </div>
                                      )}
                                      {lead.phone && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                          <IconifyIcon
                                            icon="solar:phone-bold-duotone"
                                            className="w-3 h-3"
                                          />
                                          <span>{lead.phone}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Etapa del negocio */}
                                    <div className="flex items-center gap-2 mb-3">
                                      <IconifyIcon icon={stageConfig.icon} className="w-4 h-4" />
                                      <Badge
                                        className={`${stageConfig.color} px-2 py-1 rounded-full text-xs`}
                                      >
                                        {stageConfig.label}
                                      </Badge>
                                    </div>

                                    {/* Footer con valor y probabilidad */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                      <div className="flex items-center gap-1">
                                        <IconifyIcon
                                          icon="solar:dollar-bold-duotone"
                                          className="w-4 h-4 text-green-600"
                                        />
                                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                          {formatCurrency(lead.potential_value || 0)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <IconifyIcon
                                          icon="solar:chart-bold-duotone"
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                          {lead.close_probability || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>

                        {/* Mensaje cuando no hay leads */}
                        {(!leadsByStage[stageKey] || leadsByStage[stageKey].length === 0) && (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            <IconifyIcon
                              icon="solar:inbox-line-bold-duotone"
                              className="w-12 h-12 mx-auto mb-2 opacity-50"
                            />
                            <p>No hay negocios</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>
          </SimpleBar>
        )}

        {/* Modal para cambiar etapa */}
        <Modal show={showStateModal} onClose={() => setShowStateModal(false)} size="md">
          <Modal.Header>Cambiar Etapa del Negocio</Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Selecciona la nueva etapa para:{' '}
                  <strong>
                    {leadToChangeState?.full_name ||
                      `${leadToChangeState?.first_name} ${leadToChangeState?.last_name}`}
                  </strong>
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
                        <div className="font-medium text-gray-900 dark:text-white">
                          {stage.label}
                        </div>
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

        {/* Modal para crear nuevo negocio */}
        {canCreate && (
          <NuevoNegocioModal
            show={showNuevoNegocioModal}
            onClose={() => setShowNuevoNegocioModal(false)}
            onSuccess={(newLead) => {
              setShowNuevoNegocioModal(false);
              loadLeads(); // Recargar la lista de leads
              if (newLead?.id) {
                setSelectedLeadId(newLead.id);
                setShowDetalleModal(true);
              }
            }}
          />
        )}

        {/* Modal para editar negocio */}
        {canEdit && selectedLeadId && (
          <EditarNegocioModal
            show={showEditarModal}
            onClose={() => {
              setShowEditarModal(false);
              setSelectedLeadId(null);
            }}
            leadId={selectedLeadId}
            onSuccess={() => {
              setShowEditarModal(false);
              loadLeads(); // Recargar la lista de leads
            }}
          />
        )}

        {/* Modal para ver detalle del negocio */}
        {selectedLeadId && (
          <DetalleNegocioModal
            show={showDetalleModal}
            onClose={() => {
              setShowDetalleModal(false);
              setSelectedLeadId(null);
            }}
            leadId={selectedLeadId}
            onEdit={() => {
              setShowDetalleModal(false);
              setShowEditarModal(true);
            }}
          />
        )}

        {/* Modal de confirmación de eliminación */}
        <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md">
          <Modal.Header>Eliminar Negocio</Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ¿Estás seguro de que deseas eliminar el negocio{' '}
                <strong>
                  {leadToDelete?.full_name ||
                    `${leadToDelete?.first_name} ${leadToDelete?.last_name}`}
                </strong>
                ?
              </p>
              <Alert color="warning">
                Esta acción no se puede deshacer.
              </Alert>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="light" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              color="failure"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </PermissionGate>
  );
};

export default SalesFunnelKanban;

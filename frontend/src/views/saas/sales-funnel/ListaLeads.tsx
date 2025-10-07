import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Table, Dropdown, Spinner, Alert, Modal, Badge } from 'flowbite-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { useNavigate } from 'react-router-dom';
import { Icon as IconifyIcon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import salesFunnelService, { SalesFunnelFilters, SalesFunnelLead, STAGES, INSURANCE_TYPES, LEAD_SOURCES, QUALITY_RATINGS } from 'src/services/salesFunnelService';

// Estados dinámicos del negocio
const BUSINESS_STATES = {
  'nuevo': { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: 'solar:star-bold-duotone' },
  'contactado': { label: 'Contactado', color: 'bg-green-100 text-green-800', icon: 'solar:phone-bold-duotone' },
  'interesado': { label: 'Interesado', color: 'bg-orange-100 text-orange-800', icon: 'solar:heart-bold-duotone' },
  'negociando': { label: 'Negociando', color: 'bg-purple-100 text-purple-800', icon: 'solar:handshake-bold-duotone' },
  'cerrado': { label: 'Cerrado', color: 'bg-gray-100 text-gray-800', icon: 'solar:check-circle-bold-duotone' }
};

const ListaLeads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<SalesFunnelLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [sortKey, setSortKey] = useState<'lead' | 'stage' | 'value'>('lead');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Estados para cambio de estado
  const [showStateModal, setShowStateModal] = useState(false);
  const [leadToChangeState, setLeadToChangeState] = useState<SalesFunnelLead | null>(null);
  const [newState, setNewState] = useState<string>('');
  const [changingState, setChangingState] = useState(false);

  const [filters, setFilters] = useState<SalesFunnelFilters>({
    search: '',
    stage: '',
    insurance_type: '',
    lead_source: '',
    quality_rating: '',
    per_page: 10,
    page: 1,
  });

  const stageOptions = useMemo(() => Object.entries(STAGES), []);
  const insuranceOptions = useMemo(() => Object.entries(INSURANCE_TYPES), []);
  const sourceOptions = useMemo(() => Object.entries(LEAD_SOURCES), []);
  const qualityOptions = useMemo(() => Object.entries(QUALITY_RATINGS), []);

  // Efecto para cargar per_page persistido solo al montar
  useEffect(() => {
    const savedPerPage = Number(localStorage.getItem('leads_per_page') || '0');
    if (savedPerPage && !Number.isNaN(savedPerPage)) {
      setFilters(prev => ({ ...prev, per_page: savedPerPage }));
    }
  }, []);

  // Efecto para cargar datos cuando cambian los filtros
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await salesFunnelService.getLeads(filters);
        setLeads(response.data);
        setCurrentPage(response.current_page);
        setTotalPages(response.last_page);
        setTotalLeads(response.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar leads');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  const handleFilter = (key: keyof SalesFunnelFilters, value: string) => {
    if (key === 'per_page') {
      const n = Number(value) || 10;
      localStorage.setItem('leads_per_page', String(n));
      setFilters(prev => ({ ...prev, per_page: n, page: 1 }));
      return;
    }
    const mapped = value === 'all' ? '' : value;
    setFilters(prev => ({ ...prev, [key]: mapped, page: 1 }));
  };

  const formatCOP = (value: number) => {
    const numValue = Number(value) || 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numValue);
  };

  const sortedLeads = useMemo(() => {
    const arr = [...leads];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === 'lead') {
        const an = (a.full_name || `${a.first_name} ${a.last_name}`).toLowerCase();
        const bn = (b.full_name || `${b.first_name} ${b.last_name}`).toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      if (sortKey === 'stage') {
        return (a.stage || '').localeCompare(b.stage || '') * dir;
      }
      if (sortKey === 'value') {
        return ((a.potential_value || 0) - (b.potential_value || 0)) * dir;
      }
      return 0;
    });
    return arr;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Función para cambiar estado del negocio
  const handleChangeState = (lead: SalesFunnelLead) => {
    setLeadToChangeState(lead);
    setNewState(lead.business_state || 'nuevo');
    setShowStateModal(true);
  };

  // Confirmar cambio de estado
  const confirmStateChange = async () => {
    if (!leadToChangeState || !newState) return;
    
    try {
      setChangingState(true);
      // Usar notes para almacenar el estado por ahora (hasta que se añada business_state al backend)
      await salesFunnelService.updateLead(leadToChangeState.id, { 
        notes: `Estado: ${newState}` 
      });
      
      // Actualizar el lead en la lista local
      setLeads(prev => prev.map(lead => 
        lead.id === leadToChangeState.id 
          ? { ...lead, business_state: newState }
          : lead
      ));
      
      setShowStateModal(false);
      setLeadToChangeState(null);
      setNewState('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    } finally {
      setChangingState(false);
    }
  };

  // CSS para dropdown como en Clientes
  const dropdownStyles = `
    .flowbite-dropdown [role="menu"],
    [data-testid="flowbite-dropdown"],
    div[role="menu"] { z-index: 60 !important; position: absolute !important; }
    td { overflow: visible; }
    .flowbite-dropdown { overflow: visible; }
    [role="menu"] { text-align: left !important; min-width: 11rem !important; width: max-content !important; max-width: 18rem !important; white-space: nowrap !important; }
    [role="menu"] > * { justify-content: flex-start !important; }
  `;

  // Calcular estadísticas básicas
  const estadisticas = {
    total: totalLeads,
    porEtapa: leads.reduce((acc, lead) => {
      const stage = lead.stage || 'unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    valorTotal: leads.reduce((sum, lead) => {
      const value = Number(lead.potential_value) || 0;
      return sum + value;
    }, 0),
    probabilidadPromedio: leads.length > 0 ? leads.reduce((sum, lead) => {
      const prob = Number(lead.close_probability) || 0;
      return sum + prob;
    }, 0) / leads.length : 0
  };

  const formatCurrency = (value: number) => {
    const numValue = Number(value) || 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numValue);
  };

  return (
    <div className="space-y-6">
      <style>{dropdownStyles}</style>
      
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Negocios</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestiona tus negocios comerciales</p>
      </div>

      {error && (
        <Alert color="failure">
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
            <IconifyIcon icon="solar:target-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Nuevos</p>
              <p className="text-lg md:text-2xl font-bold text-green-600">{estadisticas.porEtapa.lead || 0}</p>
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
              <p className="text-lg md:text-2xl font-bold text-orange-600">{estadisticas.porEtapa.qualified || 0}</p>
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
              <p className="text-sm md:text-lg font-bold text-purple-600">{formatCurrency(estadisticas.valorTotal)}</p>
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
              <p className="text-lg md:text-2xl font-bold text-red-600">{Math.round(estadisticas.probabilidadPromedio)}%</p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Header de Controles */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconifyIcon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, documento o email..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilter('search', e.target.value)}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => window.location.reload()}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <IconifyIcon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button onClick={() => navigate('/apps/saas/sales-funnel/nuevo')} color="primary" className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]">
                <IconifyIcon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Nuevo Negocio</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        {sortedLeads.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <IconifyIcon icon="solar:target-bold-duotone" className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">No hay negocios</p>
              <p className="text-gray-400 text-sm">Comienza creando tu primer negocio</p>
              <Button onClick={() => navigate('/apps/saas/sales-funnel/nuevo')} color="primary" className="mt-2">
                <IconifyIcon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                Crear primer negocio
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
            <Table.Head>
              <Table.HeadCell>
                <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => toggleSort('lead')}>
                  <span>Negocio</span>
                  <IconifyIcon
                    icon={sortKey === 'lead' ? (sortDir === 'asc' ? 'solar:arrow-up-bold-duotone' : 'solar:arrow-down-bold-duotone') : 'solar:sort-vertical-bold-duotone'}
                    className="w-4 h-4 text-gray-400"
                  />
                </div>
              </Table.HeadCell>
              <Table.HeadCell>Contacto</Table.HeadCell>
              <Table.HeadCell>
                <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => toggleSort('stage')}>
                  <span>Etapa</span>
                  <IconifyIcon
                    icon={sortKey === 'stage' ? (sortDir === 'asc' ? 'solar:arrow-up-bold-duotone' : 'solar:arrow-down-bold-duotone') : 'solar:sort-vertical-bold-duotone'}
                    className="w-4 h-4 text-gray-400"
                  />
                </div>
              </Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>
                <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => toggleSort('value')}>
                  <span>Valor</span>
                  <IconifyIcon
                    icon={sortKey === 'value' ? (sortDir === 'asc' ? 'solar:arrow-up-bold-duotone' : 'solar:arrow-down-bold-duotone') : 'solar:sort-vertical-bold-duotone'}
                    className="w-4 h-4 text-gray-400"
                  />
                </div>
              </Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
                <Table.Body>
                  {loading ? (
                    <Table.Row>
                      <Table.Cell colSpan={6} className="text-center">
                        <div className="flex items-center justify-center py-4">
                          <Spinner size="sm" className="mr-2" />
                          <span>Cargando negocios...</span>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    sortedLeads.map(lead => {
                      const currentState = lead.business_state || 'nuevo';
                      const stateConfig = BUSINESS_STATES[currentState as keyof typeof BUSINESS_STATES] || BUSINESS_STATES.nuevo;
                      
                      return (
                        <Table.Row key={lead.id}>
                          <Table.Cell className="whitespace-nowrap pr-8">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{lead.full_name || `${lead.first_name} ${lead.last_name}`}</div>
                            <div className="text-xs text-gray-400">#{lead.id}</div>
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap pr-8">
                            <div className="text-sm text-gray-900 dark:text-white">{lead.email || '-'}</div>
                            <div className="text-xs text-gray-500">{lead.phone || '-'}</div>
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap pr-8">
                            <span className="text-sm text-gray-900 dark:text-white">{STAGES[lead.stage as keyof typeof STAGES] || lead.stage}</span>
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap pr-8">
                            <div className="flex items-center gap-2">
                              <IconifyIcon icon={stateConfig.icon} className="w-4 h-4" />
                              <Badge className={`${stateConfig.color} px-2 py-1 rounded-full text-xs font-medium`}>
                                {stateConfig.label}
                              </Badge>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap pr-8">
                            <span className="text-sm text-gray-900 dark:text-white">{formatCOP(lead.potential_value || 0)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="relative inline-block">
                              <Dropdown
                                label=""
                                dismissOnClick={false}
                                renderTrigger={() => (
                                  <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                    <IconDots size={22} />
                                  </span>
                                )}
                              >
                                <Dropdown.Item 
                                  className="flex gap-3 w-full justify-start text-left"
                                  onClick={() => navigate(`/apps/saas/sales-funnel/${lead.id}`)}
                                >
                                  <IconifyIcon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Detalles</span>
                                </Dropdown.Item>
                                <Dropdown.Item 
                                  className="flex gap-3 w-full justify-start text-left"
                                  onClick={() => navigate(`/apps/saas/sales-funnel/${lead.id}/editar`)}
                                >
                                  <IconifyIcon icon="solar:pen-new-square-bold-duotone" height={18} />
                                  <span>Editar</span>
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item 
                                  className="flex gap-3 w-full justify-start text-left"
                                  onClick={() => handleChangeState(lead)}
                                >
                                  <IconifyIcon icon="solar:refresh-circle-bold-duotone" height={18} />
                                  <span>Cambiar Estado</span>
                                </Dropdown.Item>
                              </Dropdown>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table>
            </div>
            
            {/* Paginación */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Mostrando {new Intl.NumberFormat('es-CO').format(((currentPage - 1) * (filters.per_page || 10)) + 1)} a {new Intl.NumberFormat('es-CO').format(Math.min(currentPage * (filters.per_page || 10), totalLeads))} de {new Intl.NumberFormat('es-CO').format(totalLeads)} negocios
                </span>
                <div className="flex items-center gap-2">
                  <span>Por página:</span>
                  <select
                    className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                    value={filters.per_page || 10}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleFilter('per_page', String(val));
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  color="gray"
                  disabled={currentPage <= 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
                  className="rounded-[10px]"
                >
                  <IconifyIcon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  size="sm"
                  color="gray"
                  disabled={currentPage >= totalPages}
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
                  className="rounded-[10px]"
                >
                  <IconifyIcon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modal para cambiar estado */}
      <Modal show={showStateModal} onClose={() => setShowStateModal(false)} size="md">
        <Modal.Header>Cambiar Estado del Negocio</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Selecciona el nuevo estado para: <strong>{leadToChangeState?.full_name || `${leadToChangeState?.first_name} ${leadToChangeState?.last_name}`}</strong>
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(BUSINESS_STATES).map(([key, state]) => (
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
                    <IconifyIcon icon={state.icon} className="w-5 h-5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{state.label}</div>
                      <div className="text-xs text-gray-500">
                        {key === 'nuevo' && 'Negocio recién creado'}
                        {key === 'contactado' && 'Se ha establecido contacto inicial'}
                        {key === 'interesado' && 'Cliente muestra interés en el producto'}
                        {key === 'negociando' && 'En proceso de negociación activa'}
                        {key === 'cerrado' && 'Negocio finalizado (ganado o perdido)'}
                      </div>
                    </div>
                    {newState === key && (
                      <IconifyIcon icon="solar:check-circle-bold" className="w-5 h-5 text-blue-600 ml-auto" />
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            {changingState ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Cambiando...
              </>
            ) : (
              'Cambiar Estado'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ListaLeads;



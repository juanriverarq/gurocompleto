import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from "@iconify/react";
import HeroButton from 'src/components/HeroButton';
import { Card, Button, Table, Modal, Dropdown, Spinner, Alert } from 'flowbite-react';
import { IconDots } from '@tabler/icons-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';

// Servicios y tipos
import { 
  salesFunnelService, 
  SalesFunnelLead, 
  SalesFunnelFilters, 
  SalesFunnelStatistics,
  formatCurrency,
  formatDate,
  getStageColor,
  getQualityColor,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS
} from '../../../../services/salesFunnelService';

// CSS inline para alinear el dropdown de acciones con el de Clientes
const dropdownStyles = `
  .flowbite-dropdown [role="menu"],
  [data-testid="flowbite-dropdown"],
  div[role="menu"] {
    z-index: 60 !important;
    position: absolute !important;
  }
  td { overflow: visible; }
  .flowbite-dropdown { overflow: visible; }
  [role="menu"] {
    text-align: left !important;
    min-width: 11rem !important;
    width: max-content !important;
    max-width: 18rem !important;
    white-space: nowrap !important;
  }
  [role="menu"] > * { justify-content: flex-start !important; }
`;

// Componente principal
const EmbudoVentas: React.FC = () => {
  const navigate = useNavigate();
  
  // Estados
  const [leads, setLeads] = useState<SalesFunnelLead[]>([]);
  const [statistics, setStatistics] = useState<SalesFunnelStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<SalesFunnelLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtros
  const [filters, setFilters] = useState<SalesFunnelFilters>({
    search: '',
    stage: '',
    insurance_type: '',
    lead_source: '',
    quality_rating: '',
    assigned_agent_id: undefined,
    active_only: false,
    needing_follow_up: false,
    high_value: false,
    high_probability: false,
    stale_leads: false,
    expected_to_close_soon: false,
    per_page: 15
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [currentPage, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [leadsResponse, statsResponse] = await Promise.all([
        salesFunnelService.getLeads({ ...filters, page: currentPage }),
        salesFunnelService.getStatistics()
      ]);

      setLeads(leadsResponse.data);
      setCurrentPage(leadsResponse.current_page);
      setTotalPages(leadsResponse.last_page);
      setStatistics(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Funciones de filtros
  const handleFilterChange = (key: keyof SalesFunnelFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      stage: '',
      insurance_type: '',
      lead_source: '',
      quality_rating: '',
      assigned_agent_id: undefined,
      active_only: false,
      needing_follow_up: false,
      high_value: false,
      high_probability: false,
      stale_leads: false,
      expected_to_close_soon: false,
      per_page: 15
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'per_page') return false;
      return value !== '' && value !== undefined && value !== false;
    });
  };

  // Función para manejar acciones
  const handleAction = (leadId: number, action: string) => {
    switch (action) {
      case 'view':
        navigate(`/apps/seguros/embudo-ventas/${leadId}`);
        break;
      case 'edit':
        navigate(`/apps/seguros/embudo-ventas/${leadId}/edit`);
        break;
      case 'delete':
        {
          const target = leads.find(l => l.id === leadId) || null;
          setLeadToDelete(target);
          setShowDeleteModal(true);
        }
        break;
      case 'contact':
        // TODO: Implementar modal de contacto
        break;
      case 'convert':
        // TODO: Implementar conversión a cliente
        break;
      default:
        break;
    }
  };

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      setDeleting(true);
      await salesFunnelService.deleteLead(leadToDelete.id);
      setShowDeleteModal(false);
      setLeadToDelete(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el lead');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <style>{dropdownStyles}</style>
      

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Leads */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Leads
              </p>
              <p className="text-2xl font-bold text-primary dark:text-primary-400">
                {statistics?.total_leads || 0}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-[10px]">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Activos */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Activos
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {statistics?.active_leads || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-[10px]">
              <Icon icon="solar:chart-square-bold-duotone" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Cerrados Ganados */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Ganados
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {statistics?.closed_won || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-[10px]">
              <Icon icon="solar:cup-star-bold-duotone" className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Requieren Seguimiento */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Seguimiento
              </p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {statistics?.needing_follow_up || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-[10px]">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Valor Total */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Valor Potencial
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(statistics?.total_potential_value || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-[10px]">
              <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros y controles */}
      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Embudo de Ventas
            </h2>

            <div className="flex items-center gap-3">
              <HeroButton icon="solar:user-plus-bold-duotone" onClick={() => navigate('/apps/seguros/embudo-ventas/nuevo')}>Nuevo Lead</HeroButton>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Filtros básicos */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
            {/* Búsqueda */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <Icon icon="solar:magnifer-bold-duotone" className="w-4 h-4" />
              </div>
              <Input
                placeholder="Buscar leads..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Etapa */}
            <Select value={String(filters.stage || '')} onValueChange={(v) => handleFilterChange('stage', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las etapas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las etapas</SelectItem>
                {Object.entries(STAGES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo de seguro */}
            <Select value={String(filters.insurance_type || '')} onValueChange={(v) => handleFilterChange('insurance_type', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los seguros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los seguros</SelectItem>
                {Object.entries(INSURANCE_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Botón filtros avanzados */}
            <Button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              color={hasActiveFilters() ? 'primary' : 'light'}
              className="rounded-[10px]"
            >
              <Icon icon="solar:filter-bold-duotone" className="w-4 h-4 mr-2" />
              Filtros {hasActiveFilters() && `(${Object.values(filters).filter(v => v && v !== '' && v !== false).length - 1})`}
            </Button>
          </div>

          {/* Filtros avanzados */}
          {showAdvancedFilters && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[10px] p-4 mb-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Fuente del lead */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fuente del Lead
                  </label>
                  <Select value={String(filters.lead_source || '')} onValueChange={(v) => handleFilterChange('lead_source', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las fuentes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las fuentes</SelectItem>
                      {Object.entries(LEAD_SOURCES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Calidad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Calidad del Lead
                  </label>
                  <Select value={String(filters.quality_rating || '')} onValueChange={(v) => handleFilterChange('quality_rating', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las calidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las calidades</SelectItem>
                      {Object.entries(QUALITY_RATINGS).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor mínimo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Mínimo
                  </label>
                  <Input
                    type="number"
                    placeholder="Ej: 1000000"
                    value={String(filters.potential_value_min || '')}
                    onChange={(e) => handleFilterChange('potential_value_min', Number(e.target.value) || undefined)}
                  />
                </div>
              </div>

              {/* Filtros rápidos */}
              <div className="flex flex-wrap gap-3 mb-4 text-sm">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.active_only || false}
                    onChange={(e) => handleFilterChange('active_only', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Solo activos</span>
                </label>

                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.needing_follow_up || false}
                    onChange={(e) => handleFilterChange('needing_follow_up', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Requieren seguimiento</span>
                </label>

                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.high_value || false}
                    onChange={(e) => handleFilterChange('high_value', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Alto valor</span>
                </label>

                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.high_probability || false}
                    onChange={(e) => handleFilterChange('high_probability', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Alta probabilidad</span>
                </label>

                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.stale_leads || false}
                    onChange={(e) => handleFilterChange('stale_leads', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Leads estancados</span>
                </label>
              </div>

              {/* Botón limpiar filtros */}
              {hasActiveFilters() && (
                <Button onClick={clearFilters} color="light" size="sm" className="rounded-[10px]">
                  <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4 mr-2" />
                  Limpiar Filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Tabla responsive */}
      <Card>
        {/* Vista de tabla para desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Lead</Table.HeadCell>
              <Table.HeadCell>Seguro</Table.HeadCell>
              <Table.HeadCell>Etapa</Table.HeadCell>
              <Table.HeadCell>Valor</Table.HeadCell>
              <Table.HeadCell>Probabilidad</Table.HeadCell>
              <Table.HeadCell>Calidad</Table.HeadCell>
              <Table.HeadCell>Días en Etapa</Table.HeadCell>
              <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {leads.map((lead) => (
                <Table.Row key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <Table.Cell>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{lead.email}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{lead.phone}</div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {INSURANCE_TYPES[lead.insurance_type as keyof typeof INSURANCE_TYPES]}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-[10px] ${getStageColor(lead.stage)}`}>
                      {STAGES[lead.stage as keyof typeof STAGES]}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-gray-900 dark:text-white">
                    {formatCurrency(lead.potential_value)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: `${lead.close_probability}%` }}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{lead.close_probability}%</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-[10px] ${getQualityColor(lead.quality_rating)}`}>
                      {QUALITY_RATINGS[lead.quality_rating as keyof typeof QUALITY_RATINGS]}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-gray-900 dark:text-white">{lead.days_in_current_stage} días</Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <Dropdown
                        label=""
                        arrowIcon={false}
                        renderTrigger={() => (
                          <Button color="light" size="sm" className="h-9 w-9 p-0 rounded-[10px]">
                            <IconDots size={18} />
                          </Button>
                        )}
                      >
                        <Dropdown.Item onClick={() => handleAction(lead.id, 'view')}>
                          Ver detalles
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleAction(lead.id, 'edit')}>
                          Editar
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleAction(lead.id, 'contact')}>
                          Contactar
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleAction(lead.id, 'convert')}>
                          Convertir a cliente
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={() => handleAction(lead.id, 'delete')} className="text-red-600">
                          Eliminar
                        </Dropdown.Item>
                      </Dropdown>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {/* Vista de cards para móvil */}
        <div className="lg:hidden space-y-4 p-4">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-[10px] p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {lead.first_name} {lead.last_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{lead.email}</p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-[10px] ${getStageColor(lead.stage)}`}>
                  {STAGES[lead.stage as keyof typeof STAGES]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Seguro:</span>
                  <br />
                  <span className="text-gray-900 dark:text-white">
                    {INSURANCE_TYPES[lead.insurance_type as keyof typeof INSURANCE_TYPES]}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Valor:</span>
                  <br />
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(lead.potential_value)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Probabilidad:</span>
                  <br />
                  <span className="text-gray-900 dark:text-white">{lead.close_probability}%</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Días en etapa:</span>
                  <br />
                  <span className="text-gray-900 dark:text-white">{lead.days_in_current_stage} días</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-[10px] ${getQualityColor(lead.quality_rating)}`}>
                  {QUALITY_RATINGS[lead.quality_rating as keyof typeof QUALITY_RATINGS]}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAction(lead.id, 'view')}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAction(lead.id, 'edit')}
                    className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAction(lead.id, 'delete')}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAction(lead.id, 'contact')}
                    className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <Icon icon="solar:phone-bold-duotone" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {leads.length} de {statistics?.total_leads || 0} leads
              </div>
              <div className="flex items-center gap-2">
                <Button
                  color="light"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-[10px]"
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  color="light"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-[10px]"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!loading && leads.length === 0 && (
          <div className="text-center py-12">
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay leads</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasActiveFilters() ? 'No se encontraron leads con los filtros aplicados.' : 'Comienza creando tu primer lead.'}
            </p>
            <div className="mt-6">
              {hasActiveFilters() ? (
                <Button color="light" onClick={clearFilters} className="rounded-[10px]">Limpiar filtros</Button>
              ) : (
                <HeroButton icon="solar:user-plus-bold-duotone" onClick={() => navigate('/apps/seguros/embudo-ventas/nuevo')} size="lg">Crear Lead</HeroButton>
              )}
            </div>
          </div>
        )}

        {/* Estado de error */}
        {error && (
          <div className="text-center py-12">
            <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Error al cargar datos</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <div className="mt-6">
              <Button onClick={loadData} color="primary" className="rounded-[10px]">Reintentar</Button>
            </div>
          </div>
        )}
      </Card>
      {/* Modal de eliminación */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <Modal.Header>Eliminar Lead</Modal.Header>
        <Modal.Body>
          <div className="space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              ¿Seguro que deseas eliminar el lead
              {leadToDelete ? ` "${leadToDelete.first_name} ${leadToDelete.last_name}"` : ''}?
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
          <Button color="failure" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Spinner size="sm" className="mr-2" /> : null}
            Eliminar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EmbudoVentas; 
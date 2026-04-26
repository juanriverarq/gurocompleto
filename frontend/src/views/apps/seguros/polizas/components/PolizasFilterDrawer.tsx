import React, { useState, useEffect } from 'react';
import { Button, Drawer } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadcn-ui/Default-Ui/select';
import { PolizaFilters, polizaService } from 'src/services/polizaService';

interface PolizasFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PolizaFilters;
  onFiltersChange: (filters: PolizaFilters) => void;
}

const PolizasFilterDrawer: React.FC<PolizasFilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange
}) => {
  const [localFilters, setLocalFilters] = useState<PolizaFilters>(filters);
  const [cancellationReasons, setCancellationReasons] = useState<Array<{ key: string; label: string }>>([]);

  // Sincronizar con props cuando cambien
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    (async () => {
      const list = await polizaService.getCancellationReasons();
      setCancellationReasons(list || []);
    })();
  }, []);

  const handleFilterChange = (key: keyof PolizaFilters, value: string | number) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const applyFilters = () => {
    onFiltersChange({
      ...localFilters,
      page: 1 // Reset page when applying filters
    });
    onClose();
  };

  const resetFilters = () => {
    const defaultFilters: PolizaFilters = {
      search: '',
      aseguradora: '',
      ramo: '',
      estado: '',
      vendedor: '',
      fecha_inicio: '',
      fecha_fin: '',
      per_page: 15,
      page: 1,
      sort_field: 'created_at',
      sort_direction: 'desc'
    };
    
    setLocalFilters(defaultFilters);
  };

  // Contador de filtros activos
  const getActiveFiltersCount = () => {
    let count = 0;
    if (localFilters.search) count++;
    if (localFilters.aseguradora) count++;
    if (localFilters.ramo) count++;
    if (localFilters.estado) count++;
    if (localFilters.vendedor) count++;
    if (localFilters.fecha_inicio) count++;
    if (localFilters.fecha_fin) count++;
    if (localFilters.renovable !== undefined && localFilters.renovable !== '') count++;
    if (localFilters.fecha_recepcion_desde) count++;
    if (localFilters.fecha_recepcion_hasta) count++;
    if (localFilters.cancellation_reason) count++;
    return count;
  };

  const aseguradoras = [
    'Seguros Sura', 'Mapfre', 'Bolívar Seguros', 'La Previsora', 'AXA Colpatria',
    'Allianz', 'Liberty Seguros', 'Solidaria', 'La Equidad', 'Mundial'
  ];

  const tiposSeguro = [
    { value: 'vida', label: 'Vida' },
    { value: 'automovil', label: 'Automóvil' },
    { value: 'hogar', label: 'Hogar' },
    { value: 'salud', label: 'Salud' },
    { value: 'empresarial', label: 'Empresarial' },
    { value: 'soat', label: 'SOAT' },
    { value: 'responsabilidad_civil', label: 'Responsabilidad Civil' },
    { value: 'todo_riesgo', label: 'Todo Riesgo' },
    { value: 'incendio', label: 'Incendio' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'accidentes', label: 'Accidentes Personales' }
  ];

  const estadosPoliza = [
    { value: 'ACTIVA', label: 'Activa' },
    { value: 'VENCIDA', label: 'Vencida' },
    { value: 'CANCELADA', label: 'Cancelada' },
    { value: 'SUSPENDIDA', label: 'Suspendida' },
    { value: 'POR_VENCER', label: 'Por Vencer' }
  ];

  return (
    <Drawer open={isOpen} onClose={onClose} position="right" className="w-full max-w-lg">
      <Drawer.Items className="p-0">
        <div className="h-full flex flex-col">
          {/* Header personalizado */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Icon icon="solar:filter-bold" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filtros Avanzados
                </h2>
                {getActiveFiltersCount() > 0 && (
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {getActiveFiltersCount()} filtro{getActiveFiltersCount() > 1 ? 's' : ''} activo{getActiveFiltersCount() > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
            </button>
          </div>
          
                    {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto px-4">
            {/* Información de filtros activos */}
            {getActiveFiltersCount() > 0 && (
              <div className="mt-0 mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      {getActiveFiltersCount()} filtro{getActiveFiltersCount() > 1 ? 's' : ''} activo{getActiveFiltersCount() > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Búsqueda General */}
            <div className="mt-0 mb-6 space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:magnifer-bold" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Búsqueda General
              </h3>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Buscar en pólizas
              </Label>
              <Input
                id="search"
                placeholder="Número de póliza, cliente, aseguradora..."
                value={localFilters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Filtros Principales */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:settings-bold" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Filtros Principales
              </h3>
            </div>
            
            <div className="grid gap-4">
              {/* Aseguradora */}
              <div className="space-y-2">
                <Label htmlFor="aseguradora" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Aseguradora
                </Label>
                 <Select value={localFilters.aseguradora || 'all'} onValueChange={(value) => handleFilterChange('aseguradora', value === 'all' ? '' : value)}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Seleccionar aseguradora" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todas las aseguradoras</SelectItem>
                     {aseguradoras.map(aseg => (
                       <SelectItem key={aseg} value={aseg}>{aseg}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

              {/* Ramo */}
              <div className="space-y-2">
                <Label htmlFor="ramo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ramo del Seguro
                </Label>
                 <Select value={localFilters.ramo || 'all'} onValueChange={(value) => handleFilterChange('ramo', value === 'all' ? '' : value)}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Seleccionar ramo" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todos los ramos</SelectItem>
                     {tiposSeguro.map(tipo => (
                       <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

              {/* Estado */}
              <div className="space-y-2">
                <Label htmlFor="estado" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estado de la Póliza
                </Label>
                 <Select value={localFilters.estado || 'all'} onValueChange={(value) => handleFilterChange('estado', value === 'all' ? '' : value)}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Seleccionar estado" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todos los estados</SelectItem>
                     {estadosPoliza.map(estado => (
                       <SelectItem key={estado.value} value={estado.value}>{estado.label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

              {/* Motivo de cancelación (solo útil cuando el estado es CANCELADA, pero se permite filtrar libre) */}
              <div className="space-y-2">
                <Label htmlFor="cancellation_reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Motivo de cancelación
                </Label>
                <Select
                  value={localFilters.cancellation_reason || 'all'}
                  onValueChange={(value) => handleFilterChange('cancellation_reason', value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Cualquier motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier motivo</SelectItem>
                    {cancellationReasons.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-500 dark:text-gray-500">
                  Aplica solo a pólizas canceladas. Filtra por el motivo que registraste al cancelar.
                </p>
              </div>
            </div>
          </div>

          {/* Filtros Adicionales */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:user-id-bold" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Filtros Adicionales
              </h3>
            </div>
            
            <div className="grid gap-4">
              {/* Vendedor */}
              <div className="space-y-2">
                <Label htmlFor="vendedor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Agente Vendedor
                </Label>
                <Input
                  id="vendedor"
                  placeholder="Nombre del vendedor"
                  value={localFilters.vendedor || ''}
                  onChange={(e) => handleFilterChange('vendedor', e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Renovable */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Renovable</Label>
                <Select value={(localFilters.renovable as string) || 'all'} onValueChange={(value) => handleFilterChange('renovable', value === 'all' ? '' : value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filtrar por renovable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              
            </div>
          </div>

          {/* Filtros de Fecha */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:calendar-bold" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Rango de Fechas
              </h3>
            </div>
            
            <div className="grid gap-4">
              {/* Fecha Inicio */}
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha de Inicio Desde
                </Label>
                <Input
                  id="fecha_inicio"
                  type="date"
                  value={localFilters.fecha_inicio || ''}
                  onChange={(e) => handleFilterChange('fecha_inicio', e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Fecha Fin */}
              <div className="space-y-2">
                <Label htmlFor="fecha_fin" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha de Inicio Hasta
                </Label>
                <Input
                  id="fecha_fin"
                  type="date"
                  value={localFilters.fecha_fin || ''}
                  onChange={(e) => handleFilterChange('fecha_fin', e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Fechas de Recepción */}
              <div className="space-y-2">
                <Label htmlFor="fecha_recepcion_desde" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha de Recepción Desde
                </Label>
                <Input
                  id="fecha_recepcion_desde"
                  type="date"
                  value={localFilters.fecha_recepcion_desde || ''}
                  onChange={(e) => handleFilterChange('fecha_recepcion_desde', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_recepcion_hasta" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha de Recepción Hasta
                </Label>
                <Input
                  id="fecha_recepcion_hasta"
                  type="date"
                  value={localFilters.fecha_recepcion_hasta || ''}
                  onChange={(e) => handleFilterChange('fecha_recepcion_hasta', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Botones de Acción - Fijos abajo */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="space-y-3">
              <Button
                onClick={applyFilters}
                className="w-full"
                size="sm"
                color="blue"
              >
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                Aplicar Filtros
                {getActiveFiltersCount() > 0 && (
                  <span className="ml-2 bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {getActiveFiltersCount()}
                  </span>
                )}
              </Button>
              
              <Button
                onClick={resetFilters}
                className="w-full"
                size="sm"
                color="gray"
                outline
              >
                <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Drawer.Items>
    </Drawer>
  );
};

export default PolizasFilterDrawer; 
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Badge, Spinner, Checkbox } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadcn-ui/Default-Ui/select';
import { RadioGroup, RadioGroupItem } from 'src/components/shadcn-ui/Default-Ui/radio-group';
import { PolizaFilters, polizaService } from 'src/services/polizaService';
import { toast } from 'src/hooks/use-toast';
import { useVendedores } from 'src/hooks/useAdminCrudApi';

// Definición de columnas disponibles para exportar
const EXPORT_COLUMNS = [
  { id: 'numero_poliza', label: 'Número Póliza', default: true },
  { id: 'cliente', label: 'Cliente', default: true },
  { id: 'documento_cliente', label: 'Documento Cliente', default: true },
  { id: 'aseguradora', label: 'Aseguradora', default: true },
  { id: 'ramo', label: 'Ramo', default: true },
  { id: 'estado', label: 'Estado', default: true },
  { id: 'prima_neta', label: 'Prima Neta', default: true },
  { id: 'iva', label: 'IVA', default: false },
  { id: 'total', label: 'Total', default: false },
  { id: 'fecha_inicio', label: 'Fecha Inicio', default: true },
  { id: 'fecha_fin', label: 'Fecha Fin', default: true },
  { id: 'fecha_expedicion', label: 'Fecha Expedición', default: true },
  { id: 'fecha_recepcion', label: 'Fecha Recepción', default: true },
  { id: 'comision', label: 'Comisión', default: true },
  { id: 'porcentaje_comision', label: '% Comisión', default: false },
  { id: 'estado_pago', label: 'Estado Pago', default: true },
  { id: 'vendedor', label: 'Vendedor', default: true },
  { id: 'forma_pago', label: 'Forma de Pago', default: false },
  { id: 'periodicidad', label: 'Periodicidad', default: false },
  { id: 'valor_asegurado', label: 'Valor Asegurado', default: false },
  { id: 'telefono_cliente', label: 'Teléfono Cliente', default: false },
  { id: 'email_cliente', label: 'Email Cliente', default: false },
  { id: 'observaciones', label: 'Observaciones', default: true },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: PolizaFilters;
}

const PolizasExportModal: React.FC<Props> = ({ isOpen, onClose, currentFilters }) => {
  const [exporting, setExporting] = useState(false);
  const [formato, setFormato] = useState<'excel' | 'csv'>('excel');
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [exportFilters, setExportFilters] = useState<PolizaFilters>(currentFilters);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EXPORT_COLUMNS.filter(c => c.default).map(c => c.id)
  );
  
  // Obtener lista de vendedores
  const { vendedores, loading: loadingVendedores } = useVendedores();

  useEffect(() => {
    if (isOpen) {
      setExportFilters(currentFilters);
      setUseCurrentFilters(true);
    }
  }, [isOpen, currentFilters]);

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(EXPORT_COLUMNS.map(c => c.id));
  };

  const selectDefaultColumns = () => {
    setSelectedColumns(EXPORT_COLUMNS.filter(c => c.default).map(c => c.id));
  };

  const activeFiltersCount = useMemo(() => {
    const filters = useCurrentFilters ? currentFilters : exportFilters;
    let count = 0;
    if (filters.search) count++;
    if (filters.aseguradora) count++;
    if (filters.ramo) count++;
    if (filters.estado) count++;
    if (filters.vendedor) count++;
    if (filters.fecha_inicio) count++;
    if (filters.fecha_fin) count++;
    if (filters.renovable !== undefined && filters.renovable !== '') count++;
    if (filters.fecha_recepcion_desde) count++;
    if (filters.fecha_recepcion_hasta) count++;
    return count;
  }, [useCurrentFilters, currentFilters, exportFilters]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const filtersToUse = useCurrentFilters ? currentFilters : exportFilters;

      // Remover campos de paginación para exportar todos los datos
      const exportFiltersClean: Record<string, any> = {};
      
      // Solo incluir filtros que tengan valor
      Object.entries(filtersToUse).forEach(([key, value]) => {
        if (
          value !== undefined && 
          value !== null && 
          value !== '' &&
          key !== 'page' &&
          key !== 'per_page' &&
          key !== 'sort_field' &&
          key !== 'sort_direction'
        ) {
          exportFiltersClean[key] = value;
        }
      });

      // Agregar columnas seleccionadas
      if (selectedColumns.length > 0) {
        exportFiltersClean.columnas = selectedColumns.join(',');
      }

      console.log('Exportando con filtros:', exportFiltersClean);

      const blob = await polizaService.exportarPolizas(exportFiltersClean as PolizaFilters & { columnas?: string }, formato);

      // Verificar que el blob tenga contenido
      if (!blob || blob.size === 0) {
        throw new Error('El archivo exportado está vacío. Verifica los filtros aplicados.');
      }

      // Crear URL para descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polizas_${new Date().toISOString().split('T')[0]}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportación completada",
        description: `Las pólizas han sido exportadas en formato ${formato.toUpperCase()}.`,
      });

      onClose();
    } catch (error) {
      console.error('Error en exportación:', error);
      toast({
        variant: "destructive",
        title: "Error en la exportación",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setExporting(false);
    }
  };

  const setFilter = (key: keyof PolizaFilters, value: any) => {
    setExportFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setExportFilters({
      search: '',
      aseguradora: '',
      ramo: '',
      estado: '',
      vendedor: '',
      fecha_inicio: '',
      fecha_fin: '',
      fecha_recepcion_desde: '',
      fecha_recepcion_hasta: '',
      renovable: '',
    });
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:download-bold-duotone" className="w-5 h-5 text-green-600" />
          <span>Exportar Pólizas</span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-6">
          {/* Formato de exportación */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Formato de exportación</Label>
            <Select value={formato} onValueChange={(value: 'excel' | 'csv') => setFormato(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:file-bold" className="w-4 h-4" />
                    Excel (.xlsx)
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:file-text-bold" className="w-4 h-4" />
                    CSV (.csv)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opción de filtros */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Filtros a aplicar</Label>

            <RadioGroup
              value={useCurrentFilters ? 'current' : 'custom'}
              onValueChange={(v) => setUseCurrentFilters(v === 'current')}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="current-filters" value="current" />
                <Label htmlFor="current-filters" className="text-sm cursor-pointer">
                  Usar filtros actuales
                  {activeFiltersCount > 0 && (
                    <Badge color="info" className="ml-2 text-xs">
                      {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} activo{activeFiltersCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <RadioGroupItem id="custom-filters" value="custom" />
                <Label htmlFor="custom-filters" className="text-sm cursor-pointer">
                  Configurar filtros personalizados
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filtros personalizados */}
          {!useCurrentFilters && (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 space-y-4 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between sticky top-0 bg-gray-50 dark:bg-gray-800 pb-2">
                <h4 className="text-sm font-medium">Filtros personalizados</h4>
                <Button size="xs" color="light" onClick={resetFilters}>
                  <Icon icon="solar:refresh-bold" className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              </div>

              {/* Filtros principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Aseguradora</Label>
                  <Select
                    value={exportFilters.aseguradora || 'all'}
                    onValueChange={(v) => setFilter('aseguradora', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Seguros Sura">Seguros Sura</SelectItem>
                      <SelectItem value="Mapfre">Mapfre</SelectItem>
                      <SelectItem value="Bolívar Seguros">Bolívar Seguros</SelectItem>
                      <SelectItem value="La Previsora">La Previsora</SelectItem>
                      <SelectItem value="AXA Colpatria">AXA Colpatria</SelectItem>
                      <SelectItem value="Allianz">Allianz</SelectItem>
                      <SelectItem value="Liberty Seguros">Liberty Seguros</SelectItem>
                      <SelectItem value="Solidaria">Solidaria</SelectItem>
                      <SelectItem value="La Equidad">La Equidad</SelectItem>
                      <SelectItem value="Mundial">Mundial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Ramo</Label>
                  <Select
                    value={exportFilters.ramo || 'all'}
                    onValueChange={(v) => setFilter('ramo', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="vida">Vida</SelectItem>
                      <SelectItem value="automovil">Automóvil</SelectItem>
                      <SelectItem value="hogar">Hogar</SelectItem>
                      <SelectItem value="salud">Salud</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                      <SelectItem value="soat">SOAT</SelectItem>
                      <SelectItem value="responsabilidad_civil">Responsabilidad Civil</SelectItem>
                      <SelectItem value="todo_riesgo">Todo Riesgo</SelectItem>
                      <SelectItem value="incendio">Incendio</SelectItem>
                      <SelectItem value="transporte">Transporte</SelectItem>
                      <SelectItem value="accidentes">Accidentes Personales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select
                    value={exportFilters.estado || 'all'}
                    onValueChange={(v) => setFilter('estado', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ACTIVA">Activa</SelectItem>
                      <SelectItem value="VENCIDA">Vencida</SelectItem>
                      <SelectItem value="CANCELADA">Cancelada</SelectItem>
                      <SelectItem value="SUSPENDIDA">Suspendida</SelectItem>
                      <SelectItem value="POR_VENCER">Por Vencer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Renovable</Label>
                  <Select
                    value={(exportFilters.renovable as string) || 'all'}
                    onValueChange={(v) => setFilter('renovable', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sí</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Vendedor</Label>
                  <Select
                    value={exportFilters.vendedor || 'all'}
                    onValueChange={(v) => setFilter('vendedor', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={loadingVendedores ? "Cargando..." : "Todos los vendedores"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {vendedores.map((v) => (
                        <SelectItem key={v.id} value={v.nombres || ''}>
                          {v.nombres}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fechas de vigencia */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
                  Fechas de Vigencia
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input
                      type="date"
                      value={exportFilters.fecha_inicio || ''}
                      onChange={(e) => setFilter('fecha_inicio', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input
                      type="date"
                      value={exportFilters.fecha_fin || ''}
                      onChange={(e) => setFilter('fecha_fin', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Fechas de recepción */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
                  Fechas de Recepción
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input
                      type="date"
                      value={exportFilters.fecha_recepcion_desde || ''}
                      onChange={(e) => setFilter('fecha_recepcion_desde', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input
                      type="date"
                      value={exportFilters.fecha_recepcion_hasta || ''}
                      onChange={(e) => setFilter('fecha_recepcion_hasta', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selección de columnas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columnas a exportar</Label>
              <div className="flex gap-2">
                <Button size="xs" color="light" onClick={selectAllColumns}>
                  Todas
                </Button>
                <Button size="xs" color="light" onClick={selectDefaultColumns}>
                  Por defecto
                </Button>
              </div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {EXPORT_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded">
                    <Checkbox
                      checked={selectedColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                      className="w-3 h-3"
                    />
                    <span className={selectedColumns.includes(col.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {selectedColumns.length} de {EXPORT_COLUMNS.length} columnas seleccionadas
            </p>
          </div>

          {/* Información */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Información de exportación</p>
                <ul className="space-y-0.5">
                  <li>• Se exportarán todas las pólizas que coincidan con los filtros</li>
                  <li>• Solo se incluirán las columnas seleccionadas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-full flex items-center justify-between">
          <Button color="light" onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button
            color="success"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Spinner size="sm" />
                Exportando...
              </>
            ) : (
              <>
                <Icon icon="solar:download-bold" className="w-4 h-4" />
                Exportar {formato.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PolizasExportModal;
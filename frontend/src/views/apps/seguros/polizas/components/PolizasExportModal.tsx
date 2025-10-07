import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Badge, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
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

  useEffect(() => {
    if (isOpen) {
      setExportFilters(currentFilters);
      setUseCurrentFilters(true);
    }
  }, [isOpen, currentFilters]);

  const activeFiltersCount = useMemo(() => {
    if (useCurrentFilters) {
      let count = 0;
      if (currentFilters.search) count++;
      if (currentFilters.aseguradora) count++;
      if (currentFilters.ramo) count++;
      if (currentFilters.estado) count++;
      if (currentFilters.vendedor) count++;
      if (currentFilters.sede) count++;
      if (currentFilters.fecha_inicio) count++;
      if (currentFilters.fecha_fin) count++;
      if (currentFilters.renovable !== undefined && currentFilters.renovable !== '') count++;
      if (currentFilters.fecha_recepcion_desde) count++;
      if (currentFilters.fecha_recepcion_hasta) count++;
      return count;
    } else {
      let count = 0;
      if (exportFilters.search) count++;
      if (exportFilters.aseguradora) count++;
      if (exportFilters.ramo) count++;
      if (exportFilters.estado) count++;
      if (exportFilters.vendedor) count++;
      if (exportFilters.sede) count++;
      if (exportFilters.fecha_inicio) count++;
      if (exportFilters.fecha_fin) count++;
      if (exportFilters.renovable !== undefined && exportFilters.renovable !== '') count++;
      if (exportFilters.fecha_recepcion_desde) count++;
      if (exportFilters.fecha_recepcion_hasta) count++;
      return count;
    }
  }, [useCurrentFilters, currentFilters, exportFilters]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const filtersToUse = useCurrentFilters ? currentFilters : exportFilters;

      // Remover campos de paginación para exportar todos los datos
      const exportFiltersClean = { ...filtersToUse };
      delete exportFiltersClean.page;
      delete exportFiltersClean.per_page;
      delete exportFiltersClean.sort_field;
      delete exportFiltersClean.sort_direction;

      const blob = await polizaService.exportarPolizas(exportFiltersClean, formato);

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
      sede: '',
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
            <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Filtros personalizados</h4>
                <Button size="xs" color="light" onClick={resetFilters}>
                  <Icon icon="solar:refresh-bold" className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Aseguradora</Label>
                  <Select
                    value={exportFilters.aseguradora || 'all'}
                    onValueChange={(v) => setFilter('aseguradora', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2">
                  <Label className="text-xs">Ramo</Label>
                  <Select
                    value={exportFilters.ramo || 'all'}
                    onValueChange={(v) => setFilter('ramo', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2">
                  <Label className="text-xs">Estado</Label>
                  <Select
                    value={exportFilters.estado || 'all'}
                    onValueChange={(v) => setFilter('estado', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2">
                  <Label className="text-xs">Renovable</Label>
                  <Select
                    value={(exportFilters.renovable as string) || 'all'}
                    onValueChange={(v) => setFilter('renovable', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
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
          )}

          {/* Información */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Información de exportación</p>
                <ul className="space-y-1 text-xs">
                  <li>• Se exportarán todas las pólizas que coincidan con los filtros seleccionados</li>
                  <li>• El archivo incluirá información completa de pólizas, clientes y fechas</li>
                  <li>• Los archivos Excel incluyen formato y validaciones</li>
                  <li>• Los archivos CSV usan separador de punto y coma (;)</li>
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
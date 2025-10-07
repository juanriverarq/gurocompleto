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
import type { SiniestroFilters as ServiceSiniestroFilters } from 'src/services/siniestroService';
import { siniestroService } from 'src/services/siniestroService';
import { toast } from 'src/hooks/use-toast';

interface UISiniestroFilters {
  search?: string;
  estado?: string;
  tipo_seguro?: string;
  tipo_siniestro?: string;
  prioridad?: string;
  aseguradora?: string;
  assigned_adjuster_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  monto_min?: string;
  monto_max?: string;
  active_only?: boolean;
  needing_attention?: boolean;
  overdue?: boolean;
  high_value?: boolean;
  with_terceros?: boolean;
  with_heridos?: boolean;
  critical_only?: boolean;
  recently_reported?: boolean;
}

const defaultSiniestroFilters: UISiniestroFilters = {
  search: '',
  estado: '',
  tipo_seguro: '',
  tipo_siniestro: '',
  prioridad: '',
  aseguradora: '',
  assigned_adjuster_id: '',
  fecha_desde: '',
  fecha_hasta: '',
  monto_min: '',
  monto_max: '',
  active_only: false,
  needing_attention: false,
  overdue: false,
  high_value: false,
  with_terceros: false,
  with_heridos: false,
  critical_only: false,
  recently_reported: false,
};

const toUiFilters = (
  f: Partial<UISiniestroFilters> | ServiceSiniestroFilters | undefined
): UISiniestroFilters => ({
  search: (f as any)?.search ?? '',
  estado: (f as any)?.estado ?? '',
  tipo_seguro: (f as any)?.tipo_seguro ?? '',
  tipo_siniestro: (f as any)?.tipo_siniestro ?? '',
  prioridad: (f as any)?.prioridad ?? '',
  aseguradora: (f as any)?.aseguradora ?? '',
  assigned_adjuster_id:
    (f as any)?.assigned_adjuster_id != null ? String((f as any).assigned_adjuster_id) : '',
  fecha_desde: (f as any)?.fecha_desde ?? '',
  fecha_hasta: (f as any)?.fecha_hasta ?? '',
  monto_min: (f as any)?.monto_min != null ? String((f as any).monto_min) : '',
  monto_max: (f as any)?.monto_max != null ? String((f as any).monto_max) : '',
  active_only: !!(f as any)?.active_only,
  needing_attention: !!(f as any)?.needing_attention,
  overdue: !!(f as any)?.overdue,
  high_value: !!(f as any)?.high_value,
  with_terceros: !!(f as any)?.with_terceros,
  with_heridos: !!(f as any)?.with_heridos,
  critical_only: !!(f as any)?.critical_only,
  recently_reported: !!(f as any)?.recently_reported,
});


interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: UISiniestroFilters | ServiceSiniestroFilters;
}

const SiniestrosExportModal: React.FC<Props> = ({ isOpen, onClose, currentFilters }) => {
  const [exporting, setExporting] = useState(false);
  const [formato, setFormato] = useState<'excel' | 'csv'>('excel');
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [exportFilters, setExportFilters] = useState<UISiniestroFilters>(
    currentFilters ? toUiFilters(currentFilters) : defaultSiniestroFilters
  );

  useEffect(() => {
    if (isOpen) {
      setExportFilters(currentFilters ? toUiFilters(currentFilters) : defaultSiniestroFilters);
      setUseCurrentFilters(true);
    }
  }, [isOpen, currentFilters]);

  const activeFiltersCount = useMemo(() => {
    const src = useCurrentFilters
      ? toUiFilters((currentFilters ?? defaultSiniestroFilters) as any)
      : (exportFilters ?? defaultSiniestroFilters);

    let count = 0;
    if (src.search) count++;
    if (src.estado) count++;
    if (src.tipo_seguro) count++;
    if (src.tipo_siniestro) count++;
    if (src.prioridad) count++;
    if (src.aseguradora) count++;
    if (src.assigned_adjuster_id) count++;
    if (src.fecha_desde) count++;
    if (src.fecha_hasta) count++;
    if (src.monto_min) count++;
    if (src.monto_max) count++;
    if (src.active_only) count++;
    if (src.needing_attention) count++;
    if (src.overdue) count++;
    if (src.high_value) count++;
    if (src.with_terceros) count++;
    if (src.with_heridos) count++;
    if (src.critical_only) count++;
    if (src.recently_reported) count++;
    return count;
  }, [useCurrentFilters, currentFilters, exportFilters]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const f = (useCurrentFilters ? currentFilters : exportFilters) ?? defaultSiniestroFilters;

      const normalized: ServiceSiniestroFilters = {
        search: f.search || undefined,
        estado: f.estado || undefined,
        tipo_seguro: f.tipo_seguro || undefined,
        tipo_siniestro: f.tipo_siniestro || undefined,
        prioridad: f.prioridad || undefined,
        aseguradora: f.aseguradora || undefined,
        assigned_adjuster_id: f.assigned_adjuster_id ? Number(f.assigned_adjuster_id) : undefined,
        fecha_desde: f.fecha_desde || undefined,
        fecha_hasta: f.fecha_hasta || undefined,
        monto_min: f.monto_min ? Number(f.monto_min) : undefined,
        monto_max: f.monto_max ? Number(f.monto_max) : undefined,
        active_only: f.active_only,
        needing_attention: f.needing_attention,
        overdue: f.overdue,
        high_value: f.high_value,
        with_terceros: f.with_terceros,
        with_heridos: f.with_heridos,
        critical_only: f.critical_only,
        recently_reported: f.recently_reported,
      };

      await siniestroService.exportarSiniestros(normalized, formato);

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

  const setFilter = (key: keyof UISiniestroFilters, value: any) => {
    setExportFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setExportFilters(defaultSiniestroFilters);
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:download-bold-duotone" className="w-5 h-5 text-green-600" />
          <span>Exportar Siniestros</span>
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
                      <SelectItem value="reportado">Reportado</SelectItem>
                      <SelectItem value="asignado">Asignado</SelectItem>
                      <SelectItem value="en_revision">En Revisión</SelectItem>
                      <SelectItem value="investigacion">Investigación</SelectItem>
                      <SelectItem value="peritaje">Peritaje</SelectItem>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                      <SelectItem value="cerrado">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Seguro</Label>
                  <Select
                    value={exportFilters.tipo_seguro || 'all'}
                    onValueChange={(v) => setFilter('tipo_seguro', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="auto">Automóvil</SelectItem>
                      <SelectItem value="hogar">Hogar</SelectItem>
                      <SelectItem value="vida">Vida</SelectItem>
                      <SelectItem value="salud">Salud</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                      <SelectItem value="responsabilidad_civil">Responsabilidad Civil</SelectItem>
                      <SelectItem value="transporte">Transporte</SelectItem>
                      <SelectItem value="construccion">Construcción</SelectItem>
                      <SelectItem value="agropecuario">Agropecuario</SelectItem>
                      <SelectItem value="fianza">Fianza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Siniestro</Label>
                  <Select
                    value={exportFilters.tipo_siniestro || 'all'}
                    onValueChange={(v) => setFilter('tipo_siniestro', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="colision">Colisión</SelectItem>
                      <SelectItem value="robo_total">Robo Total</SelectItem>
                      <SelectItem value="robo_parcial">Robo Parcial</SelectItem>
                      <SelectItem value="incendio">Incendio</SelectItem>
                      <SelectItem value="vandalismo">Vandalismo</SelectItem>
                      <SelectItem value="fenomenos_naturales">Fenómenos Naturales</SelectItem>
                      <SelectItem value="accidente_laboral">Accidente Laboral</SelectItem>
                      <SelectItem value="responsabilidad_civil">Responsabilidad Civil</SelectItem>
                      <SelectItem value="daños_terceros">Daños a Terceros</SelectItem>
                      <SelectItem value="muerte">Muerte</SelectItem>
                      <SelectItem value="incapacidad">Incapacidad</SelectItem>
                      <SelectItem value="enfermedad">Enfermedad</SelectItem>
                      <SelectItem value="hospitalizacion">Hospitalización</SelectItem>
                      <SelectItem value="cirugia">Cirugía</SelectItem>
                      <SelectItem value="daños_agua">Daños por Agua</SelectItem>
                      <SelectItem value="explosion">Explosión</SelectItem>
                      <SelectItem value="terremoto">Terremoto</SelectItem>
                      <SelectItem value="inundacion">Inundación</SelectItem>
                      <SelectItem value="granizo">Granizo</SelectItem>
                      <SelectItem value="vientos_fuertes">Vientos Fuertes</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Prioridad</Label>
                  <Select
                    value={exportFilters.prioridad || 'all'}
                    onValueChange={(v) => setFilter('prioridad', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Fecha desde</Label>
                  <input
                    type="date"
                    value={exportFilters.fecha_desde || ''}
                    onChange={(e) => setFilter('fecha_desde', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Fecha hasta</Label>
                  <input
                    type="date"
                    value={exportFilters.fecha_hasta || ''}
                    onChange={(e) => setFilter('fecha_hasta', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Monto mínimo</Label>
                  <input
                    type="number"
                    min="0"
                    value={exportFilters.monto_min || ''}
                    onChange={(e) => setFilter('monto_min', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Monto máximo</Label>
                  <input
                    type="number"
                    min="0"
                    value={exportFilters.monto_max || ''}
                    onChange={(e) => setFilter('monto_max', e.target.value)}
                    placeholder="10000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Filtros especiales</Label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.active_only || false}
                      onChange={(e) => setFilter('active_only', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Solo activos
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.needing_attention || false}
                      onChange={(e) => setFilter('needing_attention', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Necesitan atención
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.overdue || false}
                      onChange={(e) => setFilter('overdue', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Vencidos
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.high_value || false}
                      onChange={(e) => setFilter('high_value', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Alto valor
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.with_terceros || false}
                      onChange={(e) => setFilter('with_terceros', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Con terceros
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.with_heridos || false}
                      onChange={(e) => setFilter('with_heridos', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Con heridos
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.critical_only || false}
                      onChange={(e) => setFilter('critical_only', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Solo críticos
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFilters.recently_reported || false}
                      onChange={(e) => setFilter('recently_reported', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Recientemente reportados
                  </label>
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
                  <li>• Se exportarán todos los siniestros que coincidan con los filtros seleccionados</li>
                  <li>• El archivo incluirá información completa de siniestros, clientes, pólizas y montos</li>
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

export default SiniestrosExportModal;
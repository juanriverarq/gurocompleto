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
import { clienteService } from 'src/services/clienteService';
import { toast } from 'src/hooks/use-toast';

interface ClienteFilters {
  search?: string;
  tipo?: string;
  tipo_documento?: string;
  estado?: string;
  ciudad?: string;
  departamento?: string;
  priority?: string;
  genero?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  edad_min?: string;
  edad_max?: string;
  client_type?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: ClienteFilters;
}

const ClientesExportModal: React.FC<Props> = ({ isOpen, onClose, currentFilters }) => {
  const [exporting, setExporting] = useState(false);
  const [formato, setFormato] = useState<'excel' | 'csv'>('excel');
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [exportFilters, setExportFilters] = useState<ClienteFilters>(currentFilters);

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
      if (currentFilters.tipo || currentFilters.tipo_documento) count++;
      if (currentFilters.estado) count++;
      if (currentFilters.ciudad) count++;
      if (currentFilters.departamento) count++;
      if (currentFilters.priority) count++;
      if (currentFilters.genero) count++;
      if (currentFilters.fecha_desde) count++;
      if (currentFilters.fecha_hasta) count++;
      if (currentFilters.edad_min) count++;
      if (currentFilters.edad_max) count++;
      if (currentFilters.client_type) count++;
      return count;
    } else {
      let count = 0;
      if (exportFilters.search) count++;
      if (exportFilters.tipo || exportFilters.tipo_documento) count++;
      if (exportFilters.estado) count++;
      if (exportFilters.ciudad) count++;
      if (exportFilters.departamento) count++;
      if (exportFilters.priority) count++;
      if (exportFilters.genero) count++;
      if (exportFilters.fecha_desde) count++;
      if (exportFilters.fecha_hasta) count++;
      if (exportFilters.edad_min) count++;
      if (exportFilters.edad_max) count++;
      if (exportFilters.client_type) count++;
      return count;
    }
  }, [useCurrentFilters, currentFilters, exportFilters]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const filtersToUse = useCurrentFilters ? currentFilters : exportFilters;

      await clienteService.exportarClientes(filtersToUse, formato);

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

  const setFilter = (key: keyof ClienteFilters, value: any) => {
    setExportFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setExportFilters({
      search: '',
      tipo: '',
      tipo_documento: '',
      estado: '',
      ciudad: '',
      departamento: '',
      priority: '',
      genero: '',
      fecha_desde: '',
      fecha_hasta: '',
      edad_min: '',
      edad_max: '',
      client_type: '',
    });
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:download-bold-duotone" className="w-5 h-5 text-green-600" />
          <span>Exportar Clientes</span>
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
                  <Label className="text-xs">Tipo de Cliente</Label>
                  <Select
                    value={exportFilters.client_type || 'all'}
                    onValueChange={(v) => setFilter('client_type', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="persona">Persona</SelectItem>
                      <SelectItem value="empresa">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Documento</Label>
                  <Select
                    value={exportFilters.tipo_documento || exportFilters.tipo || 'all'}
                    onValueChange={(v) => setFilter('tipo_documento', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                      <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                      <SelectItem value="PAS">Pasaporte</SelectItem>
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
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="prospect">Prospecto</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Género</Label>
                  <Select
                    value={exportFilters.genero || 'all'}
                    onValueChange={(v) => setFilter('genero', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="O">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Prioridad</Label>
                  <Select
                    value={exportFilters.priority || 'all'}
                    onValueChange={(v) => setFilter('priority', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Ciudad</Label>
                  <Select
                    value={exportFilters.ciudad || 'all'}
                    onValueChange={(v) => setFilter('ciudad', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Bogotá">Bogotá</SelectItem>
                      <SelectItem value="Medellín">Medellín</SelectItem>
                      <SelectItem value="Cali">Cali</SelectItem>
                      <SelectItem value="Barranquilla">Barranquilla</SelectItem>
                      <SelectItem value="Cartagena">Cartagena</SelectItem>
                      <SelectItem value="Cúcuta">Cúcuta</SelectItem>
                      <SelectItem value="Bucaramanga">Bucaramanga</SelectItem>
                      <SelectItem value="Pereira">Pereira</SelectItem>
                      <SelectItem value="Santa Marta">Santa Marta</SelectItem>
                      <SelectItem value="Ibagué">Ibagué</SelectItem>
                      <SelectItem value="Pasto">Pasto</SelectItem>
                      <SelectItem value="Manizales">Manizales</SelectItem>
                      <SelectItem value="Neiva">Neiva</SelectItem>
                      <SelectItem value="Villavicencio">Villavicencio</SelectItem>
                      <SelectItem value="Armenia">Armenia</SelectItem>
                      <SelectItem value="Popayán">Popayán</SelectItem>
                      <SelectItem value="Sincelejo">Sincelejo</SelectItem>
                      <SelectItem value="Valledupar">Valledupar</SelectItem>
                      <SelectItem value="Montería">Montería</SelectItem>
                      <SelectItem value="Tunja">Tunja</SelectItem>
                      <SelectItem value="Florencia">Florencia</SelectItem>
                      <SelectItem value="Yopal">Yopal</SelectItem>
                      <SelectItem value="Riohacha">Riohacha</SelectItem>
                      <SelectItem value="Quibdó">Quibdó</SelectItem>
                      <SelectItem value="Arauca">Arauca</SelectItem>
                      <SelectItem value="Mocoa">Mocoa</SelectItem>
                      <SelectItem value="San Andrés">San Andrés</SelectItem>
                      <SelectItem value="Leticia">Leticia</SelectItem>
                      <SelectItem value="Mitú">Mitú</SelectItem>
                      <SelectItem value="Puerto Carreño">Puerto Carreño</SelectItem>
                      <SelectItem value="Inírida">Inírida</SelectItem>
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
                  <Label className="text-xs">Edad mínima</Label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={exportFilters.edad_min || ''}
                    onChange={(e) => setFilter('edad_min', e.target.value)}
                    placeholder="18"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Edad máxima</Label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={exportFilters.edad_max || ''}
                    onChange={(e) => setFilter('edad_max', e.target.value)}
                    placeholder="65"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
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
                  <li>• Se exportarán todos los clientes que coincidan con los filtros seleccionados</li>
                  <li>• El archivo incluirá información completa de clientes, contacto y datos personales</li>
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

export default ClientesExportModal;
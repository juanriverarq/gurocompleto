import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'src/components/shadcn-ui/Default-Ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'src/components/shadcn-ui/Default-Ui/command';
import { PolizaFilters, polizaService } from 'src/services/polizaService';
import { toast } from 'src/hooks/use-toast';
import saasApi from 'src/services/saasApi';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from 'src/lib/utils';

// Definición de columnas disponibles para exportar
const EXPORT_COLUMNS = [
  { id: 'numero_poliza', label: 'Número Póliza', default: true },
  { id: 'cliente', label: 'Cliente', default: true },
  { id: 'documento_cliente', label: 'Documento Cliente', default: true },
  { id: 'aseguradora', label: 'Aseguradora', default: true },
  { id: 'ramo', label: 'Ramo', default: true },
  { id: 'subramo', label: 'Subramo', default: false },
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
  { id: 'fecha_cancelacion', label: 'Fecha Cancelación', default: false },
  { id: 'motivo_cancelacion', label: 'Motivo Cancelación', default: false },
];

interface CatalogItem { id: number | string; nombre: string; subramo?: any }

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

  // Catalogs loaded from API
  const [aseguradorasList, setAseguradorasList] = useState<CatalogItem[]>([]);
  const [ramosList, setRamosList] = useState<CatalogItem[]>([]);
  const [vendedoresList, setVendedoresList] = useState<CatalogItem[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  // Combobox open states
  const [asegOpen, setAsegOpen] = useState(false);
  const [ramoOpen, setRamoOpen] = useState(false);
  const [subramoOpen, setSubramoOpen] = useState(false);
  const [vendedorOpen, setVendedorOpen] = useState(false);

  // Subramo filter
  const [subramoFilter, setSubramoFilter] = useState('');

  // Multi-ramo filter (supports include/exclude mode)
  const [ramoIds, setRamoIds] = useState<string[]>([]);
  const [ramoMode, setRamoMode] = useState<'include' | 'exclude'>('include');

  // Load catalogs when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setCatsLoading(true);
      try {
        const [aRes, rRes, vRes] = await Promise.all([
          saasApi.getAseguradoras().catch(() => ({ data: [] as any[] })),
          saasApi.getRamos().catch(() => ({ data: [] as any[] })),
          saasApi.getVendedores().catch(() => ({ data: [] as any[] })),
        ]);
        const extract = (res: any) => {
          const d = res?.data;
          return Array.isArray(d) ? d : (d?.data || []);
        };
        setAseguradorasList(
          (extract(aRes) as any[])
            .map((x: any) => ({ id: x.id ?? x.value, nombre: x.nombre ?? x.name ?? String(x) }))
            .filter(x => x.id != null && x.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
        setRamosList(
          (extract(rRes) as any[])
            .map((x: any) => ({ id: x.id ?? x.ramo_id, nombre: x.nombre ?? x.name ?? String(x), subramo: x.subramo }))
            .filter(x => x.id != null && x.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
        setVendedoresList(
          (extract(vRes) as any[])
            .map((x: any) => ({ id: x.id ?? x.vendedor_id, nombre: x.nombres ?? x.nombre ?? x.name ?? String(x) }))
            .filter(x => x.id != null && x.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      } finally {
        setCatsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setExportFilters(currentFilters);
      setUseCurrentFilters(true);
      setSubramoFilter('');
      setRamoIds(currentFilters.ramo_id ? [String(currentFilters.ramo_id)] : []);
      setRamoMode('include');
    }
  }, [isOpen, currentFilters]);

  // Subramo only available when exactly 1 ramo is selected in include mode
  const subramoOptions = useMemo(() => {
    if (ramoMode !== 'include' || ramoIds.length !== 1) return [];
    const ramo = ramosList.find(r => String(r.id) === ramoIds[0]);
    if (!ramo || !ramo.subramo) return [];
    let raw = ramo.subramo;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = [raw]; }
    }
    if (Array.isArray(raw)) return raw.filter((s: any) => typeof s === 'string' && s.trim());
    return [];
  }, [ramoIds, ramoMode, ramosList]);

  const toggleRamoId = (id: string) => {
    setRamoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSubramoFilter('');
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const selectAllColumns = () => setSelectedColumns(EXPORT_COLUMNS.map(c => c.id));
  const selectDefaultColumns = () => setSelectedColumns(EXPORT_COLUMNS.filter(c => c.default).map(c => c.id));

  const activeFiltersCount = useMemo(() => {
    const f = useCurrentFilters ? currentFilters : exportFilters;
    let count = 0;
    if (f.search) count++;
    if (f.aseguradora || f.aseguradora_id) count++;
    if (useCurrentFilters) {
      if (f.ramo || f.ramo_id) count++;
    } else if (ramoIds.length > 0) {
      count++;
    }
    if (f.estado) count++;
    if (f.vendedor) count++;
    if (f.fecha_inicio) count++;
    if (f.fecha_fin) count++;
    if (f.renovable !== undefined && f.renovable !== '') count++;
    if (f.fecha_recepcion_desde) count++;
    if (f.fecha_recepcion_hasta) count++;
    if (f.cancelled_desde) count++;
    if (f.cancelled_hasta) count++;
    if (subramoFilter) count++;
    if (f.forma_pago) count++;
    return count;
  }, [useCurrentFilters, currentFilters, exportFilters, subramoFilter, ramoIds]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const filtersToUse = useCurrentFilters ? currentFilters : exportFilters;
      const exportFiltersClean: Record<string, any> = {};

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

      // Multi-ramo include/exclude (overrides single ramo_id)
      if (!useCurrentFilters && ramoIds.length > 0) {
        delete exportFiltersClean.ramo_id;
        delete exportFiltersClean.ramo;
        if (ramoMode === 'include') {
          exportFiltersClean.ramo_ids = ramoIds.join(',');
        } else {
          exportFiltersClean.exclude_ramo_ids = ramoIds.join(',');
        }
      }

      // Add subramo filter if set
      if (!useCurrentFilters && subramoFilter) {
        exportFiltersClean.subramo = subramoFilter;
      }

      if (selectedColumns.length > 0) {
        exportFiltersClean.columnas = selectedColumns.join(',');
      }

      console.log('Exportando con filtros:', exportFiltersClean);

      const blob = await polizaService.exportarPolizas(exportFiltersClean as PolizaFilters & { columnas?: string }, formato);

      if (!blob || blob.size === 0) {
        throw new Error('El archivo exportado está vacío. Verifica los filtros aplicados.');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polizas_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Exportación completada", description: `Pólizas exportadas en formato ${formato.toUpperCase()}.` });
      onClose();
    } catch (error) {
      console.error('Error en exportación:', error);
      toast({ variant: "destructive", title: "Error en la exportación", description: error instanceof Error ? error.message : "Error desconocido" });
    } finally {
      setExporting(false);
    }
  };

  const setFilter = (key: keyof PolizaFilters, value: any) => {
    setExportFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setExportFilters({ search: '', aseguradora: '', aseguradora_id: '', ramo: '', ramo_id: '', estado: '', vendedor: '', fecha_inicio: '', fecha_fin: '', fecha_recepcion_desde: '', fecha_recepcion_hasta: '', cancelled_desde: '', cancelled_hasta: '', renovable: '', forma_pago: '' });
    setSubramoFilter('');
    setRamoIds([]);
    setRamoMode('include');
  };

  // Helper to get display name
  const getAsegName = (id: any) => aseguradorasList.find(a => String(a.id) === String(id))?.nombre || '';
  const getRamoName = (id: any) => ramosList.find(r => String(r.id) === String(id))?.nombre || '';
  const getVendedorName = (name: any) => vendedoresList.find(v => v.nombre === name)?.nombre || '';

  return (
    <Modal show={isOpen} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:download-bold-duotone" className="w-5 h-5 text-green-600" />
          <span>Exportar Pólizas</span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-5">
          {/* Formato */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Formato de exportación</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormato('excel')}
                className={cn("flex-1 flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm", formato === 'excel' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300')}
              >
                <Icon icon="solar:file-bold" className={cn("w-5 h-5", formato === 'excel' ? 'text-green-600' : 'text-gray-400')} />
                <div className="text-left">
                  <p className="font-medium">Excel (.xlsx)</p>
                  <p className="text-xs text-gray-500">Con formato y colores</p>
                </div>
              </button>
              <button
                onClick={() => setFormato('csv')}
                className={cn("flex-1 flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm", formato === 'csv' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300')}
              >
                <Icon icon="solar:file-text-bold" className={cn("w-5 h-5", formato === 'csv' ? 'text-blue-600' : 'text-gray-400')} />
                <div className="text-left">
                  <p className="font-medium">CSV (.csv)</p>
                  <p className="text-xs text-gray-500">Texto plano universal</p>
                </div>
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filtros a aplicar</Label>
            <RadioGroup
              value={useCurrentFilters ? 'current' : 'custom'}
              onValueChange={(v) => setUseCurrentFilters(v === 'current')}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="current-filters" value="current" />
                <Label htmlFor="current-filters" className="text-sm cursor-pointer">
                  Usar filtros actuales de la tabla
                  {activeFiltersCount > 0 && useCurrentFilters && (
                    <Badge color="info" className="ml-2 text-xs">{activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}</Badge>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="custom-filters" value="custom" />
                <Label htmlFor="custom-filters" className="text-sm cursor-pointer">Configurar filtros personalizados</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Custom filters */}
          {!useCurrentFilters && (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 space-y-4 max-h-[340px] overflow-y-auto">
              <div className="flex items-center justify-between sticky top-0 bg-gray-50 dark:bg-gray-800 pb-2 z-10">
                <h4 className="text-sm font-medium">Filtros personalizados</h4>
                <Button size="xs" color="light" onClick={resetFilters}>
                  <Icon icon="solar:refresh-bold" className="w-3 h-3 mr-1" /> Limpiar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Aseguradora - searchable */}
                <div className="space-y-1">
                  <Label className="text-xs">Aseguradora</Label>
                  <Popover open={asegOpen} onOpenChange={setAsegOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                        <span className={exportFilters.aseguradora_id ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                          {exportFilters.aseguradora_id ? getAsegName(exportFilters.aseguradora_id) : 'Buscar aseguradora...'}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar aseguradora..." />
                        <CommandList>
                          <CommandEmpty>No encontrada</CommandEmpty>
                          <CommandGroup>
                            <CommandItem onSelect={() => { setFilter('aseguradora_id', ''); setFilter('aseguradora', ''); setAsegOpen(false); }}>
                              <Check className={cn("mr-2 h-3 w-3", !exportFilters.aseguradora_id ? "opacity-100" : "opacity-0")} />
                              Todas
                            </CommandItem>
                            {aseguradorasList.map(a => (
                              <CommandItem key={a.id} value={a.nombre} onSelect={() => { setFilter('aseguradora_id', a.id); setFilter('aseguradora', ''); setAsegOpen(false); }}>
                                <Check className={cn("mr-2 h-3 w-3", String(exportFilters.aseguradora_id) === String(a.id) ? "opacity-100" : "opacity-0")} />
                                {a.nombre}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Ramo - multi-select with include/exclude */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Ramo</Label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setRamoMode('include')}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded border transition-all',
                          ramoMode === 'include'
                            ? 'bg-green-100 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-300'
                            : 'border-gray-300 text-gray-500 hover:border-gray-400'
                        )}
                      >
                        Incluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setRamoMode('exclude')}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded border transition-all',
                          ramoMode === 'exclude'
                            ? 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-300'
                            : 'border-gray-300 text-gray-500 hover:border-gray-400'
                        )}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                  <Popover open={ramoOpen} onOpenChange={setRamoOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                        <span className={ramoIds.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                          {ramoIds.length === 0
                            ? 'Buscar ramos...'
                            : ramoIds.length === 1
                              ? getRamoName(ramoIds[0])
                              : `${ramoIds.length} ramos ${ramoMode === 'include' ? 'incluidos' : 'excluidos'}`}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar ramo..." />
                        <CommandList>
                          <CommandEmpty>No encontrado</CommandEmpty>
                          <CommandGroup>
                            <CommandItem onSelect={() => { setRamoIds([]); setSubramoFilter(''); }}>
                              <Check className={cn("mr-2 h-3 w-3", ramoIds.length === 0 ? "opacity-100" : "opacity-0")} />
                              Limpiar selección
                            </CommandItem>
                            {ramosList.map(r => {
                              const id = String(r.id);
                              const checked = ramoIds.includes(id);
                              return (
                                <CommandItem key={r.id} value={r.nombre} onSelect={() => toggleRamoId(id)}>
                                  <Check className={cn("mr-2 h-3 w-3", checked ? "opacity-100" : "opacity-0")} />
                                  {r.nombre}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {ramoIds.length > 1 && (
                    <p className="text-[10px] text-gray-500">
                      {ramoMode === 'include' ? 'Solo se exportarán pólizas de estos ramos' : 'Se excluirán pólizas de estos ramos'}
                    </p>
                  )}
                </div>

                {/* Subramo - only shows when ramo selected and has subramos */}
                {subramoOptions.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Subramo</Label>
                    <Popover open={subramoOpen} onOpenChange={setSubramoOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                          <span className={subramoFilter ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                            {subramoFilter || 'Buscar subramo...'}
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar subramo..." />
                          <CommandList>
                            <CommandEmpty>No encontrado</CommandEmpty>
                            <CommandGroup>
                              <CommandItem onSelect={() => { setSubramoFilter(''); setSubramoOpen(false); }}>
                                <Check className={cn("mr-2 h-3 w-3", !subramoFilter ? "opacity-100" : "opacity-0")} />
                                Todos
                              </CommandItem>
                              {subramoOptions.map((s: string) => (
                                <CommandItem key={s} value={s} onSelect={() => { setSubramoFilter(s); setSubramoOpen(false); }}>
                                  <Check className={cn("mr-2 h-3 w-3", subramoFilter === s ? "opacity-100" : "opacity-0")} />
                                  {s}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Estado */}
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={exportFilters.estado || 'all'} onValueChange={(v) => setFilter('estado', v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
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

                {/* Renovable */}
                <div className="space-y-1">
                  <Label className="text-xs">Renovable</Label>
                  <Select value={(exportFilters.renovable as string) || 'all'} onValueChange={(v) => setFilter('renovable', v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Sí</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Forma de pago */}
                <div className="space-y-1">
                  <Label className="text-xs">Forma de pago</Label>
                  <Select value={(exportFilters.forma_pago as string) || 'all'} onValueChange={(v) => setFilter('forma_pago', v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="contado">Contado</SelectItem>
                      <SelectItem value="fraccionado">Fraccionado</SelectItem>
                      <SelectItem value="financiado">Financiado</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendedor - searchable */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Vendedor</Label>
                  <Popover open={vendedorOpen} onOpenChange={setVendedorOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                        <span className={exportFilters.vendedor ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                          {exportFilters.vendedor || (catsLoading ? 'Cargando...' : 'Buscar vendedor...')}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar vendedor..." />
                        <CommandList>
                          <CommandEmpty>No encontrado</CommandEmpty>
                          <CommandGroup>
                            <CommandItem onSelect={() => { setFilter('vendedor', ''); setVendedorOpen(false); }}>
                              <Check className={cn("mr-2 h-3 w-3", !exportFilters.vendedor ? "opacity-100" : "opacity-0")} />
                              Todos los vendedores
                            </CommandItem>
                            {vendedoresList.map(v => (
                              <CommandItem key={v.id} value={v.nombre} onSelect={() => { setFilter('vendedor', v.nombre); setVendedorOpen(false); }}>
                                <Check className={cn("mr-2 h-3 w-3", exportFilters.vendedor === v.nombre ? "opacity-100" : "opacity-0")} />
                                {v.nombre}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Fechas de vigencia */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Fechas de Vigencia</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={exportFilters.fecha_inicio || ''} onChange={(e) => setFilter('fecha_inicio', e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={exportFilters.fecha_fin || ''} onChange={(e) => setFilter('fecha_fin', e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>

              {/* Fechas de recepción */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Fechas de Recepción</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={exportFilters.fecha_recepcion_desde || ''} onChange={(e) => setFilter('fecha_recepcion_desde', e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={exportFilters.fecha_recepcion_hasta || ''} onChange={(e) => setFilter('fecha_recepcion_hasta', e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>

              {/* Fechas de cancelación - aplica para cualquier estado (filtra por cancelled_at) */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Fechas de Cancelación</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={exportFilters.cancelled_desde || ''} onChange={(e) => setFilter('cancelled_desde', e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={exportFilters.cancelled_hasta || ''} onChange={(e) => setFilter('cancelled_hasta', e.target.value)} className="h-9" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Filtra por la fecha en que la póliza fue cancelada (cancelled_at). Funciona con cualquier estado seleccionado.</p>
              </div>
            </div>
          )}

          {/* Columnas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columnas a exportar</Label>
              <div className="flex gap-2">
                <Button size="xs" color="light" onClick={selectAllColumns}>Todas</Button>
                <Button size="xs" color="light" onClick={selectDefaultColumns}>Por defecto</Button>
              </div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {EXPORT_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded">
                    <Checkbox checked={selectedColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} className="w-3 h-3" />
                    <span className={selectedColumns.includes(col.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">{selectedColumns.length} de {EXPORT_COLUMNS.length} columnas seleccionadas</p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-full flex items-center justify-between">
          <Button color="light" onClick={onClose} disabled={exporting}>Cancelar</Button>
          <Button color="success" onClick={handleExport} disabled={exporting} className="flex items-center gap-2">
            {exporting ? (<><Spinner size="sm" /> Exportando...</>) : (<><Icon icon="solar:download-bold" className="w-4 h-4" /> Exportar {formato.toUpperCase()}</>)}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PolizasExportModal;
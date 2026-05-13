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
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from 'src/lib/utils';
import { toast } from 'src/hooks/use-toast';
import { carteraSimpleService } from 'src/services/carteraSimpleService';
import saasApi from 'src/services/saasApi';

interface CatalogItem { id: number | string; nombre: string }

const EXPORT_COLUMNS = [
  { id: 'poliza_numero',               label: 'Número Póliza',           default: true },
  { id: 'numero_pago',                 label: 'Cuota',                   default: true },
  { id: 'cliente_nombre',              label: 'Cliente',                 default: true },
  { id: 'cliente_documento',           label: 'Documento',               default: true },
  { id: 'aseguradora_nombre',          label: 'Aseguradora',             default: true },
  { id: 'ramo_principal',              label: 'Ramo',                    default: true },
  { id: 'subramo',                     label: 'Subramo',                 default: false },
  { id: 'forma_pago',                  label: 'Forma de Pago',           default: true },
  { id: 'riesgo',                      label: 'Riesgo',                  default: false },
  { id: 'placas',                      label: 'Placas',                  default: false },
  { id: 'vendedor_nombre',             label: 'Vendedor',                default: false },
  { id: 'prima_total_pago',            label: 'Prima Cuota',             default: true },
  { id: 'valor_neto_a_pagar',          label: 'Valor Neto a Pagar',      default: false },
  { id: 'saldo_pendiente_oficina',     label: 'Saldo Pendiente Oficina', default: true },
  { id: 'saldo_pendiente_aseguradora', label: 'Saldo Pendiente Aseg.',   default: true },
  { id: 'valor_recaudado_oficina',     label: 'Recaudado Oficina',       default: false },
  { id: 'valor_pagado_aseguradora',    label: 'Pagado Aseguradora',      default: false },
  { id: 'comision_a_recibir',          label: 'Comisión a Recibir',      default: true },
  { id: 'comision_recibida',           label: 'Comisión Recibida',       default: false },
  { id: 'fecha_limite_pago',           label: 'Fecha Límite Pago',       default: true },
  { id: 'fecha_recaudado_oficina',     label: 'Fecha Recaudo Oficina',   default: false },
  { id: 'fecha_pago_aseguradora',      label: 'Fecha Pago Aseguradora',  default: false },
  { id: 'fecha_comisionada',           label: 'Fecha Comisión Cobrada',  default: false },
  { id: 'estado_cartera',              label: 'Estado Cartera',          default: true },
  { id: 'sede',                        label: 'Sede',                    default: false },
];

const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',                  label: 'Todos los pendientes (vencidas + hoy + próximos)' },
  { value: 'vencidas',             label: 'Vencidas' },
  { value: 'hoy',                  label: 'Hoy' },
  { value: 'proximos_7',           label: 'Próximos 7 días' },
  { value: 'proximos_30',          label: 'Próximos 30 días' },
  { value: 'sin_fecha',            label: 'Sin fecha' },
  { value: 'por_pagar_aseguradora',label: 'Por pagar aseguradora' },
  { value: 'comision_por_cobrar',  label: 'Comisión por cobrar' },
  { value: 'cerradas',             label: 'Cerradas (últimos 30 días)' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
  initialGroup?: string;
}

const CarteraExportModal: React.FC<Props> = ({ isOpen, onClose, initialSearch = '', initialGroup = 'all' }) => {
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [group, setGroup] = useState(initialGroup);
  const [aseguradoraId, setAseguradoraId] = useState<string>('');
  const [formaPago, setFormaPago] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [ramoIds, setRamoIds] = useState<string[]>([]);
  const [ramoMode, setRamoMode] = useState<'include' | 'exclude'>('include');
  const [estadoPolizaIds, setEstadoPolizaIds] = useState<string[]>([]);
  const [estadoPolizaMode, setEstadoPolizaMode] = useState<'include' | 'exclude'>('include');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EXPORT_COLUMNS.filter(c => c.default).map(c => c.id)
  );

  const [aseguradorasList, setAseguradorasList] = useState<CatalogItem[]>([]);
  const [ramosList, setRamosList] = useState<CatalogItem[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  const [asegOpen, setAsegOpen] = useState(false);
  const [ramoOpen, setRamoOpen] = useState(false);
  const [estadoOpen, setEstadoOpen] = useState(false);

  // Estados de póliza alineados con valores reales en BD (`polizas.status`).
  const estadosPolizaList: { id: string; nombre: string }[] = [
    { id: 'active',      nombre: 'Activa' },
    { id: 'expired',     nombre: 'Vencida' },
    { id: 'cancelled',   nombre: 'Cancelada' },
    { id: 'not_renewed', nombre: 'No Renovada' },
    { id: 'accrued',     nombre: 'Causada' },
    { id: 'renewed',     nombre: 'Renovada' },
    { id: 'quoted',      nombre: 'Cotizada' },
  ];

  useEffect(() => {
    if (!isOpen) return;
    setSearch(initialSearch);
    setGroup(initialGroup);
    setAseguradoraId('');
    setFormaPago('');
    setFechaDesde('');
    setFechaHasta('');
    setRamoIds([]);
    setRamoMode('include');
    setEstadoPolizaIds([]);
    setEstadoPolizaMode('include');
    setSelectedColumns(EXPORT_COLUMNS.filter(c => c.default).map(c => c.id));
  }, [isOpen, initialSearch, initialGroup]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setCatsLoading(true);
      try {
        const [aRes, rRes] = await Promise.all([
          saasApi.getAseguradoras().catch(() => ({ data: [] as any[] })),
          saasApi.getRamos().catch(() => ({ data: [] as any[] })),
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
            .map((x: any) => ({ id: x.id ?? x.ramo_id, nombre: x.nombre ?? x.name ?? String(x) }))
            .filter(x => x.id != null && x.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      } finally {
        setCatsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const toggleRamoId = (id: string) => {
    setRamoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleEstadoPolizaId = (id: string) => {
    setEstadoPolizaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId) ? prev.filter(c => c !== columnId) : [...prev, columnId]
    );
  };
  const selectAllColumns = () => setSelectedColumns(EXPORT_COLUMNS.map(c => c.id));
  const selectDefaultColumns = () => setSelectedColumns(EXPORT_COLUMNS.filter(c => c.default).map(c => c.id));

  const getAsegName = (id: string) => aseguradorasList.find(a => String(a.id) === id)?.nombre || '';
  const getRamoName = (id: string) => ramosList.find(r => String(r.id) === id)?.nombre || '';
  const getEstadoPolizaName = (id: string) => estadosPolizaList.find(e => e.id === id)?.nombre || id;

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (group && group !== 'all') c++;
    if (aseguradoraId) c++;
    if (formaPago) c++;
    if (fechaDesde) c++;
    if (fechaHasta) c++;
    if (ramoIds.length > 0) c++;
    if (estadoPolizaIds.length > 0) c++;
    return c;
  }, [search, group, aseguradoraId, formaPago, fechaDesde, fechaHasta, ramoIds, estadoPolizaIds]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const filters: Record<string, any> = {};
      if (search) filters.search = search;
      if (group && group !== 'all') filters.group = group;
      if (aseguradoraId) filters.aseguradora_id = aseguradoraId;
      if (formaPago) filters.forma_pago = formaPago;
      if (fechaDesde) filters.fecha_desde = fechaDesde;
      if (fechaHasta) filters.fecha_hasta = fechaHasta;
      if (ramoIds.length > 0) {
        if (ramoMode === 'include') filters.ramo_ids = ramoIds.join(',');
        else filters.exclude_ramo_ids = ramoIds.join(',');
      }
      if (estadoPolizaIds.length > 0) {
        if (estadoPolizaMode === 'include') filters.estado_poliza = estadoPolizaIds.join(',');
        else filters.exclude_estado_poliza = estadoPolizaIds.join(',');
      }
      if (selectedColumns.length > 0) filters.columnas = selectedColumns.join(',');

      const blob = await carteraSimpleService.exportar(filters);
      if (!blob || blob.size === 0) throw new Error('El archivo exportado está vacío.');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartera_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'Exportación completada', description: 'Cartera exportada en CSV.' });
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error en la exportación',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:download-bold-duotone" className="w-5 h-5 text-green-600" />
          <span>Exportar Cartera</span>
          {activeFiltersCount > 0 && (
            <Badge color="info" className="ml-2 text-xs">{activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-5">
          {/* Filtros */}
          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 space-y-4">
            <h4 className="text-sm font-medium">Filtros</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Search */}
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Búsqueda (cliente, documento, póliza)</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-9" />
              </div>

              {/* Grupo */}
              <div className="space-y-1">
                <Label className="text-xs">Grupo / Tab</Label>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Forma de pago */}
              <div className="space-y-1">
                <Label className="text-xs">Forma de pago</Label>
                <Select value={formaPago || 'all'} onValueChange={(v) => setFormaPago(v === 'all' ? '' : v)}>
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

              {/* Aseguradora */}
              <div className="space-y-1">
                <Label className="text-xs">Aseguradora</Label>
                <Popover open={asegOpen} onOpenChange={setAsegOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                      <span className={aseguradoraId ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                        {aseguradoraId ? getAsegName(aseguradoraId) : (catsLoading ? 'Cargando...' : 'Buscar aseguradora...')}
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
                          <CommandItem onSelect={() => { setAseguradoraId(''); setAsegOpen(false); }}>
                            <Check className={cn('mr-2 h-3 w-3', !aseguradoraId ? 'opacity-100' : 'opacity-0')} />
                            Todas
                          </CommandItem>
                          {aseguradorasList.map(a => (
                            <CommandItem key={a.id} value={a.nombre} onSelect={() => { setAseguradoraId(String(a.id)); setAsegOpen(false); }}>
                              <Check className={cn('mr-2 h-3 w-3', aseguradoraId === String(a.id) ? 'opacity-100' : 'opacity-0')} />
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
                          <CommandItem onSelect={() => setRamoIds([])}>
                            <Check className={cn('mr-2 h-3 w-3', ramoIds.length === 0 ? 'opacity-100' : 'opacity-0')} />
                            Limpiar selección
                          </CommandItem>
                          {ramosList.map(r => {
                            const id = String(r.id);
                            const checked = ramoIds.includes(id);
                            return (
                              <CommandItem key={r.id} value={r.nombre} onSelect={() => toggleRamoId(id)}>
                                <Check className={cn('mr-2 h-3 w-3', checked ? 'opacity-100' : 'opacity-0')} />
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
                    {ramoMode === 'include' ? 'Solo cartera de estos ramos' : 'Excluir cartera de estos ramos'}
                  </p>
                )}
              </div>

              {/* Estado de póliza - multi-select with include/exclude */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Estado de Póliza</Label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEstadoPolizaMode('include')}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded border transition-all',
                        estadoPolizaMode === 'include'
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-300'
                          : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      )}
                    >
                      Incluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setEstadoPolizaMode('exclude')}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded border transition-all',
                        estadoPolizaMode === 'exclude'
                          ? 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-300'
                          : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      )}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <Popover open={estadoOpen} onOpenChange={setEstadoOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-between w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkgray text-sm">
                      <span className={estadoPolizaIds.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                        {estadoPolizaIds.length === 0
                          ? 'Buscar estados...'
                          : estadoPolizaIds.length === 1
                            ? getEstadoPolizaName(estadoPolizaIds[0])
                            : `${estadoPolizaIds.length} estados ${estadoPolizaMode === 'include' ? 'incluidos' : 'excluidos'}`}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar estado..." />
                      <CommandList>
                        <CommandEmpty>No encontrado</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setEstadoPolizaIds([])}>
                            <Check className={cn('mr-2 h-3 w-3', estadoPolizaIds.length === 0 ? 'opacity-100' : 'opacity-0')} />
                            Limpiar selección
                          </CommandItem>
                          {estadosPolizaList.map(e => {
                            const checked = estadoPolizaIds.includes(e.id);
                            return (
                              <CommandItem key={e.id} value={e.nombre} onSelect={() => toggleEstadoPolizaId(e.id)}>
                                <Check className={cn('mr-2 h-3 w-3', checked ? 'opacity-100' : 'opacity-0')} />
                                {e.nombre}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {estadoPolizaIds.length > 1 && (
                  <p className="text-[10px] text-gray-500">
                    {estadoPolizaMode === 'include' ? 'Solo cartera de pólizas con estos estados' : 'Excluir cartera de pólizas con estos estados'}
                  </p>
                )}
              </div>
            </div>

            {/* Fechas */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Fecha Límite de Pago</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          </div>

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
            {exporting ? (<><Spinner size="sm" /> Exportando...</>) : (<><Icon icon="solar:download-bold" className="w-4 h-4" /> Exportar CSV</>)}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default CarteraExportModal;

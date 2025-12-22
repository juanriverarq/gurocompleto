import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Badge } from 'flowbite-react';
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
import { PolizaFilters } from 'src/services/polizaService';
import saasApi from 'src/services/saasApi';
import { useTerminologia } from 'src/context/TerminologiaContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filters: PolizaFilters;
  onFiltersChange: (filters: PolizaFilters) => void;
}


const estadosPoliza = [
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'VENCIDA', label: 'Vencida' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'SUSPENDIDA', label: 'Suspendida' },
  { value: 'POR_VENCER', label: 'Por Vencer' }
];

const PolizasFilterModal: React.FC<Props> = ({ isOpen, onClose, filters, onFiltersChange }) => {
  const [localFilters, setLocalFilters] = useState<PolizaFilters>(filters);
  const { terminologia } = useTerminologia();

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Catálogos: aseguradoras, ramos y vendedores
  const [aseguradorasList, setAseguradorasList] = useState<Array<{ id: number | string; nombre: string }>>([]);
  const [ramosList, setRamosList] = useState<Array<{ id: number | string; nombre: string }>>([]);
  const [vendedoresList, setVendedoresList] = useState<Array<{ id: number | string; nombre: string }>>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        setCatsLoading(true);
        const [aRes, rRes, vRes] = await Promise.all([
          saasApi.getAseguradoras().catch(() => ({ data: [] as any[] })),
          saasApi.getRamos().catch(() => ({ data: [] as any[] })),
          saasApi.getVendedores().catch(() => ({ data: [] as any[] })),
        ]);

        const asegDataRaw = (aRes && (aRes as any).data)
          ? (Array.isArray((aRes as any).data) ? (aRes as any).data : (((aRes as any).data.data) || []))
          : [];
        const ramosDataRaw = (rRes && (rRes as any).data)
          ? (Array.isArray((rRes as any).data) ? (rRes as any).data : (((rRes as any).data.data) || []))
          : [];
        const vendedoresDataRaw = (vRes && (vRes as any).data)
          ? (Array.isArray((vRes as any).data) ? (vRes as any).data : (((vRes as any).data.data) || []))
          : [];

        const aseg = (asegDataRaw as any[]).map((x: any) => ({
          id: x.id ?? x.value ?? x.aseguradora_id ?? x.codigo ?? x.ID,
          nombre: x.nombre ?? x.name ?? x.display_name ?? x.Nombre ?? x.aseguradora ?? String(x),
        })).filter(x => x.id != null && x.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        const ramos = (ramosDataRaw as any[]).map((x: any) => ({
          id: x.id ?? x.ramo_id ?? x.codigo ?? x.ID,
          nombre: x.nombre ?? x.name ?? x.display_name ?? x.Nombre ?? x.ramo ?? String(x),
        })).filter(x => x.id != null && x.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        const vendedores = (vendedoresDataRaw as any[]).map((x: any) => ({
          id: x.id ?? x.vendedor_id ?? x.ID,
          nombre: x.nombres ?? x.nombre ?? x.name ?? String(x),
        })).filter(x => x.id != null && x.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        setAseguradorasList(aseg);
        setRamosList(ramos);
        setVendedoresList(vendedores);
      } finally {
        setCatsLoading(false);
      }
    };

    if (isOpen) {
      loadCatalogs();
    }
  }, [isOpen]);

  const set = (key: keyof PolizaFilters, value: any) => setLocalFilters(prev => ({ ...prev, [key]: value }));

  const activeCount = useMemo(() => {
    let count = 0;
    if (localFilters.search) count++;
    if (localFilters.aseguradora || localFilters.aseguradora_id) count++;
    if (localFilters.ramo || localFilters.ramo_id) count++;
    if (localFilters.estado) count++;
    if (localFilters.vendedor) count++;
    if (localFilters.sede) count++;
    if (localFilters.fecha_inicio) count++;
    if (localFilters.fecha_fin) count++;
    if (localFilters.renovable !== undefined && localFilters.renovable !== '') count++;
    if (localFilters.fecha_recepcion_desde) count++;
    if (localFilters.fecha_recepcion_hasta) count++;
    return count;
  }, [localFilters]);

  const apply = () => {
    onFiltersChange({ ...localFilters, page: 1 });
    onClose();
  };

  const reset = () => {
    setLocalFilters({
      search: '',
      aseguradora: '',
      aseguradora_id: '',
      ramo: '',
      ramo_id: '',
      estado: '',
      vendedor: '',
      sede: '',
      fecha_inicio: '',
      fecha_fin: '',
      fecha_recepcion_desde: '',
      fecha_recepcion_hasta: '',
      renovable: '',
      sort_field: 'created_at',
      sort_direction: 'desc',
      page: 1,
      per_page: 15,
    });
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:filter-bold-duotone" className="w-5 h-5 text-blue-600" />
          <span>Filtros de Pólizas</span>
          {activeCount > 0 && (
            <Badge color="info" className="ml-2">{activeCount} activo{activeCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-6">
          {/* Búsqueda */}
          <div className="space-y-2">
            <Label className="text-sm">Buscar</Label>
            <Input
              placeholder="Número de póliza, cliente o aseguradora"
              value={localFilters.search || ''}
              onChange={(e) => set('search', e.target.value)}
            />
          </div>

          {/* Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Aseguradora</Label>
              <Select
                value={String((localFilters.aseguradora_id as any) || 'all')}
                onValueChange={(v) => {
                  if (v === 'all') {
                    set('aseguradora_id', '');
                    set('aseguradora', '');
                  } else {
                    set('aseguradora_id', Number(v));
                    set('aseguradora', '');
                  }
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {aseguradorasList.map(a => (
                    <SelectItem key={String(a.id)} value={String(a.id)}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Ramo</Label>
              <Select
                value={String((localFilters.ramo_id as any) || 'all')}
                onValueChange={(v) => {
                  if (v === 'all') {
                    set('ramo_id', '');
                    set('ramo', '');
                  } else {
                    set('ramo_id', Number(v));
                    set('ramo', '');
                  }
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ramosList.map(r => (
                    <SelectItem key={String(r.id)} value={String(r.id)}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Estado</Label>
              <Select value={localFilters.estado || 'all'} onValueChange={(v) => set('estado', v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {estadosPoliza.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{terminologia.vendedor}</Label>
              <Select
                value={localFilters.vendedor || 'all'}
                onValueChange={(v) => set('vendedor', v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={`Todos los ${terminologia.vendedorPlural.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vendedoresList.map(v => (
                    <SelectItem key={String(v.id)} value={v.nombre}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sede</Label>
              <Input placeholder="Sede" value={localFilters.sede || ''} onChange={(e) => set('sede', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Renovable</Label>
              <Select value={(localFilters.renovable as string) || 'all'} onValueChange={(v) => set('renovable', v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fechas */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Fecha de Inicio Desde</Label>
                <Input type="date" value={localFilters.fecha_inicio || ''} onChange={(e) => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Fecha de Inicio Hasta</Label>
                <Input type="date" value={localFilters.fecha_fin || ''} onChange={(e) => set('fecha_fin', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Fecha Recepción Desde</Label>
                <Input type="date" value={localFilters.fecha_recepcion_desde || ''} onChange={(e) => set('fecha_recepcion_desde', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Fecha Recepción Hasta</Label>
                <Input type="date" value={localFilters.fecha_recepcion_hasta || ''} onChange={(e) => set('fecha_recepcion_hasta', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-full flex items-center justify-between">
          <Button color="gray" onClick={reset}>
            <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
          <div className="flex gap-2">
            <Button color="light" onClick={onClose}>Cancelar</Button>
            <Button color="blue" onClick={apply}>
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
              Aplicar filtros{activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PolizasFilterModal;

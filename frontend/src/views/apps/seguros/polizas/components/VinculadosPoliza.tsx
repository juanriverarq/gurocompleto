import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Button, Modal, Table, TextInput, Select, Badge, Spinner, Textarea, Checkbox, FileInput, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { vinculadosService, type PolizaVinculado } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import * as XLSX from 'xlsx';

type Props = { polizaId: string };

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const emptyForm: Partial<PolizaVinculado> = {
  identificador: '',
  documento: '',
  nombre_asegurado: '',
  valor: 0,
  valor_iva: 0,
  valor_total: 0,
  estado: 'activo',
  tipo_documento: 'CC',
  telefono: '',
  email: '',
  direccion: '',
  ciudad: '',
  observaciones: '',
};

// Target fields for column mapping
const MAPPABLE_FIELDS = [
  { key: 'nombre_asegurado', label: 'Nombre Asegurado *', required: true },
  { key: 'identificador', label: 'Placa / ID' },
  { key: 'documento', label: 'Documento' },
  { key: 'tipo_documento', label: 'Tipo Documento' },
  { key: 'valor', label: 'Valor Prima' },
  { key: 'valor_iva', label: 'Valor IVA' },
  { key: 'valor_total', label: 'Valor Total' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'observaciones', label: 'Observaciones' },
] as const;

// Auto-detect column mapping from header names
const autoDetectMapping = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const lower = headers.map(h => (h || '').toLowerCase().trim());
  const patterns: [string, RegExp[]][] = [
    ['nombre_asegurado', [/nombre/i, /asegurado/i, /name/i, /titular/i]],
    ['identificador', [/placa/i, /^id$/i, /identificador/i, /plate/i, /codigo/i]],
    ['documento', [/documento/i, /cedula/i, /c[eé]dula/i, /nit/i, /doc/i, /dni/i]],
    ['tipo_documento', [/tipo.*doc/i, /doc.*tipo/i, /type.*doc/i]],
    ['valor', [/^valor$/i, /prima(?!.*total)/i, /^prima$/i, /^monto$/i, /^amount$/i, /^value$/i]],
    ['valor_iva', [/iva/i, /impuesto/i, /tax/i]],
    ['valor_total', [/total/i, /valor.*total/i]],
    ['telefono', [/tel[eé]fono/i, /phone/i, /celular/i, /m[oó]vil/i]],
    ['email', [/email/i, /correo/i, /e-mail/i, /mail/i]],
    ['direccion', [/direcci[oó]n/i, /address/i, /domicilio/i]],
    ['ciudad', [/ciudad/i, /city/i, /municipio/i]],
    ['observaciones', [/observ/i, /notas/i, /notes/i, /comentario/i]],
  ];
  for (const [field, regexes] of patterns) {
    for (let i = 0; i < lower.length; i++) {
      if (regexes.some(rx => rx.test(headers[i] || ''))) {
        if (!Object.values(mapping).includes(headers[i])) {
          mapping[field] = headers[i];
          break;
        }
      }
    }
  }
  return mapping;
};

const VinculadosPoliza: React.FC<Props> = ({ polizaId }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<PolizaVinculado[]>([]);
  const [totales, setTotales] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PolizaVinculado | null>(null);
  const [form, setForm] = useState<Partial<PolizaVinculado>>({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PolizaVinculado | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Excel import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'map' | 'preview' | 'importing'>('upload');
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vinculadosService.list(polizaId);
      if (res.success) {
        setItems(res.data || []);
        setTotales(res.totales || null);
      }
    } catch (e) {
      console.error('Error loading vinculados:', e);
    } finally {
      setLoading(false);
    }
  }, [polizaId]);

  useEffect(() => { load(); }, [load]);

  // Auto-calcular valor_total
  useEffect(() => {
    const val = Number(form.valor) || 0;
    const vIva = Number(form.valor_iva) || 0;
    setForm(prev => ({ ...prev, valor_total: val + vIva }));
  }, [form.valor, form.valor_iva]);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const startEdit = (v: PolizaVinculado) => {
    setEditing(v);
    setForm({
      identificador: v.identificador || '',
      documento: v.documento || '',
      nombre_asegurado: v.nombre_asegurado || '',
      valor: v.valor || 0,
      valor_iva: v.valor_iva || 0,
      valor_total: v.valor_total || 0,
      estado: v.estado || 'activo',
      tipo_documento: v.tipo_documento || 'CC',
      telefono: v.telefono || '',
      email: v.email || '',
      direccion: v.direccion || '',
      ciudad: v.ciudad || '',
      observaciones: v.observaciones || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre_asegurado?.trim()) {
      toast({ title: 'Error', description: 'El nombre del asegurado es obligatorio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor: Number(form.valor) || 0,
        valor_iva: Number(form.valor_iva) || 0,
        valor_total: Number(form.valor_total) || 0,
      };
      if (editing?.id) {
        await vinculadosService.update(polizaId, editing.id, payload);
        toast({ title: 'Vinculado actualizado', description: `${form.nombre_asegurado} actualizado correctamente` });
      } else {
        await vinculadosService.create(polizaId, payload);
        toast({ title: 'Vinculado creado', description: `${form.nombre_asegurado} agregado a la póliza` });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: PolizaVinculado) => {
    try {
      await vinculadosService.remove(polizaId, v.id!);
      toast({ title: 'Vinculado eliminado', description: `${v.nombre_asegurado} eliminado` });
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ─── Bulk delete ───
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(v => v.id!)));
    }
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await vinculadosService.bulkDelete(polizaId, Array.from(selectedIds));
      toast({ title: 'Eliminación masiva', description: res.message || `${res.deleted_count || selectedIds.size} vinculados eliminados` });
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Error al eliminar', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  // ─── Excel import ───
  const openImportModal = () => {
    setImportModalOpen(true);
    setImportStep('upload');
    setExcelHeaders([]);
    setExcelRows([]);
    setColumnMapping({});
    setImportProgress(0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (json.length < 2) {
          toast({ title: 'Error', description: 'El archivo debe tener al menos una fila de encabezados y una de datos', variant: 'destructive' });
          return;
        }
        const headers = json[0].map((h: any) => String(h || '').trim());
        const rows = json.slice(1).filter((r: any[]) => r.some(c => c !== '' && c !== null && c !== undefined)).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
        setExcelHeaders(headers);
        setExcelRows(rows);
        setColumnMapping(autoDetectMapping(headers));
        setImportStep('map');
      } catch (err) {
        toast({ title: 'Error', description: 'No se pudo leer el archivo Excel', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const mappedPreview = useMemo(() => {
    if (!excelRows.length || !columnMapping.nombre_asegurado) return [];
    return excelRows.map(row => {
      const mapped: Partial<PolizaVinculado> = { estado: 'activo' };
      for (const field of MAPPABLE_FIELDS) {
        const col = columnMapping[field.key];
        if (col && row[col] !== undefined && row[col] !== '') {
          const val = row[col];
          if (['valor', 'valor_iva', 'valor_total'].includes(field.key)) {
            (mapped as any)[field.key] = Number(String(val).replace(/[^0-9.\-]/g, '')) || 0;
          } else {
            (mapped as any)[field.key] = String(val).trim();
          }
        }
      }
      // Auto-calc total if not mapped
      if (!columnMapping.valor_total && mapped.valor) {
        mapped.valor_total = (Number(mapped.valor) || 0) + (Number(mapped.valor_iva) || 0);
      }
      return mapped;
    }).filter(m => m.nombre_asegurado?.trim());
  }, [excelRows, columnMapping]);

  const handleImport = async () => {
    if (!mappedPreview.length) return;
    setImportStep('importing');
    setImportProgress(0);
    try {
      // Send in chunks of 100
      const chunkSize = 100;
      let total = 0;
      for (let i = 0; i < mappedPreview.length; i += chunkSize) {
        const chunk = mappedPreview.slice(i, i + chunkSize);
        await vinculadosService.bulkCreate(polizaId, chunk);
        total += chunk.length;
        setImportProgress(Math.round((total / mappedPreview.length) * 100));
      }
      toast({ title: 'Importación exitosa', description: `${total} vinculados importados correctamente` });
      setImportModalOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Error en importación', description: e?.message || 'Error al importar', variant: 'destructive' });
      setImportStep('preview');
    }
  };

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(v => {
      const matchSearch = !s || 
        (v.nombre_asegurado || '').toLowerCase().includes(s) ||
        (v.identificador || '').toLowerCase().includes(s) ||
        (v.documento || '').toLowerCase().includes(s);
      const matchEstado = !estadoFilter || v.estado === estadoFilter;
      return matchSearch && matchEstado;
    });
  }, [items, search, estadoFilter]);

  const estadoBadge = (estado?: string) => {
    switch (estado) {
      case 'activo': return <Badge color="success">Activo</Badge>;
      case 'inactivo': return <Badge color="gray">Inactivo</Badge>;
      case 'suspendido': return <Badge color="warning">Suspendido</Badge>;
      default: return <Badge color="info">{estado || '-'}</Badge>;
    }
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const allSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

  return (
    <Card>
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Vinculados</h3>
              <p className="text-xs text-gray-500">
                {items.length} vinculado{items.length !== 1 ? 's' : ''} registrado{items.length !== 1 ? 's' : ''}
                {totales ? ` • Total: ${formatCurrency(totales.valor_total)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button color="failure" size="sm" onClick={() => setConfirmBulkDelete(true)}>
                <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4 mr-1" />
                Eliminar ({selectedIds.size})
              </Button>
            )}
            <Button color="light" size="sm" onClick={load} disabled={loading}>
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            </Button>
            <Button color="light" size="sm" onClick={openImportModal}>
              <Icon icon="solar:upload-bold" className="w-4 h-4 mr-1" /> Importar Excel
            </Button>
            <Button color="primary" size="sm" onClick={startCreate}>
              <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" /> Agregar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, placa o documento..."
              sizing="sm"
            />
          </div>
          <Select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} sizing="sm">
            <option value="">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
            <option value="suspendido">Suspendidos</option>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-2 text-gray-500">Cargando vinculados...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">{items.length === 0 ? 'No hay vinculados' : 'Sin resultados'}</p>
            <p className="text-xs mt-1">
              {items.length === 0 ? 'Agrega vinculados manualmente o importa desde un Excel' : 'Ajusta los filtros de búsqueda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className="w-8 !px-2">
                  <Checkbox checked={allSelected} onChange={toggleSelectAll} />
                </Table.HeadCell>
                <Table.HeadCell className="w-8"></Table.HeadCell>
                <Table.HeadCell>Placa / ID</Table.HeadCell>
                <Table.HeadCell>Documento</Table.HeadCell>
                <Table.HeadCell>Asegurado</Table.HeadCell>
                <Table.HeadCell className="text-right">Valor</Table.HeadCell>
                <Table.HeadCell className="text-right">IVA</Table.HeadCell>
                <Table.HeadCell className="text-right">Total</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {filteredItems.map((v) => (
                  <React.Fragment key={v.id}>
                    <Table.Row className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedIds.has(v.id!) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                      <Table.Cell className="!px-2">
                        <Checkbox checked={selectedIds.has(v.id!)} onChange={() => toggleSelect(v.id!)} />
                      </Table.Cell>
                      <Table.Cell>
                        <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id!)} className="p-1 rounded hover:bg-gray-100">
                          <Icon icon={expandedId === v.id ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-4 h-4 text-gray-400" />
                        </button>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-xs font-medium">{v.identificador || '-'}</Table.Cell>
                      <Table.Cell className="text-xs">{v.tipo_documento ? `${v.tipo_documento}: ` : ''}{v.documento || '-'}</Table.Cell>
                      <Table.Cell className="text-sm font-medium">{v.nombre_asegurado}</Table.Cell>
                      <Table.Cell className="text-right text-xs">{formatCurrency(Number(v.valor))}</Table.Cell>
                      <Table.Cell className="text-right text-xs">{formatCurrency(Number(v.valor_iva))}</Table.Cell>
                      <Table.Cell className="text-right text-xs font-semibold">{formatCurrency(Number(v.valor_total))}</Table.Cell>
                      <Table.Cell>{estadoBadge(v.estado)}</Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(v)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Editar">
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDelete(v)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar">
                            <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                          </button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                    {/* Expanded detail row */}
                    {expandedId === v.id && (
                      <Table.Row>
                        <Table.Cell colSpan={10}>
                          <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg space-y-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div><span className="text-gray-500">Teléfono:</span> <span className="font-medium">{v.telefono || '-'}</span></div>
                              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{v.email || '-'}</span></div>
                              <div><span className="text-gray-500">Ciudad:</span> <span className="font-medium">{v.ciudad || '-'}</span></div>
                              <div><span className="text-gray-500">Dirección:</span> <span className="font-medium">{v.direccion || '-'}</span></div>
                            </div>
                            {v.observaciones && (
                              <div className="text-xs"><span className="text-gray-500">Observaciones:</span> <span>{v.observaciones}</span></div>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </React.Fragment>
                ))}
              </Table.Body>
            </Table>

            {/* Totals footer */}
            {totales && (
              <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between text-sm">
                <span className="font-semibold">{totales.cantidad} vinculado{totales.cantidad !== 1 ? 's' : ''}</span>
                <div className="flex gap-6">
                  <span>Valor: <strong>{formatCurrency(totales.valor)}</strong></span>
                  <span>IVA: <strong>{formatCurrency(totales.valor_iva)}</strong></span>
                  <span>Total: <strong>{formatCurrency(totales.valor_total)}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal show={modalOpen} onClose={() => setModalOpen(false)} size="7xl">
        <Modal.Header>{editing ? 'Editar Vinculado' : 'Nuevo Vinculado'}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">

            {/* Two-column top: Identificación + Documento/Contacto */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Identificación */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Identificación</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Asegurado <span className="text-red-500">*</span></label>
                    <TextInput sizing="sm" value={form.nombre_asegurado || ''} onChange={(e) => updateField('nombre_asegurado', e.target.value)} placeholder="Nombre completo" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Placa / ID</label>
                    <TextInput sizing="sm" value={form.identificador || ''} onChange={(e) => updateField('identificador', e.target.value.toUpperCase())} placeholder="ABC123" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo Doc.</label>
                    <Select sizing="sm" value={form.tipo_documento || 'CC'} onChange={(e) => updateField('tipo_documento', e.target.value)}>
                      <option value="CC">CC</option>
                      <option value="NIT">NIT</option>
                      <option value="CE">CE</option>
                      <option value="PAS">Pasaporte</option>
                      <option value="TI">TI</option>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Documento</label>
                    <TextInput sizing="sm" value={form.documento || ''} onChange={(e) => updateField('documento', e.target.value)} placeholder="1018426300" />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Contacto y ubicación</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Teléfono</label>
                    <TextInput sizing="sm" value={form.telefono || ''} onChange={(e) => updateField('telefono', e.target.value)} placeholder="300 123 4567" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                    <TextInput sizing="sm" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} placeholder="correo@ejemplo.com" type="email" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dirección</label>
                    <TextInput sizing="sm" value={form.direccion || ''} onChange={(e) => updateField('direccion', e.target.value)} placeholder="CR 7 # 127 48 P 5" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ciudad</label>
                    <TextInput sizing="sm" value={form.ciudad || ''} onChange={(e) => updateField('ciudad', e.target.value)} placeholder="Bogotá" />
                  </div>
                </div>
              </div>

            </div>

            {/* Two-column bottom: Valores + Estado/Obs */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Valores financieros */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Valores financieros</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor Prima</label>
                    <TextInput sizing="sm" type="number" value={form.valor || ''} onChange={(e) => updateField('valor', Number(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor IVA</label>
                    <TextInput sizing="sm" type="number" value={form.valor_iva || ''} onChange={(e) => updateField('valor_iva', Number(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor Total</label>
                    <TextInput sizing="sm" type="number" value={form.valor_total || ''} onChange={(e) => updateField('valor_total', Number(e.target.value) || 0)} placeholder="0" disabled className="bg-gray-50" />
                  </div>
                </div>
              </div>

              {/* Estado y observaciones */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Estado y notas</h4>
                <div className="space-y-2.5">
                  <div className="w-1/2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estado</label>
                    <Select sizing="sm" value={form.estado || 'activo'} onChange={(e) => updateField('estado', e.target.value)}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="suspendido">Suspendido</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observaciones</label>
                    <Textarea rows={2} value={form.observaciones || ''} onChange={(e) => updateField('observaciones', e.target.value)} placeholder="Notas adicionales..." className="text-sm" />
                  </div>
                </div>
              </div>

            </div>

          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" color="light" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button size="sm" color="primary" onClick={handleSave} disabled={saving || !form.nombre_asegurado?.trim()}>
            {saving ? <><Spinner size="sm" className="mr-1" />Guardando...</> : editing ? 'Guardar cambios' : 'Crear Vinculado'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal show={!!confirmDelete} onClose={() => setConfirmDelete(null)} size="md">
        <Modal.Header>Eliminar Vinculado</Modal.Header>
        <Modal.Body>
          <p className="text-sm">
            ¿Estás seguro de eliminar a <strong>{confirmDelete?.nombre_asegurado}</strong>
            {confirmDelete?.identificador ? ` (${confirmDelete.identificador})` : ''}?
            Esta acción no se puede deshacer.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button color="failure" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Eliminar</Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm Bulk Delete Modal */}
      <Modal show={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} size="md">
        <Modal.Header>Eliminar {selectedIds.size} vinculados</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <Icon icon="solar:danger-triangle-bold" className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  ¿Estás seguro de eliminar <strong>{selectedIds.size}</strong> vinculado{selectedIds.size !== 1 ? 's' : ''}?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">Esta acción no se puede deshacer.</p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}>Cancelar</Button>
          <Button color="failure" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? <><Spinner size="sm" className="mr-1" />Eliminando...</> : `Eliminar ${selectedIds.size} vinculados`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ═══ Excel Import Modal ═══ */}
      <Modal show={importModalOpen} onClose={() => importStep !== 'importing' && setImportModalOpen(false)} size="7xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:upload-bold" className="w-5 h-5 text-primary" />
            Importar Vinculados desde Excel
          </div>
        </Modal.Header>
        <Modal.Body>
          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div className="text-center py-8 space-y-4">
              <Icon icon="solar:file-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto" />
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">Selecciona un archivo Excel (.xlsx, .xls, .csv)</p>
                <p className="text-xs text-gray-500 mt-1">La primera fila debe contener los encabezados de las columnas</p>
              </div>
              <div className="max-w-md mx-auto">
                <FileInput
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  ref={fileInputRef as any}
                  sizing="sm"
                />
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {importStep === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white">Mapeo de columnas</h4>
                  <p className="text-xs text-gray-500">{excelRows.length} filas encontradas · Asigna cada columna del Excel al campo correspondiente</p>
                </div>
                <Badge color="info">{excelHeaders.length} columnas</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MAPPABLE_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className={`text-xs w-36 flex-shrink-0 ${field.required ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {field.label}
                    </label>
                    <Select
                      sizing="sm"
                      value={columnMapping[field.key] || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1"
                      color={field.required && !columnMapping[field.key] ? 'failure' : undefined}
                    >
                      <option value="">— No mapear —</option>
                      {excelHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview sample */}
              {columnMapping.nombre_asegurado && (
                <div>
                  <h5 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-2">Vista previa (primeras 3 filas)</h5>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          {MAPPABLE_FIELDS.filter(f => columnMapping[f.key]).map(f => (
                            <th key={f.key} className="px-2 py-1.5 text-left font-medium text-gray-500">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelRows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t">
                            {MAPPABLE_FIELDS.filter(f => columnMapping[f.key]).map(f => (
                              <td key={f.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{row[columnMapping[f.key]] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview mapped data */}
          {importStep === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white">Datos listos para importar</h4>
                  <p className="text-xs text-gray-500">{mappedPreview.length} registros válidos de {excelRows.length} filas</p>
                </div>
                <Badge color="success" className="text-sm">{mappedPreview.length} vinculados</Badge>
              </div>

              <div className="overflow-x-auto max-h-80 border rounded-lg">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">#</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">Nombre</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">ID / Placa</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">Documento</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-500">Valor</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                        <td className="px-2 py-1 font-medium">{row.nombre_asegurado}</td>
                        <td className="px-2 py-1 font-mono">{row.identificador || '-'}</td>
                        <td className="px-2 py-1">{row.documento || '-'}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(Number(row.valor) || 0)}</td>
                        <td className="px-2 py-1 text-right font-semibold">{formatCurrency(Number(row.valor_total) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Importing progress */}
          {importStep === 'importing' && (
            <div className="text-center py-12 space-y-4">
              <Spinner size="xl" />
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">Importando vinculados...</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round(importProgress)}% completado</p>
              </div>
              <div className="max-w-md mx-auto">
                <Progress progress={importProgress} color="blue" size="lg" />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {importStep === 'upload' && (
            <Button color="light" onClick={() => setImportModalOpen(false)}>Cancelar</Button>
          )}
          {importStep === 'map' && (
            <>
              <Button color="light" onClick={() => setImportStep('upload')}>
                <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-1" /> Volver
              </Button>
              <Button
                color="primary"
                onClick={() => setImportStep('preview')}
                disabled={!columnMapping.nombre_asegurado || mappedPreview.length === 0}
              >
                Vista previa ({mappedPreview.length} registros) <Icon icon="solar:arrow-right-bold" className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          {importStep === 'preview' && (
            <>
              <Button color="light" onClick={() => setImportStep('map')}>
                <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-1" /> Volver a mapeo
              </Button>
              <Button color="primary" onClick={handleImport} disabled={mappedPreview.length === 0}>
                <Icon icon="solar:upload-bold" className="w-4 h-4 mr-1" /> Importar {mappedPreview.length} vinculados
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default VinculadosPoliza;

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, Table, TextInput, Select, Badge, Spinner, Checkbox, Textarea } from 'flowbite-react';
import { polizaService } from 'src/services/polizaService';

type Props = { polizaId: string; numeroPoliza: string };

type Anexo = {
  id: string;
  anexo_number: string;
  insurance_company: string;
  branch: string;
  risk: string;
  fawf?: string;
  start_date: string;
  end_date: string;
  issue_date?: string;
  reception_date?: string;
  renewable: boolean;
  prima_neta: number;
  gastos_expedicion?: number;
  vat_percentage?: number;
  pri_a_pre?: number;
  iva?: number;
  commission_percentage?: number;
  commission_amount?: number;
  total_amount?: number;
  payment_frequency?: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  payment_method?: 'cash' | 'transfer' | 'check' | 'card' | 'financing';
  comision_pagada?: boolean;
  observaciones?: string;
  accesorios?: string;
  motivo?: string;
  status: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | 'PENDIENTE';
};

const Estados = ['ACTIVA','VENCIDA','CANCELADA','SUSPENDIDA','PENDIENTE'] as const;

const AnexosPoliza: React.FC<Props> = ({ polizaId, numeroPoliza }) => {
  const [items, setItems] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Anexo | null>(null);
  const [filters, setFilters] = useState({ search: '', estado: '' });
  const [autoCalcularIva, setAutoCalcularIva] = useState(true);
  const [editarPorcentajeComision, setEditarPorcentajeComision] = useState(false);
  const [editarComision, setEditarComision] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    numero_poliza: numeroPoliza,
    anexo: '',
    riesgo: '',
    renovable: false as boolean | undefined,
    motivo: '',
    fecha_expedicion: '',
    fecha_inicio: '',
    fecha_fin: '',
    fecha_recepcion: '',
    prima: '' as unknown as number,
    porcentaje_iva: 19 as unknown as number,
    pri_a_pre: '' as unknown as number,
    iva: '' as unknown as number,
    porcentaje_comision: '' as unknown as number,
    comision: '' as unknown as number,
    total: '' as unknown as number,
    periodicidad_pago: '' as unknown as 'mensual'|'trimestral'|'semestral'|'anual'|'',
    forma_pago: '' as unknown as 'efectivo'|'transferencia'|'cheque'|'tarjeta'|'financiacion'|'',
    observaciones: '',
    accesorios: '',
    estado: 'ACTIVA' as Anexo['status'],
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await polizaService.listarAnexos(polizaId);
      if (res.success) setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [polizaId]);

  const startCreate = () => {
    setEditing(null);
    setForm({
      numero_poliza: numeroPoliza,
      anexo: '',
      riesgo: '',
      renovable: false,
      motivo: '',
      fecha_expedicion: '',
      fecha_inicio: '',
      fecha_fin: '',
      fecha_recepcion: '',
      prima: '' as unknown as number,
      porcentaje_iva: 19 as unknown as number,
      pri_a_pre: '' as unknown as number,
      iva: '' as unknown as number,
      porcentaje_comision: '' as unknown as number,
      comision: '' as unknown as number,
      total: '' as unknown as number,
      periodicidad_pago: '' as any,
      forma_pago: '' as any,
      observaciones: '',
      accesorios: '',
      estado: 'ACTIVA',
    });
    setFiles([]);
    setAutoCalcularIva(true);
    setEditarPorcentajeComision(false);
    setEditarComision(false);
    setModalOpen(true);
  };

  const startEdit = (a: Anexo) => {
    setEditing(a);
    setForm({
      numero_poliza: numeroPoliza,
      anexo: a.anexo_number,
      riesgo: a.risk,
      renovable: a.renewable,
      motivo: a.motivo || '',
      fecha_expedicion: a.issue_date?.slice(0,10) || '',
      fecha_inicio: a.start_date?.slice(0,10) || '',
      fecha_fin: a.end_date?.slice(0,10) || '',
      fecha_recepcion: a.reception_date?.slice(0,10) || '',
      prima: a.prima_neta,
      porcentaje_iva: (a.vat_percentage as any) ?? (19 as any),
      pri_a_pre: a.pri_a_pre ?? ('' as any),
      iva: a.iva ?? ('' as any),
      porcentaje_comision: a.commission_percentage ?? ('' as any),
      comision: a.commission_amount ?? ('' as any),
      total: a.total_amount ?? ('' as any),
      periodicidad_pago: (a.payment_frequency ? ({monthly:'mensual',quarterly:'trimestral',biannual:'semestral',annual:'anual'} as any)[a.payment_frequency] : '') as any,
      forma_pago: (a.payment_method ? ({cash:'efectivo',transfer:'transferencia',check:'cheque',card:'tarjeta',financing:'financiacion'} as any)[a.payment_method] : '') as any,
      observaciones: a.observaciones || '',
      accesorios: a.accesorios || '',
      estado: a.status,
    });
    setFiles([]);
    setFormErrors({});
    setAutoCalcularIva(false);
    setEditarPorcentajeComision(true);
    setEditarComision(false);
    setModalOpen(true);
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!String(form.anexo || '').trim()) errors.anexo = 'Campo obligatorio';
    if (!String(form.estado || '').trim()) errors.estado = 'Campo obligatorio';
    if (!String(form.fecha_expedicion || '').trim()) errors.fecha_expedicion = 'Campo obligatorio';
    if (!String(form.fecha_inicio || '').trim()) errors.fecha_inicio = 'Campo obligatorio';
    if (!String(form.fecha_fin || '').trim()) errors.fecha_fin = 'Campo obligatorio';
    if (!errors.fecha_inicio && !errors.fecha_fin) {
      const fi = new Date(form.fecha_inicio as string);
      const ff = new Date(form.fecha_fin as string);
      if (isNaN(fi.getTime())) errors.fecha_inicio = 'Fecha inválida';
      if (isNaN(ff.getTime())) errors.fecha_fin = 'Fecha inválida';
      if (!errors.fecha_inicio && !errors.fecha_fin && ff.getTime() < fi.getTime()) {
        errors.fecha_fin = 'Debe ser posterior o igual a la fecha de inicio';
      }
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        prima: Number(form.prima || 0),
        gastos_expedicion: (form as any).gastos_expedicion !== ('' as unknown as number) ? Number((form as any).gastos_expedicion) : undefined,
        porcentaje_iva: form.porcentaje_iva !== ('' as unknown as number) ? Number(form.porcentaje_iva) : undefined,
        pri_a_pre: form.pri_a_pre !== ('' as unknown as number) ? Number(form.pri_a_pre) : undefined,
        iva: form.iva !== ('' as unknown as number) ? Number(form.iva) : undefined,
        porcentaje_comision: form.porcentaje_comision !== ('' as unknown as number) ? Number(form.porcentaje_comision) : undefined,
        comision: form.comision !== ('' as unknown as number) ? Number(form.comision) : undefined,
        total: form.total !== ('' as unknown as number) ? Number(form.total) : undefined,
      };
      
      let anexoId: string;
      if (editing) {
        await polizaService.actualizarAnexo(polizaId, String((editing as any).id), payload);
        anexoId = String((editing as any).id);
      } else {
        const response = await polizaService.crearAnexo(polizaId, payload);
        anexoId = response.data?.id ? String(response.data.id) : '';
      }
      
      // Subir archivos si hay alguno seleccionado
      if (files.length > 0 && anexoId) {
        try {
          await polizaService.subirDocumentosAnexo(polizaId, anexoId, files);
        } catch (error) {
          console.error('Error al subir archivos:', error);
          // No bloqueamos el flujo si falla la subida de archivos
        }
      }
      
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Error al guardar anexo:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (a: Anexo) => {
    await polizaService.eliminarAnexo(polizaId, String((a as any).id));
    await load();
  };

  const list = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    return items.filter(it => {
      const okS = !s || `${it.anexo_number} ${it.risk} ${it.insurance_company} ${it.branch}`.toLowerCase().includes(s);
      const okE = !filters.estado || it.status === filters.estado;
      return okS && okE;
    });
  }, [items, filters]);

  return (
    <Card>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TextInput placeholder="Buscar anexo, riesgo, aseguradora..." value={filters.search} onChange={(e)=>setFilters(f=>({...f,search:e.target.value}))} />
            <Select value={filters.estado} onChange={(e)=>setFilters(f=>({...f,estado:e.target.value}))}>
              <option value="">Todos</option>
              {Estados.map(e=> <option key={e} value={e}>{e}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button color="light" onClick={()=>load()}>
              {loading ? <Spinner size="sm" /> : 'Actualizar'}
            </Button>
            <Button color="primary" onClick={startCreate}>Nuevo anexo</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center py-6 text-gray-500"><Spinner /><span className="ml-2">Cargando...</span></div>
        ) : list.length === 0 ? (
          <div className="text-sm text-gray-500 py-6">No hay anexos aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Anexo</Table.HeadCell>
                <Table.HeadCell>Aseguradora</Table.HeadCell>
                <Table.HeadCell>Ramo</Table.HeadCell>
                <Table.HeadCell>Riesgo</Table.HeadCell>
                <Table.HeadCell>Vigencia</Table.HeadCell>
                <Table.HeadCell>Prima</Table.HeadCell>
                <Table.HeadCell>% IVA</Table.HeadCell>
                <Table.HeadCell>IVA</Table.HeadCell>
                <Table.HeadCell>% Com.</Table.HeadCell>
                <Table.HeadCell>Comisión</Table.HeadCell>
                <Table.HeadCell>Total</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell></Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {list.map((a)=> (
                  <Table.Row key={(a as any).id}>
                    <Table.Cell className="font-medium">{a.anexo_number}</Table.Cell>
                    <Table.Cell>{a.insurance_company}</Table.Cell>
                    <Table.Cell>{a.branch}</Table.Cell>
                    <Table.Cell className="max-w-[260px] truncate" title={a.risk}>{a.risk}</Table.Cell>
                    <Table.Cell>{a.start_date?.slice(0,10)} → {a.end_date?.slice(0,10)}</Table.Cell>
                    <Table.Cell>${Number(a.prima_neta).toLocaleString()}</Table.Cell>
                    <Table.Cell>{a.vat_percentage ?? '-'}</Table.Cell>
                    <Table.Cell>{a.iva != null ? `$${Number(a.iva).toLocaleString()}` : '-'}</Table.Cell>
                    <Table.Cell>{a.commission_percentage ?? '-'}</Table.Cell>
                    <Table.Cell>{a.commission_amount != null ? `$${Number(a.commission_amount).toLocaleString()}` : '-'}</Table.Cell>
                    <Table.Cell>{a.total_amount != null ? `$${Number(a.total_amount).toLocaleString()}` : '-'}</Table.Cell>
                    <Table.Cell><Badge color={a.status==='ACTIVA'?'success':a.status==='VENCIDA'?'failure':'warning'}>{a.status}</Badge></Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button size="xs" color="info" onClick={()=>startEdit(a)}>Editar</Button>
                        <Button size="xs" color="failure" onClick={()=>removeItem(a)}>Eliminar</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}

        <Modal show={modalOpen} onClose={()=>setModalOpen(false)} size="lg">
          <Modal.Header>{editing ? 'Editar anexo' : 'Nuevo anexo'}</Modal.Header>
          <Modal.Body>
            <div className="space-y-5">
              {/* Información del anexo */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Información del anexo</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Número <span className="text-red-600">*</span></label>
                    <TextInput value={form.anexo} onChange={(e)=>setForm(f=>({...f, anexo: e.target.value}))} required />
                    {formErrors.anexo && (<div className="text-xs text-red-600 mt-1">{formErrors.anexo}</div>)}
                  </div>
                  <div className="md:col-span-1 xl:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Riesgo</label>
                    <TextInput value={form.riesgo} onChange={(e)=>setForm(f=>({...f, riesgo: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Renovable</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox checked={!!form.renovable} onChange={(e)=>setForm(f=>({...f, renovable: e.target.checked}))} />
                      <span className="text-sm">Sí</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 xl:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Motivo</label>
                    <TextInput value={form.motivo} onChange={(e)=>setForm(f=>({...f, motivo: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Vigencia */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Vigencia</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha de expedición <span className="text-red-600">*</span></label>
                    <TextInput type="date" value={form.fecha_expedicion} onChange={(e)=>setForm(f=>({...f, fecha_expedicion: e.target.value}))} required />
                    {formErrors.fecha_expedicion && (<div className="text-xs text-red-600 mt-1">{formErrors.fecha_expedicion}</div>)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha inicio <span className="text-red-600">*</span></label>
                    <TextInput type="date" value={form.fecha_inicio} onChange={(e)=>setForm(f=>({...f, fecha_inicio: e.target.value}))} required />
                    {formErrors.fecha_inicio && (<div className="text-xs text-red-600 mt-1">{formErrors.fecha_inicio}</div>)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha fin <span className="text-red-600">*</span></label>
                    <TextInput type="date" value={form.fecha_fin} onChange={(e)=>setForm(f=>({...f, fecha_fin: e.target.value}))} required />
                    {formErrors.fecha_fin && (<div className="text-xs text-red-600 mt-1">{formErrors.fecha_fin}</div>)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha de recepción</label>
                    <TextInput type="date" value={form.fecha_recepcion} onChange={(e)=>setForm(f=>({...f, fecha_recepcion: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Montos e impuestos */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Montos e impuestos</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prima neta</label>
                    <TextInput type="number" min="0" value={String(form.prima ?? '')} onChange={(e)=>setForm(f=>({...f, prima: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">% IVA Prima</label>
                    <TextInput type="number" step="0.01" min="0" max="100" value={String(form.porcentaje_iva ?? '')} onChange={(e)=>setForm(f=>({...f, porcentaje_iva: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pri a Pre</label>
                    <TextInput type="number" min="0" value={String(form.pri_a_pre ?? '')} onChange={(e)=>setForm(f=>({...f, pri_a_pre: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gastos expedición</label>
                    <TextInput type="number" min="0" value={String((form as any).gastos_expedicion ?? '')} onChange={(e)=>setForm(f=>({...f, gastos_expedicion: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IVA</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <TextInput disabled={autoCalcularIva} type="number" min="0" value={String(form.iva ?? '')} onChange={(e)=>setForm(f=>({...f, iva: (e.target.value as unknown as number)}))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={autoCalcularIva} onChange={(e)=>setAutoCalcularIva(e.target.checked)} />
                        <span className="text-sm">Calcular</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">% Comisión</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <TextInput disabled={!editarPorcentajeComision} type="number" step="0.01" min="0" max="100" value={String(form.porcentaje_comision ?? '')} onChange={(e)=>setForm(f=>({...f, porcentaje_comision: (e.target.value as unknown as number)}))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={editarPorcentajeComision} onChange={(e)=>setEditarPorcentajeComision(e.target.checked)} />
                        <span className="text-sm">Editar</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Comisión</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <TextInput disabled={!editarComision} type="number" min="0" value={String(form.comision ?? '')} onChange={(e)=>setForm(f=>({...f, comision: (e.target.value as unknown as number)}))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={editarComision} onChange={(e)=>setEditarComision(e.target.checked)} />
                        <span className="text-sm">Editar</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total</label>
                    <TextInput type="number" min="0" value={String(form.total ?? '')} onChange={(e)=>setForm(f=>({...f, total: (e.target.value as unknown as number)}))} />
                  </div>
                </div>
              </div>

              {/* Pago y estado */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pago y estado</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Periodicidad del pago</label>
                    <Select value={form.periodicidad_pago as any} onChange={(e)=>setForm(f=>({...f, periodicidad_pago: e.target.value as any}))}>
                      <option value="">Seleccione</option>
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Forma Pago</label>
                    <Select value={form.forma_pago as any} onChange={(e)=>setForm(f=>({...f, forma_pago: e.target.value as any}))}>
                      <option value="">Seleccione</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="cheque">Cheque</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="financiacion">Financiación</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado <span className="text-red-600">*</span></label>
                    <Select value={form.estado} onChange={(e)=>setForm(f=>({...f, estado: e.target.value as any}))}>
                      {Estados.map(e=> <option key={e} value={e}>{e}</option>)}
                    </Select>
                    {formErrors.estado && (<div className="text-xs text-red-600 mt-1">{formErrors.estado}</div>)}
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notas</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observaciones</label>
                    <Textarea rows={3} value={form.observaciones} onChange={(e)=>setForm(f=>({...f, observaciones: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accesorios</label>
                    <Textarea rows={3} value={form.accesorios} onChange={(e)=>setForm(f=>({...f, accesorios: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Archivos */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Carga de archivos</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Seleccionar archivo(s)</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e)=> setFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">PDF, imágenes, Office, CSV • Máx 20MB</p>
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-gray-600">Archivos seleccionados:</p>
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="truncate">{file.name}</span>
                          <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="light" onClick={()=>setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button color="primary" onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {files.length > 0 ? 'Guardando y subiendo archivos...' : 'Guardando...'}
                </>
              ) : (
                editing ? 'Guardar cambios' : 'Crear anexo'
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </Card>
  );
};

export default AnexosPoliza;



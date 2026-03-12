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

        <Modal show={modalOpen} onClose={()=>setModalOpen(false)} size="7xl">
          <Modal.Header>{editing ? 'Editar anexo' : 'Nuevo anexo'}</Modal.Header>
          <Modal.Body>
            <div className="space-y-4">

              {/* Two-column top layout: Info + Vigencia side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                {/* Información del anexo */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Información del anexo</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Número <span className="text-red-500">*</span></label>
                      <TextInput sizing="sm" value={form.anexo} onChange={(e)=>setForm(f=>({...f, anexo: e.target.value}))} required />
                      {formErrors.anexo && (<div className="text-[10px] text-red-600 mt-0.5">{formErrors.anexo}</div>)}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Riesgo</label>
                      <TextInput sizing="sm" value={form.riesgo} onChange={(e)=>setForm(f=>({...f, riesgo: e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Renovable</label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Checkbox checked={!!form.renovable} onChange={(e)=>setForm(f=>({...f, renovable: e.target.checked}))} />
                        <span className="text-xs">Sí</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motivo</label>
                      <TextInput sizing="sm" value={form.motivo} onChange={(e)=>setForm(f=>({...f, motivo: e.target.value}))} />
                    </div>
                  </div>
                </div>

                {/* Vigencia */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Vigencia</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expedición <span className="text-red-500">*</span></label>
                      <TextInput sizing="sm" type="date" value={form.fecha_expedicion} onChange={(e)=>setForm(f=>({...f, fecha_expedicion: e.target.value}))} />
                      {formErrors.fecha_expedicion && (<div className="text-[10px] text-red-600 mt-0.5">{formErrors.fecha_expedicion}</div>)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Inicio <span className="text-red-500">*</span></label>
                      <TextInput sizing="sm" type="date" value={form.fecha_inicio} onChange={(e)=>setForm(f=>({...f, fecha_inicio: e.target.value}))} />
                      {formErrors.fecha_inicio && (<div className="text-[10px] text-red-600 mt-0.5">{formErrors.fecha_inicio}</div>)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fin <span className="text-red-500">*</span></label>
                      <TextInput sizing="sm" type="date" value={form.fecha_fin} onChange={(e)=>setForm(f=>({...f, fecha_fin: e.target.value}))} />
                      {formErrors.fecha_fin && (<div className="text-[10px] text-red-600 mt-0.5">{formErrors.fecha_fin}</div>)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recepción</label>
                      <TextInput sizing="sm" type="date" value={form.fecha_recepcion} onChange={(e)=>setForm(f=>({...f, fecha_recepcion: e.target.value}))} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Montos e impuestos - full width */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Montos e impuestos</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prima neta</label>
                    <TextInput sizing="sm" type="number" min="0" value={String(form.prima ?? '')} onChange={(e)=>setForm(f=>({...f, prima: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% IVA</label>
                    <TextInput sizing="sm" type="number" step="0.01" min="0" max="100" value={String(form.porcentaje_iva ?? '')} onChange={(e)=>setForm(f=>({...f, porcentaje_iva: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pri a Pre</label>
                    <TextInput sizing="sm" type="number" min="0" value={String(form.pri_a_pre ?? '')} onChange={(e)=>setForm(f=>({...f, pri_a_pre: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gastos exp.</label>
                    <TextInput sizing="sm" type="number" min="0" value={String((form as any).gastos_expedicion ?? '')} onChange={(e)=>setForm(f=>({...f, gastos_expedicion: (e.target.value as unknown as number)}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">IVA</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><TextInput sizing="sm" disabled={autoCalcularIva} type="number" min="0" value={String(form.iva ?? '')} onChange={(e)=>setForm(f=>({...f, iva: (e.target.value as unknown as number)}))} /></div>
                      <div className="flex items-center gap-1"><Checkbox checked={autoCalcularIva} onChange={(e)=>setAutoCalcularIva(e.target.checked)} /><span className="text-[10px]">Auto</span></div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Comisión</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><TextInput sizing="sm" disabled={!editarPorcentajeComision} type="number" step="0.01" min="0" max="100" value={String(form.porcentaje_comision ?? '')} onChange={(e)=>setForm(f=>({...f, porcentaje_comision: (e.target.value as unknown as number)}))} /></div>
                      <div className="flex items-center gap-1"><Checkbox checked={editarPorcentajeComision} onChange={(e)=>setEditarPorcentajeComision(e.target.checked)} /><span className="text-[10px]">Edit</span></div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Comisión</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><TextInput sizing="sm" disabled={!editarComision} type="number" min="0" value={String(form.comision ?? '')} onChange={(e)=>setForm(f=>({...f, comision: (e.target.value as unknown as number)}))} /></div>
                      <div className="flex items-center gap-1"><Checkbox checked={editarComision} onChange={(e)=>setEditarComision(e.target.checked)} /><span className="text-[10px]">Edit</span></div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total</label>
                    <TextInput sizing="sm" type="number" min="0" value={String(form.total ?? '')} onChange={(e)=>setForm(f=>({...f, total: (e.target.value as unknown as number)}))} />
                  </div>
                </div>
              </div>

              {/* Three-column bottom: Pago+Estado | Notas | Archivos */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                {/* Pago y estado */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Pago y estado</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Periodicidad</label>
                        <Select sizing="sm" value={form.periodicidad_pago as any} onChange={(e)=>setForm(f=>({...f, periodicidad_pago: e.target.value as any}))}>
                          <option value="">Seleccione</option>
                          <option value="mensual">Mensual</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Forma pago</label>
                        <Select sizing="sm" value={form.forma_pago as any} onChange={(e)=>setForm(f=>({...f, forma_pago: e.target.value as any}))}>
                          <option value="">Seleccione</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="cheque">Cheque</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="financiacion">Financiación</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estado <span className="text-red-500">*</span></label>
                      <Select sizing="sm" value={form.estado} onChange={(e)=>setForm(f=>({...f, estado: e.target.value as any}))}>
                        {Estados.map(e=> <option key={e} value={e}>{e}</option>)}
                      </Select>
                      {formErrors.estado && (<div className="text-[10px] text-red-600 mt-0.5">{formErrors.estado}</div>)}
                    </div>
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Notas</h4>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observaciones</label>
                      <Textarea rows={2} value={form.observaciones} onChange={(e)=>setForm(f=>({...f, observaciones: e.target.value}))} className="text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Accesorios</label>
                      <Textarea rows={2} value={form.accesorios} onChange={(e)=>setForm(f=>({...f, accesorios: e.target.value}))} className="text-sm" />
                    </div>
                  </div>
                </div>

                {/* Archivos */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide pb-1.5 mb-2.5 border-b border-gray-200 dark:border-gray-700">Archivos</h4>
                  <div>
                    <input
                      type="file"
                      multiple
                      onChange={(e)=> setFiles(e.target.files ? Array.from(e.target.files) : [])}
                      className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">PDF, imágenes, Office, CSV • Máx 20MB</p>
                    {files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {files.map((file, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <span className="text-gray-400">({(file.size / 1024).toFixed(0)}K)</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" color="light" onClick={()=>setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" color="primary" onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-1" />
                  {files.length > 0 ? 'Guardando...' : 'Guardando...'}
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



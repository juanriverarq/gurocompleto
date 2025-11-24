import React, { useEffect, useState } from 'react';
import { Card, Button, Table, TextInput, Label, Spinner, Modal, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import saasApi from 'src/services/saasApi';
import { useLocation, useNavigate } from 'react-router-dom';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

interface Automovil {
  id: number;
  placa: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  vin?: string;
  color?: string;
  client_id?: number;
  poliza_id?: number;
  client_name?: string;
  policy_number?: string;
  // Campos extendidos
  tipo_servicio?: string;
  clase?: string;
  linea?: string;
  tipo_carroceria?: string;
  numero_motor?: string;
  numero_chasis?: string;
  numero_serie?: string;
  cilindraje?: number;
  combustible?: string;
  capacidad_pasajeros?: number;
  capacidad_carga_kg?: number;
  tipo_transmision?: string;
  traccion?: string;
  pais_origen?: string;
  // Catálogo IDs
  brand_id?: number | null;
  model_id?: number | null;
  line_id?: number | null;
}

const formatMoney = (n?: number | null) => {
  if (n === undefined || n === null) return '-';
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
};

const Automoviles: React.FC = () => {
  const [items, setItems] = useState<Automovil[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  const [filters, setFilters] = useState<{ search?: string; page?: number; per_page?: number }>({
    per_page: 15,
    page: 1,
    search: '',
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<Automovil>>({
    placa: '',
    marca: '',
    modelo: '',
    brand_id: null,
    model_id: null,
    line_id: null,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Automovil>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission ? hasPermission('automoviles', 'crear') : false;
  const canEdit = hasPermission ? hasPermission('automoviles', 'editar') : false;
  const canDelete = hasPermission ? hasPermission('automoviles', 'eliminar') : false;

  // Autocompletar cliente/póliza
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<Array<{ id: number; label: string }>>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [policyQuery, setPolicyQuery] = useState('');
  const [policyResults, setPolicyResults] = useState<Array<{ id: number; label: string }>>([]);
  const [policyLoading, setPolicyLoading] = useState(false);

  // Catálogos
  const [brands, setBrands] = useState<Array<{ id: number; name: string }>>([]);
  const [models, setModels] = useState<Array<{ id: number; name: string; brand_id: number }>>([]);
  const [lines, setLines] = useState<Array<{ id: number; name: string; model_id: number }>>([]);

  const [eBrands, setEBrands] = useState<Array<{ id: number; name: string }>>([]);
  const [eModels, setEModels] = useState<Array<{ id: number; name: string; brand_id: number }>>([]);
  const [eLines, setELines] = useState<Array<{ id: number; name: string; model_id: number }>>([]);

  const [insuredValue, setInsuredValue] = useState<number | null>(null);
  const [insuredValueEdit, setInsuredValueEdit] = useState<number | null>(null);
  const [clases, setClases] = useState<string[]>([]);
  const [ref1Opts, setRef1Opts] = useState<string[]>([]);
  const [ref2Opts, setRef2Opts] = useState<string[]>([]);
  const [ref3Opts, setRef3Opts] = useState<string[]>([]);
  const [claseSel, setClaseSel] = useState<string>('');
  const [ref1Sel, setRef1Sel] = useState<string>('');
  const [ref2Sel, setRef2Sel] = useState<string>('');
  const [ref3Sel, setRef3Sel] = useState<string>('');

  const [eClases, setEClases] = useState<string[]>([]);
  const [eRef1Opts, setERef1Opts] = useState<string[]>([]);
  const [eRef2Opts, setERef2Opts] = useState<string[]>([]);
  const [eRef3Opts, setERef3Opts] = useState<string[]>([]);
  const [eClaseSel, setEClaseSel] = useState<string>('');
  const [eRef1Sel, setERef1Sel] = useState<string>('');
  const [eRef2Sel, setERef2Sel] = useState<string>('');
  const [eRef3Sel, setERef3Sel] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await saasApi.getAutomoviles(filters);
      const payload: any = res.data || {};
      setItems(payload.data || []);
      setPagination({
        current_page: payload.current_page || 1,
        last_page: payload.last_page || 1,
        total: payload.total || 0,
        per_page: payload.per_page || 15,
        from: payload.from || 0,
        to: payload.to || 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.page, filters.per_page, filters.search]);

  // Abrir modal de edición por param open_auto_id desde el buscador global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_auto_id');
    if (openId) {
      if (!showEdit || String(editingId || '') !== String(openId)) {
        openAutoById(String(openId));
      }
    }
  }, [location.search]);

  // Cargar marcas al abrir modal crear
  useEffect(() => {
    if (!showCreate) return;
    (async () => {
      const resp = await saasApi.getAutomovilCatalogos();
      const data = (resp.data || {}) as any;
      setBrands(data.brands || []);
      setModels([]);
      setLines([]);
      setInsuredValue(null);
      setClases([]);
      setRef1Opts([]);
      setRef2Opts([]);
      setRef3Opts([]);
      setClaseSel('');
      setRef1Sel('');
      setRef2Sel('');
      setRef3Sel('');
    })();
  }, [showCreate]);

  // Cargar modelos cuando cambia brand en crear
  useEffect(() => {
    if (!showCreate) return;
    (async () => {
      if (form.brand_id) {
        const resp = await saasApi.getAutomovilCatalogos({ brand_id: Number(form.brand_id) });
        const data = (resp.data || {}) as any;
        setModels(data.models || []);
        setLines([]);
        setForm((p) => ({ ...p, model_id: null, line_id: null }));
        setInsuredValue(null);
        // cargar opciones clase/ref por brand+model
        const resp2 = await saasApi.getAutomovilCatalogos({
          brand_id: Number(form.brand_id),
          model_id: Number(form.model_id),
        } as any);
        const d2 = (resp2.data || {}) as any;
        setClases(d2.clases || []);
        setRef1Opts(d2.referencia1_opts || []);
        setRef2Opts(d2.referencia2_opts || []);
        setRef3Opts(d2.referencia3_opts || []);
        setClaseSel('');
        setRef1Sel('');
        setRef2Sel('');
        setRef3Sel('');
      }
    })();
  }, [showCreate, form.brand_id]);

  // Cargar líneas cuando cambia model en crear + insured value
  useEffect(() => {
    if (!showCreate) return;
    (async () => {
      if (form.model_id) {
        const resp = await saasApi.getAutomovilCatalogos({ model_id: Number(form.model_id) });
        const data = (resp.data || {}) as any;
        setLines(data.lines || []);
        // valor asegurado sin línea
        if (form.brand_id) {
          const v = await saasApi.getAutomovilInsuredValue({
            brand_id: Number(form.brand_id),
            model_id: Number(form.model_id),
          });
          setInsuredValue((v.data as any)?.insured_value ?? null);
        }
        setForm((p) => ({ ...p, line_id: null }));
        // cargar opciones clase/ref por brand+model
        const resp2 = await saasApi.getAutomovilCatalogos({
          brand_id: Number(form.brand_id),
          model_id: Number(form.model_id),
        } as any);
        const d2 = (resp2.data || {}) as any;
        setClases(d2.clases || []);
        setRef1Opts(d2.referencia1_opts || []);
        setRef2Opts(d2.referencia2_opts || []);
        setRef3Opts(d2.referencia3_opts || []);
        setClaseSel('');
        setRef1Sel('');
        setRef2Sel('');
        setRef3Sel('');
      }
    })();
  }, [showCreate, form.model_id]);

  // Actualizar insured value al seleccionar línea
  useEffect(() => {
    (async () => {
      if (!showCreate) return;
      if (form.brand_id && form.model_id) {
        const v = await saasApi.getAutomovilInsuredValue({
          brand_id: Number(form.brand_id),
          model_id: Number(form.model_id),
          line_id: form.line_id ? Number(form.line_id) : undefined,
        });
        setInsuredValue((v.data as any)?.insured_value ?? null);
        // refrescar cascada con line
        const resp3 = await saasApi.getAutomovilCatalogos({
          brand_id: Number(form.brand_id),
          model_id: Number(form.model_id),
          line_id: form.line_id ? Number(form.line_id) : undefined,
        } as any);
        const d3 = (resp3.data || {}) as any;
        setClases(d3.clases || []);
        setRef1Opts(d3.referencia1_opts || []);
        setRef2Opts(d3.referencia2_opts || []);
        setRef3Opts(d3.referencia3_opts || []);
        setClaseSel('');
        setRef1Sel('');
        setRef2Sel('');
        setRef3Sel('');
      }
    })();
  }, [showCreate, form.line_id]);

  // Cargar catálogos cuando se abre editar
  useEffect(() => {
    if (!showEdit) return;
    (async () => {
      const resp = await saasApi.getAutomovilCatalogos();
      const data = (resp.data || {}) as any;
      setEBrands(data.brands || []);
      // Si existe brand_id, precargar modelos
      if (editForm.brand_id) {
        const m = await saasApi.getAutomovilCatalogos({ brand_id: Number(editForm.brand_id) });
        setEModels((m.data || {}).models || []);
      } else {
        setEModels([]);
      }
      // Si existe model_id, precargar líneas y valor
      if (editForm.model_id) {
        const l = await saasApi.getAutomovilCatalogos({ model_id: Number(editForm.model_id) });
        setELines((l.data || {}).lines || []);
        if (editForm.brand_id) {
          const v = await saasApi.getAutomovilInsuredValue({
            brand_id: Number(editForm.brand_id),
            model_id: Number(editForm.model_id),
            line_id: editForm.line_id ? Number(editForm.line_id) : undefined,
          });
          setInsuredValueEdit((v.data as any)?.insured_value ?? null);
        }
      } else {
        setELines([]);
        setInsuredValueEdit(null);
      }
    })();
  }, [showEdit]);

  // Buscar clientes (debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) {
        setClientResults([]);
        return;
      }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : resp.data?.data || [];
        const list = arr.map((c: any) => {
          const tipo = c.tipo;
          const nombre =
            tipo === 'EMPRESA'
              ? c.empresa?.razon_social || c.empresa?.nombre_comercial || 'Empresa'
              : `${c.persona?.nombres || c.nombre || ''} ${
                  c.persona?.apellidos || c.apellidos || ''
                }`.trim();
          const doc = tipo === 'EMPRESA' ? c.empresa?.nit : c.persona?.documento || c.cuit;
          return { id: Number(c.id), label: `${nombre}${doc ? ' • ' + doc : ''}` };
        });
        setClientResults(list);
      } finally {
        setClientLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [clientQuery]);

  // Buscar pólizas (debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!policyQuery || policyQuery.trim().length < 2) {
        setPolicyResults([]);
        return;
      }
      try {
        setPolicyLoading(true);
        const resp = await saasApi.getPolizas({ search: policyQuery, per_page: 10 });
        const payload: any = resp.data || {};
        const data = Array.isArray(payload) ? payload : payload.data || [];
        const list = data.map((p: any) => ({
          id: Number(p.id || 0),
          label: `${p.numero_poliza || p.policy_number} • ${
            p.nombres_cliente || p.client_name || ''
          }`,
        }));
        setPolicyResults(list);
      } finally {
        setPolicyLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [policyQuery]);

  const handleCreate = async () => {
    if (!form.placa) return;
    const payload: any = { placa: String(form.placa).toUpperCase().trim() };
    // IDs de catálogos
    if (form.brand_id) payload.brand_id = Number(form.brand_id);
    if (form.model_id) payload.model_id = Number(form.model_id);
    if (form.line_id) payload.line_id = Number(form.line_id);
    if (claseSel) payload.clase = claseSel;
    if (ref1Sel) payload.referencia1 = ref1Sel;
    if (ref2Sel) payload.referencia2 = ref2Sel;
    if (ref3Sel) payload.referencia3 = ref3Sel;
    // extended fields
    [
      'vin',
      'color',
      'tipo_servicio',
      'clase',
      'linea',
      'tipo_carroceria',
      'numero_motor',
      'numero_chasis',
      'numero_serie',
      'cilindraje',
      'combustible',
      'capacidad_pasajeros',
      'capacidad_carga_kg',
      'tipo_transmision',
      'traccion',
      'pais_origen',
    ].forEach((k) => {
      const key = k as keyof Automovil;
      if (form[key] !== undefined && form[key] !== null && form[key] !== '')
        (payload as any)[k] = form[key];
    });
    await saasApi.createAutomovil(payload);
    setShowCreate(false);
    setForm({ placa: '', marca: '', modelo: '', brand_id: null, model_id: null, line_id: null });
    loadData();
  };

  // Deep-link helpers
  const openAutoById = async (id: string) => {
    try {
      const resp = await saasApi.getAutomovil(id);
      const data: any = (resp as any)?.data ?? resp;
      if (data) {
        setEditingId(Number(data.id ?? id));
        setEditForm(data);
        setShowEdit(true);
      }
    } catch (e) {
      console.error('Error abriendo automóvil por ID desde query param:', e);
    }
  };

  const handleCloseEditModal = () => {
    setShowEdit(false);
    try {
      const params = new URLSearchParams(location.search);
      params.delete('open_auto_id');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    } catch {}
  };

  return (
    <PermissionGate
      route="/apps/seguros/automoviles"
      action="ver"
      fallback={
        <div className="p-6 text-center text-gray-500">
          No tienes permisos para ver Automóviles.
        </div>
      }
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex-1">
              <div className="relative">
                <Icon
                  icon="solar:magnifer-bold-duotone"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                />
                <TextInput
                  placeholder="Buscar por placa, marca, modelo, VIN..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, page: 1, search: e.target.value }))
                  }
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {canCreate && (
                <Button
                  color="primary"
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
                  onClick={() => setShowCreate(true)}
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" /> Nuevo
                  Automóvil
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Spinner size="lg" />
              <span className="ml-2">Cargando automóviles...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Icon
                icon="solar:car-bold-duotone"
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
              />
              <p className="text-gray-500 mb-4">No se encontraron automóviles</p>
              <div className="flex justify-center">
                {canCreate && (
                  <Button color="primary" onClick={() => setShowCreate(true)}>
                    <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                    Crear automóvil
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table
                  hoverable
                  className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]"
                >
                  <Table.Head>
                    <Table.HeadCell>Placa</Table.HeadCell>
                    <Table.HeadCell>Marca</Table.HeadCell>
                    <Table.HeadCell>Modelo (Año)</Table.HeadCell>
                    <Table.HeadCell>Valor asegurado</Table.HeadCell>
                    <Table.HeadCell>Clase / Ref.</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Acciones</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {items.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell className="font-medium">{a.placa}</Table.Cell>
                        <Table.Cell>{a.marca || '-'}</Table.Cell>
                        <Table.Cell>{a.modelo || '-'}</Table.Cell>
                        <Table.Cell>{formatMoney((a as any).insured_value)}</Table.Cell>
                        <Table.Cell>
                          {(() => {
                            const m = (a as any).insured_meta || {};
                            const parts = [
                              m.clase,
                              m.referencia1,
                              m.referencia2,
                              m.referencia3,
                            ].filter(Boolean);
                            return parts.length ? parts.join(' • ') : '-';
                          })()}
                        </Table.Cell>
                        <Table.Cell>{a.client_name || a.client_id || '-'}</Table.Cell>
                        <Table.Cell>{a.policy_number || a.poliza_id || '-'}</Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2">
                            {canEdit && (
                              <Button
                                color="light"
                                size="xs"
                                onClick={() => {
                                  setEditingId(a.id);
                                  setEditForm(a);
                                  setShowEdit(true);
                                }}
                              >
                                Editar
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                color="light"
                                size="xs"
                                onClick={async () => {
                                  await saasApi.deleteAutomovil(a.id);
                                  loadData();
                                }}
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
        </div>

        <Modal show={showCreate} onClose={() => setShowCreate(false)}>
          <Modal.Header>Nuevo Automóvil</Modal.Header>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="placa" className="mb-1 block">
                  Placa
                </Label>
                <TextInput
                  id="placa"
                  value={form.placa || ''}
                  onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value }))}
                  placeholder="ABC123"
                />
              </div>
              <div>
                <Label htmlFor="brand_id" className="mb-1 block">
                  Marca
                </Label>
                <Select
                  id="brand_id"
                  value={String(form.brand_id ?? '')}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      brand_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">Seleccione marca</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="model_id" className="mb-1 block">
                  Modelo (Año)
                </Label>
                <Select
                  id="model_id"
                  value={String(form.model_id ?? '')}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      model_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  disabled={!form.brand_id}
                >
                  <option value="">Seleccione modelo</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="line_id" className="mb-1 block">
                  Línea
                </Label>
                <Select
                  id="line_id"
                  value={String(form.line_id ?? '')}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      line_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  disabled={!form.model_id}
                >
                  <option value="">Seleccione línea</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Valor asegurado</Label>
                <div className="h-10 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40">
                  {formatMoney(insuredValue)}
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Clase</Label>
                <Select
                  value={claseSel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setClaseSel(v);
                    if (form.brand_id && form.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(form.brand_id),
                        model_id: Number(form.model_id),
                        line_id: form.line_id ? Number(form.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setRef1Opts(d.referencia1_opts || []);
                      setRef2Opts([]);
                      setRef3Opts([]);
                      setRef1Sel('');
                      setRef2Sel('');
                      setRef3Sel('');
                    }
                  }}
                >
                  <option value="">Seleccione clase</option>
                  {clases.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Referencia 1</Label>
                <Select
                  value={ref1Sel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setRef1Sel(v);
                    if (form.brand_id && form.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(form.brand_id),
                        model_id: Number(form.model_id),
                        line_id: form.line_id ? Number(form.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setRef2Opts(d.referencia2_opts || []);
                      setRef3Opts([]);
                      setRef2Sel('');
                      setRef3Sel('');
                    }
                  }}
                  disabled={!claseSel}
                >
                  <option value="">Seleccione referencia 1</option>
                  {ref1Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Referencia 2</Label>
                <Select
                  value={ref2Sel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setRef2Sel(v);
                    if (form.brand_id && form.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(form.brand_id),
                        model_id: Number(form.model_id),
                        line_id: form.line_id ? Number(form.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setRef3Opts(d.referencia3_opts || []);
                      setRef3Sel('');
                    }
                  }}
                  disabled={!ref1Sel}
                >
                  <option value="">Seleccione referencia 2</option>
                  {ref2Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Referencia 3</Label>
                <Select
                  value={ref3Sel}
                  onChange={(e) => setRef3Sel(e.target.value)}
                  disabled={!ref2Sel}
                >
                  <option value="">Seleccione referencia 3</option>
                  {ref3Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Clase / Referencias</Label>
                <div className="min-h-10 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40">
                  {(() => {
                    const m = {} as any;
                    return '-';
                  })()}
                </div>
              </div>
              <div>
                <Label htmlFor="vin" className="mb-1 block">
                  VIN
                </Label>
                <TextInput
                  id="vin"
                  value={form.vin || ''}
                  onChange={(e) => setForm((p) => ({ ...p, vin: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="color" className="mb-1 block">
                  Color
                </Label>
                <TextInput
                  id="color"
                  value={form.color || ''}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tipo_servicio" className="mb-1 block">
                  Tipo de servicio
                </Label>
                <TextInput
                  id="tipo_servicio"
                  value={form.tipo_servicio || ''}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_servicio: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="clase" className="mb-1 block">
                  Clase
                </Label>
                <TextInput
                  id="clase"
                  value={form.clase || ''}
                  onChange={(e) => setForm((p) => ({ ...p, clase: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="linea" className="mb-1 block">
                  Línea (texto)
                </Label>
                <TextInput
                  id="linea"
                  value={form.linea || ''}
                  onChange={(e) => setForm((p) => ({ ...p, linea: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tipo_carroceria" className="mb-1 block">
                  Tipo de carrocería
                </Label>
                <TextInput
                  id="tipo_carroceria"
                  value={form.tipo_carroceria || ''}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_carroceria: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="numero_motor" className="mb-1 block">
                  Número de motor
                </Label>
                <TextInput
                  id="numero_motor"
                  value={form.numero_motor || ''}
                  onChange={(e) => setForm((p) => ({ ...p, numero_motor: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="numero_chasis" className="mb-1 block">
                  Número de chasis
                </Label>
                <TextInput
                  id="numero_chasis"
                  value={form.numero_chasis || ''}
                  onChange={(e) => setForm((p) => ({ ...p, numero_chasis: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="numero_serie" className="mb-1 block">
                  Número de serie
                </Label>
                <TextInput
                  id="numero_serie"
                  value={form.numero_serie || ''}
                  onChange={(e) => setForm((p) => ({ ...p, numero_serie: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="cilindraje" className="mb-1 block">
                  Cilindraje
                </Label>
                <TextInput
                  id="cilindraje"
                  type="number"
                  value={form.cilindraje ? String(form.cilindraje) : ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cilindraje: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="combustible" className="mb-1 block">
                  Combustible
                </Label>
                <TextInput
                  id="combustible"
                  value={form.combustible || ''}
                  onChange={(e) => setForm((p) => ({ ...p, combustible: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="capacidad_pasajeros" className="mb-1 block">
                  Capacidad pasajeros
                </Label>
                <TextInput
                  id="capacidad_pasajeros"
                  type="number"
                  value={form.capacidad_pasajeros ? String(form.capacidad_pasajeros) : ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      capacidad_pasajeros: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="capacidad_carga_kg" className="mb-1 block">
                  Capacidad carga (kg)
                </Label>
                <TextInput
                  id="capacidad_carga_kg"
                  type="number"
                  value={form.capacidad_carga_kg ? String(form.capacidad_carga_kg) : ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      capacidad_carga_kg: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="tipo_transmision" className="mb-1 block">
                  Transmisión
                </Label>
                <TextInput
                  id="tipo_transmision"
                  value={form.tipo_transmision || ''}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_transmision: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="traccion" className="mb-1 block">
                  Tracción
                </Label>
                <TextInput
                  id="traccion"
                  value={form.traccion || ''}
                  onChange={(e) => setForm((p) => ({ ...p, traccion: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pais_origen" className="mb-1 block">
                  País de origen
                </Label>
                <TextInput
                  id="pais_origen"
                  value={form.pais_origen || ''}
                  onChange={(e) => setForm((p) => ({ ...p, pais_origen: e.target.value }))}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="gray" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            {canCreate && (
              <Button color="primary" onClick={handleCreate}>
                Guardar
              </Button>
            )}
          </Modal.Footer>
        </Modal>

        {/* Modal Editar */}
        <Modal show={showEdit} onClose={handleCloseEditModal}>
          <Modal.Header>Editar Automóvil</Modal.Header>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="e_placa" className="mb-1 block">
                  Placa
                </Label>
                <TextInput
                  id="e_placa"
                  value={editForm.placa || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, placa: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_brand_id" className="mb-1 block">
                  Marca
                </Label>
                <Select
                  id="e_brand_id"
                  value={String(editForm.brand_id ?? '')}
                  onChange={async (e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setEditForm((p) => ({ ...p, brand_id: val, model_id: null, line_id: null }));
                    if (val) {
                      const resp = await saasApi.getAutomovilCatalogos({ brand_id: val });
                      setEModels((resp.data || {}).models || []);
                      setELines([]);
                      setInsuredValueEdit(null);
                    } else {
                      setEModels([]);
                      setELines([]);
                      setInsuredValueEdit(null);
                    }
                  }}
                >
                  <option value="">Seleccione marca</option>
                  {eBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="e_model_id" className="mb-1 block">
                  Modelo (Año)
                </Label>
                <Select
                  id="e_model_id"
                  value={String(editForm.model_id ?? '')}
                  onChange={async (e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setEditForm((p) => ({ ...p, model_id: val, line_id: null }));
                    if (val) {
                      const resp = await saasApi.getAutomovilCatalogos({ model_id: val });
                      setELines((resp.data || {}).lines || []);
                      if (editForm.brand_id) {
                        const v = await saasApi.getAutomovilInsuredValue({
                          brand_id: Number(editForm.brand_id),
                          model_id: val,
                        });
                        setInsuredValueEdit((v.data as any)?.insured_value ?? null);
                      }
                    } else {
                      setELines([]);
                      setInsuredValueEdit(null);
                    }
                  }}
                  disabled={!editForm.brand_id}
                >
                  <option value="">Seleccione modelo</option>
                  {eModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="e_line_id" className="mb-1 block">
                  Línea
                </Label>
                <Select
                  id="e_line_id"
                  value={String(editForm.line_id ?? '')}
                  onChange={async (e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setEditForm((p) => ({ ...p, line_id: val }));
                    if (editForm.brand_id && editForm.model_id) {
                      const v = await saasApi.getAutomovilInsuredValue({
                        brand_id: Number(editForm.brand_id),
                        model_id: Number(editForm.model_id),
                        line_id: val ?? undefined,
                      });
                      setInsuredValueEdit((v.data as any)?.insured_value ?? null);
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(editForm.brand_id),
                        model_id: Number(editForm.model_id),
                        line_id: val ?? undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setEClases(d.clases || []);
                      setERef1Opts(d.referencia1_opts || []);
                      setERef2Opts(d.referencia2_opts || []);
                      setERef3Opts(d.referencia3_opts || []);
                      setEClaseSel('');
                      setERef1Sel('');
                      setERef2Sel('');
                      setERef3Sel('');
                    }
                  }}
                  disabled={!editForm.model_id}
                >
                  <option value="">Seleccione línea</option>
                  {eLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Valor asegurado</Label>
                <div className="h-10 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40">
                  {formatMoney(insuredValueEdit)}
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Clase</Label>
                <Select
                  value={eClaseSel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setEClaseSel(v);
                    if (editForm.brand_id && editForm.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(editForm.brand_id),
                        model_id: Number(editForm.model_id),
                        line_id: editForm.line_id ? Number(editForm.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setERef1Opts(d.referencia1_opts || []);
                      setERef2Opts([]);
                      setERef3Opts([]);
                      setERef1Sel('');
                      setERef2Sel('');
                      setERef3Sel('');
                    }
                  }}
                >
                  <option value="">Seleccione clase</option>
                  {eClases.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Referencia 1</Label>
                <Select
                  value={eRef1Sel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setERef1Sel(v);
                    if (editForm.brand_id && editForm.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(editForm.brand_id),
                        model_id: Number(editForm.model_id),
                        line_id: editForm.line_id ? Number(editForm.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setERef2Opts(d.referencia2_opts || []);
                      setERef3Opts([]);
                      setERef2Sel('');
                      setERef3Sel('');
                    }
                  }}
                  disabled={!eClaseSel}
                >
                  <option value="">Seleccione referencia 1</option>
                  {eRef1Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb1 block">Referencia 2</Label>
                <Select
                  value={eRef2Sel}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setERef2Sel(v);
                    if (editForm.brand_id && editForm.model_id) {
                      const r = await saasApi.getAutomovilCatalogos({
                        brand_id: Number(editForm.brand_id),
                        model_id: Number(editForm.model_id),
                        line_id: editForm.line_id ? Number(editForm.line_id) : undefined,
                      } as any);
                      const d = (r.data || {}) as any;
                      setERef3Opts(d.referencia3_opts || []);
                      setERef3Sel('');
                    }
                  }}
                  disabled={!eRef1Sel}
                >
                  <option value="">Seleccione referencia 2</option>
                  {eRef2Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb1 block">Referencia 3</Label>
                <Select
                  value={eRef3Sel}
                  onChange={(e) => setERef3Sel(e.target.value)}
                  disabled={!eRef2Sel}
                >
                  <option value="">Seleccione referencia 3</option>
                  {eRef3Opts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Clase / Referencias</Label>
                <div className="min-h-10 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40">
                  {(() => {
                    const m = {} as any;
                    return '-';
                  })()}
                </div>
              </div>
              <div>
                <Label htmlFor="e_vin" className="mb-1 block">
                  VIN
                </Label>
                <TextInput
                  id="e_vin"
                  value={editForm.vin || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, vin: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_color" className="mb-1 block">
                  Color
                </Label>
                <TextInput
                  id="e_color"
                  value={editForm.color || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_tipo_servicio" className="mb-1 block">
                  Tipo de servicio
                </Label>
                <TextInput
                  id="e_tipo_servicio"
                  value={editForm.tipo_servicio || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, tipo_servicio: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_clase" className="mb-1 block">
                  Clase
                </Label>
                <TextInput
                  id="e_clase"
                  value={editForm.clase || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, clase: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_linea" className="mb-1 block">
                  Línea (texto)
                </Label>
                <TextInput
                  id="e_linea"
                  value={editForm.linea || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, linea: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_tipo_carroceria" className="mb-1 block">
                  Tipo de carrocería
                </Label>
                <TextInput
                  id="e_tipo_carroceria"
                  value={editForm.tipo_carroceria || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, tipo_carroceria: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_numero_motor" className="mb-1 block">
                  Número de motor
                </Label>
                <TextInput
                  id="e_numero_motor"
                  value={editForm.numero_motor || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, numero_motor: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_numero_chasis" className="mb-1 block">
                  Número de chasis
                </Label>
                <TextInput
                  id="e_numero_chasis"
                  value={editForm.numero_chasis || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, numero_chasis: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_numero_serie" className="mb-1 block">
                  Número de serie
                </Label>
                <TextInput
                  id="e_numero_serie"
                  value={editForm.numero_serie || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, numero_serie: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_cilindraje" className="mb-1 block">
                  Cilindraje
                </Label>
                <TextInput
                  id="e_cilindraje"
                  type="number"
                  value={editForm.cilindraje ? String(editForm.cilindraje) : ''}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      cilindraje: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="e_combustible" className="mb-1 block">
                  Combustible
                </Label>
                <TextInput
                  id="e_combustible"
                  value={editForm.combustible || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, combustible: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_capacidad_pasajeros" className="mb-1 block">
                  Capacidad pasajeros
                </Label>
                <TextInput
                  id="e_capacidad_pasajeros"
                  type="number"
                  value={editForm.capacidad_pasajeros ? String(editForm.capacidad_pasajeros) : ''}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      capacidad_pasajeros: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="e_capacidad_carga_kg" className="mb-1 block">
                  Capacidad carga (kg)
                </Label>
                <TextInput
                  id="e_capacidad_carga_kg"
                  type="number"
                  value={editForm.capacidad_carga_kg ? String(editForm.capacidad_carga_kg) : ''}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      capacidad_carga_kg: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="e_tipo_transmision" className="mb-1 block">
                  Transmisión
                </Label>
                <TextInput
                  id="e_tipo_transmision"
                  value={editForm.tipo_transmision || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, tipo_transmision: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_traccion" className="mb-1 block">
                  Tracción
                </Label>
                <TextInput
                  id="e_traccion"
                  value={editForm.traccion || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, traccion: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="e_pais_origen" className="mb-1 block">
                  País de origen
                </Label>
                <TextInput
                  id="e_pais_origen"
                  value={editForm.pais_origen || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, pais_origen: e.target.value }))}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="gray" onClick={() => setShowEdit(false)}>
              Cancelar
            </Button>
            {canEdit && (
              <Button
                color="primary"
                onClick={async () => {
                  if (!editingId) return;
                  const payload: any = { ...editForm };
                  if (payload.brand_id) payload.brand_id = Number(payload.brand_id);
                  if (payload.model_id) payload.model_id = Number(payload.model_id);
                  if (payload.line_id) payload.line_id = Number(payload.line_id);
                  if (eClaseSel) payload.clase = eClaseSel;
                  if (eRef1Sel) payload.referencia1 = eRef1Sel;
                  if (eRef2Sel) payload.referencia2 = eRef2Sel;
                  if (eRef3Sel) payload.referencia3 = eRef3Sel;
                  await saasApi.updateAutomovil(editingId, payload);
                  setShowEdit(false);
                  setEditingId(null);
                  setEditForm({});
                  loadData();
                }}
              >
                Guardar
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      </div>
    </PermissionGate>
  );
};

export default Automoviles;

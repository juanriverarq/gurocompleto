import React, { useEffect, useState } from 'react';
import { useRuntSync } from 'src/context/RuntSyncContext';
import { Card, Button, Table, TextInput, Label, Spinner, Modal, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import saasApi from 'src/services/saasApi';
import { useLocation, useNavigate } from 'react-router-dom';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import AutomovilNotificationsModal from './components/AutomovilNotificationsModal';

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
  // SOAT
  numero_soat?: string;
  fecha_inicio_soat?: string;
  fecha_vencimiento_soat?: string;
  aseguradora_soat?: string;
  estado_soat?: string;
  // RTM
  numero_certificado_rtm?: string;
  fecha_expedicion_rtm?: string;
  fecha_vencimiento_rtm?: string;
  nombre_cda_rtm?: string;
  estado_rtm?: string;
  // Estado legal
  estado_automotor?: string;
  gravamenes?: string;
  prendas?: string;
  organismo_transito?: string;
  fecha_registro_runt?: string;
  // Propietario
  propietario_nombre?: string;
  propietario_documento?: string;
  // Meta
  runt_consulted_at?: string;
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

const getVencimientoBadge = (fecha?: string) => {
  if (!fecha) return { text: 'Sin datos', color: 'bg-gray-100 text-gray-600' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + 'T00:00:00');
  const diffDays = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Vencido (${fecha})`, color: 'bg-red-100 text-red-700' };
  if (diffDays <= 30) return { text: `${fecha} (${diffDays}d)`, color: 'bg-yellow-100 text-yellow-700' };
  return { text: fecha, color: 'bg-green-100 text-green-700' };
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
  const [runtLoading, setRuntLoading] = useState(false);
  const { loading: massRuntLoading, stopping: massRuntStopping, progress: massRuntProgress, done: massRuntDone, start: startRuntSync, stop: stopRuntSync, clearDone: clearMassRuntDone } = useRuntSync();
  const [showRuntPopover, setShowRuntPopover] = useState(false);
  const [showRuntResync, setShowRuntResync] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

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
            <div className="flex gap-2 items-center">
              {/* RUNT sync pill + popover */}
              <div
                className="relative"
                onMouseEnter={() => setShowRuntPopover(true)}
                onMouseLeave={() => setShowRuntPopover(false)}
              >
                {/* Pill button */}
                <button
                  type="button"
                  disabled={massRuntLoading}
                  onClick={() => {
                    // Limit 15 para caber en el timeout de ~100s de Cloudflare
                    // Cada consulta RUNT tarda ~4-7s → 15 * 7s = 105s max
                    startRuntSync({ onlyPending: true, limit: 15 });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 cursor-pointer hover:bg-neutral-800 transition-colors disabled:opacity-60"
                >
                  {massRuntLoading
                    ? <Icon icon="svg-spinners:ring-resize" width={13} className="text-neutral-500 shrink-0" />
                    : massRuntDone && (massRuntDone.failed ?? 0) > 0 && (massRuntDone.success ?? 0) === 0
                    ? <Icon icon="solar:danger-triangle-linear" width={13} className="text-red-400 shrink-0" />
                    : massRuntDone
                    ? <Icon icon="solar:check-circle-linear" width={13} className="text-neutral-500 shrink-0" />
                    : <Icon icon="solar:refresh-bold-duotone" width={13} className="text-neutral-500 shrink-0" />
                  }
                  <span className="text-[11px] whitespace-nowrap text-neutral-400">
                    {massRuntLoading && massRuntProgress
                      ? `RUNT ${massRuntProgress.index}/${massRuntProgress.total}`
                      : massRuntLoading
                      ? 'RUNT...'
                      : massRuntDone
                      ? `RUNT ${massRuntDone.success}✓ ${massRuntDone.failed > 0 ? massRuntDone.failed + '✗ ' : ''}/ ${massRuntDone.total}`
                      : 'Sincronizar RUNT'
                    }
                  </span>
                  {massRuntLoading && massRuntProgress && (
                    <div className="w-14 h-0.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neutral-500 transition-all duration-500"
                        style={{ width: `${massRuntProgress.total > 0 ? (massRuntProgress.index / massRuntProgress.total) * 100 : 5}%` }}
                      />
                    </div>
                  )}
                </button>

                {/* Popover */}
                {showRuntPopover && (massRuntLoading || massRuntDone) && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl p-3.5 text-sm">
                    <div className="absolute -top-1.5 right-5 w-3 h-3 rotate-45 border-l border-t border-neutral-800 bg-neutral-950" />

                    {/* Header */}
                    <p className="text-[12px] font-medium text-neutral-300 mb-0.5">
                      {massRuntLoading
                        ? (massRuntStopping ? 'Deteniendo…' : 'Consultando RUNT')
                        : massRuntDone?.cancelled
                        ? 'Sincronización detenida'
                        : (massRuntDone?.failed ?? 0) > 0
                        ? 'Sincronización con errores'
                        : 'Sincronización completa'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mb-3">
                      {massRuntProgress
                        ? `${massRuntProgress.index} de ${massRuntProgress.total} vehículos · ${massRuntProgress.placa}`
                        : massRuntDone
                        ? `${massRuntDone.total} procesados · ${massRuntDone.success} ok${massRuntDone.failed > 0 ? ` · ${massRuntDone.failed} fallidos` : ''}${massRuntDone.skipped > 0 ? ` · ${massRuntDone.skipped} omitidos` : ''}`
                        : 'Iniciando...'}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full h-0.5 rounded-full bg-neutral-800 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full bg-neutral-500 transition-all duration-500"
                        style={{ width: `${massRuntProgress && massRuntProgress.total > 0 ? (massRuntProgress.index / massRuntProgress.total) * 100 : massRuntDone ? 100 : 5}%` }}
                      />
                    </div>

                    {/* Live placa being processed */}
                    {massRuntLoading && massRuntProgress && (
                      <div className="border-l-2 border-neutral-700 pl-2 mb-3">
                        <p className="text-[11px] text-neutral-400">
                          <span className="font-medium text-neutral-300">{massRuntProgress.placa}</span>
                          {' — '}
                          {massRuntProgress.status === 'success' ? 'Actualizado' : massRuntProgress.status === 'skipped' ? 'Omitido' : massRuntProgress.status === 'error' ? 'Error' : 'Consultando...'}
                        </p>
                        <p className="text-[10px] text-neutral-600 mt-0.5">
                          {massRuntProgress.success} ok · {massRuntProgress.failed} fallidos · {massRuntProgress.skipped} omitidos
                        </p>
                      </div>
                    )}

                    {/* Result stats after done */}
                    {!massRuntLoading && massRuntDone && (
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-center">
                          <p className="text-base font-bold text-emerald-400">{massRuntDone.success}</p>
                          <p className="text-[9px] text-neutral-600">Exitosos</p>
                        </div>
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-center">
                          <p className="text-base font-bold text-red-400">{massRuntDone.failed}</p>
                          <p className="text-[9px] text-neutral-600">Fallidos</p>
                        </div>
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-center">
                          <p className="text-base font-bold text-neutral-500">{massRuntDone.skipped}</p>
                          <p className="text-[9px] text-neutral-600">Omitidos</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-neutral-800 pt-3">
                      {massRuntLoading && (
                        <button
                          onClick={() => stopRuntSync()}
                          disabled={massRuntStopping}
                          className="flex-1 rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 text-[11px] text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          <Icon icon={massRuntStopping ? 'svg-spinners:ring-resize' : 'solar:stop-circle-linear'} width={12} />
                          {massRuntStopping ? 'Deteniendo…' : 'Detener'}
                        </button>
                      )}
                      {!massRuntLoading && (
                        <button
                          onClick={() => {
                            setShowRuntPopover(false);
                            setShowRuntResync(true);
                          }}
                          className="flex-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-400 transition-colors"
                        >
                          Resincronizar
                        </button>
                      )}
                      {massRuntDone && (
                        <button
                          onClick={() => { clearMassRuntDone(); setShowRuntPopover(false); }}
                          className="flex-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-400 transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Resync dialog */}
              {showRuntResync && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowRuntResync(false)}>
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="relative w-80 rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[13px] font-medium text-neutral-200 mb-1">¿Qué vehículos resincronizar?</p>
                    <p className="text-[11px] text-neutral-500 mb-4">Solo los pendientes es más rápido. Todos fuerza la consulta de cada placa al RUNT.</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => { setShowRuntResync(false); startRuntSync({ onlyPending: true, limit: 50 }); }}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-left text-[12px] text-neutral-300 transition-colors"
                      >
                        Solo pendientes
                        <span className="block text-[10px] text-neutral-600 mt-0.5">Vehículos sin datos del RUNT</span>
                      </button>
                      <button
                        onClick={() => { setShowRuntResync(false); startRuntSync({ onlyPending: false, limit: 200 }); }}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-left text-[12px] text-neutral-300 transition-colors"
                      >
                        Todos los vehículos
                        <span className="block text-[10px] text-neutral-600 mt-0.5">Proceso largo — puede tardar varios minutos</span>
                      </button>
                      <button
                        onClick={() => setShowRuntResync(false)}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-[12px] text-neutral-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <HeroButton 
                icon="solar:bell-bing-bold-duotone" 
                onClick={() => setShowNotificationsModal(true)}
              >
                Notificaciones
              </HeroButton>
              {canCreate && (
                <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setShowCreate(true)}>Nuevo Automóvil</HeroButton>
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
                    <Table.HeadCell>SOAT</Table.HeadCell>
                    <Table.HeadCell>Técnico-Mecánica</Table.HeadCell>
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
                        <Table.Cell>
                          {(() => {
                            const b = getVencimientoBadge(a.fecha_vencimiento_soat);
                            return <span className={`text-xs px-2 py-0.5 rounded-full ${b.color}`}>{b.text}</span>;
                          })()}
                        </Table.Cell>
                        <Table.Cell>
                          {(() => {
                            const b = getVencimientoBadge(a.fecha_vencimiento_rtm);
                            return <span className={`text-xs px-2 py-0.5 rounded-full ${b.color}`}>{b.text}</span>;
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

              {/* Paginación */}
              {pagination && pagination.last_page > 1 && (
                <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-b-[10px]">
                  <div className="text-sm text-gray-500">
                    Mostrando {pagination.from} a {pagination.to} de {pagination.total} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      color="light"
                      disabled={pagination.current_page === 1}
                      onClick={() => setFilters((prev) => ({ ...prev, page: pagination.current_page - 1 }))}
                      className="rounded-[10px]"
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-sm bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
                      Página {pagination.current_page} de {pagination.last_page}
                    </span>
                    <Button
                      size="sm"
                      color="light"
                      disabled={pagination.current_page === pagination.last_page}
                      onClick={() => setFilters((prev) => ({ ...prev, page: pagination.current_page + 1 }))}
                      className="rounded-[10px]"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
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
        <Modal show={showEdit} onClose={handleCloseEditModal} size="5xl">
          <Modal.Header>Editar Automóvil</Modal.Header>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="md:col-span-3">
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
              <div className="md:col-span-3">
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

            {/* Sección RUNT / SOAT / RTM */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Información RUNT
                  </h3>
                  {editForm.runt_consulted_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Última consulta: {editForm.runt_consulted_at}
                    </p>
                  )}
                </div>
                <Button
                  color="info"
                  size="sm"
                  disabled={runtLoading || !editForm.client_id}
                  onClick={async () => {
                    if (!editingId) return;
                    setRuntLoading(true);
                    try {
                      const resp = await saasApi.consultarRunt(editingId);
                      const data = (resp as any)?.data ?? resp;
                      if (data) {
                        setEditForm(data);
                      }
                      loadData();
                    } catch (e: any) {
                      alert(e?.message || 'Error al consultar RUNT');
                    } finally {
                      setRuntLoading(false);
                    }
                  }}
                >
                  {runtLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:document-medicine-bold-duotone" className="w-4 h-4 mr-1" />
                      Consultar RUNT
                    </>
                  )}
                </Button>
              </div>

              {!editForm.client_id && (
                <p className="text-xs text-yellow-500 mb-3">
                  Asocie un cliente al automóvil para poder consultar RUNT (se usa el documento del cliente).
                </p>
              )}

              {/* SOAT */}
              <h4 className="font-medium text-sm text-gray-700 dark:text-white mb-2 mt-2">SOAT</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <Label className="mb-1 block text-xs">Número SOAT</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.numero_soat || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Aseguradora</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.aseguradora_soat || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Estado</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.estado_soat || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Inicio póliza</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.fecha_inicio_soat || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Vencimiento</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {(() => {
                      const b = getVencimientoBadge(editForm.fecha_vencimiento_soat);
                      return <span className={`text-xs px-2 py-0.5 rounded-full ${b.color}`}>{b.text}</span>;
                    })()}
                  </div>
                </div>
              </div>

              {/* RTM */}
              <h4 className="font-medium text-sm text-gray-700 dark:text-white mb-2">Revisión Técnico-Mecánica</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <Label className="mb-1 block text-xs">Certificado</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.numero_certificado_rtm || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">CDA</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.nombre_cda_rtm || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Estado</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.estado_rtm || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Expedición</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.fecha_expedicion_rtm || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Vencimiento</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {(() => {
                      const b = getVencimientoBadge(editForm.fecha_vencimiento_rtm);
                      return <span className={`text-xs px-2 py-0.5 rounded-full ${b.color}`}>{b.text}</span>;
                    })()}
                  </div>
                </div>
              </div>

              {/* Estado Legal */}
              <h4 className="font-medium text-sm text-gray-700 dark:text-white mb-2">Estado Legal</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">Estado automotor</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.estado_automotor || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Organismo de tránsito</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.organismo_transito || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Propietario</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.propietario_nombre || '-'}{editForm.propietario_documento ? ` (${editForm.propietario_documento})` : ''}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Gravámenes</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.gravamenes || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Prendas</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.prendas || '-'}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Fecha registro</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 dark:bg-dark/30 border border-gray-200 dark:border-dark/40 text-sm">
                    {editForm.fecha_registro_runt || '-'}
                  </div>
                </div>
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

      {/* AutomovilNotificationsModal */}
      <AutomovilNotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
      </div>
    </PermissionGate>
  );
};

export default Automoviles;

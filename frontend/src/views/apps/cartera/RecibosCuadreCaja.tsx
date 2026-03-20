import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Spinner, Table, Modal, Button, Select, Textarea, TextInput } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { useToast } from 'src/hooks/use-toast';
import api from 'src/config/api';
import { printRecibo, type ReciboPrintData, type BrokerPrintData } from './printRecibo';
import OnboardingGuard from 'src/components/auth/OnboardingGuard';
import PermissionGate from 'src/components/PermissionGate';

// ─── Types ───────────────────────────────────────────────────────────
interface Recibo {
  id: number;
  numero_recibo: string | null;
  tipo: 'recibo' | 'anticipo' | 'ajuste';
  tipo_recaudo: 'oficina' | 'aseguradora' | 'directo';
  forma_pago: string | null;
  medio_de_pago: string | null;
  moneda: string;
  fecha_realizo_pago_oficina: string | null;
  fecha_recibo_anulado: string | null;
  valor_recaudado_en_oficina: number;
  valor_a_pagar: number | null;
  saldo_pendiente: number | null;
  saldo_pendiente_oficina: number;
  saldo_pendiente_aseguradora: number;
  comision_a_recibir: number | null;
  comision_vendedor: number | null;
  numero_pago: string | null;
  pago_poliza_consecutivo: string | null;
  es_anticipo: boolean;
  recibo_anulado: boolean;
  recibo_pago_directo: boolean;
  recaudo_directo: boolean;
  recaudado_en_oficina: boolean;
  comisionada: boolean;
  activo: boolean;
  observaciones: string | null;
  usuario_anulo_recibo: string | null;
  usuario_recauda: string | null;
  source: string;
  poliza_id: number | null;
  cliente_id: number | null;
  // Denormalized display fields
  poliza_numero: string | null;
  poliza_objeto_asegurado: string | null;
  cliente_nombre: string | null;
  cliente_documento: string | null;
  aseguradora_nombre: string | null;
  ramo_nombre: string | null;
  sede_nombre: string | null;
  vendedor_nombre: string | null;
  // Relations (fallback)
  poliza?: { id: number; policy_number: string } | null;
  cliente?: { id: number; first_name: string; last_name: string; document_number: string } | null;
  created_at: string;
}

interface Estadisticas {
  total_recibos: number;
  total_anticipos: number;
  total_anulados: number;
  total_recaudado: number;
  pendiente_oficina: number;
  pendiente_aseguradora: number;
}

interface CuadreCaja {
  periodo: { desde: string; hasta: string };
  total_recaudado_oficina: number;
  total_recibos: number;
  total_anticipos: number;
  total_anulados: number;
  por_forma_pago: { forma_pago: string; cantidad: number; total: number }[];
  por_tipo: { tipo: string; cantidad: number; total: number }[];
  comisiones: { total: number; pagadas: number; pendientes: number };
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};

// ─── Tab definitions ─────────────────────────────────────────────────
type TabKey = 'anticipos' | 'activos' | 'pago_directo' | 'anulados' | 'certificados' | 'cuadre';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'anticipos', label: 'Anticipo', icon: 'solar:hand-money-bold-duotone' },
  { key: 'activos', label: 'Recibos Activos', icon: 'solar:bill-list-bold-duotone' },
  { key: 'pago_directo', label: 'Recibos Pago Directo', icon: 'solar:card-transfer-bold-duotone' },
  { key: 'anulados', label: 'Recibos Anulados', icon: 'solar:close-circle-bold-duotone' },
  { key: 'certificados', label: 'Certificados de cobro', icon: 'solar:document-bold-duotone' },
  { key: 'cuadre', label: 'Cuadre de Caja', icon: 'solar:calculator-bold-duotone' },
];

// ─── Component ───────────────────────────────────────────────────────
const RecibosCuadreCaja = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('activos');
  const [loading, setLoading] = useState(false);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [cuadre, setCuadre] = useState<CuadreCaja | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('numero_recibo');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Cuadre date range
  const [cuadreDesde, setCuadreDesde] = useState(() => new Date().toISOString().split('T')[0]);
  const [cuadreHasta, setCuadreHasta] = useState(() => new Date().toISOString().split('T')[0]);

  // Detail modal
  const [selectedRecibo, setSelectedRecibo] = useState<Recibo | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<{ id: number; nombre: string; apellidos: string; cuit: string; empresa?: string; first_name?: string; last_name?: string; document_number?: string; company?: string }[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [newRecibo, setNewRecibo] = useState({
    cliente_id: null as number | null,
    cliente_label: '',
    tipo: 'recibo' as 'recibo' | 'anticipo' | 'ajuste',
    tipo_recaudo: 'oficina' as 'oficina' | 'aseguradora' | 'directo',
    valor_recaudado_en_oficina: '',
    fecha_realizo_pago_oficina: new Date().toISOString().split('T')[0],
    forma_pago: '',
    observaciones: '',
  });

  // Print modal
  const [printModal, setPrintModal] = useState<Recibo | null>(null);
  const [brokerInfo, setBrokerInfo] = useState<BrokerPrintData | null>(null);

  // Asociar a póliza modal
  const [asociarRecibo, setAsociarRecibo] = useState<Recibo | null>(null);
  const [asociarPolizas, setAsociarPolizas] = useState<any[]>([]);
  const [asociarLoading, setAsociarLoading] = useState(false);
  const [asociarPolizaId, setAsociarPolizaId] = useState<number | null>(null);
  const [asociando, setAsociando] = useState(false);

  // ── Load stats + broker on mount ──
  useEffect(() => {
    loadStats();
    loadBrokerInfo();
  }, []);

  const loadBrokerInfo = async () => {
    try {
      const res = await api.get('/saas/broker/profile');
      const b = res.data;
      if (b?.success) {
        setBrokerInfo({
          nombre: b.legal_name || b.name || '',
          legal_name: b.legal_name || '',
          nit: b.document_number || '',
          direccion: b.address || '',
          ciudad: b.city || '',
          telefono: b.phone || '',
          email: b.email || '',
          logo_url: b.logo_url || '',
        });
      }
    } catch { /* silent */ }
  };

  const handlePrint = (recibo: Recibo, format: 'media_carta' | 'carta') => {
    const data: ReciboPrintData = {
      numero_recibo: recibo.numero_recibo,
      fecha: recibo.fecha_realizo_pago_oficina || recibo.created_at,
      cliente_nombre: recibo.cliente_nombre || (recibo.cliente ? `${recibo.cliente.first_name} ${recibo.cliente.last_name}` : null),
      cliente_documento: recibo.cliente_documento || recibo.cliente?.document_number || null,
      poliza_numero: recibo.poliza_numero || recibo.poliza?.policy_number || null,
      poliza_objeto_asegurado: recibo.poliza_objeto_asegurado || null,
      aseguradora_nombre: recibo.aseguradora_nombre || null,
      ramo_nombre: recibo.ramo_nombre || null,
      numero_pago: recibo.numero_pago,
      pago_poliza_consecutivo: recibo.pago_poliza_consecutivo,
      forma_pago: recibo.forma_pago,
      medio_de_pago: recibo.medio_de_pago,
      moneda: recibo.moneda || 'COP',
      valor_recaudado_en_oficina: recibo.valor_recaudado_en_oficina || 0,
      saldo_pendiente: recibo.saldo_pendiente,
      es_anticipo: recibo.es_anticipo,
      recibo_anulado: recibo.recibo_anulado,
      observaciones: recibo.observaciones,
    };
    const broker: BrokerPrintData = brokerInfo || {
      nombre: 'Agencia de Seguros',
      nit: '',
    };
    printRecibo(data, broker, format);
    setPrintModal(null);
  };

  // ── Load data when tab/page/search changes ──
  useEffect(() => {
    if (tab === 'cuadre') {
      loadCuadre();
    } else {
      loadRecibos();
    }
  }, [tab, page, sortField, sortDir]);

  const loadStats = async () => {
    try {
      const res = await api.get('/saas/cartera/recibos-caja/estadisticas');
      if (res.data?.success) {
        setStats(res.data.data);
        if (res.data.data.tabs) {
          setTabCounts(res.data.data.tabs);
        }
      }
    } catch (e) { console.error('Error loading stats', e); }
  };

  const loadRecibos = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 25, sort_field: sortField, sort_dir: sortDir };
      if (search) params.search = search;
      if (tab !== 'cuadre') params.tab = tab;
      const res = await api.get('/saas/cartera/recibos-caja', { params });
      if (res.data?.success) {
        setRecibos(res.data.data || []);
        setPagination(res.data.pagination || null);
      }
    } catch (e) {
      console.error('Error loading recibos', e);
      toast({ title: 'Error', description: 'No se pudieron cargar los recibos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCuadre = async () => {
    setLoading(true);
    try {
      const res = await api.get('/saas/cartera/recibos-caja/cuadre', {
        params: { fecha_desde: cuadreDesde, fecha_hasta: cuadreHasta },
      });
      if (res.data?.success) setCuadre(res.data.data);
    } catch (e) {
      console.error('Error loading cuadre', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadRecibos();
  };

  // ── Client search for create modal ──
  const searchClients = async (q: string) => {
    if (q.length < 2) { setClientResults([]); return; }
    setClientSearching(true);
    try {
      const res = await api.get('/saas/clientes', { params: { search: q, per_page: 10 } });
      const items = res.data?.data?.data || res.data?.data || [];
      setClientResults(items);
    } catch { setClientResults([]); }
    finally { setClientSearching(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => { if (clientSearch) searchClients(clientSearch); }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const resetCreateForm = () => {
    setNewRecibo({
      cliente_id: null, cliente_label: '',
      tipo: 'recibo', tipo_recaudo: 'oficina',
      valor_recaudado_en_oficina: '', fecha_realizo_pago_oficina: new Date().toISOString().split('T')[0],
      forma_pago: '', observaciones: '',
    });
    setClientSearch('');
    setClientResults([]);
  };

  const handleCreateRecibo = async () => {
    if (!newRecibo.cliente_id) {
      toast({ title: 'Error', description: 'Debes seleccionar un cliente', variant: 'destructive' });
      return;
    }
    if (!newRecibo.valor_recaudado_en_oficina || Number(newRecibo.valor_recaudado_en_oficina) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un valor válido', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/saas/cartera/recibos-caja', {
        cliente_id: newRecibo.cliente_id,
        tipo: newRecibo.tipo,
        tipo_recaudo: newRecibo.tipo_recaudo,
        valor_recaudado_en_oficina: Number(newRecibo.valor_recaudado_en_oficina),
        fecha_realizo_pago_oficina: newRecibo.fecha_realizo_pago_oficina || null,
        forma_pago: newRecibo.forma_pago || null,
        observaciones: newRecibo.observaciones || null,
      });
      if (res.data?.success) {
        const createdRecibo = res.data.data;
        toast({ title: 'Recibo creado', description: `Recibo #${createdRecibo?.numero_recibo || createdRecibo?.id} creado exitosamente.` });
        setShowCreateModal(false);
        resetCreateForm();
        loadRecibos();
        loadStats();
        // Open print format modal so user can choose carta/media carta
        if (createdRecibo) {
          setPrintModal(createdRecibo);
        }
      } else {
        toast({ title: 'Error', description: res.data?.message || 'No se pudo crear el recibo', variant: 'destructive' });
      }
    } catch (e: any) {
      console.error('Error creating recibo', e);
      toast({ title: 'Error', description: e.response?.data?.message || 'Error al crear el recibo', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ── Asociar a póliza ──
  const openAsociarModal = async (recibo: Recibo) => {
    setAsociarRecibo(recibo);
    setAsociarPolizaId(null);
    setAsociarPolizas([]);
    if (recibo.cliente_id) {
      setAsociarLoading(true);
      try {
        const res = await api.get(`/saas/cartera/recibos-caja/polizas-cliente/${recibo.cliente_id}`);
        if (res.data?.success) setAsociarPolizas(res.data.data || []);
      } catch { /* silent */ }
      finally { setAsociarLoading(false); }
    }
  };

  const handleAsociar = async () => {
    if (!asociarRecibo || !asociarPolizaId) return;
    setAsociando(true);
    try {
      const res = await api.post(`/saas/cartera/recibos-caja/${asociarRecibo.id}/asociar-poliza`, {
        poliza_id: asociarPolizaId,
      });
      if (res.data?.success) {
        toast({ title: 'Recibo asociado', description: res.data.message || 'Recibo cruzado con póliza exitosamente' });
        setAsociarRecibo(null);
        loadRecibos();
        loadStats();
      } else {
        toast({ title: 'Error', description: res.data?.message || 'No se pudo asociar', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.response?.data?.message || 'Error al asociar', variant: 'destructive' });
    } finally { setAsociando(false); }
  };

  // ── Anular / Revertir handlers ──
  const [anularModal, setAnularModal] = useState<Recibo | null>(null);
  const [anularMotivo, setAnularMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);

  const handleAnular = async () => {
    if (!anularModal) return;
    setAnulando(true);
    try {
      const res = await api.post(`/saas/cartera/recibos-caja/${anularModal.id}/anular`, { motivo: anularMotivo || null });
      if (res.data?.success) {
        toast({ title: 'Recibo anulado', description: res.data.message || 'Recibo anulado correctamente' });
        setAnularModal(null);
        setAnularMotivo('');
        setSelectedRecibo(null);
        loadRecibos();
        loadStats();
      } else {
        toast({ title: 'Error', description: res.data?.message || 'No se pudo anular', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.response?.data?.message || 'Error al anular', variant: 'destructive' });
    } finally { setAnulando(false); }
  };

  const handleRevertir = async (recibo: Recibo) => {
    try {
      const res = await api.post(`/saas/cartera/recibos-caja/${recibo.id}/revertir`);
      if (res.data?.success) {
        toast({ title: 'Anulación revertida', description: res.data.message || 'Se revirtió la anulación correctamente' });
        setSelectedRecibo(null);
        loadRecibos();
        loadStats();
      } else {
        toast({ title: 'Error', description: res.data?.message || 'No se pudo revertir', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.response?.data?.message || 'Error al revertir', variant: 'destructive' });
    }
  };

  // ── Stats Cards ──
  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Recibos', value: stats.total_recibos.toLocaleString(), icon: 'solar:bill-list-bold-duotone', color: '#573CFF' },
      { label: 'Total Recaudado', value: fmt(stats.total_recaudado), icon: 'solar:hand-money-bold-duotone', color: '#10b981' },
      { label: 'Anticipos', value: stats.total_anticipos.toLocaleString(), icon: 'solar:wallet-bold-duotone', color: '#f59e0b' },
      { label: 'Pendiente Oficina', value: fmt(stats.pendiente_oficina), icon: 'solar:clock-circle-bold-duotone', color: '#ef4444' },
      { label: 'Pendiente Aseguradora', value: fmt(stats.pendiente_aseguradora), icon: 'solar:buildings-bold-duotone', color: '#6366f1' },
      { label: 'Anulados', value: stats.total_anulados.toLocaleString(), icon: 'solar:close-circle-bold-duotone', color: '#94a3b8' },
    ];
  }, [stats]);

  // ── Render ──
  return (
    <OnboardingGuard>
    <PermissionGate module="recibos_caja" action="ver">
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Icon icon="solar:bill-list-bold-duotone" className="text-3xl text-[#573CFF]" />
            Recibos y Cuadre de Caja
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de recibos, anticipos y cuadre diario de caja
          </p>
        </div>
        <Button color="blue" onClick={() => { resetCreateForm(); setShowCreateModal(true); }}>
          <Icon icon="solar:add-circle-bold" className="mr-2" width={20} />
          Crear Recibo
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statsCards.map((s, i) => (
            <Card key={i} className="!p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                  <Icon icon={s.icon} className="text-xl" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const count = t.key !== 'cuadre' ? tabCounts[t.key] : undefined;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'bg-white dark:bg-gray-700 text-[#573CFF] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon icon={t.icon} className="text-lg" />
              {t.label}
              {count !== undefined && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.key
                    ? 'bg-[#573CFF]/10 text-[#573CFF]'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === 'cuadre' ? (
        <CuadreView
          cuadre={cuadre}
          loading={loading}
          desde={cuadreDesde}
          hasta={cuadreHasta}
          setDesde={setCuadreDesde}
          setHasta={setCuadreHasta}
          onRefresh={loadCuadre}
        />
      ) : (
        <>
          {/* Search + Sort */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por # recibo, cliente, observaciones..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-700 dark:text-gray-200"
              value={`${sortField}:${sortDir}`}
              onChange={e => {
                const [f, d] = e.target.value.split(':');
                setSortField(f);
                setSortDir(d as 'asc' | 'desc');
                setPage(1);
              }}
            >
              <option value="numero_recibo:desc"># Recibo (mayor a menor)</option>
              <option value="numero_recibo:asc"># Recibo (menor a mayor)</option>
              <option value="id:desc">ID más reciente primero</option>
              <option value="id:asc">ID más antiguo primero</option>
              <option value="valor_recaudado_en_oficina:desc">Mayor valor primero</option>
              <option value="valor_recaudado_en_oficina:asc">Menor valor primero</option>
              <option value="fecha_realizo_pago_oficina:desc">Fecha más reciente</option>
              <option value="fecha_realizo_pago_oficina:asc">Fecha más antigua</option>
            </select>
            <Button color="primary" onClick={handleSearch}>
              <Icon icon="solar:magnifer-bold" className="mr-2" />Buscar
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="xl" /></div>
          ) : recibos.length === 0 ? (
            <div className="text-center py-20">
              <Icon icon="solar:bill-cross-bold-duotone" className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron recibos</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <Table hoverable>
                  <Table.Head>
                    <Table.HeadCell># Recibo</Table.HeadCell>
                    <Table.HeadCell>Fecha</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Aseguradora</Table.HeadCell>
                    <Table.HeadCell>Ramo</Table.HeadCell>
                    <Table.HeadCell>Cuota</Table.HeadCell>
                    <Table.HeadCell>Forma Pago</Table.HeadCell>
                    <Table.HeadCell className="text-right">Valor</Table.HeadCell>
                    <Table.HeadCell className="text-right">Saldo</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                    <Table.HeadCell></Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {recibos.map(r => {
                      const clienteDisplay = r.cliente_nombre || (r.cliente ? `${r.cliente.first_name} ${r.cliente.last_name}` : '—');
                      const docDisplay = r.cliente_documento || r.cliente?.document_number || '';
                      const polizaDisplay = r.poliza_numero || r.poliza?.policy_number || '—';
                      const objetoDisplay = r.poliza_objeto_asegurado || '';
                      const cuota = r.numero_pago && r.pago_poliza_consecutivo
                        ? `${r.numero_pago}/${r.pago_poliza_consecutivo}`
                        : r.numero_pago || '—';
                      return (
                        <Table.Row key={r.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setSelectedRecibo(r)}>
                          <Table.Cell className="font-medium">{r.numero_recibo || '—'}</Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">{fmtDate(r.fecha_realizo_pago_oficina)}</Table.Cell>
                          <Table.Cell>
                            {(r.cliente_id || r.cliente?.id) ? (
                              <Link
                                to={`/apps/seguros/clientes/editar/${r.cliente_id || r.cliente?.id}`}
                                className="block hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="text-sm font-medium max-w-[180px] truncate text-blue-600 dark:text-blue-400" title={clienteDisplay}>{clienteDisplay}</div>
                                <div className="text-xs text-gray-400">{docDisplay}</div>
                              </Link>
                            ) : (
                              <>
                                <div className="text-sm font-medium max-w-[180px] truncate" title={clienteDisplay}>{clienteDisplay}</div>
                                <div className="text-xs text-gray-400">{docDisplay}</div>
                              </>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {(r.poliza?.id || r.poliza_id) ? (
                              <Link
                                to={`/apps/seguros/polizas/editar/${r.poliza?.id || r.poliza_id}`}
                                className="block hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="text-sm max-w-[150px] truncate text-blue-600 dark:text-blue-400" title={polizaDisplay}>{polizaDisplay}</div>
                                {objetoDisplay && <div className="text-xs text-gray-400 truncate max-w-[150px]" title={objetoDisplay}>{objetoDisplay}</div>}
                              </Link>
                            ) : (
                              <>
                                <div className="text-sm max-w-[150px] truncate" title={polizaDisplay}>{polizaDisplay}</div>
                                {objetoDisplay && <div className="text-xs text-gray-400 truncate max-w-[150px]" title={objetoDisplay}>{objetoDisplay}</div>}
                              </>
                            )}
                          </Table.Cell>
                          <Table.Cell className="text-sm">{r.aseguradora_nombre || '—'}</Table.Cell>
                          <Table.Cell className="text-sm">{r.ramo_nombre || '—'}</Table.Cell>
                          <Table.Cell className="text-sm text-center">{cuota}</Table.Cell>
                          <Table.Cell><div className="text-sm max-w-[120px] truncate" title={r.forma_pago || ''}>{r.forma_pago || '—'}</div></Table.Cell>
                          <Table.Cell className="text-right font-semibold text-sm whitespace-nowrap">{fmt(r.valor_recaudado_en_oficina)}</Table.Cell>
                          <Table.Cell className="text-right text-sm whitespace-nowrap">{fmt(r.saldo_pendiente)}</Table.Cell>
                          <Table.Cell>
                            {r.recibo_anulado ? (
                              <Badge color="failure" className="text-xs">Anulado</Badge>
                            ) : r.recibo_pago_directo ? (
                              <Badge color="purple" className="text-xs">Pago Directo</Badge>
                            ) : r.recaudado_en_oficina ? (
                              <Badge color="success" className="text-xs">Recaudado</Badge>
                            ) : (
                              <Badge color="gray" className="text-xs">Pendiente</Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-1">
                              <button
                                title="Imprimir recibo"
                                className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition"
                                onClick={e => { e.stopPropagation(); setPrintModal(r); }}
                              >
                                <Icon icon="solar:printer-linear" width={18} />
                              </button>
                              {!r.poliza_id && !r.recibo_anulado && r.cliente_id && (
                                <button
                                  title="Asociar a póliza"
                                  className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-500 transition"
                                  onClick={e => { e.stopPropagation(); openAsociarModal(r); }}
                                >
                                  <Icon icon="solar:link-round-linear" width={18} />
                                </button>
                              )}
                              {!r.recibo_anulado ? (
                                <button
                                  title="Anular"
                                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition"
                                  onClick={e => { e.stopPropagation(); setAnularModal(r); setAnularMotivo(''); }}
                                >
                                  <Icon icon="solar:close-circle-linear" width={18} />
                                </button>
                              ) : (
                                <button
                                  title="Revertir anulación"
                                  className="p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-500 transition"
                                  onClick={e => { e.stopPropagation(); handleRevertir(r); }}
                                >
                                  <Icon icon="solar:undo-left-linear" width={18} />
                                </button>
                              )}
                              <Icon icon="solar:alt-arrow-right-linear" className="text-gray-400" />
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.last_page > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1}–{Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total.toLocaleString()}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" color="light" disabled={pagination.current_page === 1} onClick={() => setPage(p => p - 1)}>
                      <Icon icon="solar:alt-arrow-left-linear" />
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium">{pagination.current_page} / {pagination.last_page}</span>
                    <Button size="sm" color="light" disabled={pagination.current_page === pagination.last_page} onClick={() => setPage(p => p + 1)}>
                      <Icon icon="solar:alt-arrow-right-linear" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal show={!!selectedRecibo} onClose={() => setSelectedRecibo(null)} size="xl">
        <Modal.Header>
          Recibo #{selectedRecibo?.numero_recibo || selectedRecibo?.id}
        </Modal.Header>
        <Modal.Body>
          {selectedRecibo && <ReciboDetail recibo={selectedRecibo} />}
        </Modal.Body>
        {selectedRecibo && (
          <Modal.Footer>
            <div className="flex gap-2 w-full justify-end">
              <Button color="blue" size="sm" onClick={() => setPrintModal(selectedRecibo)}>
                <Icon icon="solar:printer-bold" className="mr-1.5" width={16} />
                Imprimir
              </Button>
              {!selectedRecibo.poliza_id && !selectedRecibo.recibo_anulado && selectedRecibo.cliente_id && (
                <Button color="purple" size="sm" onClick={() => { setSelectedRecibo(null); openAsociarModal(selectedRecibo); }}>
                  <Icon icon="solar:link-round-bold" className="mr-1.5" width={16} />
                  Asociar a Póliza
                </Button>
              )}
              {!selectedRecibo.recibo_anulado ? (
                <Button color="failure" size="sm" onClick={() => { setAnularModal(selectedRecibo); setAnularMotivo(''); }}>
                  <Icon icon="solar:close-circle-bold" className="mr-1.5" width={16} />
                  Anular Recibo
                </Button>
              ) : (
                <Button color="warning" size="sm" onClick={() => handleRevertir(selectedRecibo)}>
                  <Icon icon="solar:undo-left-bold" className="mr-1.5" width={16} />
                  Revertir Anulación
                </Button>
              )}
              <Button color="light" size="sm" onClick={() => setSelectedRecibo(null)}>Cerrar</Button>
            </div>
          </Modal.Footer>
        )}
      </Modal>

      {/* Anular Confirmation Modal */}
      <Modal show={!!anularModal} onClose={() => setAnularModal(null)} size="md">
        <Modal.Header>
          <span className="text-red-600 flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" width={20} />
            Anular Recibo #{anularModal?.numero_recibo || anularModal?.id}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ¿Estás seguro de anular este recibo? El recibo pasará al estado <strong>Anulado</strong> y dejará de estar activo.
              Esta acción se puede revertir después.
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
              <div><span className="text-gray-500">Cliente:</span> <strong>{anularModal?.cliente_nombre || '—'}</strong></div>
              <div><span className="text-gray-500">Valor:</span> <strong>{fmt(anularModal?.valor_recaudado_en_oficina)}</strong></div>
              <div><span className="text-gray-500">Póliza:</span> <strong>{anularModal?.poliza_numero || '—'}</strong></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo de anulación (opcional)</label>
              <Textarea
                rows={2}
                placeholder="Describe el motivo de la anulación..."
                value={anularMotivo}
                onChange={e => setAnularMotivo(e.target.value)}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex gap-2 w-full justify-end">
            <Button color="light" size="sm" onClick={() => setAnularModal(null)} disabled={anulando}>Cancelar</Button>
            <Button color="failure" size="sm" onClick={handleAnular} disabled={anulando}>
              {anulando ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:close-circle-bold" className="mr-1.5" width={16} />}
              Confirmar Anulación
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Print Format Modal */}
      <Modal show={!!printModal} onClose={() => setPrintModal(null)} size="sm">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:printer-bold-duotone" width={20} className="text-blue-500" />
            Imprimir Recibo #{printModal?.numero_recibo || printModal?.id}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona el formato de impresión:</p>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => printModal && handlePrint(printModal, 'media_carta')}
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:document-bold-duotone" className="text-blue-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-600">Media Carta</p>
                <p className="text-xs text-gray-400">Sin copia, tamaño reducido</p>
              </div>
            </button>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => printModal && handlePrint(printModal, 'carta')}
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:copy-bold-duotone" className="text-indigo-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600">Carta Completa (con copia)</p>
                <p className="text-xs text-gray-400">Original + copia en hoja completa</p>
              </div>
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Create Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <Modal.Header>
          Crear {newRecibo.tipo === 'anticipo' ? 'Anticipo' : newRecibo.tipo === 'ajuste' ? 'Ajuste' : 'Recibo'}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
                <Select value={newRecibo.tipo} onChange={e => setNewRecibo({ ...newRecibo, tipo: e.target.value as any })}>
                  <option value="recibo">Recibo</option>
                  <option value="anticipo">Anticipo</option>
                  <option value="ajuste">Ajuste</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Recaudo *</label>
                <Select value={newRecibo.tipo_recaudo} onChange={e => setNewRecibo({ ...newRecibo, tipo_recaudo: e.target.value as any })}>
                  <option value="oficina">Oficina</option>
                  <option value="aseguradora">Aseguradora</option>
                  <option value="directo">Pago Directo</option>
                </Select>
              </div>
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
              {newRecibo.cliente_id ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Icon icon="solar:user-bold" className="text-blue-500" width={20} />
                  <span className="flex-1 text-sm font-medium">{newRecibo.cliente_label}</span>
                  <button onClick={() => { setNewRecibo({ ...newRecibo, cliente_id: null, cliente_label: '' }); setClientSearch(''); }} className="text-red-500 hover:text-red-700">
                    <Icon icon="solar:close-circle-bold" width={18} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <TextInput
                    placeholder="Buscar cliente por nombre o documento..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    icon={() => clientSearching ? <Spinner size="sm" /> : <Icon icon="solar:magnifer-linear" width={16} />}
                  />
                  {clientResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {clientResults.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex justify-between"
                          onClick={() => {
                            const label = c.empresa || c.company || `${c.nombre || c.first_name || ''} ${c.apellidos || c.last_name || ''}`.trim();
                            const doc = c.cuit || c.document_number || 'S/D';
                            setNewRecibo({ ...newRecibo, cliente_id: c.id, cliente_label: `${label} — ${doc}` });
                            setClientResults([]);
                            setClientSearch('');
                          }}
                        >
                          <span className="font-medium">{c.empresa || c.company || `${c.nombre || c.first_name || ''} ${c.apellidos || c.last_name || ''}`.trim()}</span>
                          <span className="text-gray-400">{c.cuit || c.document_number}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor *</label>
              <TextInput
                type="number"
                placeholder="0"
                value={newRecibo.valor_recaudado_en_oficina}
                onChange={e => setNewRecibo({ ...newRecibo, valor_recaudado_en_oficina: e.target.value })}
              />
            </div>

            {/* Fecha y Forma de pago */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                <TextInput
                  type="date"
                  value={newRecibo.fecha_realizo_pago_oficina}
                  onChange={e => setNewRecibo({ ...newRecibo, fecha_realizo_pago_oficina: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pago</label>
                <Select value={newRecibo.forma_pago} onChange={e => setNewRecibo({ ...newRecibo, forma_pago: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                  <option value="Tarjeta Débito">Tarjeta Débito</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Nequi">Nequi</option>
                  <option value="Daviplata">Daviplata</option>
                  <option value="PSE">PSE</option>
                </Select>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observación</label>
              <Textarea
                placeholder="Observación"
                value={newRecibo.observaciones}
                onChange={e => setNewRecibo({ ...newRecibo, observaciones: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
          <Button color="blue" onClick={handleCreateRecibo} disabled={creating}>
            {creating ? <Spinner size="sm" className="mr-2" /> : null}
            Aceptar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Asociar a Póliza Modal */}
      <Modal show={!!asociarRecibo} onClose={() => setAsociarRecibo(null)} size="xl">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:link-round-bold-duotone" width={20} className="text-blue-500" />
            Asociar Recibo #{asociarRecibo?.numero_recibo || asociarRecibo?.id} a una Póliza
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {/* Recibo info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium">{asociarRecibo?.cliente_nombre || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valor:</span>
                <span className="font-bold text-green-600">{fmt(asociarRecibo?.valor_recaudado_en_oficina || asociarRecibo?.valor_a_pagar || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo recaudo:</span>
                <span className="font-medium capitalize">{asociarRecibo?.tipo_recaudo}</span>
              </div>
            </div>

            {asociarLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
                <span className="ml-2 text-gray-500">Cargando pólizas del cliente...</span>
              </div>
            ) : asociarPolizas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Icon icon="solar:document-text-bold-duotone" className="mx-auto text-4xl mb-2 text-gray-300" />
                <p className="font-medium">No se encontraron pólizas activas para este cliente</p>
                <p className="text-xs mt-1">Puedes cerrar y asociar más adelante</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selecciona la póliza a la que deseas cruzar este recibo:
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {asociarPolizas.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAsociarPolizaId(p.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        asociarPolizaId === p.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {p.policy_number}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {p.aseguradora} · {p.ramo}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{fmt(p.total)}</p>
                          {p.pendiente > 0 ? (
                            <p className="text-xs text-red-500">Pendiente: {fmt(p.pendiente)}</p>
                          ) : (
                            <p className="text-xs text-green-500">Pagada completa</p>
                          )}
                        </div>
                      </div>
                      {p.num_cuotas > 1 && (
                        <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                          <span>{p.num_cuotas} cuotas de {fmt(p.monto_cuota)}</span>
                          <span>Pagado: {fmt(p.pagado)}</span>
                        </div>
                      )}
                      {asociarPolizaId === p.id && (
                        <div className="mt-2 flex items-center gap-1 text-blue-600 text-xs font-medium">
                          <Icon icon="solar:check-circle-bold" width={14} />
                          Seleccionada
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setAsociarRecibo(null)}>
            {asociarPolizas.length === 0 ? 'Cerrar' : 'Omitir'}
          </Button>
          {asociarPolizas.length > 0 && (
            <Button color="blue" onClick={handleAsociar} disabled={!asociarPolizaId || asociando}>
              {asociando ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:link-round-bold" className="mr-2" width={16} />}
              Asociar y Cruzar en Cartera
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
    </PermissionGate>
    </OnboardingGuard>
  );
};

// ─── Cuadre de Caja View ──────────────────────────────────────────────
const CuadreView = ({
  cuadre, loading, desde, hasta, setDesde, setHasta, onRefresh,
}: {
  cuadre: CuadreCaja | null; loading: boolean;
  desde: string; hasta: string;
  setDesde: (v: string) => void; setHasta: (v: string) => void;
  onRefresh: () => void;
}) => (
  <div className="space-y-6">
    {/* Date range */}
    <Card>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <Button color="primary" onClick={onRefresh}>
          <Icon icon="solar:refresh-bold" className="mr-2" />Consultar
        </Button>
        <Button color="light" onClick={() => {
          const today = new Date().toISOString().split('T')[0];
          setDesde(today);
          setHasta(today);
          setTimeout(onRefresh, 100);
        }}>
          Hoy
        </Button>
      </div>
    </Card>

    {loading ? (
      <div className="flex justify-center py-20"><Spinner size="xl" /></div>
    ) : cuadre ? (
      <>
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="!p-5 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Recaudado</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmt(cuadre.total_recaudado_oficina)}</p>
          </Card>
          <Card className="!p-5 border-l-4 border-l-blue-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Recibos</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{cuadre.total_recibos}</p>
          </Card>
          <Card className="!p-5 border-l-4 border-l-amber-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Anticipos</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{cuadre.total_anticipos}</p>
          </Card>
          <Card className="!p-5 border-l-4 border-l-red-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Anulados</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{cuadre.total_anulados}</p>
          </Card>
        </div>

        {/* By payment method */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Icon icon="solar:card-bold-duotone" className="text-lg text-[#573CFF]" />
              Por Forma de Pago
            </h3>
            {cuadre.por_forma_pago.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos para este período</p>
            ) : (
              <div className="space-y-3">
                {cuadre.por_forma_pago.map((fp, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#573CFF]/10 flex items-center justify-center">
                        <Icon icon="solar:card-bold" className="text-[#573CFF]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{fp.forma_pago || 'Sin definir'}</p>
                        <p className="text-xs text-gray-400">{fp.cantidad} recibos</p>
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{fmt(fp.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Comisiones */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Icon icon="solar:dollar-bold-duotone" className="text-lg text-green-500" />
              Comisiones del Período
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total comisiones</span>
                <span className="font-semibold">{fmt(cuadre.comisiones.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Pagadas</span>
                <span className="font-semibold text-green-600">{fmt(cuadre.comisiones.pagadas)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Pendientes</span>
                <span className="font-semibold text-amber-600">{fmt(cuadre.comisiones.pendientes)}</span>
              </div>
              {cuadre.comisiones.total > 0 && (
                <div className="pt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (cuadre.comisiones.pagadas / cuadre.comisiones.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {((cuadre.comisiones.pagadas / cuadre.comisiones.total) * 100).toFixed(1)}% cobrado
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </>
    ) : (
      <div className="text-center py-20">
        <Icon icon="solar:calculator-bold-duotone" className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Selecciona un rango de fechas y consulta</p>
      </div>
    )}
  </div>
);

// ─── Recibo Detail ───────────────────────────────────────────────────
const ReciboDetail = ({ recibo }: { recibo: Recibo }) => {
  const clienteName = recibo.cliente_nombre || (recibo.cliente ? `${recibo.cliente.first_name} ${recibo.cliente.last_name}` : '—');
  const clienteDoc = recibo.cliente_documento || recibo.cliente?.document_number || '—';
  const polizaNum = recibo.poliza_numero || recibo.poliza?.policy_number || '—';
  const cuota = recibo.numero_pago && recibo.pago_poliza_consecutivo
    ? `${recibo.numero_pago} de ${recibo.pago_poliza_consecutivo}`
    : recibo.numero_pago || '—';

  const clienteId = recibo.cliente_id || recibo.cliente?.id;
  const polizaId = recibo.poliza_id || recibo.poliza?.id;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: '# Recibo', value: recibo.numero_recibo || '—' },
    { label: 'Tipo', value: recibo.es_anticipo ? 'Anticipo' : recibo.recibo_pago_directo ? 'Pago Directo' : recibo.tipo },
    { label: 'Tipo Recaudo', value: recibo.tipo_recaudo },
    { label: 'Cuota', value: cuota },
    { label: 'Forma de Pago', value: recibo.forma_pago || '—' },
    { label: 'Moneda', value: recibo.moneda || 'COP' },
    { label: 'Fecha Pago', value: fmtDate(recibo.fecha_realizo_pago_oficina) },
    { label: 'Valor Recaudado', value: fmt(recibo.valor_recaudado_en_oficina) },
    { label: 'Valor a Pagar', value: fmt(recibo.valor_a_pagar) },
    { label: 'Saldo Pendiente', value: fmt(recibo.saldo_pendiente) },
    { label: 'Saldo Pend. Oficina', value: fmt(recibo.saldo_pendiente_oficina) },
    { label: 'Saldo Pend. Aseguradora', value: fmt(recibo.saldo_pendiente_aseguradora) },
    { label: 'Comisión a Recibir', value: fmt(recibo.comision_a_recibir) },
    { label: 'Comisión Vendedor', value: fmt(recibo.comision_vendedor) },
    { label: 'Cliente', value: clienteId
      ? <Link to={`/apps/seguros/clientes/editar/${clienteId}`} className="text-blue-600 dark:text-blue-400 hover:underline">{clienteName}</Link>
      : clienteName },
    { label: 'Documento', value: clienteDoc },
    { label: 'Póliza', value: polizaId
      ? <Link to={`/apps/seguros/polizas/editar/${polizaId}`} className="text-blue-600 dark:text-blue-400 hover:underline">{polizaNum}</Link>
      : polizaNum },
    { label: 'Objeto Asegurado', value: recibo.poliza_objeto_asegurado || '—' },
    { label: 'Aseguradora', value: recibo.aseguradora_nombre || '—' },
    { label: 'Ramo', value: recibo.ramo_nombre || '—' },
    { label: 'Sede', value: recibo.sede_nombre || '—' },
    { label: 'Usuario Recauda', value: recibo.usuario_recauda || '—' },
    { label: 'Vendedor', value: recibo.vendedor_nombre || '—' },
    { label: 'Fuente', value: recibo.source === 'softseguros' ? 'SoftSeguros' : 'Guro' },
  ];

  // Add anulación info if applicable
  if (recibo.recibo_anulado) {
    fields.push(
      { label: 'Fecha Anulación', value: fmtDate(recibo.fecha_recibo_anulado) },
      { label: 'Anuló', value: recibo.usuario_anulo_recibo || '—' },
    );
  }

  return (
    <div className="space-y-4">
      {/* Anulación alert */}
      {recibo.recibo_anulado && (
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Icon icon="solar:danger-triangle-bold" className="text-red-500 text-xl mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Recibo Anulado</p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
              Anulado el {fmtDate(recibo.fecha_recibo_anulado)} por {recibo.usuario_anulo_recibo || 'Sistema'}
            </p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        {recibo.recibo_anulado && <Badge color="failure">Anulado</Badge>}
        {recibo.es_anticipo && <Badge color="warning">Anticipo</Badge>}
        {recibo.recibo_pago_directo && <Badge color="purple">Pago Directo</Badge>}
        {recibo.recaudado_en_oficina && !recibo.recibo_pago_directo && <Badge color="success">Recaudado en Oficina</Badge>}
        {recibo.comisionada && <Badge color="info">Comisionada</Badge>}
        {recibo.source === 'softseguros' && <Badge color="purple">SoftSeguros</Badge>}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {fields.map((f, i) => (
          <div key={i}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{f.label}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Observaciones */}
      {recibo.observaciones && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Observaciones</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{recibo.observaciones}</p>
        </div>
      )}
    </div>
  );
};

export default RecibosCuadreCaja;


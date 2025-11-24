import React, { useState, useEffect } from 'react';
import PermissionGate from 'src/components/PermissionGate';
import {
  Card,
  Button,
  Badge,
  Table,
  Modal,
  Tabs,
  Spinner,
  Dropdown,
  Checkbox,
} from 'flowbite-react';
import HistorialPoliza from './components/HistorialPoliza';
import RenovacionesPoliza from './components/RenovacionesPoliza';

import { IconDots } from '@tabler/icons-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';

import {
  polizaService,
  polizaUtils,
  type Poliza,
  type PolizaFilters,
} from 'src/services/polizaService';
import saasApi from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import PolizasFilterModal from './components/PolizasFilterModal';
import ColumnsCustomizationModal from './components/ColumnsCustomizationModal';
import PolizasExportModal from './components/PolizasExportModal';
import PolicyNotificationsModal from './components/PolicyNotificationsModal';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import OnboardingGuard from '../../../../components/auth/OnboardingGuard';
import policyNotificationService from 'src/services/policyNotificationService';

const Polizas: React.FC = () => {
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPoliza, setSelectedPoliza] = useState<Poliza | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [polizaToDelete, setPolizaToDelete] = useState<Poliza | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [autosTabLoading, setAutosTabLoading] = useState(false);
  const [autosVinculados, setAutosVinculados] = useState<any[]>([]);

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStateModal, setShowBulkStateModal] = useState(false);
  const [bulkTargetState, setBulkTargetState] = useState<string>('ACTIVA');

  // Paginación manejada por backend (se controla vía filtros page/per_page)

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: saasLoading, usuarioSaas, hasPermission } = useUnifiedAuth();
  const canCreatePolicy = hasPermission ? hasPermission('polizas', 'crear') : false;
  const canEditPolicy = hasPermission ? hasPermission('polizas', 'editar') : false;
  const canDeletePolicy = hasPermission ? hasPermission('polizas', 'eliminar') : false;

  // Verificar autenticación
  useEffect(() => {
    if (!saasLoading && !user) {
      navigate('/auth/auth1/login');
    } else if (!saasLoading && user) {
    } else {
    }
  }, [saasLoading, user, navigate]);

  // Columnas visibles (máximo 6)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'numero_poliza',
    'cliente',
    'aseguradora',
    'ramo',
    'estado',
    'prima_neta',
  ]);

  // Filtros
  const [filters, setFilters] = useState<PolizaFilters>({
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

  const tiposSeguro = [
    { value: 'vida', label: 'Vida', icon: 'solar:heart-bold-duotone', color: 'red' },
    { value: 'automovil', label: 'Automóvil', icon: 'solar:car-bold-duotone', color: 'blue' },
    { value: 'hogar', label: 'Hogar', icon: 'solar:home-bold-duotone', color: 'green' },
    { value: 'salud', label: 'Salud', icon: 'solar:medical-kit-bold-duotone', color: 'pink' },
    {
      value: 'empresarial',
      label: 'Empresarial',
      icon: 'solar:buildings-bold-duotone',
      color: 'purple',
    },
    { value: 'soat', label: 'SOAT', icon: 'solar:car-bold-duotone', color: 'yellow' },
    {
      value: 'responsabilidad_civil',
      label: 'Responsabilidad Civil',
      icon: 'solar:shield-check-bold-duotone',
      color: 'indigo',
    },
    {
      value: 'todo_riesgo',
      label: 'Todo Riesgo',
      icon: 'solar:shield-star-bold-duotone',
      color: 'cyan',
    },
    { value: 'incendio', label: 'Incendio', icon: 'solar:fire-bold-duotone', color: 'orange' },
    {
      value: 'transporte',
      label: 'Transporte',
      icon: 'solar:delivery-bold-duotone',
      color: 'teal',
    },
    {
      value: 'accidentes',
      label: 'Accidentes Personales',
      icon: 'solar:medical-kit-bold-duotone',
      color: 'rose',
    },
  ];

  const aseguradoras = [
    'Seguros Sura',
    'Mapfre',
    'Bolívar Seguros',
    'La Previsora',
    'AXA Colpatria',
    'Allianz',
    'Liberty Seguros',
    'Solidaria',
    'La Equidad',
    'Mundial',
  ];

  const estadosPoliza = [
    { value: 'ACTIVA', label: 'Activa', color: 'success' },
    { value: 'VENCIDA', label: 'Vencida', color: 'warning' },
    { value: 'CANCELADA', label: 'Cancelada', color: 'failure' },
    { value: 'SUSPENDIDA', label: 'Suspendida', color: 'gray' },
    { value: 'POR_VENCER', label: 'Por Vencer', color: 'info' },
  ];

  // Cargar pólizas
  const loadPolizas = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando carga de pólizas con filtros:', filters);

      const response = await polizaService.getPolizas(filters);
      console.log('📄 Respuesta completa del servicio:', response);

      if (response && response.data) {
        const polizasData = response.data;
        console.log('🔍 Datos de pólizas procesados:', polizasData);

        // El backend devuelve directamente el array de pólizas
        if (Array.isArray(polizasData)) {
          console.log('✅ Asignando pólizas al estado (array directo):', polizasData);
          setPolizas(polizasData);
          // Mostrar todos los resultados sin paginación
          setPagination({
            current_page: 1,
            last_page: 1,
            per_page: polizasData.length,
            total: polizasData.length,
            from: 1,
            to: polizasData.length,
          });
        } else if (polizasData && polizasData.data && Array.isArray(polizasData.data)) {
          // Estructura paginada tradicional (fallback)
          console.log('✅ Asignando pólizas al estado (estructura paginada):', polizasData.data);
          setPolizas(polizasData.data);
          setPagination({
            current_page: polizasData.current_page,
            last_page: polizasData.last_page,
            per_page: polizasData.per_page,
            total: polizasData.total,
            from: polizasData.from,
            to: polizasData.to,
          });
        } else {
          console.log('❌ Estructura de datos no válida:', polizasData);
          setPolizas([]);
        }
      } else {
        console.log('❌ Respuesta sin datos:', response);
        setPolizas([]);
      }
    } catch (error) {
      console.error('💥 Error en loadPolizas:', error);
      // Si hay error de autenticación, redirigir al login
      if (error instanceof Error && error.message.includes('Unauthenticated')) {
        navigate('/auth/auth1/login');
      }
      setPolizas([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadEstadisticas = async () => {
    try {
      const response = await polizaService.getEstadisticas();
      if (response.success && response.data) {
        setEstadisticas(response.data);
      }
    } catch (error) {
      // Si hay error de autenticación, redirigir al login
      if (error instanceof Error && error.message.includes('Unauthenticated')) {
        navigate('/auth/auth1/login');
      }
      // Establecer estadísticas vacías para evitar errores de renderizado
      setEstadisticas({
        total_polizas: 0,
        polizas_activas: 0,
        polizas_vencidas: 0,
        polizas_por_vencer: 0,
        prima_total: 0,
        comision_total: 0,
        polizas_por_mes: [],
        polizas_por_ramo: [],
        polizas_por_estado: [],
        polizas_por_aseguradora: [],
      });
    }
  };

  // Sin paginación local: usamos la info de paginación del backend en 'pagination'

  // Efectos
  useEffect(() => {
    loadPolizas();
  }, [filters]);

  useEffect(() => {
    loadEstadisticas();
    loadNotificationStatus();
  }, []);

  // Abrir modal por param open_policy_id desde el buscador global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_policy_id') || params.get('open_poliza_id');
    if (openId) {
      if (!showModal || String(selectedPoliza?.id) !== String(openId)) {
        openPolizaById(String(openId));
      }
    }
  }, [location.search]);

  // Cargar estado de notificaciones
  const loadNotificationStatus = async () => {
    try {
      console.log('🔔 Cargando estado de notificaciones...');
      const config = await policyNotificationService.getConfig();
      console.log('🔔 Estado de notificaciones cargado:', config);
      console.log('🔔 is_active:', config?.is_active);
      console.log('🔔 whatsapp_status:', config?.whatsapp_status);
      setNotificationStatus(config);
    } catch (error) {
      console.error('❌ Error cargando estado de notificaciones:', error);
      // Establecer un estado por defecto para evitar que el botón quede sin color
      setNotificationStatus({
        is_active: false,
        whatsapp_status: null,
      });
    }
  };

  // Deep-link helpers (desde buscador global)
  const openPolizaById = async (id: string) => {
    try {
      const resp = await polizaService.getPoliza(String(id));
      const pol: any = (resp as any)?.data ?? resp;
      if (pol) {
        // Reusar lógica estándar para precargar pestañas (automóviles, etc.)
        handleViewPoliza(pol as any);
      }
    } catch (e) {
      console.error('Error abriendo póliza por ID desde query param:', e);
    }
  };

  const handleCloseDetailsModal = () => {
    setShowModal(false);
    try {
      const params = new URLSearchParams(location.search);
      params.delete('open_policy_id');
      params.delete('open_poliza_id');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    } catch {}
  };

  // Handlers
  const handleFilterChange = (key: keyof PolizaFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      // Si cambia cualquier filtro distinto a la página o per_page, reiniciar a página 1
      page: key === 'page' || key === 'per_page' ? (key === 'page' ? (value as any) : 1) : 1,
    }));
  };

  const handleFiltersChange = (newFilters: PolizaFilters) => {
    setFilters({
      ...newFilters,
      page: 1,
    });
  };

  const handleVisibleColumnsChange = (columns: string[]) => {
    setVisibleColumns(columns);
  };

  const handleViewPoliza = (poliza: Poliza) => {
    setSelectedPoliza(poliza);
    setShowModal(true);
    // Precargar automóviles si hay placas o si es ramo automotriz
    const hasPlacas = Array.isArray((poliza as any).placas) && (poliza as any).placas.length > 0;
    const isAuto = String((poliza as any).ramo_principal || (poliza as any).ramo_nombre || '')
      .toLowerCase()
      .includes('auto');
    if (isAuto || hasPlacas) {
      setAutosTabLoading(true);
      saasApi
        .getAutomoviles({ poliza_id: poliza.id, per_page: 50 })
        .then((resp) => {
          const payload: any = resp.data || {};
          const data = Array.isArray(payload) ? payload : payload.data || [];
          setAutosVinculados(data);
        })
        .finally(() => setAutosTabLoading(false));
    } else {
      setAutosVinculados([]);
    }
  };

  const handleDeletePoliza = async (poliza: Poliza) => {
    setPolizaToDelete(poliza);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!polizaToDelete) return;

    try {
      await polizaService.deletePoliza(polizaToDelete.id!);
      await loadPolizas();
      await loadEstadisticas();
      setShowDeleteModal(false);
      setPolizaToDelete(null);
    } catch (error) {}
  };

  const handleChangeEstado = async (poliza: Poliza, nuevoEstado: string) => {
    try {
      await polizaService.cambiarEstado(poliza.id!, nuevoEstado as any);
      await loadPolizas();
      await loadEstadisticas();
    } catch (error) {}
  };

  const getTipoIcon = (tipo: string) => {
    const tipoInfo = tiposSeguro.find((t) => t.value === tipo);
    if (tipoInfo) {
      return <Icon icon={tipoInfo.icon} className="w-4 h-4" />;
    }
    return <Icon icon="solar:document-bold-duotone" className="w-4 h-4" />;
  };

  const getEstadoBadge = (estado: string) => {
    const estadoInfo = estadosPoliza.find((e) => e.value === estado);
    return estadoInfo ? (estadoInfo.color as any) : 'gray';
  };

  const getDiasVencimiento = (poliza: Poliza) => {
    const dias = polizaUtils.getDiasVencimiento(poliza.fecha_fin);
    if (dias < 0) return 'Vencida';
    if (dias === 0) return 'Vence hoy';
    if (dias <= 30) return `${dias} días`;
    return `${Math.ceil(dias / 30)} meses`;
  };

  const getColorVencimiento = (poliza: Poliza) => {
    const dias = polizaUtils.getDiasVencimiento(poliza.fecha_fin);
    if (dias < 0) return 'text-red-600';
    if (dias <= 30) return 'text-orange-600';
    return 'text-green-600';
  };
  // Formateo seguro de fechas para evitar desfase por zona horaria (YYYY-MM-DD)
  // new Date('YYYY-MM-DD') se interpreta como UTC y al convertir a hora local puede restar un día.
  // Con esta utilidad, si el valor es solo fecha (sin hora), se formatea manualmente.
  const isISODateOnly = (s: any): boolean => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const formatDate = (value: any): string => {
    if (!value) return '-';

    // Si es una fecha ISO solo-fecha (YYYY-MM-DD), formatear manualmente para evitar problemas de zona horaria
    if (isISODateOnly(value)) {
      const [y, m, d] = String(value).split('-');
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      return `${dd}/${mm}/${y}`;
    }

    // Si es una fecha ISO con hora (YYYY-MM-DDTHH:mm:ss), también formatear manualmente la parte de fecha
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const [datePart] = value.split('T');
      const [y, m, d] = datePart.split('-');
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      return `${dd}/${mm}/${y}`;
    }

    try {
      const dt = typeof value === 'string' ? new Date(value) : value;
      if (isNaN(dt.getTime())) return String(value);

      // Para fechas que no son ISO, usar formateo manual para evitar problemas de zona horaria
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return String(value);
    }
  };

  // Función para renderizar celda según la columna
  const renderTableCell = (poliza: Poliza, columnKey: string) => {
    switch (columnKey) {
      case 'numero_poliza':
        return (
          <div className="flex items-center gap-2">
            {getTipoIcon(poliza.ramo_principal)}
            {poliza.numero_poliza}
          </div>
        );
      case 'cliente':
        return (
          <div>
            <div className="font-medium uppercase">
              {poliza.nombres_cliente} {poliza.apellidos_cliente}
            </div>
            <div className="text-sm text-gray-500">{poliza.dni_cliente}</div>
          </div>
        );
      case 'aseguradora':
        return (poliza as any).aseguradora_nombre || poliza.aseguradora;
      case 'ramo':
        return (
          <div className="flex items-center gap-2">
            {getTipoIcon(poliza.ramo_principal)}
            <span className="uppercase">
              {(poliza as any).ramo_nombre ||
                tiposSeguro.find((t) => t.value === poliza.ramo_principal)?.label ||
                poliza.ramo_principal}
            </span>
          </div>
        );
      case 'estado':
        return (
          <Badge color={getEstadoBadge(poliza.estado || 'ACTIVA')}>
            {estadosPoliza.find((e) => e.value === poliza.estado)?.label || poliza.estado}
          </Badge>
        );
      case 'prima_neta':
        return (
          <span className="font-medium">
            {polizaUtils.formatCurrency(
              (poliza.total || 0) > 0 ? poliza.total || 0 : poliza.prima_neta + (poliza.iva || 0),
            )}
          </span>
        );
      case 'vencimiento':
        return (
          <div>
            <div className="text-sm">{formatDate(poliza.fecha_fin)}</div>
            <div className={`text-xs ${getColorVencimiento(poliza)}`}>
              {getDiasVencimiento(poliza)}
            </div>
          </div>
        );
      case 'vendedor':
        return poliza.vendedor || '-';
      case 'sede':
        return poliza.sede || '-';
      case 'forma_pago':
        return poliza.forma_pago || '-';
      default:
        return '-';
    }
  };

  // Función para obtener el nombre de la columna
  const getColumnName = (columnKey: string) => {
    const columnMap: Record<string, string> = {
      numero_poliza: 'Número',
      cliente: 'Cliente',
      aseguradora: 'Aseguradora',
      ramo: 'Ramo',
      estado: 'Estado',
      prima_neta: 'Prima Total',
      vencimiento: 'Vencimiento',
      vendedor: 'Vendedor',
      sede: 'Sede',
      forma_pago: 'Forma de Pago',
    };
    return columnMap[columnKey] || columnKey;
  };

  // Contador de filtros activos
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.aseguradora || filters.aseguradora_id) count++;
    if (filters.ramo || filters.ramo_id) count++;
    if (filters.estado) count++;
    if (filters.vendedor) count++;
    if (filters.sede) count++;
    if (filters.fecha_inicio) count++;
    if (filters.fecha_fin) count++;
    if (filters.renovable !== undefined && (filters.renovable as any) !== '') count++;
    if (filters.fecha_recepcion_desde) count++;
    if (filters.fecha_recepcion_hasta) count++;
    return count;
  };

  // Debug: verificar estado de polizas en renderizado
  console.log('🎯 Renderizando con:', { polizas, loading, polizasLength: polizas?.length });

  // ===== Acciones Masivas - Helpers =====
  const isAllSelected = polizas.length > 0 && polizas.every((p) => selectedIds.has(String(p.id)));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      polizas.forEach((p) => {
        if (p.id) next.add(String(p.id));
      });
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDeletePolizas = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `¿Eliminar ${selectedIds.size} póliza(s) seleccionadas? Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      setLoading(true);
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(ids.map((id) => polizaService.deletePoliza(id)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast({
        title: 'Eliminación masiva',
        description: `Eliminadas: ${ok}. Fallidas: ${fail}.`,
      });
      clearSelection();
      await loadPolizas();
      await loadEstadisticas();
    } catch (_e) {
      // errores ya toasteados en servicio
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBulkStateModal = () => {
    if (selectedIds.size === 0) return;
    setBulkTargetState('ACTIVA');
    setShowBulkStateModal(true);
  };

  const handleConfirmBulkStateChange = async () => {
    if (!bulkTargetState) return;
    try {
      setLoading(true);
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => polizaService.cambiarEstado(id, bulkTargetState as any)),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast({
        title: 'Cambio de estado masivo',
        description: `Actualizadas: ${ok}. Fallidas: ${fail}.`,
      });
      setShowBulkStateModal(false);
      clearSelection();
      await loadPolizas();
      await loadEstadisticas();
    } catch (_e) {
      // errores ya toasteados en servicio
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingGuard>
      <PermissionGate
        route="/apps/seguros/polizas"
        action="ver"
        fallback={
          <div className="p-6 text-center text-gray-500">No tienes permisos para ver Pólizas.</div>
        }
      >
        <div className="space-y-6">
          {/* Estadísticas - Mejorado para tablets */}
          {estadisticas && estadisticas.total_polizas !== undefined && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              <Card className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">Total Pólizas</p>
                    <p className="text-lg md:text-2xl font-bold text-blue-600">
                      {estadisticas.total_polizas || 0}
                    </p>
                  </div>
                  <Icon
                    icon="solar:document-bold-duotone"
                    className="w-6 h-6 md:w-8 md:h-8 text-blue-500"
                  />
                </div>
              </Card>
              <Card className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">Activas</p>
                    <p className="text-lg md:text-2xl font-bold text-green-600">
                      {estadisticas.polizas_activas || 0}
                    </p>
                  </div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </Card>
              <Card className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">Por Vencer</p>
                    <p className="text-lg md:text-2xl font-bold text-orange-600">
                      {estadisticas.polizas_por_vencer}
                    </p>
                  </div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
                  </div>
                </div>
              </Card>
              <Card className="p-3 md:p-4 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">Prima Total</p>
                    <p className="text-sm md:text-lg font-bold text-purple-600">
                      {polizaUtils.formatCurrency(estadisticas.valor_total_primas)}
                    </p>
                  </div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-xs md:text-sm">$</span>
                  </div>
                </div>
              </Card>
              <Card className="p-3 md:p-4 col-span-2 sm:col-span-3 md:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">Vencidas</p>
                    <p className="text-lg md:text-2xl font-bold text-red-600">
                      {estadisticas.polizas_vencidas}
                    </p>
                  </div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Header de Controles Rediseñado */}
          <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
            {/* Barra superior con búsqueda y acciones principales */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Búsqueda principal */}
                <div className="flex-1">
                  <div className="relative">
                    <Icon
                      icon="solar:magnifer-bold-duotone"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    />
                    <Input
                      placeholder="Buscar por número de póliza, cliente o aseguradora..."
                      value={filters.search || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleFilterChange('search', e.target.value)
                      }
                      className="pl-10 h-10 text-sm rounded-[10px]"
                    />
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <Button
                    color="light"
                    onClick={() => loadPolizas()}
                    disabled={loading}
                    className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                    title="Actualizar"
                  >
                    <Icon
                      icon="solar:refresh-bold-duotone"
                      className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                    />
                  </Button>

                  <Button
                    color="light"
                    onClick={() => setShowFilterDrawer(true)}
                    className="relative h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                    title="Filtros"
                  >
                    <Icon icon="solar:filter-bold-duotone" className="w-4 h-4" />
                    {getActiveFiltersCount() > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                        {getActiveFiltersCount()}
                      </div>
                    )}
                  </Button>

                  <Button
                    color="light"
                    onClick={() => setShowExportModal(true)}
                    className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                    title="Exportar Pólizas"
                  >
                    <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                  </Button>

                  <Button
                    color="light"
                    onClick={() => setShowColumnsModal(true)}
                    className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                    title="Personalizar Vista"
                  >
                    <Icon icon="solar:settings-bold-duotone" className="w-4 h-4" />
                  </Button>

                  <Button
                    color="light"
                    onClick={() => {
                      console.log(
                        '🔔 Click en botón de notificaciones. Estado actual:',
                        notificationStatus,
                      );
                      setShowNotificationsModal(true);
                    }}
                    className={`relative h-10 w-10 p-0 rounded-[10px] flex items-center justify-center transition-all border-2 ${
                      notificationStatus?.is_active &&
                      notificationStatus?.whatsapp_status?.connected
                        ? 'border-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-500 shadow-green-200 shadow-md'
                        : notificationStatus?.is_active &&
                          !notificationStatus?.whatsapp_status?.connected
                        ? 'border-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-500 animate-pulse shadow-red-200 shadow-md'
                        : 'border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:bg-gray-800'
                    }`}
                    title={
                      notificationStatus?.is_active &&
                      notificationStatus?.whatsapp_status?.connected
                        ? '✅ Notificaciones Activas - WhatsApp Conectado'
                        : notificationStatus?.is_active &&
                          !notificationStatus?.whatsapp_status?.connected
                        ? '⚠️ Notificaciones Activas - WhatsApp Desconectado'
                        : 'Notificaciones Inactivas - Click para configurar'
                    }
                  >
                    {notificationStatus?.is_active &&
                      notificationStatus?.whatsapp_status?.connected && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                      )}
                    {notificationStatus?.is_active &&
                      !notificationStatus?.whatsapp_status?.connected && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                      )}
                    <Icon
                      icon="solar:bell-bold-duotone"
                      className={`w-5 h-5 transition-colors ${
                        notificationStatus?.is_active &&
                        notificationStatus?.whatsapp_status?.connected
                          ? 'text-green-600 dark:text-green-400'
                          : notificationStatus?.is_active &&
                            !notificationStatus?.whatsapp_status?.connected
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  </Button>

                  {canCreatePolicy && (
                    <Button
                      color="primary"
                      className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
                      onClick={() => setShowCreateTypeModal(true)}
                    >
                      <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Nueva Póliza</span>
                      <span className="sm:hidden">Nueva</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de pólizas - Mejorada con columnas dinámicas */}
          <Card>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Spinner size="lg" />
                <span className="ml-2">Cargando pólizas...</span>
              </div>
            ) : !polizas || polizas.length === 0 ? (
              <div className="text-center py-8">
                <Icon
                  icon="solar:document-bold-duotone"
                  className="w-16 h-16 text-gray-300 mx-auto mb-4"
                />
                <p className="text-gray-500 mb-4">No se encontraron pólizas</p>
                <div className="flex justify-center">
                  {canCreatePolicy && (
                    <Button color="primary" onClick={() => setShowCreateTypeModal(true)}>
                      <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                      Crear primera póliza
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                    <div className="text-sm text-blue-900">
                      {selectedIds.size} póliza(s) seleccionadas
                    </div>
                    <div className="flex gap-2">
                      <Button
                        color="failure"
                        size="sm"
                        onClick={handleBulkDeletePolizas}
                        className="rounded-[10px]"
                      >
                        <Icon
                          icon="solar:trash-bin-minimalistic-bold-duotone"
                          className="w-4 h-4 mr-1"
                        />
                        Eliminar seleccionadas
                      </Button>
                      <Button
                        color="blue"
                        size="sm"
                        onClick={handleOpenBulkStateModal}
                        className="rounded-[10px]"
                      >
                        <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 mr-1" />
                        Cambiar estado
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        onClick={clearSelection}
                        className="rounded-[10px]"
                      >
                        Limpiar
                      </Button>
                    </div>
                  </div>
                )}
                {/* Vista de tabla para pantallas grandes */}
                <div className="hidden lg:block overflow-x-auto table-container-with-dropdowns">
                  <Table hoverable>
                    <Table.Head>
                      <Table.HeadCell className="w-10">
                        <Checkbox checked={isAllSelected} onChange={() => toggleSelectAll()} />
                      </Table.HeadCell>
                      {visibleColumns.map((columnKey) => (
                        <Table.HeadCell key={columnKey}>{getColumnName(columnKey)}</Table.HeadCell>
                      ))}
                      <Table.HeadCell>Acciones</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="">
                      {polizas &&
                        polizas.length > 0 &&
                        polizas.map((poliza) => (
                          <Table.Row key={poliza.id} className="">
                            <Table.Cell>
                              <Checkbox
                                checked={selectedIds.has(String(poliza.id))}
                                onChange={() => toggleSelectOne(poliza.id as string)}
                              />
                            </Table.Cell>
                            {visibleColumns.map((columnKey) => (
                              <Table.Cell key={columnKey} className="whitespace-nowrap">
                                {renderTableCell(poliza, columnKey)}
                              </Table.Cell>
                            ))}
                            <Table.Cell>
                              <Dropdown
                                label=""
                                dismissOnClick={false}
                                placement="left-start"
                                className="z-50"
                                renderTrigger={() => (
                                  <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                    <IconDots size={22} />
                                  </span>
                                )}
                              >
                                <Dropdown.Item
                                  className="flex gap-3"
                                  onClick={() => handleViewPoliza(poliza)}
                                >
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Detalles</span>
                                </Dropdown.Item>
                                {canEditPolicy && (
                                  <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                                    <Dropdown.Item className="flex gap-3">
                                      <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                      <span>Editar</span>
                                    </Dropdown.Item>
                                  </Link>
                                )}
                                {canDeletePolicy && (
                                  <Dropdown.Item
                                    className="flex gap-3 text-red-600 hover:text-red-700"
                                    onClick={() => handleDeletePoliza(poliza)}
                                  >
                                    <Icon
                                      icon="solar:trash-bin-minimalistic-bold-duotone"
                                      height={18}
                                    />
                                    <span>Eliminar</span>
                                  </Dropdown.Item>
                                )}
                              </Dropdown>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                    </Table.Body>
                  </Table>
                </div>

                {/* Vista de cards para tablets y móviles */}
                <div className="lg:hidden space-y-4">
                  {polizas &&
                    polizas.length > 0 &&
                    polizas.map((poliza) => (
                      <Card key={poliza.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(poliza.ramo_principal)}
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {poliza.numero_poliza}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {(poliza as any).aseguradora_nombre || poliza.aseguradora}
                              </p>
                            </div>
                          </div>
                          <Badge color={getEstadoBadge(poliza.estado || 'ACTIVA')}>
                            {estadosPoliza.find((e) => e.value === poliza.estado)?.label ||
                              poliza.estado}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Cliente</p>
                            <p className="text-sm font-medium uppercase">
                              {poliza.nombres_cliente} {poliza.apellidos_cliente}
                            </p>
                            <p className="text-xs text-gray-500">{poliza.dni_cliente}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Ramo</p>
                            <div className="flex items-center gap-2">
                              {getTipoIcon(poliza.ramo_principal)}
                              <span className="text-sm uppercase">
                                {(poliza as any).ramo_nombre ||
                                  tiposSeguro.find((t) => t.value === poliza.ramo_principal)
                                    ?.label ||
                                  poliza.ramo_principal}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Prima Total</p>
                            <p className="text-sm font-medium">
                              {polizaUtils.formatCurrency(
                                (poliza.total || 0) > 0
                                  ? poliza.total || 0
                                  : poliza.prima_neta + (poliza.iva || 0),
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Vencimiento</p>
                            <p className="text-sm">{formatDate(poliza.fecha_fin)}</p>
                            <p className={`text-xs ${getColorVencimiento(poliza)}`}>
                              {getDiasVencimiento(poliza)}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                            <span>Creada: {formatDate(poliza.created_at || '')}</span>
                          </div>
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            renderTrigger={() => (
                              <span className="h-8 w-8 flex justify-center items-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <IconDots size={18} />
                              </span>
                            )}
                          >
                            <Dropdown.Item
                              className="flex gap-3"
                              onClick={() => handleViewPoliza(poliza)}
                            >
                              <Icon icon="solar:eye-bold" height={16} />
                              <span>Ver Detalles</span>
                            </Dropdown.Item>
                            {canEditPolicy && (
                              <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                                <Dropdown.Item className="flex gap-3">
                                  <Icon icon="solar:pen-new-square-broken" height={16} />
                                  <span>Editar</span>
                                </Dropdown.Item>
                              </Link>
                            )}
                            {canDeletePolicy && (
                              <Dropdown.Item
                                className="flex gap-3 text-red-600 hover:text-red-700"
                                onClick={() => handleDeletePoliza(poliza)}
                              >
                                <Icon icon="solar:trash-bin-minimalistic-outline" height={16} />
                                <span>Eliminar</span>
                              </Dropdown.Item>
                            )}
                          </Dropdown>
                        </div>
                      </Card>
                    ))}
                </div>

                {/* Paginación - tal cual Clientes */}
                {pagination && pagination.last_page > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-gray-600">
                      Mostrando {pagination.from} a {pagination.to} de {pagination.total} pólizas
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span>Por página:</span>
                        <select
                          className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                          value={filters.per_page}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFilters((prev) => ({ ...prev, per_page: val, page: 1 }));
                          }}
                        >
                          <option value={15}>15</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <Button
                        size="sm"
                        color="gray"
                        disabled={pagination.current_page === 1}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            page: Math.max(1, (prev.page || 1) - 1),
                          }))
                        }
                        className="rounded-[10px]"
                      >
                        <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        Página {pagination.current_page} de {pagination.last_page}
                      </span>
                      <Button
                        size="sm"
                        color="gray"
                        disabled={pagination.current_page === pagination.last_page}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            page: Math.min(pagination.last_page, (prev.page || 1) + 1),
                          }))
                        }
                        className="rounded-[10px]"
                      >
                        <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Modal de selección de tipo de póliza */}
          <Modal show={showCreateTypeModal} onClose={() => setShowCreateTypeModal(false)} size="md">
            <Modal.Header>Crear póliza</Modal.Header>
            <Modal.Body>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Selecciona el tipo de póliza que deseas crear:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    color="light"
                    onClick={() => {
                      setShowCreateTypeModal(false);
                      navigate('/apps/seguros/polizas/nueva');
                    }}
                    className="h-24 flex flex-col items-center justify-center gap-2 border"
                  >
                    <Icon icon="solar:user-bold-duotone" className="w-6 h-6" />
                    Individual
                  </Button>
                  <Button
                    color="light"
                    onClick={() => {
                      setShowCreateTypeModal(false);
                      navigate('/apps/seguros/polizas/nueva-colectiva');
                    }}
                    className="h-24 flex flex-col items-center justify-center gap-2 border"
                  >
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6" />
                    Colectiva
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </Modal>

          {/* Modal de detalle - Mejorado para tablets */}
          <Modal show={showModal} onClose={handleCloseDetailsModal} size="5xl">
            <Modal.Header>Detalle de Póliza {selectedPoliza?.numero_poliza}</Modal.Header>
            <Modal.Body>
              {selectedPoliza && (
                <Tabs>
                  <Tabs.Item active title="General">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">Información de la Póliza</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <strong>Número:</strong>
                            <span>{selectedPoliza.numero_poliza}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Aseguradora:</strong>
                            <span>
                              {(selectedPoliza as any).aseguradora_nombre ||
                                selectedPoliza.aseguradora}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Ramo:</strong>
                            <span>
                              {(selectedPoliza as any).ramo_nombre || selectedPoliza.ramo_principal}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <strong>Estado:</strong>
                            <Badge color={getEstadoBadge(selectedPoliza.estado || 'ACTIVA')}>
                              {selectedPoliza.estado}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <strong>Prima Total:</strong>
                            <span>
                              {polizaUtils.formatCurrency(
                                (selectedPoliza.total || 0) > 0
                                  ? selectedPoliza.total || 0
                                  : selectedPoliza.prima_neta + (selectedPoliza.iva || 0),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>IVA:</strong>
                            <span>{polizaUtils.formatCurrency(selectedPoliza.iva || 0)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <strong>Total:</strong>
                            <span>{polizaUtils.formatCurrency(selectedPoliza.total || 0)}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Información del Cliente</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <strong>Nombre:</strong>
                            <span>
                              {selectedPoliza.nombres_cliente} {selectedPoliza.apellidos_cliente}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Documento:</strong>
                            <span>{selectedPoliza.dni_cliente}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Teléfono:</strong>
                            <span>{selectedPoliza.celular_cliente}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Email:</strong>
                            <span className="text-right max-w-48 truncate">
                              {selectedPoliza.correo_cliente}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Dirección:</strong>
                            <span className="text-right max-w-48 truncate">
                              {selectedPoliza.domicilio}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Tabs.Item>
                  <Tabs.Item title="Fechas">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <h4 className="font-semibold mb-2">Fecha de Expedición</h4>
                        <p className="text-lg">{formatDate(selectedPoliza.fecha_expedicion)}</p>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold mb-2">Fecha de Inicio</h4>
                        <p className="text-lg">{formatDate(selectedPoliza.fecha_inicio)}</p>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold mb-2">Fecha de Vencimiento</h4>
                        <p className={`text-lg ${getColorVencimiento(selectedPoliza)}`}>
                          {formatDate(selectedPoliza.fecha_fin)}
                        </p>
                        <p className={`text-sm ${getColorVencimiento(selectedPoliza)}`}>
                          {getDiasVencimiento(selectedPoliza)}
                        </p>
                      </div>
                    </div>
                  </Tabs.Item>
                  <Tabs.Item title="Adicionales">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                      <div>
                        <h4 className="font-semibold mb-2">Parámetros</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <strong>Renovable:</strong>
                            <span>{selectedPoliza.renovable ? 'Sí' : 'No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Motivo:</strong>
                            <span className="text-right max-w-48 truncate">
                              {selectedPoliza.motivo || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Pri a Pre:</strong>
                            <span>{selectedPoliza.pri_a_pre ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Participación:</strong>
                            <span>{selectedPoliza.participacion ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Co‑corretaje:</strong>
                            <span>{selectedPoliza.co_corretaje ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Comisión Agencia:</strong>
                            <span>{selectedPoliza.comision_agencia ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>% Retención:</strong>
                            <span>{selectedPoliza.porcentaje_retencion ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>% Reteiva:</strong>
                            <span>{selectedPoliza.porcentaje_reteiva ?? '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Beneficiarios</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <strong>En remisión:</strong>
                            <span>{selectedPoliza.beneficiario_en_remision ? 'Sí' : 'No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Oneroso - Nombre:</strong>
                            <span className="text-right max-w-48 truncate">
                              {selectedPoliza.beneficiario_oneroso_nombre || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Oneroso - Documento:</strong>
                            <span>{selectedPoliza.beneficiario_oneroso_documento || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Otros</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <strong>Fecha Recepción:</strong>
                            <span>
                              {selectedPoliza.fecha_recepcion
                                ? formatDate(selectedPoliza.fecha_recepcion)
                                : '-'}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <strong>Banco:</strong>
                            <span>{(selectedPoliza as any).bank_name || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong># Cuotas:</strong>
                            <span>{(selectedPoliza as any).installments_count ?? '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <strong>Tarjeta:</strong>
                            <span>
                              {(selectedPoliza as any).card_last4
                                ? `**** **** **** ${(selectedPoliza as any).card_last4}`
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Tabs.Item>
                  {(String(
                    (selectedPoliza as any).ramo_principal ||
                      (selectedPoliza as any).ramo_nombre ||
                      '',
                  )
                    .toLowerCase()
                    .includes('auto') ||
                    (Array.isArray((selectedPoliza as any).placas) &&
                      (selectedPoliza as any).placas.length > 0)) && (
                    <Tabs.Item title="Automóviles">
                      {autosTabLoading ? (
                        <div className="flex items-center gap-2">
                          <Spinner size="sm" /> Cargando automóviles...
                        </div>
                      ) : autosVinculados.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          No hay automóviles vinculados a esta póliza.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table hoverable>
                            <Table.Head>
                              <Table.HeadCell>Placa</Table.HeadCell>
                              <Table.HeadCell>Marca</Table.HeadCell>
                              <Table.HeadCell>Modelo</Table.HeadCell>
                              <Table.HeadCell>Valor Asegurado</Table.HeadCell>
                              <Table.HeadCell>Acciones</Table.HeadCell>
                            </Table.Head>
                            <Table.Body>
                              {autosVinculados.map((a: any) => (
                                <Table.Row key={a.id}>
                                  <Table.Cell className="font-medium">{a.placa}</Table.Cell>
                                  <Table.Cell>{a.marca || '-'}</Table.Cell>
                                  <Table.Cell>{a.modelo || '-'}</Table.Cell>
                                  <Table.Cell>
                                    {polizaUtils.formatCurrency((a as any).insured_value || 0)}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Link
                                      to={`/apps/seguros/automoviles?search=${encodeURIComponent(
                                        a.placa || '',
                                      )}`}
                                    >
                                      <Button size="xs" color="light">
                                        Editar en Automóviles
                                      </Button>
                                    </Link>
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table>
                        </div>
                      )}
                    </Tabs.Item>
                  )}
                  <Tabs.Item title="Historial">
                    <HistorialPoliza polizaId={selectedPoliza.id!} polizaDetalle={selectedPoliza} />
                  </Tabs.Item>
                  <Tabs.Item title="Renovaciones">
                    <RenovacionesPoliza polizaId={String(selectedPoliza.id!)} />
                  </Tabs.Item>
                </Tabs>
              )}
            </Modal.Body>
          </Modal>

          {/* Modal de confirmación de eliminación */}
          <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md">
            <Modal.Header>Confirmar Eliminación</Modal.Header>
            <Modal.Body>
              <div className="text-center">
                <Icon
                  icon="solar:trash-bin-minimalistic-bold-duotone"
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                />
                <h3 className="mb-5 text-lg font-normal text-gray-500">
                  ¿Estás seguro de que deseas eliminar la póliza{' '}
                  <strong>{polizaToDelete?.numero_poliza}</strong>?
                </h3>
                <p className="text-sm text-gray-400 mb-4">Esta acción no se puede deshacer.</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button color="failure" onClick={confirmDelete}>
                Sí, eliminar
              </Button>
              <Button color="gray" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Modal cambio de estado masivo */}
          <Modal show={showBulkStateModal} onClose={() => setShowBulkStateModal(false)} size="md">
            <Modal.Header>Cambiar estado a {selectedIds.size} póliza(s)</Modal.Header>
            <Modal.Body>
              <div className="space-y-3">
                <label className="text-sm">Nuevo estado</label>
                <select
                  className="w-full border rounded-md p-2 dark:bg-darkgray"
                  value={bulkTargetState}
                  onChange={(e) => setBulkTargetState(e.target.value)}
                >
                  {estadosPoliza.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Se aplicará a todas las pólizas seleccionadas.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button color="blue" onClick={handleConfirmBulkStateChange}>
                Aplicar
              </Button>
              <Button color="gray" onClick={() => setShowBulkStateModal(false)}>
                Cancelar
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Modal de filtros */}
          <PolizasFilterModal
            isOpen={showFilterDrawer}
            onClose={() => setShowFilterDrawer(false)}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Modal de personalización de columnas */}
          <ColumnsCustomizationModal
            isOpen={showColumnsModal}
            onClose={() => setShowColumnsModal(false)}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={handleVisibleColumnsChange}
          />

          {/* Modal de exportación */}
          <PolizasExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            currentFilters={filters}
          />

          {/* Modal de notificaciones */}
          <PolicyNotificationsModal
            isOpen={showNotificationsModal}
            onClose={() => {
              setShowNotificationsModal(false);
              loadNotificationStatus(); // Recargar estado después de cerrar
            }}
          />
        </div>
      </PermissionGate>
    </OnboardingGuard>
  );
};

export default Polizas;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PermissionGate from 'src/components/PermissionGate';
import {
  Button,
  Badge,
  Table,
  Modal,
  Tabs,
  Spinner,
} from 'flowbite-react';
import HistorialPoliza from './components/HistorialPoliza';
import RenovacionesPoliza from './components/RenovacionesPoliza';

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';

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
import PolicyNotificationsModal from './components/PolicyNotificationsModalV2';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import OnboardingGuard from '../../../../components/auth/OnboardingGuard';
import policyNotificationService from 'src/services/policyNotificationService';
import { useWhatsAppSocket } from 'src/hooks/useWhatsAppSocket';
import { useAutoTour } from 'src/components/GuroTour/useAutoTour';
import { TOUR_POLIZAS } from 'src/components/GuroTour/tourConfigs';
import suraLogo from 'src/assets/images/logoscompanias/sura.png';
import bolivarLogo from 'src/assets/images/logoscompanias/bolivar.png';
import hdiLogo from 'src/assets/images/logoscompanias/hdi.png';
import estadoLogo from 'src/assets/images/logoscompanias/estado.png';
import equidadLogo from 'src/assets/images/logoscompanias/equidad.png';
import axaLogo from 'src/assets/images/logoscompanias/axa.png';
import mapfreLogo from 'src/assets/images/logoscompanias/mapfre.png';
import allianzLogo from 'src/assets/images/logoscompanias/allianz.png';

const INSURER_LOGOS: Record<string, string> = {
  sura: suraLogo,
  bolivar: bolivarLogo,
  bolívar: bolivarLogo,
  hdi: hdiLogo,
  estado: estadoLogo,
  'seguros del estado': estadoLogo,
  'la-equidad': equidadLogo,
  'la equidad': equidadLogo,
  equidad: equidadLogo,
  axa: axaLogo,
  'axa-colpatria': axaLogo,
  mapfre: mapfreLogo,
  allianz: allianzLogo,
};

const getInsurerLogo = (nombre: string): string | null => {
  if (!nombre) return null;
  const key = nombre.toLowerCase().trim();
  if (INSURER_LOGOS[key]) return INSURER_LOGOS[key];
  for (const [k, v] of Object.entries(INSURER_LOGOS)) {
    if (key.includes(k)) return v;
  }
  return null;
};

type DetailSourceStats = { total: number; synced: number; failed: number; cancelled: number; pending: number; sample_error?: string | null };
type DetailSyncData = { total: number; synced: number; failed: number; cancelled: number; pending: number; bySource?: Record<string, DetailSourceStats> };

const Polizas: React.FC = () => {
  useAutoTour(TOUR_POLIZAS);
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
  
  // Ref para acceder al estado actual sin causar re-renders en callbacks
  const notificationStatusRef = useRef(notificationStatus);
  useEffect(() => {
    notificationStatusRef.current = notificationStatus;
  }, [notificationStatus]);

  // WebSocket para actualizar estado de WhatsApp en tiempo real
  const { isConnected: socketConnected, subscribeToInstance, unsubscribeFromInstance } = useWhatsAppSocket({
    autoConnect: true,
    events: {
      onConnected: (data) => {
        console.log('🟢 [Polizas] WhatsApp conectado via WebSocket:', data.instanceId);
        setNotificationStatus((prev: any) => prev ? {
          ...prev,
          whatsapp_status: { ...prev.whatsapp_status, connected: true, status: 'connected' }
        } : prev);
      },
      onDisconnected: (data) => {
        console.log('🔴 [Polizas] WhatsApp desconectado via WebSocket:', data.instanceId);
        setNotificationStatus((prev: any) => prev ? {
          ...prev,
          whatsapp_status: { ...prev.whatsapp_status, connected: false, status: 'disconnected' }
        } : prev);
      },
      onInstanceUpdate: (data) => {
        console.log('📡 [Polizas] Actualización de instancia:', data);
        if (data.event === 'connected') {
          setNotificationStatus((prev: any) => prev ? {
            ...prev,
            whatsapp_status: { ...prev.whatsapp_status, connected: true, status: 'connected' }
          } : prev);
        } else if (data.event === 'disconnected') {
          setNotificationStatus((prev: any) => prev ? {
            ...prev,
            whatsapp_status: { ...prev.whatsapp_status, connected: false, status: 'disconnected' }
          } : prev);
        }
      },
    }
  });

  // Suscribirse a la instancia de WhatsApp configurada
  const subscribedInstanceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!socketConnected || !notificationStatus?.whatsapp_status?.instance_id) return;
    
    const instanceId = notificationStatus.whatsapp_status.instance_id;
    
    if (instanceId && instanceId !== subscribedInstanceRef.current) {
      if (subscribedInstanceRef.current) {
        unsubscribeFromInstance(subscribedInstanceRef.current);
      }
      subscribeToInstance(instanceId);
      subscribedInstanceRef.current = instanceId;
      console.log('🔔 [Polizas] Suscrito a instancia WhatsApp:', instanceId);
    }
  }, [socketConnected, notificationStatus?.whatsapp_status?.instance_id, subscribeToInstance, unsubscribeFromInstance]);
  const [autosTabLoading, setAutosTabLoading] = useState(false);
  const [autosVinculados, setAutosVinculados] = useState<any[]>([]);

  // Progreso de sincronización de detalles en segundo plano
  const [detailSyncProgress, setDetailSyncProgress] = useState<DetailSyncData | null>(null);
  const [detailSyncBusy, setDetailSyncBusy] = useState(false);
  const [showSyncPopover, setShowSyncPopover] = useState(false);
  const [showResyncDialog, setShowResyncDialog] = useState(false);
  const detailSyncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollDetailSyncProgress = useCallback(async () => {
    try {
      const res = await polizaService.getDetailSyncProgress();
      if (res.success && res.data) {
        setDetailSyncProgress(res.data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    pollDetailSyncProgress();
    // Polling más conservador (15s en vez de 4s). Cada call golpea MySQL y
    // antes generaba ~130 req/min en pico. 15s es más que suficiente para
    // mostrar progreso de un sync que tarda minutos.
    detailSyncPollRef.current = setInterval(pollDetailSyncProgress, 15000);
    return () => { if (detailSyncPollRef.current) clearInterval(detailSyncPollRef.current); };
  }, [pollDetailSyncProgress]);

  // Listen for detail sync triggered by Inicio.tsx (same tab or other tabs)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'guro_detail_sync_triggered') pollDetailSyncProgress();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [pollDetailSyncProgress]);

  const handleSyncAllDetails = async (reset = false) => {
    setDetailSyncBusy(true);
    try {
      await polizaService.syncAllPolizasDetail(reset ? { reset: true } : undefined);
      await pollDetailSyncProgress();
    } catch { /* ignore */ } finally {
      setDetailSyncBusy(false);
    }
  };

  const handleCancelDetailSync = async () => {
    setDetailSyncBusy(true);
    try {
      await polizaService.cancelDetailSync();
      await pollDetailSyncProgress();
    } catch { /* ignore */ } finally {
      setDetailSyncBusy(false);
    }
  };

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStateModal, setShowBulkStateModal] = useState(false);
  const [bulkTargetState, setBulkTargetState] = useState<string>('ACTIVA');
  const [bulkCancellationReason, setBulkCancellationReason] = useState<string>('');
  const [bulkMotivoCambio, setBulkMotivoCambio] = useState<string>('');
  const [cancellationReasons, setCancellationReasons] = useState<Array<{ key: string; label: string }>>([]);
  const [showBulkDeleteAllModal, setShowBulkDeleteAllModal] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');

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

  // Columnas visibles (máximo 6) - Cargar desde localStorage si existe
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('polizas_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 6) {
          return parsed;
        }
      } catch (e) {
        // Si hay error de parsing, usar valores por defecto
      }
    }
    return [
      'numero_poliza',
      'cliente',
      'aseguradora',
      'ramo',
      'estado',
      'prima_neta',
    ];
  });

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
    sort_field: undefined,
    sort_direction: undefined,
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
    { value: 'RENOVADA', label: 'Renovada', color: 'purple' },
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
    // Guardar en localStorage para persistencia
    localStorage.setItem('polizas_visible_columns', JSON.stringify(columns));
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
          <div className="flex items-center gap-1.5">
            {getTipoIcon(poliza.ramo_principal)}
            {poliza.numero_poliza}
            {(poliza as any).numero_renovacion > 0 && (
              <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full leading-none">
                R{(poliza as any).numero_renovacion}
              </span>
            )}
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
      case 'aseguradora': {
        const asegName = (poliza as any).aseguradora_nombre || poliza.aseguradora || '';
        const logo = getInsurerLogo(asegName);
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-700 shrink-0">
              {logo ? (
                <img src={logo} alt="" className="w-5 h-5 object-contain" />
              ) : (
                <span className="text-[9px] font-bold text-[#111]">{asegName.charAt(0)}</span>
              )}
            </div>
            <span>{asegName}</span>
          </div>
        );
      }
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
      case 'renovaciones': {
        const numRen = (poliza as any).numero_renovacion || 0;
        if (numRen > 0) {
          return (
            <Badge color="lightinfo" className="text-xs">
              <Icon icon="solar:refresh-bold-duotone" className="w-3 h-3 inline mr-1 -mt-0.5" />
              {numRen}
            </Badge>
          );
        }
        return <span className="text-gray-400">—</span>;
      }
      case 'origen': {
        const src = poliza.sync_source || '';
        if (src && src.includes('_sync')) {
          const insurerKey = src.replace('_sync', '').replace('-', ' ');
          const nameMap: Record<string, string> = { sura: 'Sura', bolivar: 'Bolívar', hdi: 'HDI', 'axa colpatria': 'AXA', 'seguros del estado': 'Estado' };
          const label = nameMap[insurerKey] || insurerKey.charAt(0).toUpperCase() + insurerKey.slice(1);
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#573CFF]/10 text-[#573CFF] dark:bg-[#573CFF]/20 dark:text-[#a78bfa]">
              <Icon icon="solar:refresh-bold-duotone" className="w-3 h-3" />
              {label}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
            <Icon icon="solar:pen-bold-duotone" className="w-3 h-3" />
            Manual
          </span>
        );
      }
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
      renovaciones: 'Renov.',
      origen: 'Origen',
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

  const handleBulkDeleteAll = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR TODAS') return;
    try {
      setLoading(true);
      const response = await saasApi.bulkDeletePolizas({ delete_all: true });
      if (response.success) {
        const data = response.data as any;
        toast({
          title: 'Borrado masivo completado',
          description: response.message || `Se eliminaron ${data?.deleted_count || 0} pólizas.`,
        });
        setShowBulkDeleteAllModal(false);
        setBulkDeleteConfirmText('');
        clearSelection();
        await loadPolizas();
        await loadEstadisticas();
      } else {
        throw new Error(response.message || 'Error al eliminar pólizas');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar pólizas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBulkStateModal = async () => {
    if (selectedIds.size === 0) return;
    setBulkTargetState('ACTIVA');
    setBulkCancellationReason('');
    setBulkMotivoCambio('');
    setShowBulkStateModal(true);
    // Cargar motivos de cancelación si no están cargados
    if (cancellationReasons.length === 0) {
      try {
        const list = await polizaService.getCancellationReasons();
        setCancellationReasons(list || []);
      } catch {}
    }
  };

  const handleConfirmBulkStateChange = async () => {
    if (!bulkTargetState) return;
    // Validar motivo de cancelación cuando aplica
    if (bulkTargetState === 'CANCELADA' && !bulkCancellationReason) {
      toast({
        variant: 'destructive',
        title: 'Motivo requerido',
        description: 'Selecciona el motivo de cancelación.',
      });
      return;
    }
    try {
      setLoading(true);
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => polizaService.cambiarEstado(
          id,
          bulkTargetState as any,
          bulkMotivoCambio || undefined,
          bulkTargetState === 'CANCELADA' ? bulkCancellationReason : undefined,
        )),
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
          {/* Estadísticas */}
          {estadisticas && estadisticas.total_polizas !== undefined && (
            <div data-tour="polizas-stats" className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#573CFF20' }}>
                    <Icon icon="solar:document-bold-duotone" width={18} style={{ color: '#573CFF' }} />
                  </div>
                  <span data-tour="polizas-page-title" className="text-xs text-neutral-500 font-medium">Total Pólizas</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{estadisticas.total_polizas || 0}</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                    <Icon icon="solar:check-circle-bold-duotone" width={18} style={{ color: '#22c55e' }} />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Activas</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{estadisticas.polizas_activas || 0}</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f9731620' }}>
                    <Icon icon="solar:clock-circle-bold-duotone" width={18} style={{ color: '#f97316' }} />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Por Vencer</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{estadisticas.polizas_por_vencer}</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#573CFF20' }}>
                    <Icon icon="solar:wallet-bold-duotone" width={18} style={{ color: '#573CFF' }} />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Prima Total</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{polizaUtils.formatCurrency(estadisticas.valor_total_primas)}</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ef444420' }}>
                    <Icon icon="solar:danger-triangle-bold-duotone" width={18} style={{ color: '#ef4444' }} />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Vencidas</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{estadisticas.polizas_vencidas}</p>
              </div>
            </div>
          )}

          {/* Tabla de pólizas */}
          <div data-tour="polizas-table" className="rounded-2xl border border-neutral-800 bg-neutral-950/70 overflow-hidden">
            {/* Tabs Activas / Papelera */}
            <div className="flex items-center gap-1 px-4 pt-3 border-b border-neutral-800/60">
              {([
                { v: 'none' as const, label: 'Activas', icon: 'solar:document-bold-duotone', color: '#573CFF' },
                { v: 'only' as const, label: 'Papelera', icon: 'solar:trash-bin-trash-bold-duotone', color: '#ef4444' },
              ]).map(t => {
                const isActive = (filters.trashed || 'none') === t.v;
                const count = isActive ? (pagination?.total ?? null) : null;
                return (
                  <button
                    key={t.v}
                    onClick={() => { handleFilterChange('trashed', t.v); }}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? ''
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                    style={isActive ? { borderColor: t.color, color: t.color } : {}}
                  >
                    <Icon icon={t.icon} width={16} />
                    {t.label}
                    {count !== null && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full" style={{ backgroundColor: t.color + '33', color: t.color }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Search bar + actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800/60">
              <div className="relative flex-1 max-w-sm">
                <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width={16} />
                <input
                  type="text"
                  placeholder="Buscar por póliza, cliente o aseguradora..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:border-[#573CFF] focus:outline-none transition-colors"
                />
              </div>
              <button onClick={() => setShowFilterDrawer(true)} className="relative rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Filtros">
                <Icon icon="solar:filter-bold-duotone" width={18} />
                {getActiveFiltersCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{getActiveFiltersCount()}</span>
                )}
              </button>
              <button onClick={() => setShowExportModal(true)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Exportar">
                <Icon icon="solar:download-bold-duotone" width={18} />
              </button>
              <button onClick={() => setShowColumnsModal(true)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Columnas">
                <Icon icon="solar:settings-bold-duotone" width={18} />
              </button>
              <button
                onClick={() => {
                  console.log('🔔 Click en botón de notificaciones. Estado actual:', notificationStatus);
                  setShowNotificationsModal(true);
                }}
                className={`relative rounded-lg border px-2.5 py-2 transition-colors ${
                  notificationStatus?.is_active && notificationStatus?.whatsapp_status?.connected
                    ? 'border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : notificationStatus?.is_active && !notificationStatus?.whatsapp_status?.connected
                    ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 animate-pulse'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
                title={
                  notificationStatus?.is_active && notificationStatus?.whatsapp_status?.connected
                    ? '✅ Notificaciones Activas - WhatsApp Conectado'
                    : notificationStatus?.is_active && !notificationStatus?.whatsapp_status?.connected
                    ? '⚠️ Notificaciones Activas - WhatsApp Desconectado'
                    : 'Notificaciones Inactivas'
                }
              >
                {notificationStatus?.is_active && (
                  <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${notificationStatus?.whatsapp_status?.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                )}
                <Icon icon="solar:bell-bold-duotone" width={18} />
              </button>
              {/* Pill de sincronización de detalles */}
              {detailSyncProgress && detailSyncProgress.total > 0 && (() => {
                const { total, synced, failed, cancelled, pending, bySource } = detailSyncProgress;
                const done = synced + failed + cancelled;
                const pct = Math.round((done / total) * 100);
                const isRunning = pending > 0;
                const hasErrors = failed > 0 && !isRunning;

                const SOURCE_LABELS: Record<string, string> = { hdi_sync: 'HDI', sura_sync: 'SURA', bolivar_sync: 'Bolívar' };

                const inferErrorMsg = (sampleError: string | null | undefined, src: string): { cause: string; action: string } => {
                  if (!sampleError) return { cause: 'Error desconocido al sincronizar.', action: 'Intenta resincronizar.' };
                  const e = sampleError.toLowerCase();
                  if (e.includes('cod_ramo') || (e.includes('ramo') && src === 'bolivar_sync'))
                    return { cause: 'Falta el código de ramo en el registro.', action: 'Ejecuta una nueva sincronización principal.' };
                  if (e.includes('ramo') && src === 'sura_sync')
                    return { cause: 'Falta el código de ramo en el registro.', action: 'Ejecuta una nueva sincronización principal desde Inicio.' };
                  if (e.includes('timeout') || e.includes('timed out'))
                    return { cause: 'La aseguradora tardó demasiado en responder.', action: 'Reintenta en horario de menor carga.' };
                  if (e.includes('session') || e.includes('401') || e.includes('unauthorized'))
                    return { cause: 'Sesión con la aseguradora expirada.', action: 'Reconecta la aseguradora y resincroniza.' };
                  if (e.includes('404'))
                    return { cause: 'Póliza no encontrada en el portal de la aseguradora.', action: 'Verifica que esté activa en el portal.' };
                  if (e.includes('422'))
                    return { cause: 'Parámetros insuficientes para consultar la aseguradora.', action: 'Ejecuta una nueva sincronización principal.' };
                  if (e.includes('500') || e.includes('server'))
                    return { cause: 'Error interno en el servidor de la aseguradora.', action: 'Reintenta más tarde.' };
                  return { cause: 'Error inesperado al consultar la aseguradora.', action: 'Revisa los logs o reintenta.' };
                };

                return (
                  <>
                    <div className="relative" onMouseEnter={() => setShowSyncPopover(true)} onMouseLeave={() => setShowSyncPopover(false)}>
                      {/* Pill */}
                      <div className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 cursor-default">
                        {isRunning
                          ? <Icon icon="svg-spinners:ring-resize" width={13} className="text-neutral-500 shrink-0" />
                          : hasErrors
                          ? <Icon icon="solar:info-circle-linear" width={13} className="text-neutral-500 shrink-0" />
                          : <Icon icon="solar:check-circle-linear" width={13} className="text-neutral-500 shrink-0" />
                        }
                        <span className="text-[11px] whitespace-nowrap text-neutral-400">
                          {isRunning ? `Detalles ${done}/${total}` : hasErrors ? `${synced}✓ ${failed}✗ / ${total}` : `Detalles ${synced}/${total}`}
                        </span>
                        <div className="w-14 h-0.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div className="h-full rounded-full bg-neutral-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        {isRunning && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleCancelDetailSync(); }}
                            disabled={detailSyncBusy}
                            className="text-neutral-600 hover:text-neutral-400 transition-colors p-0.5 disabled:opacity-40"
                            title="Detener pendientes"
                          >
                            <Icon icon="solar:stop-circle-linear" width={13} />
                          </button>
                        )}
                      </div>

                      {/* Popover */}
                      {showSyncPopover && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl p-3.5 text-sm">
                          <div className="absolute -top-1.5 right-5 w-3 h-3 rotate-45 border-l border-t border-neutral-800 bg-neutral-950" />

                          {/* Header */}
                          <p className="text-[12px] font-medium text-neutral-300 mb-0.5">
                            {isRunning ? 'Sincronizando detalles' : hasErrors ? 'Sincronización finalizada con errores' : 'Sincronización completa'}
                          </p>
                          <p className="text-[11px] text-neutral-500 mb-3">
                            {done} de {total} procesadas · {pct}%
                            {synced > 0 && ` · ${synced} ok`}
                            {failed > 0 && ` · ${failed} fallidas`}
                            {pending > 0 && ` · ${pending} pendientes`}
                            {cancelled > 0 && ` · ${cancelled} canceladas`}
                          </p>

                          {/* Progress bar */}
                          <div className="w-full h-0.5 rounded-full bg-neutral-800 overflow-hidden mb-3">
                            <div className="h-full rounded-full bg-neutral-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>

                          {/* Per-insurer breakdown */}
                          {bySource && Object.keys(bySource).length > 0 && (
                            <div className="space-y-2.5 border-t border-neutral-800 pt-3 mb-3">
                              {Object.entries(bySource).map(([src, s]) => {
                                const label = SOURCE_LABELS[src] ?? src;
                                const srcPct = s.total > 0 ? Math.round(((s.synced + s.failed + s.cancelled) / s.total) * 100) : 0;
                                const errInfo = s.failed > 0 ? inferErrorMsg(s.sample_error, src) : null;
                                return (
                                  <div key={src}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] text-neutral-400">{label}</span>
                                      <span className="text-[10px] text-neutral-600">
                                        {s.synced > 0 && `${s.synced} ok`}
                                        {s.synced > 0 && s.failed > 0 && ' · '}
                                        {s.failed > 0 && `${s.failed} fallidas`}
                                        {(s.synced > 0 || s.failed > 0) && s.pending > 0 && ' · '}
                                        {s.pending > 0 && `${s.pending} pend.`}
                                        {s.synced === 0 && s.failed === 0 && s.pending === 0 && `${s.cancelled} canceladas`}
                                      </span>
                                    </div>
                                    <div className="w-full h-0.5 rounded-full bg-neutral-800 overflow-hidden mb-1.5">
                                      <div className="h-full rounded-full bg-neutral-600 transition-all" style={{ width: `${srcPct}%` }} />
                                    </div>
                                    {errInfo && (
                                      <div className="border-l-2 border-neutral-700 pl-2 space-y-0.5">
                                        <p className="text-[10px] text-neutral-500 leading-relaxed">{errInfo.cause}</p>
                                        <p className="text-[10px] text-neutral-600 leading-relaxed">→ {errInfo.action}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 border-t border-neutral-800 pt-3">
                            {isRunning && (
                              <button
                                onClick={() => { setShowSyncPopover(false); void handleCancelDetailSync(); }}
                                disabled={detailSyncBusy}
                                className="flex-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-400 transition-colors disabled:opacity-40"
                              >
                                Detener
                              </button>
                            )}
                            <button
                              onClick={() => { setShowSyncPopover(false); setShowResyncDialog(true); }}
                              disabled={detailSyncBusy}
                              className="flex-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-400 transition-colors disabled:opacity-40"
                            >
                              Resincronizar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resync confirmation dialog */}
                    {showResyncDialog && (
                      <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowResyncDialog(false)}>
                        <div className="absolute inset-0 bg-black/50" />
                        <div
                          className="relative w-80 rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-[13px] font-medium text-neutral-200 mb-1">¿Qué deseas resincronizar?</p>
                          <p className="text-[11px] text-neutral-500 mb-4">Solo las fallidas es más rápido. Si necesitas actualizar una póliza en particular, hazlo desde el editor de la póliza.</p>
                          <div className="space-y-2">
                            {failed > 0 && (
                              <button
                                onClick={() => { setShowResyncDialog(false); void handleSyncAllDetails(false); }}
                                disabled={detailSyncBusy}
                                className="w-full rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-left text-[12px] text-neutral-300 transition-colors disabled:opacity-40"
                              >
                                Solo las fallidas
                                <span className="block text-[10px] text-neutral-600 mt-0.5">{failed} póliza{failed !== 1 ? 's' : ''} con error</span>
                              </button>
                            )}
                            <button
                              onClick={() => { setShowResyncDialog(false); void handleSyncAllDetails(true); }}
                              disabled={detailSyncBusy}
                              className="w-full rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-left text-[12px] text-neutral-300 transition-colors disabled:opacity-40"
                            >
                              Todas ({total} pólizas)
                              <span className="block text-[10px] text-neutral-600 mt-0.5">Proceso largo — puede tardar varios minutos</span>
                            </button>
                            <button
                              onClick={() => setShowResyncDialog(false)}
                              className="w-full rounded px-3 py-1.5 text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {canCreatePolicy && (
                <span data-tour="polizas-create-btn">
                  <button
                    onClick={() => setShowCreateTypeModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-sm font-medium text-white transition-colors"
                  >
                    <Icon icon="solar:add-circle-bold-duotone" width={18} />
                    Nueva Póliza
                  </button>
                </span>
              )}
            </div>
            {/* Table content */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Icon icon="svg-spinners:ring-resize" width={32} className="text-[#573CFF]" />
                </div>
              ) : !polizas || polizas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                  <Icon icon="solar:document-bold-duotone" width={48} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium">No se encontraron pólizas</p>
                  {canCreatePolicy && (
                    <button
                      onClick={() => setShowCreateTypeModal(true)}
                      className="mt-3 flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                      <Icon icon="solar:add-circle-bold-duotone" width={16} />
                      Crear primera póliza
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <div className="mx-4 mt-3 p-3 rounded-lg border border-[#573CFF]/40 dark:border-[#573CFF]/30 bg-[#573CFF]/8 dark:bg-[#573CFF]/10 flex items-center justify-between">
                      <span className="text-sm text-gray-800 dark:text-neutral-300">{selectedIds.size} póliza(s) seleccionadas</span>
                      <div className="flex gap-2">
                        <button onClick={handleBulkDeletePolizas} className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-400 transition-colors">
                          <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={14} />
                          Eliminar
                        </button>
                        {estadisticas && estadisticas.total_polizas > 0 && (
                          <button onClick={() => setShowBulkDeleteAllModal(true)} className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 text-xs text-red-300 transition-colors">
                            <Icon icon="solar:trash-bin-trash-bold-duotone" width={14} />
                            Eliminar TODAS ({estadisticas.total_polizas})
                          </button>
                        )}
                        <button onClick={handleOpenBulkStateModal} className="flex items-center gap-1.5 rounded-lg border border-[#573CFF]/40 bg-[#573CFF]/10 hover:bg-[#573CFF]/20 px-3 py-1.5 text-xs text-[#573CFF] dark:text-[#a78bfa] transition-colors">
                          <Icon icon="solar:settings-bold-duotone" width={14} />
                          Cambiar estado
                        </button>
                        <button onClick={clearSelection} className="rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors">
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Desktop table */}
                  <div className="hidden lg:block">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                          {visibleColumns.map((columnKey) => (
                            <th key={columnKey} className="px-4 py-3 font-medium whitespace-nowrap">{getColumnName(columnKey)}</th>
                          ))}
                          <th className="px-4 py-3 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {polizas.map((poliza) => (
                          <tr
                            key={poliza.id}
                            className={`hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer ${selectedIds.has(String(poliza.id)) ? 'bg-[#573CFF]/10 dark:bg-[#573CFF]/5' : ''}`}
                            onClick={() => toggleSelectOne(poliza.id as string)}
                          >
                            {visibleColumns.map((columnKey) => (
                              <td key={columnKey} className="px-4 py-3 text-sm text-neutral-300 whitespace-nowrap">
                                {renderTableCell(poliza, columnKey)}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <TableActionMenu>
                                <TableMenuItem onClick={() => handleViewPoliza(poliza)}>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Detalles</span>
                                </TableMenuItem>
                                {poliza.enlace_externo && (
                                  <TableMenuItem className="text-blue-600" onClick={() => window.open(poliza.enlace_externo, '_blank')}>
                                    <Icon icon="solar:link-round-bold-duotone" height={18} />
                                    <span>Enlace Externo</span>
                                  </TableMenuItem>
                                )}
                                {canEditPolicy && (
                                  <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                                    <TableMenuItem>
                                      <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                      <span>Editar</span>
                                    </TableMenuItem>
                                  </Link>
                                )}
                                {canDeletePolicy && (filters.trashed === 'only' ? (
                                  <>
                                    <TableMenuItem className="text-green-600 hover:text-green-700" onClick={async () => {
                                      const res = await saasApi.restaurarPapelera('polizas', [Number(poliza.id)]);
                                      if (res.success) { await loadPolizas(); await loadEstadisticas(); } else alert(res.message || 'Error');
                                    }}>
                                      <Icon icon="solar:refresh-circle-bold-duotone" height={18} />
                                      <span>Restaurar</span>
                                    </TableMenuItem>
                                    <TableMenuItem className="text-red-600 hover:text-red-700" onClick={async () => {
                                      if (!confirm(`¿Eliminar PERMANENTEMENTE la póliza ${poliza.policy_number}? Esta acción NO se puede deshacer.`)) return;
                                      const res = await saasApi.eliminarDefinitivoPapelera('polizas', [Number(poliza.id)]);
                                      if (res.success) { await loadPolizas(); await loadEstadisticas(); } else alert(res.message || 'Error');
                                    }}>
                                      <Icon icon="solar:trash-bin-2-bold-duotone" height={18} />
                                      <span>Eliminar definitivo</span>
                                    </TableMenuItem>
                                  </>
                                ) : (
                                  <TableMenuItem className="text-red-600 hover:text-red-700" onClick={() => handleDeletePoliza(poliza)}>
                                    <Icon icon="solar:trash-bin-minimalistic-bold-duotone" height={18} />
                                    <span>Eliminar</span>
                                  </TableMenuItem>
                                ))}
                              </TableActionMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden p-4 space-y-3">
                    {polizas.map((poliza) => (
                      <div key={poliza.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4" onClick={() => handleViewPoliza(poliza)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(poliza.ramo_principal)}
                            <div>
                              <h3 className="font-medium text-white text-sm">{poliza.numero_poliza}</h3>
                              <p className="text-xs text-neutral-500">{(poliza as any).aseguradora_nombre || poliza.aseguradora}</p>
                            </div>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            poliza.estado === 'ACTIVA' ? 'bg-emerald-500/15 text-emerald-400' :
                            poliza.estado === 'VENCIDA' ? 'bg-red-500/15 text-red-400' :
                            'bg-neutral-500/15 text-neutral-400'
                          }`}>
                            {estadosPoliza.find((e) => e.value === poliza.estado)?.label || poliza.estado}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Cliente</p>
                            <p className="text-neutral-300 truncate">{poliza.nombres_cliente} {poliza.apellidos_cliente}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Prima</p>
                            <p className="text-white font-medium">{polizaUtils.formatCurrency((poliza.total || 0) > 0 ? poliza.total || 0 : poliza.prima_neta + (poliza.iva || 0))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Ramo</p>
                            <p className="text-neutral-400 truncate">{(poliza as any).ramo_nombre || poliza.ramo_principal}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Vence</p>
                            <p className="text-neutral-400">{formatDate(poliza.fecha_fin)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            {pagination && pagination.last_page > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
                <span className="text-xs text-neutral-500">
                  Mostrando {pagination.from}-{pagination.to} de {pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                    disabled={pagination.current_page === 1}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" width={16} />
                  </button>
                  {Array.from({ length: Math.min(pagination.last_page, 7) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.last_page <= 7) pageNum = i + 1;
                    else if ((pagination.current_page || 1) <= 4) pageNum = i + 1;
                    else if ((pagination.current_page || 1) >= pagination.last_page - 3) pageNum = pagination.last_page - 6 + i;
                    else pageNum = (pagination.current_page || 1) - 3 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setFilters((prev) => ({ ...prev, page: pageNum }))}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${(pagination.current_page || 1) === pageNum ? 'bg-[#573CFF] text-white' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.last_page, (prev.page || 1) + 1) }))}
                    disabled={pagination.current_page === pagination.last_page}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" width={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

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

                {/* Selector de motivo SOLO cuando el nuevo estado es CANCELADA */}
                {bulkTargetState === 'CANCELADA' && (
                  <div>
                    <label className="text-sm block mb-1">
                      Motivo de cancelación <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border rounded-md p-2 dark:bg-darkgray"
                      value={bulkCancellationReason}
                      onChange={(e) => setBulkCancellationReason(e.target.value)}
                    >
                      <option value="">— Selecciona un motivo —</option>
                      {cancellationReasons.map((r) => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Queda registrado en cada póliza para consulta posterior.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm block mb-1">
                    {bulkTargetState === 'CANCELADA' ? 'Notas adicionales (opcional)' : 'Motivo (opcional)'}
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-md p-2 dark:bg-darkgray"
                    value={bulkMotivoCambio}
                    onChange={(e) => setBulkMotivoCambio(e.target.value)}
                    placeholder="Ingresa un motivo"
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Se aplicará a todas las pólizas seleccionadas.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                color="blue"
                onClick={handleConfirmBulkStateChange}
                disabled={bulkTargetState === 'CANCELADA' && !bulkCancellationReason}
              >
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

          {/* Modal de borrado masivo total */}
          <Modal
            show={showBulkDeleteAllModal}
            onClose={() => {
              setShowBulkDeleteAllModal(false);
              setBulkDeleteConfirmText('');
            }}
            size="md"
          >
            <Modal.Header>
              <div className="flex items-center gap-2 text-red-600">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5" />
                <span>Eliminar TODAS las pólizas</span>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    ⚠️ Esta acción eliminará TODAS las pólizas ({estadisticas?.total_polizas || 0}) de tu cuenta.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    También se eliminarán los pagos, recibos de caja y registros de cartera asociados.
                    Esta acción NO se puede deshacer.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Escribe <strong className="text-red-600">ELIMINAR TODAS</strong> para confirmar:
                  </label>
                  <input
                    type="text"
                    value={bulkDeleteConfirmText}
                    onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800"
                    placeholder="ELIMINAR TODAS"
                  />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                color="failure"
                onClick={handleBulkDeleteAll}
                disabled={bulkDeleteConfirmText !== 'ELIMINAR TODAS' || loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Eliminando...
                  </>
                ) : (
                  'Confirmar eliminación total'
                )}
              </Button>
              <Button
                color="gray"
                onClick={() => {
                  setShowBulkDeleteAllModal(false);
                  setBulkDeleteConfirmText('');
                }}
              >
                Cancelar
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
      </PermissionGate>
    </OnboardingGuard>
  );
};

export default Polizas;

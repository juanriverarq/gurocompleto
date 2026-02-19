import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Badge, Button, Alert, Modal, TextInput, Textarea } from 'flowbite-react';
import { sanitizeEmailHtml } from 'src/utils/sanitize';
import {
  Card as SCard,
  CardContent as SCardContent,
  CardHeader as SCardHeader,
  CardTitle as SCardTitle,
} from 'src/components/shadcn-ui/Default-Ui/card';
import { CardContent } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button as ShButton } from 'src/components/shadcn-ui/Default-Ui/button';
import { Icon } from '@iconify/react';
import guroToast from 'src/components/GuroToast/GuroToast';
import HeroButton from 'src/components/HeroButton';
import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import {
  campaignTemplateService,
  type CampaignTemplate,
} from 'src/services/campaignTemplateService';
import { emailCampaignService } from 'src/services/emailCampaignService';
import saasApi from 'src/services/saasApi';
import sendgridService, { type SendgridTemplate } from 'src/services/sendgridService';
import EmailDesigner from 'src/components/email/EmailDesigner';
import EmailCampaignWizard from 'src/components/email/EmailCampaignWizard';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

type SortBy = 'recientes' | 'usos' | 'apertura';
type ViewMode = 'grid' | 'list';

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  created_at: string;
  subject: string;
  stats?: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
  };
};

interface StatWidgetProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  chartColor: string;
  trend: string;
  trendColor: string;
  chartData: number[];
  chartType: 'area' | 'bar';
  isLoading?: boolean;
}

const StatWidget: React.FC<StatWidgetProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  bgColor,
  chartColor,
  trend,
  trendColor,
  chartData,
  chartType,
  isLoading = false,
}) => {
  const ChartOptions: any = {
    series: [
      {
        name: '',
        data: chartData,
      },
    ],
    chart: {
      type: chartType,
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
      group: 'sparklines',
    },
    colors: [chartColor],
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill:
      chartType === 'area'
        ? {
            type: 'gradient',
            gradient: {
              shadeIntensity: 0,
              inverseColors: false,
              opacityFrom: 0.2,
              opacityTo: 0.8,
              stops: [100],
            },
          }
        : {
            opacity: 0.8,
          },
    plotOptions:
      chartType === 'bar'
        ? {
            bar: {
              borderRadius: 4,
              columnWidth: '50%',
              distributed: true,
              endingShape: 'rounded',
            },
          }
        : {},
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    grid: {
      show: false,
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    xaxis: {
      labels: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function (val: number) {
          return val.toString();
        },
      },
    },
  };

  return (
    <CardBox className="p-0 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center`}>
            <Icon icon={icon} className={`w-4 h-4 ${iconColor}`} />
          </div>
          <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
        </div>

        <div className="mb-2">
          <h5 className="text-base font-bold text-gray-900 dark:text-white mb-1 leading-tight">
            {isLoading ? <div className="w-14 h-4 bg-gray-200 rounded animate-pulse"></div> : value}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-tight">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Chart
          options={ChartOptions}
          series={ChartOptions.series}
          type={chartType}
          height="50px"
          width="100%"
        />
      </div>
    </CardBox>
  );
};

interface CategoriaUI {
  key: string;
  name: string;
  count?: number;
}

const Plantillas = () => {
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission('email_marketing', 'crear');
  const canEdit = hasPermission('email_marketing', 'editar');
  const canDelete = hasPermission('email_marketing', 'eliminar');
  const [loading, setLoading] = useState(true);

  // Deep-link desde buscador global: abrir detalles de campaña email por ID
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_email_campaign_id');
    if (!openId) return;

    const open = async () => {
      try {
        if (!campaigns || campaigns.length === 0) {
          await loadCampaigns();
        }
        const c = (campaigns || []).find((x: any) => String(x.id) === String(openId));
        if (c) {
          setCampaniaSeleccionada(c);
          setMostrarDetallesCampania(true);
          setStatsLoading(true);
          try {
            await refreshCampaignStatus(c.id);
          } finally {
            setStatsLoading(false);
          }
          setRecipients([]);
          setRecipientsPage(1);
          setRecipientStatusFilter('all');
          await loadRecipientsList(true);
        }
      } finally {
        params.delete('open_email_campaign_id');
        navigate(
          {
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : '',
          },
          { replace: true },
        );
      }
    };
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Filtros
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recientes');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Datos
  const [categorias, setCategorias] = useState<CategoriaUI[]>([]);
  const [plantillas, setPlantillas] = useState<CampaignTemplate[]>([]);

  // UI Modals/acciones
  const [mostrarModal, setMostrarModal] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<CampaignTemplate | null>(null);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [mostrarWizardCampania, setMostrarWizardCampania] = useState(false);
  const [mostrarEditorVisual, setMostrarEditorVisual] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [mostrarDetallesCampania, setMostrarDetallesCampania] = useState(false);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState<CampaignRow | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  // Destinatarios - modal de detalles
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientsLimit, setRecipientsLimit] = useState(10);
  const [recipientsHasMore, setRecipientsHasMore] = useState(false);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<string>('all');

  // Estado del editor de plantillas (creación simple)
  const [editorNombre, setEditorNombre] = useState('');
  const [editorCategoria, setEditorCategoria] = useState('');
  const [editorContenido, setEditorContenido] = useState('');
  const [editorGuardando, setEditorGuardando] = useState(false);

  // Wizard campaña - estado
  const [campName, setCampName] = useState('');
  const [campSubject, setCampSubject] = useState('');
  const [campContent, setCampContent] = useState('');
  const [campThrottling, setCampThrottling] = useState<number>(30);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Programación
  const [scheduleMode, setScheduleMode] = useState<'now' | 'window'>('now');
  const [scheduleStart, setScheduleStart] = useState<string>('');
  const [scheduleEnd, setScheduleEnd] = useState<string>('');
  const [scheduleTz, setScheduleTz] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
    } catch {
      return 'America/Bogota';
    }
  });

  // Contenido: manual vs plantilla SendGrid
  const [templateMode, setTemplateMode] = useState<'custom' | 'sendgrid'>('custom');
  const [sgTemplates, setSgTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [sgLoading, setSgLoading] = useState(false);
  const [selectedSgTemplate, setSelectedSgTemplate] = useState<string>('');
  const [sgVarsText, setSgVarsText] = useState<string>('{}');

  // Wizard campaña - audiencia (todos o selección manual)
  const [audienceMode, setAudienceMode] = useState<'all' | 'manual'>('all');
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<
    Array<{ id: number; name: string; email: string }>
  >([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState<
    Record<number, { id: number; name: string; email: string }>
  >({});
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsHasMore, setClientsHasMore] = useState(false);
  // Campañas - listado
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  // Mapa de stats por campaña (hidratado desde /status)
  const [campaignStatsMap, setCampaignStatsMap] = useState<Record<number, any>>({});
  // Selección masiva
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const resetEditorForm = () => {
    setEditorNombre('');
    setEditorCategoria('');
    setEditorContenido('');
    setEditorGuardando(false);
  };

  const handleOpenEditorNew = () => {
    resetEditorForm();
    setMostrarEditor(true);
  };

  const handleOpenVisualEditor = () => {
    resetEditorForm();
    setMostrarEditorVisual(true);
  };

  const handleSaveFromVisualEditor = async (html: string) => {
    if (!editorNombre.trim()) {
      guroToast.warning('Campo requerido', 'Ingresa un nombre para la plantilla antes de guardar.');
      return;
    }
    try {
      setEditorGuardando(true);
      const detectedVars = campaignTemplateService.extractVariables(html) || [];
      const payload: any = {
        name: editorNombre.trim(),
        category: (editorCategoria || 'general').trim(),
        content: html,
        variables: detectedVars,
        is_active: true,
      };

      // Si hay una plantilla seleccionada, actualizar; si no, crear nueva
      const resp = plantillaSeleccionada
        ? await campaignTemplateService.updateTemplate(plantillaSeleccionada.id, payload)
        : await campaignTemplateService.createTemplate(payload);

      if (!resp?.success) {
        throw new Error(resp?.message || 'No se pudo guardar la plantilla');
      }
      await loadPlantillas();
      setMostrarEditorVisual(false);
      resetEditorForm();
      setPlantillaSeleccionada(null);
      guroToast.success(
        plantillaSeleccionada
          ? 'Plantilla actualizada'
          : 'Plantilla creada',
        'La plantilla se ha guardado correctamente',
      );
    } catch (e: any) {
      guroToast.error('Error', e?.message || 'Error al guardar la plantilla');
    } finally {
      setEditorGuardando(false);
    }
  };

  const handleGuardarPlantilla = async () => {
    if (!editorNombre.trim() || !editorContenido.trim()) {
      guroToast.warning('Campos requeridos', 'Completa al menos Nombre y Contenido.');
      return;
    }
    try {
      setEditorGuardando(true);
      const detectedVars = campaignTemplateService.extractVariables(editorContenido) || [];
      const payload: any = {
        name: editorNombre.trim(),
        category: (editorCategoria || 'general').trim(),
        content: editorContenido,
        variables: detectedVars, // backend acepta array (se serializa a JSON)
        is_active: true,
      };
      const resp = await campaignTemplateService.createTemplate(payload);
      if (!resp?.success) {
        throw new Error(resp?.message || 'No se pudo crear la plantilla');
      }
      // Refrescar listado
      await loadPlantillas();
      setMostrarEditor(false);
      resetEditorForm();
      guroToast.success('Plantilla creada', 'La plantilla se ha guardado correctamente');
    } catch (e: any) {
      guroToast.error('Error', e?.message || 'Error al guardar la plantilla');
    } finally {
      setEditorGuardando(false);
    }
  };

  // Abrir wizard precargando contenido desde la plantilla seleccionada (si existe)
  const handleOpenWizard = () => {
    setCampContent(plantillaSeleccionada?.content || '');
    setMostrarWizardCampania(true);
  };
  const handleCsvChange = async (e: any) => {
    try {
      setWizardError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingCsv(true);
      const resp = await emailCampaignService.uploadCsv(file);
      if (!resp?.success || !resp.upload_id) {
        throw new Error(resp?.message || 'Error al subir CSV');
      }
      setUploadId(resp.upload_id);
      setDetectedColumns(resp.detected_columns || []);
      setSampleRows(resp.sample_rows || []);
    } catch (err: any) {
      setWizardError(err?.message || 'Error al subir CSV');
      setUploadId(null);
      setDetectedColumns([]);
      setSampleRows([]);
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleCreateAndStartCampaign = async () => {
    if (!campName.trim() || !campSubject.trim()) {
      setWizardError('Completa Nombre y Asunto.');
      return;
    }
    if (templateMode === 'custom' && !campContent.trim()) {
      setWizardError('Escribe el contenido del email o elige una plantilla.');
      return;
    }
    if (templateMode === 'sendgrid' && !selectedSgTemplate) {
      setWizardError('Selecciona una plantilla de SendGrid.');
      return;
    }

    // Construir filtros de audiencia según el modo
    const selectedIds = Object.keys(selectedClients)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);

    const isManual = audienceMode === 'manual';
    if (isManual && selectedIds.length === 0) {
      setWizardError('Selecciona al menos un cliente o cambia a "Todos".');
      return;
    }
    const segmentFilters = isManual ? { cliente_ids: selectedIds } : {};

    // Validación de programación (antes de enviar)
    if (scheduleMode === 'window') {
      if (!scheduleStart) {
        setWizardError('Selecciona la fecha y hora de inicio.');
        return;
      }
      const start = new Date(scheduleStart);
      if (isNaN(start.getTime()) || start.getTime() <= Date.now()) {
        setWizardError('La fecha de inicio debe ser futura y válida.');
        return;
      }
      if (scheduleEnd) {
        const end = new Date(scheduleEnd);
        if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
          setWizardError('La fecha fin debe ser posterior a la fecha de inicio.');
          return;
        }
      }
    }

    try {
      setCreatingCampaign(true);
      setWizardError(null);

      // Variables de plantilla (JSON opcional cuando se usa SendGrid)
      let templateVariables: any = undefined;
      if (templateMode === 'sendgrid' && sgVarsText.trim()) {
        try {
          templateVariables = JSON.parse(sgVarsText);
        } catch {
          setWizardError('Variables de plantilla inválidas. Debe ser JSON.');
          setCreatingCampaign(false);
          return;
        }
      }

      const payload: any = {
        name: campName.trim(),
        subject: campSubject.trim(),
        audience_type: 'segment',
        segment_filters: segmentFilters,
        throttling_per_minute: campThrottling || 30,
      };

      if (templateMode === 'custom') {
        payload.content = campContent;
      } else {
        payload.sendgrid_template_id = selectedSgTemplate;
        if (templateVariables) payload.template_variables = templateVariables;
      }

      if (scheduleMode === 'window' && scheduleStart) {
        payload.window_start = new Date(scheduleStart).toISOString();
        if (scheduleEnd) payload.window_end = new Date(scheduleEnd).toISOString();
        payload.timezone = scheduleTz;
      }

      const createResp = await emailCampaignService.createCampaign(payload);
      if (!createResp?.success || !createResp?.data?.id) {
        throw new Error(createResp?.message || 'No se pudo crear la campaña');
      }
      const campaignId = createResp.data.id;
      const startResp = await emailCampaignService.startCampaign(campaignId);
      if (!startResp?.success) {
        throw new Error(startResp?.message || 'No se pudo iniciar la campaña');
      }
      guroToast.success('¡Campaña iniciada!', `Recipientes resueltos: ${startResp.resolved_recipients ?? 'N/D'}`);
      setMostrarWizardCampania(false);
      await loadCampaigns();
      await loadCampaigns();
    } catch (err: any) {
      setWizardError(err?.message || 'Error al crear o iniciar la campaña');
    } finally {
      setCreatingCampaign(false);
    }
  };
  // Estadísticas simples derivadas (placeholder si el backend aún no expone KPIs)
  // Helper: búsqueda de clientes (audiencia manual)
  const mapApiClientsToResults = (
    data: any[],
  ): Array<{ id: number; name: string; email: string }> => {
    return (data as any[])
      .map((c: any) => {
        const id = Number(c.id || c.cliente_id || 0);
        const first =
          c?.persona?.nombres ?? c?.nombres ?? c?.nombre ?? c?.empresa?.razon_social ?? '';
        const last = c?.persona?.apellidos ?? c?.apellidos ?? '';
        const name = String(`${first} ${last}` || '').trim();
        const email = String(c?.email_principal ?? c?.email ?? '').trim();
        return { id, name: name || `Cliente ${id}`, email };
      })
      .filter((r) => r.id > 0 && r.email && r.email.includes('@'));
  };

  const searchClients = async (page: number = 1, append: boolean = false) => {
    setClientLoading(true);
    try {
      const resp = await saasApi.getClientes({
        search: clientQuery || undefined,
        per_page: 10,
        page,
      });
      const payload: any = resp?.data as any;
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];
      const mapped = mapApiClientsToResults(data);
      setClientResults((prev) => (append ? [...prev, ...mapped] : mapped));

      // Meta de paginación segura
      const current = Number(payload?.current_page || (resp as any)?.current_page || page || 1);
      const last = Number(payload?.last_page || (resp as any)?.last_page || current || 1);
      setClientsPage(current);
      setClientsHasMore(current < last);
    } catch (_e) {
      if (!append) setClientResults([]);
      setClientsHasMore(false);
    } finally {
      setClientLoading(false);
    }
  };

  // Auto-cargar primera página al cambiar a modo manual dentro del wizard
  useEffect(() => {
    if (
      mostrarWizardCampania &&
      audienceMode === 'manual' &&
      !clientLoading &&
      clientResults.length === 0
    ) {
      searchClients(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode, mostrarWizardCampania]);

  // Auto-cargar plantillas de SendGrid cuando se abre el paso 2 del wizard en modo 'sendgrid'
  useEffect(() => {
    if (
      mostrarWizardCampania &&
      wizardStep === 2 &&
      templateMode === 'sendgrid' &&
      !sgLoading &&
      sgTemplates.length === 0
    ) {
      (async () => {
        try {
          setSgLoading(true);
          const list: SendgridTemplate[] = await sendgridService.listTemplates();
          setSgTemplates(
            (list || []).map((t) => ({ id: String(t.id), name: t.name || String(t.id) })),
          );
        } catch {
          setSgTemplates([]);
        } finally {
          setSgLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarWizardCampania, wizardStep, templateMode]);

  // Recargar destinatarios al cambiar filtro dentro del modal de detalles
  useEffect(() => {
    if (mostrarDetallesCampania && campaniaSeleccionada) {
      loadRecipientsList(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientStatusFilter]);
  const estadisticas = useMemo(() => {
    const total = plantillas.length;
    const activas = plantillas.filter((p) => p.is_active).length;
    const usoPromedio = Math.round(
      plantillas.reduce((acc, p) => acc + (p.usage_count || 0), 0) / (total || 1),
    );
    const tasaAperturaPromedio = 0; // En Fase 1 no hay KPI de apertura por plantilla desde backend
    return {
      total_plantillas: total,
      plantillas_activas: activas,
      plantillas_borrador: total - activas, // aproximación
      uso_promedio: isFinite(usoPromedio) ? usoPromedio : 0,
      tasa_apertura_promedio: tasaAperturaPromedio,
    };
  }, [plantillas]);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);
        await Promise.all([loadCategorias(), loadPlantillas(), loadCampaigns()]);
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar campañas al montar y al cerrar el wizard
  useEffect(() => {
    loadCampaigns().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!mostrarWizardCampania) {
      loadCampaigns().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarWizardCampania]);

  const loadCategorias = async () => {
    try {
      const resp = await campaignTemplateService.getCategories();
      if (resp?.success && resp.data) {
        // resp.data es Record<string, string>
        const list: CategoriaUI[] = Object.entries(resp.data).map(([key, name]) => ({
          key,
          name,
        }));
        setCategorias(list);
      } else {
        setCategorias([]);
      }
    } catch {
      setCategorias([]);
    }
  };

  const loadPlantillas = async () => {
    const filters: Parameters<typeof campaignTemplateService.getTemplates>[0] = {};
    if (categoriaSeleccionada && categoriaSeleccionada !== 'todos') {
      filters.category = categoriaSeleccionada;
    }
    if (busqueda.trim()) {
      filters.search = busqueda.trim();
    }
    try {
      setLoading(true);
      const resp = await campaignTemplateService.getTemplates(filters);
      if (resp?.success && Array.isArray(resp.data)) {
        setPlantillas(resp.data);
      } else {
        setPlantillas([]);
      }
    } catch {
      setPlantillas([]);
    } finally {
      setLoading(false);
    }
  };
  const loadCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      setCampaignsError(null);
      const resp = await emailCampaignService.listCampaigns({ limit: 20, offset: 0 });
      const rows = Array.isArray((resp as any)?.data)
        ? (resp as any).data
        : Array.isArray((resp as any)?.data?.data)
        ? (resp as any).data.data
        : [];

      // Normalizar stats_json a stats para compatibilidad con la tabla
      const normalized = (rows as any[]).map((c: any) => ({
        ...c,
        stats: c.stats_json || c.stats || {},
      }));

      setCampaigns(normalized as CampaignRow[]);
      // Hidratar stats de campañas activas/pendientes en background
      hydrateCampaignsStats(normalized as CampaignRow[]).catch(() => {});
    } catch (e: any) {
      setCampaignsError(e?.message || 'Error al cargar campañas');
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  // --- Helpers: estado y destinatarios de campaña (modal de detalles) ---
  const refreshCampaignStatus = async (id: number) => {
    try {
      const resp = await emailCampaignService.getStatus(id);
      const payload: any = (resp as any)?.data || resp || {};
      setCampaignStats(payload);
      // El backend devuelve stats en payload.stats o payload.campaign.stats_json
      const stats = payload?.stats || payload?.campaign?.stats_json || {};
      if (stats && Object.keys(stats).length > 0) {
        setCampaignStatsMap((prev) => ({ ...prev, [id]: stats }));
        // También actualizar la campaña en el array principal
        setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, stats } : c)));
      }
    } catch {
      setCampaignStats(null);
    }
  };

  const loadRecipientsList = async (reset: boolean = false) => {
    if (!campaniaSeleccionada) return;
    try {
      const page = reset ? 1 : recipientsPage;
      const limit = recipientsLimit;
      const status = recipientStatusFilter !== 'all' ? recipientStatusFilter : undefined;
      setRecipientsLoading(true);
      const resp = await emailCampaignService.getRecipients(campaniaSeleccionada.id, {
        status,
        page,
        limit,
      });
      const arr = Array.isArray((resp as any)?.data)
        ? (resp as any).data
        : Array.isArray(resp as any)
        ? (resp as any)
        : [];
      setRecipients(reset ? arr : [...recipients, ...arr]);
      setRecipientsHasMore((arr?.length || 0) === limit);
      if (!reset) {
        setRecipientsPage(page + 1);
      } else {
        setRecipientsPage(2);
      }
    } catch {
      if (reset) setRecipients([]);
      setRecipientsHasMore(false);
    } finally {
      setRecipientsLoading(false);
    }
  };
  // Hidratación de stats de campañas (consulta /status para campañas activas/no completadas)
  const hydrateCampaignsStats = async (rows?: CampaignRow[]) => {
    const list = (rows || campaigns || []).filter((c) => c.status !== 'completed');
    await Promise.allSettled(
      list.map(async (c) => {
        try {
          const resp = await emailCampaignService.getStatus(c.id);
          const payload: any = (resp as any)?.data || resp || {};
          // El backend devuelve stats en payload.stats o payload.campaign.stats_json
          const stats = payload?.stats || payload?.campaign?.stats_json || {};
          if (stats && Object.keys(stats).length > 0) {
            setCampaignStatsMap((prev) => ({ ...prev, [c.id]: stats }));
            // También actualizar la campaña en el array principal
            setCampaigns((prev) =>
              prev.map((camp) => (camp.id === c.id ? { ...camp, stats } : camp)),
            );
          }
        } catch {
          /* ignore individual errors */
        }
      }),
    );
  };
  // Auto-refresh periódico DESHABILITADO - usar botón manual de actualizar
  // useEffect(() => {
  //   const id = setInterval(() => {
  //     loadCampaigns().catch(() => {});
  //     hydrateCampaignsStats().catch(() => {});
  //   }, 10000); // 10s
  //   return () => clearInterval(id);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
  // Auto-refresh en modal DESHABILITADO - usar botón manual de actualizar
  // useEffect(() => {
  //   if (!(mostrarDetallesCampania && campaniaSeleccionada)) return;
  //   const id = setInterval(() => {
  //     refreshCampaignStatus(campaniaSeleccionada!.id).catch(() => {});
  //   }, 8000);
  //   return () => clearInterval(id);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [mostrarDetallesCampania, campaniaSeleccionada?.id]);
  // ---------------------------------------------------------------------

  const getPreviewText = (html: string) => {
    try {
      const text = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.length > 140 ? text.slice(0, 140) + '…' : text;
    } catch {
      return html;
    }
  };

  const plantillasOrdenadas = useMemo(() => {
    const copia = [...plantillas];
    return copia.sort((a, b) => {
      if (sortBy === 'usos') {
        return (b.usage_count || 0) - (a.usage_count || 0);
      }
      if (sortBy === 'apertura') {
        // Placeholder: sin métrica, ordenar por 0
        return 0;
      }
      // recientes: por updated_at o created_at
      const parseDate = (d?: string) => (d ? new Date(d).getTime() : 0);
      return (
        parseDate(b.updated_at) - parseDate(a.updated_at) ||
        parseDate(b.created_at) - parseDate(a.created_at)
      );
    });
  }, [plantillas, sortBy]);

  const plantillasFiltradas = useMemo(() => {
    const texto = busqueda.toLowerCase();
    return plantillasOrdenadas.filter((p) => {
      const cumpleCategoria =
        categoriaSeleccionada === 'todos' || p.category === categoriaSeleccionada;
      const cumpleBusqueda =
        !texto ||
        p.name.toLowerCase().includes(texto) ||
        (p.category_name || p.category || '').toLowerCase().includes(texto);
      return cumpleCategoria && cumpleBusqueda;
    });
  }, [plantillasOrdenadas, categoriaSeleccionada, busqueda]);

  const onDuplicar = async (tpl: CampaignTemplate) => {
    try {
      const resp = await campaignTemplateService.duplicateTemplate(tpl.id);
      if (resp?.success) {
        await loadPlantillas();
      } else {
        guroToast.error('Error', resp?.message || 'No se pudo duplicar la plantilla');
      }
    } catch (e: any) {
      guroToast.error('Error', e?.message || 'Error al duplicar la plantilla');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '256px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(99, 91, 255, 0.08)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(99, 91, 255, 0.12)',
              borderTop: '2px solid rgba(99, 91, 255, 0.4)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span
            style={{
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Cargando plantillas...
          </span>
        </div>
      </div>
    );
  }

  return (
    <PermissionGate
      route="/apps/marketing/plantillas"
      action="ver"
      fallback={
        <Alert color="warning" className="m-6">
          No tienes permisos para ver Plantillas de Email.
        </Alert>
      }
    >
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Main content container */}
          <div className="col-span-12">
            <div className="p-6 bg-white dark:bg-darkgray rounded-lg">
              {/* Estadísticas de campañas - diseño horizontal con scroll */}
              <div className="w-full mb-8">
                {/* Contenedor con scroll horizontal para todos los widgets */}
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4 min-w-fit">
                    {/* Campañas totales */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="Campañas totales"
                        value={campaigns.length.toString()}
                        subtitle="Total de campañas creadas"
                        icon="solar:letter-bold"
                        iconColor="text-blue-600"
                        bgColor="bg-blue-100 dark:bg-blue-900/30"
                        chartColor="#3B82F6"
                        trend="+12%"
                        trendColor="text-green-600"
                        chartData={[12, 15, 18, 22, 25, 28, 30, 32]}
                        chartType="area"
                      />
                    </div>

                    {/* Campañas completadas */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="Completadas"
                        value={campaigns.filter((c) => c.status === 'completed').length.toString()}
                        subtitle="Campañas finalizadas exitosamente"
                        icon="solar:check-circle-bold"
                        iconColor="text-green-600"
                        bgColor="bg-green-100 dark:bg-green-900/30"
                        chartColor="#10B981"
                        trend="+8%"
                        trendColor="text-green-600"
                        chartData={[8, 10, 12, 15, 18, 20, 22, 24]}
                        chartType="bar"
                      />
                    </div>

                    {/* Campañas en progreso */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="En progreso"
                        value={campaigns
                          .filter((c) => c.status === 'active' || c.status === 'pending')
                          .length.toString()}
                        subtitle="Campañas actualmente activas"
                        icon="solar:clock-circle-bold"
                        iconColor="text-orange-600"
                        bgColor="bg-orange-100 dark:bg-orange-900/30"
                        chartColor="#F59E0B"
                        trend="+15%"
                        trendColor="text-green-600"
                        chartData={[5, 7, 9, 12, 15, 18, 20, 22]}
                        chartType="area"
                      />
                    </div>

                    {/* Plantillas disponibles */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="Plantillas disponibles"
                        value={estadisticas.total_plantillas.toString()}
                        subtitle="Plantillas listas para usar"
                        icon="solar:document-text-bold"
                        iconColor="text-purple-600"
                        bgColor="bg-purple-100 dark:bg-purple-900/30"
                        chartColor="#8B5CF6"
                        trend="+5%"
                        trendColor="text-green-600"
                        chartData={[25, 28, 30, 32, 35, 38, 40, 42]}
                        chartType="bar"
                      />
                    </div>

                    {/* Plantillas activas */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="Plantillas activas"
                        value={estadisticas.plantillas_activas.toString()}
                        subtitle="Plantillas actualmente en uso"
                        icon="solar:eye-bold"
                        iconColor="text-indigo-600"
                        bgColor="bg-indigo-100 dark:bg-indigo-900/30"
                        chartColor="#6366F1"
                        trend="Estable"
                        trendColor="text-blue-600"
                        chartData={[20, 22, 24, 26, 28, 30, 32, 34]}
                        chartType="area"
                      />
                    </div>

                    {/* Uso promedio */}
                    <div className="min-w-[196px] flex-shrink-0">
                      <StatWidget
                        title="Uso promedio"
                        value={estadisticas.uso_promedio.toString()}
                        subtitle="Veces que se usan las plantillas"
                        icon="solar:chart-2-bold"
                        iconColor="text-emerald-600"
                        bgColor="bg-emerald-100 dark:bg-emerald-900/30"
                        chartColor="#10B981"
                        trend="+3%"
                        trendColor="text-green-600"
                        chartData={[2, 3, 4, 5, 6, 7, 8, 9]}
                        chartType="bar"
                      />
                    </div>
                  </div>
                </div>

                {/* Indicador de scroll */}
                <div className="flex justify-center mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Icon icon="solar:arrow-left-outline" className="w-4 h-4" />
                    <span>Desliza para ver más estadísticas</span>
                    <Icon icon="solar:arrow-right-outline" className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Lista de Campañas - contenido principal */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Campañas Activas
                  </h2>
                  <div className="flex items-center gap-3">
                    {canCreate && (
                      <HeroButton icon="solar:add-circle-bold" onClick={handleOpenWizard}>Nueva Campaña</HeroButton>
                    )}
                    <Button
                      size="sm"
                      color="light"
                      onClick={() => {
                        loadCampaigns();
                        hydrateCampaignsStats().catch(() => {});
                      }}
                    >
                      <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Barra de acciones masivas */}
                {selectedCampaigns.size > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:checklist-bold" className="text-blue-600" width={20} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedCampaigns.size} campaña{selectedCampaigns.size !== 1 ? 's' : ''}{' '}
                          seleccionada{selectedCampaigns.size !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => {
                            setSelectedCampaigns(new Set());
                            setSelectAll(false);
                          }}
                        >
                          <Icon icon="solar:close-circle-bold" className="mr-2" width={16} />
                          Cancelar selección
                        </Button>
                        {canDelete && (
                          <Button
                            size="sm"
                            color="failure"
                            onClick={async () => {
                              const count = selectedCampaigns.size;
                              if (
                                !confirm(
                                  `¿Estás seguro de eliminar ${count} campaña${
                                    count !== 1 ? 's' : ''
                                  }?\n\nSe perderán todos los datos de envíos, estadísticas y destinatarios asociados.\n\nEsta acción no se puede deshacer.`,
                                )
                              ) {
                                return;
                              }
                              try {
                                const ids = Array.from(selectedCampaigns);
                                const resp = await emailCampaignService.bulkDeleteCampaigns(ids);
                                if (resp?.success) {
                                  guroToast.success(
                                    'Campañas eliminadas',
                                    `${count} campaña${
                                      count !== 1 ? 's eliminadas' : ' eliminada'
                                    } correctamente`,
                                  );
                                  setSelectedCampaigns(new Set());
                                  setSelectAll(false);
                                  await loadCampaigns();
                                } else {
                                  guroToast.error('Error', resp?.message || 'Error al eliminar las campañas');
                                }
                              } catch (e: any) {
                                guroToast.error('Error', e?.message || 'Error al eliminar las campañas');
                              }
                            }}
                          >
                            <Icon
                              icon="solar:trash-bin-minimalistic-bold"
                              className="mr-2"
                              width={16}
                            />
                            Eliminar seleccionadas
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Badge color="info" size="lg">
                      Cargando campañas...
                    </Badge>
                  </div>
                ) : campaignsError ? (
                  <Alert color="failure" className="mb-6">
                    <Icon icon="solar:danger-triangle-bold" className="mr-2" width={20} />
                    <span>{campaignsError}</span>
                  </Alert>
                ) : campaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <Icon icon="solar:letter-bold" width={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay campañas creadas
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                      Crea tu primera campaña de email para comenzar a comunicarte con tus clientes
                    </p>
                    {canCreate && (
                      <HeroButton icon="solar:add-circle-bold" onClick={handleOpenWizard} size="lg">Crear primera campaña</HeroButton>
                    )}
                  </div>
                ) : (
                  <SCard>
                    <SCardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr className="text-left text-gray-600 dark:text-gray-300">
                              <th className="px-4 py-3 w-12">
                                <input
                                  type="checkbox"
                                  checked={selectAll}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectAll(checked);
                                    if (checked) {
                                      setSelectedCampaigns(new Set(campaigns.map((c) => c.id)));
                                    } else {
                                      setSelectedCampaigns(new Set());
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </th>
                              <th className="px-4 py-3">Campaña</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3">Enviados</th>
                              <th className="px-4 py-3">Entregados</th>
                              <th className="px-4 py-3">Aperturas</th>
                              <th className="px-4 py-3">Clicks</th>
                              <th className="px-4 py-3">Avance</th>
                              <th className="px-4 py-3">Fecha</th>
                              <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {campaigns.map((c) => {
                              const s = (c as any).stats || campaignStatsMap[c.id] || {};
                              const sent = Number(s.sent || 0);
                              const delivered = Number(s.delivered || 0);
                              const opened = Number(s.opened || 0);
                              const clicked = Number(s.clicked || 0);
                              const bounced = Number(s.bounced || 0);
                              // Consideramos avance como (entregados + rebotados) / enviados
                              const processed = delivered + bounced;
                              const percent =
                                sent > 0
                                  ? Math.round((processed / sent) * 100)
                                  : c.status === 'completed'
                                  ? 100
                                  : 0;

                              return (
                                <tr
                                  key={c.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedCampaigns.has(c.id)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedCampaigns);
                                        if (e.target.checked) {
                                          newSelected.add(c.id);
                                        } else {
                                          newSelected.delete(c.id);
                                          setSelectAll(false);
                                        }
                                        setSelectedCampaigns(newSelected);
                                      }}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {c.name}
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {c.subject}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                        c.status === 'completed'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                          : c.status === 'running'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                          : c.status === 'draft'
                                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                          : c.status === 'paused'
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                          : c.status === 'failed'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                      }`}
                                    >
                                      {c.status === 'completed'
                                        ? 'Completada'
                                        : c.status === 'running'
                                        ? 'En ejecución'
                                        : c.status === 'draft'
                                        ? 'Borrador'
                                        : c.status === 'paused'
                                        ? 'Pausada'
                                        : c.status === 'failed'
                                        ? 'Fallida'
                                        : c.status}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3 tabular-nums font-medium text-gray-900 dark:text-white">
                                    {sent}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
                                    {delivered}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
                                    {opened}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
                                    {clicked}
                                  </td>

                                  <td className="px-4 py-3 w-56">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${percent}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-gray-700 dark:text-gray-300 tabular-nums w-10 text-right">
                                        {percent}%
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(c.created_at).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </td>

                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <ShButton
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          setCampaniaSeleccionada(c);
                                          setMostrarDetallesCampania(true);
                                          setStatsLoading(true);
                                          try {
                                            await refreshCampaignStatus(c.id);
                                          } finally {
                                            setStatsLoading(false);
                                          }
                                          // Inicializar destinatarios
                                          setRecipients([]);
                                          setRecipientsPage(1);
                                          setRecipientStatusFilter('all');
                                          await loadRecipientsList(true);
                                        }}
                                        title="Ver detalles"
                                        className="flex items-center gap-1"
                                      >
                                        <Icon icon="solar:eye-bold" width={14} />
                                        <span className="hidden sm:inline">Ver</span>
                                      </ShButton>

                                      {canDelete && (
                                        <ShButton
                                          size="sm"
                                          variant="destructive"
                                          onClick={async () => {
                                            if (
                                              !confirm(
                                                `¿Estás seguro de eliminar la campaña "${c.name}"?\n\nSe perderán todos los datos de envíos, estadísticas y destinatarios asociados a esta campaña.\n\nEsta acción no se puede deshacer.`,
                                              )
                                            ) {
                                              return;
                                            }
                                            try {
                                              const resp =
                                                await emailCampaignService.deleteCampaign(c.id);
                                              if (resp?.success) {
                                                guroToast.success('Campaña eliminada', 'La campaña se ha eliminado correctamente');
                                                await loadCampaigns();
                                              } else {
                                                guroToast.error('Error', resp?.message || 'Error al eliminar la campaña');
                                              }
                                            } catch (e: any) {
                                              guroToast.error('Error', e?.message || 'Error al eliminar la campaña');
                                            }
                                          }}
                                          title="Eliminar campaña"
                                          className="flex items-center gap-1"
                                        >
                                          <Icon
                                            icon="solar:trash-bin-minimalistic-bold"
                                            width={14}
                                          />
                                          <span className="hidden sm:inline">Eliminar</span>
                                        </ShButton>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </SCardContent>
                  </SCard>
                )}
              </div>

              {/* Plantillas - sección secundaria colapsable */}
              <details className="group mb-8" open>
                <summary className="flex items-center justify-between cursor-pointer list-none mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon
                      icon="solar:alt-arrow-down-bold"
                      className="text-gray-500 group-open:rotate-180 transition-transform"
                      width={20}
                    />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Plantillas de Email
                    </h2>
                    <Badge color="gray" size="sm">
                      {estadisticas.total_plantillas} disponibles
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {canCreate && (
                      <Button
                        size="sm"
                        color="light"
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenEditorNew();
                        }}
                      >
                        <Icon icon="solar:code-bold" className="mr-2" width={16} />
                        Editor HTML
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        size="sm"
                        color="primary"
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenVisualEditor();
                        }}
                      >
                        <Icon icon="solar:palette-round-bold" className="mr-2" width={16} />
                        Editor Visual
                      </Button>
                    )}
                  </div>
                </summary>

                {/* Barra de filtros minimalista */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  {/* Búsqueda prominente */}
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Icon
                        icon="solar:magnifer-bold"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        width={18}
                      />
                      <input
                        type="text"
                        placeholder="Buscar plantillas..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') loadPlantillas();
                        }}
                      />
                    </div>
                  </div>

                  {/* Filtros rápidos */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Categorías */}
                    <select
                      className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={categoriaSeleccionada}
                      onChange={(e) => {
                        setCategoriaSeleccionada(e.target.value);
                        setTimeout(loadPlantillas, 0);
                      }}
                    >
                      <option value="todos">Todas las categorías</option>
                      {categorias.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    {/* Ordenar */}
                    <select
                      className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                    >
                      <option value="recientes">Más recientes</option>
                      <option value="usos">Más usadas</option>
                      <option value="apertura">Mayor apertura</option>
                    </select>

                    {/* Vista */}
                    <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                      <button
                        className={`p-2 rounded transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-gray-100 dark:bg-gray-700 text-primary'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                        onClick={() => setViewMode('grid')}
                        title="Vista en cuadrícula"
                      >
                        <Icon icon="solar:widget-2-bold" width={16} />
                      </button>
                      <button
                        className={`p-2 rounded transition-colors ${
                          viewMode === 'list'
                            ? 'bg-gray-100 dark:bg-gray-700 text-primary'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                        onClick={() => setViewMode('list')}
                        title="Vista en lista"
                      >
                        <Icon icon="solar:menu-dots-circle-bold" width={16} />
                      </button>
                    </div>

                    {/* Botón aplicar filtros */}
                    <Button color="primary" size="sm" onClick={() => loadPlantillas()}>
                      <Icon icon="solar:filter-bold" className="mr-2" width={16} />
                      <span className="hidden sm:inline">Aplicar</span>
                    </Button>
                  </div>
                </div>

                {/* Lista de Plantillas - grid más compacto */}
                {plantillasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                      <Icon icon="solar:document-text-bold" width={48} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No hay plantillas
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                      {busqueda || categoriaSeleccionada !== 'todos'
                        ? 'No se encontraron plantillas con los filtros aplicados'
                        : 'Comienza creando tu primera plantilla de email para tus campañas'}
                    </p>
                    {canCreate && (
                      <HeroButton icon="solar:add-circle-bold" onClick={handleOpenVisualEditor} size="lg">Crear primera plantilla</HeroButton>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                        : 'space-y-3'
                    }
                  >
                    {plantillasFiltradas.map((tpl) => {
                      const vars =
                        tpl.variables_list && tpl.variables_list.length > 0
                          ? tpl.variables_list
                          : Object.keys(tpl.variables || {});
                      const categoria = tpl.category_name || tpl.category || 'Sin categoría';
                      const usos = tpl.usage_count || 0;

                      return (
                        <div
                          key={tpl.id}
                          className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-blue-600/50 hover:-translate-y-1 transition-all duration-200"
                        >
                          {/* Preview visual - más compacto */}
                          <div className="relative h-32 bg-white dark:bg-gray-900 overflow-hidden">
                            {/* Miniatura del contenido HTML renderizado */}
                            <div
                              className="absolute inset-0 p-2 text-xs overflow-hidden"
                              style={{
                                transform: 'scale(0.25)',
                                transformOrigin: 'top left',
                                width: '400%',
                                height: '400%',
                              }}
                            >
                              <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(tpl.content) }} />
                            </div>

                            {/* Overlay con acciones rápidas - aparece al hover */}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="xs"
                                color="light"
                                onClick={() => {
                                  setPlantillaSeleccionada(tpl);
                                  setMostrarModal(true);
                                }}
                                title="Ver detalles"
                              >
                                <Icon icon="solar:eye-bold" width={14} />
                              </Button>
                              {canEdit && (
                                <Button
                                  size="xs"
                                  color="info"
                                  onClick={() => {
                                    setPlantillaSeleccionada(tpl);
                                    setEditorNombre(tpl.name);
                                    setEditorCategoria(tpl.category);
                                    setEditorContenido(tpl.content);
                                    setMostrarEditorVisual(true);
                                  }}
                                  title="Editar plantilla"
                                >
                                  <Icon icon="solar:pen-bold" width={14} />
                                </Button>
                              )}
                              <Button
                                size="xs"
                                color="primary"
                                onClick={() => {
                                  setPlantillaSeleccionada(tpl);
                                  handleOpenWizard();
                                }}
                                title="Usar en campaña"
                              >
                                <Icon icon="solar:paper-plane-bold" width={14} />
                              </Button>
                            </div>

                            {/* Badge de estado - esquina superior derecha */}
                            <div className="absolute top-2 right-2">
                              <Badge color={tpl.is_active ? 'success' : 'gray'} size="xs">
                                {tpl.is_active ? 'Activa' : 'Inactiva'}
                              </Badge>
                            </div>
                          </div>

                          {/* Contenido del card - más compacto */}
                          <div className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                                {tpl.name}
                              </h3>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                {categoria}
                              </p>
                            </div>

                            {/* Métricas compactas */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-1">
                                <Icon icon="solar:chart-2-bold" width={12} />
                                <span>{usos} usos</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Icon icon="solar:code-bold" width={12} />
                                <span>{vars.length} vars</span>
                              </div>
                            </div>

                            {/* Acciones compactas */}
                            <div className="flex gap-2">
                              <Button
                                size="xs"
                                color="primary"
                                className="flex-1"
                                onClick={() => {
                                  setPlantillaSeleccionada(tpl);
                                  handleOpenWizard();
                                }}
                                title="Usar en campaña"
                              >
                                <span className="flex items-center gap-1">
                                  <Icon icon="solar:paper-plane-bold" width={14} />
                                  Usar
                                </span>
                              </Button>
                              <Button
                                size="xs"
                                color="success"
                                onClick={() => onDuplicar(tpl)}
                                title="Duplicar plantilla"
                              >
                                <Icon icon="solar:copy-bold" width={14} />
                              </Button>
                              {canDelete && (
                                <Button
                                  size="xs"
                                  color="failure"
                                  onClick={async () => {
                                    if (!confirm(`¿Eliminar "${tpl.name}"?`)) return;
                                    try {
                                      const resp = await campaignTemplateService.deleteTemplate(
                                        tpl.id,
                                      );
                                      if (resp?.success) {
                                        await loadPlantillas();
                                        guroToast.success('Plantilla eliminada', 'La plantilla se ha eliminado correctamente');
                                      } else {
                                        guroToast.error('Error', resp?.message || 'Error al eliminar');
                                      }
                                    } catch (e: any) {
                                      guroToast.error('Error', e?.message || 'Error al eliminar');
                                    }
                                  }}
                                  title="Eliminar plantilla"
                                >
                                  <Icon icon="solar:trash-bin-minimalistic-bold" width={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>

              {/* Modal de Vista Previa */}
              <Modal show={mostrarModal} onClose={() => setMostrarModal(false)} size="4xl">
                <Modal.Header>Vista Previa de Plantilla</Modal.Header>
                <Modal.Body>
                  {plantillaSeleccionada && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-3">Información General</h4>
                          <div className="space-y-2 text-sm">
                            <p>
                              <strong>Nombre:</strong> {plantillaSeleccionada.name}
                            </p>
                            <p>
                              <strong>Categoría:</strong>{' '}
                              {plantillaSeleccionada.category_name ||
                                plantillaSeleccionada.category ||
                                'Sin categoría'}
                            </p>
                            <p>
                              <strong>Estado:</strong>{' '}
                              <Badge
                                color={plantillaSeleccionada.is_active ? 'success' : 'gray'}
                                size="sm"
                              >
                                {plantillaSeleccionada.is_active ? 'activa' : 'inactiva'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">Estadísticas de Uso</h4>
                          <div className="space-y-2 text-sm">
                            <p>
                              <strong>Usos:</strong> {plantillaSeleccionada.usage_count || 0}
                            </p>
                            <p>
                              <strong>Última modificación:</strong>{' '}
                              {plantillaSeleccionada.updated_at}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Vista Previa del Email</h4>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                          <div
                            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(plantillaSeleccionada.content) }}
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Variables Disponibles</h4>
                        <div className="flex flex-wrap gap-2">
                          {(plantillaSeleccionada.variables_list?.length
                            ? plantillaSeleccionada.variables_list
                            : Object.keys(plantillaSeleccionada.variables || {})
                          ).map((variable, index) => (
                            <Badge key={index} color="info" size="sm">{`{{${variable}}}`}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button color="gray" onClick={() => setMostrarModal(false)}>
                    Cerrar
                  </Button>
                  <Button
                    color="success"
                    onClick={() => plantillaSeleccionada && onDuplicar(plantillaSeleccionada)}
                  >
                    <Icon icon="solar:copy-bold" className="mr-2" width={16} />
                    Duplicar
                  </Button>
                  {canEdit && (
                    <Button
                      color="primary"
                      onClick={() => {
                        if (!plantillaSeleccionada) return;
                        setEditorNombre(plantillaSeleccionada.name);
                        setEditorCategoria(plantillaSeleccionada.category);
                        setEditorContenido(plantillaSeleccionada.content);
                        setMostrarModal(false);
                        setMostrarEditorVisual(true);
                      }}
                    >
                      <Icon icon="solar:pen-bold" className="mr-2" width={16} />
                      Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      color="failure"
                      onClick={async () => {
                        if (!plantillaSeleccionada) return;
                        if (
                          !confirm(
                            `¿Estás seguro de eliminar la plantilla "${plantillaSeleccionada.name}"?`,
                          )
                        )
                          return;
                        try {
                          const resp = await campaignTemplateService.deleteTemplate(
                            plantillaSeleccionada.id,
                          );
                          if (resp?.success) {
                            await loadPlantillas();
                            setMostrarModal(false);
                            setPlantillaSeleccionada(null);
                            guroToast.success('Plantilla eliminada', 'La plantilla se ha eliminado correctamente');
                          } else {
                            guroToast.error('Error', resp?.message || 'No se pudo eliminar la plantilla');
                          }
                        } catch (e: any) {
                          guroToast.error('Error', e?.message || 'Error al eliminar la plantilla');
                        }
                      }}
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold" className="mr-2" width={16} />
                      Eliminar
                    </Button>
                  )}
                </Modal.Footer>
              </Modal>

              {/* Modal Editor (Placeholder) */}
              <Modal show={mostrarEditor} onClose={() => setMostrarEditor(false)} size="4xl">
                <Modal.Header>Editor de Plantillas</Modal.Header>
                <Modal.Body>
                  <div className="space-y-6">
                    <Alert color="info">
                      <Icon icon="solar:info-circle-bold" className="mr-2" width={20} />
                      <span>
                        Editor visual de plantillas en desarrollo. Próximamente disponible.
                      </span>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Nombre de la Plantilla
                        </label>
                        <TextInput
                          placeholder="Ej: Bienvenida Cliente Premium"
                          value={editorNombre}
                          onChange={(e) => setEditorNombre(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Categoría</label>
                        <TextInput
                          placeholder="Ej: Bienvenida"
                          value={editorCategoria}
                          onChange={(e) => setEditorCategoria(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Contenido</label>
                      <Textarea
                        rows={10}
                        placeholder="Contenido de la plantilla..."
                        value={editorContenido}
                        onChange={(e) => setEditorContenido(e.target.value)}
                      />
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    color="gray"
                    onClick={() => {
                      setMostrarEditor(false);
                      resetEditorForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    color="primary"
                    onClick={handleGuardarPlantilla}
                    disabled={editorGuardando || !editorNombre.trim() || !editorContenido.trim()}
                  >
                    <Icon icon="solar:diskette-bold" className="mr-2" width={16} />
                    {editorGuardando ? 'Guardando…' : 'Guardar Plantilla'}
                  </Button>
                </Modal.Footer>
              </Modal>

              {/* Modal Editor Visual */}
              <Modal
                show={mostrarEditorVisual}
                onClose={() => setMostrarEditorVisual(false)}
                size="7xl"
              >
                <Modal.Header>
                  <div className="w-full">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Editor Visual de Plantillas
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Diseña tu plantilla de email con el editor drag & drop
                    </p>
                  </div>
                </Modal.Header>
                <Modal.Body>
                  <div className="space-y-4">
                    {/* Campos de metadatos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Icon
                            icon="solar:document-text-bold"
                            className="inline mr-2"
                            width={16}
                          />
                          Nombre de la Plantilla
                        </label>
                        <TextInput
                          placeholder="Ej: Bienvenida Cliente Premium"
                          value={editorNombre}
                          onChange={(e) => setEditorNombre(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Icon icon="solar:folder-bold" className="inline mr-2" width={16} />
                          Categoría
                        </label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                          value={editorCategoria}
                          onChange={(e) => setEditorCategoria(e.target.value)}
                        >
                          <option value="">Seleccionar categoría...</option>
                          {categorias.map((cat) => (
                            <option key={cat.key} value={cat.key}>
                              {cat.name}
                            </option>
                          ))}
                          <option value="nueva">+ Nueva categoría</option>
                        </select>
                      </div>
                    </div>

                    {/* Alert informativo */}
                    <Alert color="info" className="mb-4">
                      <div className="flex items-start gap-2">
                        <Icon
                          icon="solar:info-circle-bold"
                          width={20}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="text-sm">
                          <p className="font-semibold mb-1">Consejos para el editor:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Arrastra bloques desde el panel izquierdo al canvas</li>
                            <li>
                              Haz clic en cualquier elemento para editarlo en el panel derecho
                            </li>
                            <li>
                              Usa variables como{' '}
                              <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                                {'{{nombre}}'}
                              </code>{' '}
                              o{' '}
                              <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                                {'{{email}}'}
                              </code>{' '}
                              en textos
                            </li>
                            <li>El HTML y CSS se generan automáticamente</li>
                          </ul>
                        </div>
                      </div>
                    </Alert>

                    {/* Editor Visual */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <EmailDesigner
                        initialHtml={editorContenido || undefined}
                        height={600}
                        onChange={(html) => setEditorContenido(html)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <div className="flex items-center justify-between w-full">
                    <div className="text-xs text-gray-500">
                      {editorContenido ? (
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="solar:check-circle-bold"
                            className="text-green-600"
                            width={16}
                          />
                          Contenido generado ({editorContenido.length} caracteres)
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="solar:info-circle-bold"
                            className="text-gray-400"
                            width={16}
                          />
                          Diseña tu plantilla usando el editor
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        color="gray"
                        onClick={() => {
                          setMostrarEditorVisual(false);
                          resetEditorForm();
                        }}
                        disabled={editorGuardando}
                      >
                        Cancelar
                      </Button>
                      {canCreate && (
                        <Button
                          color="primary"
                          onClick={() => handleSaveFromVisualEditor(editorContenido)}
                          disabled={
                            editorGuardando || !editorNombre.trim() || !editorContenido.trim()
                          }
                        >
                          <Icon icon="solar:diskette-bold" className="mr-2" width={16} />
                          {editorGuardando ? 'Guardando…' : 'Guardar Plantilla'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Modal.Footer>
              </Modal>

              {/* Wizard de Campaña - Nuevo diseño con Tabs */}
              {mostrarWizardCampania && (
                <EmailCampaignWizard
                  initialContent={campContent}
                  onComplete={async () => {
                    setMostrarWizardCampania(false);
                    await loadCampaigns();
                  }}
                  onCancel={() => setMostrarWizardCampania(false)}
                />
              )}

              {/* Modal Detalles de Campaña (SendGrid) */}
              <Modal
                show={mostrarDetallesCampania}
                onClose={() => setMostrarDetallesCampania(false)}
                size="6xl"
              >
                <Modal.Header>Detalles de campaña</Modal.Header>
                <Modal.Body>
                  {statsLoading ? (
                    <div className="py-10 text-center text-sm text-gray-500">
                      Cargando estadísticas…
                    </div>
                  ) : (
                    campaniaSeleccionada && (
                      <div className="space-y-6">
                        {/* Encabezado */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-500">Nombre</div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {campaniaSeleccionada.name}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Asunto</div>
                            <div className="text-gray-800 dark:text-gray-300">
                              {campaniaSeleccionada.subject}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Estado</div>
                            <Badge
                              color={
                                campaniaSeleccionada.status === 'completed'
                                  ? 'success'
                                  : campaniaSeleccionada.status === 'running'
                                  ? 'info'
                                  : campaniaSeleccionada.status === 'failed'
                                  ? 'failure'
                                  : 'warning'
                              }
                            >
                              {campaniaSeleccionada.status === 'completed'
                                ? 'Completada'
                                : campaniaSeleccionada.status === 'running'
                                ? 'En ejecución'
                                : campaniaSeleccionada.status === 'draft'
                                ? 'Borrador'
                                : campaniaSeleccionada.status === 'paused'
                                ? 'Pausada'
                                : campaniaSeleccionada.status === 'failed'
                                ? 'Fallida'
                                : campaniaSeleccionada.status}
                            </Badge>
                          </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {(() => {
                            const s = (campaignStats?.stats ||
                              campaignStats?.campaign?.stats_json ||
                              campaniaSeleccionada?.stats ||
                              {}) as any;
                            const sent = Number(s.sent || 0);
                            const delivered = Number(s.delivered || 0);
                            const opened = Number(s.opened || 0);
                            const clicked = Number(s.clicked || 0);
                            const bounced = Number(s.bounced || s.failed || 0);
                            const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
                            const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
                            return (
                              <>
                                <Card>
                                  <div className="p-3">
                                    <div className="text-xs text-gray-500">Enviados</div>
                                    <div className="text-lg font-bold">{sent}</div>
                                  </div>
                                </Card>
                                <Card>
                                  <div className="p-3">
                                    <div className="text-xs text-gray-500">Entregados</div>
                                    <div className="text-lg font-bold">{delivered}</div>
                                  </div>
                                </Card>
                                <Card>
                                  <div className="p-3">
                                    <div className="text-xs text-gray-500">Aperturas</div>
                                    <div className="text-lg font-bold">
                                      {opened}{' '}
                                      <span className="text-xs text-gray-500">({openRate}%)</span>
                                    </div>
                                  </div>
                                </Card>
                                <Card>
                                  <div className="p-3">
                                    <div className="text-xs text-gray-500">Clicks</div>
                                    <div className="text-lg font-bold">
                                      {clicked}{' '}
                                      <span className="text-xs text-gray-500">({clickRate}%)</span>
                                    </div>
                                  </div>
                                </Card>
                                <Card>
                                  <div className="p-3">
                                    <div className="text-xs text-gray-500">Rebotes</div>
                                    <div className="text-lg font-bold">{bounced}</div>
                                  </div>
                                </Card>
                              </>
                            );
                          })()}
                        </div>

                        {/* Destinatarios */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Destinatarios</h4>
                            <div className="flex items-center gap-2">
                              <select
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                                value={recipientStatusFilter}
                                onChange={(e) => {
                                  setRecipientStatusFilter(e.target.value);
                                }}
                              >
                                <option value="all">Todos</option>
                                <option value="queued">En cola</option>
                                <option value="sent">Enviado</option>
                                <option value="delivered">Entregado</option>
                                <option value="opened">Abierto</option>
                                <option value="clicked">Click</option>
                                <option value="bounced">Rebotado</option>
                                <option value="failed">Fallido</option>
                              </select>
                              <Button
                                color="light"
                                size="sm"
                                onClick={() =>
                                  campaniaSeleccionada &&
                                  refreshCampaignStatus(campaniaSeleccionada.id)
                                }
                              >
                                <Icon icon="solar:refresh-bold" className="mr-1" width={16} />
                                Actualizar
                              </Button>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            {recipientsLoading && recipients.length === 0 ? (
                              <div className="py-8 text-center text-sm text-gray-500">
                                Cargando destinatarios...
                              </div>
                            ) : recipients.length === 0 ? (
                              <div className="py-8 text-center text-sm text-gray-500">
                                Sin destinatarios para el filtro seleccionado
                              </div>
                            ) : (
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                  <tr className="text-left text-gray-600 dark:text-gray-300">
                                    <th className="px-4 py-2">Nombre</th>
                                    <th className="px-4 py-2">Email</th>
                                    <th className="px-4 py-2">Estado</th>
                                    <th className="px-4 py-2">Enviado</th>
                                    <th className="px-4 py-2">Entregado</th>
                                    <th className="px-4 py-2">Abierto</th>
                                    <th className="px-4 py-2">Click</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {recipients.map((r, idx) => {
                                    const statusColors: Record<string, string> = {
                                      pending:
                                        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
                                      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                                      delivered:
                                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                                      opened:
                                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                                      clicked:
                                        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
                                      failed:
                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                                    };
                                    const statusLabels: Record<string, string> = {
                                      pending: 'Pendiente',
                                      sent: 'Enviado',
                                      delivered: 'Entregado',
                                      opened: 'Abierto',
                                      clicked: 'Click',
                                      failed: 'Fallido',
                                    };
                                    return (
                                      <tr
                                        key={r.id ?? idx}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                                      >
                                        <td className="px-4 py-2">
                                          {r.name || r.full_name || '-'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                          {r.email || r.to || '-'}
                                        </td>
                                        <td className="px-4 py-2">
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                              statusColors[r.status] || 'bg-gray-100 text-gray-800'
                                            }`}
                                          >
                                            {statusLabels[r.status] || r.status || 'N/D'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                          {r.sent_at
                                            ? new Date(r.sent_at).toLocaleString('es-ES', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                          {r.delivered_at
                                            ? new Date(r.delivered_at).toLocaleString('es-ES', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                          {r.opened_at
                                            ? new Date(r.opened_at).toLocaleString('es-ES', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                          {r.clicked_at
                                            ? new Date(r.clicked_at).toLocaleString('es-ES', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : '-'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button
                              size="sm"
                              color="light"
                              disabled={recipientsLoading || !recipientsHasMore}
                              onClick={() => loadRecipientsList(false)}
                            >
                              {recipientsLoading
                                ? 'Cargando...'
                                : recipientsHasMore
                                ? 'Cargar más'
                                : 'No hay más'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button color="gray" onClick={() => setMostrarDetallesCampania(false)}>
                    Cerrar
                  </Button>
                </Modal.Footer>
              </Modal>
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
};

export default Plantillas;

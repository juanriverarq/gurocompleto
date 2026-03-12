import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button } from "../shadcn-ui/Default-Ui/button";
import { Input } from "../shadcn-ui/Default-Ui/input";
import { Label } from "../shadcn-ui/Default-Ui/label";
import { Textarea } from "../shadcn-ui/Default-Ui/textarea";
import { Badge } from "../shadcn-ui/Default-Ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../shadcn-ui/Default-Ui/dialog";
import { Alert, AlertDescription } from "../shadcn-ui/Default-Ui/alert";
import { useToast } from "src/hooks/use-toast";
import { Cliente, clienteService } from "src/services/clienteService";
import campaignService, { ImmediateCampaign, ScheduledCampaign } from "src/services/campaignService";
import campaignValidationService from "src/services/campaignValidationService";
import clientSegmentService, { ClientSegment } from "src/services/clientSegmentService";
import ClientSegmentManager from "src/components/segments/ClientSegmentManager";

interface CreateCampaignWizardProps {
  open: boolean;
  onClose: () => void;
  onCampaignCreated?: (campaign: any) => void;
}

type CampaignType = 'immediate' | 'scheduled';
type MessageMode = 'template' | 'freetext';

interface CampaignData {
  name: string;
  description: string;
  type: CampaignType;
  messageMode: MessageMode;
  whatsapp_instance_id?: number;
  scheduled_date?: string;
  message_template: string;
  selectedClients: Cliente[];
  selectAllClients: boolean;
  // Template-based campaign fields
  template_name?: string;
  template_language?: string;
  variable_mapping?: Record<string, { source: string; fixedValue: string }>;
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  parsed?: {
    header?: { type: string; text?: string };
    body?: string;
    footer?: string;
    buttons?: { type: string; text: string }[];
  };
}

const VARIABLE_SOURCES = [
  { value: 'fixed', label: 'Valor fijo (escribir)' },
  { value: 'nombre', label: 'Nombre del cliente' },
  { value: 'nombre_completo', label: 'Nombre completo' },
  { value: 'apellidos', label: 'Apellidos' },
  { value: 'celular_principal', label: 'Teléfono' },
  { value: 'email_principal', label: 'Email' },
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'poliza_numero', label: 'Número de póliza (primera)' },
  { value: 'poliza_producto', label: 'Producto de póliza' },
  { value: 'poliza_aseguradora', label: 'Aseguradora' },
  { value: 'poliza_vigencia', label: 'Vigencia de póliza' },
];

// Obtener variables disponibles del servicio de validación
const AVAILABLE_VARIABLES = campaignValidationService.getAvailableVariables();

const CreateCampaignWizard: React.FC<CreateCampaignWizardProps> = ({ open, onClose, onCampaignCreated }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados del wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Datos de la campaña
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    type: 'immediate',
    messageMode: 'template',
    message_template: '',
    selectedClients: [],
    selectAllClients: false
  });

  // Estados para recursos
  const [whatsappInstances, setWhatsappInstances] = useState<{ id: number, name: string, status: string }[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithPhone, setShowOnlyWithPhone] = useState(false);

  // Paginación optimizada clientes
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPerPage] = useState(100);
  const [hasMoreClients, setHasMoreClients] = useState(true);
  const clientsAbortRef = useRef<AbortController | null>(null);
  
  // Estados para segmentos
  const [segments, setSegments] = useState<ClientSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<ClientSegment | null>(null);
  const [showSegmentManager, setShowSegmentManager] = useState(false);

  // Estados para plantillas Meta
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<MetaTemplate | null>(null);

  // Estados para mensaje
  const [messagePreview, setMessagePreview] = useState('');
  const [selectedPreviewClient, setSelectedPreviewClient] = useState<Cliente | null>(null);
  
  // Estados para validaciones
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [messageValidation, setMessageValidation] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadWhatsAppInstances();
      loadClients(true);
      loadSegments();
      loadMetaTemplates(campaignData.whatsapp_instance_id);
      resetForm();
    }
  }, [open]);

  // Recarga paginada con debounce al cambiar filtros locales
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      // Resetear lista y cargar desde la página 1 con filtros
      setClients([]);
      setClientsPage(1);
      setHasMoreClients(true);
      loadClients(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm, showOnlyWithPhone, open]);

  // Actualizar vista previa del mensaje cuando cambie (con debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      updateMessagePreview();
      validateMessage();
    }, 250);
    return () => clearTimeout(timer);
  }, [campaignData.message_template, selectedPreviewClient, campaignData.selectedClients, campaignData.selectAllClients]);

  const resetForm = () => {
    setCampaignData({
      name: '',
      description: '',
      type: 'immediate',
      messageMode: 'template',
      message_template: '',
      selectedClients: [],
      selectAllClients: false,
      template_name: undefined,
      template_language: undefined,
      variable_mapping: undefined,
    });
    setCurrentStep(1);
    setSearchTerm('');
    setSelectedPreviewClient(null);
    setSelectedSegment(null);
    setShowSegmentManager(false);
    setSelectedMetaTemplate(null);
  };

  // Helper: extract template variables from body text
  const extractTemplateVars = (body: string): string[] => {
    const matches = body.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(m => m.replace(/[{}]/g, '').trim()) : [];
  };

  // Helper: resolve variable value for a contact
  const resolveTemplateVariable = (varName: string, mapping: Record<string, { source: string; fixedValue: string }>, contact: any): string => {
    const m = mapping[varName];
    if (!m) return varName;
    if (m.source === 'fixed') return m.fixedValue || varName;
    switch (m.source) {
      case 'nombre': return contact.nombre || '';
      case 'nombre_completo': return `${contact.nombre || ''} ${contact.apellidos || ''}`.trim();
      case 'apellidos': return contact.apellidos || '';
      case 'celular_principal': return contact.celular_principal || '';
      case 'email_principal': return contact.email_principal || '';
      case 'ciudad': return contact.ciudad || '';
      case 'poliza_numero': return contact.polizas?.[0]?.numero_poliza || contact.polizas?.[0]?.policy_number || '';
      case 'poliza_producto': return contact.polizas?.[0]?.producto || contact.polizas?.[0]?.product_name || '';
      case 'poliza_aseguradora': return contact.polizas?.[0]?.aseguradora || contact.polizas?.[0]?.insurer_name || '';
      case 'poliza_vigencia': return contact.polizas?.[0]?.fecha_vencimiento || contact.polizas?.[0]?.end_date || '';
      default: return varName;
    }
  };

  // Load approved Meta templates (filtered by instance if provided)
  const loadMetaTemplates = async (instanceId?: number) => {
    try {
      setLoadingTemplates(true);
      const user = (await import('src/config/firebase')).auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const queryParts = ['status=APPROVED'];
      if (instanceId) queryParts.push(`instance_id=${instanceId}`);
      const res = await fetch(`${API_BASE}/saas/whatsapp-inbox/templates?${queryParts.join('&')}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setMetaTemplates(data.templates || []);
      // Reset selected template when instance changes
      if (instanceId) {
        setSelectedMetaTemplate(null);
      }
    } catch (error) {
      console.error('Error loading Meta templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Reload templates when instance changes
  useEffect(() => {
    if (open && campaignData.whatsapp_instance_id) {
      loadMetaTemplates(campaignData.whatsapp_instance_id);
    }
  }, [campaignData.whatsapp_instance_id]);

  // Handle selecting a Meta template
  const handleSelectMetaTemplate = (tpl: MetaTemplate) => {
    setSelectedMetaTemplate(tpl);
    const body = tpl.parsed?.body || '';
    const vars = extractTemplateVars(body);
    const mapping: Record<string, { source: string; fixedValue: string }> = {};
    vars.forEach(v => {
      if (v === '1' || v.toLowerCase().includes('name') || v.toLowerCase().includes('nombre')) {
        mapping[v] = { source: 'nombre_completo', fixedValue: '' };
      } else if (v.toLowerCase().includes('poliza') || v.toLowerCase().includes('policy')) {
        mapping[v] = { source: 'poliza_numero', fixedValue: '' };
      } else {
        mapping[v] = { source: 'fixed', fixedValue: '' };
      }
    });
    setCampaignData(prev => ({
      ...prev,
      template_name: tpl.name,
      template_language: tpl.language || 'es',
      variable_mapping: mapping,
      message_template: body,
      name: prev.name || `Campaña - ${tpl.name}`,
    }));
  };

  const loadSegments = async () => {
    try {
      const result = await clientSegmentService.getSegments();
      setSegments(result);
    } catch (error) {
      console.error('Error loading segments:', error);
    }
  };

  // Función para traducir estados a español
  const translateStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'connected': '✅ Conectado',
      'authenticated': '✅ Autenticado',
      'connecting': '🔄 Conectando...',
      'disconnected': '❌ Desconectado',
      'qr_pending': '📱 Esperando QR',
      'error': '⚠️ Error',
      'unknown': '❓ Desconocido'
    };
    return statusMap[status.toLowerCase()] || `❓ ${status}`;
  };

  const loadWhatsAppInstances = async () => {
    try {
      // Usar el endpoint filtrado por broker del backend para asegurar IDs válidos
      const result = await campaignService.getAvailableWhatsAppInstances();
      if (result.success && result.instances) {
        const mappedInstances = result.instances.map((inst) => {
          const phoneNumber = inst.phone_number || 'Sin número';
          const status = (inst.status || 'unknown').toLowerCase();
          const statusText = translateStatus(status);
          
          // Formato: "Número - Estado" para mejor legibilidad
          const displayName = `${phoneNumber} - ${statusText}`;
          
          return {
            id: inst.id || 0,
            name: displayName,
            status,
            phoneNumber: inst.phone_number
          };
        });
        setWhatsappInstances(mappedInstances);
        
        // Verificar si hay instancias conectadas
        const connectedInstances = mappedInstances.filter(inst =>
          inst.status === 'connected' || inst.status === 'authenticated'
        );
        
        if (mappedInstances.length > 0 && connectedInstances.length === 0) {
          toast({
            title: "⚠️ Advertencia",
            description: "Tienes instancias de WhatsApp pero ninguna está conectada. Conéctalas antes de enviar mensajes.",
            variant: "default",
            duration: 6000
          });
        }
      } else {
        // No sobrescribir la lista existente si el endpoint falla (evita vaciar el selector al crear)
        console.warn('⚠️ No se recibieron instancias disponibles:', result);
        setWhatsappInstances([]);
      }
    } catch (error) {
      // No limpiar el estado si hay error eventual (p. ej., 404 en available-whatsapp-instances)
      console.error('Error loading WhatsApp instances (broker-scoped):', error);
      setWhatsappInstances([]);
    }
  };

  const loadClients = async (reset = false) => {
    if (clientsLoading) return;
// Fast path: intentar endpoint /saas/clientes/all primero en reset para asegurar lista visible
if (reset) {
  try {
    setClientsLoading(true);
    const allResp = await clienteService.getAllClientes();
    if (allResp.success && Array.isArray(allResp.data) && allResp.data.length > 0) {
      setClients(allResp.data);
      setHasMoreClients(false);
      setClientsPage(1);
      setSelectedPreviewClient(allResp.data[0]);
      return;
    }
  } catch (e) {
    // Continuar con paginación si falla
  } finally {
    setClientsLoading(false);
  }
}
    setClientsLoading(true);
    try {
      // Abort previous in-flight request to evitar respuestas tardías
      if (clientsAbortRef.current) {
        clientsAbortRef.current.abort();
      }
      const controller = new AbortController();
      clientsAbortRef.current = controller;

      const pageToLoad = reset ? 1 : clientsPage;

      const filters: Record<string, any> = {
        per_page: clientsPerPage,
        page: pageToLoad,
      };

      if (searchTerm.trim()) {
        // Enviar ambos alias por compatibilidad pero dejar el backend decidir
        filters.q = searchTerm.trim();
        filters.search = searchTerm.trim();
      }

      const response = await clienteService.getClientes(filters, { signal: controller.signal });

      if (response.success && response.data) {
        // Normalizar arreglo de clientes independientemente del formato de paginación
        let pageDataArr: any[] = [];
        const respData: any = response.data as any;

        if (Array.isArray(respData?.data)) {
          pageDataArr = respData.data;
        } else if (Array.isArray(respData)) {
          pageDataArr = respData;
        }

        // NOTA: no filtramos por estado aquí para evitar vacíos si el backend no mapea 'estado'
        // El filtro por celular se aplica en el cliente (showOnlyWithPhone)

        setClients(prev => reset ? pageDataArr : [...prev, ...pageDataArr]);
        const currentPage = Number(respData?.current_page ?? pageToLoad);
        const lastPage = Number(respData?.last_page ?? currentPage);

        setHasMoreClients(currentPage < lastPage);
        setClientsPage(currentPage + 1);

        // Seleccionar preview solo cuando haya datos reales
        if (reset && pageDataArr.length > 0) {
          setSelectedPreviewClient(pageDataArr[0]);
        }

        // Fallback: si en el primer intento no vinieron datos, cargar listado completo como respaldo
        if (reset && pageDataArr.length === 0) {
          try {
            const allResp = await clienteService.getAllClientes();
            if (allResp.success && Array.isArray(allResp.data) && allResp.data.length > 0) {
              setClients(allResp.data);
              setHasMoreClients(false);
              setClientsPage(1);
              setSelectedPreviewClient(allResp.data[0]);
            }
          } catch (e) {
            // silencioso, ya controlado por bloques externos
          }
        }
      } else {
        if (reset) setClients([]);
        setHasMoreClients(false);
        setClientsPage(1);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // petición anterior cancelada, salir sin alterar estado
      } else {
        console.error('🚨 Error loading clients (paginated):', error);
        if (reset) {
          // Fallback robusto: intentar endpoint "all" cuando la paginación falla
          try {
            const allResp = await clienteService.getAllClientes();
            if (allResp.success && Array.isArray(allResp.data) && allResp.data.length > 0) {
              setClients(allResp.data);
              setHasMoreClients(false);
              setClientsPage(1);
              setSelectedPreviewClient(allResp.data[0]);
            } else {
              setClients([]);
              setHasMoreClients(false);
              setClientsPage(1);
            }
          } catch (e) {
            setClients([]);
            setHasMoreClients(false);
            setClientsPage(1);
          }
        } else {
          setHasMoreClients(false);
          setClientsPage(1);
        }
      }
    } finally {
      setClientsLoading(false);
      clientsAbortRef.current = null;
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const before = campaignData.message_template.substring(0, start);
      const after = campaignData.message_template.substring(end);
      const newMessage = before + `{${variable}}` + after;
      
      setCampaignData(prev => ({ ...prev, message_template: newMessage }));
      
      // Mantener el cursor después de la variable insertada
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 2;
        textarea.focus();
      }, 0);
    }
  };

  const updateMessagePreview = () => {
    if (!selectedPreviewClient || !campaignData.message_template) {
      setMessagePreview(campaignData.message_template);
      return;
    }

    let preview = campaignData.message_template;
    AVAILABLE_VARIABLES.forEach(variable => {
      const regex = new RegExp(`\\{${variable.key}\\}`, 'g');
      const value = (selectedPreviewClient as any)[variable.key] || `{${variable.key}}`;
      preview = preview.replace(regex, value);
    });
    
    setMessagePreview(preview);
  };

  const validateMessage = () => {
    if (!campaignData.message_template) {
      setMessageValidation(null);
      return;
    }
    const base = campaignData.selectAllClients ? clients : campaignData.selectedClients;
    // Limitar validación para evitar O(n) grande en cada pulsación
    const clientsToValidate = base.slice(0, 100);
    const validation = campaignValidationService.validateMessage(campaignData.message_template, clientsToValidate);
    setMessageValidation(validation);
  };

  // Aplicar filtros con memo para evitar recomputes costosos
  const filteredClients = useMemo(() => {
    let list = selectedSegment
      ? clientSegmentService.applySegmentFilters(clients, selectedSegment.filters)
      : clients;

    if (showOnlyWithPhone) {
      list = list.filter(c => !!c.celular_principal);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      list = list.filter(client =>
        (client.nombre || '').toLowerCase().includes(searchLower) ||
        (client.apellidos || '').toLowerCase().includes(searchLower) ||
        (client.celular_principal || '').includes(searchTerm) ||
        (client.email_principal || '').toLowerCase().includes(searchLower)
      );
    }

    return list;
  }, [clients, selectedSegment, showOnlyWithPhone, searchTerm]);

  // Limitar render para evitar listas DOM gigantes
  const MAX_RENDER = 300;
  const renderedClients = useMemo(() => {
    return filteredClients.slice(0, MAX_RENDER);
  }, [filteredClients]);

  const handleClientToggle = (client: Cliente) => {
    const isSelected = campaignData.selectedClients.some(c => c.id === client.id);
    if (isSelected) {
      setCampaignData(prev => ({
        ...prev,
        selectedClients: prev.selectedClients.filter(c => c.id !== client.id)
      }));
    } else {
      setCampaignData(prev => ({
        ...prev,
        selectedClients: [...prev.selectedClients, client]
      }));
    }
  };

  const handleSelectAllToggle = (selectAll: boolean) => {
    setCampaignData(prev => ({
      ...prev,
      selectAllClients: selectAll,
      selectedClients: selectAll ? [] : prev.selectedClients
    }));
  };

  const handleSegmentSelect = (segment: ClientSegment, segmentClients: Cliente[]) => {
    setSelectedSegment(segment);
    setCampaignData(prev => ({
      ...prev,
      selectedClients: segmentClients,
      selectAllClients: false
    }));
    setShowSegmentManager(false);
    
    toast({
      title: "Segmento aplicado",
      description: `${segmentClients.length} cliente(s) seleccionados del segmento "${segment.name}"`,
      variant: "default"
    });
  };

  // Step 1: Name + Type (immediate/scheduled) + WhatsApp instance + scheduled date
  const validateStep1 = () => {
    const errors: string[] = [];
    
    if (!campaignData.name.trim()) {
      errors.push("El nombre de la campaña es requerido");
    } else if (campaignData.name.length > 100) {
      errors.push("El nombre de la campaña no puede exceder 100 caracteres");
    }

    // Validar instancias de WhatsApp conectadas
    const connectedInstances = whatsappInstances.filter((inst) =>
      inst.status === 'connected' || inst.status === 'authenticated'
    );
    if (connectedInstances.length === 0) {
      errors.push("No hay instancias de WhatsApp conectadas. Conecta una instancia antes de continuar.");
    }

    // Validar fecha programada
    if (campaignData.type === 'scheduled') {
      if (!campaignData.scheduled_date) {
        errors.push("La fecha de programación es requerida");
      } else {
        const dateValidation = campaignValidationService.validateScheduledDate(campaignData.scheduled_date);
        errors.push(...dateValidation.errors);
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: "Errores de validación", description: errors[0], variant: "destructive" });
      return false;
    }

    setValidationErrors([]);
    return true;
  };

  // Step 2: Template selection (required)
  const validateStep2 = () => {
    const errors: string[] = [];

    if (!selectedMetaTemplate || !campaignData.template_name) {
      errors.push("Selecciona una plantilla aprobada por Meta para continuar");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: "Plantilla requerida", description: errors[0], variant: "destructive" });
      return false;
    }

    setValidationErrors([]);
    return true;
  };

  // Step 3: Recipients
  const validateStep3 = () => {
    const errors: string[] = [];

    if (!campaignData.selectAllClients && campaignData.selectedClients.length === 0) {
      errors.push("Selecciona al menos un destinatario");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: "Errores de validación", description: errors[0], variant: "destructive" });
      return false;
    }

    setValidationErrors([]);
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    // Validación adicional: la fecha programada debe ser al menos 6 minutos en el futuro
    if (campaignData.type === 'scheduled') {
      const nowMs = Date.now();
      const schedMs = campaignData.scheduled_date ? new Date(campaignData.scheduled_date).getTime() : 0;
      if (!schedMs || (schedMs - nowMs) < 6 * 60 * 1000) {
        toast({
          title: "Fecha inválida",
          description: "Selecciona una fecha y hora al menos 6 minutos en el futuro para campañas programadas.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    try {
      const campaignPayload: any = {
        name: campaignData.name,
        description: campaignData.description,
        message_template: campaignData.message_template,
        whatsapp_instance_id: campaignData.whatsapp_instance_id,
        select_all_clients: campaignData.selectAllClients
      };

      // Solo agregar contacts si NO se seleccionan todos los clientes
      if (!campaignData.selectAllClients) {
        campaignPayload.contacts = campaignData.selectedClients
          .filter(client => client.celular_principal)
          .map(client => ({
            id: client.id,
            name: `${client.nombre} ${client.apellidos}`.trim(),
            phone: client.celular_principal,
            email: client.email_principal,
            nombre: client.nombre,
            apellidos: client.apellidos,
            email_principal: client.email_principal,
            celular_principal: client.celular_principal,
            cuit: client.cuit,
            fecha_nacimiento: client.fecha_nacimiento,
            direccion: (client as any).direccion,
            ciudad: client.ciudad,
            ocupacion: (client as any).ocupacion,
            estado: client.estado,
            tipo_documento: client.tipo_documento
          }));
      }

      // Agregar tipo y fecha para campañas programadas
      if (campaignData.type === 'scheduled' && campaignData.scheduled_date) {
        const raw = campaignData.scheduled_date;
        const onlyDate = !!raw && raw.length <= 10 && !raw.includes('T');
        const localNow = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const currentHHmm = `${pad(localNow.getHours())}:${pad(localNow.getMinutes())}`;
        const norm = onlyDate ? `${raw}T${currentHHmm}` : raw;
        const sched = norm ? new Date(norm) : null;
        const scheduledUtcIso = sched && !isNaN(sched.getTime()) ? sched.toISOString() : null;

        if (onlyDate) {
          toast({ title: "Hora completada automáticamente", description: `Se usó la hora actual del sistema: ${currentHHmm}`, variant: "default" });
        }

        campaignPayload.campaign_type = 'scheduled';
        campaignPayload.scheduled_date = scheduledUtcIso;
      }

      // Para plantillas Meta, agregar template_name, template_language y variable_mapping
      if (campaignData.messageMode === 'template' && campaignData.template_name) {
        campaignPayload.template_name = campaignData.template_name;
        campaignPayload.template_language = campaignData.template_language || 'es';
        campaignPayload.variable_mapping = campaignData.variable_mapping;

        if (!campaignData.selectAllClients && campaignPayload.contacts) {
          const vars = Object.keys(campaignData.variable_mapping || {});
          campaignPayload.contacts = campaignPayload.contacts.map((contact: any) => ({
            ...contact,
            custom_data: Object.fromEntries(
              vars.map(v => [v, resolveTemplateVariable(v, campaignData.variable_mapping || {}, contact)])
            ),
          }));
        }
      }

      let result;
      if (campaignData.type === 'immediate') {
        result = await campaignService.createImmediateCampaign(campaignPayload as ImmediateCampaign);
      } else {
        result = await campaignService.createScheduledCampaign(campaignPayload as ScheduledCampaign);
      }

      if (result?.success) {
        toast({
          title: "¡Éxito!",
          description: campaignData.type === 'immediate'
            ? "Campaña creada y mensajes enviados correctamente"
            : "Campaña programada creada correctamente"
        });
        onCampaignCreated?.(result.campaign);
        onClose();
      } else {
        throw new Error(result?.message || 'Error al crear la campaña');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      let errorMessage = error instanceof Error ? error.message : "Error al crear la campaña";
      
      if (errorMessage.includes('instancia') || errorMessage.includes('WhatsApp') || errorMessage.includes('conectada')) {
        toast({ title: "⚠️ Instancia de WhatsApp no disponible", description: "No hay instancias de WhatsApp conectadas. Ve a Conexiones WhatsApp para conectar una.", variant: "destructive", duration: 8000 });
      } else if (errorMessage.includes('microservicio')) {
        toast({ title: "❌ Error de conexión", description: "No se pudo conectar con el servicio de WhatsApp.", variant: "destructive", duration: 8000 });
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border dark:border-gray-700/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <span className="text-lg font-bold">Crear Nueva Campaña</span>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">Envía mensajes masivos usando plantillas aprobadas por Meta</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps - 3 pasos */}
        <div className="flex items-center justify-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            {[{ step: 1, label: 'Configuración' }, { step: 2, label: 'Plantilla' }, { step: 3, label: 'Destinatarios' }].map(({ step, label }, idx) => (
              <React.Fragment key={step}>
                {idx > 0 && <div className={`w-10 h-1 rounded-full transition-all ${currentStep > step - 1 ? 'bg-green-400 dark:bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                  currentStep > step ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                    : currentStep === step ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    currentStep > step ? 'bg-green-500 text-white' : currentStep === step ? 'bg-indigo-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {currentStep > step ? <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" /> : step}
                  </div>
                  <span className="font-medium hidden sm:inline">{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* STEP 1: Configuración */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Campaign Type: 2 opciones */}
            <div>
              <Label className="text-base font-semibold mb-3 block text-gray-900 dark:text-white">Tipo de Envío</Label>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setCampaignData(prev => ({ ...prev, type: 'immediate' }))}
                  className={`p-5 border-2 rounded-xl text-left transition-all hover:shadow-md ${campaignData.type === 'immediate' ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-2 ring-green-200 dark:ring-green-500/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                  <Icon icon="solar:bolt-bold-duotone" className="w-8 h-8 mb-2" />
                  <div className="font-semibold text-base">Inmediato</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Se envía al crear la campaña</div>
                </button>
                <button type="button" onClick={() => setCampaignData(prev => ({ ...prev, type: 'scheduled' }))}
                  className={`p-5 border-2 rounded-xl text-left transition-all hover:shadow-md ${campaignData.type === 'scheduled' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-500/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                  <Icon icon="solar:calendar-mark-bold-duotone" className="w-8 h-8 mb-2" />
                  <div className="font-semibold text-base">Programado</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Elige fecha y hora de envío</div>
                </button>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="campaign-name" className="text-gray-700 dark:text-gray-300">Nombre de la Campaña *</Label>
                <Input id="campaign-name" placeholder="Ej: Promoción Enero 2024" value={campaignData.name} onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))} className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500" />
              </div>
              <div>
                <Label htmlFor="campaign-description" className="text-gray-700 dark:text-gray-300">Descripción</Label>
                <Input id="campaign-description" placeholder="Descripción breve de la campaña" value={campaignData.description} onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))} className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500" />
              </div>
            </div>

            {/* Scheduled Date */}
            {campaignData.type === 'scheduled' && (
              <div>
                <Label htmlFor="scheduled-date" className="text-gray-700 dark:text-gray-300">Fecha y Hora de Envío *</Label>
                <Input id="scheduled-date" type="datetime-local" value={campaignData.scheduled_date || ''} onChange={(e) => setCampaignData(prev => ({ ...prev, scheduled_date: e.target.value }))} className="dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
            )}

            {/* WhatsApp Instance */}
            <div>
              <Label className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
                <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4 text-green-500" />
                Instancia de WhatsApp
              </Label>
              {(() => {
                const connectedInstances = whatsappInstances.filter((inst) => inst.status === 'connected' || inst.status === 'authenticated');
                const hasConnected = connectedInstances.length > 0;
                return (
                  <div className={`mb-3 p-3 rounded-lg border ${hasConnected ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'}`}>
                    <div className="flex items-center gap-2">
                      <Icon icon={hasConnected ? "solar:check-circle-bold-duotone" : "solar:danger-triangle-bold-duotone"} className={`w-5 h-5 ${hasConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${hasConnected ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {hasConnected ? `${connectedInstances.length} instancia(s) conectada(s)` : 'No hay instancias conectadas'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{hasConnected ? 'Puedes enviar mensajes de WhatsApp' : 'Ve a Conexiones WhatsApp para conectar una instancia'}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <select className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={campaignData.whatsapp_instance_id || ''} onChange={(e) => setCampaignData(prev => ({ ...prev, whatsapp_instance_id: e.target.value ? parseInt(e.target.value) : undefined }))}>
                <option value="">Instancia automática</option>
                {whatsappInstances.map((instance) => (<option key={instance.id} value={instance.id}>{instance.name}</option>))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Selecciona una instancia específica o deja automático</p>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert className="border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                <Icon icon="solar:danger-bold" className="w-4 h-4 text-red-600 dark:text-red-400" />
                <AlertDescription>
                  <div className="space-y-1">{validationErrors.map((error, index) => (<div key={index} className="text-red-700 dark:text-red-400 text-sm">• {error}</div>))}</div>
                </AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className="flex justify-end">
              <Button onClick={handleNext} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                Siguiente <Icon icon="solar:arrow-right-bold" className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Plantilla */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Info banner: templates required */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Plantilla requerida por Meta</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Para enviar campañas masivas por WhatsApp, Meta requiere usar plantillas previamente aprobadas. Esto garantiza la entrega y evita bloqueos en tu cuenta.</p>
              </div>
            </div>

            {/* Template Selection */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-green-500 dark:text-green-400" />
                Selecciona una Plantilla Aprobada
              </Label>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-10">
                  <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500 mr-2" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Cargando plantillas...</span>
                </div>
              ) : metaTemplates.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                    <Icon icon="solar:document-add-bold-duotone" className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No tienes plantillas aprobadas</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">Necesitas crear al menos una plantilla y esperar la aprobación de Meta antes de poder enviar campañas.</p>
                  <Button type="button" onClick={() => { onClose(); navigate('/apps/whatsapp/plantillas'); }} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6">
                    <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                    Crear Plantilla
                  </Button>
                </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {metaTemplates.map(tpl => {
                      const bodyText = tpl.parsed?.body || '';
                      const vars = extractTemplateVars(bodyText);
                      const isSelected = selectedMetaTemplate?.id === tpl.id;
                      return (
                        <button key={tpl.id} type="button"
                          className={`relative border rounded-xl p-3 text-left transition-all hover:shadow-md ${isSelected ? 'border-green-500 bg-green-50 dark:bg-green-500/10 ring-2 ring-green-200 dark:ring-green-500/30' : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-500/50 bg-white dark:bg-gray-800'}`}
                          onClick={() => handleSelectMetaTemplate(tpl)}>
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-mono text-xs font-medium text-gray-900 dark:text-gray-200">{tpl.name}</span>
                            <Badge className={`text-[10px] ${tpl.category === 'MARKETING' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                              {tpl.category === 'MARKETING' ? 'Marketing' : 'Utilidad'}
                            </Badge>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 mb-1 border border-gray-100 dark:border-gray-700">
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">{bodyText}</p>
                          </div>
                          {vars.length > 0 && <p className="text-[10px] text-gray-500 dark:text-gray-400">{vars.length} variable{vars.length > 1 ? 's' : ''}: {vars.map(v => `{{${v}}}`).join(', ')}</p>}
                          {tpl.parsed?.buttons && tpl.parsed.buttons.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {tpl.parsed.buttons.map((btn, i) => (<span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded">{btn.text}</span>))}
                            </div>
                          )}
                          {isSelected && <div className="absolute top-2 right-2"><Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-600 dark:text-green-400" /></div>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Variable Mapping */}
                {selectedMetaTemplate && campaignData.variable_mapping && Object.keys(campaignData.variable_mapping).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:code-bold-duotone" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <Label className="text-sm font-semibold text-gray-900 dark:text-white">Mapeo de Variables</Label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Asigna de dónde se obtiene cada variable.</p>
                    {Object.entries(campaignData.variable_mapping).map(([varName, mapping]) => (
                      <div key={varName} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 w-16 flex-shrink-0 font-medium">{`{{${varName}}}`}</span>
                        <Icon icon="solar:arrow-right-bold" className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <select value={mapping.source} onChange={e => setCampaignData(prev => ({ ...prev, variable_mapping: { ...prev.variable_mapping, [varName]: { ...prev.variable_mapping![varName], source: e.target.value } } }))} className="flex-1 text-xs p-1.5 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                          {VARIABLE_SOURCES.map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
                        </select>
                        {mapping.source === 'fixed' && (
                          <Input value={mapping.fixedValue} onChange={e => setCampaignData(prev => ({ ...prev, variable_mapping: { ...prev.variable_mapping, [varName]: { ...prev.variable_mapping![varName], fixedValue: e.target.value } } }))} placeholder="Valor para todos" className="w-32 h-7 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Template Preview */}
                {selectedMetaTemplate && (
                  <div className="bg-[#e5ddd5] dark:bg-gray-800 rounded-xl p-3 border dark:border-gray-700">
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Vista previa del mensaje</p>
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-3 max-w-xs border dark:border-gray-700">
                      {selectedMetaTemplate.parsed?.header?.text && <p className="font-bold text-sm text-gray-900 dark:text-white mb-1">{selectedMetaTemplate.parsed.header.text}</p>}
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedMetaTemplate.parsed?.body || ''}</p>
                      {selectedMetaTemplate.parsed?.footer && <p className="text-xs text-gray-400 mt-2">{selectedMetaTemplate.parsed.footer}</p>}
                      {selectedMetaTemplate.parsed?.buttons && selectedMetaTemplate.parsed.buttons.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2 space-y-1">
                          {selectedMetaTemplate.parsed.buttons.map((btn, i) => (<div key={i} className="text-center py-1 text-xs text-blue-500 dark:text-blue-400 font-medium border border-blue-50 dark:border-blue-500/20 rounded">{btn.text}</div>))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            {validationErrors.length > 0 && (
              <Alert className="border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                <Icon icon="solar:danger-bold" className="w-4 h-4 text-red-600 dark:text-red-400" />
                <AlertDescription><div className="space-y-1">{validationErrors.map((error, index) => (<div key={index} className="text-red-700 dark:text-red-400 text-sm">• {error}</div>))}</div></AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-2" /> Anterior
              </Button>
              <Button onClick={handleNext} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                Siguiente <Icon icon="solar:arrow-right-bold" className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Destinatarios */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Label className="text-base font-semibold mb-3 block text-gray-900 dark:text-white">Destinatarios</Label>

            {/* Select All Toggle */}
            <button type="button" onClick={() => handleSelectAllToggle(!campaignData.selectAllClients)}
              className={`w-full flex items-center justify-between p-4 mb-4 rounded-xl border-2 transition-all ${campaignData.selectAllClients ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border-green-400 dark:border-green-500/50 shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/5'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${campaignData.selectAllClients ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className={`font-semibold ${campaignData.selectAllClients ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>Enviar a todos los clientes</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{campaignData.selectAllClients ? '✓ Se enviará a todos los clientes activos con celular' : 'Haz clic para seleccionar todos automáticamente'}</div>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full p-1 transition-all ${campaignData.selectAllClients ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${campaignData.selectAllClients ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            {!campaignData.selectAllClients && (
              <>
                {/* Segmentos */}
                <div className="space-y-3 mb-4">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                          <Icon icon="solar:users-group-rounded-bold-duotone" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Segmentos Guardados</Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{segments.length} segmento(s) disponible(s)</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowSegmentManager(true)} className="h-8 px-3 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200">
                        <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 mr-1" /> Gestionar
                      </Button>
                    </div>
                    {segments.length === 0 ? (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Icon icon="solar:folder-open-bold-duotone" className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No hay segmentos creados</p>
                        <button type="button" onClick={() => setShowSegmentManager(true)} className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-1">+ Crear primer segmento</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedSegment && (
                          <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSegment.color }} />
                              <span className="text-sm font-medium text-purple-700">{selectedSegment.name}</span>
                              <Badge className="bg-purple-100 text-purple-700 text-xs">{clientSegmentService.countClientsInSegment(clients, selectedSegment)} clientes</Badge>
                            </div>
                            <button type="button" onClick={() => { setSelectedSegment(null); setCampaignData(prev => ({ ...prev, selectedClients: [] })); }} className="p-1 hover:bg-purple-200 rounded-md transition-colors">
                              <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4 text-purple-600" />
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {segments.slice(0, 6).map((segment) => {
                            const clientCount = clientSegmentService.countClientsInSegment(clients, segment);
                            const isSelected = selectedSegment?.id === segment.id;
                            return (
                              <button key={segment.id} type="button" onClick={() => handleSegmentSelect(segment, clientSegmentService.applySegmentFilters(clients, segment.filters))}
                                className={`flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${isSelected ? 'bg-purple-100 border-2 border-purple-400 shadow-sm' : 'bg-gray-50 border border-gray-200 hover:bg-purple-50 hover:border-purple-300'}`}>
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs font-medium truncate ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>{segment.name}</div>
                                  <div className="text-[10px] text-gray-500">{clientCount} cliente(s)</div>
                                </div>
                                {isSelected && <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-purple-600 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {segments.length > 6 && (
                          <button type="button" onClick={() => setShowSegmentManager(true)} className="w-full py-2 text-xs text-purple-600 hover:text-purple-700 font-medium hover:bg-purple-50 rounded-lg transition-colors">
                            Ver {segments.length - 6} segmentos más →
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Icon icon="solar:magnifer-bold" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input placeholder="Buscar por nombre, celular o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
                  </div>

                  {/* Filters */}
                  <div className="flex items-center justify-between gap-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setShowOnlyWithPhone(!showOnlyWithPhone)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showOnlyWithPhone ? 'bg-green-100 text-green-700 border-2 border-green-300 shadow-sm' : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'}`}>
                        <Icon icon="solar:smartphone-bold-duotone" className="w-4 h-4" /> Solo con celular
                        {showOnlyWithPhone && <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600" />}
                      </button>
                      {showOnlyWithPhone && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{filteredClients.length} de {clients.length}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => {
                        const toSelect = showOnlyWithPhone ? filteredClients.filter(c => c.celular_principal) : filteredClients;
                        setCampaignData(prev => ({ ...prev, selectedClients: [...prev.selectedClients, ...toSelect.filter(c => !prev.selectedClients.some(s => s.id === c.id))] }));
                      }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all">
                        <Icon icon="solar:checklist-bold-duotone" className="w-4 h-4" /> Seleccionar todos
                      </button>
                      <button type="button" onClick={() => setCampaignData(prev => ({ ...prev, selectedClients: [] }))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all">
                        <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" /> Limpiar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Client List */}
                {filteredClients.length > MAX_RENDER && <div className="text-xs text-gray-600 mb-2">Mostrando los primeros {MAX_RENDER} de {filteredClients.length} resultados.</div>}
                <div className="border rounded-md max-h-80 overflow-y-auto">
                  {clientsLoading ? (
                    <div className="p-4 text-center text-gray-500"><Icon icon="solar:refresh-bold" className="w-6 h-6 mx-auto mb-2 animate-spin" /> Cargando clientes...</div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Icon icon="solar:users-group-rounded-bold" className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="font-medium mb-1">{clients.length === 0 ? 'No hay clientes registrados' : 'No se encontraron clientes'}</p>
                      <p className="text-sm">{clients.length === 0 ? 'Registra clientes primero' : 'Intenta con otros términos de búsqueda'}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {renderedClients.map((client) => {
                        const isSelected = campaignData.selectedClients.some(c => c.id === client.id);
                        return (
                          <div key={client.id} className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''} ${!client.celular_principal ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`} onClick={() => handleClientToggle(client)}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-sm">{client.nombre} {client.apellidos}</div>
                                  {!client.celular_principal && <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">Sin celular</Badge>}
                                </div>
                                <div className="text-xs text-gray-500">{client.celular_principal || 'Sin número'} • {client.email_principal}</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); setSelectedPreviewClient(client); }} className="text-indigo-600 hover:text-indigo-800" title="Ver preview">
                                  <Icon icon="solar:eye-bold" className="w-4 h-4" />
                                </button>
                                {isSelected && <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-indigo-600" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {hasMoreClients && (
                  <div className="mt-2 flex justify-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => loadClients(false)} disabled={clientsLoading} className="h-8">{clientsLoading ? 'Cargando...' : 'Cargar más'}</Button>
                  </div>
                )}

                {/* Selection Summary */}
                <div className="mt-2 p-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:users-group-rounded-bold" className="w-3 h-3 text-indigo-600" />
                        <span className="font-semibold text-indigo-900">{campaignData.selectedClients.length}</span>
                        <span className="text-gray-600">seleccionados</span>
                      </div>
                      <div className="h-3 w-px bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full" /><span className="text-green-700">{campaignData.selectedClients.filter(c => c.celular_principal).length}</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-full" /><span className="text-yellow-700">{campaignData.selectedClients.filter(c => !c.celular_principal).length}</span></div>
                      </div>
                    </div>
                    <div className="text-gray-500">
                      {renderedClients.length} mostrados
                      {selectedSegment && <span className="ml-2 text-purple-600">• Segmento: {selectedSegment.name}</span>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {campaignData.selectAllClients && (
              <Alert className="dark:border-gray-700 dark:bg-gray-800">
                <Icon icon="solar:info-circle-bold" className="w-4 h-4 dark:text-blue-400" />
                <AlertDescription className="dark:text-gray-300">La campaña se enviará a todos los clientes activos con número de celular válido.</AlertDescription>
              </Alert>
            )}

            {validationErrors.length > 0 && (
              <Alert className="border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                <Icon icon="solar:danger-bold" className="w-4 h-4 text-red-600 dark:text-red-400" />
                <AlertDescription><div className="space-y-1">{validationErrors.map((error, index) => (<div key={index} className="text-red-700 dark:text-red-400 text-sm">• {error}</div>))}</div></AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-2" /> Anterior
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin" /> : <Icon icon="solar:paper-plane-bold" className="w-4 h-4 mr-2" />}
                {campaignData.type === 'immediate' ? 'Crear y Enviar' : 'Programar Campaña'}
              </Button>
            </div>
          </div>
        )}

        {/* Modal de gestión de segmentos */}
        <Dialog open={showSegmentManager} onOpenChange={setShowSegmentManager}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border dark:border-gray-700/50">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Gestión de Segmentos</DialogTitle>
            </DialogHeader>
            <ClientSegmentManager
              clients={clients}
              onSegmentSelect={handleSegmentSelect}
              selectedSegmentId={selectedSegment?.id}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignWizard;
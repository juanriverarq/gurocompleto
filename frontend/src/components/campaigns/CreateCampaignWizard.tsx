import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { Button } from "../shadcn-ui/Default-Ui/button";
import { Input } from "../shadcn-ui/Default-Ui/input";
import { Label } from "../shadcn-ui/Default-Ui/label";
import { Textarea } from "../shadcn-ui/Default-Ui/textarea";
import { Badge } from "../shadcn-ui/Default-Ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../shadcn-ui/Default-Ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../shadcn-ui/Default-Ui/dialog";
import { Alert, AlertDescription } from "../shadcn-ui/Default-Ui/alert";
import { Switch } from "../shadcn-ui/Default-Ui/switch";
import { useToast } from "src/hooks/use-toast";
import { Cliente, clienteService } from "src/services/clienteService";
/* whatsappInstanceService import removed: now using campaignService.getAvailableWhatsAppInstances */
import campaignService, { ImmediateCampaign, ScheduledCampaign } from "src/services/campaignService";
import campaignValidationService from "src/services/campaignValidationService";
import clientSegmentService, { ClientSegment } from "src/services/clientSegmentService";
import ClientSegmentManager from "src/components/segments/ClientSegmentManager";
import { useDropzone } from "react-dropzone";

interface CreateCampaignWizardProps {
  open: boolean;
  onClose: () => void;
  onCampaignCreated?: (campaign: any) => void;
}

type CampaignType = 'immediate' | 'scheduled';

interface CampaignData {
  name: string;
  description: string;
  type: CampaignType;
  whatsapp_instance_id?: number;
  scheduled_date?: string;
  message_template: string;
  selectedClients: Cliente[];
  selectAllClients: boolean;
}

// Obtener variables disponibles del servicio de validación
const AVAILABLE_VARIABLES = campaignValidationService.getAvailableVariables();

const CreateCampaignWizard: React.FC<CreateCampaignWizardProps> = ({ open, onClose, onCampaignCreated }) => {
  const { toast } = useToast();
  
  // Estados del wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Datos de la campaña
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    type: 'immediate',
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
  const [clientsTotal, setClientsTotal] = useState(0);
  const clientsAbortRef = useRef<AbortController | null>(null);
  
  // Estados para segmentos
  const [segments, setSegments] = useState<ClientSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<ClientSegment | null>(null);
  const [showSegmentManager, setShowSegmentManager] = useState(false);

  // Estados para mensaje
  const [messagePreview, setMessagePreview] = useState('');
  const [selectedPreviewClient, setSelectedPreviewClient] = useState<Cliente | null>(null);
  
  // Estados para validaciones
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [messageValidation, setMessageValidation] = useState<any>(null);

  // Subida de imagen (media) opcional para la campaña
  const [mediaUpload, setMediaUpload] = useState<{
    url: string;
    type: 'image' | null;
    uploading: boolean;
    error?: string;
  }>({ url: '', type: 'image', uploading: false });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      loadWhatsAppInstances();
      loadClients(true);
      loadSegments();
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
      message_template: '',
      selectedClients: [],
      selectAllClients: false
    });
    setCurrentStep(1);
    setSearchTerm('');
    setSelectedPreviewClient(null);
    setSelectedSegment(null);
    setShowSegmentManager(false);
    // Reset media upload state
    setMediaUpload({ url: '', type: 'image', uploading: false });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

// Helper: subir imagen (archivo) con validaciones y toasts
const uploadImageFile = async (file: File) => {
 try {
   const MAX_MB = 5;
   if (file.size > MAX_MB * 1024 * 1024) {
     toast({
       title: "Archivo demasiado grande",
       description: `El tamaño máximo permitido es ${MAX_MB}MB`,
       variant: "destructive",
     });
     return;
   }

   setMediaUpload((prev) => ({ ...prev, uploading: true, error: undefined }));

   const resp = await campaignService.uploadCampaignMedia(file);
   if (!resp.success || !resp.media_url) {
     throw new Error(resp.message || "No se pudo subir la imagen");
   }

   setMediaUpload({
     url: resp.media_url,
     type: resp.media_type || "image",
     uploading: false,
   });

   toast({
     title: "Imagen subida",
     description:
       "La imagen fue cargada correctamente y se adjuntará a la campaña",
     variant: "default",
   });
 } catch (err: any) {
   const msg =
     err instanceof Error ? err.message : "Error al subir la imagen";
   setMediaUpload((prev) => ({ ...prev, uploading: false, error: msg }));
   toast({
     title: "Error al subir imagen",
     description: msg,
     variant: "destructive",
   });
 }
};

// Handler: subir imagen para campaña (fallback input file)
const handleMediaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 await uploadImageFile(file);
 if (fileInputRef.current) fileInputRef.current.value = '';
};

// Drag & Drop handler usando tema actual
const onDropImage = useCallback(async (acceptedFiles: File[]) => {
 if (!acceptedFiles || acceptedFiles.length === 0) return;
 const file = acceptedFiles[0];
 await uploadImageFile(file);
}, []);

// Hook dropzone (solo una imagen, tipos comunes)
const { getRootProps, getInputProps, isDragActive } = useDropzone({
 onDrop: onDropImage,
 multiple: false,
 maxFiles: 1,
 accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
});
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
      setClientsTotal(allResp.data.length);
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
        const totalNorm =
          Number(respData?.total ?? (reset ? pageDataArr.length : clients.length + pageDataArr.length));
        setClientsTotal(totalNorm);

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
              setClientsTotal(allResp.data.length);
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
              setClientsTotal(allResp.data.length);
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

  const validateStep1 = () => {
    const errors: string[] = [];
    
    // Validar nombre
    if (!campaignData.name.trim()) {
      errors.push("El nombre de la campaña es requerido");
    } else if (campaignData.name.length > 100) {
      errors.push("El nombre de la campaña no puede exceder 100 caracteres");
    }

    // Validar fecha programada
    if (campaignData.type === 'scheduled') {
      if (!campaignData.scheduled_date) {
        errors.push("La fecha de programación es requerida");
      } else {
        const dateValidation = campaignValidationService.validateScheduledDate(campaignData.scheduled_date);
        errors.push(...dateValidation.errors);
        
        // Mostrar advertencias de fecha
        if (dateValidation.warnings.length > 0) {
          dateValidation.warnings.forEach(warning => {
            toast({ title: "Advertencia", description: warning, variant: "default" });
          });
        }
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

  const validateStep2 = () => {
    const clientsToValidate = campaignData.selectAllClients ? clients : campaignData.selectedClients;
    
    const validation = campaignValidationService.validateCampaign({
      name: campaignData.name,
      type: campaignData.type,
      message_template: campaignData.message_template,
      scheduled_date: campaignData.scheduled_date,
      selectedClients: campaignData.selectedClients,
      selectAllClients: campaignData.selectAllClients,
      allClients: clients
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast({ title: "Errores de validación", description: validation.errors[0], variant: "destructive" });
      return false;
    }

    // Mostrar advertencias si las hay
    if (validation.warnings.length > 0) {
      setValidationWarnings(validation.warnings);
      validation.warnings.forEach(warning => {
        toast({ title: "Advertencia", description: warning, variant: "default" });
      });
    }

    setValidationErrors([]);
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

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

    // ✅ VALIDACIÓN ADICIONAL: Verificar que haya instancias conectadas para campañas inmediatas
    if (campaignData.type === 'immediate') {
      const connectedInstances = whatsappInstances.filter((inst: any) =>
        inst.status === 'connected' || inst.status === 'authenticated'
      );
      
      if (connectedInstances.length === 0) {
        toast({
          title: "⚠️ No hay instancias conectadas",
          description: "Debes tener al menos una instancia de WhatsApp conectada para enviar mensajes. Ve a la pestaña 'Conexión WhatsApp' para conectar una instancia.",
          variant: "destructive",
          duration: 8000
        });
        return;
      }
    }

    setLoading(true);
    try {
      // Construir payload según si se seleccionan todos los clientes o no
      const campaignPayload: any = {
        name: campaignData.name,
        description: campaignData.description,
        message_template: campaignData.message_template,
        whatsapp_instance_id: campaignData.whatsapp_instance_id,
        select_all_clients: campaignData.selectAllClients
      };

      // Adjuntar media si fue subida
      if (mediaUpload.url) {
        campaignPayload.media_url = mediaUpload.url;
        campaignPayload.media_type = 'image';
      }

      // Solo agregar contacts si NO se seleccionan todos los clientes
      if (!campaignData.selectAllClients) {
        campaignPayload.contacts = campaignData.selectedClients
          .filter(client => client.celular_principal) // Solo clientes con celular
          .map(client => ({
            id: client.id,
            name: `${client.nombre} ${client.apellidos}`.trim(),
            phone: client.celular_principal,
            email: client.email_principal,
            // Agregar datos adicionales para personalización
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

      // Agregar tipo y fecha solo para campañas programadas
      if (campaignData.type === 'scheduled' && campaignData.scheduled_date) {
        // Normalizar: si el usuario solo seleccionó fecha sin hora, completar con la hora actual del sistema
        const raw = campaignData.scheduled_date;
// Si el usuario no proporciona hora (solo YYYY-MM-DD), completar con la hora actual del sistema
const onlyDate = !!raw && raw.length <= 10 && !raw.includes('T');
const localNow = new Date();
const pad = (n: number) => n.toString().padStart(2, '0');
const currentHHmm = `${pad(localNow.getHours())}:${pad(localNow.getMinutes())}`;
const norm = onlyDate ? `${raw}T${currentHHmm}` : raw;

// Convertir a ISO (UTC) para que backend valide correctamente con Carbon
const sched = norm ? new Date(norm) : null;
const scheduledUtcIso = sched && !isNaN(sched.getTime()) ? sched.toISOString() : null;

// Avisar al usuario la hora usada cuando no ingresó hora
if (onlyDate) {
  toast({
    title: "Hora completada automáticamente",
    description: `Se usó la hora actual del sistema: ${currentHHmm}`,
    variant: "default",
  });
}

campaignPayload.campaign_type = 'scheduled';
campaignPayload.scheduled_date = scheduledUtcIso;
      }

      let result;
      if (campaignData.type === 'immediate') {
        result = await campaignService.createImmediateCampaign(campaignPayload as ImmediateCampaign);
      } else if (campaignData.type === 'scheduled') {
        result = await campaignService.createScheduledCampaign(campaignPayload as ScheduledCampaign);
      }

      if (result?.success) {
        toast({
          title: "¡Éxito!",
          description: campaignData.type === 'immediate'
            ? "Campaña creada y mensajes enviados correctamente"
            : "Campaña programada creada correctamente"
        });
        // ✅ CORREGIDO: result.campaign es la estructura correcta del servicio
        onCampaignCreated?.(result.campaign);
        onClose();
      } else {
        throw new Error(result?.message || 'Error al crear la campaña');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      
      // Mejorar mensajes de error para casos específicos
      let errorMessage = error instanceof Error ? error.message : "Error al crear la campaña";
      
      // Detectar errores específicos de instancias de WhatsApp
      if (errorMessage.includes('instancia') || errorMessage.includes('WhatsApp') || errorMessage.includes('conectada')) {
        toast({
          title: "⚠️ Instancia de WhatsApp no disponible",
          description: "No hay instancias de WhatsApp conectadas. Ve a la pestaña 'Conexión WhatsApp' para crear y conectar una instancia antes de enviar mensajes.",
          variant: "destructive",
          duration: 8000 // Mostrar por más tiempo
        });
      } else if (errorMessage.includes('microservicio')) {
        toast({
          title: "❌ Error de conexión",
          description: "No se pudo conectar con el servicio de WhatsApp. Verifica que el microservicio esté funcionando.",
          variant: "destructive",
          duration: 8000
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const campaignTypes = [
    {
      id: 'immediate',
      icon: 'solar:lightning-bold',
      title: 'Inmediata',
      description: 'Envío inmediato'
    },
    {
      id: 'scheduled',
      icon: 'solar:calendar-bold',
      title: 'Programada',
      description: 'Fecha específica'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:chat-square-code-bold" className="w-6 h-6" />
            Crear Nueva Campaña
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
              }`}>
                {currentStep > 1 ? <Icon icon="solar:check-circle-bold" className="w-5 h-5" /> : '1'}
              </div>
              <span className="font-medium">Configuración</span>
            </div>
            
            <div className={`w-12 h-0.5 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="font-medium">Mensaje y Destinatarios</span>
            </div>
          </div>
        </div>

        {/* Step 1: Configuration */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Campaign Type */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Tipo de Campaña</Label>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                {campaignTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCampaignData(prev => ({ ...prev, type: type.id as CampaignType }))}
                    className={`p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                      campaignData.type === type.id 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon icon={type.icon} className="w-6 h-6 mb-2" />
                    <div className="font-medium text-sm">{type.title}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="campaign-name">Nombre de la Campaña *</Label>
                <Input
                  id="campaign-name"
                  placeholder="Ej: Promoción Enero 2024"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="campaign-description">Descripción</Label>
                <Input
                  id="campaign-description"
                  placeholder="Descripción breve de la campaña"
                  value={campaignData.description}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* WhatsApp Instance */}
            <div>
              <Label htmlFor="whatsapp-instance">Instancia de WhatsApp</Label>
              <select
                id="whatsapp-instance"
                className="w-full p-2 border rounded-md"
                value={campaignData.whatsapp_instance_id || ''}
                onChange={(e) => setCampaignData(prev => ({ 
                  ...prev, 
                  whatsapp_instance_id: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
              >
                <option value="">Instancia automática</option>
                {whatsappInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecciona una instancia específica o deja automático
              </p>
            </div>

            {/* Scheduled Date (if applicable) */}
            {campaignData.type === 'scheduled' && (
              <div>
                <Label htmlFor="scheduled-date">Fecha y Hora de Envío *</Label>
                <Input
                  id="scheduled-date"
                  type="datetime-local"
                  value={campaignData.scheduled_date}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                />
              </div>
            )}

            {/* Imagen opcional - Drag & Drop (tema actual) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Adjuntar imagen (opcional)</Label>

              <div
                {...getRootProps({
                  className:
                    `mt-1 flex justify-center px-6 py-8 border-2 border-dashed rounded-md transition-colors ` +
                    `${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`
                })}
              >
                <input {...getInputProps()} />
                <div className="text-center">
                  <Icon icon="solar:cloud-upload-bold-duotone" className="mx-auto mb-2 w-10 h-10 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">
                    {isDragActive ? 'Suelta la imagen aquí' : 'Arrastra una imagen aquí o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Formatos: JPG, JPEG, PNG, WEBP, GIF. Máx 5MB.</p>
                </div>
              </div>

              {mediaUpload.uploading && (
                <div className="text-xs text-gray-600">Subiendo imagen...</div>
              )}
              {!!mediaUpload.error && (
                <div className="text-xs text-red-600">Error: {mediaUpload.error}</div>
              )}
              {mediaUpload.url && (
                <div className="flex items-center gap-3 mt-2">
                  <img
                    src={mediaUpload.url}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMediaUpload({ url: '', type: 'image', uploading: false });
                    }}
                    className="h-8"
                  >
                    <Icon icon="solar:trash-bin-bold" className="w-4 h-4 mr-1" />
                    Quitar imagen
                  </Button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-end">
              <Button onClick={handleNext} className="px-8">
                Siguiente
                <Icon icon="solar:arrow-right-bold" className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Message and Recipients */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Message Editor */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="message-textarea" className="text-base font-semibold">Mensaje de la Campaña *</Label>
                  <Textarea
                    id="message-textarea"
                    placeholder="Escribe tu mensaje aquí... Usa {nombre}, {apellidos}, etc. para personalizar"
                    value={campaignData.message_template}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, message_template: e.target.value }))}
                    rows={6}
                    className={`resize-none ${messageValidation && !messageValidation.isValid ? 'border-red-500' : ''}`}
                  />
                  
                  {/* Contador de caracteres y validación */}
                  <div className="flex justify-between items-center text-xs mt-1">
                    <div className="flex items-center gap-4">
                      <span className={`${
                        messageValidation?.characterCount > 4096 ? 'text-red-600' :
                        messageValidation?.characterCount > 3686 ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {messageValidation?.characterCount || 0}/4096 caracteres
                      </span>
                      {messageValidation?.variableCount > 0 && (
                        <span className="text-blue-600">
                          {messageValidation.variableCount} variable(s)
                        </span>
                      )}
                    </div>
                    {messageValidation && !messageValidation.isValid && (
                      <span className="text-red-600 font-medium">
                        ⚠️ Errores detectados
                      </span>
                    )}
                  </div>

                  {/* Mostrar errores de validación del mensaje */}
                  {messageValidation && messageValidation.errors.length > 0 && (
                    <Alert className="border-red-200 bg-red-50 mt-2">
                      <Icon icon="solar:danger-bold" className="w-4 h-4 text-red-600" />
                      <AlertDescription>
                        <div className="space-y-1">
                          {messageValidation.errors.map((error: string, index: number) => (
                            <div key={index} className="text-red-700 text-sm">• {error}</div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Mostrar advertencias del mensaje */}
                  {messageValidation && messageValidation.warnings.length > 0 && (
                    <Alert className="border-yellow-200 bg-yellow-50 mt-2">
                      <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-yellow-600" />
                      <AlertDescription>
                        <div className="space-y-1">
                          {messageValidation.warnings.map((warning: string, index: number) => (
                            <div key={index} className="text-yellow-700 text-sm">• {warning}</div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Sugerencias para mejorar el mensaje */}
                  {campaignData.message_template && (
                    (() => {
                      const suggestions = campaignValidationService.getMessageSuggestions(campaignData.message_template);
                      return suggestions.length > 0 ? (
                        <Alert className="border-blue-200 bg-blue-50 mt-2">
                          <Icon icon="solar:lightbulb-bold" className="w-4 h-4 text-blue-600" />
                          <AlertDescription>
                            <div className="text-blue-700 text-sm">
                              <div className="font-medium mb-1">💡 Sugerencias:</div>
                              {suggestions.map((suggestion, index) => (
                                <div key={index} className="text-sm">• {suggestion}</div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : null;
                    })()
                  )}
                </div>

                {/* Variable Inserter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Variables Disponibles</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <button
                          key={variable.key}
                          onClick={() => insertVariable(variable.key)}
                          className="flex items-center justify-between p-2 text-xs border rounded hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium">{variable.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {`{${variable.key}}`}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Message Preview */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Vista Previa</Label>
                  <div className="border rounded-md p-3 bg-gray-50 min-h-[100px]">
                    {selectedPreviewClient ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">
                          Preview para: {selectedPreviewClient.nombre} {selectedPreviewClient.apellidos}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {messagePreview || "Escribe un mensaje para ver la vista previa..."}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {campaignData.message_template || "Escribe un mensaje para ver la vista previa..."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Client Selection */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold mb-3 block">Destinatarios</Label>
                  
                  {/* Select All Toggle */}
                  <div className="flex items-center space-x-2 mb-4 p-3 border rounded-md bg-blue-50">
                    <Switch
                      checked={campaignData.selectAllClients}
                      onCheckedChange={handleSelectAllToggle}
                    />
                    <Label className="font-medium">Enviar a todos los clientes activos</Label>
                  </div>

                  {!campaignData.selectAllClients && (
                    <>
                      {/* Segmentos y filtros */}
                      <div className="space-y-3 mb-4">
                        {/* Segmentos disponibles */}
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium text-purple-900">Segmentos Disponibles</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowSegmentManager(true)}
                              className="h-6 px-2 text-xs"
                            >
                              <Icon icon="solar:settings-bold" className="w-3 h-3 mr-1" />
                              Gestionar
                            </Button>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {selectedSegment && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSegment(null);
                                  setCampaignData(prev => ({ ...prev, selectedClients: [] }));
                                }}
                                className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                              >
                                <Icon icon="solar:close-circle-bold" className="w-3 h-3 mr-1" />
                                Limpiar Segmento
                              </Button>
                            )}
                            
                            {segments.slice(0, 4).map((segment) => {
                              const clientCount = clientSegmentService.countClientsInSegment(clients, segment);
                              const isSelected = selectedSegment?.id === segment.id;
                              
                              return (
                                <button
                                  key={segment.id}
                                  type="button"
                                  onClick={() => handleSegmentSelect(segment, clientSegmentService.applySegmentFilters(clients, segment.filters))}
                                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                    isSelected
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                                >
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: isSelected ? 'white' : segment.color }}
                                  />
                                  {segment.name} ({clientCount})
                                </button>
                              );
                            })}
                            
                            {segments.length > 4 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSegmentManager(true)}
                                className="h-7 px-2 text-xs"
                              >
                                +{segments.length - 4} más
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Search and Filters - Compact Design */}
                        {/* Search Bar */}
                        <div className="relative">
                          <Icon icon="solar:magnifer-bold" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Buscar por nombre, celular o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-9"
                          />
                        </div>
                        
                        {/* Compact Filter and Actions Row */}
                        <div className="flex items-center justify-between gap-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                          {/* Filter Checkbox */}
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2 px-2 py-1 bg-white rounded-md shadow-sm border">
                              <input
                                type="checkbox"
                                id="filter-phone"
                                checked={showOnlyWithPhone}
                                onChange={(e) => setShowOnlyWithPhone(e.target.checked)}
                                className="w-3 h-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500 focus:ring-1"
                              />
                              <Label htmlFor="filter-phone" className="text-xs font-medium text-gray-700 cursor-pointer">
                                📱 Solo con celular
                              </Label>
                            </div>
                            {showOnlyWithPhone && (
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                                {filteredClients.length} de {clients.length}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Compact Bulk Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const clientsToSelect = showOnlyWithPhone
                                  ? filteredClients.filter(c => c.celular_principal)
                                  : filteredClients;
                                setCampaignData(prev => ({
                                  ...prev,
                                  selectedClients: [...prev.selectedClients, ...clientsToSelect.filter(c =>
                                    !prev.selectedClients.some(selected => selected.id === c.id)
                                  )]
                                }));
                              }}
                              className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            >
                              <Icon icon="solar:check-square-bold" className="w-3 h-3 mr-1" />
                              Todos
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCampaignData(prev => ({
                                  ...prev,
                                  selectedClients: []
                                }));
                              }}
                              className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            >
                              <Icon icon="solar:close-square-bold" className="w-3 h-3 mr-1" />
                              Ninguno
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Client List */}
                      {filteredClients.length > MAX_RENDER && (
                        <div className="text-xs text-gray-600 mb-2">
                          Mostrando los primeros {MAX_RENDER} de {filteredClients.length} resultados. Refina la búsqueda o usa filtros para acotar la lista.
                        </div>
                      )}
                      <div className="border rounded-md max-h-80 overflow-y-auto">
                        {clientsLoading ? (
                          <div className="p-4 text-center text-gray-500">
                            <Icon icon="solar:refresh-bold" className="w-6 h-6 mx-auto mb-2 animate-spin" />
                            Cargando clientes...
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            <Icon icon="solar:users-group-rounded-bold" className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            {clients.length === 0 ? (
                              <div>
                                <p className="font-medium mb-1">No hay clientes registrados</p>
                                <p className="text-sm">Registra clientes primero para poder crear campañas</p>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium mb-1">No se encontraron clientes</p>
                                <p className="text-sm">Intenta con otros términos de búsqueda</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y">
                            {renderedClients.map((client) => {
                              const isSelected = campaignData.selectedClients.some(c => c.id === client.id);
                              return (
                                <div
                                  key={client.id}
                                  className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                                    isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                                  } ${!client.celular_principal ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`}
                                  onClick={() => handleClientToggle(client)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium text-sm">
                                          {client.nombre} {client.apellidos}
                                        </div>
                                        {!client.celular_principal && (
                                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                            Sin celular
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {client.celular_principal || 'Sin número'} • {client.email_principal}
                                      </div>
                                      {!client.celular_principal && (
                                        <div className="text-xs text-yellow-600 mt-1">
                                          ⚠️ No recibirá mensajes de WhatsApp
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPreviewClient(client);
                                        }}
                                        className="text-indigo-600 hover:text-indigo-800"
                                        title="Ver preview"
                                      >
                                        <Icon icon="solar:eye-bold" className="w-4 h-4" />
                                      </button>
                                      {isSelected && (
                                        <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-indigo-600" />
                                      )}
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => loadClients(false)}
      disabled={clientsLoading}
      className="h-8"
    >
      {clientsLoading ? 'Cargando...' : 'Cargar más'}
    </Button>
  </div>
)}

                      {/* Compact Selection Summary */}
                      <div className="mt-2 p-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Icon icon="solar:users-group-rounded-bold" className="w-3 h-3 text-indigo-600" />
                              <span className="font-semibold text-indigo-900">{campaignData.selectedClients.length}</span>
                              <span className="text-gray-600">seleccionados</span>
                            </div>
                            <div className="h-3 w-px bg-gray-300"></div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-green-700">{campaignData.selectedClients.filter(c => c.celular_principal).length}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-yellow-700">{campaignData.selectedClients.filter(c => !c.celular_principal).length}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-500">
                            {renderedClients.length} mostrados
                            {selectedSegment && (
                              <span className="ml-2 text-purple-600">
                                • Segmento: {selectedSegment.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {campaignData.selectAllClients && (
                    <Alert>
                      <Icon icon="solar:info-circle-bold" className="w-4 h-4" />
                      <AlertDescription>
                        La campaña se enviará a todos los clientes activos con número de celular válido.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>

            {/* Mostrar errores de validación generales */}
            {validationErrors.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <Icon icon="solar:danger-bold" className="w-4 h-4 text-red-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="text-red-700 text-sm">• {error}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || (messageValidation && !messageValidation.isValid)}
                className="px-8"
              >
                {loading ? (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Icon icon="solar:paper-plane-bold" className="w-4 h-4 mr-2" />
                )}
                {campaignData.type === 'immediate' ? 'Crear y Enviar' : 'Crear Campaña'}
              </Button>
            </div>
          </div>
        )}

        {/* Modal de gestión de segmentos */}
        <Dialog open={showSegmentManager} onOpenChange={setShowSegmentManager}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gestión de Segmentos</DialogTitle>
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
import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, Tabs, TextInput, TabsRef, ToggleSwitch } from 'flowbite-react';
import { Checkbox } from "src/components/shadcn-ui/Default-Ui/checkbox";
import { Select as ShadSelect, SelectContent as ShadSelectContent, SelectItem as ShadSelectItem, SelectTrigger as ShadSelectTrigger, SelectValue as ShadSelectValue } from "src/components/shadcn-ui/Default-Ui/select";
import { Icon } from '@iconify/react';
import DynamicFieldsConfig from '../voice-ai/DynamicFieldsConfig';
import DecisionPoliciesConfig from '../voice-ai/DecisionPoliciesConfig';
import {
  AgentTemplate,
  AGENT_TEMPLATES,
  getAgentTemplatesByCategory
} from '../../data/campaignAgentTemplates';
import { clienteService, Cliente } from '../../services/clienteService';
import voiceCampaignService, { VoiceCampaignTriggerInput } from '../../services/voiceCampaignService';
import whatsappInstanceService from '../../services/whatsappInstanceService';
import { testVoice } from '../../services/elevenLabsService';
import { createPortal } from 'react-dom';
import { useSaas } from '../../contexts/SaasContext';

// Importar imágenes de perfil para que funcionen en producción
import real1 from '../../assets/images/profile/real1.jpg';
import real2 from '../../assets/images/profile/real2.jpg';
import real3 from '../../assets/images/profile/real3.jpg';
import real4 from '../../assets/images/profile/real4.jpg';
import real5 from '../../assets/images/profile/real5.jpg';
import real6 from '../../assets/images/profile/real6.jpg';
import real7 from '../../assets/images/profile/real7.jpg';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  language: string;
  labels?: {
    language?: string;
    accent?: string;
    description?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
  settings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

// Interfaces para configuración dinámica
interface CustomField {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  required: boolean;
  instruction?: string;
  pattern?: string;
  validation?: {
    min_digits?: number;
    max_digits?: number;
    min_age?: number;
    max_age?: number;
  };
}

interface CollectConfig {
  email?: { enabled: boolean; type: string; required: boolean };
  document_id?: { enabled: boolean; type: string; required: boolean };
  address?: { enabled: boolean; type: string; required: boolean };
}

interface DecisionCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface DecisionAction {
  action: string;
  parameters: Record<string, any>;
}

interface DecisionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: DecisionCondition[];
  actions: DecisionAction[];
}

interface CampaignData {
  // Paso 1: Selección de Agente
  selectedTemplate: AgentTemplate | null;
  agentName: string;
  
  // Paso 2: Personalización del Mensaje
  customPrompt: string;
  customFirstMessage: string;
  customVariables: Record<string, string>;
  
  // Paso 3: Audiencia y Contactos
  audienceType: 'upload' | 'existing' | 'manual';
  selectedContacts: Cliente[];
  
  // Paso 4: Configuración de Campaña
  campaignName: string;
  campaignDescription: string;
  schedulingType: 'immediate' | 'scheduled';
  scheduledDate: string;
  scheduledTime: string;
  maxConcurrentCalls: number;
  callTimeout: number;
  
  // Paso 5: Configuraciones Avanzadas
  voiceSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    speakerBoost: boolean;
  };
  // Herramientas al finalizar - Configuración dinámica
  postCallTools: {
    collect: CollectConfig;
    customFields: CustomField[];
    whatsapp: { enabled: boolean; instance_id: string; template: string; noAnswerEnabled: boolean; noAnswerTemplate: string };
    decisionPolicies: DecisionPolicy[];
    followUpEnabled?: boolean;
    followUpCondition?: string;
    followUpDays?: number;
    followUpDescription?: string;
    // Disparador para crear negocio en embudo de ventas
    createDealEnabled?: boolean;
    createDealContactability?: string;
    createDealObjective?: string;
    createDealStage?: string;
    createDealDescription?: string;
  };
  // Reglas de decisión (IF-THEN) - Mantenido para compatibilidad
  decisionPolicies: Array<any>;
  // Configuración de buzón de voz
  voicemailConfig: {
    enabled: boolean;
    message: string;
  };
}

const INITIAL_CAMPAIGN_DATA: CampaignData = {
  selectedTemplate: null,
  agentName: '',
  customPrompt: '',
  customFirstMessage: '',
  customVariables: {},
  audienceType: 'manual',
  selectedContacts: [],
  campaignName: '',
  campaignDescription: '',
  schedulingType: 'immediate',
  scheduledDate: '',
  scheduledTime: '',
  maxConcurrentCalls: 3,
  callTimeout: 300,
  voiceSettings: {
    stability: 0.45,
    similarityBoost: 0.6,
    style: 0.8,
    speakerBoost: true
  },
  postCallTools: {
    collect: {
      email: { enabled: false, type: 'email', required: false },
      document_id: { enabled: false, type: 'document_id', required: false },
      address: { enabled: false, type: 'address', required: false }
    },
    customFields: [],
    whatsapp: { enabled: false, instance_id: '', template: 'Hola {customer_name}, te compartimos tu enlace de pago: {payment_link}', noAnswerEnabled: false, noAnswerTemplate: 'Hola {customer_name}, intentamos comunicarnos contigo sin éxito. Por favor contáctanos para información sobre tu póliza.' },
    decisionPolicies: [],
    followUpEnabled: false,
    followUpCondition: 'call_successful',
    followUpDays: 3,
    followUpDescription: '',
    createDealEnabled: false,
    createDealContactability: 'any',
    createDealObjective: 'any',
    createDealStage: 'lead',
    createDealDescription: ''
  },
  decisionPolicies: [],
  voicemailConfig: {
    enabled: false,
    message: ''
  }
};

interface CampaignWizardProps {
  onComplete?: (campaignData: CampaignData) => void;
  onCancel?: () => void;
}

const STEPS = [
  { id: 1, title: 'Objetivo', icon: 'solar:target-bold-duotone', description: 'Seleccionar objetivo de la campaña' },
  { id: 2, title: 'Agente', icon: 'solar:soundwave-bold-duotone', description: 'Configurar voz del agente' },
  { id: 3, title: 'Presentación', icon: 'solar:user-speak-bold-duotone', description: 'Definir nombre del agente' },
  { id: 4, title: 'Herramientas', icon: 'solar:settings-minimalistic-bold-duotone', description: 'Disparadores y configuración' },
  { id: 5, title: 'Clientes', icon: 'solar:users-group-two-rounded-bold-duotone', description: 'Audiencia (opcional con triggers)' },
  { id: 6, title: 'Ejecutar', icon: 'solar:play-circle-bold-duotone', description: 'Lanzar campaña' }
];



export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  // Usar contexto SaaS de forma segura (puede no estar disponible en todos los contextos)
  let tenant: any = null;
  try {
    const saasContext = useSaas();
    tenant = saasContext?.tenant;
  } catch (e) {
    // Si no está dentro de SaasProvider, tenant será null
    console.warn('[CampaignWizard] SaasContext no disponible, usando fallback para nombre de empresa');
  }
  
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignData, setCampaignData] = useState<CampaignData>(INITIAL_CAMPAIGN_DATA);
  const tabsRef = useRef<TabsRef>(null);

  const [brokerClients, setBrokerClients] = useState<Cliente[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchInput, setClientSearchInput] = useState(''); // Input local para debounce
  
  // Debounce para búsqueda de clientes (150ms - más rápido)
  useEffect(() => {
    const timer = setTimeout(() => {
      setClientSearch(clientSearchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [clientSearchInput]);
  
  // Estados para voces de ElevenLabs
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedRealVoice, setSelectedRealVoice] = useState<string>('YPh7OporwNAJ28F5IQrm'); // Angie por defecto
  const [waInstances, setWaInstances] = useState<Array<{ id?: number; instance_id: string; status?: string }>>([]);

  const [triggersConfig, setTriggersConfig] = useState({
    types: {
      new_client: false,
      new_policy: false,
      policy_expiry: false,
      new_lead: false,
      new_siniestro: false,
    },
    selectedType: 'none' as string, // Tipo seleccionado: 'none' o uno de los tipos
    window: { start: '08:00', end: '18:00', tz: 'America/Bogota', days: 'mon,tue,wed,thu,fri' },
    limits: { daily_quota: 100, dedup_days: 0 },
    expiry: { before_days: '7,3,1', after_days: '1' }, // solo aplica para policy_expiry
    mapping: { phone_field: 'client.mobile_phone' }
  });


// Lista filtrada (memo) con null-safety para búsqueda rápida y sin errores en toLowerCase
// Soporta búsqueda por nombre completo (nombre + apellidos) y términos parciales
const brokerClientsFiltered = React.useMemo(() => {
  if (!clientSearch.trim()) return brokerClients;
  const searchTerms = clientSearch.toLowerCase().trim().split(/\s+/); // Dividir por espacios
  const norm = (v: any) => String(v ?? '').toLowerCase();
  
  return brokerClients.filter((client) => {
    // Crear nombre completo para búsqueda
    const fullName = `${norm(client.nombre)} ${norm(client.apellidos)}`.trim();
    const searchableFields = [
      fullName,
      norm(client.nombre),
      norm(client.apellidos),
      norm(client.celular_principal),
      norm(client.email_principal),
      norm(client.ciudad),
      norm((client as any).documento), // Documento si existe
      norm((client as any).numero_documento), // Número documento alternativo
    ].join(' ');
    
    // Todos los términos de búsqueda deben coincidir en algún campo
    return searchTerms.every(term => searchableFields.includes(term));
  });
}, [brokerClients, clientSearch]);
  // Estados para reproducción de audio
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  // Estados para el paso de ejecución de campaña
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStarted, setExecutionStarted] = useState(false);
  const [preventDuplicates, setPreventDuplicates] = useState(false);
  const [lastExecutionTime, setLastExecutionTime] = useState(0);
  
  // Estados para prueba de llamada (mini modal)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testCallName, setTestCallName] = useState('María García');
  const [testCallPhone, setTestCallPhone] = useState('');
  const [isTestingCall, setIsTestingCall] = useState(false);
  const [testCallResult, setTestCallResult] = useState<{ success: boolean; message: string; callId?: string } | null>(null);


  // Input local para evitar lag al tipear el nombre del agente (debounce)
  const [agentNameInput, setAgentNameInput] = useState<string>(campaignData.agentName);
  useEffect(() => {
    const id = setTimeout(() => {
      setCampaignData(prev => prev.agentName === agentNameInput ? prev : { ...prev, agentName: agentNameInput });
    }, 150);
    return () => clearTimeout(id);
  }, [agentNameInput]);

  // Barra de progreso ajustable (sin thumb)
  const AdjustableBar: React.FC<{
    value: number; // 0..1
    onChange: (v: number) => void;
    trackClassName?: string;
    fillClassName?: string;
    heightClassName?: string;
  }> = ({ value, onChange, trackClassName, fillClassName, heightClassName }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);

    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const computeValueFromEvent = (clientX: number) => {
      const el = containerRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return clamp(ratio);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      onChange(parseFloat(computeValueFromEvent(e.clientX).toFixed(2)));
      window.addEventListener('pointermove', handlePointerMove as any);
      window.addEventListener('pointerup', handlePointerUp as any);
      window.addEventListener('pointercancel', handlePointerUp as any);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      onChange(parseFloat(computeValueFromEvent(e.clientX).toFixed(2)));
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove as any);
      window.removeEventListener('pointerup', handlePointerUp as any);
      window.removeEventListener('pointercancel', handlePointerUp as any);
    };

    // Cleanup en unmount
    useEffect(() => {
      return () => {
        handlePointerUp();
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className={`w-full ${heightClassName || 'h-2'} ${trackClassName || 'bg-gray-200 dark:bg-gray-700'} rounded-full cursor-pointer select-none`}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
      >
        <div
          className={`${fillClassName || 'bg-primary'} h-full rounded-full transition-[width] duration-75`}
          style={{ width: `${clamp(value) * 100}%` }}
        />
      </div>
    );
  };

  // Cargar clientes del broker y voces al montar el componente
  useEffect(() => {
    loadBrokerClients();
    loadElevenLabsVoices(); // Cargar voces específicas automáticamente
    loadWhatsAppInstances();
  }, []);

  // Aplicar enabledOptions del template seleccionado automáticamente
  useEffect(() => {
    const tpl = campaignData.selectedTemplate;
    if (!tpl || !tpl.enabledOptions) return;
    
    const opts = tpl.enabledOptions;
    
    // Aplicar configuración de recolección de datos según el objetivo
    const newCollect: CollectConfig = {
      email: { enabled: opts.collectData.email, type: 'email', required: false },
      document_id: { enabled: opts.collectData.document_id, type: 'document_id', required: false },
      address: { enabled: opts.collectData.address, type: 'address', required: false }
    };
    
    // Aplicar configuración de WhatsApp según el objetivo
    const newWhatsapp = {
      enabled: opts.whatsapp.enabled,
      instance_id: campaignData.postCallTools.whatsapp.instance_id || '',
      template: opts.whatsapp.defaultTemplate || campaignData.postCallTools.whatsapp.template,
      noAnswerEnabled: campaignData.postCallTools.whatsapp.noAnswerEnabled || false,
      noAnswerTemplate: campaignData.postCallTools.whatsapp.noAnswerTemplate || 'Hola {customer_name}, intentamos comunicarnos contigo sin éxito. Por favor contáctanos para información sobre tu póliza.'
    };
    
    // Aplicar trigger recomendado según el objetivo
    const recommendedTrigger = Object.entries(opts.triggers).find(([_, enabled]) => enabled)?.[0] || 'none';
    const newTriggerTypes = {
      new_client: opts.triggers.new_client,
      new_policy: opts.triggers.new_policy,
      policy_expiry: opts.triggers.policy_expiry,
      new_lead: opts.triggers.new_lead,
      new_siniestro: opts.triggers.new_siniestro
    };
    
    // Actualizar triggers config
    setTriggersConfig(prev => ({
      ...prev,
      selectedType: recommendedTrigger,
      types: newTriggerTypes
    }));
    
    // Crear políticas de decisión por defecto según el objetivo
    const defaultPolicies: any[] = [];
    if (opts.decisionPolicies.send_payment_link) {
      defaultPolicies.push({ 
        if: { "collected_data.document_id": { exists: true } }, 
        then: [{ action: 'send_payment_link' }] 
      });
    }
    if (opts.decisionPolicies.schedule_callback) {
      defaultPolicies.push({ 
        if: { "call_outcome": { equals: "callback_requested" } }, 
        then: [{ action: 'schedule_callback' }] 
      });
    }
    
    setCampaignData(prev => ({
      ...prev,
      postCallTools: {
        ...prev.postCallTools,
        collect: newCollect,
        whatsapp: newWhatsapp
      },
      decisionPolicies: defaultPolicies.length > 0 ? defaultPolicies : prev.decisionPolicies
    }));
  }, [campaignData.selectedTemplate?.id]);

  const loadWhatsAppInstances = async () => {
    try {
      const resp = await whatsappInstanceService.getInstances();
      if (resp.success && Array.isArray(resp.data)) {
        setWaInstances(resp.data.map((i: any) => ({ id: i.id, instance_id: i.instance_id, status: i.status })));
      } else {
        setWaInstances([]);
      }
    } catch (e) {
      setWaInstances([]);
    }
  };

  // Función para cargar voces específicas de ElevenLabs
  const loadElevenLabsVoices = async () => {
    setLoadingVoices(true);
    try {
      console.log('🎵 [CampaignWizard] Cargando voces curadas...');
      
      // Voces curadas con IDs fijos (no dependen de la API)
      const curatedVoices: ElevenLabsVoice[] = [
        {
          voice_id: 'YPh7OporwNAJ28F5IQrm',
          name: 'Angie',
          language: 'es',
          labels: { accent: 'colombian', age: 'young', gender: 'female' }
        },
        {
          voice_id: 'sdxJtmxpzgSLekrYUGIu',
          name: 'Cristian sanchez',
          language: 'es',
          labels: { accent: 'colombian', age: 'middle_aged', gender: 'male' }
        },
        {
          voice_id: '86V9x9hrQds83qf7zaGn',
          name: 'Marcela - Colombian Girl',
          language: 'es',
          labels: { accent: 'colombian', age: 'young', gender: 'female' }
        },
        {
          voice_id: 'o2vbTbO3g4GrKUg7rehy',
          name: 'Sofía – Soft & Warm',
          language: 'es',
          labels: { accent: 'colombian', age: 'young', gender: 'female' }
        },
        {
          voice_id: '3Fx71T889APcHRu4VtQf',
          name: 'Andrea',
          language: 'es',
          labels: { accent: 'latin american', age: 'young', gender: 'female' }
        },
        {
          voice_id: 'ucWwAruuGtBeHfnAaKcJ',
          name: 'JuanRestrepoPro',
          language: 'es',
          labels: { accent: 'colombian', age: 'young', gender: 'male' }
        },
        {
          voice_id: 'SplyIQAjgy4DKGAnOrHi',
          name: 'Medellin - Colombian Voice',
          language: 'es',
          labels: { accent: 'latin american', age: 'young', gender: 'female' }
        }
      ];
      
      console.log('✅ [CampaignWizard] Voces curadas cargadas:', curatedVoices.length);
      setElevenLabsVoices(curatedVoices);
      
      // Seleccionar Angie por defecto
      setSelectedRealVoice('YPh7OporwNAJ28F5IQrm');
    } catch (error) {
      console.error('❌ [CampaignWizard] Error cargando voces:', error);
    } finally {
      setLoadingVoices(false);
    }
  };

  // Función helper para reemplazar variables con datos de prueba
  const replaceVariablesWithSampleData = (text: string, voiceName?: string): string => {
    return text
      .replace(/\{customer_name\}/gi, 'María García')
      .replace(/\{client_name\}/gi, 'María García')
      .replace(/\{nombre\}/gi, 'María')
      .replace(/\{apellido\}/gi, 'García')
      .replace(/\{nombre_cliente\}/gi, 'María García')
      .replace(/\{policy_number\}/gi, 'POL-2024-001234')
      .replace(/\{numero_poliza\}/gi, 'POL-2024-001234')
      .replace(/\{placa\}/gi, 'ABC123')
      .replace(/\{plate\}/gi, 'ABC123')
      .replace(/\{vehicle_plate\}/gi, 'ABC123')
      .replace(/\{company_name\}/gi, tenant?.name || 'Seguros Ejemplo')
      .replace(/\{nombre_empresa\}/gi, tenant?.name || 'Seguros Ejemplo')
      .replace(/\{agent_name\}/gi, campaignData.agentName || voiceName || 'Angie')
      .replace(/\{nombre_agente\}/gi, campaignData.agentName || voiceName || 'Angie')
      .replace(/\{amount\}/gi, '$150.000')
      .replace(/\{monto\}/gi, '$150.000')
      .replace(/\{fecha_vencimiento\}/gi, '15 de febrero de 2026')
      .replace(/\{expiry_date\}/gi, '15 de febrero de 2026')
      .replace(/\{producto\}/gi, 'Seguro de Auto')
      .replace(/\{product\}/gi, 'Seguro de Auto')
      .replace(/\{telefono\}/gi, '300 123 4567')
      .replace(/\{phone\}/gi, '300 123 4567')
      .replace(/\{email\}/gi, 'maria@ejemplo.com');
  };

  // Función para reproducir muestra de voz
  const playVoiceSample = async (voiceId: string, voiceName: string) => {
    try {
      // Si ya hay audio reproduciéndose, detenerlo
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
        setPlayingVoice(null);
      }

      // Si es la misma voz que ya está reproduciéndose, solo detener
      if (playingVoice === voiceId) {
        return;
      }

      setPlayingVoice(voiceId);
      console.log(`🎵 [CampaignWizard] Reproduciendo muestra de voz: ${voiceName} (${voiceId})`);

      // Texto de ejemplo en español - reemplazar variables con datos de prueba
      const rawText = campaignData.customFirstMessage || campaignData.selectedTemplate?.firstMessageTemplate || 
        "Hola, esta es una muestra de mi voz. Soy un asistente virtual y puedo ayudarte con diferentes tareas. ¿En qué puedo asistirte hoy?";
      
      // Usar función helper para reemplazar variables
      const sampleText = replaceVariablesWithSampleData(rawText, voiceName);

      // Obtener audio desde ElevenLabs con configuraciones personalizadas
      const voiceSettings = {
        stability: campaignData.voiceSettings.stability,
        similarity_boost: campaignData.voiceSettings.similarityBoost,
        style: campaignData.voiceSettings.style,
        use_speaker_boost: campaignData.voiceSettings.speakerBoost
      };
      
      const audioBuffer = await testVoice(voiceId, sampleText, undefined, voiceSettings);
      
      // Crear blob y URL para reproducir
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Crear elemento de audio y reproducir
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      // Configurar eventos del audio
      audio.onended = () => {
        setPlayingVoice(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl); // Limpiar memoria
      };
      
      audio.onerror = (error) => {
        console.error('❌ [CampaignWizard] Error reproduciendo audio:', error);
        setPlayingVoice(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      // Reproducir el audio
      await audio.play();
      console.log('✅ [CampaignWizard] Audio reproduciéndose correctamente');
      
    } catch (error) {
      console.error('❌ [CampaignWizard] Error al generar/reproducir muestra de voz:', error);
      setPlayingVoice(null);
      setCurrentAudio(null);
    }
  };

  // Función auxiliar para obtener información de voz seleccionada (solo voces reales)
  const getSelectedVoiceInfo = () => {
    const realVoice = elevenLabsVoices.find(v => v.voice_id === selectedRealVoice);
    return realVoice ? {
      id: realVoice.voice_id,
      name: realVoice.name,
      gender: realVoice.labels?.gender || 'unknown',
      accent: realVoice.labels?.accent || realVoice.language,
      description: realVoice.labels?.description || 'Voz de ElevenLabs'
    } : null;
  };



  // Sincronizar el tab activo cuando cambia currentStep
  useEffect(() => {
    if (tabsRef.current && currentStep > 0) {
      tabsRef.current.setActiveTab(currentStep - 1);
    }
  }, [currentStep]);

  // Limpiar audio al desmontar el componente
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingVoice(null);
      }
    };
  }, [currentAudio]);

  // Bloquear scroll del body mientras la modal esté abierta
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const loadBrokerClients = async () => {
    setLoadingClients(true);
    try {
      console.log('🔄 [CampaignWizard] Cargando clientes del broker...');
      const response = await clienteService.getAllClientes();
      
      console.log('📊 [CampaignWizard] Response received:', response);
      
      if (response.success && response.data) {
        console.log('📋 [CampaignWizard] Total clientes recibidos:', response.data.length);
        console.log('🔍 [CampaignWizard] Primeros 3 clientes:', response.data.slice(0, 3));
        
        // Filtrar clientes con celular (temporalmente mostrar TODOS para debug)
        const activeClients = response.data.filter(client => {
          const hasPhone = !!client.celular_principal;
          
          console.log(`🔍 [CampaignWizard] Cliente ${client.nombre}: estado="${client.estado}", celular="${client.celular_principal}", válido=${hasPhone}`);
          
          // Por ahora mostrar todos los que tengan teléfono sin importar estado
          return hasPhone;
        });
        
        console.log(`✅ [CampaignWizard] Clientes válidos filtrados: ${activeClients.length} de ${response.data.length} totales`);
        setBrokerClients(activeClients);
      } else {
        console.warn('⚠️ [CampaignWizard] No se encontraron clientes:', response.message);
        setBrokerClients([]);
      }
    } catch (error) {
      console.error('❌ [CampaignWizard] Error loading broker clients:', error);
      setBrokerClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  // Funciones de navegación
  const nextStep = () => {
    if (isStepComplete(currentStep)) {
      const newStep = Math.min(currentStep + 1, STEPS.length);
      setCurrentStep(newStep);
      if (tabsRef.current) {
        tabsRef.current.setActiveTab(newStep - 1);
      }
    }
  };
  
  const prevStep = () => {
    const newStep = Math.max(currentStep - 1, 1);
    setCurrentStep(newStep);
    if (tabsRef.current) {
      tabsRef.current.setActiveTab(newStep - 1);
    }
  };

  // Función para verificar si un paso está completo
  const isStepComplete = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1: return !!campaignData.selectedTemplate;
      case 2: return !!campaignData.selectedTemplate && !!selectedRealVoice;
      case 3: return !!campaignData.agentName.trim();
      case 4: return !campaignData.voicemailConfig.enabled || !!campaignData.voicemailConfig.message.trim(); // Herramientas (opcional), pero si se habilita buzon de voz, se debe configurar el mensaje
      case 5: {
        // Clientes: opcional si hay triggers configurados
        const triggers = buildTriggersPayload();
        return triggers.length > 0 || campaignData.selectedContacts.length > 0;
      }
      case 6: {
        const triggers = buildTriggersPayload();
        const hasBasicConfig = !!campaignData.selectedTemplate && !!campaignData.agentName.trim() && !!selectedRealVoice;
        // Si hay triggers, no requiere clientes. Si no hay triggers, sí requiere clientes.
        return hasBasicConfig && (triggers.length > 0 || campaignData.selectedContacts.length > 0);
      }
      default: return false;
    }
  };

  // Función para obtener mensaje de validación
  const getValidationMessage = (stepNumber: number): string => {
    switch (stepNumber) {
      case 1: 
        if (!campaignData.selectedTemplate) return "Selecciona un agente especializado";
        return "";
      case 2: 
        if (!campaignData.selectedTemplate) return "Primero debes seleccionar un agente";
        if (!selectedRealVoice) return "Selecciona una voz para el agente";
        return "";
      case 3: 
        if (!campaignData.selectedTemplate || !selectedRealVoice) return "Completa los pasos anteriores";
        if (!campaignData.agentName.trim()) return "Define el nombre con el que se presentará el agente";
        return "";
      case 4:
        if (campaignData.voicemailConfig.enabled && !campaignData.voicemailConfig.message.trim()) return "Ingresa el mensaje para el buzón de voz";
        return ""; // Herramientas es opcional, pero si se habilita buzon de voz, se debe configurar el mensaje
      case 5: {
        const triggers = buildTriggersPayload();
        if (triggers.length === 0 && campaignData.selectedContacts.length === 0) {
          return "Selecciona clientes o configura disparadores automáticos";
        }
        return "";
      }
      case 6: {
        if (!campaignData.selectedTemplate || !campaignData.agentName.trim() || !selectedRealVoice) {
          return "Completa la configuración del agente y voz";
        }
        const triggers = buildTriggersPayload();
        if (triggers.length === 0 && campaignData.selectedContacts.length === 0) {
          return "Selecciona clientes o configura disparadores";
        }
        return "";
      }
      default: return "";
    }
  };

  // Componente Paso 1: Selección de Agente
  const renderAgentSelection = () => {
    const categorizedTemplates = {
      cobranza: getAgentTemplatesByCategory('cobranza'),
      ventas: getAgentTemplatesByCategory('ventas'),
      servicio: getAgentTemplatesByCategory('servicio'),
      retencion: getAgentTemplatesByCategory('retencion')
    };

    // Etiquetas de categoría eliminadas (diseño actual no las muestra)

    const handleTemplateSelect = (template: AgentTemplate) => {
      setCampaignData(prev => ({
        ...prev,
        selectedTemplate: template,
        // No autocompletar nombre; se define en Paso 2 (Voz)
        customPrompt: template.systemPrompt,
        customFirstMessage: template.firstMessageTemplate,
        voiceSettings: template.voiceSettings
      }));
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Grid compacto de agentes - ordenados: disponibles primero */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {AGENT_TEMPLATES
            .slice()
            .sort((a, b) => (b.available ? 1 : 0) - (a.available ? 1 : 0))
            .map((tpl) => (
              <Card
                key={tpl.id}
                className={`rounded-xl border transition-colors ${
                  !tpl.available 
                    ? 'border-gray-200 opacity-60 cursor-not-allowed' 
                    : campaignData.selectedTemplate?.id === tpl.id 
                      ? 'ring-2 ring-blue-500 border-blue-300' 
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-4">
                  {/* Fila 1: icono + botón */}
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${!tpl.available ? 'bg-gray-50' : 'bg-gray-100'}`}>
                      <Icon
                        icon={
                          tpl.id.includes('claim')
                            ? 'solar:danger-triangle-bold-duotone'
                            : tpl.id.includes('lead')
                              ? 'solar:user-circle-bold-duotone'
                              : tpl.id.includes('welcome')
                                ? 'solar:users-group-two-rounded-bold-duotone'
                                : tpl.category === 'cobranza'
                                  ? 'solar:wallet-money-bold-duotone'
                                  : tpl.category === 'ventas'
                                    ? 'solar:target-bold-duotone'
                                    : tpl.category === 'servicio'
                                      ? 'solar:headphones-round-sound-bold-duotone'
                                      : 'solar:refresh-bold-duotone'
                        }
                        className={`w-6 h-6 ${!tpl.available ? 'text-gray-400' : 'text-gray-700'}`}
                      />
                  </div>
                    {tpl.available ? (
                      <Button
                        size="sm"
                        color={campaignData.selectedTemplate?.id === tpl.id ? 'primary' : 'gray'}
                        onClick={() => handleTemplateSelect(tpl)}
                      >
                        {campaignData.selectedTemplate?.id === tpl.id ? 'Seleccionado' : 'Seleccionar'}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md">
                        <Icon icon="solar:lock-bold" className="w-3 h-3 mr-1" />
                        Bloqueado
                      </span>
                    )}
                  </div>
                  {/* Fila 2: título + descripción */}
                  <div className="mt-3">
                    <h4 className={`font-medium ${!tpl.available ? 'text-gray-500' : 'text-gray-900'}`}>{tpl.name}</h4>
                    <p className={`text-sm mt-1 whitespace-pre-wrap ${!tpl.available ? 'text-gray-400' : 'text-gray-600'}`}>
                      {!tpl.available ? tpl.unavailableMessage : tpl.description}
                    </p>
                    </div>
                </div>
              </Card>
            ))}
        </div>

        {/* Campo de nombre del agente movido al Paso 2 (diseño compacto) */}

        {/* Panel de detalles del agente seleccionado - eliminado por diseño compacto */}


      </div>
    );
  };

  // Componente Paso 2: Configuración de Voz
  const renderVoiceConfiguration = () => {
    if (!campaignData.selectedTemplate) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600">Selecciona primero un agente en el paso anterior</p>
        </div>
      );
    }


    return (
      <div className="flex flex-col gap-6">
        {/* Selección de voces específicas de ElevenLabs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Seleccionar Voz del Agente</h3>
            <Button 
              size="sm" 
              color="info"
              onClick={loadElevenLabsVoices}
              disabled={loadingVoices}
            >
              {loadingVoices ? (
                <>
                  <Icon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Icon icon="solar:refresh-outline" className="w-4 h-4 mr-2" />
                  Recargar Voces
                </>
              )}
            </Button>
          </div>

          {loadingVoices ? (
            <div className="text-center py-8">
              <Icon icon="solar:refresh-circle-outline" className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-gray-600 dark:text-gray-400">Cargando voces específicas de ElevenLabs...</p>
            </div>
          ) : elevenLabsVoices.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(() => {
                const normalize = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '');
                const toDisplay = (name: string) => {
                  const n = normalize(name);
                  if (n.includes('angie')) return 'Angie';
                  if (n.includes('cristian') && n.includes('sanchez')) return 'Cristián Sánchez';
                  if (n.includes('marcela')) return 'Marcela';
                  if (n.includes('sof')) return 'Sofía';
                  if (n.includes('andrea')) return 'Andrea';
                  if (n.includes('juanrestrepopro') || (n.includes('juan') && n.includes('restrepo'))) return 'Juan Restrepo';
                  if (n.includes('medellin')) return 'Mariana';
                  return name;
                };
                const preferredDescriptions: Record<string, string> = {
                  Angie: 'Español colombiano, femenina joven, voz ultrarealista y natural. ⭐ Recomendada',
                  'Cristián Sánchez': 'Español colombiano, masculino mediana edad, serio y confiable.',
                  Marcela: 'Español colombiano, femenina joven, cálida y cercana.',
                  Sofía: 'Español colombiano, femenina joven con tono suave y acogedor.',
                  Andrea: 'Español latino, femenina joven, expresiva y dinámica.',
                  'Juan Restrepo': 'Español colombiano, masculino joven, tono directo y claro.',
                  Mariana: 'Español latino, femenina joven con tono claro y natural.'
                };
                const priority: Record<string, number> = {
                  Angie: 0,
                  'Cristián Sánchez': 1,
                  Marcela: 2,
                  Sofía: 3,
                  Andrea: 4,
                  'Juan Restrepo': 5,
                  Mariana: 999
                };
                const items = elevenLabsVoices.map((voice) => {
                  const displayName = toDisplay(voice.name);
                  let photoSrc = real1;
                  if (displayName === 'Angie') photoSrc = real2;
                  else if (displayName === 'Andrea') photoSrc = real5;
                  else if (displayName === 'Juan Restrepo') photoSrc = real6;
                  else if (displayName === 'Mariana') photoSrc = real7;
                  else if (displayName === 'Cristián Sánchez') photoSrc = real1;
                  else if (displayName === 'Marcela') photoSrc = real3;
                  else if (displayName === 'Sofía') photoSrc = real4;
                  return {
                    voice,
                    displayName,
                    photoSrc,
                    description: preferredDescriptions[displayName] || voice.labels?.description || voice.labels?.accent || voice.labels?.language || voice.language,
                    sort: priority[displayName] ?? 500
                  };
                }).sort((a, b) => a.sort - b.sort);
                return items.map(({ voice, displayName, photoSrc, description }) => {
                  const isSelected = selectedRealVoice === voice.voice_id;
                  return (
                <Card
                  key={voice.voice_id}
                      className={`rounded-xl border border-gray-200 hover:border-gray-300 transition-colors ${
                        isSelected ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedRealVoice(voice.voice_id)}
                >
                  <div className="p-4">
                        <div className="w-full flex items-center justify-center">
                          <img src={photoSrc} alt={displayName} className="w-16 h-16 rounded-full object-cover border" loading="lazy" />
                      </div>
                        <div className="mt-2 text-center">
                          <h4 className="font-medium text-gray-900 dark:text-white">{displayName}</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">{description}</p>
                        <div className="mt-3 flex justify-center gap-2">
                    <Button 
                      size="sm"
                            color={playingVoice === voice.voice_id ? 'success' : 'gray'}
                      onClick={(e) => {
                        e.stopPropagation();
                              playVoiceSample(voice.voice_id, displayName);
                      }}
                      disabled={playingVoice !== null && playingVoice !== voice.voice_id}
                    >
                            <Icon icon="solar:play-bold-duotone" className="w-4 h-4 mr-1" />
                            {playingVoice === voice.voice_id ? 'Reproduciendo...' : 'Probar'}
                    </Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRealVoice(voice.voice_id); }}>
                            {isSelected ? 'Seleccionada' : 'Usar'}
                          </Button>
                      </div>
                  </div>
                </Card>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="text-center py-8">
              <Icon icon="solar:ghost-outline" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No se pudieron cargar las voces específicas
              </p>
              <Button size="sm" color="primary" onClick={loadElevenLabsVoices}>
                <Icon icon="solar:refresh-outline" className="w-4 h-4 mr-2" />
                Intentar de Nuevo
              </Button>
            </div>
          )}
        </div>

        {/* Panel de configuración y vista previa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parámetros de voz */}
          <Card>
            <div className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:settings-minimalistic-outline" className="w-5 h-5 text-primary" />
                Ajustar Parámetros
              </h4>
              
              {/* Presets rápidos */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Presets Recomendados:</p>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    size="xs" 
                    color="info"
                    onClick={() => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { stability: 0.3, similarityBoost: 0.5, style: 0.8, speakerBoost: true }
                    }))}
                  >
                    <Icon icon="solar:chat-square-outline" className="w-3 h-3 mr-1" /> Conversacional
                  </Button>
                  <Button 
                    size="xs" 
                    color="success"
                    onClick={() => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { stability: 0.4, similarityBoost: 0.6, style: 0.7, speakerBoost: true }
                    }))}
                  >
                    <Icon icon="solar:star-shine-outline" className="w-3 h-3 mr-1" /> Equilibrado
                  </Button>
                  <Button 
                    size="xs" 
                    color="gray"
                    onClick={() => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { stability: 0.6, similarityBoost: 0.7, style: 0.4, speakerBoost: true }
                    }))}
                  >
                    <Icon icon="solar:target-outline" className="w-3 h-3 mr-1" /> Profesional
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estabilidad
                    </label>
                    <Badge color="info" size="sm">
                      {campaignData.voiceSettings.stability}
                    </Badge>
                  </div>
                  <AdjustableBar
                    value={campaignData.voiceSettings.stability}
                    onChange={(v) => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { ...prev.voiceSettings, stability: v }
                    }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Menor = más natural y expresiva | Mayor = más consistente
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Similitud
                    </label>
                    <Badge color="info" size="sm">
                      {campaignData.voiceSettings.similarityBoost}
                    </Badge>
                  </div>
                  <AdjustableBar
                    value={campaignData.voiceSettings.similarityBoost}
                    onChange={(v) => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { ...prev.voiceSettings, similarityBoost: v }
                    }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Menor = más creativa | Mayor = más fiel al modelo
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estilo
                    </label>
                    <Badge color="success" size="sm">
                      {campaignData.voiceSettings.style}
                    </Badge>
                  </div>
                  <AdjustableBar
                    value={campaignData.voiceSettings.style}
                    onChange={(v) => setCampaignData(prev => ({
                      ...prev,
                      voiceSettings: { ...prev.voiceSettings, style: v }
                    }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Menor = monotona | Mayor = más expresiva y humana
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* (Contenido de herramientas movido a paso dedicado) */}

          {/* Vista previa del mensaje */}
          <Card>
            <div className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:eye-outline" className="w-5 h-5 text-primary" />
                Vista Previa
              </h4>
              
              <div className="flex flex-col gap-4">
                {/* Avatar y nombre del agente */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {(() => {
                    const voiceInfo = getSelectedVoiceInfo();
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          (voiceInfo?.gender === 'Femenino' || voiceInfo?.gender === 'female')
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        }`}>
                          {voiceInfo?.name?.substring(0, 1) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {campaignData.selectedTemplate?.agentPersona.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Voz: {voiceInfo?.name || 'No seleccionada'}
                            <Badge color="success" size="xs" className="ml-2">ElevenLabs</Badge>
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {/* Mensaje de ejemplo - con datos de prueba */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-sm italic text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                    "{replaceVariablesWithSampleData(campaignData.customFirstMessage || campaignData.selectedTemplate.firstMessageTemplate, getSelectedVoiceInfo()?.name)}"
                  </p>
                  <Button 
                    size="sm" 
                    color={playingVoice === selectedRealVoice ? "success" : "primary"} 
                    className="w-full"
                    onClick={() => {
                      const voiceInfo = getSelectedVoiceInfo();
                      if (voiceInfo) {
                        playVoiceSample(selectedRealVoice, voiceInfo.name);
                      }
                    }}
                    disabled={!selectedRealVoice}
                  >
                    <Icon 
                      icon={playingVoice === selectedRealVoice ? "solar:pause-circle-outline" : "solar:play-circle-outline"} 
                      className={`w-4 h-4 mr-2 ${playingVoice === selectedRealVoice ? 'animate-pulse' : ''}`} 
                    />
                    {playingVoice === selectedRealVoice ? 'Reproduciendo...' : `Probar con ${getSelectedVoiceInfo()?.name || 'voz seleccionada'}`}
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  * Este mensaje será personalizado automáticamente para cada cliente
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // Componente Paso 3: Presentación (Nombre del Agente)
  const renderAgentPresentation = () => {
    if (!campaignData.selectedTemplate) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600">Primero selecciona un agente y una voz</p>
        </div>
      );
    }
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-md">
          <Card>
            <div className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2 text-center">
                <Icon icon="solar:user-speak-outline" className="w-5 h-5 text-primary" />
                Nombre de Presentación
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Cómo se presentará el agente</label>
                  {!campaignData.agentName.trim() && (
                    <Badge color="failure" size="xs">Obligatorio</Badge>
                  )}
                </div>
                <TextInput
                  placeholder={`Ej: ${campaignData.selectedTemplate.agentPersona.name} de ${campaignData.selectedTemplate.category}`}
                  value={agentNameInput}
                  onChange={(e) => setAgentNameInput(e.target.value)}
                  sizing="md"
                  color={agentNameInput.trim() ? 'gray' : 'failure'}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 text-center">
                  <Icon icon="solar:info-circle-outline" className="w-3.5 h-3.5" />
                  <span>
                    Ejemplo: “Hola, soy {campaignData.agentName || '[Nombre del Agente]'} de tu compañía de seguros.”
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // Componente Paso 3: Selección Simplificada de Clientes
  const renderClientSelection = () => {
    // Lista filtrada (memoizada a nivel de componente con null-safety)
    const filteredClients = brokerClientsFiltered;

    const handleClientToggle = (client: Cliente) => {
      setCampaignData(prev => {
        const isSelected = prev.selectedContacts.some(c => c.id === client.id);
        if (isSelected) {
          return {
            ...prev,
            selectedContacts: prev.selectedContacts.filter(c => c.id !== client.id)
          };
        } else {
          return {
            ...prev,
            selectedContacts: [...prev.selectedContacts, client]
          };
        }
      });
    };

    const selectAll = () => {
      setCampaignData(prev => ({
        ...prev,
        selectedContacts: [...prev.selectedContacts, ...filteredClients.filter(client => 
          !prev.selectedContacts.some(selected => selected.id === client.id)
        )]
      }));
    };

    const clearAll = () => {
      setCampaignData(prev => ({
        ...prev,
        selectedContacts: []
      }));
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Header súper compacto: Seleccionar Audiencia */}
        <Card className="border-primary/20">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon icon="solar:users-group-two-rounded-outline" className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold truncate">Seleccionar Audiencia</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {loadingClients ? 'Cargando...' : `${brokerClients.length} disponibles`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm"
                  color="primary"
                  onClick={selectAll} 
                  disabled={loadingClients || filteredClients.length === 0}
                >
                  <Icon icon="solar:users-group-two-rounded-outline" className="w-4 h-4 mr-1" />
                  {clientSearch.trim() ? `Filtrados (${filteredClients.length})` : 'Todos'}
                </Button>
                <Button 
                  size="sm"
                  color="gray"
                  onClick={clearAll}
                >
                  <Icon icon="solar:trash-bin-minimalistic-outline" className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Contenido principal */}
        {loadingClients ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Icon icon="solar:refresh-circle-outline" className="w-8 h-8 animate-spin mr-3" />
              <span className="text-lg text-gray-600 dark:text-gray-400">Cargando clientes...</span>
            </div>
          </Card>
        ) : brokerClients.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Icon icon="solar:users-group-two-rounded-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                No se encontraron clientes válidos
              </h4>
              <p className="text-sm text-gray-500">
                Asegúrate de tener clientes con número de celular registrado
              </p>
              <div className="mt-4 text-xs text-gray-400">
                Debug: loadingClients={loadingClients.toString()}, brokerClients.length={brokerClients.length}
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de clientes */}
            <div className="lg:col-span-2">
              <Card>
                <div className="p-4 border-b border-ld">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Icon icon="solar:list-check-outline" className="w-5 h-5 text-primary" />
                      Lista de Clientes ({filteredClients.length})
                    </h4>
                  </div>
                  
                  {/* Campo de búsqueda */}
                  <div className="mb-2">
                    <TextInput
                      type="text"
                      placeholder="Buscar por nombre, teléfono, email o ciudad..."
                      value={clientSearchInput}
                      onChange={(e) => setClientSearchInput(e.target.value)}
                      icon={() => <Icon icon="solar:magnifer-outline" className="w-4 h-4" />}
                      sizing="sm"
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Haz clic para seleccionar/deseleccionar clientes
                  </p>
                </div>
                <div className="p-4">
                  <div className="max-h-64 overflow-y-auto">
                    {filteredClients.length === 0 && clientSearch.trim() ? (
                      <div className="text-center py-8">
                        <Icon icon="solar:magnifer-outline" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No se encontraron clientes que coincidan con "{clientSearch}"
                        </p>
                        <Button 
                          size="sm" 
                          color="gray" 
                          onClick={() => { setClientSearchInput(''); setClientSearch(''); }}
                          className="mt-2"
                        >
                          Limpiar búsqueda
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 sticky top-0 z-10">
                          <div className="col-span-7">Cliente</div>
                          <div className="col-span-4">Contacto</div>
                          <div className="col-span-1 text-right">Estado</div>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredClients.map((client) => {
                        const isSelected = campaignData.selectedContacts.some(c => c.id === client.id);
                            const firstInitial = (client.nombre || '').charAt(0).toUpperCase();
                            const secondInitial = (client.apellidos || '').charAt(0).toUpperCase();
                            const initials = `${firstInitial}${secondInitial || ''}`;
                        return (
                              <button
                                type="button"
                            key={client.id}
                                className={`w-full text-left px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                  isSelected ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => handleClientToggle(client)}
                          >
                                <div className={`grid grid-cols-12 items-center ${isSelected ? 'border-l-2 border-primary' : ''}`}>
                                  {/* Cliente */}
                                  <div className="col-span-7 flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                                      {initials || 'CL'}
                                </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {client.nombre} {client.apellidos}
                                </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {client.email_principal || 'Sin email'}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Contacto */}
                                  <div className="col-span-4">
                                    <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                                      <Icon icon="solar:phone-outline" className="w-4 h-4" />
                                      <span className="truncate">{client.celular_principal}</span>
                                    </div>
                                  </div>
                                  {/* Estado */}
                                  <div className="col-span-1 flex justify-end">
                                <Badge color={isSelected ? 'info' : 'gray'} size="sm">
                                      {isSelected ? 'Selec.' : 'Disp.'}
                                </Badge>
                              </div>
                            </div>
                              </button>
                        );
                      })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Panel de resumen */}
            <div className="space-y-6">
              {/* Estadísticas de selección */}
              <Card>
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icon icon="solar:chart-2-outline" className="w-5 h-5 text-primary" />
                    Resumen de Selección
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total disponibles:</span>
                      <Badge color="gray" size="sm">{brokerClients.length}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Seleccionados:</span>
                      <Badge color="info" size="sm">{campaignData.selectedContacts.length}</Badge>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-primary h-3 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${brokerClients.length > 0 ? (campaignData.selectedContacts.length / brokerClients.length) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    
                    {campaignData.selectedContacts.length > 0 && (
                      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon icon="solar:target-outline" className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-300">
                              Campaña Preparada
                            </span>
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-400">
                            Se realizarán <strong>{campaignData.selectedContacts.length}</strong> llamadas
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </Card>

              {/* Vista previa de seleccionados */}
              {campaignData.selectedContacts.length > 0 && (
                <Card>
                  <div className="p-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Icon icon="solar:eye-outline" className="w-5 h-5 text-primary" />
                      Clientes Seleccionados
                    </h4>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                      {campaignData.selectedContacts.slice(0, 6).map((contact) => (
                        <div key={contact.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          <span className="text-sm truncate font-medium">
                            {contact.nombre} {contact.apellidos}
                          </span>
                        </div>
                      ))}
                      {campaignData.selectedContacts.length > 6 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                          +{campaignData.selectedContacts.length - 6} clientes más...
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Función para generar nombre de campaña (movida para ser accesible globalmente)
  const generateCampaignName = () => {
    if (!campaignData.selectedTemplate) return '';
    const timestamp = new Date().toLocaleDateString('es-ES');
    return `Campaña ${campaignData.selectedTemplate.category} - ${timestamp}`;
  };

  const buildTriggersPayload = (): VoiceCampaignTriggerInput[] => {
    // Si selectedType es 'none' o vacío, retornar array vacío
    if (triggersConfig.selectedType === 'none' || triggersConfig.selectedType === '') {
      return [];
    }
    
    // Venta Cruzada no usa triggers automáticos - requiere selección manual de clientes
    if (campaignData.selectedTemplate?.id === 'cross_sell') {
      return [];
    }

    const parseCsvNums = (s: string): number[] =>
      (s || '')
        .split(',')
        .map(x => x.trim())
        .filter(x => x !== '')
        .map(x => parseInt(x, 10))
        .filter(n => !Number.isNaN(n));

    const windowDays = (triggersConfig.window.days || '')
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    const baseTrigger: Omit<VoiceCampaignTriggerInput, 'type'> = {
      enabled: true,
      window_config: {
        start: triggersConfig.window.start,
        end: triggersConfig.window.end,
        tz: triggersConfig.window.tz,
        days: windowDays.length ? windowDays : ['mon','tue','wed','thu','fri']
      },
      limits: {
        daily_quota: Number(triggersConfig.limits.daily_quota) || 0,
        dedup_days: Number(triggersConfig.limits.dedup_days) || 0
      },
      mapping: {
        phone_field: triggersConfig.mapping.phone_field || 'client.mobile_phone'
      }
    };

    const triggers: VoiceCampaignTriggerInput[] = [];
    (Object.keys(triggersConfig.types) as Array<keyof typeof triggersConfig.types>).forEach((key) => {
      if (triggersConfig.types[key]) {
        if (key === 'policy_expiry') {
          triggers.push({
            type: 'policy_expiry',
            ...baseTrigger,
            expiry_offsets: {
              before_days: parseCsvNums(triggersConfig.expiry.before_days),
              after_days: parseCsvNums(triggersConfig.expiry.after_days)
            }
          });
        } else {
          triggers.push({ type: key as any, ...baseTrigger });
        }
      }
    });

    return triggers;
  };

  // Función para ejecutar llamada de prueba
  const handleTestCall = async () => {
    if (!testCallPhone || testCallPhone.length < 10) {
      setTestCallResult({ success: false, message: 'Ingresa un número de teléfono válido (mínimo 10 dígitos)' });
      return;
    }
    
    setIsTestingCall(true);
    setTestCallResult(null);
    
    try {
      const voiceId = selectedRealVoice || 'YPh7OporwNAJ28F5IQrm';
      
      // Preparar datos de prueba basados en el objetivo
      const testContact = {
        name: testCallName,
        phone: testCallPhone.replace(/\D/g, ''),
        custom_data: {
          customer_name: testCallName,
          nombre: testCallName.split(' ')[0],
          apellido: testCallName.split(' ').slice(1).join(' ') || 'García',
          policy_number: 'POL-TEST-' + Date.now().toString().slice(-6),
          placa: 'TEST123',
          producto: 'Seguro de Prueba',
          monto: '$100.000',
          fecha_vencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO'),
        }
      };
      
      // Obtener el mensaje de voz con variables reemplazadas
      const voiceMessageTemplate = replaceVariablesWithSampleData(
        campaignData.customFirstMessage || campaignData.selectedTemplate?.firstMessageTemplate || 'Hola, esta es una llamada de prueba.',
        testCallName
      );
      
      const response = await voiceCampaignService.createImmediateVoiceCampaign({
        name: `Prueba - ${campaignData.selectedTemplate?.name || 'Test'} - ${new Date().toLocaleTimeString()}`,
        description: 'Llamada de prueba desde el wizard',
        priority: 'high',
        contacts: [testContact],
        agent_name: campaignData.agentName || campaignData.selectedTemplate?.agentPersona.name || 'Agente de Prueba',
        voice_message_template: voiceMessageTemplate,
        elevenlabs_voice_id: voiceId,
        settings: {
          voice_settings: campaignData.voiceSettings,
          system_prompt: campaignData.customPrompt || campaignData.selectedTemplate?.systemPrompt,
          first_message: voiceMessageTemplate,
        }
      });
      
      if (response.success) {
        setTestCallResult({ 
          success: true, 
          message: `¡Llamada de prueba iniciada! Se está llamando a ${testCallName} al ${testCallPhone}`,
          callId: response.campaign?.id 
        });
      } else {
        setTestCallResult({ success: false, message: response.message || 'Error al iniciar la llamada de prueba' });
      }
    } catch (error: any) {
      console.error('Error en llamada de prueba:', error);
      setTestCallResult({ success: false, message: error.message || 'Error al ejecutar la llamada de prueba' });
    } finally {
      setIsTestingCall(false);
    }
  };

  // Función para ejecutar campaña (movida para ser accesible globalmente)
  const handleExecuteCampaign = async () => {
      const currentTime = Date.now();
      
      // 🔥 PREVENIR DOBLES CLICS Y EJECUCIONES DUPLICADAS
      if (isExecuting || preventDuplicates || executionStarted) {
        console.log('⚠️ [CampaignWizard] Execution prevented - already in progress or completed');
        return;
      }
      
      // Debouncing adicional: evitar múltiples llamadas en menos de 2 segundos
      if (currentTime - lastExecutionTime < 2000) {
        console.log('⚠️ [CampaignWizard] Execution prevented - debouncing (< 2 seconds)');
        return;
      }
      
      console.log('🚀 [CampaignWizard] Starting campaign execution...', {
        timestamp: new Date().toISOString(),
        contactsCount: campaignData.selectedContacts.length,
        templateId: campaignData.selectedTemplate?.id
      });
      
      setIsExecuting(true);
      setPreventDuplicates(true); // Bloquear inmediatamente
      setLastExecutionTime(currentTime); // Actualizar timestamp
      
      try {
        if (!campaignData.selectedTemplate) {
          throw new Error('No se ha seleccionado un agente');
        }

        // Preparar datos de la campaña para el servicio de voice campaigns
        const campaignName = campaignData.campaignName || generateCampaignName();
        
        // Convertir clientes al formato esperado por el backend Laravel
        // Requisitos: phone_number y opcionalmente custom_data
        const contacts = campaignData.selectedContacts.map(client => {
          const fullName = `${client.nombre} ${client.apellidos}`.trim();
          const companyName = (campaignData.customVariables?.company_name || tenant?.branding?.nombre_comercial || tenant?.name || tenant?.nombre || 'Tu agencia de seguros');
          const policyNumber = (campaignData.customVariables?.policy_number || 'uno, dos, veinticinco,catorce, once');
          const debtAmount = Number(campaignData.customVariables?.debt_amount) || 'Ciento cincuenta mil pesos';
          const dueDate =
            campaignData.customVariables?.payment_due_date ||
            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          return {
            name: fullName,
            phone: client.celular_principal,
            custom_data: {
              // Datos de contacto
              email: client.email_principal,
              city: client.ciudad,
              first_name: client.nombre,
              last_name: client.apellidos,
              client_id: client.id,
              // Variables dinámicas críticas para ElevenLabs
              customer_name: fullName,
              company_name: companyName,
              policy_number: policyNumber,
              debt_amount: debtAmount,
              payment_due_date: dueDate
            }
          };
        });
        
        // Mapear template ID a agent_id real de ElevenLabs
        const getAgentIdForTemplate = (templateId: string): string => {
          const agentMapping: Record<string, string> = {
            // Cobranzas - usar Marcela
            'payment_reminder': 'agent_01k02pehqgfywb54fz2z8ts74h',
            'debt_collection': 'agent_01k02pehqgfywb54fz2z8ts74h', // Recuperación de Cartera
            'claim_support': 'agent_01k02pehqgfywb54fz2z8ts74h',
            
            // Ventas - usar Sofia
            'lead_followup': 'agent_6301k1m98143epst5bf9qxch742q',
            'cross_sell': 'agent_6301k1m98143epst5bf9qxch742q',
            
            // Servicio - usar Marcela
            'welcome_onboarding': 'agent_01k02pehqgfywb54fz2z8ts74h',
            'satisfaction_survey': 'agent_01k02pehqgfywb54fz2z8ts74h',
            
            // Retención - usar Sofia
            'policy_renewal': 'agent_6301k1m98143epst5bf9qxch742q',
            'winback': 'agent_6301k1m98143epst5bf9qxch742q'
          };
          
          return agentMapping[templateId] || 'agent_01k02pehqgfywb54fz2z8ts74h'; // Marcela como fallback
        };
        
        // Determinar el agent_id y voice_id (siempre voces reales)
        const realAgentId = getAgentIdForTemplate(campaignData.selectedTemplate.id);
        const voiceId = selectedRealVoice;
        
        // Preparar datos de la campaña en el formato esperado por el backend Laravel
        const triggers = buildTriggersPayload();
        
        // 🔥 LÓGICA CLAVE: Si hay triggers configurados, NO ejecutar inmediatamente
        // La campaña queda en draft esperando que los triggers se activen con eventos reales
        const hasTriggers = triggers.length > 0;
        
        const campaignRequest = {
          name: campaignName,
          description: campaignData.campaignDescription || (hasTriggers
            ? `Campaña con disparadores automáticos de ${campaignData.selectedTemplate.category}`
            : `Campaña automática de ${campaignData.selectedTemplate.category} ejecutada inmediatamente`),
          elevenlabs_agent_id: realAgentId,      // id del agente en ElevenLabs
          type: 'immediate',                     // tipo de campaña
          priority: 'medium',
          contacts,                              // con phone_number y custom_data
          ...(triggers.length > 0 ? { triggers } : {}),
          // 🔥 Si hay triggers, guardar como draft (no ejecutar inmediatamente)
          save_as_draft: hasTriggers,
          // Extras útiles que el backend puede registrar
          agent_name: campaignData.agentName || campaignData.selectedTemplate.agentPersona.name,
          voice_message_template: campaignData.customFirstMessage || campaignData.selectedTemplate.firstMessageTemplate,
          elevenlabs_voice_id: voiceId,
          // voice_settings omitido para evitar errores de override en ElevenLabs (stability/similarity/style)
          settings: {
            template_id: campaignData.selectedTemplate?.id,
            call_timeout: campaignData.callTimeout,
            simultaneous_calls: campaignData.maxConcurrentCalls,
            system_prompt: campaignData.customPrompt || campaignData.selectedTemplate.systemPrompt,
            triggers: {
              selectedType: triggersConfig.selectedType,
              types: triggersConfig.types,
              expiry: {
                before_days: Number(triggersConfig.expiry.before_days) || 0,
                after_days: Number(triggersConfig.expiry.after_days) || 0,
              },
              window: triggersConfig.window,
              limits: triggersConfig.limits,
              mapping: triggersConfig.mapping,
            },
            post_call_tools: {
              collect: {
                // Convertir el formato nuevo al formato esperado por el backend
                ...Object.fromEntries(
                  Object.entries(campaignData.postCallTools.collect).map(([key, config]) => [
                    key,
                    typeof config === 'object' ? config : { enabled: config, type: key, required: false }
                  ])
                ),
                // Agregar campos personalizados
                ...Object.fromEntries(
                  campaignData.postCallTools.customFields
                    .filter(field => field.enabled && field.name)
                    .map(field => [
                      field.name.toLowerCase().replace(/\s+/g, '_'),
                      {
                        enabled: field.enabled,
                        type: field.type,
                        required: field.required,
                        instruction: field.instruction,
                        pattern: field.pattern
                      }
                    ])
                )
              },
              whatsapp: campaignData.postCallTools.whatsapp,
              decision_policies: campaignData.postCallTools.decisionPolicies,
              followUpEnabled: campaignData.postCallTools.followUpEnabled,
              followUpCondition: campaignData.postCallTools.followUpCondition,
              followUpDays: campaignData.postCallTools.followUpDays,
              followUpDescription: campaignData.postCallTools.followUpDescription,
              createDealEnabled: campaignData.postCallTools.createDealEnabled,
              createDealContactability: campaignData.postCallTools.createDealContactability,
              createDealObjective: campaignData.postCallTools.createDealObjective,
              createDealStage: campaignData.postCallTools.createDealStage,
              createDealDescription: campaignData.postCallTools.createDealDescription
            },
            decision_policies: campaignData.decisionPolicies,
            voicemail_config: campaignData.voicemailConfig
          }
        };
        
        // Crear campaña de voz inmediata usando el nuevo servicio
        console.log('🚀 [CampaignWizard] Creando campaña de voz inmediata...', {
          name: campaignName,
          contacts: contacts.length,
          agent_id: realAgentId,
          voice_id: voiceId,
          template_id: campaignData.selectedTemplate.id,
          voice_type: 'real',
          voice_name: getSelectedVoiceInfo()?.name
        });
        
        const response = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);
        
        if (response.success) {
          console.log('✅ [CampaignWizard] Campaña de voz creada exitosamente:', {
            campaign_id: response.campaign?.id,
            timestamp: new Date().toISOString(),
            execution_time: Date.now() - currentTime,
            contacts_count: contacts.length,
            has_triggers: hasTriggers,
            saved_as_draft: hasTriggers
          });
          setExecutionStarted(true);
          
          // Notificar al padre sin reintentar crear (evitar doble POST)
          if (onComplete) {
            onComplete({
              created_by_wizard: true,
              campaign: response.campaign,
              type: hasTriggers ? 'triggered' : 'immediate',
              has_triggers: hasTriggers
            } as any);
          }
        } else {
          console.error('❌ [CampaignWizard] Error al crear campaña de voz:', response.message);
          // Reset estados en caso de error para permitir retry
          setPreventDuplicates(false);
        }
      } catch (error) {
        console.error('❌ [CampaignWizard] Error inesperado:', error);
        // Reset estados en caso de error para permitir retry
        setPreventDuplicates(false);
      } finally {
        setIsExecuting(false);
      }
    };

  // Componente Paso 6: Ejecutar Campaña - Versión simplificada
  const renderExecuteCampaign = () => {
    const triggers = buildTriggersPayload();
    const hasTriggers = triggers.length > 0;
    const voiceInfo = getSelectedVoiceInfo();
    
    if (executionStarted) {
      return (
        <div className="space-y-6">
          <Card className={hasTriggers ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}>
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${hasTriggers ? 'bg-blue-100 dark:bg-blue-800' : 'bg-green-100 dark:bg-green-800'}`}>
                <Icon icon={hasTriggers ? "solar:bell-bold" : "solar:check-circle-bold"} className={`w-8 h-8 ${hasTriggers ? 'text-blue-600 dark:text-blue-300' : 'text-green-600 dark:text-green-300'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${hasTriggers ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300'} mb-2`}>
                {hasTriggers ? '¡Campaña Configurada!' : '¡Campaña Iniciada!'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {hasTriggers
                  ? 'Se activará automáticamente cuando se cumplan las condiciones'
                  : 'Las llamadas se están procesando'}
              </p>
            </div>
          </Card>
          
          <Card>
            <div className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:chart-2-bold-duotone" className="w-5 h-5 text-primary" />
                Estado
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {campaignData.selectedContacts.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                    <Icon icon="solar:clipboard-list-bold-duotone" className="w-4 h-4" /> Programadas
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">0</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                    <Icon icon="solar:hourglass-bold-duotone" className="w-4 h-4" /> En Progreso
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">0</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4" /> Completadas
                  </p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">0</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                    <Icon icon="solar:pause-circle-bold-duotone" className="w-4 h-4" /> Pendientes
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {/* Resumen de la campaña */}
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-0">
          <div className="p-6">
            <h3 className="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white flex items-center justify-center gap-2">
              <Icon icon="solar:clipboard-list-bold-duotone" className="w-6 h-6 text-primary" />
              Resumen de tu Campaña
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Objetivo */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-primary/10">
                  <Icon icon="solar:target-bold-duotone" className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {campaignData.selectedTemplate?.name || 'Objetivo'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {campaignData.selectedTemplate?.category}
                </p>
              </div>

              {/* Agente */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon="solar:user-speak-bold-duotone" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {campaignData.agentName || campaignData.selectedTemplate?.agentPersona.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {voiceInfo?.name || 'Voz'}
                </p>
              </div>

              {/* Contactos */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {campaignData.selectedContacts.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contactos</p>
              </div>

              {/* Tipo */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={hasTriggers ? "solar:bell-bold-duotone" : "solar:bolt-bold-duotone"} className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {hasTriggers ? 'Automática' : 'Inmediata'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ejecución</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Estado de ejecución o CTA */}
        {isExecuting ? (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center bg-blue-100 dark:bg-blue-800">
                <Icon icon="solar:phone-calling-bold-duotone" className="w-8 h-8 text-blue-600 dark:text-blue-300 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                Iniciando campaña...
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Preparando las llamadas
              </p>
            </div>
          </Card>
        ) : (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="p-6 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100 dark:bg-green-800">
                <Icon icon={hasTriggers ? "solar:bell-bold-duotone" : "solar:rocket-bold-duotone"} className="w-10 h-10 text-green-600 dark:text-green-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {hasTriggers ? 'Campaña con Disparadores' : '¡Todo listo!'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {hasTriggers ? (
                  <>Se activará automáticamente cuando ocurran los eventos configurados</>
                ) : (
                  <>
                    Se realizarán <strong>{campaignData.selectedContacts.length}</strong> llamadas con <strong>{campaignData.agentName || campaignData.selectedTemplate?.agentPersona.name}</strong>
                  </>
                )}
              </p>
              
              {hasTriggers && (
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {triggers.map((t, idx) => (
                    <Badge key={idx} color="info" size="sm">
                      {t.type === 'new_client' ? 'Nuevo Cliente' :
                       t.type === 'new_policy' ? 'Nueva Póliza' :
                       t.type === 'policy_expiry' ? 'Vencimiento' :
                       t.type === 'new_lead' ? 'Nuevo Lead' :
                       t.type === 'new_siniestro' ? 'Nuevo Siniestro' : t.type}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Icon icon="solar:bolt-bold-duotone" className="w-4 h-4" /> Rápido</span>
                <span className="flex items-center gap-1"><Icon icon="solar:phone-bold-duotone" className="w-4 h-4" /> Automático</span>
                <span className="flex items-center gap-1"><Icon icon="solar:chart-bold-duotone" className="w-4 h-4" /> Medible</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };





  return [createPortal(
    <div
      key="wizard-modal"
      className="fixed inset-0 z-[9998] bg-black/60 overscroll-none"
      style={{
        margin: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      } as React.CSSProperties}
    >
      <div className="w-full h-full p-0 flex items-center justify-center relative z-[9999]">
      <div 
        className="w-full max-w-7xl h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl flex flex-col overflow-hidden"
        style={{ 
          margin: 0
        } as React.CSSProperties}
      >
        {/* Header fijo usando CardBox styling */}
        <div className="flex-shrink-0 border-b border-ld p-6 bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Crear Nueva Campaña</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Configura tu campaña de llamadas automáticas con IA
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Paso {currentStep} de {STEPS.length}
                </span>
              </div>
              {onCancel && (
                <Button size="sm" color="gray" onClick={onCancel}>
                  <Icon icon="solar:close-circle-outline" className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
          
          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Contenido scrolleable - Usa flex-1 para ocupar espacio disponible */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto">
                                <Tabs 
              ref={tabsRef}
              aria-label="Campaign wizard" 
              variant="underline"
              onActiveTabChange={(tab) => {
                const targetStep = tab + 1;
                // Solo permitir navegar si:
                // 1. Es el paso actual
                // 2. Es un paso anterior ya completado
                // 3. Es el siguiente paso inmediato Y el actual está completo
                if (targetStep === currentStep || 
                    targetStep < currentStep || 
                    (targetStep === currentStep + 1 && isStepComplete(currentStep))) {
                  setCurrentStep(targetStep);
                } else {
                  // Si no es permitido, volver al tab actual
                  if (tabsRef.current) {
                    tabsRef.current.setActiveTab(currentStep - 1);
                  }
                }
              }}
            >
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id || isStepComplete(step.id);
            const isAccessible = step.id <= currentStep || isStepComplete(step.id - 1);
            const isNextStep = step.id === currentStep + 1;
            
            return (
              <Tabs.Item
                key={step.id}
                active={isActive}
                title={step.title}
                disabled={!isAccessible}
                icon={() => (
                  <div className="flex items-center gap-2">
                    {isCompleted && currentStep > step.id ? (
                      <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
                    ) : (
                      <Icon icon={step.icon} className={`w-5 h-5 ${!isAccessible ? 'text-gray-400' : ''}`} />
                    )}
                  </div>
                )}
              >
                <div className="mt-6 pb-6">
                  {isActive && step.id === 1 && renderAgentSelection()}
                  {isActive && step.id === 2 && renderVoiceConfiguration()}
                  {isActive && step.id === 3 && renderAgentPresentation()}
                  {isActive && step.id === 4 && (
                    <div className="space-y-6">
                      <Card>
                        <div className="p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Icon icon="solar:tools-bold-duotone" className="w-5 h-5 text-primary" />
                            Configuración Avanzada
                          </h4>
                          
                          <Tabs aria-label="Herramientas avanzadas" variant="underline">
                            <Tabs.Item
                              title="Inicializador"
                              icon={() => <Icon icon="solar:alarm-bell-bold-duotone" className="w-4 h-4" />}
                            >
                              <div className="mt-4 space-y-6">
                                {/* Para Venta Cruzada: No hay inicializador automático */}
                                {campaignData.selectedTemplate?.id === 'cross_sell' ? (
                                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                      <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h5 className="font-medium text-purple-900 dark:text-purple-100">Campaña de Venta Cruzada</h5>
                                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                          Esta campaña no utiliza inicialización automática. Debes seleccionar manualmente los clientes a los que deseas llamar en el paso de <strong>Contactos</strong>.
                                        </p>
                                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                                          La campaña finalizará automáticamente cuando se completen todas las llamadas programadas.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                {/* Tipo de inicialización - Select único */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                                    Tipo de inicialización
                                  </label>
                                  <ShadSelect
                                    value={triggersConfig.selectedType}
                                    onValueChange={(value) => {
                                      // Reset all types to false, then set selected one to true
                                      const newTypes = {
                                        new_client: false,
                                        new_policy: false,
                                        policy_expiry: false,
                                        new_lead: false,
                                        new_siniestro: false,
                                      };
                                      if (value && value !== 'none') {
                                        (newTypes as any)[value] = true;
                                      }
                                      setTriggersConfig(prev => ({
                                        ...prev,
                                        selectedType: value,
                                        types: newTypes
                                      }));
                                    }}
                                  >
                                    <ShadSelectTrigger className="w-full">
                                      <ShadSelectValue placeholder="Selecciona tipo de inicialización" />
                                    </ShadSelectTrigger>
                                    <ShadSelectContent>
                                      <ShadSelectItem value="none">Sin inicialización automática</ShadSelectItem>
                                      {campaignData.selectedTemplate?.id === 'policy_renewal' ? (
                                        <ShadSelectItem value="policy_expiry">Renovación de póliza (por vencimiento)</ShadSelectItem>
                                      ) : (
                                        <ShadSelectItem value="policy_expiry">Recordatorio de pago</ShadSelectItem>
                                      )}
                                    </ShadSelectContent>
                                  </ShadSelect>
                                </div>

                                {/* Horario de trabajo de la IA */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                      <Icon icon="solar:clock-circle-bold-duotone" className="w-4 h-4 text-primary" />
                                      Horario de trabajo
                                    </h5>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Define los días y horarios en los que la IA realizará las llamadas automáticas
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
                                      Días activos
                                    </label>
                                    <div className="grid grid-cols-7 gap-2">
                                    {[
                                      { key: 'mon', label: 'Lun' },
                                      { key: 'tue', label: 'Mar' },
                                      { key: 'wed', label: 'Mié' },
                                      { key: 'thu', label: 'Jue' },
                                      { key: 'fri', label: 'Vie' },
                                      { key: 'sat', label: 'Sáb' },
                                      { key: 'sun', label: 'Dom' },
                                    ].map(day => (
                                      <label key={day.key} className="flex flex-col items-center gap-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          checked={triggersConfig.window.days.includes(day.key)}
                                          onChange={(e) => {
                                            const currentDays = triggersConfig.window.days.split(',').map(d => d.trim()).filter(Boolean);
                                            let newDays: string[];
                                            if (e.target.checked) {
                                              newDays = [...currentDays, day.key];
                                            } else {
                                              newDays = currentDays.filter(d => d !== day.key);
                                            }
                                            setTriggersConfig(prev => ({
                                              ...prev,
                                              window: { ...prev.window, days: newDays.join(',') }
                                            }));
                                          }}
                                        />
                                        <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-medium transition-colors ${
                                          triggersConfig.window.days.includes(day.key)
                                            ? 'bg-primary border-primary text-white'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/50'
                                        }`}>
                                          {day.label}
                                        </div>
                                      </label>
                                    ))}
                                    </div>
                                  </div>

                                  {/* Horarios */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                        Hora Inicio
                                      </label>
                                      <input
                                        type="time"
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                        value={triggersConfig.window.start}
                                        onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, start: e.target.value } }))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                        Hora Fin
                                      </label>
                                      <input
                                        type="time"
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                        value={triggersConfig.window.end}
                                        onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, end: e.target.value } }))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                        Zona Horaria
                                      </label>
                                      <ShadSelect
                                        value={triggersConfig.window.tz}
                                        onValueChange={(value) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, tz: value } }))}
                                      >
                                        <ShadSelectTrigger className="w-full">
                                          <ShadSelectValue />
                                        </ShadSelectTrigger>
                                        <ShadSelectContent>
                                          <ShadSelectItem value="America/Bogota">Colombia (GMT-5)</ShadSelectItem>
                                          <ShadSelectItem value="America/Mexico_City">México (GMT-6)</ShadSelectItem>
                                          <ShadSelectItem value="America/Lima">Perú (GMT-5)</ShadSelectItem>
                                          <ShadSelectItem value="America/Santiago">Chile (GMT-4)</ShadSelectItem>
                                          <ShadSelectItem value="America/Argentina/Buenos_Aires">Argentina (GMT-3)</ShadSelectItem>
                                          <ShadSelectItem value="America/New_York">Nueva York (GMT-5)</ShadSelectItem>
                                          <ShadSelectItem value="Europe/Madrid">Madrid (GMT+1)</ShadSelectItem>
                                          <ShadSelectItem value="Europe/London">Londres (GMT+0)</ShadSelectItem>
                                        </ShadSelectContent>
                                      </ShadSelect>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs text-gray-600 dark:text-gray-400">Cupo diario</label>
                                    <input
                                      type="number"
                                      className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                      value={Number(triggersConfig.limits.daily_quota)}
                                      onChange={(e) => setTriggersConfig(prev => ({ ...prev, limits: { ...prev.limits, daily_quota: Number(e.target.value) } }))}
                                      placeholder="100"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600 dark:text-gray-400">Intentos máximos (en caso de no contestar)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="5"
                                      className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                      value={triggersConfig.limits.dedup_days}
                                      onChange={(e) => setTriggersConfig(prev => ({ ...prev, limits: { ...prev.limits, dedup_days: Number(e.target.value) } }))}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>

                                {triggersConfig.types.policy_expiry && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-xs text-gray-600 dark:text-gray-400">
                                        {campaignData.selectedTemplate?.id === 'policy_renewal' 
                                          ? 'Días antes del vencimiento' 
                                          : 'Días antes de vencer'}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="90"
                                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                        value={Number(triggersConfig.expiry.before_days) || 0}
                                        onChange={(e) => setTriggersConfig(prev => ({ ...prev, expiry: { ...prev.expiry, before_days: e.target.value } }))}
                                        placeholder={campaignData.selectedTemplate?.id === 'policy_renewal' ? '30' : '7'}
                                      />
                                      <p className="text-xs text-gray-400 mt-1">Pólizas que venzan en los próximos X días</p>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600 dark:text-gray-400">
                                        {campaignData.selectedTemplate?.id === 'policy_renewal' 
                                          ? 'Días después del vencimiento' 
                                          : 'Días después de vencer'}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="90"
                                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                        value={Number(triggersConfig.expiry.after_days) || 0}
                                        onChange={(e) => setTriggersConfig(prev => ({ ...prev, expiry: { ...prev.expiry, after_days: e.target.value } }))}
                                        placeholder={campaignData.selectedTemplate?.id === 'policy_renewal' ? '7' : '1'}
                                      />
                                      <p className="text-xs text-gray-400 mt-1">Pólizas vencidas hace X días o menos</p>
                                    </div>
                                  </div>
                                )}

                                {/* Campo de teléfono */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                    Campo de Teléfono
                                  </label>
                                  <ShadSelect
                                    value={triggersConfig.mapping.phone_field}
                                    onValueChange={(value) => setTriggersConfig(prev => ({ ...prev, mapping: { ...prev.mapping, phone_field: value } }))}
                                  >
                                    <ShadSelectTrigger className="w-full">
                                      <ShadSelectValue />
                                    </ShadSelectTrigger>
                                    <ShadSelectContent>
                                      <ShadSelectItem value="client.mobile_phone">Teléfono del cliente asociado</ShadSelectItem>
                                    </ShadSelectContent>
                                  </ShadSelect>
                                </div>
                                  </>
                                )}
                              </div>
                            </Tabs.Item>

                            <Tabs.Item
                              title="Disparadores"
                              icon={() => <Icon icon="solar:bolt-bold-duotone" className="w-4 h-4" />}
                            >
                              <div className="mt-4 space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Configura acciones automáticas que se ejecutan según el resultado de la llamada.
                                </p>
                                
                                {/* Disparador: Seguimiento Comercial */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Icon icon="solar:phone-calling-bold-duotone" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div>
                                        <h5 className="font-medium text-gray-900 dark:text-white">Seguimiento Comercial</h5>
                                        <p className="text-xs text-gray-500">Programa seguimiento según resultado de la llamada</p>
                                      </div>
                                    </div>
                                    <ToggleSwitch
                                      checked={campaignData.postCallTools.followUpEnabled || false}
                                      onChange={(checked: boolean) => setCampaignData(prev => ({
                                        ...prev,
                                        postCallTools: { ...prev.postCallTools, followUpEnabled: checked }
                                      }))}
                                    />
                                  </div>
                                  
                                  {campaignData.postCallTools.followUpEnabled && (
                                    <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                      <div>
                                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Crear tarea cuando</label>
                                        <ShadSelect
                                          value={campaignData.postCallTools.followUpCondition || 'call_successful'}
                                          onValueChange={(value) => setCampaignData(prev => ({
                                            ...prev,
                                            postCallTools: { ...prev.postCallTools, followUpCondition: value }
                                          }))}
                                        >
                                          <ShadSelectTrigger className="w-full">
                                            <ShadSelectValue placeholder="Selecciona condición" />
                                          </ShadSelectTrigger>
                                          <ShadSelectContent>
                                            <ShadSelectItem value="call_successful">Llamada exitosa (objetivo cumplido)</ShadSelectItem>
                                            <ShadSelectItem value="call_failed">Llamada fallida (objetivo no cumplido)</ShadSelectItem>
                                            <ShadSelectItem value="no_answer">No contestó</ShadSelectItem>
                                            <ShadSelectItem value="always">Siempre (cualquier resultado)</ShadSelectItem>
                                          </ShadSelectContent>
                                        </ShadSelect>
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Descripción de la tarea (opcional)</label>
                                        <textarea
                                          rows={2}
                                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                          value={campaignData.postCallTools.followUpDescription || ''}
                                          onChange={(e) => setCampaignData(prev => ({
                                            ...prev,
                                            postCallTools: { ...prev.postCallTools, followUpDescription: e.target.value }
                                          }))}
                                          placeholder="Ej: Contactar cliente para confirmar pago..."
                                        />
                                      </div>
                                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                                          <Icon icon="solar:info-circle-bold" className="w-4 h-4 inline mr-1" />
                                          ¿Qué hace este disparador?
                                        </p>
                                        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-5 list-disc">
                                          <li>Crea automáticamente una tarea de seguimiento comercial cuando se cumple la condición seleccionada</li>
                                          <li>La tarea incluirá el nombre del cliente, resumen de la llamada y la descripción que agregues</li>
                                          <li>Podrás ver y gestionar las tareas en <span className="font-medium">Seguros → Seguimiento</span></li>
                                        </ul>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Disparador: Crear Negocio en Embudo de Ventas (para Renovación y Venta Cruzada) */}
                                {(campaignData.selectedTemplate?.id === 'policy_renewal' || campaignData.selectedTemplate?.id === 'cross_sell') && (
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                          <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <div>
                                          <h5 className="font-medium text-gray-900 dark:text-white">Crear Negocio</h5>
                                          <p className="text-xs text-gray-500">Crea un negocio en el embudo de ventas</p>
                                        </div>
                                      </div>
                                      <ToggleSwitch
                                        checked={campaignData.postCallTools.createDealEnabled || false}
                                        onChange={(checked: boolean) => setCampaignData(prev => ({
                                          ...prev,
                                          postCallTools: { ...prev.postCallTools, createDealEnabled: checked }
                                        }))}
                                      />
                                    </div>
                                    
                                    {campaignData.postCallTools.createDealEnabled && (
                                      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Contactabilidad</label>
                                            <ShadSelect
                                              value={campaignData.postCallTools.createDealContactability || 'any'}
                                              onValueChange={(value) => setCampaignData(prev => ({
                                                ...prev,
                                                postCallTools: { ...prev.postCallTools, createDealContactability: value }
                                              }))}
                                            >
                                              <ShadSelectTrigger className="w-full">
                                                <ShadSelectValue placeholder="Selecciona" />
                                              </ShadSelectTrigger>
                                              <ShadSelectContent>
                                                <ShadSelectItem value="any">Cualquiera</ShadSelectItem>
                                                <ShadSelectItem value="contacted">Contestó</ShadSelectItem>
                                                <ShadSelectItem value="not_contacted">No contestó</ShadSelectItem>
                                              </ShadSelectContent>
                                            </ShadSelect>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Cumplimiento del objetivo</label>
                                            <ShadSelect
                                              value={campaignData.postCallTools.createDealObjective || 'any'}
                                              onValueChange={(value) => setCampaignData(prev => ({
                                                ...prev,
                                                postCallTools: { ...prev.postCallTools, createDealObjective: value }
                                              }))}
                                            >
                                              <ShadSelectTrigger className="w-full">
                                                <ShadSelectValue placeholder="Selecciona" />
                                              </ShadSelectTrigger>
                                              <ShadSelectContent>
                                                <ShadSelectItem value="any">Cualquiera</ShadSelectItem>
                                                <ShadSelectItem value="achieved">Objetivo cumplido</ShadSelectItem>
                                                <ShadSelectItem value="not_achieved">Objetivo no cumplido</ShadSelectItem>
                                              </ShadSelectContent>
                                            </ShadSelect>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Estado inicial del negocio</label>
                                            <ShadSelect
                                              value={campaignData.postCallTools.createDealStage || 'lead'}
                                              onValueChange={(value) => setCampaignData(prev => ({
                                                ...prev,
                                                postCallTools: { ...prev.postCallTools, createDealStage: value }
                                              }))}
                                            >
                                              <ShadSelectTrigger className="w-full">
                                                <ShadSelectValue placeholder="Selecciona estado" />
                                              </ShadSelectTrigger>
                                              <ShadSelectContent>
                                                <ShadSelectItem value="lead">Lead</ShadSelectItem>
                                                <ShadSelectItem value="contacted">Contactado</ShadSelectItem>
                                                <ShadSelectItem value="qualified">Calificado</ShadSelectItem>
                                                <ShadSelectItem value="proposal">Propuesta</ShadSelectItem>
                                                <ShadSelectItem value="negotiation">Negociación</ShadSelectItem>
                                              </ShadSelectContent>
                                            </ShadSelect>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Descripción del negocio (opcional)</label>
                                          <textarea
                                            rows={2}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                            value={campaignData.postCallTools.createDealDescription || ''}
                                            onChange={(e) => setCampaignData(prev => ({
                                              ...prev,
                                              postCallTools: { ...prev.postCallTools, createDealDescription: e.target.value }
                                            }))}
                                            placeholder="Ej: Renovación de póliza de auto..."
                                          />
                                        </div>
                                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 space-y-2">
                                          <p className="text-xs font-medium text-orange-800 dark:text-orange-200">
                                            <Icon icon="solar:info-circle-bold" className="w-4 h-4 inline mr-1" />
                                            ¿Qué hace este disparador?
                                          </p>
                                          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 ml-5 list-disc">
                                            <li>Crea automáticamente un negocio en el embudo de ventas cuando se cumple la condición</li>
                                            <li>El negocio incluirá los datos del cliente, póliza y ramo correspondiente</li>
                                            <li>Podrás ver y gestionar los negocios en <span className="font-medium">Comercial → Embudo de Ventas</span></li>
                                          </ul>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Mensaje informativo si no hay disparadores activos */}
                                {!campaignData.postCallTools.followUpEnabled && !campaignData.postCallTools.createDealEnabled && (
                                  <div className="text-center py-6 text-gray-500">
                                    <Icon icon="solar:bolt-circle-bold-duotone" className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No hay disparadores activos</p>
                                    <p className="text-xs">Activa un disparador para automatizar acciones post-llamada</p>
                                  </div>
                                )}
                              </div>
                            </Tabs.Item>

                            <Tabs.Item
                              title="WhatsApp"
                              icon={() => <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4" />}
                            >
                              <div className="mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Activar envío de enlace de pago</span>
                                  <ToggleSwitch
                                    checked={campaignData.postCallTools.whatsapp.enabled}
                                    onChange={(checked: boolean) => setCampaignData(prev => ({
                                      ...prev,
                                      postCallTools: { ...prev.postCallTools, whatsapp: { ...prev.postCallTools.whatsapp, enabled: checked } }
                                    }))}
                                  />
                                </div>
                                {campaignData.postCallTools.whatsapp.enabled && (
                                  <>
                                    <div>
                                      <label className="text-xs text-gray-600 dark:text-gray-400">Instancia de WhatsApp</label>
                                      <ShadSelect
                                        value={campaignData.postCallTools.whatsapp.instance_id || 'auto'}
                                        onValueChange={(value) => setCampaignData(prev => ({
                                          ...prev,
                                          postCallTools: {
                                            ...prev.postCallTools,
                                            whatsapp: {
                                              ...prev.postCallTools.whatsapp,
                                              instance_id: value === 'auto' ? '' : value
                                            }
                                          }
                                        }))}
                                      >
                                        <ShadSelectTrigger className="mt-1"><ShadSelectValue placeholder="(Automática)" /></ShadSelectTrigger>
                                        <ShadSelectContent>
                                          <ShadSelectItem value="auto">(Automática)</ShadSelectItem>
                                          {waInstances.map(inst => (
                                            <ShadSelectItem key={`${inst.id}-${inst.instance_id}`} value={inst.instance_id}>
                                              {inst.instance_id} {inst.status ? `(${inst.status})` : ''}
                                            </ShadSelectItem>
                                          ))}
                                        </ShadSelectContent>
                                      </ShadSelect>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600 dark:text-gray-400">Plantilla de mensaje (llamada exitosa)</label>
                                      <textarea
                                        rows={3}
                                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                        value={campaignData.postCallTools.whatsapp.template}
                                        onChange={(e) => setCampaignData(prev => ({
                                          ...prev,
                                          postCallTools: { ...prev.postCallTools, whatsapp: { ...prev.postCallTools.whatsapp, template: e.target.value } }
                                        }))}
                                        placeholder="Hola {customer_name}, te compartimos tu enlace de pago: {payment_link}"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">Variables: {'{customer_name}'}, {'{payment_link}'}, {'{amount_cop}'}, {'{reference}'}</p>
                                    </div>
                                    
                                    {/* Opción para no contestados */}
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <div>
                                          <span className="text-sm font-medium">Enviar mensaje si no contesta</span>
                                          <p className="text-xs text-gray-500">Se enviará automáticamente cuando el cliente no conteste la llamada</p>
                                        </div>
                                        <ToggleSwitch
                                          checked={campaignData.postCallTools.whatsapp.noAnswerEnabled}
                                          onChange={(checked: boolean) => setCampaignData(prev => ({
                                            ...prev,
                                            postCallTools: { ...prev.postCallTools, whatsapp: { ...prev.postCallTools.whatsapp, noAnswerEnabled: checked } }
                                          }))}
                                        />
                                      </div>
                                      {campaignData.postCallTools.whatsapp.noAnswerEnabled && (
                                        <div>
                                          <label className="text-xs text-gray-600 dark:text-gray-400">Mensaje para no contestados</label>
                                          <textarea
                                            rows={3}
                                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                            value={campaignData.postCallTools.whatsapp.noAnswerTemplate}
                                            onChange={(e) => setCampaignData(prev => ({
                                              ...prev,
                                              postCallTools: { ...prev.postCallTools, whatsapp: { ...prev.postCallTools.whatsapp, noAnswerTemplate: e.target.value } }
                                            }))}
                                            placeholder="Hola {customer_name}, intentamos comunicarnos contigo..."
                                          />
                                          <p className="text-xs text-gray-500 mt-1">Variables: {'{customer_name}'}, {'{company_name}'}, {'{phone}'}</p>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              {/* Vista previa del WhatsApp */}
                              {campaignData.postCallTools.whatsapp.enabled && (
                                <div className="mt-4">
                                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Vista previa del mensaje</label>
                                  <div className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                    {(() => {
                                      const link = 'https://pay.guro.app/pay?ref=DEMO&amount=125000';
                                      const preview = (campaignData.postCallTools.whatsapp.template || 'Hola {customer_name}, te compartimos tu enlace de pago: {payment_link}')
                                        .replace('{customer_name}', 'Juan Rivera')
                                        .replace('{payment_link}', link)
                                        .replace('{amount_cop}', '125000')
                                        .replace('{reference}', 'DEMO-PRUEBA');
                                      return <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{preview}</pre>;
                                    })()}
                                  </div>
                                </div>
                              )}
                            </Tabs.Item>

                            <Tabs.Item
                              title="Recolección de Datos"
                              icon={() => <Icon icon="solar:database-bold-duotone" className="w-4 h-4" />}
                            >
                              <div className="mt-4">
                                <DynamicFieldsConfig
                                  collectConfig={campaignData.postCallTools.collect}
                                  customFields={campaignData.postCallTools.customFields}
                                  onCollectConfigChange={(config) => setCampaignData(prev => ({
                                    ...prev,
                                    postCallTools: { ...prev.postCallTools, collect: config }
                                  }))}
                                  onCustomFieldsChange={(fields) => setCampaignData(prev => ({
                                    ...prev,
                                    postCallTools: { ...prev.postCallTools, customFields: fields }
                                  }))}
                                />
                              </div>
                            </Tabs.Item>

                            <Tabs.Item
                              title="Buzón de voz"
                              icon={() => <Icon icon="solar:phone-bold-duotone" className="w-4 h-4" />}
                            >
                              <div className="mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-sm font-medium">¿Detectar buzón de voz?</span>
                                    <p className="text-xs text-gray-500">Detecta si el buzón de voz del cliente y le deja un mensaje personalizado</p>
                                  </div>
                                  <ToggleSwitch
                                    checked={campaignData.voicemailConfig.enabled}
                                    onChange={(checked: boolean) => setCampaignData(prev => ({
                                      ...prev,
                                      voicemailConfig: { ...prev.voicemailConfig, enabled: checked }
                                    }))}
                                  />
                                </div>
                                {campaignData.voicemailConfig.enabled && (
                                  <>
                                    {/* Mensaje para dejar en el buzón de voz */}
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                      {campaignData.voicemailConfig.enabled && (
                                        <div>
                                          <label className="text-xs text-gray-600 dark:text-gray-400">Mensaje para dejar en el buzón de voz</label>
                                          <textarea
                                            rows={3}
                                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                            value={campaignData.voicemailConfig.message}
                                            onChange={(e) => setCampaignData(prev => ({
                                              ...prev,
                                              voicemailConfig: { ...prev.voicemailConfig, message: e.target.value }
                                            }))}
                                            placeholder="Hola {customer_name}, intentamos comunicarnos contigo de {company_name} pero no contestaste, te llamaremos mas tarde."
                                          />
                                          <p className="text-xs text-gray-500 mt-1">Variables: {'{customer_name}'}, {'{company_name}'}</p>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </Tabs.Item>
                          </Tabs>
                        </div>
                      </Card>
                    </div>
                  )}
                  {isActive && step.id === 5 && (
                    <>
                      {(() => {
                        const triggers = buildTriggersPayload();
                        const hasTriggers = triggers.length > 0;
                        
                        if (hasTriggers) {
                          // Si hay triggers, mostrar mensaje explicativo en lugar de lista de clientes
                          return (
                            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                              <div className="p-8 text-center">
                                <Icon icon="solar:alarm-bell-outline" className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-2">
                                  Campaña con Disparadores Automáticos
                                </h3>
                                <p className="text-gray-700 dark:text-gray-300 mb-4">
                                  Has configurado disparadores automáticos. Esta campaña se activará cuando ocurran los siguientes eventos:
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center mb-4">
                                  {triggers.map((t, idx) => (
                                    <Badge key={idx} color="info" size="lg">
                                      {t.type === 'new_client' ? '🆕 Nuevo Cliente' :
                                       t.type === 'new_policy' ? '📋 Nueva Póliza' :
                                       t.type === 'policy_expiry' ? '⏰ Vencimiento de Póliza' :
                                       t.type === 'new_lead' ? '🎯 Nuevo Lead' :
                                       t.type === 'new_siniestro' ? '🚨 Nuevo Siniestro' : t.type}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left">
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    <strong>¿Cómo funciona?</strong>
                                  </p>
                                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                                    <li>No necesitas seleccionar clientes específicos</li>
                                    <li>El sistema llamará automáticamente cuando ocurran los eventos configurados</li>
                                    <li>Respeta ventanas horarias, límites diarios y deduplicación</li>
                                    <li>Puedes ver los resultados en el historial de llamadas</li>
                                  </ul>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                                  Puedes continuar al siguiente paso para finalizar la configuración
                                </p>
                              </div>
                            </Card>
                          );
                        }
                        
                        // Si no hay triggers, mostrar selección normal de clientes
                        return renderClientSelection();
                      })()}
                    </>
                  )}
                  {isActive && step.id === 6 && renderExecuteCampaign()}
                </div>
              </Tabs.Item>
            );
          })}
        </Tabs>
          </div>
        </div>

        {/* Footer fijo con navegación */}
        <div className="flex-shrink-0 border-t border-ld p-6 bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center">
            <Button
              onClick={prevStep}
              disabled={currentStep === 1}
              color="gray"
              size="sm"
            >
              <Icon icon="solar:arrow-left-outline" className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            <div className="flex flex-col items-end gap-2">
              {/* Mensaje de validación */}
              {!isStepComplete(currentStep) && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                  <Icon icon="solar:info-circle-outline" className="w-3 h-3 inline mr-1" />
                  {getValidationMessage(currentStep)}
                </div>
              )}
              
              {/* Botones de navegación */}
                          <div className="flex gap-2">
              {currentStep < STEPS.length ? (
                <Button
                  onClick={nextStep}
                  disabled={!isStepComplete(currentStep)}
                  color="primary"
                  size="sm"
                >
                  Siguiente
                  <Icon icon="solar:arrow-right-outline" className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                /* Botones de ejecución en el último paso */
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={!isStepComplete(currentStep)}
                    onClick={() => {
                      setTestCallResult(null);
                      setIsTestModalOpen(true);
                    }}
                  >
                    <Icon icon="solar:play-outline" className="w-4 h-4 mr-2" />
                    Probar
                  </Button>
                  <Button
                    size="sm"
                    color="info"
                    disabled={!isStepComplete(currentStep)}
                    onClick={async () => {
                      try {
                        setIsExecuting(true);
                        setPreventDuplicates(true);
                        if (!campaignData.selectedTemplate) throw new Error('No se ha seleccionado un agente');
                        const realAgentId = (function(templateId: string){
                          const map: Record<string, string> = {
                            payment_reminder: 'agent_01k02pehqgfywb54fz2z8ts74h',
                            debt_collection: 'agent_01k02pehqgfywb54fz2z8ts74h',
                            claim_support: 'agent_01k02pehqgfywb54fz2z8ts74h',
                            lead_followup: 'agent_6301k1m98143epst5bf9qxch742q',
                            cross_sell: 'agent_6301k1m98143epst5bf9qxch742q',
                            welcome_onboarding: 'agent_01k02pehqgfywb54fz2z8ts74h',
                            satisfaction_survey: 'agent_01k02pehqgfywb54fz2z8ts74h',
                            policy_renewal: 'agent_6301k1m98143epst5bf9qxch742q',
                            winback: 'agent_6301k1m98143epst5bf9qxch742q'
                          };
                          return map[templateId] || 'agent_01k02pehqgfywb54fz2z8ts74h';
                        })(campaignData.selectedTemplate.id);
                        const voiceId = selectedRealVoice;
                        const contacts = campaignData.selectedContacts.map(c => {
                          const fullName = `${c.nombre} ${c.apellidos}`.trim();
                          const companyName = (campaignData.customVariables?.company_name || tenant?.branding?.nombre_comercial || tenant?.nombre || 'Tu Compañía de Seguros');
                          const policyNumber = (campaignData.customVariables?.policy_number || 'uno, dos, cuatro,catorce,veinti tres');
                          const debtAmount = Number(campaignData.customVariables?.debt_amount) || 'Dos millones de pesos';
                          const dueDate =
                            campaignData.customVariables?.payment_due_date ||
                            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                          return {
                            name: fullName,
                            phone: c.celular_principal,
                            custom_data: {
                              email: c.email_principal,
                              city: c.ciudad,
                              first_name: c.nombre,
                              last_name: c.apellidos,
                              client_id: c.id,
                              // Variables dinámicas críticas para ElevenLabs
                              customer_name: fullName,
                              company_name: companyName,
                              policy_number: policyNumber,
                              debt_amount: debtAmount,
                              payment_due_date: dueDate
                            }
                          };
                        });
                        const draftName = campaignData.campaignName || generateCampaignName();
                        const triggers = buildTriggersPayload();
                        const campaignRequest = {
                          name: draftName,
                          description: campaignData.campaignDescription || `Campaña automática de ${campaignData.selectedTemplate.category} (borrador)`,
                          elevenlabs_agent_id: realAgentId,
                          type: 'immediate',
                          priority: 'medium',
                          contacts,
                          ...(triggers.length > 0 ? { triggers } : {}),
                          agent_name: campaignData.agentName || campaignData.selectedTemplate.agentPersona.name,
                          voice_message_template: campaignData.customFirstMessage || campaignData.selectedTemplate.firstMessageTemplate,
                          elevenlabs_voice_id: voiceId,
                          // voice_settings omitido para evitar errores de override en ElevenLabs (stability/similarity/style)
                          settings: {
                            call_timeout: campaignData.callTimeout,
                            simultaneous_calls: campaignData.maxConcurrentCalls,
                            system_prompt: campaignData.customPrompt || campaignData.selectedTemplate.systemPrompt,
                            post_call_tools: campaignData.postCallTools,
                            decision_policies: campaignData.decisionPolicies,
                            voicemail_config: campaignData.voicemailConfig
                          },
                          save_as_draft: true
                        };
                        await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest as any);
                        // Cerrar modal y notificar aunque haya error (el draft se crea de todas formas)
                        if (onComplete) onComplete(campaignData);
                        if (onCancel) onCancel();
                      } catch (e:any) {
                        // Cerrar modal de todas formas ya que el draft se crea
                        console.warn('Error al guardar campaña:', e?.message);
                        if (onComplete) onComplete(campaignData);
                        if (onCancel) onCancel();
                      } finally {
                        setIsExecuting(false);
                      }
                    }}
                  >
                    <Icon icon="solar:bookmark-outline" className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  <Button
                    onClick={handleExecuteCampaign}
                    disabled={!isStepComplete(currentStep) || isExecuting || preventDuplicates || executionStarted}
                    color="success"
                    size="sm"
                  >
                    {isExecuting ? (
                      <>
                        <Icon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                        {buildTriggersPayload().length > 0 ? 'Guardando...' : 'Enviando...'}
                      </>
                    ) : (
                      <>
                        <Icon icon={buildTriggersPayload().length > 0 ? "solar:bookmark-check-outline" : "solar:rocket-outline"} className="w-4 h-4 mr-2" />
                        {buildTriggersPayload().length > 0 ? 'Guardar y Activar Disparadores' : 'Guardar y Enviar'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
      </div>

    </div>,
    document.body
  ),
  
  isTestModalOpen && createPortal(
    <div key="test-modal" className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" onClick={() => setIsTestModalOpen(false)}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:phone-calling-rounded-bold" className="w-5 h-5 text-green-500" />
            Probar Llamada
          </h3>
          <button 
            onClick={() => setIsTestModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Icon icon="solar:close-circle-outline" className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Recibirás una llamada de prueba con el objetivo <strong>{campaignData.selectedTemplate?.name}</strong>
        </p>
        
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Nombre del cliente (para la llamada)
            </label>
            <TextInput
              type="text"
              value={testCallName}
              onChange={(e) => setTestCallName(e.target.value)}
              placeholder="María García"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Tu número de teléfono
            </label>
            <TextInput
              type="tel"
              value={testCallPhone}
              onChange={(e) => setTestCallPhone(e.target.value)}
              placeholder="3001234567"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Recibirás la llamada en este número
            </p>
          </div>
        </div>
        
        {testCallResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${testCallResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            <div className="flex items-center gap-2">
              <Icon icon={testCallResult.success ? "solar:check-circle-bold" : "solar:close-circle-bold"} className="w-4 h-4" />
              {testCallResult.message}
            </div>
          </div>
        )}
        
        <div className="flex gap-3">
          <Button
            color="gray"
            className="flex-1"
            onClick={() => setIsTestModalOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            color="success"
            className="flex-1"
            onClick={handleTestCall}
            disabled={isTestingCall || !testCallPhone || testCallPhone.length < 10}
          >
            {isTestingCall ? (
              <>
                <Icon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                Llamando...
              </>
            ) : (
              <>
                <Icon icon="solar:phone-calling-rounded-bold" className="w-4 h-4 mr-2" />
                Llamar ahora
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
  ];
};

export default CampaignWizard;

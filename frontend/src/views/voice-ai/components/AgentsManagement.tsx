import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'src/components/shadcn-ui/Default-Ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/shadcn-ui/Default-Ui/tabs';
import { 
  Bot, 
  Eye, 
  Loader2,
  Shield,
  Database
} from 'lucide-react';
import { Icon } from '@iconify/react';

// Importar servicios
import { getVoiceList, testVoice } from '../../../services/elevenLabsService';
import { AGENT_TEMPLATES, getAgentTemplateById } from '../../../data/campaignAgentTemplates';
import { useUnifiedAuth } from '../../../context/UnifiedAuthContext';
import type { ConversationalAgent } from '../../../services/elevenLabsService';
// Imágenes de perfiles (usar imports para producción)
import real1 from '/src/assets/images/profile/real1.jpg';
import real2 from '/src/assets/images/profile/real2.jpg';
import real3 from '/src/assets/images/profile/real3.jpg';
import real4 from '/src/assets/images/profile/real4.jpg';
import real5 from '/src/assets/images/profile/real5.jpg';
import real6 from '/src/assets/images/profile/real6.jpg';
import real7 from '/src/assets/images/profile/real7.jpg';

type Agent = ConversationalAgent;

// Voice interface no utilizada removida

const AgentsManagement: React.FC = () => {
  const { usuarioSaas, tenant } = useUnifiedAuth();
  const currentUserName = usuarioSaas?.nombre ? `${usuarioSaas.nombre.split(' ')[0]}` : 'Juan';
  const currentBrokerName = (tenant as any)?.branding?.nombre_comercial || (tenant as any)?.name || tenant?.nombre || 'Tu Agencia de Seguros';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState<Agent | null>(null);
  // Estado de tabs no utilizado se omite para esta vista simplificada
  const [isVoicesModalOpen, setIsVoicesModalOpen] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  type ModalVoiceItem = {
    voice_id?: string;
    code: string;
    name: string; // nombre original de la cuenta (para matching)
    displayName: string; // nombre corto y amigable para UI
    description: string; // descripción breve y útil para el usuario
    meta: { language: string; accent?: string; age?: string; gender?: string };
    isDefault?: boolean;
    disabled?: boolean;
  };
  const [availableVoices, setAvailableVoices] = useState<ModalVoiceItem[]>([]);
  const [selectedAgentForVoice, setSelectedAgentForVoice] = useState<Agent | null>(null);
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = React.useRef<string | null>(null);
  const [playingVoiceCode, setPlayingVoiceCode] = useState<string | null>(null);
  const [loadingVoiceCode, setLoadingVoiceCode] = useState<string | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Cargar SOLO los agentes personalizados del wizard (los mismos de la modal)
      const mappedFromTemplates: Agent[] = AGENT_TEMPLATES.map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        type: 'generic',
        description: tpl.description,
          isActive: true,
        voiceId: '86V9x9hrQds83qf7zaGn',
        voiceName: tpl.agentPersona.name,
        language: 'es',
        systemPrompt: tpl.systemPrompt,
        greeting: tpl.firstMessageTemplate,
        goodbye: 'Gracias por tu tiempo, ha sido un gusto ayudarte.',
          voiceSettings: {
          stability: tpl.voiceSettings.stability,
          similarityBoost: tpl.voiceSettings.similarityBoost,
          style: tpl.voiceSettings.style,
          speakerBoost: tpl.voiceSettings.speakerBoost,
        },
        statistics: undefined as any, // no mostramos estadísticas simuladas
        createdAt: new Date(),
        updatedAt: new Date(),
        llmModel: undefined,
        conversationConfig: undefined,
        tools: []
      }));
      setAgents(mappedFromTemplates);

    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // Sin acciones de prueba o creación en esta versión simplificada
  const buildSampleTextForAgent = (agent: Agent | null, voiceDisplayName?: string): string => {
    const name = voiceDisplayName || 'tu asistente';
    const greetingUser = currentUserName;
    const broker = currentBrokerName;
    if (!agent) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Estoy aquí para ayudarte con tus pólizas y consultas. ¿En qué puedo asistirte hoy?`;
    }
    const tpl = getAgentTemplateById(agent.id);
    const templateId = tpl?.id || '';
    const category = tpl?.category;

    // Casos específicos para que el mensaje hable del objetivo del agente
    if (templateId.includes('cross_sell')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Veo que ya cuentas con una póliza de auto. Me gustaría proponerte un complemento de hogar para ampliar tu protección. ¿Te cuento los beneficios clave y un costo estimado?`;
    }
    if (templateId.includes('satisfaction_survey')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Quisiera hacerte una breve encuesta de 2 preguntas sobre tu experiencia reciente. Tu opinión nos ayuda a mejorar. ¿Tienes un minuto?`;
    }
    if (templateId.includes('winback')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Me gustaría saber cómo te fue tras cancelar tu póliza y contarte mejoras y beneficios por regresar. ¿Te comparto una opción simple para volver cuando te convenga?`;
    }

    // Simplificado por tipo/categoría, sin números ni montos específicos
    // Siniestros (claim_support)
    if (templateId.includes('claim')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Te acompaño con tu siniestro de auto por un choque leve. Te explico los pasos y cómo podemos ayudarte. ¿Continuamos?`;
    }
    // Cobranza
    if (category === 'cobranza' || templateId.includes('payment')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Te llamo para recordarte un pago pendiente de tu póliza de auto. ¿Te ayudo a completarlo?`;
    }
    // Ventas (follow up / cross sell)
    if (category === 'ventas' || templateId.includes('lead') || templateId.includes('cross')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Vi tu interés en un seguro de vida y quiero orientarte con una propuesta sencilla. ¿Te explico opciones?`;
    }
    // Servicio (bienvenida/onboarding)
    if (category === 'servicio' || templateId.includes('welcome')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. ¡Bienvenido! Estoy a tu disposición para lo que necesites, orientarte en tus primeros pasos y acompañarte con tu póliza. También estoy disponible por nuestros canales de atención (WhatsApp, teléfono y correo). ¿Te gustaría que te guíe ahora?`;
    }
    // Retención / renovación
    if (category === 'retencion' || templateId.includes('renewal')) {
      return `Hola ${greetingUser}, soy ${name} de ${broker}. Tu póliza de auto está próxima a vencer y quiero ayudarte a renovarla sin complicaciones. ¿Revisamos opciones?`;
    }

    // Genérico
    return `Hola ${greetingUser}, soy ${name} de ${broker}. Puedo ayudarte con pagos, renovaciones y soporte de pólizas. ¿En qué te apoyo hoy?`;
  };
  // openVoicesModal se sustituyó por handler inline para evitar referencias fuera de alcance

  const handlePlaySample = async (voice: ModalVoiceItem) => {
    try {
      // Toggle: if the same voice is playing, stop it
      if (playingVoiceCode === voice.code) {
        handleStopPlayback();
        return;
      }

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      if (!voice.voice_id) return;
      setLoadingVoiceCode(voice.code);
      const voiceName = voice.displayName || voice.name;
      const sampleText = buildSampleTextForAgent(selectedAgentForVoice, voiceName);
      const buffer = await testVoice(voice.voice_id, sampleText);
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      currentAudioUrlRef.current = url;
      setPlayingVoiceCode(voice.code);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        currentAudioUrlRef.current = null;
        setPlayingVoiceCode(null);
      };
      await audio.play();
    } catch (error) {
      // noop
    } finally {
      setLoadingVoiceCode(null);
    }
  };

  const handleStopPlayback = () => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      setPlayingVoiceCode(null);
    } catch (_) {
      setPlayingVoiceCode(null);
    }
  };

  // Listado directo (sin buscador ni filtros)
  const filteredAgents = agents;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Cargando agentes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Agentes</h2>
          <p className="text-gray-600 mb-4">Administra y prueba tus agentes conversacionales personalizados</p>
          
          {/* Estadísticas rápidas */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">{agents.length} Agentes</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3" />
      </div>

      {/* Card de capacidades de llamadas removido */}

      {/* Buscador y filtros removidos */}

      {/* Grid de agentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onViewDetails={() => {
              // Abrir modal de voces (curada) al hacer clic en Probar
              setSelectedAgentForVoice(agent);
              setIsVoicesModalOpen(true);
              (async () => {
                setVoicesLoading(true);
                try {
                  const resp = await getVoiceList();
                  const voices = (resp?.voices || []) as Array<{ voice_id: string; name: string; labels?: any }>;
                  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '');
                  const findByName = (search: string) => voices.find(v => norm(v.name).includes(norm(search)));
                  const curated: ModalVoiceItem[] = [
                    {
                      code: 'AG',
                      name: 'Angie',
                      displayName: 'Angie',
                      description: 'Español colombiano, femenina joven, voz ultrarealista y natural. ⭐ Recomendada',
                      meta: { language: 'es', accent: 'colombian', age: 'young', gender: 'female' },
                      isDefault: true,
                      voice_id: 'YPh7OporwNAJ28F5IQrm' // ID fijo de Angie
                    },
                    {
                      code: 'CR',
                      name: 'Cristian sanchez',
                      displayName: 'Cristián Sánchez',
                      description: 'Español colombiano, masculino mediana edad, serio y confiable.',
                      meta: { language: 'es', accent: 'colombian', age: 'middle_aged', gender: 'male' },
                      voice_id: 'sdxJtmxpzgSLekrYUGIu' // ID fijo de Cristián
                    },
                    {
                      code: 'MA',
                      name: 'Marcela - Colombian Girl',
                      displayName: 'Marcela',
                      description: 'Español colombiano, femenina joven, cálida y cercana.',
                      meta: { language: 'es', accent: 'colombian', age: 'young', gender: 'female' }
                    },
                    {
                      code: 'SO',
                      name: 'Sofía – Soft & Warm',
                      displayName: 'Sofía',
                      description: 'Español colombiano, femenina joven con tono suave y acogedor.',
                      meta: { language: 'es', accent: 'colombian', age: 'young', gender: 'female' }
                    },
                    {
                      code: 'AN',
                      name: 'Andrea',
                      displayName: 'Andrea',
                      description: 'Español latino, femenina joven, expresiva y dinámica.',
                      meta: { language: 'es', accent: 'latin american', age: 'young', gender: 'female' }
                    },
                    {
                      code: 'JU',
                      name: 'JuanRestrepoPro',
                      displayName: 'Juan Restrepo',
                      description: 'Español colombiano, masculino joven, tono directo y claro.',
                      meta: { language: 'es', accent: 'colombian', age: 'young' }
                    },
                    {
                      code: 'M',
                      name: 'Medellin - Colombian Voice',
                      displayName: 'Mariana',
                      description: 'Español latino, femenina joven con tono claro y natural.',
                      meta: { language: 'es', accent: 'latin american', age: 'young', gender: 'female' }
                    }
                  ].map(item => {
                    // Si ya tiene voice_id (como Angie), usarlo directamente
                    if (item.voice_id) {
                      return {
                        ...item,
                        disabled: false,
                      } as ModalVoiceItem;
                    }
                    const match = findByName(item.name) || (item.code === 'MA' ? findByName('Marcela') : undefined);
                    return {
                      ...item,
                      voice_id: match?.voice_id,
                      name: item.name,
                      disabled: !match,
                    } as ModalVoiceItem;
                  });
                  setAvailableVoices(curated);
                } catch (e) {
                  setAvailableVoices([]);
                } finally {
                  setVoicesLoading(false);
                }
              })();
            }}
          />
        ))}
      </div>

      {filteredAgents.length === 0 && agents.length === 0 && !isLoading && (
        <Card className="p-12">
          <div className="text-center">
            <Bot className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-600 mb-3">
              Sin agentes configurados
            </h3>
            <p className="text-gray-500 mb-6 max-w-lg mx-auto">
              No hay agentes configurados todavía.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center" />
          </div>
        </Card>
      )}

      {/* Estado alterno sin filtros, bloque removido */}

      {/* Modal de detalles */}
      <AgentDetailsModal
        agent={selectedAgentForDetails}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAgentForDetails(null);
        }}
      />

      {/* Modal de voces para probar */}
      <Dialog open={isVoicesModalOpen} onOpenChange={(open) => {
        setIsVoicesModalOpen(open);
        if (!open) {
          handleStopPlayback();
          setLoadingVoiceCode(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Elige una voz para probar</DialogTitle>
          </DialogHeader>
          {voicesLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {availableVoices.map((v) => {
                let photoSrc = real1;
                if (v.displayName === 'Angie') photoSrc = real1;
                else if (v.displayName === 'Cristián Sánchez') photoSrc = real2;
                else if (v.displayName === 'Marcela') photoSrc = real3;
                else if (v.displayName === 'Sofía') photoSrc = real4;
                else if (v.displayName === 'Andrea') photoSrc = real5;
                else if (v.displayName === 'Juan Restrepo') photoSrc = real6;
                else if (v.displayName === 'Mariana') photoSrc = real7;
  return (
                <Card key={v.code} className="rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                  <CardContent className="p-5">
                    {/* Fila 1: foto centrada */}
                    <div className="w-full flex items-center justify-center">
                      <img
                        src={photoSrc}
                        alt={v.displayName || v.name}
                        className="w-20 h-20 rounded-full object-cover border"
                        loading="lazy"
                      />
        </div>

                    {/* Fila 2: nombre centrado */}
                    <div className="mt-3 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900">{v.displayName || v.name}</h3>
                        {v.isDefault && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Por defecto</span>
            )}
          </div>
        </div>

                    {/* Fila 3: descripción centrada */}
                    <p className="text-sm text-gray-600 mt-2 text-center">{v.description}</p>

                    {/* Fila 4: botón centrado */}
                    <div className="mt-4 flex justify-center">
            <Button
                          variant={playingVoiceCode === v.code ? 'default' : 'outline'}
                          className={playingVoiceCode === v.code ? 'bg-blue-600 text-white' : ''}
              size="sm"
                          onClick={() => handlePlaySample(v)}
                          disabled={!v.voice_id || loadingVoiceCode === v.code}
            >
                          {loadingVoiceCode === v.code ? (
                            <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Preparando...
                            </>
                          ) : playingVoiceCode === v.code ? (
                            <>
                              <Icon icon="solar:pause-bold" className="w-4 h-4 mr-2" />
                              Detener
                            </>
                          ) : (
                            <>
                              <Icon icon="solar:play-bold-duotone" className="w-4 h-4 mr-2" />
                              Escuchar Muestra
                            </>
                          )}
            </Button>
          </div>
                  </CardContent>
                </Card>
              );
              })}
              {availableVoices.length === 0 && (
                <div className="col-span-full text-center text-gray-500">No hay voces disponibles</div>
              )}
                    </div>
              )}
        </DialogContent>
      </Dialog>
                  </div>
  );
};

// Componente de tarjeta de agente
interface AgentCardProps {
  agent: Agent;
  onViewDetails: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onViewDetails }) => {
  const tpl = getAgentTemplateById(agent.id);
  const bgColor = (tpl?.color || '#E5E7EB') + '33';
  const category = tpl?.category;
  const templateId = tpl?.id || '';

  const getCategoryIcon = () => {
    // Prioridad por plantilla específica
    if (templateId.includes('claim')) {
      // Siniestros
      return 'solar:danger-triangle-bold-duotone';
    }
    if (templateId.includes('lead')) {
      // Seguimiento de interesados
      return 'solar:user-circle-bold-duotone';
    }
    if (templateId.includes('welcome')) {
      // Bienvenida / onboarding (icono disponible en set)
      return 'solar:users-group-two-rounded-bold-duotone';
    }

    switch (category) {
      case 'cobranza':
        return 'solar:wallet-money-bold-duotone';
      case 'ventas':
        return 'solar:target-bold-duotone';
      case 'servicio':
        return 'solar:headphones-round-sound-bold-duotone';
      case 'retencion':
        return 'solar:refresh-bold-duotone';
      default:
        return 'solar:widget-2-bold-duotone';
    }
  };

  return (
    <Card className="rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        {/* Fila 1: icono izquierda, botón derecha */}
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgColor }}>
            <Icon icon={getCategoryIcon()} className="w-6 h-6 text-gray-700" />
                    </div>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            <Icon icon="solar:play-bold-duotone" className="w-4 h-4 mr-2" />
            Probar
                      </Button>
                  </div>
                  
        {/* Fila 2: título y descripción */}
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900">{agent.name}</h3>
            {category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                {category}
              </span>
                  )}
                </div>
          {agent.description && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{agent.description}</p>
              )}
            </div>
      </CardContent>
    </Card>
  );
};

// Componente modal de detalles
interface AgentDetailsModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({ agent, isOpen, onClose }) => {
  if (!agent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-blue-600" />
            <span>Detalles Completos: {agent.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">General</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="technical">Técnico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">ID:</span>
                      <p className="text-gray-900 font-mono">{agent.id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Nombre:</span>
                      <p className="text-gray-900">{agent.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Tipo:</span>
                      <p className="text-gray-900 capitalize">{agent.type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Estado:</span>
                      <Badge variant={agent.isActive ? "default" : "secondary"}>
                        {agent.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Idioma:</span>
                      <p className="text-gray-900">{agent.language || 'No especificado'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Voz:</span>
                      <p className="text-gray-900">{agent.voiceName || 'Por defecto'}</p>
                    </div>
                  </div>
                  {agent.description && (
                    <div>
                      <span className="font-medium text-gray-600">Descripción:</span>
                      <p className="text-gray-900 mt-1">{agent.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Capacidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {agent.tools && agent.tools.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Herramientas ({agent.tools.length}):</span>
                        <div className="mt-2 space-y-2">
                          {agent.tools.slice(0, 3).map((tool, index) => (
                            <div key={index} className="p-2 bg-yellow-50 rounded border">
                              <p className="font-medium text-sm">{tool.name}</p>
                              <p className="text-xs text-gray-600">{tool.description}</p>
                            </div>
                          ))}
                          {agent.tools.length > 3 && (
                            <p className="text-xs text-gray-500">Y {agent.tools.length - 3} más...</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {agent.knowledgeBase && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Database className="w-3 h-3 mr-1" />
                          Base de conocimiento
                        </Badge>
                      )}
                      {agent.authentication?.enabled && (
                        <Badge className="bg-green-100 text-green-800">
                          <Shield className="w-3 h-3 mr-1" />
                          Autenticación
                        </Badge>
                      )}
                      {agent.privacy?.privacyMode && (
                        <Badge className="bg-purple-100 text-purple-800">
                          <Eye className="w-3 h-3 mr-1" />
                          Modo privado
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="config" className="space-y-6">
            {agent.voiceSettings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuración de Voz</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {agent.voiceSettings.stability && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Estabilidad ({(agent.voiceSettings.stability * 100).toFixed(0)}%)
                        </label>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-blue-500 h-3 rounded-full transition-all duration-300" 
                            style={{ width: `${agent.voiceSettings.stability * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Más configuraciones de voz... */}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="prompts" className="space-y-6">
            {agent.systemPrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Prompt del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {agent.systemPrompt}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {agent.greeting && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mensaje de Saludo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-800">{agent.greeting}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="technical" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Técnica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-600">Modelo LLM:</span>
                      <p className="text-blue-600 font-mono">{agent.llmModel || 'No especificado'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Voice ID:</span>
                      <p className="text-gray-900 font-mono">{agent.voiceId || 'No especificado'}</p>
                    </div>
                  </div>
                  
                  {agent.conversationConfig && (
                    <div>
                      <span className="font-medium text-gray-600">Configuración Completa:</span>
                      <pre className="text-xs bg-gray-50 p-3 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(agent.conversationConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AgentsManagement; 
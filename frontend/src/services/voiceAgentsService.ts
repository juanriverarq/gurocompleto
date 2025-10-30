export interface VoiceAgent {
  id: string;
  name: string;
  type: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey' | 'sofia_insurance' | 'juan_ai' | 'generic';
  description?: string;
  campaignType?: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey' | 'generic';
  defaultPrompt?: string;
  collectFields?: string[];
  postCallActions?: {
    whatsapp?: boolean;
    email?: boolean;
    sms?: boolean;
  };
}

// Agentes predefinidos con configuraciones específicas
const DEFAULT_AGENTS: VoiceAgent[] = [
  {
    id: 'agent-payment-reminder',
    name: 'Recordatorio de Pago de Seguro',
    type: 'payment_reminder',
    campaignType: 'payment_reminder',
    description: 'Agente especializado en recordatorios de pago y cobranza de pólizas',
    collectFields: ['phone', 'email', 'debt_amount'],
    postCallActions: { whatsapp: true, email: false, sms: false }
  },
  {
    id: 'agent-customer-welcome',
    name: 'Bienvenida al Cliente',
    type: 'customer_welcome',
    campaignType: 'customer_welcome',
    description: 'Agente para dar la bienvenida a nuevos clientes y explicar beneficios de su póliza',
    collectFields: ['email', 'phone', 'preferred_contact_method'],
    postCallActions: { whatsapp: true, email: true, sms: false }
  },
  {
    id: 'agent-satisfaction-survey',
    name: 'Encuesta de Satisfacción',
    type: 'satisfaction_survey',
    campaignType: 'satisfaction_survey',
    description: 'Agente para realizar encuestas de satisfacción y recopilar feedback de clientes',
    collectFields: ['satisfaction_rating', 'feedback', 'recommendation_score'],
    postCallActions: { whatsapp: false, email: true, sms: false }
  },
  {
    id: 'agent-sofia',
    name: 'Sofia Seguros',
    type: 'sofia_insurance',
    description: 'Agente general para gestión de seguros y atención al cliente'
  },
  {
    id: 'agent-juan',
    name: 'Juan AI',
    type: 'juan_ai',
    description: 'Agente comercial para prospección y ventas'
  },
  {
    id: 'agent-generic',
    name: 'Agente General',
    type: 'generic',
    description: 'Agente genérico para tareas generales'
  },
];

export async function getCustomAgents(): Promise<VoiceAgent[]> {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('custom_voice_agents') : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_AGENTS;
}

export async function saveCustomAgents(agents: VoiceAgent[]): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('custom_voice_agents', JSON.stringify(agents));
    }
  } catch {}
}



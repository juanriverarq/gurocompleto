/**
 * Helper para facilitar la creación de campañas de voz usando templates predefinidos
 */

import { 
  getCampaignTemplate, 
  processTemplateVariables, 
  validateTemplateVariables,
  CampaignTemplate 
} from './voiceCampaignTemplates';
import { CreateVoiceCampaignRequest } from './voiceCampaignService';

export interface CampaignContact {
  name: string;
  phone: string;
  email?: string;
  custom_data?: Record<string, any>;
}

export interface CreateCampaignFromTemplateParams {
  campaignType: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey';
  campaignName: string;
  campaignDescription?: string;
  contacts: CampaignContact[];
  agentId: string;
  agentName?: string;
  companyName?: string;
  defaultVariables?: Record<string, any>;
  scheduled?: boolean;
  scheduledAt?: string;
  saveAsDraft?: boolean;
}

/**
 * Crear una campaña de voz desde un template predefinido
 */
export function createCampaignFromTemplate(params: CreateCampaignFromTemplateParams): CreateVoiceCampaignRequest {
  const template = getCampaignTemplate(params.campaignType);
  
  // Variables por defecto
  const defaultVars = {
    agent_name: params.agentName || 'tu asesora',
    company_name: params.companyName || 'GURO Seguros',
    ...params.defaultVariables
  };

  // Procesar contactos y personalizar mensajes
  const processedContacts = params.contacts.map(contact => {
    // Combinar variables del contacto con las por defecto
    const contactVariables = {
      ...defaultVars,
      customer_name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      ...contact.custom_data
    };

    // Validar variables requeridas
    const validation = validateTemplateVariables(template, contactVariables);
    if (!validation.isValid) {
      console.warn(`⚠️ Missing variables for contact ${contact.name}:`, validation.missingVariables);
    }

    return {
      name: contact.name,
      phone_number: contact.phone,
      custom_data: {
        ...contact.custom_data,
        template_type: params.campaignType,
        variables: contactVariables
      }
    };
  });

  // Construir el mensaje de voz personalizado
  const voiceMessageTemplate = processTemplateVariables(
    template.firstMessage,
    defaultVars
  );

  // Construir la configuración de la campaña
  const campaignRequest: CreateVoiceCampaignRequest = {
    name: params.campaignName,
    description: params.campaignDescription || template.description,
    agent_id: params.agentId,
    type: params.scheduled ? 'scheduled' : 'immediate',
    priority: 'medium',
    contacts: processedContacts,
    settings: {
      max_retries: 2,
      retry_delay: 300,
      call_timeout: 180,
      simultaneous_calls: 5,
      working_hours: {
        start: '09:00',
        end: '18:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      },
      post_call_tools: template.postCallTools
    }
  };

  // Agregar fecha programada si aplica
  if (params.scheduled && params.scheduledAt) {
    campaignRequest.scheduled_at = params.scheduledAt;
  }

  return campaignRequest;
}

/**
 * Crear campaña de Recordatorio de Pago
 */
export function createPaymentReminderCampaign(params: {
  campaignName: string;
  contacts: Array<{
    name: string;
    phone: string;
    policy_number: string;
    debt_amount: number;
    payment_due_date: string;
    email?: string;
  }>;
  agentId: string;
  agentName?: string;
  companyName?: string;
  saveAsDraft?: boolean;
}): CreateVoiceCampaignRequest {
  const processedContacts: CampaignContact[] = params.contacts.map(c => ({
    name: c.name,
    phone: c.phone,
    email: c.email,
    custom_data: {
      policy_number: c.policy_number,
      debt_amount: c.debt_amount,
      payment_due_date: c.payment_due_date
    }
  }));

  return createCampaignFromTemplate({
    campaignType: 'payment_reminder',
    campaignName: params.campaignName,
    contacts: processedContacts,
    agentId: params.agentId,
    agentName: params.agentName,
    companyName: params.companyName,
    saveAsDraft: params.saveAsDraft
  });
}

/**
 * Crear campaña de Bienvenida al Cliente
 */
export function createCustomerWelcomeCampaign(params: {
  campaignName: string;
  contacts: Array<{
    name: string;
    phone: string;
    email?: string;
    policy_number: string;
    insurance_type: string;
    start_date: string;
  }>;
  agentId: string;
  agentName?: string;
  companyName?: string;
  appLink?: string;
  supportPhone?: string;
  saveAsDraft?: boolean;
}): CreateVoiceCampaignRequest {
  const processedContacts: CampaignContact[] = params.contacts.map(c => ({
    name: c.name,
    phone: c.phone,
    email: c.email,
    custom_data: {
      policy_number: c.policy_number,
      insurance_type: c.insurance_type,
      start_date: c.start_date
    }
  }));

  return createCampaignFromTemplate({
    campaignType: 'customer_welcome',
    campaignName: params.campaignName,
    contacts: processedContacts,
    agentId: params.agentId,
    agentName: params.agentName,
    companyName: params.companyName,
    defaultVariables: {
      app_link: params.appLink || 'https://app.guro.com',
      support_phone: params.supportPhone || '+57 300 123 4567'
    },
    saveAsDraft: params.saveAsDraft
  });
}

/**
 * Crear campaña de Encuesta de Satisfacción
 */
export function createSatisfactionSurveyCampaign(params: {
  campaignName: string;
  contacts: Array<{
    name: string;
    phone: string;
    email?: string;
    policy_number: string;
    last_service_date: string;
    interaction_type: string;
  }>;
  agentId: string;
  agentName?: string;
  companyName?: string;
  saveAsDraft?: boolean;
}): CreateVoiceCampaignRequest {
  const processedContacts: CampaignContact[] = params.contacts.map(c => ({
    name: c.name,
    phone: c.phone,
    email: c.email,
    custom_data: {
      policy_number: c.policy_number,
      last_service_date: c.last_service_date,
      interaction_type: c.interaction_type
    }
  }));

  return createCampaignFromTemplate({
    campaignType: 'satisfaction_survey',
    campaignName: params.campaignName,
    contacts: processedContacts,
    agentId: params.agentId,
    agentName: params.agentName,
    companyName: params.companyName,
    saveAsDraft: params.saveAsDraft
  });
}

/**
 * Obtener configuración de ejemplo para cada tipo de campaña
 */
export function getExampleCampaignConfig(type: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey') {
  const template = getCampaignTemplate(type);
  
  const baseExample = {
    campaignName: `Campaña de ${template.name}`,
    agentId: 'agent-1',
    agentName: 'Sofia',
    companyName: 'GURO Seguros'
  };

  switch (type) {
    case 'payment_reminder':
      return {
        ...baseExample,
        contacts: [
          {
            name: 'Juan Pérez',
            phone: '+573001234567',
            email: 'juan.perez@example.com',
            policy_number: 'POL-2024-001',
            debt_amount: 125000,
            payment_due_date: '2024-12-31'
          }
        ]
      };
    
    case 'customer_welcome':
      return {
        ...baseExample,
        contacts: [
          {
            name: 'María García',
            phone: '+573009876543',
            email: 'maria.garcia@example.com',
            policy_number: 'POL-2024-002',
            insurance_type: 'Seguro de Vida',
            start_date: '2024-01-15'
          }
        ],
        appLink: 'https://app.guro.com',
        supportPhone: '+57 300 123 4567'
      };
    
    case 'satisfaction_survey':
      return {
        ...baseExample,
        contacts: [
          {
            name: 'Carlos Rodríguez',
            phone: '+573005551234',
            email: 'carlos.rodriguez@example.com',
            policy_number: 'POL-2024-003',
            last_service_date: '2024-01-10',
            interaction_type: 'Renovación de póliza'
          }
        ]
      };
    
    default:
      return baseExample;
  }
}

/**
 * Validar datos de contacto para un tipo de campaña específico
 */
export function validateCampaignContacts(
  type: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey',
  contacts: any[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!contacts || contacts.length === 0) {
    errors.push('Se requiere al menos un contacto');
    return { isValid: false, errors };
  }

  contacts.forEach((contact, index) => {
    if (!contact.name) {
      errors.push(`Contacto ${index + 1}: El nombre es requerido`);
    }
    if (!contact.phone) {
      errors.push(`Contacto ${index + 1}: El teléfono es requerido`);
    }

    // Validaciones específicas por tipo
    switch (type) {
      case 'payment_reminder':
        if (!contact.policy_number) {
          errors.push(`Contacto ${index + 1}: El número de póliza es requerido`);
        }
        if (!contact.debt_amount) {
          errors.push(`Contacto ${index + 1}: El monto de deuda es requerido`);
        }
        if (!contact.payment_due_date) {
          errors.push(`Contacto ${index + 1}: La fecha de vencimiento es requerida`);
        }
        break;
      
      case 'customer_welcome':
        if (!contact.policy_number) {
          errors.push(`Contacto ${index + 1}: El número de póliza es requerido`);
        }
        if (!contact.insurance_type) {
          errors.push(`Contacto ${index + 1}: El tipo de seguro es requerido`);
        }
        if (!contact.start_date) {
          errors.push(`Contacto ${index + 1}: La fecha de inicio es requerida`);
        }
        break;
      
      case 'satisfaction_survey':
        if (!contact.policy_number) {
          errors.push(`Contacto ${index + 1}: El número de póliza es requerido`);
        }
        if (!contact.last_service_date) {
          errors.push(`Contacto ${index + 1}: La fecha del último servicio es requerida`);
        }
        if (!contact.interaction_type) {
          errors.push(`Contacto ${index + 1}: El tipo de interacción es requerido`);
        }
        break;
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
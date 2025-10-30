/**
 * Tests y ejemplos de uso para campañas de voz
 * Estos tests sirven también como documentación ejecutable
 */

import { describe, it, expect } from 'vitest';
import {
  createPaymentReminderCampaign,
  createCustomerWelcomeCampaign,
  createSatisfactionSurveyCampaign,
  validateCampaignContacts,
  getExampleCampaignConfig
} from '../voiceCampaignHelper';
import {
  getCampaignTemplate,
  processTemplateVariables,
  validateTemplateVariables
} from '../voiceCampaignTemplates';

describe('Voice Campaign Templates', () => {
  it('should get payment reminder template', () => {
    const template = getCampaignTemplate('payment_reminder');
    
    expect(template).toBeDefined();
    expect(template.type).toBe('payment_reminder');
    expect(template.name).toBe('Recordatorio de Pago de Seguro');
    expect(template.variables).toContain('customer_name');
    expect(template.variables).toContain('policy_number');
  });

  it('should get customer welcome template', () => {
    const template = getCampaignTemplate('customer_welcome');
    
    expect(template).toBeDefined();
    expect(template.type).toBe('customer_welcome');
    expect(template.name).toBe('Bienvenida al Cliente');
    expect(template.variables).toContain('insurance_type');
  });

  it('should get satisfaction survey template', () => {
    const template = getCampaignTemplate('satisfaction_survey');
    
    expect(template).toBeDefined();
    expect(template.type).toBe('satisfaction_survey');
    expect(template.name).toBe('Encuesta de Satisfacción');
    expect(template.collectFields.satisfaction_rating).toBeDefined();
  });

  it('should process template variables', () => {
    const template = 'Hola {customer_name}, tu póliza {policy_number} vence pronto.';
    const variables = {
      customer_name: 'Juan Pérez',
      policy_number: 'POL-2024-001'
    };
    
    const result = processTemplateVariables(template, variables);
    
    expect(result).toBe('Hola Juan Pérez, tu póliza POL-2024-001 vence pronto.');
  });

  it('should validate template variables', () => {
    const template = getCampaignTemplate('payment_reminder');
    const variables = {
      customer_name: 'Juan Pérez',
      company_name: 'GURO',
      policy_number: 'POL-001',
      payment_due_date: '2024-12-31',
      debt_amount: 125000,
      agent_name: 'Sofia'
    };
    
    const validation = validateTemplateVariables(template, variables);
    
    expect(validation.isValid).toBe(true);
    expect(validation.missingVariables).toHaveLength(0);
  });

  it('should detect missing variables', () => {
    const template = getCampaignTemplate('payment_reminder');
    const variables = {
      customer_name: 'Juan Pérez'
      // Faltan otras variables requeridas
    };
    
    const validation = validateTemplateVariables(template, variables);
    
    expect(validation.isValid).toBe(false);
    expect(validation.missingVariables.length).toBeGreaterThan(0);
  });
});

describe('Payment Reminder Campaign', () => {
  it('should create payment reminder campaign', () => {
    const campaign = createPaymentReminderCampaign({
      campaignName: 'Test Payment Reminder',
      contacts: [
        {
          name: 'Juan Pérez',
          phone: '+573001234567',
          email: 'juan@example.com',
          policy_number: 'POL-2024-001',
          debt_amount: 125000,
          payment_due_date: '2024-12-31'
        }
      ],
      agentId: 'agent-payment-reminder',
      agentName: 'Sofia',
      companyName: 'GURO Seguros'
    });

    expect(campaign).toBeDefined();
    expect(campaign.name).toBe('Test Payment Reminder');
    expect(campaign.contacts).toHaveLength(1);
    expect(campaign.contacts[0].custom_data?.policy_number).toBe('POL-2024-001');
    expect(campaign.settings?.post_call_tools?.whatsapp?.enabled).toBe(true);
  });

  it('should validate payment reminder contacts', () => {
    const contacts = [
      {
        name: 'Juan Pérez',
        phone: '+573001234567',
        policy_number: 'POL-2024-001',
        debt_amount: 125000,
        payment_due_date: '2024-12-31'
      }
    ];

    const validation = validateCampaignContacts('payment_reminder', contacts);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect missing payment reminder data', () => {
    const contacts = [
      {
        name: 'Juan Pérez',
        phone: '+573001234567'
        // Faltan policy_number, debt_amount, payment_due_date
      }
    ];

    const validation = validateCampaignContacts('payment_reminder', contacts);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

describe('Customer Welcome Campaign', () => {
  it('should create customer welcome campaign', () => {
    const campaign = createCustomerWelcomeCampaign({
      campaignName: 'Test Welcome Campaign',
      contacts: [
        {
          name: 'María García',
          phone: '+573009876543',
          email: 'maria@example.com',
          policy_number: 'POL-2024-002',
          insurance_type: 'Seguro de Vida',
          start_date: '2024-01-15'
        }
      ],
      agentId: 'agent-customer-welcome',
      agentName: 'Ana',
      companyName: 'GURO Seguros',
      appLink: 'https://app.guro.com',
      supportPhone: '+57 300 123 4567'
    });

    expect(campaign).toBeDefined();
    expect(campaign.name).toBe('Test Welcome Campaign');
    expect(campaign.contacts).toHaveLength(1);
    expect(campaign.contacts[0].custom_data?.insurance_type).toBe('Seguro de Vida');
    expect(campaign.settings?.post_call_tools?.whatsapp?.enabled).toBe(true);
    expect(campaign.settings?.post_call_tools?.email?.enabled).toBe(true);
  });

  it('should validate customer welcome contacts', () => {
    const contacts = [
      {
        name: 'María García',
        phone: '+573009876543',
        policy_number: 'POL-2024-002',
        insurance_type: 'Seguro de Vida',
        start_date: '2024-01-15'
      }
    ];

    const validation = validateCampaignContacts('customer_welcome', contacts);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('Satisfaction Survey Campaign', () => {
  it('should create satisfaction survey campaign', () => {
    const campaign = createSatisfactionSurveyCampaign({
      campaignName: 'Test Survey Campaign',
      contacts: [
        {
          name: 'Carlos Rodríguez',
          phone: '+573005551234',
          email: 'carlos@example.com',
          policy_number: 'POL-2024-003',
          last_service_date: '2024-01-10',
          interaction_type: 'Renovación de póliza'
        }
      ],
      agentId: 'agent-satisfaction-survey',
      agentName: 'Patricia',
      companyName: 'GURO Seguros'
    });

    expect(campaign).toBeDefined();
    expect(campaign.name).toBe('Test Survey Campaign');
    expect(campaign.contacts).toHaveLength(1);
    expect(campaign.contacts[0].custom_data?.interaction_type).toBe('Renovación de póliza');
    expect(campaign.settings?.post_call_tools?.whatsapp?.enabled).toBe(false);
    expect(campaign.settings?.post_call_tools?.email?.enabled).toBe(true);
  });

  it('should validate satisfaction survey contacts', () => {
    const contacts = [
      {
        name: 'Carlos Rodríguez',
        phone: '+573005551234',
        policy_number: 'POL-2024-003',
        last_service_date: '2024-01-10',
        interaction_type: 'Renovación de póliza'
      }
    ];

    const validation = validateCampaignContacts('satisfaction_survey', contacts);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('Example Configurations', () => {
  it('should get payment reminder example', () => {
    const example = getExampleCampaignConfig('payment_reminder');
    
    expect(example).toBeDefined();
    expect(example.contacts).toHaveLength(1);
    expect(example.contacts[0].debt_amount).toBeDefined();
  });

  it('should get customer welcome example', () => {
    const example = getExampleCampaignConfig('customer_welcome');
    
    expect(example).toBeDefined();
    expect(example.contacts).toHaveLength(1);
    expect(example.contacts[0].insurance_type).toBeDefined();
    expect(example.appLink).toBeDefined();
  });

  it('should get satisfaction survey example', () => {
    const example = getExampleCampaignConfig('satisfaction_survey');
    
    expect(example).toBeDefined();
    expect(example.contacts).toHaveLength(1);
    expect(example.contacts[0].last_service_date).toBeDefined();
  });
});

describe('Campaign Settings', () => {
  it('should include post-call tools for payment reminder', () => {
    const campaign = createPaymentReminderCampaign({
      campaignName: 'Test',
      contacts: [{
        name: 'Test',
        phone: '+573001234567',
        policy_number: 'POL-001',
        debt_amount: 100000,
        payment_due_date: '2024-12-31'
      }],
      agentId: 'agent-1'
    });

    expect(campaign.settings?.post_call_tools).toBeDefined();
    expect(campaign.settings?.post_call_tools?.collect).toBeDefined();
    expect(campaign.settings?.post_call_tools?.whatsapp).toBeDefined();
  });

  it('should include working hours configuration', () => {
    const campaign = createPaymentReminderCampaign({
      campaignName: 'Test',
      contacts: [{
        name: 'Test',
        phone: '+573001234567',
        policy_number: 'POL-001',
        debt_amount: 100000,
        payment_due_date: '2024-12-31'
      }],
      agentId: 'agent-1'
    });

    expect(campaign.settings?.working_hours).toBeDefined();
    expect(campaign.settings?.working_hours?.start).toBe('09:00');
    expect(campaign.settings?.working_hours?.end).toBe('18:00');
    expect(campaign.settings?.working_hours?.days).toContain('monday');
  });
});
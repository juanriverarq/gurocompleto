/**
 * Ejemplos prácticos de uso de campañas de voz
 * Este archivo contiene funciones listas para usar
 */

import voiceCampaignService from './voiceCampaignService';
import {
  createPaymentReminderCampaign,
  createCustomerWelcomeCampaign,
  createSatisfactionSurveyCampaign,
  validateCampaignContacts
} from './voiceCampaignHelper';

/**
 * Ejemplo 1: Crear y ejecutar campaña de recordatorio de pago
 */
export async function examplePaymentReminder() {
  console.log('📞 Ejemplo: Campaña de Recordatorio de Pago');
  
  // Datos de contactos con pagos pendientes
  const contacts = [
    {
      name: 'Juan Pérez',
      phone: '+573001234567',
      email: 'juan.perez@example.com',
      policy_number: 'POL-2024-001',
      debt_amount: 125000,
      payment_due_date: '2024-12-31'
    },
    {
      name: 'María García',
      phone: '+573009876543',
      email: 'maria.garcia@example.com',
      policy_number: 'POL-2024-002',
      debt_amount: 85000,
      payment_due_date: '2024-12-28'
    }
  ];

  // Validar datos antes de crear
  const validation = validateCampaignContacts('payment_reminder', contacts);
  if (!validation.isValid) {
    console.error('❌ Errores de validación:', validation.errors);
    return { success: false, errors: validation.errors };
  }

  // Crear campaña
  const campaignRequest = createPaymentReminderCampaign({
    campaignName: 'Recordatorio Diciembre 2024',
    contacts: contacts,
    agentId: 'agent-payment-reminder',
    agentName: 'Sofia',
    companyName: 'GURO Seguros',
    saveAsDraft: false // Cambiar a true para guardar como borrador
  });

  console.log('📋 Campaña configurada:', {
    nombre: campaignRequest.name,
    contactos: campaignRequest.contacts.length,
    tipo: campaignRequest.type
  });

  // Ejecutar campaña
  try {
    const result = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);
    
    if (result.success) {
      console.log('✅ Campaña creada y ejecutada exitosamente');
      console.log('📊 Detalles:', result.campaign);
      return result;
    } else {
      console.error('❌ Error al crear campaña:', result.message);
      return result;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Ejemplo 2: Crear campaña de bienvenida para nuevos clientes
 */
export async function exampleCustomerWelcome() {
  console.log('👋 Ejemplo: Campaña de Bienvenida al Cliente');
  
  const newCustomers = [
    {
      name: 'Carlos Rodríguez',
      phone: '+573005551234',
      email: 'carlos.rodriguez@example.com',
      policy_number: 'POL-2024-003',
      insurance_type: 'Seguro de Vida',
      start_date: '2024-01-15'
    },
    {
      name: 'Laura Martínez',
      phone: '+573007778888',
      email: 'laura.martinez@example.com',
      policy_number: 'POL-2024-004',
      insurance_type: 'Seguro de Automóvil',
      start_date: '2024-01-16'
    }
  ];

  // Validar datos
  const validation = validateCampaignContacts('customer_welcome', newCustomers);
  if (!validation.isValid) {
    console.error('❌ Errores de validación:', validation.errors);
    return { success: false, errors: validation.errors };
  }

  // Crear campaña
  const campaignRequest = createCustomerWelcomeCampaign({
    campaignName: 'Bienvenida Nuevos Clientes - Enero 2024',
    contacts: newCustomers,
    agentId: 'agent-customer-welcome',
    agentName: 'Ana',
    companyName: 'GURO Seguros',
    appLink: 'https://app.guro.com',
    supportPhone: '+57 300 123 4567',
    saveAsDraft: false
  });

  console.log('📋 Campaña configurada:', {
    nombre: campaignRequest.name,
    contactos: campaignRequest.contacts.length,
    tipo: campaignRequest.type
  });

  // Ejecutar campaña
  try {
    const result = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);
    
    if (result.success) {
      console.log('✅ Campaña de bienvenida creada exitosamente');
      console.log('📊 Detalles:', result.campaign);
      return result;
    } else {
      console.error('❌ Error al crear campaña:', result.message);
      return result;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Ejemplo 3: Crear campaña de encuesta de satisfacción
 */
export async function exampleSatisfactionSurvey() {
  console.log('📊 Ejemplo: Campaña de Encuesta de Satisfacción');
  
  const recentCustomers = [
    {
      name: 'Patricia López',
      phone: '+573003334444',
      email: 'patricia.lopez@example.com',
      policy_number: 'POL-2024-005',
      last_service_date: '2024-01-10',
      interaction_type: 'Renovación de póliza'
    },
    {
      name: 'Roberto Sánchez',
      phone: '+573006667777',
      email: 'roberto.sanchez@example.com',
      policy_number: 'POL-2024-006',
      last_service_date: '2024-01-12',
      interaction_type: 'Atención de siniestro'
    }
  ];

  // Validar datos
  const validation = validateCampaignContacts('satisfaction_survey', recentCustomers);
  if (!validation.isValid) {
    console.error('❌ Errores de validación:', validation.errors);
    return { success: false, errors: validation.errors };
  }

  // Crear campaña
  const campaignRequest = createSatisfactionSurveyCampaign({
    campaignName: 'Encuesta Post-Servicio - Enero 2024',
    contacts: recentCustomers,
    agentId: 'agent-satisfaction-survey',
    agentName: 'Patricia',
    companyName: 'GURO Seguros',
    saveAsDraft: false
  });

  console.log('📋 Campaña configurada:', {
    nombre: campaignRequest.name,
    contactos: campaignRequest.contacts.length,
    tipo: campaignRequest.type
  });

  // Ejecutar campaña
  try {
    const result = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);
    
    if (result.success) {
      console.log('✅ Campaña de encuesta creada exitosamente');
      console.log('📊 Detalles:', result.campaign);
      return result;
    } else {
      console.error('❌ Error al crear campaña:', result.message);
      return result;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Ejemplo 4: Guardar campaña como borrador para revisión
 */
export async function exampleSaveDraft() {
  console.log('💾 Ejemplo: Guardar Campaña como Borrador');
  
  const contacts = [
    {
      name: 'Test Cliente',
      phone: '+573001111111',
      email: 'test@example.com',
      policy_number: 'POL-TEST-001',
      debt_amount: 50000,
      payment_due_date: '2024-12-31'
    }
  ];

  const campaignRequest = createPaymentReminderCampaign({
    campaignName: 'Borrador - Prueba de Campaña',
    contacts: contacts,
    agentId: 'agent-payment-reminder',
    agentName: 'Sofia',
    companyName: 'GURO Seguros',
    saveAsDraft: true // Guardar como borrador
  });

  try {
    const result = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);
    
    if (result.success) {
      console.log('✅ Campaña guardada como borrador');
      console.log('📝 Puedes revisarla y ejecutarla después');
      return result;
    } else {
      console.error('❌ Error al guardar borrador:', result.message);
      return result;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Ejemplo 5: Obtener estadísticas de campañas
 */
export async function exampleGetStats() {
  console.log('📈 Ejemplo: Obtener Estadísticas de Campañas');
  
  try {
    const stats = await voiceCampaignService.getVoiceCampaignStats();
    
    if (stats.success && stats.stats) {
      console.log('✅ Estadísticas obtenidas:');
      console.log('  - Total de campañas:', stats.stats.total_campaigns);
      console.log('  - Campañas activas:', stats.stats.active_campaigns);
      console.log('  - Total de llamadas:', stats.stats.total_calls);
      console.log('  - Llamadas exitosas:', stats.stats.successful_calls);
      console.log('  - Tasa de éxito:', stats.stats.overall_success_rate + '%');
      return stats;
    } else {
      console.error('❌ Error al obtener estadísticas:', stats.message);
      return stats;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Ejemplo 6: Obtener historial de llamadas
 */
export async function exampleGetCallHistory() {
  console.log('📞 Ejemplo: Obtener Historial de Llamadas');
  
  try {
    const history = await voiceCampaignService.getCallHistory({
      limit: 10,
      offset: 0
    });
    
    if (history.success && history.calls) {
      console.log(`✅ Historial obtenido: ${history.calls.length} llamadas`);
      
      history.calls.forEach((call, index) => {
        console.log(`\n  Llamada ${index + 1}:`);
        console.log(`    - Destinatario: ${call.recipient_name || 'N/A'}`);
        console.log(`    - Teléfono: ${call.recipient_phone || 'N/A'}`);
        console.log(`    - Estado: ${call.status}`);
        console.log(`    - Duración: ${call.duration_seconds || 0}s`);
      });
      
      return history;
    } else {
      console.error('❌ Error al obtener historial:', history.message);
      return history;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return { success: false, message: 'Error inesperado', error };
  }
}

/**
 * Función helper para ejecutar todos los ejemplos en secuencia
 */
export async function runAllExamples() {
  console.log('🚀 Ejecutando todos los ejemplos...\n');
  
  // Nota: En producción, no ejecutar todos a la vez
  // Estos son solo ejemplos demostrativos
  
  console.log('='.repeat(50));
  await exampleGetStats();
  
  console.log('\n' + '='.repeat(50));
  await exampleGetCallHistory();
  
  console.log('\n' + '='.repeat(50));
  console.log('⚠️  Los siguientes ejemplos crearían campañas reales');
  console.log('⚠️  Descomenta para ejecutar en entorno de pruebas\n');
  
  // Descomentar para ejecutar campañas de prueba:
  // await exampleSaveDraft();
  // await examplePaymentReminder();
  // await exampleCustomerWelcome();
  // await exampleSatisfactionSurvey();
  
  console.log('\n✅ Ejemplos completados');
}

// Exportar todas las funciones de ejemplo
export default {
  examplePaymentReminder,
  exampleCustomerWelcome,
  exampleSatisfactionSurvey,
  exampleSaveDraft,
  exampleGetStats,
  exampleGetCallHistory,
  runAllExamples
};
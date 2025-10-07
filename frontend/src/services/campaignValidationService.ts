import { Cliente } from './clienteService';

// Tipos para validaciones
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PhoneValidationResult extends ValidationResult {
  formattedPhone?: string;
  country?: string;
}

export interface MessageValidationResult extends ValidationResult {
  characterCount: number;
  variableCount: number;
  missingVariables: string[];
  invalidVariables: string[];
}

export interface DateValidationResult extends ValidationResult {
  parsedDate?: Date;
  timezone?: string;
}

// Constantes de validación
const WHATSAPP_MAX_CHARACTERS = 4096;
const MIN_SCHEDULE_MINUTES = 5; // Mínimo 5 minutos en el futuro
const MAX_SCHEDULE_DAYS = 30; // Máximo 30 días en el futuro

// Variables válidas para mensajes
const VALID_MESSAGE_VARIABLES = [
  'nombre',
  'apellidos',
  'email_principal',
  'celular_principal',
  'cuit',
  'fecha_nacimiento',
  'direccion',
  'ciudad',
  'ocupacion',
  'tipo_cliente',
  'estado'
];

// Patrones de validación
const PHONE_PATTERNS = {
  // Colombia: +57 XXX XXX XXXX
  CO: /^(\+57|57)?[\s-]?([1-9]\d{2})[\s-]?(\d{3})[\s-]?(\d{4})$/,
  // México: +52 XXX XXX XXXX
  MX: /^(\+52|52)?[\s-]?([1-9]\d{2})[\s-]?(\d{3})[\s-]?(\d{4})$/,
  // Argentina: +54 XXX XXX XXXX
  AR: /^(\+54|54)?[\s-]?([1-9]\d{2})[\s-]?(\d{3})[\s-]?(\d{4})$/,
  // Genérico internacional
  INTERNATIONAL: /^(\+\d{1,3})[\s-]?(\d{1,4})[\s-]?(\d{1,4})[\s-]?(\d{1,4})[\s-]?(\d{0,4})$/
};

class CampaignValidationService {
  
  /**
   * Valida formato de teléfono internacional
   */
  validatePhone(phone: string, defaultCountry: string = 'CO'): PhoneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!phone || phone.trim().length === 0) {
      errors.push('El número de teléfono es requerido');
      return { isValid: false, errors, warnings };
    }

    const cleanPhone = phone.replace(/[\s-()]/g, '');
    
    // Validar longitud mínima
    if (cleanPhone.length < 8) {
      errors.push('El número de teléfono es demasiado corto');
    }

    // Validar longitud máxima
    if (cleanPhone.length > 15) {
      errors.push('El número de teléfono es demasiado largo');
    }

    // Validar que solo contenga números y símbolos válidos
    if (!/^[\+\d\s\-()]+$/.test(phone)) {
      errors.push('El número de teléfono contiene caracteres inválidos');
    }

    let formattedPhone: string | undefined;
    let country: string | undefined;

    // Intentar validar con patrones específicos
    const patterns = Object.entries(PHONE_PATTERNS);
    let matched = false;

    for (const [countryCode, pattern] of patterns) {
      const match = cleanPhone.match(pattern);
      if (match) {
        matched = true;
        country = countryCode;
        
        // Formatear según el país
        if (countryCode === 'CO') {
          const prefix = match[1] || '+57';
          formattedPhone = `${prefix} ${match[2]} ${match[3]} ${match[4]}`;
        } else if (countryCode === 'INTERNATIONAL') {
          formattedPhone = `${match[1]} ${match[2]} ${match[3]} ${match[4]}${match[5] ? ' ' + match[5] : ''}`;
        }
        break;
      }
    }

    if (!matched) {
      // Si no coincide con ningún patrón, intentar formato genérico
      if (cleanPhone.startsWith('+')) {
        formattedPhone = cleanPhone;
        country = 'INTERNATIONAL';
        warnings.push('Formato de teléfono no reconocido, se usará tal como está');
      } else {
        errors.push('Formato de teléfono inválido. Use formato internacional (+57 XXX XXX XXXX)');
      }
    }

    // Validar que empiece con +
    if (formattedPhone && !formattedPhone.startsWith('+')) {
      warnings.push('Se recomienda usar el formato internacional con + al inicio');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      formattedPhone,
      country
    };
  }

  /**
   * Valida el contenido del mensaje
   */
  validateMessage(message: string, selectedClients: Cliente[] = []): MessageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!message || message.trim().length === 0) {
      errors.push('El mensaje es requerido');
      return { 
        isValid: false, 
        errors, 
        warnings, 
        characterCount: 0, 
        variableCount: 0,
        missingVariables: [],
        invalidVariables: []
      };
    }

    const characterCount = message.length;
    
    // Validar longitud máxima de WhatsApp
    if (characterCount > WHATSAPP_MAX_CHARACTERS) {
      errors.push(`El mensaje excede el límite de ${WHATSAPP_MAX_CHARACTERS} caracteres (actual: ${characterCount})`);
    }

    // Advertir si se acerca al límite
    if (characterCount > WHATSAPP_MAX_CHARACTERS * 0.9) {
      warnings.push(`El mensaje está cerca del límite de caracteres (${characterCount}/${WHATSAPP_MAX_CHARACTERS})`);
    }

    // Extraer variables del mensaje
    const variableMatches = message.match(/\{([^}]+)\}/g) || [];
    const variables = variableMatches.map(match => match.slice(1, -1));
    const uniqueVariables = [...new Set(variables)];
    
    const variableCount = uniqueVariables.length;
    const invalidVariables: string[] = [];
    const missingVariables: string[] = [];

    // Validar variables
    uniqueVariables.forEach(variable => {
      if (!VALID_MESSAGE_VARIABLES.includes(variable)) {
        invalidVariables.push(variable);
      }
    });

    // Si hay clientes seleccionados, verificar que tengan datos para las variables
    if (selectedClients.length > 0) {
      uniqueVariables.forEach(variable => {
        const clientsWithoutData = selectedClients.filter(client => {
          const value = (client as any)[variable];
          return !value || value.toString().trim() === '';
        });

        if (clientsWithoutData.length > 0) {
          missingVariables.push(variable);
          warnings.push(`${clientsWithoutData.length} cliente(s) no tienen datos para la variable {${variable}}`);
        }
      });
    }

    // Errores por variables inválidas
    if (invalidVariables.length > 0) {
      errors.push(`Variables inválidas encontradas: {${invalidVariables.join('}, {')}}`);
    }

    // Validar contenido del mensaje
    if (message.trim().length < 10) {
      warnings.push('El mensaje es muy corto, considere agregar más contenido');
    }

    // Detectar posibles problemas de formato
    if (message.includes('{{') || message.includes('}}')) {
      errors.push('Variables mal formateadas detectadas. Use {variable} en lugar de {{variable}}');
    }

    // Detectar variables sin cerrar
    const openBraces = (message.match(/\{/g) || []).length;
    const closeBraces = (message.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Variables mal formateadas: llaves no balanceadas');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      characterCount,
      variableCount,
      missingVariables,
      invalidVariables
    };
  }

  /**
   * Valida fecha de programación
   */
  validateScheduledDate(dateString: string, timezone: string = 'America/Bogota'): DateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dateString || dateString.trim().length === 0) {
      errors.push('La fecha de programación es requerida');
      return { isValid: false, errors, warnings };
    }

    let parsedDate: Date;
    
    try {
      parsedDate = new Date(dateString);
      
      if (isNaN(parsedDate.getTime())) {
        errors.push('Formato de fecha inválido');
        return { isValid: false, errors, warnings };
      }
    } catch (error) {
      errors.push('Error al procesar la fecha');
      return { isValid: false, errors, warnings };
    }

    const now = new Date();
    const minDate = new Date(now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    const maxDate = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);

    // Validar que sea fecha futura
    if (parsedDate <= now) {
      errors.push('La fecha debe ser en el futuro');
    }

    // Validar tiempo mínimo
    if (parsedDate < minDate) {
      errors.push(`La fecha debe ser al menos ${MIN_SCHEDULE_MINUTES} minutos en el futuro`);
    }

    // Validar tiempo máximo
    if (parsedDate > maxDate) {
      errors.push(`La fecha no puede ser más de ${MAX_SCHEDULE_DAYS} días en el futuro`);
    }

    // Advertencias por horarios
    const hour = parsedDate.getHours();
    if (hour < 8 || hour > 20) {
      warnings.push('Se recomienda programar entre las 8:00 AM y 8:00 PM para mejor recepción');
    }

    // Advertencia por fines de semana
    const dayOfWeek = parsedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push('Programado para fin de semana, considere un día laboral para mejor respuesta');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      parsedDate,
      timezone
    };
  }

  /**
   * Valida selección de clientes
   */
  validateClientSelection(
    clients: Cliente[], 
    selectAllClients: boolean, 
    selectedClients: Cliente[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (selectAllClients) {
      const clientsWithPhone = clients.filter(client => client.celular_principal);
      
      if (clientsWithPhone.length === 0) {
        errors.push('No hay clientes con número de teléfono válido');
      } else if (clientsWithPhone.length < clients.length) {
        const withoutPhone = clients.length - clientsWithPhone.length;
        warnings.push(`${withoutPhone} cliente(s) no tienen teléfono y no recibirán mensajes`);
      }

      if (clientsWithPhone.length > 1000) {
        warnings.push(`Campaña masiva con ${clientsWithPhone.length} destinatarios. Considere dividir en lotes más pequeños`);
      }
    } else {
      if (selectedClients.length === 0) {
        errors.push('Debe seleccionar al menos un cliente');
      }

      const selectedWithPhone = selectedClients.filter(client => client.celular_principal);
      
      if (selectedWithPhone.length === 0) {
        errors.push('Ningún cliente seleccionado tiene número de teléfono válido');
      } else if (selectedWithPhone.length < selectedClients.length) {
        const withoutPhone = selectedClients.length - selectedWithPhone.length;
        warnings.push(`${withoutPhone} cliente(s) seleccionado(s) no tienen teléfono válido`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validación completa de campaña
   */
  validateCampaign(campaignData: {
    name: string;
    type: string;
    message_template: string;
    scheduled_date?: string;
    selectedClients: Cliente[];
    selectAllClients: boolean;
    allClients: Cliente[];
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar nombre
    if (!campaignData.name || campaignData.name.trim().length === 0) {
      errors.push('El nombre de la campaña es requerido');
    } else if (campaignData.name.length > 100) {
      errors.push('El nombre de la campaña no puede exceder 100 caracteres');
    }

    // Validar mensaje
    const messageValidation = this.validateMessage(
      campaignData.message_template, 
      campaignData.selectAllClients ? campaignData.allClients : campaignData.selectedClients
    );
    errors.push(...messageValidation.errors);
    warnings.push(...messageValidation.warnings);

    // Validar fecha si es campaña programada
    if (campaignData.type === 'scheduled') {
      if (!campaignData.scheduled_date) {
        errors.push('La fecha de programación es requerida para campañas programadas');
      } else {
        const dateValidation = this.validateScheduledDate(campaignData.scheduled_date);
        errors.push(...dateValidation.errors);
        warnings.push(...dateValidation.warnings);
      }
    }

    // Validar selección de clientes
    const clientValidation = this.validateClientSelection(
      campaignData.allClients,
      campaignData.selectAllClients,
      campaignData.selectedClients
    );
    errors.push(...clientValidation.errors);
    warnings.push(...clientValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Obtiene sugerencias para mejorar el mensaje
   */
  getMessageSuggestions(message: string): string[] {
    const suggestions: string[] = [];

    if (message.length < 50) {
      suggestions.push('Considere agregar más contexto al mensaje para mayor claridad');
    }

    if (!message.includes('{nombre}')) {
      suggestions.push('Agregar {nombre} hace el mensaje más personal');
    }

    if (message.includes('http://') && !message.includes('https://')) {
      suggestions.push('Use enlaces HTTPS para mayor seguridad');
    }

    if (message.toUpperCase() === message && message.length > 20) {
      suggestions.push('Evite escribir todo en mayúsculas');
    }

    const exclamationCount = (message.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      suggestions.push('Reduzca el uso de signos de exclamación para un tono más profesional');
    }

    return suggestions;
  }

  /**
   * Obtiene las variables válidas disponibles
   */
  getAvailableVariables(): Array<{key: string, label: string, example: string}> {
    return [
      { key: 'nombre', label: 'Nombre', example: 'Juan' },
      { key: 'apellidos', label: 'Apellidos', example: 'García' },
      { key: 'email_principal', label: 'Email', example: 'juan@email.com' },
      { key: 'celular_principal', label: 'Celular', example: '+57 300 123 4567' },
      { key: 'cuit', label: 'CUIT/Documento', example: '12345678' },
      { key: 'fecha_nacimiento', label: 'Fecha Nacimiento', example: '1990-05-15' },
      { key: 'direccion', label: 'Dirección', example: 'Calle 123' },
      { key: 'ciudad', label: 'Ciudad', example: 'Bogotá' },
      { key: 'ocupacion', label: 'Ocupación', example: 'Ingeniero' },
      { key: 'tipo_cliente', label: 'Tipo Cliente', example: 'Premium' },
      { key: 'estado', label: 'Estado', example: 'Activo' }
    ];
  }
}

export const campaignValidationService = new CampaignValidationService();
export default campaignValidationService;
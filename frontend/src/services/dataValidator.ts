// Sistema avanzado de validación de datos extraídos de pólizas
// Implementa validación cruzada y reglas de negocio específicas

export interface ValidationResult {
  field: string;
  isValid: boolean;
  confidence: number;
  errors: string[];
  suggestions?: string[];
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationContext {
  extractedData: Record<string, any>;
  documentMetadata?: any;
  historicalData?: any[];
}

export interface ValidationRule {
  field: string;
  validators: Array<(value: string, context: ValidationContext) => Promise<ValidationResult>>;
  dependencies?: string[];
  priority: number;
}

export class DataValidator {
  private rules: ValidationRule[];

  constructor() {
    this.rules = this.initializeValidationRules();
  }

  async validateAllFields(data: Record<string, any>, context: ValidationContext = { extractedData: data }): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Ejecutar validaciones en orden de prioridad
    const sortedRules = this.rules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      const value = data[rule.field];
      if (value && value.toString().trim() !== '') {
        const fieldResults = await this.validateField(rule.field, value, context);
        results.push(...fieldResults);
      }
    }

    // Validaciones cruzadas
    const crossValidations = await this.performCrossValidations(data, context);
    results.push(...crossValidations);

    return results;
  }

  async validateField(field: string, value: string, context: ValidationContext): Promise<ValidationResult[]> {
    const rule = this.rules.find(r => r.field === field);
    if (!rule) {
      return [{
        field,
        isValid: true,
        confidence: 0.5,
        errors: [],
        severity: 'info' as const
      }];
    }

    const results: ValidationResult[] = [];
    
    for (const validator of rule.validators) {
      try {
        const result = await validator(value, context);
        results.push(result);
      } catch (error) {
        results.push({
          field,
          isValid: false,
          confidence: 0,
          errors: [`Error en validación: ${(error as Error).message}`],
          severity: 'error' as const
        });
      }
    }

    return results;
  }

  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        field: 'numeroPoliza',
        validators: [
          this.validatePolicyNumberFormat.bind(this),
          this.validatePolicyNumberChecksum.bind(this),
          this.validatePolicyNumberUniqueness.bind(this)
        ],
        priority: 10
      },
      {
        field: 'aseguradora',
        validators: [
          this.validateInsurerName.bind(this),
          this.validateInsurerExists.bind(this)
        ],
        priority: 9
      },
      {
        field: 'ramo',
        validators: [
          this.validateInsuranceBranch.bind(this),
          this.validateBranchCompatibility.bind(this)
        ],
        dependencies: ['aseguradora'],
        priority: 8
      },
      {
        field: 'fechaInicio',
        validators: [
          this.validateDateFormat.bind(this),
          this.validateBusinessDate.bind(this)
        ],
        priority: 7
      },
      {
        field: 'fechaFin',
        validators: [
          this.validateDateFormat.bind(this),
          this.validateEndDateLogic.bind(this)
        ],
        dependencies: ['fechaInicio'],
        priority: 7
      },
      {
        field: 'fechaExpedicion',
        validators: [
          this.validateDateFormat.bind(this),
          this.validateIssueDateLogic.bind(this)
        ],
        dependencies: ['fechaInicio'],
        priority: 6
      },
      {
        field: 'primaNeta',
        validators: [
          this.validateAmountFormat.bind(this),
          this.validateAmountRange.bind(this)
        ],
        priority: 8
      },
      {
        field: 'iva',
        validators: [
          this.validateAmountFormat.bind(this),
          this.validateIVACalculation.bind(this)
        ],
        dependencies: ['primaNeta'],
        priority: 7
      },
      {
        field: 'total',
        validators: [
          this.validateAmountFormat.bind(this),
          this.validateTotalCalculation.bind(this)
        ],
        dependencies: ['primaNeta', 'iva'],
        priority: 7
      },
      {
        field: 'clienteCedula',
        validators: [
          this.validateCedulaFormat.bind(this),
          this.validateCedulaCheckDigit.bind(this)
        ],
        priority: 6
      },
      {
        field: 'clienteEmail',
        validators: [
          this.validateEmailFormat.bind(this),
          this.validateEmailDomain.bind(this)
        ],
        priority: 5
      },
      {
        field: 'clienteTelefono',
        validators: [
          this.validatePhoneFormat.bind(this),
          this.validateColombianPhone.bind(this)
        ],
        priority: 4
      }
    ];
  }

  // ===== VALIDADORES ESPECÍFICOS =====

  private async validatePolicyNumberFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    const patterns = [
      /^[A-Za-z0-9\-_]{5,50}$/, // Patrón general
      /^\d{10,20}$/, // Solo números
      /^[A-Z]{2,4}\d{6,15}$/, // Letras + números
      /^[A-Z]{2,4}-\d{6,15}$/ // Letras + guión + números
    ];

    const isValid = patterns.some(pattern => pattern.test(value));
    
    return {
      field: 'numeroPoliza',
      isValid,
      confidence: isValid ? 0.9 : 0.2,
      errors: isValid ? [] : ['Formato de número de póliza no reconocido'],
      suggestions: isValid ? [] : ['Verifique que el número esté completo y sin caracteres especiales'],
      severity: isValid ? 'info' : 'warning'
    };
  }

  private async validatePolicyNumberChecksum(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Implementación futura para validar dígitos de verificación específicos por aseguradora
    return {
      field: 'numeroPoliza',
      isValid: true,
      confidence: 0.7,
      errors: [],
      severity: 'info'
    };
  }

  private async validatePolicyNumberUniqueness(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Implementación futura para verificar unicidad en base de datos
    return {
      field: 'numeroPoliza',
      isValid: true,
      confidence: 0.8,
      errors: [],
      severity: 'info'
    };
  }

  private async validateInsurerName(value: string, context: ValidationContext): Promise<ValidationResult> {
    const knownInsurers = [
      'SURA', 'SURAMERICANA', 'SEGUROS SURA',
      'BOLIVAR', 'SEGUROS BOLIVAR', 
      'MAPFRE', 'SEGUROS MAPFRE',
      'LIBERTY', 'SEGUROS LIBERTY',
      'AXA COLPATRIA', 'COLPATRIA', 'AXA',
      'ALLIANZ', 'SEGUROS ALLIANZ',
      'QBE', 'SEGUROS QBE',
      'MUNDIAL', 'SEGUROS MUNDIAL',
      'EQUIDAD', 'LA EQUIDAD', 'SEGUROS EQUIDAD',
      'PREVISORA', 'SEGUROS PREVISORA',
      'GENERALI', 'SEGUROS GENERALI',
      'HDI', 'SEGUROS HDI',
      'ZURICH', 'SEGUROS ZURICH'
    ];

    const normalizedValue = value.toUpperCase().trim();
    const isKnown = knownInsurers.some(insurer => 
      normalizedValue.includes(insurer) || insurer.includes(normalizedValue)
    );

    return {
      field: 'aseguradora',
      isValid: isKnown,
      confidence: isKnown ? 0.95 : 0.3,
      errors: isKnown ? [] : ['Aseguradora no reconocida en el sistema'],
      suggestions: isKnown ? [] : ['Verifique el nombre de la aseguradora'],
      severity: isKnown ? 'info' : 'warning'
    };
  }

  private async validateInsurerExists(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Implementación futura para verificar en base de datos
    return {
      field: 'aseguradora',
      isValid: true,
      confidence: 0.7,
      errors: [],
      severity: 'info'
    };
  }

  private async validateInsuranceBranch(value: string, context: ValidationContext): Promise<ValidationResult> {
    const knownBranches = [
      'VIDA', 'SEGURO DE VIDA', 'VIDA INDIVIDUAL', 'VIDA GRUPO',
      'SALUD', 'SEGURO DE SALUD', 'MEDICINA PREPAGADA',
      'VEHICULOS', 'AUTOMOVILES', 'AUTO', 'TODO RIESGO',
      'SOAT', 'SEGURO OBLIGATORIO', 'ACCIDENTES DE TRANSITO',
      'HOGAR', 'SEGURO DE HOGAR', 'MULTIRIESGO HOGAR',
      'PYME', 'SEGURO PYME', 'EMPRESARIAL', 'COMERCIAL',
      'RESPONSABILIDAD CIVIL', 'RC GENERAL', 'RC PROFESIONAL',
      'ACCIDENTES PERSONALES', 'SEGURO DE ACCIDENTES'
    ];

    const normalizedValue = value.toUpperCase().trim();
    const isKnown = knownBranches.some(branch => 
      normalizedValue.includes(branch) || branch.includes(normalizedValue)
    );

    return {
      field: 'ramo',
      isValid: isKnown,
      confidence: isKnown ? 0.9 : 0.4,
      errors: isKnown ? [] : ['Ramo de seguro no reconocido'],
      suggestions: isKnown ? [] : ['Verifique el tipo de seguro'],
      severity: isKnown ? 'info' : 'warning'
    };
  }

  private async validateBranchCompatibility(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Validar que el ramo sea compatible con la aseguradora
    // Implementación futura basada en productos disponibles por aseguradora
    return {
      field: 'ramo',
      isValid: true,
      confidence: 0.7,
      errors: [],
      severity: 'info'
    };
  }

  private async validateDateFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/ // DD-MM-YYYY
    ];

    const isValidFormat = dateFormats.some(format => format.test(value));
    
    if (!isValidFormat) {
      return {
        field: 'fecha',
        isValid: false,
        confidence: 0.1,
        errors: ['Formato de fecha no reconocido'],
        suggestions: ['Use formato YYYY-MM-DD, DD/MM/YYYY o DD-MM-YYYY'],
        severity: 'error'
      };
    }

    // Intentar parsear la fecha
    let date: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date = new Date(value);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      date = new Date(`${year}-${month}-${day}`);
    } else {
      const [day, month, year] = value.split('-');
      date = new Date(`${year}-${month}-${day}`);
    }

    const isValidDate = !isNaN(date.getTime());
    
    return {
      field: 'fecha',
      isValid: isValidDate,
      confidence: isValidDate ? 0.95 : 0.1,
      errors: isValidDate ? [] : ['Fecha inválida'],
      severity: isValidDate ? 'info' : 'error'
    };
  }

  private async validateBusinessDate(value: string, context: ValidationContext): Promise<ValidationResult> {
    const date = new Date(value);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

    const isReasonable = date >= oneYearAgo && date <= twoYearsFromNow;
    
    return {
      field: 'fecha',
      isValid: isReasonable,
      confidence: isReasonable ? 0.8 : 0.3,
      errors: isReasonable ? [] : ['Fecha fuera del rango esperado para pólizas'],
      suggestions: isReasonable ? [] : ['Verifique que la fecha sea correcta'],
      severity: isReasonable ? 'info' : 'warning'
    };
  }

  private async validateEndDateLogic(value: string, context: ValidationContext): Promise<ValidationResult> {
    const startDate = context.extractedData.fechaInicio;
    if (!startDate) {
      return {
        field: 'fechaFin',
        isValid: true,
        confidence: 0.5,
        errors: [],
        severity: 'info'
      };
    }

    const endDate = new Date(value);
    const startDateObj = new Date(startDate);
    
    const isAfterStart = endDate > startDateObj;
    const daysDifference = Math.ceil((endDate.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24));
    
    // Validar que la vigencia sea razonable (entre 30 días y 5 años)
    const isReasonableDuration = daysDifference >= 30 && daysDifference <= (5 * 365);
    
    const errors: string[] = [];
    if (!isAfterStart) errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
    if (!isReasonableDuration) errors.push('La duración de la póliza parece inusual');

    return {
      field: 'fechaFin',
      isValid: isAfterStart && isReasonableDuration,
      confidence: (isAfterStart && isReasonableDuration) ? 0.9 : 0.2,
      errors,
      suggestions: errors.length > 0 ? ['Verifique las fechas de vigencia'] : [],
      severity: errors.length > 0 ? 'error' : 'info'
    };
  }

  private async validateIssueDateLogic(value: string, context: ValidationContext): Promise<ValidationResult> {
    const issueDate = new Date(value);
    const startDate = context.extractedData.fechaInicio ? new Date(context.extractedData.fechaInicio) : null;
    
    if (!startDate) {
      return {
        field: 'fechaExpedicion',
        isValid: true,
        confidence: 0.5,
        errors: [],
        severity: 'info'
      };
    }

    // La fecha de expedición debe ser anterior o igual a la fecha de inicio
    const isLogical = issueDate <= startDate;
    
    // No debe ser muy anterior (máximo 90 días)
    const daysDifference = Math.ceil((startDate.getTime() - issueDate.getTime()) / (1000 * 3600 * 24));
    const isReasonable = daysDifference >= 0 && daysDifference <= 90;

    return {
      field: 'fechaExpedicion',
      isValid: isLogical && isReasonable,
      confidence: (isLogical && isReasonable) ? 0.85 : 0.3,
      errors: (isLogical && isReasonable) ? [] : ['La fecha de expedición parece incorrecta'],
      suggestions: (isLogical && isReasonable) ? [] : ['La expedición debe ser antes o igual al inicio de vigencia'],
      severity: (isLogical && isReasonable) ? 'info' : 'warning'
    };
  }

  private async validateAmountFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Limpiar el valor de caracteres no numéricos
    const cleanValue = value.replace(/[^\d.,]/g, '');
    const numValue = parseFloat(cleanValue.replace(/,/g, ''));
    
    const isValid = !isNaN(numValue) && numValue >= 0;
    
    return {
      field: 'monto',
      isValid,
      confidence: isValid ? 0.9 : 0.1,
      errors: isValid ? [] : ['Formato de monto inválido'],
      suggestions: isValid ? [] : ['Verifique que el monto sea un número válido'],
      severity: isValid ? 'info' : 'error'
    };
  }

  private async validateAmountRange(value: string, context: ValidationContext): Promise<ValidationResult> {
    const numValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(/,/g, ''));
    
    // Rangos razonables para primas en Colombia (en COP)
    const minPremium = 50000; // $50,000 COP
    const maxPremium = 500000000; // $500,000,000 COP
    
    const isInRange = numValue >= minPremium && numValue <= maxPremium;
    
    return {
      field: 'monto',
      isValid: isInRange,
      confidence: isInRange ? 0.8 : 0.4,
      errors: isInRange ? [] : ['El monto está fuera del rango esperado'],
      suggestions: isInRange ? [] : ['Verifique que el monto sea correcto'],
      severity: isInRange ? 'info' : 'warning'
    };
  }

  private async validateIVACalculation(value: string, context: ValidationContext): Promise<ValidationResult> {
    const ivaValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(/,/g, ''));
    const primaValue = parseFloat((context.extractedData.primaNeta || '0').replace(/[^\d.,]/g, '').replace(/,/g, ''));
    
    if (primaValue === 0) {
      return {
        field: 'iva',
        isValid: true,
        confidence: 0.5,
        errors: [],
        severity: 'info'
      };
    }

    // IVA en Colombia es 19%
    const expectedIVA = primaValue * 0.19;
    const tolerance = expectedIVA * 0.05; // 5% de tolerancia
    
    const isCorrect = Math.abs(ivaValue - expectedIVA) <= tolerance;
    
    return {
      field: 'iva',
      isValid: isCorrect,
      confidence: isCorrect ? 0.9 : 0.3,
      errors: isCorrect ? [] : [`IVA calculado: ${expectedIVA.toFixed(0)}, extraído: ${ivaValue.toFixed(0)}`],
      suggestions: isCorrect ? [] : ['Verifique el cálculo del IVA (19%)'],
      severity: isCorrect ? 'info' : 'warning'
    };
  }

  private async validateTotalCalculation(value: string, context: ValidationContext): Promise<ValidationResult> {
    const totalValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(/,/g, ''));
    const primaValue = parseFloat((context.extractedData.primaNeta || '0').replace(/[^\d.,]/g, '').replace(/,/g, ''));
    const ivaValue = parseFloat((context.extractedData.iva || '0').replace(/[^\d.,]/g, '').replace(/,/g, ''));
    
    if (primaValue === 0) {
      return {
        field: 'total',
        isValid: true,
        confidence: 0.5,
        errors: [],
        severity: 'info'
      };
    }

    const expectedTotal = primaValue + ivaValue;
    const tolerance = expectedTotal * 0.02; // 2% de tolerancia
    
    const isCorrect = Math.abs(totalValue - expectedTotal) <= tolerance;
    
    return {
      field: 'total',
      isValid: isCorrect,
      confidence: isCorrect ? 0.9 : 0.3,
      errors: isCorrect ? [] : [`Total calculado: ${expectedTotal.toFixed(0)}, extraído: ${totalValue.toFixed(0)}`],
      suggestions: isCorrect ? [] : ['Verifique la suma de prima + IVA'],
      severity: isCorrect ? 'info' : 'warning'
    };
  }

  private async validateCedulaFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    const cleanValue = value.replace(/[^\d]/g, '');
    const isValid = /^\d{6,12}$/.test(cleanValue);
    
    return {
      field: 'clienteCedula',
      isValid,
      confidence: isValid ? 0.9 : 0.2,
      errors: isValid ? [] : ['Formato de cédula inválido (debe tener 6-12 dígitos)'],
      severity: isValid ? 'info' : 'error'
    };
  }

  private async validateCedulaCheckDigit(value: string, context: ValidationContext): Promise<ValidationResult> {
    // Implementación futura para validar dígito de verificación de cédulas colombianas
    return {
      field: 'clienteCedula',
      isValid: true,
      confidence: 0.7,
      errors: [],
      severity: 'info'
    };
  }

  private async validateEmailFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(value);
    
    return {
      field: 'clienteEmail',
      isValid,
      confidence: isValid ? 0.95 : 0.1,
      errors: isValid ? [] : ['Formato de email inválido'],
      severity: isValid ? 'info' : 'error'
    };
  }

  private async validateEmailDomain(value: string, context: ValidationContext): Promise<ValidationResult> {
    const commonDomains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'empresas.com'];
    const domain = value.split('@')[1]?.toLowerCase();
    
    if (!domain) {
      return {
        field: 'clienteEmail',
        isValid: false,
        confidence: 0.1,
        errors: ['Email sin dominio válido'],
        severity: 'error'
      };
    }

    // Verificar que el dominio tenga al menos un punto
    const hasValidDomain = domain.includes('.') && domain.length > 3;
    
    return {
      field: 'clienteEmail',
      isValid: hasValidDomain,
      confidence: hasValidDomain ? 0.8 : 0.2,
      errors: hasValidDomain ? [] : ['Dominio de email sospechoso'],
      severity: hasValidDomain ? 'info' : 'warning'
    };
  }

  private async validatePhoneFormat(value: string, context: ValidationContext): Promise<ValidationResult> {
    const cleanValue = value.replace(/[^\d]/g, '');
    
    // Formatos válidos para Colombia
    const isValid = /^3\d{9}$/.test(cleanValue) || // Celular: 3XXXXXXXXX
                   /^[1-8]\d{6,7}$/.test(cleanValue) || // Fijo: XXXXXXX o XXXXXXXX
                   /^60[1-9]\d{7}$/.test(cleanValue); // Bogotá: 60XXXXXXXX

    return {
      field: 'clienteTelefono',
      isValid,
      confidence: isValid ? 0.85 : 0.3,
      errors: isValid ? [] : ['Formato de teléfono no válido para Colombia'],
      suggestions: isValid ? [] : ['Use formato colombiano: 3XXXXXXXXX (celular) o XXXXXXX (fijo)'],
      severity: isValid ? 'info' : 'warning'
    };
  }

  private async validateColombianPhone(value: string, context: ValidationContext): Promise<ValidationResult> {
    const cleanValue = value.replace(/[^\d]/g, '');
    
    // Validaciones específicas para números colombianos
    const isCellPhone = cleanValue.startsWith('3') && cleanValue.length === 10;
    const isLandline = !cleanValue.startsWith('3') && cleanValue.length >= 7 && cleanValue.length <= 8;
    
    const isValid = isCellPhone || isLandline;
    
    return {
      field: 'clienteTelefono',
      isValid,
      confidence: isValid ? 0.9 : 0.4,
      errors: isValid ? [] : ['Número de teléfono no parece ser colombiano'],
      severity: isValid ? 'info' : 'warning'
    };
  }

  // ===== VALIDACIONES CRUZADAS =====

  private async performCrossValidations(data: Record<string, any>, context: ValidationContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validación de coherencia de fechas
    if (data.fechaInicio && data.fechaFin && data.fechaExpedicion) {
      const expedicion = new Date(data.fechaExpedicion);
      const inicio = new Date(data.fechaInicio);
      const fin = new Date(data.fechaFin);

      if (expedicion > inicio) {
        results.push({
          field: 'fechas',
          isValid: false,
          confidence: 0.1,
          errors: ['La fecha de expedición no puede ser posterior al inicio de vigencia'],
          severity: 'error'
        });
      }

      if (inicio >= fin) {
        results.push({
          field: 'fechas',
          isValid: false,
          confidence: 0.1,
          errors: ['La fecha de inicio debe ser anterior a la fecha de fin'],
          severity: 'error'
        });
      }
    }

    // Validación de coherencia financiera
    if (data.primaNeta && data.iva && data.total) {
      const prima = parseFloat(data.primaNeta.replace(/[^\d.,]/g, '').replace(/,/g, ''));
      const iva = parseFloat(data.iva.replace(/[^\d.,]/g, '').replace(/,/g, ''));
      const total = parseFloat(data.total.replace(/[^\d.,]/g, '').replace(/,/g, ''));
      
      const expectedTotal = prima + iva;
      const tolerance = expectedTotal * 0.02;
      
      if (Math.abs(total - expectedTotal) > tolerance) {
        results.push({
          field: 'montos',
          isValid: false,
          confidence: 0.2,
          errors: [`Inconsistencia en cálculos: Prima(${prima}) + IVA(${iva}) ≠ Total(${total})`],
          suggestions: ['Verifique los montos extraídos'],
          severity: 'warning'
        });
      }
    }

    // Validación de coherencia de cliente
    if (data.clienteNombre && data.clienteCedula) {
      // Verificar que el nombre no contenga números
      const hasNumbers = /\d/.test(data.clienteNombre);
      if (hasNumbers) {
        results.push({
          field: 'clienteNombre',
          isValid: false,
          confidence: 0.3,
          errors: ['El nombre del cliente contiene números'],
          suggestions: ['Verifique que se extrajo correctamente el nombre'],
          severity: 'warning'
        });
      }
    }

    return results;
  }

  // ===== MÉTODOS AUXILIARES =====

  getValidationSummary(results: ValidationResult[]): {
    overallValid: boolean;
    overallConfidence: number;
    errorCount: number;
    warningCount: number;
    criticalIssues: string[];
  } {
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    
    const overallValid = errors.length === 0;
    const overallConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
      : 0;

    const criticalIssues = errors
      .filter(r => !r.isValid)
      .flatMap(r => r.errors);

    return {
      overallValid,
      overallConfidence: overallConfidence * 100,
      errorCount: errors.length,
      warningCount: warnings.length,
      criticalIssues
    };
  }
}

// Instancia singleton
export const dataValidator = new DataValidator();
import { useState, useCallback } from 'react';

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface PolizaFormData {
  numeroPoliza: string;
  riesgo: string;
  valorRiesgoAsegurado: string;
  aseguradora: string;
  ramoPrincipal: string;
  subramo: string;
  tipoPoliza: string;
  
  // Información del Cliente
  nombresCliente: string;
  apellidosCliente: string;
  dniCliente: string;
  tipoDocumento: string;
  genero?: string;
  telefonoCliente: string;
  celularCliente: string;
  fechaExpedicionDni: string;
  fechaNacimiento: string;
  domicilio: string;
  correoCliente: string;
  correosSecundarios: string;
  observacionesCliente: string;
  
  // Información Financiera
  primaNeta: string;
  porcentajeIva: string;
  iva: string;
  total: string;
  porcentajeComision: string;
  comision: string;
  formaPago: string;
  periodicidadPago: string;
  medioPago: string;
  
  // Información Administrativa
  vendedor: string;
  observaciones: string;
  observacionesInternas: string;
  fechaExpedicion: string;
  fechaInicio: string;
  fechaFin: string;
  estado?: string;
  sede: string;

  // Extensiones del formulario (opcionales)
  fechaRecepcion?: string;
  renovable?: boolean;
  motivo?: string;
  priAPre?: string;
  participacion?: string;
  coCorretaje?: string;
  comisionAgencia?: string;
  porcentajeRetencion?: string;
  porcentajeReteiva?: string;
  beneficiarioEnRemision?: boolean;
  beneficiarioOneroso?: boolean;
  beneficiarioOnerosoNombre?: string;
  beneficiarioOnerosoDocumento?: string;
  // Pago
  banco?: string;
  cuotas?: string;
  numeroTarjeta?: string;
  // Partes
  policy_holder_name?: string;
  policy_holder_document?: string;
  insured_name?: string;
  insured_document?: string;
  // Vehículos
  placas?: string[];
}

export const usePolizaValidation = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Validadores individuales
  const validateRequired = (value: string, fieldName: string): string | undefined => {
    if (!value || value.trim() === '') {
      return `${fieldName} es requerido`;
    }
    return undefined;
  };

  // Mantener validadores utilitarios disponibles para futuras extensiones
  const validateEmail = (email: string): string | undefined => {
    if (!email) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Formato de email inválido';
    }
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone) return undefined;
    const phoneRegex = /^[\d\s\-\+\(\)]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      return 'Formato de teléfono inválido';
    }
    return undefined;
  };

  const validateDNI = (dni: string): string | undefined => {
    if (!dni) return undefined;
    const dniRegex = /^[0-9]{6,15}$/;
    if (!dniRegex.test(dni.replace(/[.-]/g, ''))) {
      return 'Formato de documento inválido';
    }
    return undefined;
  };

  const validateNumericPositive = (value: string, fieldName: string): string | undefined => {
    if (!value) return undefined;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return `${fieldName} debe ser un número positivo`;
    }
    return undefined;
  };

  const validatePercentage = (value: string, fieldName: string): string | undefined => {
    if (!value) return undefined;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      return `${fieldName} debe estar entre 0 y 100`;
    }
    return undefined;
  };

  const validateIntegerMin = (value: string, min: number, fieldName: string): string | undefined => {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < min) {
      return `${fieldName} debe ser un entero mayor o igual a ${min}`;
    }
    return undefined;
  };

  const validateCardNumberMinDigits = (value: string, minDigits = 4): string | undefined => {
    if (!value) return undefined;
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < minDigits) {
      return `El número de tarjeta debe tener al menos ${minDigits} dígitos`;
    }
    if (digitsOnly.length > 19) {
      return 'El número de tarjeta no puede superar 19 dígitos';
    }
    return undefined;
  };

  const validateDate = (date: string, fieldName: string): string | undefined => {
    if (!date) return `${fieldName} es requerida`;
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return `${fieldName} debe ser una fecha válida`;
    }
    return undefined;
  };

  const validateDateRange = (startDate: string, endDate: string): string | undefined => {
    if (!startDate || !endDate) return undefined;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return 'La fecha de fin debe ser posterior a la fecha de inicio';
    }
    return undefined;
  };

  const validatePolizaNumber = (number: string): string | undefined => {
    if (!number) return 'El número de póliza es requerido';
    if (number.length < 5) {
      return 'El número de póliza debe tener al menos 5 caracteres';
    }
    return undefined;
  };

  const validatePlate = (plate: string): string | undefined => {
    if (!plate) return undefined;
    const normalized = plate.trim().toUpperCase();
    const re = /^[A-Z0-9-]{3,20}$/;
    if (!re.test(normalized)) {
      return 'Placa inválida (solo letras/números/guion, 3-20)';
    }
    return undefined;
  };

  const validateAge = (birthDate: string): string | undefined => {
    if (!birthDate) return undefined;
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      const finalAge = age - 1;
      if (finalAge < 0) {
        return 'La fecha de nacimiento no puede ser futura';
      }
      if (finalAge > 120) {
        return 'La fecha de nacimiento no es válida';
      }
    }
    return undefined;
  };

  // Validación por pasos
  const validateStep = useCallback((step: number, formData: PolizaFormData): ValidationErrors => {
    const stepErrors: ValidationErrors = {};
    
    switch (step) {
      case 0: // Paso 1 - Información General
        stepErrors.numeroPoliza = validatePolizaNumber(formData.numeroPoliza);
        stepErrors.aseguradora = validateRequired(formData.aseguradora, 'La aseguradora');
        stepErrors.ramoPrincipal = validateRequired(formData.ramoPrincipal, 'El ramo principal');
        stepErrors.tipoPoliza = validateRequired(formData.tipoPoliza, 'El tipo de póliza');
        // Si el ramo es 'otros' o existe riesgo asegurado, exigir valor numérico
        if (formData.valorRiesgoAsegurado) {
          stepErrors.valorRiesgoAsegurado = validateNumericPositive(formData.valorRiesgoAsegurado, 'El valor del riesgo asegurado');
        }
        // Validación suave de placas si el ramo es automotor (Automóvil o SOAT) y se ingresaron
        if ((((s) => s.includes('auto') || s.includes('soat'))((formData.ramoPrincipal || '').toLowerCase())) && Array.isArray((formData as any).placas)) {
          const list = (formData as any).placas as string[];
          const invalid = list.find(p => !!validatePlate(p));
          if (invalid) {
            stepErrors['placas'] = validatePlate(invalid);
          }
        }
        break;

      case 1: // Paso 2 - Cliente
        if (!(formData as any).cliente_id) {
          stepErrors['cliente_id'] = 'Debes seleccionar un cliente';
        }
        break;

      case 2: // Paso 3 - Financiera y Pagos
        // Validaciones financieras (requeridos/formatos)
        stepErrors.primaNeta = validateNumericPositive(formData.primaNeta, 'La prima neta') || validateRequired(formData.primaNeta, 'La prima neta');
        stepErrors.porcentajeIva = validatePercentage(formData.porcentajeIva, 'El porcentaje de IVA');
        // Requeridos de pago
        stepErrors.formaPago = validateRequired(formData.formaPago, 'La forma de pago');
        stepErrors.medioPago = validateRequired(formData.medioPago, 'El medio de pago');
        // Validaciones de pago
        if (formData.cuotas) {
          stepErrors.cuotas = validateIntegerMin(formData.cuotas, 1, 'El número de cuotas');
        }
        if (formData.numeroTarjeta) {
          stepErrors.numeroTarjeta = validateCardNumberMinDigits(formData.numeroTarjeta, 4);
        }
        
        // Validaciones opcionales
        if (formData.porcentajeComision) {
          stepErrors.porcentajeComision = validatePercentage(formData.porcentajeComision, 'El porcentaje de comisión');
        }
        if (formData.valorRiesgoAsegurado) {
          stepErrors.valorRiesgoAsegurado = validateNumericPositive(formData.valorRiesgoAsegurado, 'El valor del riesgo asegurado');
        }
        break;

      case 3: // Paso 4 - Fechas
        stepErrors.fechaExpedicion = validateDate(formData.fechaExpedicion, 'La fecha de expedición');
        stepErrors.fechaInicio = validateDate(formData.fechaInicio, 'La fecha de inicio');
        stepErrors.fechaFin = validateDate(formData.fechaFin, 'La fecha de fin');
        if (formData.fechaInicio && formData.fechaFin) {
          const rangeError = validateDateRange(formData.fechaInicio, formData.fechaFin);
          if (rangeError) {
            stepErrors.fechaFin = rangeError;
          }
        }
        break;
    }
    
    // Filtrar errores undefined
    const filteredErrors: ValidationErrors = {};
    Object.keys(stepErrors).forEach(key => {
      if (stepErrors[key]) {
        filteredErrors[key] = stepErrors[key];
      }
    });
    
    return filteredErrors;
  }, []);

    // Validación completa del formulario (considera todos los pasos)
  const validateForm = useCallback((formData: PolizaFormData): ValidationErrors => {
    const allErrors: ValidationErrors = {};
    
      const step0Errors = validateStep(0, formData);
      const step1Errors = validateStep(1, formData);
      const step2Errors = validateStep(2, formData);
      const step3Errors = validateStep(3, formData);
      
      return { ...allErrors, ...step0Errors, ...step1Errors, ...step2Errors, ...step3Errors };
  }, [validateStep]);

  // Limpiar errores
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Limpiar error específico
  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Validar paso específico
  const validateStepAndSetErrors = useCallback((step: number, formData: PolizaFormData): boolean => {
    const stepErrors = validateStep(step, formData);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [validateStep]);

  return {
    errors,
    setErrors,
    validateStep,
    validateForm,
    validateStepAndSetErrors,
    clearErrors,
    clearError,
  };
};

export default usePolizaValidation; 
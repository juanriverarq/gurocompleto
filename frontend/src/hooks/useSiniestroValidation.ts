import { useState, useCallback } from 'react';

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface SiniestroFormData {
  tipo_seguro: string;
  broker_id: number;
  poliza_id: number;
  cliente_id: number;
  tipo_siniestro: string;
  fecha_ocurrencia: string;
  fecha_reporte: string;
  fecha_aviso: string;
  fecha_notificacion_aseguradora: string;
  monto_reclamado: number;
  descripcion_evento: string;
  descripcion_hechos: string;
  lugar_ocurrencia: string;
  ciudad_ocurrencia: string;
  departamento_ocurrencia: string;
  pais_ocurrencia: string;
  aseguradora: string;
  numero_siniestro_compania: string;
  numero_referencia_aseguradora: string;
  proveedor_asignado: string;
  prioridad: string;
  involucra_terceros: boolean;
  hay_heridos: boolean;
  hay_danos_materiales: boolean;
  datos_terceros: string;
  informacion_heridos: string;
  danos_materiales: string;
  causa_siniestro: string;
  estado?: string;
  finalizado?: boolean;
  amparos_afectados?: any[];
}

export const useSiniestroValidation = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Validadores individuales
  const validateRequired = (value: string, fieldName: string): string | undefined => {
    if (!value || value.trim() === '') {
      return `${fieldName} es requerido`;
    }
    return undefined;
  };

  const validateNumericRequired = (value: number, fieldName: string): string | undefined => {
    if (!value || value <= 0) {
      return `${fieldName} debe ser mayor a 0`;
    }
    return undefined;
  };

  const validateNumericPositive = (value: number, fieldName: string): string | undefined => {
    if (value && value < 0) {
      return `${fieldName} debe ser un número positivo`;
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

  const validateMinLength = (value: string, minLength: number, fieldName: string): string | undefined => {
    if (!value || value.trim().length < minLength) {
      return `${fieldName} debe tener al menos ${minLength} caracteres`;
    }
    return undefined;
  };

  const validateMaxLength = (value: string, maxLength: number, fieldName: string): string | undefined => {
    if (value && value.length > maxLength) {
      return `${fieldName} no puede tener más de ${maxLength} caracteres`;
    }
    return undefined;
  };

  const validateDateNotFuture = (date: string, fieldName: string): string | undefined => {
    if (date) {
      const inputDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Permitir fechas de hoy
      
      if (inputDate > today) {
        return `${fieldName} no puede ser futura`;
      }
    }
    return undefined;
  };

  const validateConditionalField = (
    condition: boolean, 
    value: string, 
    fieldName: string, 
    minLength?: number
  ): string | undefined => {
    if (condition) {
      const requiredError = validateRequired(value, fieldName);
      if (requiredError) return requiredError;
      
      if (minLength) {
        return validateMinLength(value, minLength, fieldName);
      }
    }
    return undefined;
  };

  // Validación completa del formulario
  const validateForm = useCallback((formData: SiniestroFormData): ValidationErrors => {
    const formErrors: ValidationErrors = {};

    // Validaciones básicas requeridas
    formErrors.tipo_seguro = validateRequired(formData.tipo_seguro, 'El tipo de seguro');
    formErrors.tipo_siniestro = validateRequired(formData.tipo_siniestro, 'El tipo de siniestro');
    formErrors.fecha_ocurrencia = validateDate(formData.fecha_ocurrencia, 'La fecha de ocurrencia') || 
                                 validateDateNotFuture(formData.fecha_ocurrencia, 'La fecha de ocurrencia');
    formErrors.monto_reclamado = validateNumericRequired(formData.monto_reclamado, 'El monto reclamado');
    formErrors.descripcion_evento = validateRequired(formData.descripcion_evento, 'La descripción del evento') ||
                                  validateMinLength(formData.descripcion_evento, 10, 'La descripción del evento');
    formErrors.lugar_ocurrencia = validateRequired(formData.lugar_ocurrencia, 'El lugar de ocurrencia');
    formErrors.ciudad_ocurrencia = validateRequired(formData.ciudad_ocurrencia, 'La ciudad de ocurrencia');
    formErrors.departamento_ocurrencia = validateRequired(formData.departamento_ocurrencia, 'El departamento de ocurrencia');
    formErrors.aseguradora = validateRequired(formData.aseguradora, 'La aseguradora');
    formErrors.prioridad = validateRequired(formData.prioridad, 'La prioridad');

    // Validaciones de fechas opcionales
    if (formData.fecha_reporte) {
      formErrors.fecha_reporte = validateDate(formData.fecha_reporte, 'La fecha de reporte') ||
                               validateDateNotFuture(formData.fecha_reporte, 'La fecha de reporte');
    }

    if (formData.fecha_aviso) {
      formErrors.fecha_aviso = validateDate(formData.fecha_aviso, 'La fecha de aviso') ||
                             validateDateNotFuture(formData.fecha_aviso, 'La fecha de aviso');
    }

    if (formData.fecha_notificacion_aseguradora) {
      formErrors.fecha_notificacion_aseguradora = validateDate(formData.fecha_notificacion_aseguradora, 'La fecha de notificación a aseguradora') ||
                                                validateDateNotFuture(formData.fecha_notificacion_aseguradora, 'La fecha de notificación a aseguradora');
    }

    // Validaciones condicionales
    formErrors.datos_terceros = validateConditionalField(
      formData.involucra_terceros,
      formData.datos_terceros,
      'La información de terceros',
      10
    );

    formErrors.informacion_heridos = validateConditionalField(
      formData.hay_heridos,
      formData.informacion_heridos,
      'La información de heridos',
      10
    );

    formErrors.danos_materiales = validateConditionalField(
      formData.hay_danos_materiales,
      formData.danos_materiales,
      'La descripción de daños materiales',
      10
    );

    // Validaciones de longitud máxima
    if (formData.descripcion_hechos) {
      formErrors.descripcion_hechos = validateMaxLength(formData.descripcion_hechos, 1000, 'La descripción de hechos');
    }

    if (formData.causa_siniestro) {
      formErrors.causa_siniestro = validateMaxLength(formData.causa_siniestro, 500, 'La causa del siniestro');
    }

    if (formData.numero_siniestro_compania) {
      formErrors.numero_siniestro_compania = validateMinLength(formData.numero_siniestro_compania, 3, 'El número de siniestro de la compañía');
    }

    if (formData.numero_referencia_aseguradora) {
      formErrors.numero_referencia_aseguradora = validateMinLength(formData.numero_referencia_aseguradora, 3, 'El número de referencia de la aseguradora');
    }

    // Validaciones de valores requeridos por contexto
    if (formData.poliza_id <= 0) {
      formErrors.poliza_id = 'Debe seleccionar una póliza válida';
    }

    if (formData.cliente_id <= 0) {
      formErrors.cliente_id = 'Debe seleccionar un cliente válido';
    }

    // Filtrar errores undefined
    const filteredErrors: ValidationErrors = {};
    Object.keys(formErrors).forEach(key => {
      if (formErrors[key]) {
        filteredErrors[key] = formErrors[key];
      }
    });

    return filteredErrors;
  }, []);

  // Validar campo específico
  const validateField = useCallback((fieldName: string, formData: SiniestroFormData): string | undefined => {
    const allErrors = validateForm(formData);
    return allErrors[fieldName];
  }, [validateForm]);

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

  // Validar formulario completo y setear errores
  const validateFormAndSetErrors = useCallback((formData: SiniestroFormData): boolean => {
    const formErrors = validateForm(formData);
    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  }, [validateForm]);

  // Obtener el primer error encontrado
  const getFirstError = useCallback((formData: SiniestroFormData): string | undefined => {
    const formErrors = validateForm(formData);
    const firstErrorKey = Object.keys(formErrors)[0];
    return firstErrorKey ? formErrors[firstErrorKey] : undefined;
  }, [validateForm]);

  return {
    errors,
    setErrors,
    validateForm,
    validateField,
    validateFormAndSetErrors,
    clearErrors,
    clearError,
    getFirstError,
  };
};

export default useSiniestroValidation;

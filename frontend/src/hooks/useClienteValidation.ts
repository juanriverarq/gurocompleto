import { useState, useCallback } from 'react';

// Tipos para los datos del formulario de cliente
export interface ClienteFormData {
  client_type?: 'persona' | 'empresa';
  nombre: string;
  apellidos: string;
  cuit: string;
  tipo_documento: string;
  fecha_expedicion_documento?: string;
  fecha_nacimiento: string;
  genero: string;
  domicilio_principal: string;
  celular_principal: string;
  email_principal: string;
  actividad: string;
  ciudad: string;
  state: string; // Departamento
  sede: string;
  estado: 'activo' | 'inactivo' | 'prospecto';
  observaciones: string;
  // Empresa
  razon_social?: string;
  representante_legal?: string;
  representante_legal_tipo_documento?: string;
  representante_legal_documento?: string;
}

// Tipos para los errores
export interface ValidationErrors {
  [key: string]: string | undefined;
}

// Hook de validación personalizado
const useClienteValidation = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Validar email
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Validar teléfono/celular
  const validatePhone = useCallback((phone: string): boolean => {
    const phoneRegex = /^[0-9\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone);
  }, []);

  // Validar documento (CUIT/DNI)
  const validateCuit = useCallback((cuit: string): boolean => {
    const cuitRegex = /^[0-9]{6,15}$/;
    return cuitRegex.test(cuit);
  }, []);
  const validateDocNumber = validateCuit;

  // Validar nombre (solo letras y espacios)
  const validateName = useCallback((name: string): boolean => {
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
    return nameRegex.test(name);
  }, []);

  // Validar un paso específico
  const validateStep = useCallback((step: number, formData: ClienteFormData): boolean => {
    const stepErrors: ValidationErrors = {};
    let isValid = true;

    if (step === 0) {
      const isEmpresa = formData.client_type === 'empresa';
      // Validación Paso 1: Información Personal
      if (!formData.client_type) {
        stepErrors.client_type = 'Debes seleccionar si es Persona o Empresa';
        isValid = false;
      }

      if (!isEmpresa) {
        if (!formData.nombre.trim()) {
          stepErrors.nombre = 'El nombre es obligatorio';
          isValid = false;
        } else if (!validateName(formData.nombre)) {
          stepErrors.nombre = 'El nombre solo puede contener letras y espacios (2-50 caracteres)';
          isValid = false;
        }
        if (!formData.apellidos.trim()) {
          stepErrors.apellidos = 'Los apellidos son obligatorios';
          isValid = false;
        } else if (!validateName(formData.apellidos)) {
          stepErrors.apellidos = 'Los apellidos solo pueden contener letras y espacios (2-50 caracteres)';
          isValid = false;
        }
      } else {
        if (!formData.razon_social || !formData.razon_social.trim()) {
          stepErrors.razon_social = 'La razón social es obligatoria';
          isValid = false;
        }
        if (!formData.representante_legal || !formData.representante_legal.trim()) {
          stepErrors.representante_legal = 'El nombre del representante es obligatorio';
          isValid = false;
        }
        if (!formData.representante_legal_tipo_documento) {
          stepErrors.representante_legal_tipo_documento = 'El tipo de documento del representante es obligatorio';
          isValid = false;
        }
        if (!formData.representante_legal_documento || !validateDocNumber(formData.representante_legal_documento)) {
          stepErrors.representante_legal_documento = 'El documento del representante es obligatorio (6-15 dígitos)';
          isValid = false;
        }
      }

      if (!formData.cuit.trim()) {
        stepErrors.cuit = 'El documento es obligatorio';
        isValid = false;
      } else if (!validateCuit(formData.cuit)) {
        stepErrors.cuit = 'El documento debe tener entre 6 y 15 dígitos';
        isValid = false;
      }

      if (!formData.tipo_documento) {
        stepErrors.tipo_documento = 'El tipo de documento es obligatorio';
        isValid = false;
      }

      if (!formData.email_principal.trim()) {
        stepErrors.email_principal = 'El email es obligatorio';
        isValid = false;
      } else if (!validateEmail(formData.email_principal)) {
        stepErrors.email_principal = 'El formato del email no es válido';
        isValid = false;
      }

      if (!formData.celular_principal.trim()) {
        stepErrors.celular_principal = 'El celular es obligatorio';
        isValid = false;
      } else if (!validatePhone(formData.celular_principal)) {
        stepErrors.celular_principal = 'El formato del celular no es válido';
        isValid = false;
      }

      if (!isEmpresa) {
        if (!formData.genero) {
          stepErrors.genero = 'El género es obligatorio';
          isValid = false;
        }
      }

      if (!isEmpresa && formData.fecha_nacimiento) {
        const birthDate = new Date(formData.fecha_nacimiento);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 18 || age > 100) {
          stepErrors.fecha_nacimiento = 'La edad debe estar entre 18 y 100 años';
          isValid = false;
        }
      }
    }

    if (step === 1) {
      // Validación Paso 2: Información de Contacto y Ubicación
      if (!formData.domicilio_principal.trim()) {
        stepErrors.domicilio_principal = 'El domicilio es obligatorio';
        isValid = false;
      } else if (formData.domicilio_principal.length < 5) {
        stepErrors.domicilio_principal = 'El domicilio debe tener al menos 5 caracteres';
        isValid = false;
      }

      if (!formData.ciudad.trim()) {
        stepErrors.ciudad = 'La ciudad es obligatoria';
        isValid = false;
      }

      if (!formData.state || !formData.state.trim()) {
        stepErrors.state = 'El departamento es obligatorio';
        isValid = false;
      }

      if (!formData.estado) {
        stepErrors.estado = 'El estado es obligatorio';
        isValid = false;
      }

      if (formData.actividad && formData.actividad.length < 2) {
        stepErrors.actividad = 'La actividad debe tener al menos 2 caracteres';
        isValid = false;
      }
    }

    setErrors(prev => ({ ...prev, ...stepErrors }));
    return isValid;
  }, [validateEmail, validatePhone, validateCuit, validateName]);

  // Validar todo el formulario
  const validateAll = useCallback((formData: ClienteFormData): boolean => {
    const step0Valid = validateStep(0, formData);
    const step1Valid = validateStep(1, formData);
    return step0Valid && step1Valid;
  }, [validateStep]);

  // Validar un paso específico y establecer errores
  const validateStepAndSetErrors = useCallback((step: number, formData: ClienteFormData): boolean => {
    return validateStep(step, formData);
  }, [validateStep]);

  // Limpiar un error específico
  const clearError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  // Limpiar todos los errores
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateStep,
    validateAll,
    validateStepAndSetErrors,
    clearError,
    clearErrors,
  };
};

export default useClienteValidation;

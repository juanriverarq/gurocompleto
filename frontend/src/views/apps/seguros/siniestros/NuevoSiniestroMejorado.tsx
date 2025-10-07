import { useState, useEffect, useMemo, useCallback } from 'react';
import { Textarea, Badge, Tooltip, ToggleSwitch } from 'flowbite-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { 
  Select as ShSelect, 
  SelectContent as ShSelectContent, 
  SelectItem as ShSelectItem, 
  SelectTrigger as ShSelectTrigger, 
  SelectValue as ShSelectValue
} from 'src/components/shadcn-ui/Default-Ui/select';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { Card as ShCard, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
// Tabs removidos: usaremos Stepper visual tipo pólizas
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import CardBox from 'src/components/shared/CardBox';
import { siniestroService } from '../../../../services/siniestroService';
import { polizaService } from '../../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { HiInformationCircle } from 'react-icons/hi';

// Stepper visual (clonado de NuevaPoliza)
interface StepperProps {
  currentStep: number;
  steps: { title: string; description: string }[];
  onStepClick: (step: number) => void;
}

const Stepper: React.FC<StepperProps> = ({ currentStep, steps, onStepClick }) => {
  return (
    <div className="flex items-center justify-center w-full mb-4">
      <div className="flex items-center space-x-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  // Solo permitir navegación a pasos anteriores o al paso actual
                  if (index <= currentStep) {
                    onStepClick(index);
                  }
                }}
                disabled={index > currentStep}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-primary text-white shadow-lg transform scale-110 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                } ${index > currentStep ? 'hover:bg-gray-200' : 'hover:bg-primary/90'}`}
              >
                {index < currentStep ? (
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </button>
              <div className="text-center mt-2">
                <p className={`text-xs font-medium leading-tight ${
                  index <= currentStep ? 'text-primary' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-400 leading-tight">
                  {step.description}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 ${
                index < currentStep ? 'bg-primary' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Catálogos locales

// Tipos de siniestro disponibles - Actualizados según BD real
const TIPOS_SINIESTRO_DISPONIBLES = {
  colision: 'Colisión',
  robo_total: 'Robo Total',
  robo_parcial: 'Robo Parcial',
  incendio: 'Incendio',
  vandalismo: 'Vandalismo',
  fenomenos_naturales: 'Fenómenos Naturales',
  accidente_laboral: 'Accidente Laboral',
  responsabilidad_civil: 'Responsabilidad Civil',
  daños_terceros: 'Daños a Terceros',
  muerte: 'Muerte',
  incapacidad: 'Incapacidad',
  enfermedad: 'Enfermedad',
  hospitalizacion: 'Hospitalización',
  cirugia: 'Cirugía',
  daños_agua: 'Daños por Agua',
  explosion: 'Explosión',
  terremoto: 'Terremoto',
  inundacion: 'Inundación',
  granizo: 'Granizo',
  vientos_fuertes: 'Vientos Fuertes',
  otro: 'Otro',
};

// Tipos de seguro disponibles (alineado al CRUD original)
const TIPOS_SEGURO = {
  automovil: 'Automóvil',
  vida: 'Vida',
  hogar: 'Hogar',
  empresarial: 'Empresarial',
  salud: 'Salud',
  accidentes: 'Accidentes Personales',
  responsabilidad_civil: 'Responsabilidad Civil',
  otros: 'Otros',
};

// Estados del siniestro (alineado al CRUD original)
const ESTADOS_SINIESTRO = {
  reportado: 'Reportado',
  asignado: 'Asignado',
  en_revision: 'En Revisión',
  investigacion: 'Investigación',
  peritaje: 'Peritaje',
  documentos_pendientes: 'Documentos Pendientes',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  pagado: 'Pagado',
  cerrado: 'Cerrado',
};

interface AmparoAfectado {
  nombre_reclamante: string;
  amparo: string;
  valor: number;
}

// Interface para el formulario actualizado
interface FormDataSiniestro {
  poliza_id: number;
  cliente_id: number | string;
  tipo_seguro: string;
  tipo_siniestro: string;
  fecha_ocurrencia: string;
  fecha_aviso: string;
  fecha_notificacion_aseguradora: string;
  monto_reclamo: number;
  descripcion_hechos: string;
  lugar_ocurrencia: string;
  ciudad_ocurrencia: string;
  departamento_ocurrencia: string;
  aseguradora: string;
  // adicionales permitidos por backend en create/update
  prioridad?: string;
  assigned_adjuster_id?: number;
  involucra_terceros?: boolean;
  hay_heridos?: boolean;
  hay_danos_materiales?: boolean;
  datos_terceros?: string;
  informacion_heridos?: string;
  danos_materiales?: string;
  causa_siniestro?: string;
  amparos_afectados?: AmparoAfectado[];
  estado?: string;
  finalizado?: boolean;
  valor_indemnizacion?: number;
  deducible?: number;
  coaseguros?: number;
  resolucion?: string;
  numero_siniestro_compania?: string;
  proveedor_asignado?: string;
  numero_siniestro?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const NuevoSiniestroMejorado = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingPolizas, setLoadingPolizas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polizas, setPolizas] = useState<any[]>([]);
  const [filteredPolizas, setFilteredPolizas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPoliza, setSelectedPoliza] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [currentStep, setCurrentStep] = useState<number>(0);
  const steps = [
    { title: 'Información General', description: 'Datos básicos' },
    { title: 'Cliente y Ubicación', description: 'Datos del cliente y lugar' },
    { title: 'Financiera y Pagos', description: 'Montos, impuestos y medios de pago' },
    { title: 'Fechas', description: 'Vigencia' },
    { title: 'Beneficiarios', description: 'Datos adicionales' },
  ];

  // Validación por paso para navegación
  const validateStepBeforeNext = (stepIndex: number): boolean => {
    const stepFields: Record<number, string[]> = {
      0: ['poliza_id','tipo_seguro','tipo_siniestro','descripcion_hechos'],
      1: ['lugar_ocurrencia','ciudad_ocurrencia','departamento_ocurrencia','aseguradora'],
      2: ['monto_reclamo'],
      3: ['fecha_ocurrencia','fecha_aviso','fecha_notificacion_aseguradora'],
      4: ['poliza_id','tipo_seguro','tipo_siniestro','descripcion_hechos','monto_reclamo','fecha_ocurrencia','fecha_aviso','fecha_notificacion_aseguradora','lugar_ocurrencia','ciudad_ocurrencia','departamento_ocurrencia','aseguradora'], // Validar todos los campos requeridos antes de enviar
    };
    const fields = stepFields[stepIndex] || [];
    const newErrs: ValidationErrors = {};
    
    fields.forEach((key) => {
      const err = validateField(key, (formData as any)[key]);
      if (err) newErrs[key] = err;
    });
    
    if (Object.keys(newErrs).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...newErrs }));
      
      // Mostrar errores específicos
      const errorMessages = Object.values(newErrs);
      toast({ 
        variant: 'destructive', 
        title: 'Campos incompletos', 
        description: `Por favor corrige: ${errorMessages.join(', ')}` 
      });
      return false;
    }
    
    // Limpiar errores del paso si todo está correcto
    setValidationErrors(prev => {
      const cleaned = { ...prev };
      fields.forEach(field => delete cleaned[field]);
      return cleaned;
    });
    
    return true;
  };

  const [formData, setFormData] = useState<FormDataSiniestro>({
    poliza_id: 0,
    cliente_id: 0,
    tipo_seguro: 'auto',
    tipo_siniestro: 'robo_total', // Valor por defecto válido según BD
    fecha_ocurrencia: '',
    fecha_aviso: new Date().toISOString().split('T')[0],
    fecha_notificacion_aseguradora: new Date().toISOString().split('T')[0],
    monto_reclamo: '' as any,
    descripcion_hechos: '',
    lugar_ocurrencia: '',
    ciudad_ocurrencia: '',
    departamento_ocurrencia: '',
    aseguradora: '',
    prioridad: 'media',
    involucra_terceros: false,
    hay_heridos: false,
    hay_danos_materiales: false,
    amparos_afectados: [],
    estado: 'reportado',
    finalizado: false,
    valor_indemnizacion: '' as any,
    deducible: '' as any,
    coaseguros: '' as any,
    resolucion: '',
    numero_siniestro_compania: '',
    proveedor_asignado: '',
    numero_siniestro: '',
  });

  const [amparoNuevo, setAmparoNuevo] = useState<AmparoAfectado>({
    nombre_reclamante: '',
    amparo: '',
    valor: '' as any
  });

  // Hook personalizado para debounce
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    
    return debouncedValue;
  };
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    loadPolizas();
  }, []);

  // Optimizar filtrado con useMemo
  const filteredPolizasOptimized = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return polizas.slice(0, 100); // Limitar a 100 para mejor rendimiento inicial
    }

    const searchLower = debouncedSearchTerm.toLowerCase();
    return polizas.filter((poliza: any) => {
      const numeroPoliza = poliza.numero_poliza?.toLowerCase() || '';
      const cliente = poliza.cliente?.toLowerCase() || '';
      const aseguradora = poliza.aseguradora?.toLowerCase() || '';
      const documento = poliza.documento_cliente?.toLowerCase() || '';
      
      return numeroPoliza.includes(searchLower) ||
             cliente.includes(searchLower) ||
             aseguradora.includes(searchLower) ||
             documento.includes(searchLower);
    }).slice(0, 50); // Limitar a 50 resultados para mejor rendimiento
  }, [debouncedSearchTerm, polizas]);

  // Efecto para actualizar filteredPolizas
  useEffect(() => {
    setFilteredPolizas(filteredPolizasOptimized);
  }, [filteredPolizasOptimized]);

  // Optimizar callback de selección de póliza
  const handlePolizaSelection = useCallback((val: any) => {
    if (!val) return;
    
    // Usar requestAnimationFrame para mejor rendimiento
    requestAnimationFrame(() => {
      setSelectedPoliza(val);
      setFormData(prev => ({
        ...prev,
        poliza_id: val.id,
        cliente_id: val.client_id || val.documento_cliente || '',
        aseguradora: val.aseguradora || ''
      }));
    });
  }, []);

  // Optimizar callback de búsqueda
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const loadPolizas = async () => {
    try {
      setLoadingPolizas(true);
      const response = await polizaService.getPolizasActivasParaSiniestros();
      if (response && response.data) {
        const polizasArray = Array.isArray(response.data) ? response.data : [];
        setPolizas(polizasArray);
        setFilteredPolizas(polizasArray.slice(0, 100)); // Inicializar con primeras 100
        // clientes calculados omitidos (no necesarios en esta UI)
      } else {
        setPolizas([]);
        setFilteredPolizas([]);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las pólizas disponibles',
      });
      setPolizas([]);
      setFilteredPolizas([]);
    } finally {
      setLoadingPolizas(false);
    }
  };

  const validateField = (name: string, value: any): string | null => {
    switch (name) {
      case 'poliza_id':
        if (!value || Number(value) <= 0) return 'Debe seleccionar una póliza';
        break;
      case 'tipo_seguro':
        if (!value) return 'El tipo de seguro es requerido';
        break;
      case 'tipo_siniestro':
        if (!value) return 'El tipo de siniestro es requerido';
        break;
      case 'fecha_ocurrencia':
        if (!value) return 'La fecha del siniestro es requerida';
        if (new Date(value) > new Date()) return 'La fecha de ocurrencia no puede ser futura';
        break;
      case 'fecha_aviso':
        if (!value) return 'La fecha de aviso es requerida';
        if (formData.fecha_ocurrencia && new Date(value) < new Date(formData.fecha_ocurrencia)) {
          return 'La fecha de aviso debe ser posterior o igual a la fecha de ocurrencia';
        }
        if (new Date(value) > new Date()) return 'La fecha de aviso no puede ser futura';
        break;
      case 'fecha_notificacion_aseguradora':
        if (!value) return 'La fecha de notificación es requerida';
        if (formData.fecha_aviso && new Date(value) < new Date(formData.fecha_aviso)) {
          return 'La fecha de notificación debe ser posterior o igual a la fecha de aviso';
        }
        if (new Date(value) > new Date()) return 'La fecha de notificación no puede ser futura';
        break;
      case 'monto_reclamo':
        if (value === '' || value === null || value === undefined || isNaN(Number(value))) return 'El monto reclamado es requerido';
        if (parseFloat(value) <= 0) return 'El monto reclamado debe ser mayor a 0';
        if (parseFloat(value) > 999999999999) return 'El monto excede el límite permitido';
        break;
      case 'descripcion_hechos':
        if (!value || (value ?? '').length === 0) return 'La descripción de los hechos es requerida';
        if ((value ?? '').length < 10) return 'La descripción debe tener al menos 10 caracteres';
        if ((value ?? '').length > 2000) return 'La descripción no puede exceder 2000 caracteres';
        break;
      case 'coaseguros':
        if (parseFloat(value) > 100) return 'El coaseguro no puede superar el 100%';
        break;
      case 'numero_siniestro_compania':
        if (value && value.length > 100) return 'El número de siniestro es muy largo';
        break;
      case 'numero_siniestro':
        if (value && value.length > 100) return 'El número interno de siniestro es muy largo';
        break;
      case 'lugar_ocurrencia':
        if (!value) return 'El lugar de ocurrencia es requerido';
        break;
      case 'ciudad_ocurrencia':
        if (!value) return 'La ciudad es requerida';
        break;
      case 'departamento_ocurrencia':
        if (!value) return 'El departamento es requerido';
        break;
      case 'aseguradora':
        if (!value) return 'La aseguradora es requerida';
        break;
    }
    return null;
  };

  // Función para prevenir submit con Enter en pasos intermedios
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si está en un paso intermedio, intentar avanzar al siguiente
      if (currentStep < 4 && validateStepBeforeNext(currentStep)) {
        setCurrentStep((s) => Math.min(4, s + 1));
      }
      // En el paso final (4), no hacer nada automáticamente
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;

    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      processedValue = checkbox.checked;
    } else if (name === 'poliza_id') {
      const polizaId = parseInt(value);
      const polizaSeleccionada = polizas.find(p => p.id === polizaId);
      setSelectedPoliza(polizaSeleccionada);
      setFormData(prev => ({
        ...prev,
        poliza_id: polizaId,
        cliente_id: polizaSeleccionada?.client_id || polizaSeleccionada?.documento_cliente || '',
        aseguradora: polizaSeleccionada?.aseguradora || ''
      }));
      return;
    } else if (['monto_reclamo', 'valor_indemnizacion', 'deducible', 'coaseguros'].includes(name)) {
      processedValue = value === '' ? '' : (parseFloat(value) || value);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    // Validar inmediatamente para campos requeridos
    const requiredFields = ['poliza_id', 'tipo_seguro', 'tipo_siniestro', 'descripcion_hechos', 'monto_reclamo', 'fecha_ocurrencia', 'fecha_aviso', 'fecha_notificacion_aseguradora', 'lugar_ocurrencia', 'ciudad_ocurrencia', 'departamento_ocurrencia', 'aseguradora'];
    if (requiredFields.includes(name)) {
      const error = validateField(name, processedValue);
      if (error) {
        setValidationErrors(prev => ({ ...prev, [name]: error }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    } else {
      // Limpiar error si no es campo requerido
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validar solo campos requeridos antes de enviar
    const requiredFieldsForSubmit = ['poliza_id', 'tipo_seguro', 'tipo_siniestro', 'descripcion_hechos', 'monto_reclamo', 'fecha_ocurrencia', 'fecha_aviso', 'fecha_notificacion_aseguradora', 'lugar_ocurrencia', 'ciudad_ocurrencia', 'departamento_ocurrencia', 'aseguradora'];
    const errors: ValidationErrors = {};
    
    requiredFieldsForSubmit.forEach(key => {
      const err = validateField(key, (formData as any)[key]);
      if (err) errors[key] = err;
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const errorMessages = Object.values(errors);
      toast({
        variant: 'destructive',
        title: 'Formulario incompleto',
        description: `Campos requeridos: ${errorMessages.slice(0, 2).join(', ')}${errorMessages.length > 2 ? '...' : ''}`,
      });
      setLoading(false);
      return;
    }

    if (!formData.poliza_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe seleccionar una póliza',
      });
      setLoading(false);
      return;
    }

    // Validación adicional para asegurar valores válidos
    if (!formData.tipo_siniestro || !Object.keys(TIPOS_SINIESTRO_DISPONIBLES).includes(formData.tipo_siniestro)) {
      toast({
        variant: 'destructive',
        title: 'Error de validación',
        description: 'El tipo de siniestro seleccionado no es válido',
      });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        poliza_id: formData.poliza_id,
        cliente_id: typeof formData.cliente_id === 'string' ? parseInt(formData.cliente_id) || formData.cliente_id : formData.cliente_id,
        tipo_seguro: formData.tipo_seguro,
        tipo_siniestro: formData.tipo_siniestro,
        fecha_ocurrencia: formData.fecha_ocurrencia,
        fecha_aviso: formData.fecha_aviso,
        fecha_notificacion_aseguradora: formData.fecha_notificacion_aseguradora,
        fecha_reporte: formData.fecha_aviso, // Agregar para compatibilidad con BD
        monto_reclamo: formData.monto_reclamo,
        descripcion_hechos: formData.descripcion_hechos,
        lugar_ocurrencia: formData.lugar_ocurrencia,
        ciudad_ocurrencia: formData.ciudad_ocurrencia,
        departamento_ocurrencia: formData.departamento_ocurrencia,
        aseguradora: formData.aseguradora,
        prioridad: formData.prioridad,
        assigned_adjuster_id: formData.assigned_adjuster_id,
        involucra_terceros: formData.involucra_terceros,
        hay_heridos: formData.hay_heridos,
        hay_danos_materiales: formData.hay_danos_materiales,
        datos_terceros: formData.datos_terceros,
        informacion_heridos: formData.informacion_heridos,
        danos_materiales: formData.danos_materiales,
        causa_siniestro: formData.causa_siniestro,
        numero_siniestro: (formData as any).numero_siniestro || undefined,
        testigos: [],
      } as any;

      console.log('🚀 Enviando payload:', payload);
      const response = await siniestroService.createSiniestro(payload);
      console.log('✅ Respuesta exitosa:', response);
      
      // Éxito - mostrar mensaje y navegar
      toast({
        title: 'Siniestro creado exitosamente',
        description: `Número: ${response.numero_siniestro}`,
      });
      
      navigate('/apps/seguros/siniestros');
      
    } catch (err: any) {
      console.error('❌ Error completo:', err);
      console.error('❌ Response data:', err.response?.data);
      console.error('❌ Status:', err.response?.status);
      
      // Manejar diferentes tipos de error
      if (err.response?.status === 409) {
        // Siniestro ya existe para esta póliza
        const existente = err.response.data.siniestro_existente;
        toast({
          variant: 'destructive',
          title: 'Siniestro ya existe',
          description: `Ya existe el siniestro ${existente?.numero_siniestro} para esta póliza. Estado: ${existente?.estado}`
        });
      } else if (err.response?.status === 422) {
        // Errores de validación
        const messages = err.response.data.messages;
        if (messages) {
          const errorList = Object.entries(messages).map(([field, errors]) =>
            `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
          );
          toast({
            variant: 'destructive',
            title: 'Datos inválidos',
            description: errorList.slice(0, 2).join(' | ') + (errorList.length > 2 ? '...' : '')
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Datos inválidos',
            description: err.response.data.error || 'Revise los datos ingresados'
          });
        }
      } else if (err.response?.status === 500) {
        // Error interno del servidor
        const serverMessage = err.response.data?.message || err.response.data?.error || 'Error interno del servidor';
        toast({
          variant: 'destructive',
          title: 'Error del servidor',
          description: serverMessage
        });
        setError(`Error 500: ${serverMessage}`);
      } else {
        // Error genérico
        const genericMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Error desconocido';
        toast({
          variant: 'destructive',
          title: 'Error al crear siniestro',
          description: genericMessage
        });
        setError(`Error: ${genericMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // cancelar removido del flujo

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);

  const handleAddAmparo = () => {
    if (amparoNuevo.amparo && amparoNuevo.valor && parseFloat(amparoNuevo.valor.toString()) > 0) {
      if ((formData.amparos_afectados?.length || 0) >= 20) {
        toast({ variant: 'destructive', title: 'Límite alcanzado', description: 'No se pueden agregar más de 20 amparos' });
        return;
      }
      setFormData(prev => ({ ...prev, amparos_afectados: [...(prev.amparos_afectados || []), { ...amparoNuevo }] }));
      setAmparoNuevo({ nombre_reclamante: '', amparo: '', valor: '' as any });
    }
  };

  const handleRemoveAmparo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      amparos_afectados: (prev.amparos_afectados || []).filter((_, i) => i !== index)
    }));
  };

  // notas: sugerencias de ciudades/departamentos removidas para simplificar, se puede reactivar si se requiere

  const InfoPolizaCard = () => {
    if (!selectedPoliza) return null;
    return (
      <CardBox className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Información de la Póliza</h3>
          <Badge color="success">Activa</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Número de Póliza</p>
            <p className="font-medium">{selectedPoliza.numero_poliza}</p>
          </div>
          <div>
            <p className="text-gray-500">Cliente</p>
            <p className="font-medium">{selectedPoliza.cliente}</p>
          </div>
          <div>
            <p className="text-gray-500">Aseguradora</p>
            <p className="font-medium">{selectedPoliza.aseguradora}</p>
          </div>
          <div>
            <p className="text-gray-500">Tipo de Seguro</p>
            <p className="font-medium">{selectedPoliza.tipo_seguro}</p>
          </div>
          <div>
            <p className="text-gray-500">Prima</p>
            <p className="font-medium">{formatCurrency(parseFloat(selectedPoliza.prima?.toString() || '0'))}</p>
          </div>
          <div>
            <p className="text-gray-500">Vigencia</p>
            <p className="font-medium">
              {new Date(selectedPoliza.fecha_inicio).toLocaleDateString('es-CO')} - 
              {new Date(selectedPoliza.fecha_fin).toLocaleDateString('es-CO')}
            </p>
          </div>
        </div>
      </CardBox>
    );
  };

  return (
    <>
      {/* Header y error */}
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" onClick={() => navigate('/apps/seguros/siniestros')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Siniestro</h1>
          <p className="text-gray-600">Registra un nuevo siniestro en el sistema</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <Icon icon="solar:danger-circle-bold" className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
      {/* Stepper y layout principal */}
      <ShCard className="mb-4">
        <CardContent>
          <Stepper currentStep={currentStep} steps={steps} onStepClick={(i) => setCurrentStep(i)} />
        </CardContent>
      </ShCard>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3 space-y-6">
          {/* PASO 1: Información General */}
          {currentStep === 0 && (
            <div className="space-y-6">
              {selectedPoliza && <InfoPolizaCard />}
              <ShCard>
                <CardHeader>
                  <CardTitle>Información General</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Póliza */}
                    <div>
                      <div className="flex items-center gap-1">
                        <Label htmlFor="poliza_id" className="m-0 p-0 leading-none">
                          Póliza <span className="text-red-500">*</span>
                        </Label>
                        <Tooltip content="Seleccione la póliza afectada por el siniestro">
                          <HiInformationCircle className="h-4 w-4 text-gray-400 align-middle relative top-[1px]" />
                        </Tooltip>
                      </div>
                      <Combobox
                        value={(polizas || []).find((p:any) => p.id === formData.poliza_id) || null}
                        onChange={handlePolizaSelection}
                      >
                        <div className="relative z-[60]">
                          <ComboboxInput
                            as={Input}
                            className="w-full mt-1"
                            displayValue={(item: any) => item ? `${item.numero_poliza} - ${item.cliente} (${item.aseguradora})` : ''}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Buscar póliza por número o cliente"
                          />
                          <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                            <Icon icon="solar:alt-arrow-down-outline" height={20} />
                          </ComboboxButton>
                        </div>
                        <ComboboxOptions anchor="bottom" transition className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0">
                          {loadingPolizas ? (
                            <div className="px-3 py-2 text-sm text-gray-500">Cargando pólizas...</div>
                          ) : filteredPolizas.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              {searchTerm ? 'No se encontraron pólizas' : 'No hay pólizas disponibles'}
                            </div>
                          ) : (
                            filteredPolizas.map((p:any) => (
                              <ComboboxOption key={p.id} value={p} className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary">
                                <Icon icon="solar:check-read-linear" className="invisible group-data-[selected]:visible" height={20} />
                                <div className="text-sm">{p.numero_poliza} - {p.cliente} ({p.aseguradora})</div>
                              </ComboboxOption>
                            ))
                          )}
                        </ComboboxOptions>
                      </Combobox>
                      {validationErrors.poliza_id && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.poliza_id}</p>
                      )}
                    </div>

                    {/* Tipo de Seguro */}
                    <div>
                      <div className="flex items-center gap-1">
                        <Label htmlFor="tipo_seguro" className="m-0 p-0 leading-none">Tipo de Seguro <span className="text-red-500">*</span></Label>
                        <Tooltip content="Ramo o tipo de seguro">
                          <HiInformationCircle className="h-4 w-4 text-gray-400 align-middle relative top-[1px]" />
                        </Tooltip>
                      </div>
                      <ShSelect value={formData.tipo_seguro} onValueChange={(v) => handleInputChange({ target: { name: 'tipo_seguro', value: v } } as any)}>
                        <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar" /></ShSelectTrigger>
                        <ShSelectContent>
                          {Object.entries(TIPOS_SEGURO).map(([key, label]) => (
                            <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                          ))}
                        </ShSelectContent>
                      </ShSelect>
                      {validationErrors.tipo_seguro && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.tipo_seguro}</p>
                      )}
                    </div>

                    {/* Tipo de Siniestro */}
                    <div>
                      <div className="flex items-center gap-1">
                        <Label htmlFor="tipo_siniestro" className="m-0 p-0 leading-none">Tipo de Siniestro <span className="text-red-500">*</span></Label>
                        <Tooltip content="Categoría del siniestro">
                          <HiInformationCircle className="h-4 w-4 text-gray-400 align-middle relative top-[1px]" />
                        </Tooltip>
                      </div>
                      <ShSelect
                        value={formData.tipo_siniestro || 'robo_total'}
                        onValueChange={(v) => handleInputChange({ target: { name: 'tipo_siniestro', value: v } } as any)}
                      >
                        <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar" /></ShSelectTrigger>
                        <ShSelectContent>
                          {Object.entries(TIPOS_SINIESTRO_DISPONIBLES).map(([key, label]) => (
                            <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                          ))}
                        </ShSelectContent>
                      </ShSelect>
                      {validationErrors.tipo_siniestro && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.tipo_siniestro}</p>
                      )}
                    </div>

                    {/* Número de Siniestro (Interno) opcional - si no se envía, el backend autogenera */}
                    <div>
                      <Label htmlFor="numero_siniestro">Número de Siniestro (Interno)</Label>
                      <Input
                        id="numero_siniestro"
                        name="numero_siniestro"
                        type="text"
                        value={(formData as any).numero_siniestro || ''}
                        onChange={handleInputChange}
                        placeholder="Ingrese el número interno si aplica (si lo dejas vacío se autogenera)"
                        maxLength={100}
                        className="mt-1"
                      />
                      {validationErrors.numero_siniestro && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.numero_siniestro}</p>
                      )}
                    </div>

                    {/* Número de Siniestro Compañía (opcional) */}
                    <div>
                      <Label htmlFor="numero_siniestro_compania">Número Siniestro Aseguradora</Label>
                      <Input
                        id="numero_siniestro_compania"
                        name="numero_siniestro_compania"
                        type="text"
                        value={formData.numero_siniestro_compania}
                        onChange={handleInputChange}
                        placeholder="Ej: SIN-2024-001234"
                        maxLength={100}
                        className="mt-1"
                      />
                    </div>

                    {/* Proveedor asignado (opcional) */}
                    <div>
                      <Label htmlFor="proveedor_asignado">Proveedor Asignado</Label>
                      <Input
                        id="proveedor_asignado"
                        name="proveedor_asignado"
                        type="text"
                        value={formData.proveedor_asignado}
                        onChange={handleInputChange}
                        placeholder="Nombre del proveedor o taller"
                        maxLength={255}
                        className="mt-1"
                      />
                    </div>

                    {/* Descripción */}
                    <div className="md:col-span-3">
                      <Label htmlFor="descripcion_hechos">Descripción de los Hechos <span className="text-red-500">*</span></Label>
                      <Textarea
                        id="descripcion_hechos"
                        name="descripcion_hechos"
                        value={formData.descripcion_hechos}
                        onChange={handleInputChange}
                        placeholder="Describa detalladamente cómo ocurrió el siniestro, incluyendo circunstancias, daños y cualquier información relevante"
                        rows={4}
                        required
                        minLength={10}
                        maxLength={2000}
                        className={`mt-1 ${validationErrors.descripcion_hechos ? 'border-red-500' : ''}`}
                      />
                      <div className="flex justify-between mt-1">
                        <p className="text-xs text-gray-500">Mínimo 10 caracteres</p>
                        <p className="text-xs text-gray-500">{(formData.descripcion_hechos || '').length}/2000</p>
                      </div>
                      {validationErrors.descripcion_hechos && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.descripcion_hechos}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </ShCard>
            </div>
          )}

          {/* PASO 2: Cliente */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <ShCard>
                <CardHeader>
                  <CardTitle>Cliente y Ubicación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3 text-sm">
                      <p className="text-gray-600">El cliente se toma de la póliza seleccionada.</p>
                      {selectedPoliza ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><span className="text-gray-500">Cliente</span><p className="font-medium">{selectedPoliza.cliente}</p></div>
                          <div><span className="text-gray-500">Documento</span><p className="font-medium">{selectedPoliza.documento_cliente}</p></div>
                        </div>
                      ) : (
                        <p className="text-red-500">Seleccione primero una póliza en el paso anterior.</p>
                      )}
                    </div>

                    {/* Campos de ubicación */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium mb-4">Ubicación del Siniestro</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <Label htmlFor="lugar_ocurrencia">Lugar de Ocurrencia <span className="text-red-500">*</span></Label>
                          <Input
                            id="lugar_ocurrencia"
                            name="lugar_ocurrencia"
                            value={formData.lugar_ocurrencia}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Dirección exacta del siniestro"
                            required
                            className={`mt-1 ${validationErrors.lugar_ocurrencia ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.lugar_ocurrencia && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.lugar_ocurrencia}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="ciudad_ocurrencia">Ciudad <span className="text-red-500">*</span></Label>
                          <Input
                            id="ciudad_ocurrencia"
                            name="ciudad_ocurrencia"
                            value={formData.ciudad_ocurrencia}
                            onChange={handleInputChange}
                            placeholder="Ciudad donde ocurrió"
                            required
                            className={`mt-1 ${validationErrors.ciudad_ocurrencia ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.ciudad_ocurrencia && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.ciudad_ocurrencia}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="departamento_ocurrencia">Departamento <span className="text-red-500">*</span></Label>
                          <Input
                            id="departamento_ocurrencia"
                            name="departamento_ocurrencia"
                            value={formData.departamento_ocurrencia}
                            onChange={handleInputChange}
                            placeholder="Departamento"
                            required
                            className={`mt-1 ${validationErrors.departamento_ocurrencia ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.departamento_ocurrencia && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.departamento_ocurrencia}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="aseguradora">Aseguradora <span className="text-red-500">*</span></Label>
                          <Input
                            id="aseguradora"
                            name="aseguradora"
                            value={formData.aseguradora}
                            onChange={handleInputChange}
                            placeholder="Nombre de la aseguradora"
                            required
                            className={`mt-1 ${validationErrors.aseguradora ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.aseguradora && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.aseguradora}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </ShCard>
            </div>
          )}

          {/* PASO 3: Financiera y Pagos */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <ShCard>
                <CardHeader>
                  <CardTitle>Financiera y Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Monto reclamado */}
                    <div>
                      <Label htmlFor="monto_reclamo">Monto Reclamado <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          id="monto_reclamo"
                          name="monto_reclamo"
                          type="number"
                          value={formData.monto_reclamo}
                          onChange={handleInputChange}
                          placeholder="Ingrese el monto reclamado"
                          min="1"
                          max="999999999999"
                          required
                          className={`mt-1 ${validationErrors.monto_reclamo ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {validationErrors.monto_reclamo && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.monto_reclamo}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="valor_indemnizacion">Valor de Indemnización</Label>
                      <div className="relative">
                        <Input
                          id="valor_indemnizacion"
                          name="valor_indemnizacion"
                          type="number"
                          value={formData.valor_indemnizacion}
                          onChange={handleInputChange}
                          placeholder="Valor de indemnización"
                          min="0"
                          max="999999999999"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="deducible">Deducible</Label>
                      <div className="relative">
                        <Input
                          id="deducible"
                          name="deducible"
                          type="number"
                          value={formData.deducible}
                          onChange={handleInputChange}
                          placeholder="Valor del deducible"
                          min="0"
                          max="999999999999"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="coaseguros">Coaseguros (%)</Label>
                      <div className="relative">
                        <Input
                          id="coaseguros"
                          name="coaseguros"
                          type="number"
                          value={formData.coaseguros}
                          onChange={handleInputChange}
                          placeholder="% de coaseguro"
                          min="0"
                          max="100"
                          className={`mt-1 pr-8 ${validationErrors.coaseguros ? 'border-red-500' : ''}`}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                      </div>
                      {validationErrors.coaseguros && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.coaseguros}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </ShCard>
            </div>
          )}

          {/* PASO 4: Fechas */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <ShCard>
                <CardHeader>
                  <CardTitle>Fechas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="fecha_ocurrencia">Fecha del Siniestro <span className="text-red-500">*</span></Label>
                      <Input
                        id="fecha_ocurrencia"
                        name="fecha_ocurrencia"
                        type="date"
                        value={formData.fecha_ocurrencia}
                        onChange={handleInputChange}
                        required
                        className={`mt-1 ${validationErrors.fecha_ocurrencia ? 'border-red-500' : ''}`}
                      />
                      {validationErrors.fecha_ocurrencia && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.fecha_ocurrencia}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fecha_aviso">Fecha de Aviso <span className="text-red-500">*</span></Label>
                      <Input
                        id="fecha_aviso"
                        name="fecha_aviso"
                        type="date"
                        value={formData.fecha_aviso}
                        onChange={handleInputChange}
                        required
                        className={`mt-1 ${validationErrors.fecha_aviso ? 'border-red-500' : ''}`}
                      />
                      {validationErrors.fecha_aviso && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.fecha_aviso}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="fecha_notificacion_aseguradora">Fecha Notificación Aseguradora <span className="text-red-500">*</span></Label>
                      <Input
                        id="fecha_notificacion_aseguradora"
                        name="fecha_notificacion_aseguradora"
                        type="date"
                        value={formData.fecha_notificacion_aseguradora}
                        onChange={handleInputChange}
                        required
                        className={`mt-1 ${validationErrors.fecha_notificacion_aseguradora ? 'border-red-500' : ''}`}
                      />
                      {validationErrors.fecha_notificacion_aseguradora && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.fecha_notificacion_aseguradora}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </ShCard>
            </div>
          )}

          {/* PASO 5: Beneficiarios */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <ShCard>
                <CardHeader>
                  <CardTitle>Beneficiarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="amparo_nombre_reclamante">Nombre Reclamante</Label>
                        <Input
                          id="amparo_nombre_reclamante"
                          type="text"
                          value={amparoNuevo.nombre_reclamante}
                          onChange={(e) => setAmparoNuevo(prev => ({...prev, nombre_reclamante: e.target.value}))}
                          placeholder="Nombre del reclamante"
                          maxLength={255}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="amparo_amparo">Tipo de Amparo</Label>
                        <Input
                          id="amparo_amparo"
                          type="text"
                          value={amparoNuevo.amparo}
                          onChange={(e) => setAmparoNuevo(prev => ({...prev, amparo: e.target.value}))}
                          placeholder="Ej: Daños materiales, Responsabilidad civil"
                          maxLength={255}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="amparo_valor">Valor (COP)</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                            <Input
                              id="amparo_valor"
                              type="number"
                              value={amparoNuevo.valor}
                              onChange={(e) => setAmparoNuevo(prev => ({...prev, valor: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0}))}
                              placeholder="Valor del amparo"
                              min="0"
                              max="999999999999"
                              className="mt-1"
                            />
                          </div>
                          <Button 
                            type="button" 
                            onClick={handleAddAmparo}
                            disabled={!amparoNuevo.amparo || amparoNuevo.valor <= 0}
                            className="mt-1"
                            title="Agregar amparo"
                          >
                            <Icon icon="solar:add-circle-bold" height={20} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {(formData.amparos_afectados || []).length > 0 && (
                      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">Amparos Registrados:</h4>
                          <Badge color="info">{formData.amparos_afectados?.length}/20</Badge>
                        </div>
                        <div className="space-y-2">
                          {(formData.amparos_afectados || []).map((amparo, index) => (
                            <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-3 rounded border">
                              <div className="flex-1">
                                <span className="font-medium">{amparo.nombre_reclamante || 'Sin nombre'}</span> - 
                                <span className="ml-2">{amparo.amparo}</span> - 
                                <span className="ml-2 font-semibold text-blue-600">{formatCurrency(amparo.valor)}</span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveAmparo(index)}
                                title="Eliminar amparo"
                              >
                                <Icon icon="solar:trash-bin-trash-bold" height={16} />
                              </Button>
                            </div>
                          ))}
                          <div className="text-right font-semibold mt-2 pt-2 border-t">
                            Total Amparos: {formatCurrency((formData.amparos_afectados || []).reduce((sum, amp) => sum + amp.valor, 0))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </ShCard>
            </div>
          )}

          {/* Acciones bajo la columna izquierda (fondo blanco) */}
          <ShCard className="p-4">
            <div className="flex justify-between">
              {currentStep === 0 ? (
                <div />
              ) : (
                <Button type="button" variant="outline" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} disabled={loading || loadingPolizas}>Anterior</Button>
              )}
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (validateStepBeforeNext(currentStep)) {
                      setCurrentStep((s) => Math.min(4, s + 1));
                    }
                  }}
                  disabled={loading || loadingPolizas}
                >
                  Siguiente
                </Button>
              ) : currentStep === 4 ? (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(e);
                  }}
                  disabled={loading || loadingPolizas}
                >
                  {loading ? 'Creando...' : 'Crear Siniestro'}
                </Button>
              ) : null}
            </div>
          </ShCard>
        </div>
        {/* Panel lateral derecho: Información Adicional */}
        <div className="lg:col-span-1">
          <div className="lg:sticky top-4">
          <ShCard className="p-6">
            <CardHeader>
              <CardTitle>Información Adicional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="estado">Estado del Siniestro</Label>
                  <ShSelect value={formData.estado || 'reportado'} onValueChange={(v) => handleInputChange({ target: { name: 'estado', value: v } } as any)}>
                    <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar" /></ShSelectTrigger>
                    <ShSelectContent>
                      {Object.entries(ESTADOS_SINIESTRO).map(([key, label]) => (
                        <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                      ))}
                    </ShSelectContent>
                  </ShSelect>
                </div>

                <div>
                  <Label className="mb-2 block">Siniestro Finalizado</Label>
                  <ToggleSwitch
                    checked={!!formData.finalizado}
                    label=""
                    onChange={(checked) => setFormData(prev => ({ ...prev, finalizado: checked }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </ShCard>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default NuevoSiniestroMejorado;

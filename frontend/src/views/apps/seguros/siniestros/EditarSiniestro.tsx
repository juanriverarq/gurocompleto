import { useState, useEffect, useMemo, useCallback } from 'react';
import { Textarea, Badge, Tooltip, ToggleSwitch, Modal } from 'flowbite-react';
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
import { Card as ShCard, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router-dom';
import CardBox from 'src/components/shared/CardBox';
import { siniestroService, Siniestro } from '../../../../services/siniestroService';
import { siniestroDocumentsService } from '../../../../services/siniestroDocumentsService';
import { useToast } from 'src/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { HiInformationCircle } from 'react-icons/hi';

// Tipos de siniestro disponibles
const TIPOS_SINIESTRO = {
  'colision': 'Colisión',
  'robo_total': 'Robo Total',
  'robo_parcial': 'Robo Parcial',
  'incendio': 'Incendio',
  'vandalismo': 'Vandalismo',
  'fenomenos_naturales': 'Fenómenos Naturales',
  'accidente_laboral': 'Accidente Laboral',
  'responsabilidad_civil': 'Responsabilidad Civil',
  'daños_terceros': 'Daños a Terceros',
  'muerte': 'Muerte',
  'incapacidad': 'Incapacidad',
  'enfermedad': 'Enfermedad',
  'hospitalizacion': 'Hospitalización',
  'cirugia': 'Cirugía',
  'daños_agua': 'Daños por Agua',
  'explosion': 'Explosión',
  'terremoto': 'Terremoto',
  'inundacion': 'Inundación',
  'granizo': 'Granizo',
  'vientos_fuertes': 'Vientos Fuertes',
  'otro': 'Otro',
};

// Tipos de seguro disponibles
const TIPOS_SEGURO = {
  'auto': 'Automóvil',
  'vida': 'Vida',
  'hogar': 'Hogar',
  'empresarial': 'Empresarial',
  'salud': 'Salud',
  'responsabilidad_civil': 'Responsabilidad Civil',
  'transporte': 'Transporte',
  'construccion': 'Construcción',
  'agropecuario': 'Agropecuario',
  'fianza': 'Fianza',
};

// Prioridades disponibles
const PRIORIDADES = {
  'baja': 'Baja',
  'media': 'Media',
  'alta': 'Alta',
  'critica': 'Crítica',
};

// Estados del siniestro con configuración
const ESTADOS_CONFIG = {
  'reportado': { label: 'Reportado', color: 'gray', icon: 'solar:file-text-bold' },
  'asignado': { label: 'Asignado', color: 'blue', icon: 'solar:user-check-bold' },
  'en_revision': { label: 'En Revisión', color: 'blue', icon: 'solar:eye-bold' },
  'investigacion': { label: 'Investigación', color: 'orange', icon: 'solar:magnifer-bold' },
  'peritaje': { label: 'Peritaje', color: 'purple', icon: 'solar:document-medicine-bold' },
  'documentos_pendientes': { label: 'Documentos Pendientes', color: 'yellow', icon: 'solar:documents-bold' },
  'aprobado': { label: 'Aprobado', color: 'green', icon: 'solar:check-circle-bold' },
  'rechazado': { label: 'Rechazado', color: 'red', icon: 'solar:close-circle-bold' },
  'pagado': { label: 'Pagado', color: 'success', icon: 'solar:dollar-bold' },
  'cerrado': { label: 'Cerrado', color: 'gray', icon: 'solar:lock-bold' },
};

// Estados disponibles para cambio
const ESTADOS_DISPONIBLES = [
  'reportado',
  'asignado',
  'en_revision',
  'investigacion',
  'peritaje',
  'documentos_pendientes',
  'aprobado',
  'rechazado',
  'pagado',
  'cerrado'
];

// Stepper visual
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
                onClick={() => onStepClick(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-primary text-white shadow-lg transform scale-110 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-pointer hover:bg-gray-300'
                }`}
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

interface FormDataSiniestro {
  numero_siniestro?: string;
  numero_siniestro_compania?: string;
  tipo_seguro: string;
  tipo_siniestro: string;
  fecha_ocurrencia: string;
  fecha_aviso: string;
  fecha_notificacion_aseguradora: string;
  fecha_reporte?: string;
  monto_reclamo: number;
  monto_reclamado: number;
  descripcion_hechos: string;
  descripcion_evento: string;
  lugar_ocurrencia: string;
  ciudad_ocurrencia: string;
  departamento_ocurrencia: string;
  aseguradora: string;
  proveedor_asignado?: string;
  prioridad: string;
  estado: string;
  finalizado: boolean;
  // Campos adicionales del modelo
  valor_indemnizacion?: number;
  deducible?: number;
  coaseguros?: number;
  resolucion?: string;
  involucra_terceros: boolean;
  hay_heridos: boolean;
  hay_danos_materiales: boolean;
  datos_terceros?: string;
  informacion_heridos?: string;
  danos_materiales?: string;
  causa_siniestro?: string;
  // Campos de evaluación
  evaluacion_inicial?: string;
  informe_investigacion?: string;
  informe_peritaje?: string;
  dictamen_final?: string;
  // Campos de rechazo
  motivo_rechazo?: string;
  tipo_rechazo?: string;
  // Campos de pago
  monto_aprobado?: number;
  monto_pagado?: number;
  metodo_pago?: string;
  numero_cheque?: string;
  numero_transferencia?: string;
  cuenta_destino?: string;
  beneficiario_pago?: string;
  // Campos de aseguradora
  numero_poliza_aseguradora?: string;
  contacto_aseguradora?: string;
  email_aseguradora?: string;
  telefono_aseguradora?: string;
  // Campos de ajustador
  nombre_ajustador?: string;
  empresa_ajustadora?: string;
  contacto_ajustador?: string;
  email_ajustador?: string;
  telefono_ajustador?: string;
  // Campos de calidad
  calificacion_servicio?: number | string;
  comentarios_cliente?: string;
  cliente_satisfecho?: boolean;
  // Campos de recuperación
  tiene_recuperacion: boolean;
  monto_recuperado?: number;
  detalles_recuperacion?: string;
  // Campos de reapertura
  reabierto: boolean;
  motivo_reapertura?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const EditarSiniestro = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingSiniestro, setLoadingSiniestro] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siniestro, setSiniestro] = useState<Siniestro | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [activeTab, setActiveTab] = useState<string>('formulario');
  
  // Modal para cambio de estado
  const [showStateModal, setShowStateModal] = useState(false);
  const [newState, setNewState] = useState('');
  const [stateObservation, setStateObservation] = useState('');
  const [changingState, setChangingState] = useState(false);
  
  const steps = [
    { title: 'Información General', description: 'Datos básicos' },
    { title: 'Ubicación y Aseguradora', description: 'Lugar y compañía' },
    { title: 'Montos y Financiero', description: 'Valores y pagos' },
    { title: 'Fechas y Tiempos', description: 'Cronología' },
    { title: 'Evaluación y Documentos', description: 'Informes y archivos' },
    { title: 'Calidad y Cierre', description: 'Satisfacción y finalización' },
  ];

  const [formData, setFormData] = useState<FormDataSiniestro>({
    numero_siniestro: '',
    numero_siniestro_compania: '',
    tipo_seguro: 'auto',
    tipo_siniestro: 'colision',
    fecha_ocurrencia: '',
    fecha_aviso: '',
    fecha_notificacion_aseguradora: '',
    fecha_reporte: '',
    monto_reclamo: 0,
    monto_reclamado: 0,
    descripcion_hechos: '',
    descripcion_evento: '',
    lugar_ocurrencia: '',
    ciudad_ocurrencia: '',
    departamento_ocurrencia: '',
    aseguradora: '',
    proveedor_asignado: '',
    prioridad: 'media',
    estado: 'reportado',
    finalizado: false,
    valor_indemnizacion: 0,
    deducible: 0,
    coaseguros: 0,
    resolucion: '',
    involucra_terceros: false,
    hay_heridos: false,
    hay_danos_materiales: false,
    datos_terceros: '',
    informacion_heridos: '',
    danos_materiales: '',
    causa_siniestro: '',
    evaluacion_inicial: '',
    informe_investigacion: '',
    informe_peritaje: '',
    dictamen_final: '',
    motivo_rechazo: '',
    tipo_rechazo: '',
    monto_aprobado: 0,
    monto_pagado: 0,
    metodo_pago: '',
    numero_cheque: '',
    numero_transferencia: '',
    cuenta_destino: '',
    beneficiario_pago: '',
    numero_poliza_aseguradora: '',
    contacto_aseguradora: '',
    email_aseguradora: '',
    telefono_aseguradora: '',
    nombre_ajustador: '',
    empresa_ajustadora: '',
    contacto_ajustador: '',
    email_ajustador: '',
    telefono_ajustador: '',
    calificacion_servicio: '',
    comentarios_cliente: '',
    cliente_satisfecho: false,
    tiene_recuperacion: false,
    monto_recuperado: 0,
    detalles_recuperacion: '',
    reabierto: false,
    motivo_reapertura: '',
  });

  useEffect(() => {
    if (id) {
      loadSiniestro();
    }
  }, [id]);

  useEffect(() => {
    if (siniestro?.id) {
      loadDocuments();
    }
  }, [siniestro?.id]);

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };

  const loadSiniestro = async () => {
    try {
      setLoadingSiniestro(true);
      setError(null);
      const siniestroData = await siniestroService.getSiniestro(parseInt(id!));

      setSiniestro(siniestroData);

      // Llenar el formulario con todos los datos del siniestro
      setFormData({
        numero_siniestro: siniestroData.numero_siniestro || '',
        numero_siniestro_compania: (siniestroData as any).numero_siniestro_compania || '',
        tipo_seguro: siniestroData.tipo_seguro || 'auto',
        tipo_siniestro: siniestroData.tipo_siniestro || 'colision',
        fecha_ocurrencia: formatDateForInput(siniestroData.fecha_ocurrencia) || '',
        fecha_aviso: formatDateForInput((siniestroData as any).fecha_aviso) || '',
        fecha_notificacion_aseguradora: formatDateForInput((siniestroData as any).fecha_notificacion_aseguradora) || '',
        fecha_reporte: formatDateForInput((siniestroData as any).fecha_reporte) || '',
        monto_reclamo: (siniestroData as any).monto_reclamo || siniestroData.monto_reclamado || 0,
        monto_reclamado: siniestroData.monto_reclamado || 0,
        descripcion_hechos: (siniestroData as any).descripcion_hechos || siniestroData.descripcion_evento || '',
        descripcion_evento: siniestroData.descripcion_evento || '',
        lugar_ocurrencia: siniestroData.lugar_ocurrencia || '',
        ciudad_ocurrencia: siniestroData.ciudad_ocurrencia || '',
        departamento_ocurrencia: siniestroData.departamento_ocurrencia || '',
        aseguradora: siniestroData.aseguradora || '',
        proveedor_asignado: (siniestroData as any).proveedor_asignado || '',
        prioridad: siniestroData.prioridad || 'media',
        estado: siniestroData.estado || 'reportado',
        finalizado: (siniestroData as any).finalizado || false,
        valor_indemnizacion: (siniestroData as any).valor_indemnizacion || 0,
        deducible: (siniestroData as any).deducible || 0,
        coaseguros: (siniestroData as any).coaseguros || 0,
        resolucion: (siniestroData as any).resolucion || '',
        involucra_terceros: siniestroData.involucra_terceros || false,
        hay_heridos: siniestroData.hay_heridos || false,
        hay_danos_materiales: siniestroData.hay_danos_materiales || false,
        datos_terceros: siniestroData.datos_terceros || '',
        informacion_heridos: siniestroData.informacion_heridos || '',
        danos_materiales: siniestroData.danos_materiales || '',
        causa_siniestro: siniestroData.causa_siniestro || '',
        evaluacion_inicial: siniestroData.evaluacion_inicial || '',
        informe_investigacion: siniestroData.informe_investigacion || '',
        informe_peritaje: siniestroData.informe_peritaje || '',
        dictamen_final: siniestroData.dictamen_final || '',
        motivo_rechazo: siniestroData.motivo_rechazo || '',
        tipo_rechazo: siniestroData.tipo_rechazo || '',
        monto_aprobado: siniestroData.monto_aprobado || 0,
        monto_pagado: siniestroData.monto_pagado || 0,
        metodo_pago: siniestroData.metodo_pago || '',
        numero_cheque: siniestroData.numero_cheque || '',
        numero_transferencia: siniestroData.numero_transferencia || '',
        cuenta_destino: siniestroData.cuenta_destino || '',
        beneficiario_pago: siniestroData.beneficiario_pago || '',
        numero_poliza_aseguradora: siniestroData.numero_poliza_aseguradora || '',
        contacto_aseguradora: siniestroData.contacto_aseguradora || '',
        email_aseguradora: siniestroData.email_aseguradora || '',
        telefono_aseguradora: siniestroData.telefono_aseguradora || '',
        nombre_ajustador: siniestroData.nombre_ajustador || '',
        empresa_ajustadora: siniestroData.empresa_ajustadora || '',
        contacto_ajustador: siniestroData.contacto_ajustador || '',
        email_ajustador: siniestroData.email_ajustador || '',
        telefono_ajustador: siniestroData.telefono_ajustador || '',
        calificacion_servicio: siniestroData.calificacion_servicio || 0,
        comentarios_cliente: siniestroData.comentarios_cliente || '',
        cliente_satisfecho: siniestroData.cliente_satisfecho || false,
        tiene_recuperacion: siniestroData.tiene_recuperacion || false,
        monto_recuperado: siniestroData.monto_recuperado || 0,
        detalles_recuperacion: siniestroData.detalles_recuperacion || '',
        reabierto: siniestroData.reabierto || false,
        motivo_reapertura: siniestroData.motivo_reapertura || '',
      });
    } catch (err: any) {
      setError('Error al cargar el siniestro');
      console.error('Error loading siniestro:', err);
    } finally {
      setLoadingSiniestro(false);
    }
  };

  const loadDocuments = async () => {
    if (!siniestro?.id) return;

    try {
      setLoadingDocuments(true);
      const response = await siniestroDocumentsService.listarDocumentos(siniestro.id.toString());
      if (response.success && response.data) {
        setDocuments(Array.isArray(response.data) ? response.data : []);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const validateField = (name: string, value: any): string | null => {
    switch (name) {
      case 'descripcion_hechos':
      case 'descripcion_evento':
        if (!value || value.length < 10) return 'La descripción debe tener al menos 10 caracteres';
        if (value.length > 2000) return 'La descripción no puede exceder 2000 caracteres';
        break;
      case 'monto_reclamo':
      case 'monto_reclamado':
        if (value <= 0) return 'El monto debe ser mayor a 0';
        break;
      case 'fecha_ocurrencia':
        if (!value) return 'La fecha de ocurrencia es requerida';
        if (new Date(value) > new Date()) return 'La fecha no puede ser futura';
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
      case 'email_aseguradora':
      case 'email_ajustador':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email inválido';
        break;
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;

    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      processedValue = checkbox.checked;
    } else if (['monto_reclamo', 'monto_reclamado', 'valor_indemnizacion', 'deducible', 'coaseguros', 'monto_aprobado', 'monto_pagado', 'monto_recuperado', 'calificacion_servicio'].includes(name)) {
      processedValue = value === '' ? 0 : (parseFloat(value) || 0);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    // Validar campo
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siniestro) return;

    // Validar campos requeridos
    const requiredFields = ['descripcion_hechos', 'monto_reclamo', 'fecha_ocurrencia', 'lugar_ocurrencia', 'ciudad_ocurrencia', 'departamento_ocurrencia', 'aseguradora'];
    const errors: ValidationErrors = {};
    
    requiredFields.forEach(field => {
      const error = validateField(field, (formData as any)[field]);
      if (error) errors[field] = error;
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        variant: 'destructive',
        title: 'Formulario incompleto',
        description: 'Por favor corrige los errores marcados',
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Actualizando siniestro:', formData);
      await siniestroService.updateSiniestro(siniestro.id, formData);

      toast({
        title: 'Siniestro actualizado',
        description: 'Los cambios se han guardado exitosamente',
      });

      navigate('/apps/seguros/siniestros');
    } catch (err: any) {
      console.error('❌ Error al actualizar:', err);
      
      const errorMessage = err.response?.data?.messages
        ? Object.values(err.response.data.messages).flat().join(', ')
        : err.response?.data?.message || err.response?.data?.error || 'Error al actualizar el siniestro';
      
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStateClick = (estado: string) => {
    setNewState(estado);
    setStateObservation('');
    setShowStateModal(true);
  };

  const handleConfirmStateChange = async () => {
    if (!siniestro || !newState) return;

    try {
      setChangingState(true);
      await siniestroService.changeState(siniestro.id, newState, stateObservation);
      
      toast({
        title: 'Estado actualizado',
        description: `El estado cambió a "${ESTADOS_CONFIG[newState as keyof typeof ESTADOS_CONFIG]?.label || newState}"`,
      });
      
      setShowStateModal(false);
      await loadSiniestro(); // Recargar datos
    } catch (err: any) {
      console.error('Error al cambiar estado:', err);
      toast({
        variant: 'destructive',
        title: 'Error al cambiar estado',
        description: err.response?.data?.message || 'Error al cambiar el estado',
      });
    } finally {
      setChangingState(false);
    }
  };

  // Funciones para manejo de archivos
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !siniestro?.id) return;

    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    try {
      setUploadingFiles(true);
      await siniestroDocumentsService.subirDocumento(
        siniestro.id.toString(),
        fileArray,
        undefined,
        (progress) => {
          // Opcional: mostrar progreso de subida
        }
      );
      await loadDocuments();
      toast({
        title: 'Documentos subidos',
        description: `Se subieron ${fileArray.length} archivo(s) correctamente`,
      });
    } catch (err) {
      // Error ya manejado en el servicio
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteDocument = async (document: any) => {
    if (!siniestro?.id) return;

    if (!window.confirm('¿Está seguro que desea eliminar este documento?')) {
      return;
    }

    try {
      await siniestroDocumentsService.eliminarDocumento(
        siniestro.id.toString(),
        { path: document.path, name: document.name }
      );
      await loadDocuments();
      toast({
        title: 'Documento eliminado',
        description: 'El documento se eliminó correctamente',
      });
    } catch (err) {
      // Error ya manejado en el servicio
    }
  };

  const handleViewDocument = async (document: any) => {
    if (!siniestro?.id) return;

    try {
      const url = await siniestroDocumentsService.getSignedUrl(
        siniestro.id.toString(),
        { path: document.path, name: document.name }
      );
      window.open(url, '_blank');
    } catch (err) {
      // Error ya manejado en el servicio
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);

  if (loadingSiniestro) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="mt-4 text-gray-600">Cargando siniestro...</p>
        </div>
      </div>
    );
  }

  if (!siniestro) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={() => navigate('/apps/seguros/siniestros')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar Siniestro</h1>
            <p className="text-gray-600">El siniestro solicitado no existe</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-500 mx-auto mb-4" width={64} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Siniestro no encontrado</h3>
          <p className="text-gray-600 mb-4">El siniestro que intentas editar no existe.</p>
          <Button onClick={() => navigate('/apps/seguros/siniestros')} color="blue">
            Volver a Siniestros
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" onClick={() => navigate('/apps/seguros/siniestros')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Siniestro</h1>
          <p className="text-gray-600">Modifica la información del siniestro {siniestro.numero_siniestro}</p>
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

      {/* Header con información del siniestro */}
      <CardBox className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {siniestro.numero_siniestro}
            </h2>
            <p className="text-gray-600">
              Cliente: {siniestro.cliente ? `${siniestro.cliente.first_name || ''} ${siniestro.cliente.last_name || ''}`.trim() || `Cliente ID: ${siniestro.cliente_id}` : `Cliente ID: ${siniestro.cliente_id}`} | Póliza: {siniestro.numero_poliza}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-medium text-gray-500">Estado actual:</span>
              <div className="flex items-center gap-1">
                <Icon
                  icon={ESTADOS_CONFIG[siniestro.estado as keyof typeof ESTADOS_CONFIG]?.icon || 'solar:file-text-bold'}
                  height={16}
                  className="text-gray-600"
                />
                <span className="text-sm font-medium text-gray-600">
                  {ESTADOS_CONFIG[siniestro.estado as keyof typeof ESTADOS_CONFIG]?.label || siniestro.estado}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleChangeStateClick(siniestro.estado)}
              disabled={loading}
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
              Cambiar Estado
            </Button>
          </div>
        </div>
      </CardBox>

      <div className="space-y-6">
        {/* Stepper */}
        <ShCard className="mb-4">
          <CardContent>
            <Stepper currentStep={currentStep} steps={steps} onStepClick={(i) => setCurrentStep(i)} />
          </CardContent>
        </ShCard>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-3 space-y-6">
            {/* PASO 0: Información General */}
            {currentStep === 0 && (
              <div className="space-y-6">
                {/* CAMPOS OBLIGATORIOS */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:asterisk-bold" className="w-4 h-4 text-red-500" />
                      Información Obligatoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Número de Siniestro */}
                      <div>
                        <Label htmlFor="numero_siniestro">Número de Siniestro</Label>
                        <Input
                          id="numero_siniestro"
                          name="numero_siniestro"
                          value={formData.numero_siniestro}
                          onChange={handleInputChange}
                          placeholder="Número interno del siniestro"
                          className="mt-1"
                          disabled
                        />
                      </div>

                      {/* Tipo de Seguro - OBLIGATORIO */}
                      <div>
                        <Label htmlFor="tipo_seguro" className="flex items-center gap-1">
                          Tipo de Seguro
                          <span className="text-red-500">*</span>
                        </Label>
                        <ShSelect value={formData.tipo_seguro} onValueChange={(v) => handleInputChange({ target: { name: 'tipo_seguro', value: v } } as any)}>
                          <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar tipo de seguro" /></ShSelectTrigger>
                          <ShSelectContent>
                            {Object.entries(TIPOS_SEGURO).map(([key, label]) => (
                              <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                            ))}
                          </ShSelectContent>
                        </ShSelect>
                        {validationErrors.tipo_seguro && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.tipo_seguro}</p>
                        )}
                      </div>

                      {/* Tipo de Siniestro - OBLIGATORIO */}
                      <div>
                        <Label htmlFor="tipo_siniestro" className="flex items-center gap-1">
                          Tipo de Siniestro
                          <span className="text-red-500">*</span>
                        </Label>
                        <ShSelect value={formData.tipo_siniestro} onValueChange={(v) => handleInputChange({ target: { name: 'tipo_siniestro', value: v } } as any)}>
                          <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar tipo de siniestro" /></ShSelectTrigger>
                          <ShSelectContent>
                            {Object.entries(TIPOS_SINIESTRO).map(([key, label]) => (
                              <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                            ))}
                          </ShSelectContent>
                        </ShSelect>
                        {validationErrors.tipo_siniestro && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.tipo_siniestro}</p>
                        )}
                      </div>

                      {/* Fecha de Ocurrencia - OBLIGATORIO */}
                      <div>
                        <Label htmlFor="fecha_ocurrencia" className="flex items-center gap-1">
                          Fecha del Siniestro
                          <span className="text-red-500">*</span>
                        </Label>
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
                          <p className="mt-1 text-sm text-red-600">{validationErrors.fecha_ocurrencia}</p>
                        )}
                      </div>

                      {/* Monto Reclamado - OBLIGATORIO */}
                      <div>
                        <Label htmlFor="monto_reclamo" className="flex items-center gap-1">
                          Monto Reclamado
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="monto_reclamo"
                          name="monto_reclamo"
                          type="number"
                          value={formData.monto_reclamo}
                          onChange={handleInputChange}
                          placeholder="0"
                          required
                          className={`mt-1 ${validationErrors.monto_reclamo ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.monto_reclamo && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.monto_reclamo}</p>
                        )}
                      </div>

                      {/* Aseguradora - OBLIGATORIO */}
                      <div>
                        <Label htmlFor="aseguradora" className="flex items-center gap-1">
                          Aseguradora
                          <span className="text-red-500">*</span>
                        </Label>
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
                          <p className="mt-1 text-sm text-red-600">{validationErrors.aseguradora}</p>
                        )}
                      </div>

                      {/* Descripción - OBLIGATORIO */}
                      <div className="md:col-span-3">
                        <Label htmlFor="descripcion_hechos" className="flex items-center gap-1">
                          Descripción de los Hechos
                          <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="descripcion_hechos"
                          name="descripcion_hechos"
                          value={formData.descripcion_hechos}
                          onChange={handleInputChange}
                          placeholder="Descripción detallada de lo ocurrido (mínimo 10 caracteres)"
                          rows={4}
                          required
                          className={`mt-1 ${validationErrors.descripcion_hechos ? 'border-red-500' : ''}`}
                        />
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-gray-500">Mínimo 10 caracteres</p>
                          <p className="text-xs text-gray-500">{(formData.descripcion_hechos || '').length}/2000</p>
                        </div>
                        {validationErrors.descripcion_hechos && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.descripcion_hechos}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* CAMPOS OPCIONALES */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-500" />
                      Información Adicional (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Número Siniestro Compañía */}
                      <div>
                        <Label htmlFor="numero_siniestro_compania">Número Siniestro Aseguradora</Label>
                        <Input
                          id="numero_siniestro_compania"
                          name="numero_siniestro_compania"
                          value={formData.numero_siniestro_compania}
                          onChange={handleInputChange}
                          placeholder="Ej: SIN-2024-001234"
                          className="mt-1"
                        />
                      </div>

                      {/* Prioridad */}
                      <div>
                        <Label htmlFor="prioridad">Prioridad</Label>
                        <ShSelect value={formData.prioridad} onValueChange={(v) => handleInputChange({ target: { name: 'prioridad', value: v } } as any)}>
                          <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar prioridad" /></ShSelectTrigger>
                          <ShSelectContent>
                            {Object.entries(PRIORIDADES).map(([key, label]) => (
                              <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                            ))}
                          </ShSelectContent>
                        </ShSelect>
                      </div>

                      {/* Proveedor Asignado */}
                      <div>
                        <Label htmlFor="proveedor_asignado">Proveedor Asignado</Label>
                        <Input
                          id="proveedor_asignado"
                          name="proveedor_asignado"
                          value={formData.proveedor_asignado}
                          onChange={handleInputChange}
                          placeholder="Nombre del proveedor o taller"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* PASO 1: Ubicación del Siniestro */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* CAMPOS OBLIGATORIOS */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:asterisk-bold" className="w-4 h-4 text-red-500" />
                      Ubicación del Siniestro (Obligatorio)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="lugar_ocurrencia" className="flex items-center gap-1">
                          Lugar de Ocurrencia
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="lugar_ocurrencia"
                          name="lugar_ocurrencia"
                          value={formData.lugar_ocurrencia}
                          onChange={handleInputChange}
                          placeholder="Dirección exacta del siniestro"
                          required
                          className={`mt-1 ${validationErrors.lugar_ocurrencia ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.lugar_ocurrencia && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.lugar_ocurrencia}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="ciudad_ocurrencia" className="flex items-center gap-1">
                          Ciudad
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="ciudad_ocurrencia"
                          name="ciudad_ocurrencia"
                          value={formData.ciudad_ocurrencia}
                          onChange={handleInputChange}
                          placeholder="Ciudad del siniestro"
                          required
                          className={`mt-1 ${validationErrors.ciudad_ocurrencia ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.ciudad_ocurrencia && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.ciudad_ocurrencia}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="departamento_ocurrencia" className="flex items-center gap-1">
                          Departamento
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="departamento_ocurrencia"
                          name="departamento_ocurrencia"
                          value={formData.departamento_ocurrencia}
                          onChange={handleInputChange}
                          placeholder="Departamento del siniestro"
                          required
                          className={`mt-1 ${validationErrors.departamento_ocurrencia ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.departamento_ocurrencia && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.departamento_ocurrencia}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* CAMPOS OPCIONALES */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:clock-circle-bold" className="w-4 h-4 text-blue-500" />
                      Fechas Adicionales (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="fecha_aviso">Fecha de Aviso</Label>
                        <Input
                          id="fecha_aviso"
                          name="fecha_aviso"
                          type="date"
                          value={formData.fecha_aviso}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                        {validationErrors.fecha_aviso && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.fecha_aviso}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="fecha_notificacion_aseguradora">Fecha Notificación Aseguradora</Label>
                        <Input
                          id="fecha_notificacion_aseguradora"
                          name="fecha_notificacion_aseguradora"
                          type="date"
                          value={formData.fecha_notificacion_aseguradora}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                        {validationErrors.fecha_notificacion_aseguradora && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.fecha_notificacion_aseguradora}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="fecha_reporte">Fecha de Reporte</Label>
                        <Input
                          id="fecha_reporte"
                          name="fecha_reporte"
                          type="date"
                          value={formData.fecha_reporte}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* INFORMACIÓN ADICIONAL */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-500" />
                      Información Adicional (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="numero_siniestro_compania">Número Siniestro Aseguradora</Label>
                        <Input
                          id="numero_siniestro_compania"
                          name="numero_siniestro_compania"
                          value={formData.numero_siniestro_compania}
                          onChange={handleInputChange}
                          placeholder="Ej: SIN-2024-001234"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="proveedor_asignado">Proveedor Asignado</Label>
                        <Input
                          id="proveedor_asignado"
                          name="proveedor_asignado"
                          value={formData.proveedor_asignado}
                          onChange={handleInputChange}
                          placeholder="Nombre del proveedor o taller"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* PASO 2: Montos y Financiero */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* CAMPOS OBLIGATORIOS */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:asterisk-bold" className="w-4 h-4 text-red-500" />
                      Información Financiera Obligatoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="monto_reclamo" className="flex items-center gap-1">
                          Monto Reclamado
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="monto_reclamo"
                          name="monto_reclamo"
                          type="number"
                          value={formData.monto_reclamo}
                          onChange={handleInputChange}
                          placeholder="0"
                          required
                          className={`mt-1 ${validationErrors.monto_reclamo ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.monto_reclamo && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.monto_reclamo}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* CAMPOS OPCIONALES */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:dollar-bold" className="w-4 h-4 text-green-500" />
                      Información Financiera Adicional (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="valor_indemnizacion">Valor Indemnización</Label>
                        <Input
                          id="valor_indemnizacion"
                          name="valor_indemnizacion"
                          type="number"
                          value={formData.valor_indemnizacion}
                          onChange={handleInputChange}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="deducible">Deducible</Label>
                        <Input
                          id="deducible"
                          name="deducible"
                          type="number"
                          value={formData.deducible}
                          onChange={handleInputChange}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="coaseguros">Coaseguros (%)</Label>
                        <Input
                          id="coaseguros"
                          name="coaseguros"
                          type="number"
                          value={formData.coaseguros}
                          onChange={handleInputChange}
                          placeholder="0"
                          min="0"
                          max="100"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="monto_aprobado">Monto Aprobado</Label>
                        <Input
                          id="monto_aprobado"
                          name="monto_aprobado"
                          type="number"
                          value={formData.monto_aprobado}
                          onChange={handleInputChange}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="monto_pagado">Monto Pagado</Label>
                        <Input
                          id="monto_pagado"
                          name="monto_pagado"
                          type="number"
                          value={formData.monto_pagado}
                          onChange={handleInputChange}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="monto_recuperado">Monto Recuperado</Label>
                        <Input
                          id="monto_recuperado"
                          name="monto_recuperado"
                          type="number"
                          value={formData.monto_recuperado}
                          onChange={handleInputChange}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* INFORMACIÓN DE PAGO */}
                <ShCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:card-bold" className="w-4 h-4 text-blue-500" />
                      Información de Pago (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="metodo_pago">Método de Pago</Label>
                        <ShSelect value={formData.metodo_pago || ''} onValueChange={(v) => handleInputChange({ target: { name: 'metodo_pago', value: v } } as any)}>
                          <ShSelectTrigger className="mt-1">
                            <ShSelectValue placeholder="Seleccionar método" />
                          </ShSelectTrigger>
                          <ShSelectContent>
                            <ShSelectItem value="transferencia">Transferencia</ShSelectItem>
                            <ShSelectItem value="cheque">Cheque</ShSelectItem>
                            <ShSelectItem value="efectivo">Efectivo</ShSelectItem>
                            <ShSelectItem value="otro">Otro</ShSelectItem>
                          </ShSelectContent>
                        </ShSelect>
                      </div>

                      <div>
                        <Label htmlFor="numero_cheque">Número de Cheque</Label>
                        <Input
                          id="numero_cheque"
                          name="numero_cheque"
                          value={formData.numero_cheque}
                          onChange={handleInputChange}
                          placeholder="Número del cheque"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="numero_transferencia">Número de Transferencia</Label>
                        <Input
                          id="numero_transferencia"
                          name="numero_transferencia"
                          value={formData.numero_transferencia}
                          onChange={handleInputChange}
                          placeholder="Número de referencia"
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Label htmlFor="cuenta_destino">Cuenta Destino</Label>
                        <Input
                          id="cuenta_destino"
                          name="cuenta_destino"
                          value={formData.cuenta_destino}
                          onChange={handleInputChange}
                          placeholder="Cuenta bancaria destino"
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Label htmlFor="beneficiario_pago">Beneficiario del Pago</Label>
                        <Input
                          id="beneficiario_pago"
                          name="beneficiario_pago"
                          value={formData.beneficiario_pago}
                          onChange={handleInputChange}
                          placeholder="Nombre del beneficiario"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* PASO 3: Fechas */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <ShCard>
                  <CardHeader>
                    <CardTitle>Fechas y Tiempos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="fecha_ocurrencia">Fecha del Siniestro *</Label>
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
                          <p className="mt-1 text-sm text-red-600">{validationErrors.fecha_ocurrencia}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="fecha_aviso">Fecha de Aviso</Label>
                        <Input
                          id="fecha_aviso"
                          name="fecha_aviso"
                          type="date"
                          value={formData.fecha_aviso}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="fecha_notificacion_aseguradora">Fecha Notificación Aseguradora</Label>
                        <Input
                          id="fecha_notificacion_aseguradora"
                          name="fecha_notificacion_aseguradora"
                          type="date"
                          value={formData.fecha_notificacion_aseguradora}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* PASO 4: Evaluación y Documentos */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <ShCard>
                  <CardHeader>
                    <CardTitle>Evaluación e Informes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="evaluacion_inicial">Evaluación Inicial</Label>
                        <Textarea
                          id="evaluacion_inicial"
                          name="evaluacion_inicial"
                          value={formData.evaluacion_inicial}
                          onChange={handleInputChange}
                          placeholder="Evaluación inicial del siniestro"
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="informe_investigacion">Informe de Investigación</Label>
                        <Textarea
                          id="informe_investigacion"
                          name="informe_investigacion"
                          value={formData.informe_investigacion}
                          onChange={handleInputChange}
                          placeholder="Resultados de la investigación"
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="informe_peritaje">Informe de Peritaje</Label>
                        <Textarea
                          id="informe_peritaje"
                          name="informe_peritaje"
                          value={formData.informe_peritaje}
                          onChange={handleInputChange}
                          placeholder="Informe del perito"
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="dictamen_final">Dictamen Final</Label>
                        <Textarea
                          id="dictamen_final"
                          name="dictamen_final"
                          value={formData.dictamen_final}
                          onChange={handleInputChange}
                          placeholder="Dictamen final del siniestro"
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>

                {/* Documentos en el mismo paso */}
                <ShCard>
                  <CardHeader>
                    <CardTitle>Documentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Subida de archivos */}
                      <div>
                        <Label htmlFor="file-upload-docs">Subir Documentos</Label>
                        <div
                          className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors"
                          onDrop={(e) => {
                            e.preventDefault();
                            const files = e.dataTransfer.files;
                            if (files) {
                              handleFileUpload(files);
                            }
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDragEnter={(e) => e.preventDefault()}
                        >
                          <div className="space-y-1 text-center">
                            <Icon icon="solar:upload-bold" className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <label
                                htmlFor="file-upload-docs"
                                className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80"
                              >
                                <span>Subir archivos</span>
                                <input
                                  id="file-upload-docs"
                                  name="file-upload-docs"
                                  type="file"
                                  className="sr-only"
                                  multiple
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (files) {
                                      handleFileUpload(files);
                                    }
                                  }}
                                  disabled={uploadingFiles}
                                />
                              </label>
                              <p className="pl-1">o arrastra y suelta</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, DOCX, JPG, PNG, XLS, XLSX hasta 20MB
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Lista de documentos */}
                      {loadingDocuments ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                          <p className="text-sm text-gray-600 mt-2">Cargando documentos...</p>
                        </div>
                      ) : documents.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-medium">Documentos Subidos ({documents.length})</h4>
                          {documents.map((doc: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Icon icon="solar:document-bold" className="h-5 w-5 text-gray-400" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{doc.name || `Documento ${index + 1}`}</p>
                                  <p className="text-xs text-gray-500">
                                    {doc.size ? `${(doc.size / 1024 / 1024).toFixed(2)} MB` : 'Tamaño desconocido'} •
                                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-CO') : 'Fecha desconocida'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDocument(doc)}
                                >
                                  <Icon icon="solar:eye-bold" height={16} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteDocument(doc)}
                                >
                                  <Icon icon="solar:trash-bin-trash-bold" height={16} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Icon icon="solar:document-bold" className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
                          <p className="mt-1 text-sm text-gray-500">Sube documentos relacionados con el siniestro.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* PASO 5: Calidad y Cierre */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <ShCard>
                  <CardHeader>
                    <CardTitle>Calidad y Satisfacción</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="calificacion_servicio">Calificación del Servicio (1-5) - Opcional</Label>
                        <Input
                          id="calificacion_servicio"
                          name="calificacion_servicio"
                          type="number"
                          value={formData.calificacion_servicio || ''}
                          onChange={handleInputChange}
                          placeholder=""
                          min="1"
                          max="5"
                          className="mt-1"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="cliente_satisfecho">Cliente Satisfecho - Opcional</Label>
                        <ToggleSwitch
                          checked={formData.cliente_satisfecho || false}
                          onChange={(checked) => setFormData(prev => ({ ...prev, cliente_satisfecho: checked }))}
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="comentarios_cliente">Comentarios del Cliente - Opcional</Label>
                        <Textarea
                          id="comentarios_cliente"
                          name="comentarios_cliente"
                          value={formData.comentarios_cliente}
                          onChange={handleInputChange}
                          placeholder="Comentarios y observaciones del cliente"
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="resolucion">Resolución Final - Opcional</Label>
                        <Textarea
                          id="resolucion"
                          name="resolucion"
                          value={formData.resolucion}
                          onChange={handleInputChange}
                          placeholder="Resolución final del siniestro"
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </ShCard>
              </div>
            )}

            {/* Acciones */}
            <ShCard className="p-4">
              <div className="flex justify-between">
                {currentStep === 0 ? (
                  <div />
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} 
                    disabled={loading}
                  >
                    Anterior
                  </Button>
                )}
                {currentStep < 5 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                    disabled={loading}
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Siniestro'}
                  </Button>
                )}
              </div>
            </ShCard>
          </div>

          {/* Panel lateral derecho */}
          <div className="lg:col-span-1">
            <div className="lg:sticky top-4 space-y-4">
              <ShCard className="p-6">
                <CardHeader>
                  <CardTitle>Estado y Prioridad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="prioridad">Prioridad</Label>
                      <ShSelect value={formData.prioridad} onValueChange={(v) => handleInputChange({ target: { name: 'prioridad', value: v } } as any)}>
                        <ShSelectTrigger className="mt-1"><ShSelectValue placeholder="Seleccionar" /></ShSelectTrigger>
                        <ShSelectContent>
                          {Object.entries(PRIORIDADES).map(([key, label]) => (
                            <ShSelectItem key={key} value={key}>{label}</ShSelectItem>
                          ))}
                        </ShSelectContent>
                      </ShSelect>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="finalizado">Finalizado</Label>
                      <ToggleSwitch
                        checked={formData.finalizado}
                        onChange={(checked) => setFormData(prev => ({ ...prev, finalizado: checked }))}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="involucra_terceros">Involucra Terceros</Label>
                      <ToggleSwitch
                        checked={formData.involucra_terceros}
                        onChange={(checked) => setFormData(prev => ({ ...prev, involucra_terceros: checked }))}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="hay_heridos">Hay Heridos</Label>
                      <ToggleSwitch
                        checked={formData.hay_heridos}
                        onChange={(checked) => setFormData(prev => ({ ...prev, hay_heridos: checked }))}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="tiene_recuperacion">Tiene Recuperación</Label>
                      <ToggleSwitch
                        checked={formData.tiene_recuperacion}
                        onChange={(checked) => setFormData(prev => ({ ...prev, tiene_recuperacion: checked }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </ShCard>

              {/* Información del siniestro */}
              <ShCard className="p-6">
                <CardHeader>
                  <CardTitle>Información</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Estado:</span>
                      <p className="font-medium">{ESTADOS_CONFIG[siniestro?.estado as keyof typeof ESTADOS_CONFIG]?.label || siniestro?.estado}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Monto Reclamado:</span>
                      <p className="font-medium">{formatCurrency(formData.monto_reclamo)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Días de Trámite:</span>
                      <p className="font-medium">{siniestro?.dias_tramite || 0} días</p>
                    </div>
                  </div>
                </CardContent>
              </ShCard>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para cambio de estado */}
      <Modal show={showStateModal} onClose={() => setShowStateModal(false)}>
        <Modal.Header>Cambiar Estado del Siniestro</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new_state">Nuevo Estado</Label>
              <ShSelect value={newState} onValueChange={setNewState}>
                <ShSelectTrigger className="mt-1">
                  <ShSelectValue placeholder="Seleccionar nuevo estado" />
                </ShSelectTrigger>
                <ShSelectContent>
                  {ESTADOS_DISPONIBLES.filter(estado => estado !== siniestro?.estado).map((estado) => {
                    const config = ESTADOS_CONFIG[estado as keyof typeof ESTADOS_CONFIG];
                    return (
                      <ShSelectItem key={estado} value={estado}>
                        <div className="flex items-center gap-2">
                          <Icon icon={config?.icon || 'solar:file-text-bold'} height={16} />
                          <span>{config?.label || estado}</span>
                        </div>
                      </ShSelectItem>
                    );
                  })}
                </ShSelectContent>
              </ShSelect>
            </div>

            <div>
              <Label htmlFor="state_observation">Observación (Opcional)</Label>
              <Textarea
                id="state_observation"
                value={stateObservation}
                onChange={(e) => setStateObservation(e.target.value)}
                placeholder="Observaciones sobre el cambio de estado"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleConfirmStateChange}
            disabled={!newState || changingState}
          >
            {changingState ? 'Cambiando...' : 'Confirmar Cambio'}
          </Button>
          <Button variant="outline" onClick={() => setShowStateModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );

};

export default EditarSiniestro;

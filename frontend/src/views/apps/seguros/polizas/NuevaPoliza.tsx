import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Textarea,
  Button,
  Badge,
  Alert,
  Spinner,
  Progress,
  Modal
} from 'flowbite-react';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Icon } from '@iconify/react';
import { useDropzone } from 'react-dropzone';
// (Se reemplaza ClientSelector por un combobox inline)

import TitleCard from 'src/components/shared/TitleBorderCard';
import CardBox from 'src/components/shared/CardBox';
import FormField from 'src/components/shared/FormField';
import { testPdfJs } from 'src/utils/pdfSetup';
import { polizaService, type Poliza } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import usePolizaValidation, { type PolizaFormData } from 'src/hooks/usePolizaValidation';
import saasApi from 'src/services/saasApi';
import { useAseguradoras, useRamos, useSedes, useVendedores } from 'src/hooks/useAdminCrudApi';

// Usar el tipo del hook de validación
type FormData = PolizaFormData;

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
                onClick={() => onStepClick(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                  index <= currentStep
                    ? 'bg-primary text-white shadow-lg transform scale-110'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
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

const PdfPreview: React.FC<{
  file: File | null;
  processing: boolean;
  progress: number;
  confidence: any | null;
  onRemove: () => void
}> = ({ file, processing, progress, confidence, onRemove }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      
      // Limpiar URL cuando el componente se desmonte
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!file) return null;

  return (
    <div className="sticky top-4">
      <CardBox className="h-fit">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:document-text-bold" className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm">Vista Previa PDF</span>
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl && !processing && (
              <button
                onClick={() => setIsFullscreen(true)}
                className="text-gray-400 hover:text-primary transition-colors"
                title="Ver en pantalla completa"
              >
                <Icon icon="solar:maximize-bold" className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Icon icon="solar:file-bold" className="w-6 h-6 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Badge color="success" size="sm">
              PDF Válido
            </Badge>
          </div>

          {processing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Procesando con IA...
                </span>
              </div>
              <Progress progress={progress} color="blue" />
              <p className="text-xs text-gray-500 text-center">
                {progress}% completado
              </p>
            </div>
          )}

          <Alert color="info" className="text-xs">
            <div className="flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" className="w-3 h-3" />
              <span>
                Los campos se llenarán automáticamente
              </span>
            </div>
          </Alert>

          {/* Vista previa del PDF */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden">
            {processing ? (
              /* Skeleton Loading */
              <div className="h-96 bg-gray-50 dark:bg-gray-700 p-4 relative">
                <div className="animate-pulse space-y-3">
                  {/* Header del documento */}
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-6"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                  </div>
                  
                  {/* Líneas de contenido */}
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  </div>
                  
                  {/* Sección de tabla simulada */}
                  <div className="mt-6 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded"></div>
                    </div>
                  </div>
                  
                  {/* Más líneas de contenido */}
                  <div className="mt-6 space-y-2">
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  </div>
                  
                  {/* Footer del documento */}
                  <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="h-2 bg-gray-200 dark:bg-gray-500 rounded w-24"></div>
                  </div>
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent dark:from-gray-700/20 flex items-center justify-center">
                  <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-lg border">
                    <div className="flex items-center space-x-2">
                      <Spinner size="sm" />
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        Procesando documento...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Vista previa interactiva del PDF */
              <div className="h-96 bg-gray-50 dark:bg-gray-700 relative">
                {pdfUrl && (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title="Vista previa del PDF"
                  />
                )}
                
                {/* Overlay de éxito */}
                <div className="absolute top-2 right-2">
                  <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                    <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                    <span>Procesado</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controles adicionales */}
          {pdfUrl && !processing && (
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>PDF completamente interactivo</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="text-primary hover:text-primary-600 font-medium"
                >
                  Abrir en nueva pestaña
                </button>
              </div>
            </div>
          )}

          {/* Barra de confianza visual */}
          {confidence && !processing && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confianza de Extracción
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {confidence.overall.toFixed(0)}%
                </span>
              </div>
              
              {/* Barra de temperatura de confianza */}
              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-out ${
                    confidence.overall >= 90 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                    confidence.overall >= 80 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                    confidence.overall >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                    confidence.overall >= 50 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                    'bg-gradient-to-r from-red-400 to-red-600'
                  }`}
                  style={{ width: `${confidence.overall}%` }}
                />
                
                {/* Indicadores de temperatura */}
                <div className="absolute inset-0 flex justify-between items-center px-1">
                  <div className="w-0.5 h-2 bg-white/30 rounded-full"></div>
                  <div className="w-0.5 h-2 bg-white/30 rounded-full"></div>
                  <div className="w-0.5 h-2 bg-white/30 rounded-full"></div>
                  <div className="w-0.5 h-2 bg-white/30 rounded-full"></div>
                </div>
              </div>
              
              {/* Etiquetas de temperatura */}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Baja</span>
                <span>Media</span>
                <span>Alta</span>
                <span>Excelente</span>
              </div>
              
              {/* Nota explicativa */}
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {confidence.overall >= 90 ? (
                  <div className="flex items-center gap-1">
                    <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-green-500" />
                    <span>Extracción excelente. Los datos son muy confiables.</span>
                  </div>
                ) : confidence.overall >= 80 ? (
                  <div className="flex items-center gap-1">
                    <Icon icon="solar:info-circle-bold" className="w-3 h-3 text-blue-500" />
                    <span>Extracción buena. Revise los campos principales.</span>
                  </div>
                ) : confidence.overall >= 70 ? (
                  <div className="flex items-center gap-1">
                    <Icon icon="solar:danger-triangle-bold" className="w-3 h-3 text-yellow-500" />
                    <span>Extracción aceptable. Verifique los datos extraídos.</span>
                  </div>
                ) : confidence.overall >= 50 ? (
                  <div className="flex items-center gap-1">
                    <Icon icon="solar:shield-warning-bold" className="w-3 h-3 text-orange-500" />
                    <span>Extracción con advertencias. Revise cuidadosamente.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-red-500" />
                    <span>Baja confianza. Considere procesamiento manual.</span>
                  </div>
                )}
              </div>
              
              {/* Métricas detalladas */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Extracción:</span>
                  <span className="font-medium">{confidence.extraction.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Validación:</span>
                  <span className="font-medium">{confidence.validation.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consistencia:</span>
                  <span className="font-medium">{confidence.consistency.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Histórica:</span>
                  <span className="font-medium">{confidence.historical.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardBox>

      {/* Modal de pantalla completa usando estilo de plantilla */}
      <Modal show={isFullscreen} onClose={() => setIsFullscreen(false)} size="7xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:document-text-bold" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                {file.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="h-[80vh] bg-gray-100 dark:bg-gray-800">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Vista previa del PDF en pantalla completa"
              />
            )}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

interface NuevaPolizaProps {
  polizaToEdit?: Poliza;
  isEditMode?: boolean;
  onSaveSuccess?: () => void;
}

const NuevaPoliza: React.FC<NuevaPolizaProps> = ({ 
  polizaToEdit, 
  isEditMode = false, 
  onSaveSuccess 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    numeroPoliza: '',
    riesgo: '',
    valorRiesgoAsegurado: '',
    aseguradora: '',
    ramoPrincipal: '',
    subramo: '',
    tipoPoliza: 'nueva',
    nombresCliente: '',
    apellidosCliente: '',
    dniCliente: '',
    tipoDocumento: 'cc',
    telefonoCliente: '',
    celularCliente: '',
    fechaExpedicionDni: '',
    fechaNacimiento: '',
    domicilio: '',
    correoCliente: '',
    correosSecundarios: '',
    observacionesCliente: '',
    primaNeta: '',
    porcentajeIva: '19',
    iva: '',
    total: '',
    gastosAdicionales: '',
    gastosAdicionalesAplicaIva: false,
    porcentajeComision: '',
    comision: '',
    formaPago: '',
    periodicidadPago: '',
    medioPago: '',
    vendedor: '',
    observaciones: '',
    observacionesInternas: '',
    fechaExpedicion: '',
    fechaInicio: '',
    fechaFin: '',
    sede: '',
    // tracking cliente para validación cruzada
    // @ts-ignore
    cliente_id: undefined as any,
    // Extensiones por defecto
    renovable: false,
    motivo: '',
    fechaRecepcion: '',
    
    priAPre: '',
    participacion: '',
    coCorretaje: '',
    comisionAgencia: '',
    porcentajeRetencion: '',
    porcentajeReteiva: '',
    
    beneficiarioEnRemision: false,
    beneficiarioOnerosoNombre: '',
    beneficiarioOnerosoDocumento: '',
    // Pago
    banco: '',
    cuotas: '',
    numeroTarjeta: '',
    // Partes (Tomador / Asegurado)
    policy_holder_name: '',
    policy_holder_document: '',
    insured_name: '',
    insured_document: '',
    // Vehículos
    placas: [] as any
  });

  const [isLoading, setIsLoading] = useState(false);
  const [aseguradoras, setAseguradoras] = useState<{ id: string; nombre: string }[]>([]);
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [ramos, setRamos] = useState<{ id: string; nombre: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);
  

  // Hooks adelantados para validación y notificaciones (requeridos por el autocompletado de placas)
  const { toast } = useToast();
  const {
    errors,
    setErrors,
    validateStepAndSetErrors,
    clearError,
  } = usePolizaValidation();

  // Autocompletar de placas (buscar en BD y permitir crear si no existe)
  const [placaInput, setPlacaInput] = useState<string>('');
  const [placaSuggestions, setPlacaSuggestions] = useState<Array<{ id: number; placa: string; client_name?: string; poliza_id?: number }>>([]);
  const [placaLoading, setPlacaLoading] = useState<boolean>(false);
  const [placaError, setPlacaError] = useState<string>('');

  const normalizePlate = useCallback((s: string): string => {
    return (s || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  }, []);

  const addPlate = useCallback((raw: string) => {
    const value = normalizePlate(raw);
    if (!value) return;
    if (!/^[A-Z0-9-]{3,20}$/.test(value)) {
      setPlacaError('Formato inválido. Use letras/números, 3-20 caracteres.');
      return;
    }
    setFormData(prev => {
      const list = Array.isArray((prev as any).placas) ? ([...(prev as any).placas] as string[]) : [];
      if (!list.includes(value)) list.push(value);
      return { ...prev, placas: list } as any;
    });
    setPlacaInput('');
    setPlacaSuggestions([]);
    setPlacaError('');
    if ((errors as any)['placas']) clearError('placas');
  }, [clearError, errors]);

  const createAndAddPlate = useCallback(async (raw: string) => {
    const value = normalizePlate(raw);
    if (!value) return;
    try {
      const clientId = selectedClient?.id
        ? (typeof selectedClient.id === 'string' ? parseInt(selectedClient.id as any, 10) : Number(selectedClient.id))
        : undefined;
      await saasApi.createAutomovil({ placa: value, client_id: clientId as any });
      addPlate(value);
      toast({ title: 'Placa registrada', description: `${value} creada en Automóviles y agregada a la póliza` });
    } catch (e: any) {
      setPlacaError(e?.message || 'No se pudo crear la placa');
    }
  }, [addPlate, selectedClient, toast, normalizePlate]);

  // Buscar sugerencias de placas (debounce)
  useEffect(() => {
    const v = normalizePlate(placaInput);
    if (!v || v.length < 2) {
      setPlacaSuggestions([]);
      setPlacaLoading(false);
      return;
    }
    let aborted = false;
    setPlacaLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await saasApi.getAutomoviles({ search: v, per_page: 5 });
        const payload: any = res.data || {};
        const data = Array.isArray(payload) ? payload : (payload.data || []);
        if (!aborted) {
          setPlacaSuggestions(
            data.map((a: any) => ({
              id: Number(a.id || 0),
              placa: String(a.placa || ''),
              client_name: a.client_name,
              poliza_id: a.poliza_id,
            }))
          );
        }
      } finally {
        if (!aborted) setPlacaLoading(false);
      }
    }, 250);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [placaInput, normalizePlate]);

  const mapSaasClienteToFormulario = (c: any) => {
    if (!c) return null;
    const tipo = c.tipo;
    const persona = c.persona || {};
    const empresa = c.empresa || {};
    return {
      client_type: (tipo ? String(tipo).toLowerCase() : 'persona'),
      nombre: persona.nombres || c.nombre || '',
      apellidos: persona.apellidos || c.apellidos || '',
      cuit: empresa.nit || persona.documento || c.cuit || '',
      tipo_documento: persona.tipo_documento || (empresa.nit ? 'NIT' : 'CC'),
      fecha_nacimiento: persona.fecha_nacimiento || c.fecha_nacimiento || '',
      genero: ((persona.genero || c.genero || '') + '').toLowerCase(),
      domicilio_principal: c.direccion || c.domicilio_principal || '',
      celular_principal: c.celular || c.celular_principal || '',
      email_principal: c.email || c.email_principal || '',
      actividad: c.actividad || empresa.actividad_economica || '',
      ciudad: c.ciudad || '',
      sede: c.sede || '',
      estado: (c.estado || 'ACTIVO').toLowerCase(),
      observaciones: c.observaciones || '',
      razon_social: empresa.razon_social || '',
      representante_legal: empresa.representante_legal || '',
      representante_legal_tipo_documento: '',
      representante_legal_documento: empresa.documento_representante || '',
    };
  };
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [pdfConfidence, setPdfConfidence] = useState<any>(null);
  const [showImporter, setShowImporter] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Hook de validación declarado arriba para soportar autocompletado de placas

  const steps = [
    { title: 'Información General', description: 'Datos básicos' },
    { title: 'Cliente', description: 'Selecciona el cliente' },
    { title: 'Financiera y Pagos', description: 'Montos, impuestos y medios de pago' },
    { title: 'Fechas', description: 'Vigencia' },
    { title: 'Beneficiarios', description: 'Datos adicionales' },
  ];

  // Paso índice para "Fechas y Estado" (compatible si el número de pasos cambia)
  const FECHAS_STEP = steps.length >= 5 ? 3 : 2;

  // Probar PDF.js al cargar el componente
  useEffect(() => {
    testPdfJs().then(isWorking => {
      if (isWorking) {
      } else {
      }
    });
  }, []);

  // Buscar clientes por query (debounce)
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) {
        setClientResults([]);
        return;
      }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : (resp.data?.data || []);
        const normalized = arr.map((c: any) => {
          const tipo = c.tipo;
          const nombre = tipo === 'EMPRESA' ? (c.empresa?.razon_social || c.empresa?.nombre_comercial || 'Empresa') : `${c.persona?.nombres || c.nombre || ''} ${c.persona?.apellidos || c.apellidos || ''}`.trim();
          const documento = tipo === 'EMPRESA' ? c.empresa?.nit : c.persona?.documento || c.cuit;
          const celular = c.celular || c.celular_principal;
          const email = c.email || c.email_principal;
          return { id: String(c.id), nombre, documento, celular, email, raw: c };
        });
        setClientResults(normalized);
      } catch (e) {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [clientQuery]);

  // Cargar catálogos usando los mismos hooks del admin (mismo backend/middleware)
  const { aseguradoras: asegHook } = useAseguradoras();
  const { ramos: ramosHook } = useRamos();
  const { sedes: sedesHook } = useSedes();
  const { vendedores: vendedoresHook } = useVendedores();

  // Lista de bancos de Colombia (para select de Banco)
  const colombianBanks = [
    'Bancolombia',
    'Banco de Bogotá',
    'BBVA Colombia',
    'Davivienda',
    'Itaú Colombia',
    'Scotiabank Colpatria',
    'Banco de Occidente',
    'Banco Popular',
    'Banco AV Villas',
    'Banco Caja Social',
    'Banco Agrario',
    'Banco Falabella',
    'Banco Finandina',
    'Banco Pichincha',
    'Banco GNB Sudameris',
    'Banco W',
    'Banco Serfinanza',
    'Lulo Bank',
    'Nu (Nubank) Colombia',
    'Coopcentral',
    'Bancoomeva',
  ];

  useEffect(() => {
    setAseguradoras((asegHook || []).map((a: any) => ({ id: String(a.id), nombre: a.nombre || a.name })));
  }, [asegHook]);

  useEffect(() => {
    setRamos((ramosHook || []).map((r: any) => ({ id: String(r.id), nombre: r.nombre || r.name })));
  }, [ramosHook]);

  // Alinear select de ramos cuando estamos editando y ya hay valor cargado
  useEffect(() => {
    if (isEditMode && polizaToEdit && ramos.length > 0) {
      const src = (((polizaToEdit as any).ramo_nombre || polizaToEdit.ramo_principal) || '').toString().toLowerCase();
      if (src) {
        const match = ramos.find(r => r.nombre.toLowerCase() === src)
          || ramos.find(r => src.includes(r.nombre.toLowerCase()))
          || ramos.find(r => r.nombre.toLowerCase().includes(src));
        if (match) {
          setFormData(prev => ({ ...prev, ramoPrincipal: match.nombre }));
        }
      }
    }
  }, [isEditMode, polizaToEdit, ramos]);

  useEffect(() => {
    setSedes((sedesHook || []).map((s: any) => ({ id: String(s.id), nombre: s.nombre || s.name })));
  }, [sedesHook]);

  useEffect(() => {
    // Mapear vendedores (tabla vendedores) para selector
    setVendedores((vendedoresHook || []).map((u: any) => ({ id: String(u.id), nombre: u.nombres || u.nombre || u.name })));
  }, [vendedoresHook]);

  // Preseleccionar vendedor en modo edición: buscar por nombre de la póliza (seller_name → 'vendedor')
  useEffect(() => {
    if (isEditMode && polizaToEdit && vendedores.length > 0) {
      const nombreVendedor = (polizaToEdit as any).vendedor || '';
      if (nombreVendedor) {
        const match = vendedores.find(v => (v.nombre || '').toLowerCase().trim() === String(nombreVendedor).toLowerCase().trim());
        if (match) {
          setSelectedVendedorId(match.id);
        }
      }
    }
  }, [isEditMode, polizaToEdit, vendedores]);

  // Helpers de mapeo de estado entre UI (Paso 1) y backend
  const mapEstadoToUi = (estado?: string) => {
    const e = (estado || '').toUpperCase();
    if (e === 'ACTIVA' || e === 'SUSPENDIDA' || e === 'PENDIENTE' || e === 'VIGENTE') return 'vigente';
    if (e === 'VENCIDA') return 'vencida';
    if (e === 'CANCELADA') return 'cancelada';
    if (e === 'COTIZACION' || e === 'COTIZACIÓN') return 'cotizacion';
    if (e === 'DEVENGADA') return 'devengada';
    if (e === 'EXPEDICION' || e === 'EXPEDICIÓN') return 'expedicion';
    if (e === 'NO_RENOVADA') return 'no_renovada';
    return '';
  };

  const mapUiToEstado = (ui?: string) => {
    const u = (ui || '').toLowerCase();
    if (u === 'vigente') return 'ACTIVA';
    if (u === 'vencida') return 'VENCIDA';
    if (u === 'cancelada') return 'CANCELADA';
    if (u === 'cotizacion') return 'COTIZACION';
    if (u === 'devengada') return 'DEVENGADA';
    if (u === 'expedicion') return 'EXPEDICION';
    if (u === 'no_renovada') return 'NO_RENOVADA';
    return '';
  };

  // Cargar datos de la póliza en modo edición
  useEffect(() => {
    if (isEditMode && polizaToEdit) {
      setFormData({
        numeroPoliza: polizaToEdit.numero_poliza || '',
        riesgo: polizaToEdit.riesgo || '',
        valorRiesgoAsegurado: polizaToEdit.valor_riesgo_asegurado?.toString() || '',
        aseguradora: (polizaToEdit as any).aseguradora_nombre || polizaToEdit.aseguradora || '',
        ramoPrincipal: (polizaToEdit as any).ramo_nombre || polizaToEdit.ramo_principal || '',
        subramo: polizaToEdit.subramo || '',
        // Mostrar el estado real en el selector de "Estado Póliza" del paso 1
        tipoPoliza: mapEstadoToUi(polizaToEdit.estado),
        
        nombresCliente: polizaToEdit.nombres_cliente || '',
        apellidosCliente: polizaToEdit.apellidos_cliente || '',
        dniCliente: polizaToEdit.dni_cliente || '',
        tipoDocumento: polizaToEdit.tipo_documento || 'cc',
        telefonoCliente: polizaToEdit.telefono_cliente || '',
        celularCliente: polizaToEdit.celular_cliente || '',
        fechaExpedicionDni: polizaToEdit.fecha_expedicion_dni || '',
        fechaNacimiento: polizaToEdit.fecha_nacimiento || '',
        domicilio: polizaToEdit.domicilio || '',
        correoCliente: polizaToEdit.correo_cliente || '',
        correosSecundarios: polizaToEdit.correos_secundarios || '',
        observacionesCliente: polizaToEdit.observaciones_cliente || '',
        // @ts-ignore: tracking para validación de cliente
        cliente_id: (polizaToEdit as any).cliente_id ? String((polizaToEdit as any).cliente_id) : undefined,
        
        primaNeta: polizaToEdit.prima_neta?.toString() || '',
        porcentajeIva: polizaToEdit.porcentaje_iva?.toString() || '19',
        iva: polizaToEdit.iva?.toString() || '',
        total: polizaToEdit.total?.toString() || '',
        gastosAdicionales: (polizaToEdit as any).gastos_adicionales?.toString() || '',
        gastosAdicionalesAplicaIva: !!(polizaToEdit as any).gastos_adicionales_aplica_iva,
        porcentajeComision: polizaToEdit.porcentaje_comision?.toString() || '',
        comision: polizaToEdit.comision?.toString() || '',
        formaPago: polizaToEdit.forma_pago || '',
        periodicidadPago: polizaToEdit.periodicidad_pago || '',
        medioPago: polizaToEdit.medio_pago || '',
        
        vendedor: polizaToEdit.vendedor || '',
        observaciones: polizaToEdit.observaciones || '',
        observacionesInternas: polizaToEdit.observaciones_internas || '',
        fechaExpedicion: polizaToEdit.fecha_expedicion || '',
        fechaInicio: polizaToEdit.fecha_inicio || '',
        fechaFin: polizaToEdit.fecha_fin || '',
        // Eliminamos el campo estado duplicado en UI. La fuente será tipoPoliza.
        sede: polizaToEdit.sede || '',
        // Extensiones desde backend
        renovable: !!polizaToEdit.renovable,
        motivo: polizaToEdit.motivo || '',
        fechaRecepcion: polizaToEdit.fecha_recepcion || '',
        
        priAPre: polizaToEdit.pri_a_pre?.toString() || '',
        participacion: polizaToEdit.participacion?.toString() || '',
        coCorretaje: polizaToEdit.co_corretaje?.toString() || '',
        comisionAgencia: polizaToEdit.comision_agencia?.toString() || '',
        porcentajeRetencion: polizaToEdit.porcentaje_retencion?.toString() || '',
        porcentajeReteiva: polizaToEdit.porcentaje_reteiva?.toString() || '',
        
        beneficiarioEnRemision: !!polizaToEdit.beneficiario_en_remision,
        beneficiarioOnerosoNombre: polizaToEdit.beneficiario_oneroso_nombre || '',
        beneficiarioOnerosoDocumento: polizaToEdit.beneficiario_oneroso_documento || '',
        banco: (polizaToEdit as any).bank_name || '',
        cuotas: ((polizaToEdit as any).installments_count || '').toString(),
        numeroTarjeta: (polizaToEdit as any).card_last4 || '',
        // Campos adicionales por medio de pago
        agreement_term: (polizaToEdit as any).agreement_term || '',
        cheque_number: (polizaToEdit as any).cheque_number || '',
        debit_account_number: (polizaToEdit as any).debit_account_number || '',
        // Tomador / Asegurado
        policy_holder_name: polizaToEdit?.policy_holder_name ?? '',
        policy_holder_document: polizaToEdit?.policy_holder_document ?? '',
        insured_name: polizaToEdit?.insured_name ?? '',
        insured_document: polizaToEdit?.insured_document ?? '',
        // Placas
        placas: Array.isArray((polizaToEdit as any).placas) ? ([...(polizaToEdit as any).placas] as any) : []
      } as any);
      // Preseleccionar cliente en el buscador
      const nombreCliente = `${polizaToEdit.nombres_cliente || ''} ${polizaToEdit.apellidos_cliente || ''}`.trim();
      setSelectedClient({
        id: (polizaToEdit as any).cliente_id ? String((polizaToEdit as any).cliente_id) : undefined,
        nombre: nombreCliente || 'Cliente',
        documento: polizaToEdit.dni_cliente || '',
        celular: polizaToEdit.celular_cliente || '',
        email: polizaToEdit.correo_cliente || '',
        raw: null,
      });
      // Asegurar que se quite el error de cliente requerido
      clearError('cliente_id');
      // Preseleccionar vendedor si coincide por nombre
      if (polizaToEdit.vendedor) {
        const vend = vendedores.find(v => v.nombre === polizaToEdit.vendedor);
        if (vend) setSelectedVendedorId(vend.id);
      }
    }
  }, [isEditMode, polizaToEdit]);

  // Si la lista de vendedores llega después, intentar alinear selección en modo edición
  useEffect(() => {
    if (isEditMode && polizaToEdit && polizaToEdit.vendedor && !selectedVendedorId && vendedores.length > 0) {
      const vend = vendedores.find(v => v.nombre === polizaToEdit.vendedor);
      if (vend) setSelectedVendedorId(vend.id);
    }
  }, [isEditMode, polizaToEdit, vendedores, selectedVendedorId]);

  // Cálculos automáticos
  useEffect(() => {
    const primaNeta = parseFloat(formData.primaNeta) || 0;
    const porcentajeIva = parseFloat(formData.porcentajeIva) || 0;
    const porcentajeComision = parseFloat(formData.porcentajeComision) || 0;
    const gastosAdicionales = parseFloat(formData.gastosAdicionales) || 0;

    // Calcular IVA: sobre prima neta + gastos adicionales si aplica
    let baseIva = primaNeta;
    if (formData.gastosAdicionalesAplicaIva) {
      baseIva += gastosAdicionales;
    }
    const iva = Math.round((baseIva * porcentajeIva) / 100);
    const total = primaNeta + iva + gastosAdicionales;
    const comision = Math.round((primaNeta * porcentajeComision) / 100);

    setFormData(prev => ({
      ...prev,
      iva: iva.toString(),
      total: total.toString(),
      comision: comision.toString()
    }));
  }, [formData.primaNeta, formData.porcentajeIva, formData.porcentajeComision, formData.gastosAdicionales, formData.gastosAdicionalesAplicaIva]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar errores cuando el usuario comience a escribir
    if (errors[name as keyof FormData]) {
      clearError(name);
    }
  }, [errors, clearError]);

  // Formatear tarjeta en tiempo real: solo dígitos, máx 19 y agrupado en bloques de 4
  const formatCardNumberForDisplay = (input: string): string => {
    const digits = (input || '').replace(/\D/g, '').slice(0, 19);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleCardNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumberForDisplay(e.target.value);
    setFormData(prev => ({ ...prev, numeroTarjeta: formatted }));
    if (errors['numeroTarjeta']) clearError('numeroTarjeta');
  }, [errors, clearError]);

  const handleCuotasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = (e.target.value || '').replace(/\D/g, '');
    setFormData(prev => ({ ...prev, cuotas: digitsOnly }));
    if (errors['cuotas']) clearError('cuotas');
  }, [errors, clearError]);

  // Si existe cliente seleccionado, limpiar el error visual del input
  useEffect(() => {
    if (selectedClient?.id) {
      clearError('cliente_id');
    }
  }, [selectedClient, clearError]);

  // Máscaras simples para valores monetarios (COP)
  const formatCurrencyDisplay = (value: string): string => {
    if (!value) return '';
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) return '';
    const num = Number(digitsOnly);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('es-CO', {
      style: 'decimal',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleCurrencyChange = useCallback((name: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = (e.target.value || '').replace(/\D/g, '');
    setFormData(prev => ({ ...prev, [name]: digitsOnly } as any));
    if (errors[name as string]) clearError(name as string);
  }, [errors, clearError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si estamos en el primer paso, ir al siguiente
      if (currentStep < steps.length - 1) {
        nextStep();
      } else {
        // Si estamos en el último paso, enviar el formulario
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      }
    }
  }, [currentStep, steps.length]);

  const validateStep = (step: number): boolean => {
    return validateStepAndSetErrors(step, formData);
  };

  const nextStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Validaciones específicas por método de pago (Paso 3)
    if (currentStep === 2) {
      const stepPaymentErrors: any = {};
      const medio = formData.medioPago;
      const digits = (formData.numeroTarjeta || '').replace(/\D/g, '');
      if (medio === 'tarjeta_credito') {
        if (!formData.cuotas || parseInt(formData.cuotas, 10) < 1) {
          stepPaymentErrors.cuotas = '# de cuotas es requerido y debe ser ≥ 1';
        }
        if (!digits || digits.length < 4) {
          stepPaymentErrors.numeroTarjeta = 'Número de tarjeta debe tener al menos 4 dígitos';
        }
      }
      if (medio === 'convenio' && !(formData as any).agreement_term) {
        stepPaymentErrors.agreement_term = 'Selecciona el plazo del convenio';
      }
      if ((medio === 'cheque' || medio === 'cheque_al_dia') && !(formData as any).cheque_number) {
        stepPaymentErrors.cheque_number = '# de cheque es requerido';
      }
      if (medio === 'debito' && !(formData as any).debit_account_number) {
        stepPaymentErrors.debit_account_number = 'Número de cuenta es requerido';
      }
      if (Object.keys(stepPaymentErrors).length > 0) {
        setErrors(stepPaymentErrors);
        return;
      }
    }

    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  // Funcionalidad de PDF
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      processPdf(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const processPdf = async (file: File) => {
    setPdfProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Importar el procesador avanzado
      const { processPdf } = await import('src/services/advancedPdfProcessor');
      
      // Simular progreso mientras se procesa
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 5, 85));
      }, 300);
      
      const result = await processPdf(file);
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      // Guardar métricas de confianza para mostrar en la barra
      setPdfConfidence(result.confidence);

      // Buscar coincidencias exactas en los catálogos cargados para que el valor del select exista
      const mapAseguradora = (aseguradora: string) => {
        if (!aseguradora) return '';
        const src = aseguradora.toLowerCase();
        const match = aseguradoras.find(a => a.nombre.toLowerCase() === src)
          || aseguradoras.find(a => src.includes(a.nombre.toLowerCase()))
          || aseguradoras.find(a => a.nombre.toLowerCase().includes(src));
        return match?.nombre || aseguradora;
      };

      const mapRamo = (ramo: string) => {
        if (!ramo) return '';
        const src = ramo.toLowerCase();
        const match = ramos.find(r => r.nombre.toLowerCase() === src)
          || ramos.find(r => src.includes(r.nombre.toLowerCase()))
          || ramos.find(r => r.nombre.toLowerCase().includes(src));
        return match?.nombre || ramo;
      };

      // Mapear los datos extraídos al formulario
      setFormData(prev => ({
        ...prev,
        // Información de la póliza
        numeroPoliza: result.numeroPoliza || prev.numeroPoliza,
        aseguradora: mapAseguradora(result.aseguradora) || prev.aseguradora,
        ramoPrincipal: mapRamo(result.ramo) || prev.ramoPrincipal,
        tipoPoliza: 'vigente', // Estado por defecto activo
        riesgo: result.riesgo || prev.riesgo,
        valorRiesgoAsegurado: result.valorAsegurado || prev.valorRiesgoAsegurado,
        
        // Información del cliente
        nombresCliente: result.clienteNombre || result.tomadorNombre || prev.nombresCliente,
        apellidosCliente: result.clienteApellido || prev.apellidosCliente,
        dniCliente: result.clienteCedula || result.tomadorDocumento || prev.dniCliente,
        celularCliente: result.clienteTelefono || prev.celularCliente,
        correoCliente: result.clienteEmail || prev.correoCliente,
        domicilio: result.clienteDireccion || prev.domicilio,
        
        // Información financiera
        primaNeta: result.primaNeta || prev.primaNeta,
        iva: result.iva || prev.iva,
        total: result.total || prev.total,
        
        // Fechas
        fechaExpedicion: result.fechaExpedicion || prev.fechaExpedicion,
        fechaInicio: result.fechaInicio || prev.fechaInicio,
        fechaFin: result.fechaFin || prev.fechaFin,
        
        // Placas de vehículos
        placas: result.placas && result.placas.length > 0 ? result.placas : prev.placas,
        
        // Tomador/Asegurado
        policy_holder_name: result.tomadorNombre || prev.policy_holder_name,
        policy_holder_document: result.tomadorDocumento || prev.policy_holder_document,
        insured_name: result.aseguradoNombre || prev.insured_name,
        insured_document: result.aseguradoDocumento || prev.insured_document,
      }));

      // Si se encontró un cliente automáticamente, seleccionarlo
      if (result.clienteEncontrado) {
        setSelectedClient({
          id: result.clienteEncontrado.id,
          nombre: result.clienteEncontrado.nombre,
          documento: result.clienteEncontrado.documento,
          celular: result.clienteEncontrado.telefono || '',
          email: result.clienteEncontrado.email || '',
          raw: null
        });
        
        // Actualizar el cliente_id en el formulario
        setFormData(prev => ({
          ...prev,
          // @ts-ignore
          cliente_id: result.clienteEncontrado?.id
        }));

        // Limpiar error de cliente requerido
        clearError('cliente_id');
      }

      // Mostrar mensaje de éxito basado en la nueva métrica de confianza
      const overallConfidence = result.confidence.overall;
      const extractedFields = Object.entries(result)
        .filter(([key, value]) =>
          key !== 'confidence' && key !== 'method' && key !== 'errors' && key !== 'metadata' &&
          value && value.toString().trim() !== '' &&
          (Array.isArray(value) ? value.length > 0 : true)
        )
        .map(([key]) => key);

      let description = `${overallConfidence.toFixed(0)}% confianza`;
      
      // Agregar información específica extraída
      const highlights = [];
      if (result.numeroPoliza) highlights.push('número de póliza');
      if (result.aseguradora) highlights.push('aseguradora');
      if (result.ramo) highlights.push('ramo');
      if (result.clienteEncontrado) highlights.push('cliente encontrado automáticamente');
      if (result.placas && result.placas.length > 0) highlights.push(`${result.placas.length} placa(s)`);
      if (result.riesgo) highlights.push('riesgo');
      
      if (highlights.length > 0) {
        description += `. Extraído: ${highlights.join(', ')}`;
      }

      if (overallConfidence >= 90) {
        toast({
          title: "🎯 Extracción exitosa",
          description,
        });
      } else if (overallConfidence >= 70) {
        toast({
          title: "✅ Extracción completada",
          description: `${description}. Revise los datos`,
          variant: "default"
        });
      } else {
        toast({
          title: "⚠️ Extracción con advertencias",
          description: `${description}. Revise cuidadosamente`,
          variant: "destructive"
        });
      }

      // Mensaje especial si se encontró cliente automáticamente
      if (result.clienteEncontrado) {
        setTimeout(() => {
          toast({
            title: "🔍 Cliente encontrado",
            description: `${result.clienteEncontrado?.nombre} (${result.clienteEncontrado?.documento}) seleccionado automáticamente`,
          });
        }, 1000);
      }
    } catch (error) {
    } finally {
      setPdfProcessing(false);
      setProcessingProgress(100);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfProcessing(false);
    setProcessingProgress(0);
    setPdfConfidence(null);
  };

  // useToast declarado arriba para soportar autocompletado de placas

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Solo procesar el submit si estamos en el último paso
    if (currentStep < steps.length - 1) {
      // Si no estamos en el último paso, actuar como "siguiente"
      nextStep();
      return;
    }
    
    if (validateStep(currentStep)) {
      setIsLoading(true);
      try {
        // Convertir FormData a formato de API
        const selectedAseg = aseguradoras.find(a => a.nombre === formData.aseguradora);
        const selectedRamo = ramos.find(r => r.nombre === formData.ramoPrincipal);
        const polizaData: any = {
          numero_poliza: isEditMode
            ? formData.numeroPoliza
            : formData.numeroPoliza.toUpperCase().replace(/\s+/g, '-'),
          riesgo: formData.riesgo || undefined,
          valor_riesgo_asegurado: formData.valorRiesgoAsegurado ? parseFloat(formData.valorRiesgoAsegurado) : undefined,
          // Preferir IDs normalizados si están disponibles, mantener nombres por retrocompatibilidad
          aseguradora_id: selectedAseg ? parseInt(selectedAseg.id) : undefined,
          ramo_id: selectedRamo ? parseInt(selectedRamo.id) : undefined,
          aseguradora: formData.aseguradora,
          ramo_principal: formData.ramoPrincipal,
          subramo: formData.subramo || undefined,
          tipo_poliza: formData.tipoPoliza || undefined,
          
          // Información financiera
          prima_neta: parseFloat(formData.primaNeta) || 0,
          porcentaje_iva: formData.porcentajeIva ? parseFloat(formData.porcentajeIva) : 19,
          iva: formData.iva ? parseFloat(formData.iva) : undefined,
          total: formData.total ? parseFloat(formData.total) : undefined,
          porcentaje_comision: formData.porcentajeComision ? parseFloat(formData.porcentajeComision) : undefined,
          comision: formData.comision ? parseFloat(formData.comision) : undefined,
          gastos_adicionales: formData.gastosAdicionales ? parseFloat(formData.gastosAdicionales) : undefined,
          gastos_adicionales_aplica_iva: !!formData.gastosAdicionalesAplicaIva,
          forma_pago: formData.formaPago || undefined,
          periodicidad_pago: formData.periodicidadPago || undefined,
          medio_pago: formData.medioPago || undefined,
          
          // Información administrativa
          vendedor_id: selectedVendedorId ? parseInt(selectedVendedorId) : undefined,
          observaciones: formData.observaciones || undefined,
          observaciones_internas: formData.observacionesInternas || undefined,
          fecha_expedicion: formData.fechaExpedicion,
          fecha_inicio: formData.fechaInicio,
          fecha_fin: formData.fechaFin,
          estado: mapUiToEstado(formData.tipoPoliza) || 'ACTIVA',
          sede: formData.sede || undefined,
          // Extensiones
          fecha_recepcion: formData.fechaRecepcion || undefined,
          renovable: !!formData.renovable,
          motivo: formData.motivo || undefined,
          
          pri_a_pre: formData.priAPre ? parseFloat(formData.priAPre) : undefined,
          participacion: formData.participacion ? parseFloat(formData.participacion) : undefined,
          co_corretaje: formData.coCorretaje ? parseFloat(formData.coCorretaje) : undefined,
          comision_agencia: formData.comisionAgencia ? parseFloat(formData.comisionAgencia) : undefined,
          porcentaje_retencion: formData.porcentajeRetencion ? parseFloat(formData.porcentajeRetencion) : undefined,
          porcentaje_reteiva: formData.porcentajeReteiva ? parseFloat(formData.porcentajeReteiva) : undefined,
          // Pago
          banco: formData.banco || undefined,
          cuotas: formData.cuotas ? parseInt(formData.cuotas) : undefined,
          // Solo enviar los últimos 4 dígitos de la tarjeta
          numero_tarjeta: formData.numeroTarjeta
            ? formData.numeroTarjeta.replace(/\D/g, '').slice(-4)
            : undefined,
          
          beneficiario_en_remision: !!formData.beneficiarioEnRemision,
          beneficiario_oneroso_nombre: (formData as any).beneficiarioOneroso ? (formData.beneficiarioOnerosoNombre || undefined) : undefined,
          beneficiario_oneroso_documento: (formData as any).beneficiarioOneroso ? (formData.beneficiarioOnerosoDocumento || undefined) : undefined,
          // Vehículos: enviar si el ramo es automotor (Automóvil o SOAT) y hay placas
          ...(((s => s.includes('auto') || s.includes('soat'))(String(formData.ramoPrincipal || '').toLowerCase())) && Array.isArray((formData as any).placas)
            ? { placas: (formData as any).placas }
            : {}),
        };

        // Validar fechas
        const fechaInicio = new Date(polizaData.fecha_inicio);
        const fechaFin = new Date(polizaData.fecha_fin);
        if (fechaFin <= fechaInicio) {
          toast({
            variant: "destructive",
            title: "Error de validación",
            description: "La fecha de fin debe ser posterior a la fecha de inicio",
          });
          return;
        }

        // Crear o actualizar la póliza
        let response;
        if (isEditMode && polizaToEdit?.id) {
          const payload = {
            ...polizaData,
            vendedor_id: selectedVendedorId ? parseInt(selectedVendedorId) : undefined,
            vendedor: selectedVendedorId ? (vendedores.find(v => v.id === selectedVendedorId)?.nombre || undefined) : undefined,
            // Enviar cliente_id si hay selección
            cliente_id: selectedClient?.id
              ? (typeof selectedClient.id === 'string' ? parseInt(selectedClient.id as any, 10) : (selectedClient.id as any))
              : undefined,
            policy_holder_name: (formData as any).policy_holder_name || undefined,
            policy_holder_document: (formData as any).policy_holder_document || undefined,
            insured_name: (formData as any).insured_name || undefined,
            insured_document: (formData as any).insured_document || undefined,
            agreement_term: (formData as any).agreement_term || undefined,
            cheque_number: (formData as any).cheque_number || undefined,
            debit_account_number: (formData as any).debit_account_number || undefined,
          } as any;
          response = await polizaService.updatePoliza(polizaToEdit.id, payload);
        } else {
          // Adjuntar vendedor si fue seleccionado
          const payload = {
            ...polizaData,
            vendedor_id: selectedVendedorId ? parseInt(selectedVendedorId) : undefined,
            vendedor: selectedVendedorId ? (vendedores.find(v => v.id === selectedVendedorId)?.nombre || undefined) : undefined,
            cliente_id: selectedClient?.id
              ? (typeof selectedClient.id === 'string' ? parseInt(selectedClient.id as any, 10) : (selectedClient.id as any))
              : undefined,
            policy_holder_name: (formData as any).policy_holder_name || undefined,
            policy_holder_document: (formData as any).policy_holder_document || undefined,
            insured_name: (formData as any).insured_name || undefined,
            insured_document: (formData as any).insured_document || undefined,
            agreement_term: (formData as any).agreement_term || undefined,
            cheque_number: (formData as any).cheque_number || undefined,
            debit_account_number: (formData as any).debit_account_number || undefined,
          } as any;
          response = await polizaService.createPoliza(payload);
        }
        
        if (response.success) {
          if (isEditMode && onSaveSuccess) {
            // Si está en modo edición, llamar callback
            onSaveSuccess();
          } else {
            // Si es creación, redirigir a listado de pólizas
            window.location.href = '/apps/seguros/polizas';
            // Además, limpiar formulario por si se queda en página
            setFormData({
              numeroPoliza: '',
              riesgo: '',
              valorRiesgoAsegurado: '',
              aseguradora: '',
              ramoPrincipal: '',
              subramo: '',
              tipoPoliza: 'nueva',
              nombresCliente: '',
              apellidosCliente: '',
              dniCliente: '',
              tipoDocumento: 'CC',
              telefonoCliente: '',
              celularCliente: '',
              fechaExpedicionDni: '',
              fechaNacimiento: '',
              domicilio: '',
              correoCliente: '',
              correosSecundarios: '',
              observacionesCliente: '',
              primaNeta: '',
              porcentajeIva: '19',
              iva: '',
              total: '',
              gastosAdicionales: '',
              gastosAdicionalesAplicaIva: false,
              porcentajeComision: '',
              comision: '',
              formaPago: '',
              periodicidadPago: '',
              medioPago: '',
              vendedor: '',
              observaciones: '',
              observacionesInternas: '',
              fechaExpedicion: '',
              fechaInicio: '',
              fechaFin: '',
              sede: '',
            });
            
            // Limpiar PDF
            removePdf();
            
            // Volver al primer paso
            setCurrentStep(0);
          }
        }
      } catch (error) {
        // Mostrar sugerencia amigable si es número duplicado
        if (error instanceof Error && /número de póliza ya existe/i.test(error.message)) {
          toast({
            variant: 'destructive',
            title: 'Número de póliza duplicado',
            description: 'Cambia el número o agrega un sufijo para continuar.'
          });
          return;
        }
        // El error ya se maneja en el servicio con toast
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      
      
      <div className={`grid gap-4 ${pdfFile ? 'lg:grid-cols-12' : 'grid-cols-1'} transition-all duration-300`}>
        {/* Columna principal del formulario */}
        <div className={pdfFile ? 'lg:col-span-8' : 'col-span-12'}>
          <CardBox className="mb-4">
            <Stepper 
              currentStep={currentStep} 
              steps={steps} 
              onStepClick={handleStepClick}
            />
          </CardBox>

          {/* Sección de Importación de PDF - Plegable */}
          {!pdfFile && (
            <CardBox className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Importación Automática</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Usa un PDF de póliza para llenar automáticamente los campos con IA</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button color="primary" size="sm" onClick={() => setShowImporter(prev => !prev)} className="flex items-center gap-2 rounded-[10px]">
                    <Icon icon="solar:cloud-upload-bold-duotone" className="w-4 h-4" />
                    {showImporter ? 'Ocultar importador' : 'Mostrar importador'}
                  </Button>
                </div>
              </div>
              {showImporter && (
                <div
                  {...getRootProps()}
                  className={`mt-3 border-2 border-dashed rounded-lg p-4 md:p-6 text-center cursor-pointer transition-all duration-300 ${
                    isDragActive 
                      ? 'border-primary bg-primary/5 scale-105' 
                      : 'border-gray-300 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Icon 
                    icon="solar:cloud-upload-bold-duotone" 
                    className="mx-auto mb-2 w-6 h-6 md:w-8 md:h-8 text-gray-400" 
                  />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un PDF aquí'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">o haz clic para seleccionar</p>
                </div>
              )}
            </CardBox>
          )}

          <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
            <div>
                {/* Paso 1: Información General y Cliente */}
                {currentStep === 0 && (
                  <div className="space-y-4">
        <TitleCard title="Información General de la Póliza" className="overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="col-span-full">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Producto</h4>
              <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
            </div>
            <FormField
              id="numeroPoliza"
              name="numeroPoliza"
              label="Número de Póliza"
              value={formData.numeroPoliza}
              onChange={handleInputChange}
              error={errors.numeroPoliza}
              required
              placeholder="POL-2024-XXX"
              helperText="Usa el número tal como aparece en la carátula de la póliza"
            />

            <FormField
              id="tipoPoliza"
              name="tipoPoliza"
              label="Estado Póliza"
              value={formData.tipoPoliza}
              onChange={handleInputChange}
              error={errors.tipoPoliza}
              required
              type="select"
              options={[
                { value: '', label: 'Seleccionar estado' },
                { value: 'vigente', label: 'Vigente' },
                { value: 'vencida', label: 'Vencida' },
                { value: 'cancelada', label: 'Cancelada' },
                { value: 'cotizacion', label: 'Cotización' },
                { value: 'devengada', label: 'Devengada' },
                { value: 'expedicion', label: 'Expedición' },
                { value: 'no_renovada', label: 'No renovada' },
              ]}
            />

            <div className="flex items-center gap-2 pt-6">
              <label className="text-sm mr-1">Es renovable</label>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, renovable: !prev.renovable }))}
                className={`group inline-flex h-6 w-11 items-center rounded-full transition duration-300 ${formData.renovable ? 'bg-primary' : 'bg-gray-300'}`}
                aria-pressed={!!formData.renovable}
              >
                <span className={`size-4 translate-x-1 rounded-full bg-white transition duration-300 ${formData.renovable ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <FormField
              id="aseguradora"
              name="aseguradora"
              label="Aseguradora"
              value={formData.aseguradora}
              onChange={handleInputChange}
              error={errors.aseguradora}
              required
              type="select"
              options={[{ value: '', label: 'Seleccionar aseguradora' }, ...aseguradoras.map((a) => ({ value: a.nombre, label: a.nombre }))]}
            />
            
            <FormField
              id="ramoPrincipal"
              name="ramoPrincipal"
              label="Ramo Principal"
              value={formData.ramoPrincipal}
              onChange={handleInputChange}
              error={errors.ramoPrincipal}
              required
              type="select"
              options={[{ value: '', label: 'Seleccionar ramo' }, ...ramos.map((r) => ({ value: r.nombre, label: r.nombre }))]}
            />
            
            <FormField
              id="subramo"
              name="subramo"
              label="Subramo"
              value={formData.subramo}
              onChange={handleInputChange}
              placeholder="Especificar subramo"
            />

            {/* Placas de vehículos (visible para ramo Automóvil o SOAT) */}
            {(s => s.includes('auto') || s.includes('soat'))(String(formData.ramoPrincipal || '').toLowerCase()) && (
              <div className="col-span-full z-[100]">
                <Label htmlFor="placa_input" className="text-sm font-medium text-gray-900 dark:text-white">Placas de vehículos</Label>
                <div className="mt-1 relative">
                  <div className="flex gap-2">
                    <Input
                      id="placa_input"
                      placeholder="ABC123"
                      value={placaInput}
                      onChange={(e: any) => {
                        setPlacaInput((e.target.value || '').toUpperCase());
                        if ((errors as any)['placas']) clearError('placas');
                      }}
                      onKeyDown={async (e: any) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = normalizePlate(placaInput);
                          if (!v) return;
                          const exists = placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v);
                          if (exists) {
                            addPlate(v);
                          } else {
                            await createAndAddPlate(v);
                          }
                        }
                      }}
                      className={`flex-1 ${(errors as any)['placas'] ? 'border-red-500' : ''}`}
                    />
                    <Button
                      type="button"
                      color="light"
                      onClick={async () => {
                        const v = normalizePlate(placaInput);
                        if (!v) return;
                        const exists = placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v);
                        if (exists) {
                          addPlate(v);
                        } else {
                          await createAndAddPlate(v);
                        }
                      }}
                    >
                      Agregar
                    </Button>
                  </div>

                  {/* Dropdown de sugerencias */}
                  {placaInput && (
                    <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-56 overflow-auto">
                      {placaLoading ? (
                        <div className="p-2 text-sm text-gray-500">Buscando placas...</div>
                      ) : (
                        <>
                          {placaSuggestions.length > 0 ? (
                            <>
                              {placaSuggestions.map((s) => (
                                <div
                                  key={`${s.id}-${s.placa}`}
                                  className="p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between"
                                  onClick={() => { addPlate(String(s.placa || '')); }}
                                >
                                  <span className="font-medium">{String(s.placa || '')}</span>
                                  <span className="text-xs text-gray-500">
                                    {s.client_name ? `Cliente: ${s.client_name}` : ''}{s.poliza_id ? ' • con póliza' : ''}
                                  </span>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div className="p-2 text-sm text-gray-500">Sin resultados</div>
                              <div
                                className="p-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer"
                                onClick={async () => { await createAndAddPlate(placaInput); }}
                              >
                                Crear placa "{normalizePlate(placaInput)}" y agregar
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Errores */}
                  {((errors as any)['placas'] || placaError) && (
                    <p className="text-red-500 text-xs mt-1">{(errors as any)['placas'] || placaError}</p>
                  )}
                </div>

                {/* Chips de placas agregadas */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.isArray((formData as any).placas) && (formData as any).placas.map((p: string, idx: number) => (
                    <span key={`${p}-${idx}`} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
                      {p}
                      <button
                        type="button"
                        className="text-gray-500 hover:text-red-600"
                        onClick={() => {
                          setFormData(prev => {
                            const list = (Array.isArray((prev as any).placas) ? ([...(prev as any).placas] as string[]) : []).filter(x => x !== p);
                            return { ...prev, placas: list } as any;
                          });
                        }}
                        aria-label={`Quitar placa ${p}`}
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
             <div className="col-span-full pt-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Riesgo</h4>
              <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
            </div>
            <FormField
              id="riesgo"
              name="riesgo"
              label="Riesgo Asegurado"
              value={formData.riesgo}
              onChange={handleInputChange}
              placeholder="Descripción del riesgo"
              className="md:col-span-2"
            />

            <div>
              <Label htmlFor="valorRiesgoAsegurado" className="text-sm font-medium text-gray-900 dark:text-white">Valor Riesgo Asegurado</Label>
              <Input
                id="valorRiesgoAsegurado"
                name="valorRiesgoAsegurado"
                value={formatCurrencyDisplay(formData.valorRiesgoAsegurado)}
                onChange={handleCurrencyChange('valorRiesgoAsegurado')}
                placeholder="$0"
                className={`mt-1 ${errors.valorRiesgoAsegurado ? 'border-red-500' : ''}`}
              />
              {errors.valorRiesgoAsegurado && (
                <p className="text-red-500 text-xs mt-1">{errors.valorRiesgoAsegurado}</p>
              )}
            </div>

            

            <FormField
                          id="sede"
                          name="sede"
                          label="Sede"
                          value={formData.sede}
                          onChange={handleInputChange}
                          type="select"
                          options={[{ value: '', label: 'Seleccionar sede' }, ...sedes.map((s) => ({ value: s.nombre, label: s.nombre }))]}
                        />
          </div>
        </TitleCard>
        {/* Cerrar Paso 0 aquí */}
        </div>
        )}

        {/** Paso 2: Cliente */}
        {currentStep === 1 && (
          <TitleCard title="Cliente" className="overflow-visible">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Combobox de clientes */}
            <div className="relative lg:col-span-2 z-[100]">
              <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">Buscar y seleccionar cliente <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre, documento, teléfono o email"
                  value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                  onChange={(e) => { setSelectedClient(null); setClientQuery(e.target.value); setFormData(prev => ({ ...prev, cliente_id: undefined as any })); }}
                  className={`flex-1 ${errors['cliente_id'] ? 'border-red-500' : ''}`}
                  required
                />
                <Button type="button" color="primary" onClick={() => { setClientModalMode('new'); setClienteToEdit(null); setShowClientModal(true); }}>
                  <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-1" /> Nuevo
                </Button>
                {selectedClient && (
                  <Button type="button" color="light" onClick={() => { 
                    setClientModalMode('edit'); 
                    const mapped = mapSaasClienteToFormulario(selectedClient.raw);
                    setClienteToEdit({ id: selectedClient.id, ...mapped } as any);
                    setShowClientModal(true); 
                  }}>
                    <Icon icon="solar:pen-bold" className="w-4 h-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
              {/* Mensaje required y dropdown */}
              {errors['cliente_id'] && (
                <p className="text-xs text-red-500 mt-1">{errors['cliente_id'] as any}</p>
              )}
              {(!selectedClient && (clientQuery.length >= 2 || clientLoading)) && (
                <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-auto">
                  {clientLoading ? (
                    <div className="p-3 text-sm text-gray-500">Buscando clientes...</div>
                  ) : clientResults.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Sin resultados</div>
                  ) : (
                    clientResults.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                          setSelectedClient(c);
                          setClientQuery('');
                          const raw = c.raw || {};
                          const persona = raw.persona || {};
                          setFormData((prev) => ({
                            ...prev,
                              // guardar id para validación
                              // @ts-ignore
                              cliente_id: c.id,
                            nombresCliente: persona.nombres || raw.nombre || prev.nombresCliente,
                            apellidosCliente: persona.apellidos || raw.apellidos || prev.apellidosCliente,
                            dniCliente: persona.documento || raw.empresa?.nit || raw.cuit || prev.dniCliente,
                            celularCliente: raw.celular || raw.celular_principal || prev.celularCliente,
                            correoCliente: raw.email || raw.email_principal || prev.correoCliente,
                            domicilio: raw.direccion || raw.domicilio_principal || prev.domicilio,
                          }));
                        }}
                      >
                        <div className="text-sm font-medium">{c.nombre}</div>
                        <div className="text-xs text-gray-500">{c.documento || ''} {c.celular ? `• ${c.celular}` : ''} {c.email ? `• ${c.email}` : ''}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Asignación vendedor/sede */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                id="vendedor_id"
                name="vendedor_id"
                label="Asesor/Vendedor"
                type="select"
                value={selectedVendedorId}
                onChange={(e) => setSelectedVendedorId((e.target as HTMLSelectElement).value)}
                options={[{ value: '', label: 'Sin asignar' }, ...vendedores.map((v) => ({ value: v.id, label: v.nombre }))]}
              />
              <FormField
                id="sede"
                name="sede"
                label="Sede"
                value={formData.sede}
                onChange={handleInputChange}
                type="select"
                options={[{ value: '', label: 'Seleccionar sede' }, ...sedes.map((s) => ({ value: s.nombre, label: s.nombre }))]}
              />
            </div>

            {/* Resumen de cliente seleccionado */}
            {selectedClient && (
              <div className="mt-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-800/40 text-sm">
                <div className="font-medium">Cliente seleccionado</div>
                <div>{selectedClient.nombre}</div>
                <div className="text-gray-500">{selectedClient.documento || '-'} {selectedClient.celular ? `• ${selectedClient.celular}` : ''} {selectedClient.email ? `• ${selectedClient.email}` : ''}</div>
              </div>
            )}
            
          </div>
        </TitleCard>
                )}

                {/* Paso 3: Información Financiera y Pagos */}
                {currentStep === 2 && (
          <div className="space-y-4">
        <TitleCard title="Información Financiera">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="col-span-full">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Montos</h4>
                          <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                        </div>
            <div>
              <Label htmlFor="primaNeta" className="text-sm font-medium text-gray-900 dark:text-white">Prima Neta <span className="text-red-500">*</span></Label>
              <Input
                id="primaNeta"
                name="primaNeta"
                value={formatCurrencyDisplay(formData.primaNeta)}
                onChange={handleCurrencyChange('primaNeta')}
                placeholder="0"
                className={`mt-1 ${errors.primaNeta ? 'border-red-500' : ''}`}
              />
              {errors.primaNeta && (
                <p className="text-red-500 text-xs mt-1">{errors.primaNeta}</p>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Valor en pesos colombianos (COP)</p>
            </div>
            
            <div>
                          <Label htmlFor="porcentajeIva" className="text-sm font-medium text-gray-900 dark:text-white">Porcentaje IVA %</Label>
                          <Input
                            id="porcentajeIva"
                name="porcentajeIva"
                type="number"
                value={formData.porcentajeIva}
                onChange={handleInputChange}
                placeholder="19"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="iva" className="text-sm font-medium text-gray-900 dark:text-white">IVA (Calculado)</Label>
                          <Input
                            id="iva"
                            name="iva"
                value={formatCurrencyDisplay(formData.iva)}
                            readOnly
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="gastosAdicionales" className="text-sm font-medium text-gray-900 dark:text-white">Gastos Adicionales</Label>
                          <Input
                            id="gastosAdicionales"
                            name="gastosAdicionales"
                            value={formatCurrencyDisplay(formData.gastosAdicionales)}
                            onChange={handleCurrencyChange('gastosAdicionales')}
                            placeholder="0"
                            className={`mt-1 ${errors.gastosAdicionales ? 'border-red-500' : ''}`}
                          />
                          {errors.gastosAdicionales && (
                            <p className="text-red-500 text-xs mt-1">{errors.gastosAdicionales}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Checkbox
                              id="gastosAdicionalesAplicaIva"
                              checked={!!formData.gastosAdicionalesAplicaIva}
                              onCheckedChange={(v) => setFormData(prev => ({...prev, gastosAdicionalesAplicaIva: !!v}))}
                            />
                            <Label htmlFor="gastosAdicionalesAplicaIva" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                              Aplicar IVA a gastos adicionales
                            </Label>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {formData.gastosAdicionalesAplicaIva
                              ? 'Los gastos adicionales se incluyen en el cálculo del IVA'
                              : 'Los gastos adicionales no se incluyen en el cálculo del IVA'}
                          </p>
                        </div>
            
                        <div>
                          <Label htmlFor="total" className="text-sm font-medium text-gray-900 dark:text-white">Total (Calculado)</Label>
                                       <Input
                             id="total"
                             name="total"
                             value={formatCurrencyDisplay(formData.total)}
                                         readOnly
                                         className="mt-1 font-semibold"
                           />
                         </div>
            
            <FormField
              id="formaPago"
              name="formaPago"
              label="Forma de Pago"
              value={formData.formaPago}
              onChange={handleInputChange}
              error={errors.formaPago}
              required
              type="select"
              options={[
                { value: '', label: 'Seleccionar forma de pago' },
                { value: 'contado', label: 'Contado' },
                { value: 'credito', label: 'Crédito' },
                { value: 'financiado', label: 'Financiado' },
              ]}
            />
            
            <FormField
              id="periodicidadPago"
              name="periodicidadPago"
              label="Periodicidad del Pago"
              value={formData.periodicidadPago}
              onChange={handleInputChange}
              type="select"
              options={[
                { value: '', label: 'Seleccionar periodicidad' },
                { value: 'anual', label: 'Anual' },
                { value: 'semestral', label: 'Semestral' },
                { value: 'trimestral', label: 'Trimestral' },
                { value: 'mensual', label: 'Mensual' },
              ]}
            />
            
            <div>
              <Label htmlFor="medioPago" className="text-sm font-medium text-gray-900 dark:text-white">Medio de Pago</Label>
              <select
                id="medioPago"
                name="medioPago"
                value={formData.medioPago}
                onChange={handleInputChange}
                className={`mt-1 block w-full border rounded-md p-2 bg-white dark:bg-gray-800 ${errors.medioPago ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.medioPago}
                aria-describedby={errors.medioPago ? 'medioPago-error' : undefined}
              >
                <option value="">Seleccionar medio</option>
                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                <option value="convenio">Convenio</option>
                <option value="cheque">Cheque</option>
                <option value="cheque_postfechado">Cheque post fechado</option>
                <option value="cheque_al_dia">Cheque al día</option>
                <option value="debito">Débito</option>
                <option value="consignacion">Consignación</option>
                <option value="pse">PSE</option>
                <option value="transferencia">Transferencia</option>
              </select>
              {errors.medioPago && (
                <p id="medioPago-error" className="text-red-500 text-xs mt-1">{errors.medioPago as any}</p>
              )}
              </div>
                        <div className="col-span-full pt-2">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Condiciones de pago</h4>
                          <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                        </div>
            {/* Datos de pago adicionales (dependen de medioPago) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full col-span-full">
              {formData.medioPago === 'tarjeta_credito' && (
                <>
                  <div>
                    <Label htmlFor="cuotas" className="text-sm font-medium text-gray-900 dark:text-white"># Cuotas</Label>
                    <Input id="cuotas" name="cuotas" value={formData.cuotas || ''} onChange={handleCuotasChange} placeholder="0" className={`mt-1 ${errors.cuotas ? 'border-red-500' : ''}`} />
                    {errors.cuotas && (<p className="text-red-500 text-xs mt-1">{errors.cuotas as any}</p>)}
                  </div>
                  <div>
                    <Label htmlFor="numeroTarjeta" className="text-sm font-medium text-gray-900 dark:text-white">Número de tarjeta</Label>
                    <Input id="numeroTarjeta" name="numeroTarjeta" value={formData.numeroTarjeta || ''} onChange={handleCardNumberChange} placeholder="Solo se guardarán los últimos 4" className={`mt-1 ${errors.numeroTarjeta ? 'border-red-500' : ''}`} />
                    {errors.numeroTarjeta && (<p className="text-red-500 text-xs mt-1">{errors.numeroTarjeta as any}</p>)}
                  </div>
                </>
              )}
              {formData.medioPago === 'convenio' && (
                <div>
                  <Label htmlFor="agreement_term" className="text-sm font-medium text-gray-900 dark:text-white">Convenio</Label>
                  <select id="agreement_term" name="agreement_term" value={(formData as any).agreement_term || ''} onChange={handleInputChange} className={`mt-1 block w-full border rounded-md p-2 bg-white dark:bg-gray-800 ${errors.agreement_term ? 'border-red-500' : ''}`}>
                    <option value="">Seleccionar</option>
                    <option value="contado">De contado</option>
                    <option value="30_45">30 a 45 días</option>
                    <option value="30_60">30 a 60 días</option>
                    <option value="60_90">60 a 90 días</option>
                  </select>
                  {errors.agreement_term && (<p className="text-red-500 text-xs mt-1">{errors.agreement_term as any}</p>)}
                </div>
              )}
              {formData.medioPago === 'cheque' && (
                <div>
                  <Label htmlFor="cheque_number" className="text-sm font-medium text-gray-900 dark:text-white"># de cheque</Label>
                  <Input id="cheque_number" name="cheque_number" value={(formData as any).cheque_number || ''} onChange={handleInputChange} placeholder="000000" className={`mt-1 ${errors.cheque_number ? 'border-red-500' : ''}`} />
                  {errors.cheque_number && (<p className="text-red-500 text-xs mt-1">{errors.cheque_number as any}</p>)}
                </div>
              )}
              {formData.medioPago === 'cheque_al_dia' && (
                <div>
                  <Label htmlFor="cheque_number_al_dia" className="text-sm font-medium text-gray-900 dark:text-white"># de cheque</Label>
                  <Input id="cheque_number_al_dia" name="cheque_number" value={(formData as any).cheque_number || ''} onChange={handleInputChange} placeholder="000000" className={`mt-1 ${errors.cheque_number ? 'border-red-500' : ''}`} />
                  {errors.cheque_number && (<p className="text-red-500 text-xs mt-1">{errors.cheque_number as any}</p>)}
                </div>
              )}
              {formData.medioPago === 'debito' && (
                <div>
                  <Label htmlFor="debit_account_number" className="text-sm font-medium text-gray-900 dark:text-white">Número de cuenta</Label>
                  <Input id="debit_account_number" name="debit_account_number" value={(formData as any).debit_account_number || ''} onChange={handleInputChange} placeholder="0000000000" className={`mt-1 ${errors.debit_account_number ? 'border-red-500' : ''}`} />
                  {errors.debit_account_number && (<p className="text-red-500 text-xs mt-1">{errors.debit_account_number as any}</p>)}
                </div>
              )}
            </div>
            {/* consignación, pse, transferencia -> solo selección, sin campos adicionales */}

            {/* Fila única: Banco / % Comisión / Comisión (Calculada) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full col-span-full">
              <FormField
                id="banco"
                name="banco"
                label="Banco"
                value={formData.banco || ''}
                onChange={handleInputChange}
                type="select"
                options={[{ value: '', label: 'Seleccionar banco' }, ...colombianBanks.map((b) => ({ value: b, label: b })), { value: 'otro', label: 'Otro' }]}
              />

              <div>
                <Label htmlFor="porcentajeComision" className="text-sm font-medium text-gray-900 dark:text-white">Porcentaje Comisión %</Label>
                <Input
                  id="porcentajeComision"
                  name="porcentajeComision"
                  type="number"
                  value={formData.porcentajeComision}
                  onChange={handleInputChange}
                  placeholder="15"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="comision" className="text-sm font-medium text-gray-900 dark:text-white">Comisión (Calculada)</Label>
                <Input
                  id="comision"
                  name="comision"
                  value={formatCurrencyDisplay(formData.comision)}
                  readOnly
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TitleCard>
        </div>
        )}

        {/* Paso 4: Fechas */}
        {currentStep === FECHAS_STEP && (
        <TitleCard title="Fechas">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="col-span-full">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Vigencia</h4>
                          <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
                        </div>
            <FormField
              id="fechaExpedicion"
              name="fechaExpedicion"
              label="Fecha Expedición"
              type="date"
              value={formData.fechaExpedicion}
              onChange={handleInputChange}
              error={errors.fechaExpedicion}
              required
            />
            
            <FormField
              id="fechaInicio"
              name="fechaInicio"
              label="Fecha Inicio"
              type="date"
              value={formData.fechaInicio}
              onChange={handleInputChange}
              error={errors.fechaInicio}
              required
            />
            
            <div>
                          <Label htmlFor="fechaFin" className="text-sm font-medium text-gray-900 dark:text-white">Fecha Fin *</Label>
                          <Input
                            id="fechaFin"
                name="fechaFin"
                type="date"
                value={formData.fechaFin}
                onChange={handleInputChange}
                            className={`mt-1 ${errors.fechaFin ? 'border-red-500' : ''}`}
              />
                          {errors.fechaFin && (
                            <p className="text-red-500 text-xs mt-1">{errors.fechaFin}</p>
                          )}
            </div>
            
            {/* Se elimina el selector de Estado en este paso para evitar duplicidad. */}
          </div>
          
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="col-span-full">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notas</h4>
                <div className="h-px bg-gray-200 dark:bg-gray-700 mt-1" />
              </div>
            <div>
                          <Label htmlFor="observaciones" className="text-sm font-medium text-gray-900 dark:text-white">Observaciones</Label>
              <Textarea
                id="observaciones"
                name="observaciones"
                value={formData.observaciones}
                onChange={handleInputChange}
                placeholder="Observaciones generales de la póliza"
                            rows={3}
                className="mt-1"
              />
            </div>
            
            <div>
                          <Label htmlFor="observacionesInternas" className="text-sm font-medium text-gray-900 dark:text-white">Observaciones Internas</Label>
              <Textarea
                id="observacionesInternas"
                name="observacionesInternas"
                value={formData.observacionesInternas}
                onChange={handleInputChange}
                placeholder="Observaciones internas (no visibles para el cliente)"
                            rows={3}
                className="mt-1"
              />
            </div>
          </div>
          </TitleCard>
        )}

        {/* Paso 5: Beneficiarios */}
        {currentStep === (steps.length - 1) && (
          <TitleCard title="Información de Tomador/Asegurado/Beneficiario">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tomador */}
              <FormField id="policy_holder_name" name="policy_holder_name" label="Nombre Tomador" value={(formData as any).policy_holder_name || ''} onChange={handleInputChange} />
              <FormField id="policy_holder_document" name="policy_holder_document" label="Documento del Tomador" value={(formData as any).policy_holder_document || ''} onChange={handleInputChange} />

              {/* Asegurado */}
              <FormField id="insured_name" name="insured_name" label="Nombre Asegurado" value={(formData as any).insured_name || ''} onChange={handleInputChange} />
              <FormField id="insured_document" name="insured_document" label="Documento del Asegurado" value={(formData as any).insured_document || ''} onChange={handleInputChange} />

              {/* Checks Beneficiarios */}
              <div className="col-span-full flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox id="beneficiarioEnRemision" checked={!!formData.beneficiarioEnRemision} onCheckedChange={(v)=> setFormData(prev=>({...prev, beneficiarioEnRemision: !!v}))} />
                  <span>¿Beneficiario en la Remisión?</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox id="beneficiarioOneroso" checked={(formData as any).beneficiarioOneroso || false} onCheckedChange={(v)=> setFormData(prev=>({...prev, beneficiarioOneroso: !!v}))} />
                  <span>Beneficiario oneroso</span>
                </label>
              </div>

              {/* Datos Beneficiario Oneroso */}
              <div className="col-span-full">
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3">Beneficiarios</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField id="beneficiarioOnerosoNombre" name="beneficiarioOnerosoNombre" label="Nombre" value={formData.beneficiarioOnerosoNombre || ''} onChange={handleInputChange} disabled={!((formData as any).beneficiarioOneroso)} />
                    <FormField id="beneficiarioOnerosoDocumento" name="beneficiarioOnerosoDocumento" label="Documento" value={formData.beneficiarioOnerosoDocumento || ''} onChange={handleInputChange} disabled={!((formData as any).beneficiarioOneroso)} />
                  </div>
                </div>
              </div>
            </div>
          </TitleCard>
        )}
            </div>

            {/* Botones de Navegación - Mejorados para tablets */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 order-2 sm:order-1">
                <Button
                  type="button"
                  color="light"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                >
                  <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
                  <span>Anterior</span>
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    color="primary"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                  >
                    <span>Siguiente</span>
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isLoading || !selectedClient?.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:diskette-bold" className="w-4 h-4" />
                        <span>{isEditMode ? 'Actualizar' : 'Crear'} Póliza</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de progreso */}
              <div className="flex items-center gap-2 text-sm text-gray-500 order-1 sm:order-2">
                <span>Paso {currentStep + 1} de {steps.length}</span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
      </form>
        </div>

        {/* Columna del PDF Preview - Solo visible en pantallas grandes */}
        {pdfFile && (
          <div className="hidden lg:block lg:col-span-4">
            <PdfPreview 
              file={pdfFile} 
              processing={pdfProcessing}
              progress={processingProgress}
              confidence={pdfConfidence}
              onRemove={removePdf}
            />
          </div>
        )}
      </div>
      {/* Modal para crear/editar cliente (contenido embebido, sin layout) */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)} size="7xl">
        <Modal.Header>{clientModalMode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Header>
        <Modal.Body>
          <div className="max-h-[80vh] overflow-auto p-1">
            <NuevoCliente
              isEditMode={clientModalMode === 'edit'}
              clienteToEdit={clientModalMode === 'edit' ? (clienteToEdit as any) : undefined}
              onSaveSuccess={(clienteActualizado?: any) => {
                setShowClientModal(false);
                // Si recibimos el cliente actualizado, actualizar selección y form
                if (clienteActualizado) {
                  const c = clienteActualizado;
                  const nombre = `${c?.nombre || ''} ${c?.apellidos || ''}`.trim() || c?.razon_social || 'Cliente';
                  setSelectedClient({
                    id: String(c.id),
                    nombre,

                    documento: c.cuit,
                    celular: c.celular_principal,
                    email: c.email_principal,
                    raw: c,
                  });
                  const persona = c || {};
                  setFormData((prev) => ({
                    ...prev,
                    // asegurar validación de paso 2
                    // @ts-ignore
                    cliente_id: String(c.id),
                    nombresCliente: persona.nombre || prev.nombresCliente,
                    apellidosCliente: persona.apellidos || prev.apellidosCliente,
                    dniCliente: persona.cuit || prev.dniCliente,
                    celularCliente: persona.celular_principal || prev.celularCliente,
                    correoCliente: persona.email_principal || prev.correoCliente,
                    domicilio: persona.direccion || prev.domicilio,
                    fechaNacimiento: persona.fecha_nacimiento || prev.fechaNacimiento,
                    // Normalizar género a UI (M/F/O o texto)
                    // Si llega 'M'/'F'/'O', mantener, si llega 'masculino'/'femenino'/'otro' convertir a minúsculas
                    genero: typeof persona.genero === 'string' ? persona.genero : prev as any,
                  }));
                }
                // Refrescar resultados si hay query activa
                if (clientQuery && clientQuery.length >= 2) {
                  setClientQuery(clientQuery + ' '); // disparar useEffect de búsqueda
                  setClientQuery((q) => q.trim());
                }
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default NuevaPoliza; 
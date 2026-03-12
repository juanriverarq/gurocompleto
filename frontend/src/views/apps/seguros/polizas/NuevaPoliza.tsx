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

import CardBox from 'src/components/shared/CardBox';
import FormField from 'src/components/shared/FormField';
import { testPdfJs } from 'src/utils/pdfSetup';
import { polizaService, type Poliza } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import usePolizaValidation, { type PolizaFormData } from 'src/hooks/usePolizaValidation';
import saasApi from 'src/services/saasApi';
import { useAseguradoras, useRamos, useSedes, useVendedores } from 'src/hooks/useAdminCrudApi';
import { useTerminologia } from 'src/context/TerminologiaContext';

// Usar el tipo del hook de validación
type FormData = PolizaFormData;

const SectionHeader: React.FC<{ title: string; icon?: string }> = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
    {icon && <Icon icon={icon} className="w-4 h-4 text-primary" />}
    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">{title}</h3>
  </div>
);

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
  onCategoryChange?: (category: string) => void;
}

const NuevaPoliza: React.FC<NuevaPolizaProps> = ({ 
  polizaToEdit, 
  isEditMode = false, 
  onSaveSuccess,
  onCategoryChange 
}) => {
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
    beneficiarios: [] as any,
    // Enlace externo
    enlaceExterno: '',
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
    placas: [] as any,
    // Campos SoftSeguros
    categoriaPoliza: 'individual',
    esColectiva: false,
    esSoat: false,
    esArl: false,
    clasificacionPoliza: '',
    periodicidad: '',
    // Comisiones detalladas
    ivaComision: '',
    porcentajeSobrecomision: '',
    sobrecomision: '',
    porcentajeComisionVendedor: '',
    comisionVendedor: '',
    // Financiación
    porcentajeFinanciacion: '',
    valorFinanciacion: '',
    totalPolizaFinanciada: '',
    // Cartera
    estadoCartera: '',
    // Impuestos adicionales
    porcentajeImpuestoBomberos: '',
    impuestoBomberos: '',
    // Moneda
    tipoMoneda: '',
    tasaCambio: '',
    // Coaseguro
    coinsuranceParticipation: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Beneficiarios dinámicos
  type Beneficiario = { nombre: string; documento: string; parentesco: string; porcentaje: string };
  const emptyBeneficiario = (): Beneficiario => ({ nombre: '', documento: '', parentesco: '', porcentaje: '' });
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([emptyBeneficiario()]);
  const [aseguradoras, setAseguradoras] = useState<{ id: string; nombre: string }[]>([]);
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [ramos, setRamos] = useState<{ id: string; nombre: string; subramo: string[]; comisiones_aseguradoras: { aseguradora_id: string; aseguradora_nombre?: string; porcentaje_iva: number; porcentaje_comision: number; pri_a_pre_por_defecto: number }[] }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const [selectedVendedorId2, setSelectedVendedorId2] = useState<string>('');
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);
  

  // Hooks adelantados para validación y notificaciones (requeridos por el autocompletado de placas)
  const { toast } = useToast();
  const { terminologia } = useTerminologia();
  const {
    errors,
    clearError,
  } = usePolizaValidation();

  // Estado para validación de póliza duplicada
  const [polizaError, setPolizaError] = useState<string | null>(null);
  const [checkingPoliza, setCheckingPoliza] = useState(false);
  const polizaCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Verificar póliza duplicada con debounce
  useEffect(() => {
    if (polizaCheckRef.current) {
      clearTimeout(polizaCheckRef.current);
    }
    
    const numeroPoliza = formData.numeroPoliza?.trim();
    if (!numeroPoliza || numeroPoliza.length < 3) {
      setPolizaError(null);
      return;
    }
    
    setCheckingPoliza(true);
    polizaCheckRef.current = setTimeout(async () => {
      try {
        const result = await polizaService.checkPolizaExists(
          numeroPoliza,
          isEditMode ? polizaToEdit?.id : undefined
        );
        if (result.exists && result.poliza) {
          setPolizaError(`Ya existe una póliza con este número: ${result.poliza.aseguradora || ''} - ${result.poliza.ramo_principal || ''}`);
        } else {
          setPolizaError(null);
        }
      } catch (e) {
        setPolizaError(null);
      } finally {
        setCheckingPoliza(false);
      }
    }, 500);
    
    return () => {
      if (polizaCheckRef.current) {
        clearTimeout(polizaCheckRef.current);
      }
    };
  }, [formData.numeroPoliza, isEditMode, polizaToEdit?.id]);

  // Verificar si todos los campos obligatorios están completos para habilitar el botón Guardar
  const canSavePoliza = useCallback((): boolean => {
    // Paso 1: Información de la póliza
    if (!formData.numeroPoliza?.trim() || formData.numeroPoliza.trim().length < 3) return false;
    if (!formData.aseguradora?.trim()) return false;
    if (!formData.ramoPrincipal?.trim()) return false;
    if (!formData.fechaInicio) return false;
    if (!formData.fechaFin) return false;
    
    // Paso 2: Cliente seleccionado
    if (!selectedClient?.id) return false;
    
    // Paso 3: Información financiera
    if (formData.primaNeta === undefined || formData.primaNeta === null || formData.primaNeta === '' || parseFloat(formData.primaNeta) < 0) return false;
    
    // No permitir guardar si hay error de póliza duplicada (solo en modo crear, no en editar)
    if (polizaError && !isEditMode) return false;
    
    return true;
  }, [formData, selectedClient, polizaError, isEditMode]);

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
    setRamos((ramosHook || []).map((r: any) => ({
      id: String(r.id),
      nombre: r.nombre || r.name,
      subramo: (() => {
        const raw = r.subramo;
        if (Array.isArray(raw)) return raw.filter((s: any) => typeof s === 'string' && s.trim());
        if (typeof raw === 'string' && raw.trim()) {
          try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.filter((s: any) => typeof s === 'string' && s.trim()); } catch {}
          return [raw.trim()];
        }
        return [];
      })(),
      comisiones_aseguradoras: (r.comisiones_aseguradoras || []).map((c: any) => ({
        aseguradora_id: String(c.aseguradora_id),
        aseguradora_nombre: c.aseguradora_nombre || c.aseguradora?.nombre || '',
        porcentaje_iva: c.porcentaje_iva ?? 0,
        porcentaje_comision: c.porcentaje_comision ?? 0,
        pri_a_pre_por_defecto: c.pri_a_pre_por_defecto ?? 0,
      })),
    })));
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
        
        primaNeta: polizaToEdit.prima_neta != null ? String(Math.round(Number(polizaToEdit.prima_neta))) : '',
        porcentajeIva: polizaToEdit.porcentaje_iva?.toString() || '19',
        iva: polizaToEdit.iva != null ? String(Math.round(Number(polizaToEdit.iva))) : '',
        total: polizaToEdit.total != null ? String(Math.round(Number(polizaToEdit.total))) : '',
        gastosAdicionales: (polizaToEdit as any).gastos_adicionales != null ? String(Math.round(Number((polizaToEdit as any).gastos_adicionales))) : '',
        gastosAdicionalesAplicaIva: !!(polizaToEdit as any).gastos_adicionales_aplica_iva,
        porcentajeComision: polizaToEdit.porcentaje_comision?.toString() || '',
        comision: polizaToEdit.comision != null ? String(Math.round(Number(polizaToEdit.comision))) : '',
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
        
        priAPre: polizaToEdit.pri_a_pre != null ? String(Math.round(Number(polizaToEdit.pri_a_pre))) : '',
        participacion: polizaToEdit.participacion?.toString() || '',
        coCorretaje: polizaToEdit.co_corretaje?.toString() || '',
        comisionAgencia: polizaToEdit.comision_agencia != null ? String(Math.round(Number(polizaToEdit.comision_agencia))) : '',
        porcentajeRetencion: polizaToEdit.porcentaje_retencion?.toString() || '',
        porcentajeReteiva: polizaToEdit.porcentaje_reteiva?.toString() || '',
        
        beneficiarioEnRemision: !!polizaToEdit.beneficiario_en_remision,
        beneficiarioOnerosoNombre: polizaToEdit.beneficiario_oneroso_nombre || '',
        beneficiarioOnerosoDocumento: polizaToEdit.beneficiario_oneroso_documento || '',
        beneficiarios: Array.isArray((polizaToEdit as any).beneficiarios) ? (polizaToEdit as any).beneficiarios : [],
        enlaceExterno: polizaToEdit.enlace_externo || '',
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
        placas: Array.isArray((polizaToEdit as any).placas) ? ([...(polizaToEdit as any).placas] as any) : [],
        // Campos SoftSeguros
        categoriaPoliza: (polizaToEdit as any).policy_category || ((polizaToEdit as any).colectiva ? 'colectiva' : 'individual'),
        esColectiva: !!(polizaToEdit as any).colectiva,
        esSoat: !!(polizaToEdit as any).soat,
        esArl: !!(polizaToEdit as any).arl,
        clasificacionPoliza: (polizaToEdit as any).clasificacion_poliza || '',
        periodicidad: (polizaToEdit as any).periodicidad || '',
        ivaComision: (polizaToEdit as any).iva_comision != null ? String(Math.round(Number((polizaToEdit as any).iva_comision))) : '',
        porcentajeSobrecomision: (polizaToEdit as any).porcentaje_sobrecomision?.toString() || '',
        sobrecomision: (polizaToEdit as any).sobrecomision != null ? String(Math.round(Number((polizaToEdit as any).sobrecomision))) : '',
        porcentajeComisionVendedor: (polizaToEdit as any).porcentaje_comision_vendedor?.toString() || '',
        comisionVendedor: (polizaToEdit as any).comision_vendedor != null ? String(Math.round(Number((polizaToEdit as any).comision_vendedor))) : '',
        porcentajeFinanciacion: (polizaToEdit as any).porcentaje_financiacion?.toString() || '',
        valorFinanciacion: (polizaToEdit as any).valor_financiacion != null ? String(Math.round(Number((polizaToEdit as any).valor_financiacion))) : '',
        totalPolizaFinanciada: (polizaToEdit as any).total_poliza_financiada != null ? String(Math.round(Number((polizaToEdit as any).total_poliza_financiada))) : '',
        estadoCartera: (polizaToEdit as any).estado_cartera || '',
        porcentajeImpuestoBomberos: (polizaToEdit as any).porcentaje_impuesto_bomberos?.toString() || '',
        impuestoBomberos: (polizaToEdit as any).impuesto_bomberos != null ? String(Math.round(Number((polizaToEdit as any).impuesto_bomberos))) : '',
        tipoMoneda: (polizaToEdit as any).tipo_moneda || '',
        tasaCambio: (polizaToEdit as any).tasa_cambio?.toString() || '',
        coinsuranceParticipation: (polizaToEdit as any).coinsurance_participation?.toString() || '',
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
      // Preseleccionar vendedor si coincide por nombre o id
      if (polizaToEdit.vendedor_id) {
        setSelectedVendedorId(String(polizaToEdit.vendedor_id));
      } else if (polizaToEdit.vendedor) {
        const vend = vendedores.find(v => v.nombre === polizaToEdit.vendedor);
        if (vend) setSelectedVendedorId(vend.id);
      }
      // Preseleccionar vendedor 2 si existe
      if (polizaToEdit.vendedor_id_2) {
        setSelectedVendedorId2(String(polizaToEdit.vendedor_id_2));
      }
      // Cargar beneficiarios array
      const bens = (polizaToEdit as any).beneficiarios;
      if (Array.isArray(bens) && bens.length > 0) {
        setBeneficiarios(bens.map((b: any) => ({ nombre: b.nombre || '', documento: b.documento || '', parentesco: b.parentesco || '', porcentaje: b.porcentaje?.toString() || '' })));
      }
    }
  }, [isEditMode, polizaToEdit]);

  // Si la lista de vendedores llega después, intentar alinear selección en modo edición
  useEffect(() => {
    if (isEditMode && polizaToEdit && vendedores.length > 0) {
      // Vendedor principal
      if (polizaToEdit.vendedor_id && !selectedVendedorId) {
        setSelectedVendedorId(String(polizaToEdit.vendedor_id));
      } else if (polizaToEdit.vendedor && !selectedVendedorId) {
        const vend = vendedores.find(v => v.nombre === polizaToEdit.vendedor);
        if (vend) setSelectedVendedorId(vend.id);
      }
      // Vendedor 2
      if (polizaToEdit.vendedor_id_2 && !selectedVendedorId2) {
        setSelectedVendedorId2(String(polizaToEdit.vendedor_id_2));
      }
    }
  }, [isEditMode, polizaToEdit, vendedores, selectedVendedorId, selectedVendedorId2]);

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
    // If the value contains a decimal point, parse as float and round first
    // This handles backend values like "152345.67" correctly
    let num: number;
    if (value.includes('.')) {
      num = Math.round(parseFloat(value));
    } else {
      const digitsOnly = value.replace(/\D/g, '');
      if (!digitsOnly) return '';
      num = Number(digitsOnly);
    }
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
    }
  }, []);

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

      // Usar nombres del backend (ya matched contra catálogos reales) o fuzzy match local
      const mapAseguradora = (r: typeof result) => {
        if (r.aseguradora_nombre) {
          const exact = aseguradoras.find(a => a.nombre === r.aseguradora_nombre);
          if (exact) return exact.nombre;
        }
        if (!r.aseguradora) return '';
        const src = r.aseguradora.toLowerCase();
        return (aseguradoras.find(a => a.nombre.toLowerCase() === src)
          || aseguradoras.find(a => src.includes(a.nombre.toLowerCase()))
          || aseguradoras.find(a => a.nombre.toLowerCase().includes(src)))?.nombre || r.aseguradora;
      };

      const mapRamo = (r: typeof result) => {
        if (r.ramo_nombre) {
          const exact = ramos.find(rm => rm.nombre === r.ramo_nombre);
          if (exact) return exact.nombre;
        }
        if (!r.ramo) return '';
        const src = r.ramo.toLowerCase();
        return (ramos.find(rm => rm.nombre.toLowerCase() === src)
          || ramos.find(rm => src.includes(rm.nombre.toLowerCase()))
          || ramos.find(rm => rm.nombre.toLowerCase().includes(src)))?.nombre || r.ramo;
      };

      // Mapear los datos extraídos al formulario
      setFormData(prev => ({
        ...prev,
        // Información de la póliza
        numeroPoliza: result.numeroPoliza || prev.numeroPoliza,
        aseguradora: mapAseguradora(result) || prev.aseguradora,
        ramoPrincipal: mapRamo(result) || prev.ramoPrincipal,
        tipoPoliza: 'vigente',
        riesgo: result.riesgo || prev.riesgo,
        valorRiesgoAsegurado: result.valorAsegurado || prev.valorRiesgoAsegurado,
        
        // Información del cliente
        nombresCliente: result.clienteNombre || result.tomadorNombre || prev.nombresCliente,
        apellidosCliente: result.clienteApellido || prev.apellidosCliente,
        dniCliente: result.clienteCedula || result.tomadorDocumento || prev.dniCliente,
        celularCliente: result.clienteTelefono || result.tomadorTelefono || prev.celularCliente,
        correoCliente: result.clienteEmail || result.tomadorEmail || prev.correoCliente,
        domicilio: result.clienteDireccion || result.tomadorDireccion || prev.domicilio,
        
        // Información financiera
        primaNeta: result.primaNeta || prev.primaNeta,
        iva: result.iva || prev.iva,
        total: result.total || prev.total,
        formaPago: result.periodicidadPago || result.formaPago || prev.formaPago,
        medioPago: result.medioPago || prev.medioPago,
        porcentajeComision: result.porcentajeComision || prev.porcentajeComision,
        
        // Fechas
        fechaExpedicion: result.fechaExpedicion || prev.fechaExpedicion,
        fechaInicio: result.fechaInicio || prev.fechaInicio,
        fechaFin: result.fechaFin || prev.fechaFin,
        
        // Placas de vehículos
        placas: result.placas && result.placas.length > 0 ? result.placas : prev.placas,
        
        // Tomador/Asegurado
        policy_holder_name: result.tomadorNombre || prev.policy_holder_name,
        policy_holder_document: result.tomadorDocumento || prev.policy_holder_document,
        policy_holder_doc_type: result.tipoDocTomador || prev.policy_holder_doc_type,
        policy_holder_phone: result.tomadorTelefono || prev.policy_holder_phone,
        policy_holder_email: result.tomadorEmail || prev.policy_holder_email,
        policy_holder_address: result.tomadorDireccion || prev.policy_holder_address,
        policy_holder_city: result.tomadorCiudad || prev.policy_holder_city,
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
      const _extractedFields = Object.entries(result)
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

  const handleSubmit = async (e: React.FormEvent, _forceSubmit: boolean = false) => {
    e.preventDefault();
    
    // Validar que se puede guardar
    if (canSavePoliza()) {
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
          vendedor_id_2: selectedVendedorId2 ? parseInt(selectedVendedorId2) : undefined,
          enlace_externo: formData.enlaceExterno || undefined,
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
          beneficiario_oneroso_nombre: formData.beneficiarioOnerosoNombre || undefined,
          beneficiario_oneroso_documento: formData.beneficiarioOnerosoDocumento || undefined,
          // Beneficiarios array (múltiples)
          beneficiarios: beneficiarios.filter(b => b.nombre.trim() || b.documento.trim()),
          // Vehículos: enviar si el ramo es automotor (Automóvil o SOAT) y hay placas
          ...(((s => s.includes('auto') || s.includes('soat'))(String(formData.ramoPrincipal || '').toLowerCase())) && Array.isArray((formData as any).placas)
            ? { placas: (formData as any).placas }
            : {}),
          // Campos SoftSeguros
          policy_category: (formData as any).categoriaPoliza || 'individual',
          clasificacion_poliza: (formData as any).clasificacionPoliza || undefined,
          periodicidad: (formData as any).periodicidad || undefined,
          soat: !!(formData as any).esSoat,
          arl: !!(formData as any).esArl,
          colectiva: (formData as any).categoriaPoliza === 'colectiva',
          tipo_poliza: (formData as any).categoriaPoliza || formData.tipoPoliza || 'individual',
          // Comisiones detalladas
          iva_comision: (formData as any).ivaComision ? parseFloat((formData as any).ivaComision) : undefined,
          porcentaje_sobrecomision: (formData as any).porcentajeSobrecomision ? parseFloat((formData as any).porcentajeSobrecomision) : undefined,
          sobrecomision: (formData as any).sobrecomision ? parseFloat((formData as any).sobrecomision) : undefined,
          porcentaje_comision_vendedor: (formData as any).porcentajeComisionVendedor ? parseFloat((formData as any).porcentajeComisionVendedor) : undefined,
          comision_vendedor: (formData as any).comisionVendedor ? parseFloat((formData as any).comisionVendedor) : undefined,
          coinsurance_participation: (formData as any).coinsuranceParticipation ? parseFloat((formData as any).coinsuranceParticipation) : undefined,
          // Financiación
          porcentaje_financiacion: (formData as any).porcentajeFinanciacion ? parseFloat((formData as any).porcentajeFinanciacion) : undefined,
          valor_financiacion: (formData as any).valorFinanciacion ? parseFloat((formData as any).valorFinanciacion) : undefined,
          total_poliza_financiada: (formData as any).totalPolizaFinanciada ? parseFloat((formData as any).totalPolizaFinanciada) : undefined,
          // Cartera
          estado_cartera: (formData as any).estadoCartera || undefined,
          // Impuestos
          porcentaje_impuesto_bomberos: (formData as any).porcentajeImpuestoBomberos ? parseFloat((formData as any).porcentajeImpuestoBomberos) : undefined,
          impuesto_bomberos: (formData as any).impuestoBomberos ? parseFloat((formData as any).impuestoBomberos) : undefined,
          // Moneda
          tipo_moneda: (formData as any).tipoMoneda || undefined,
          tasa_cambio: (formData as any).tasaCambio ? parseFloat((formData as any).tasaCambio) : undefined,
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
            vendedor_id_2: selectedVendedorId2 ? parseInt(selectedVendedorId2) : undefined,
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
            vendedor_id_2: selectedVendedorId2 ? parseInt(selectedVendedorId2) : undefined,
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
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      {/* PDF Processing Banner - shows progress at the top */}
      {pdfFile && pdfProcessing && (
        <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Spinner size="md" color="info" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-blue-800 dark:text-blue-200">Leyendo PDF con Inteligencia Artificial...</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Los campos del formulario se llenarán automáticamente</p>
              <div className="mt-2">
                <Progress progress={processingProgress} color="blue" size="sm" />
              </div>
            </div>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{processingProgress}%</span>
          </div>
        </div>
      )}

      {/* PDF Success Banner */}
      {pdfFile && !pdfProcessing && pdfConfidence && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm text-green-800 dark:text-green-200">PDF procesado correctamente</p>
                <p className="text-xs text-green-600 dark:text-green-400">Confianza: {pdfConfidence.overall?.toFixed(0) || 0}% &mdash; Revisa los campos y guarda la póliza</p>
              </div>
            </div>
            <button onClick={removePdf} className="text-green-600 hover:text-red-500 transition-colors" title="Quitar PDF">
              <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Importer - compact bar */}
      {!pdfFile && (
        <div className="mb-3">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Icon icon="solar:cloud-upload-bold-duotone" className="w-4 h-4 text-primary" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Importar desde PDF con IA</span>
            </div>
            <Button color="light" size="xs" onClick={() => setShowImporter(prev => !prev)} className="rounded-lg">
              {showImporter ? 'Ocultar' : 'Importar PDF'}
            </Button>
          </div>
          {showImporter && (
            <div {...getRootProps()} className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}>
              <input {...getInputProps()} />
              <Icon icon="solar:cloud-upload-bold-duotone" className="mx-auto mb-1 w-6 h-6 text-gray-400" />
              <p className="text-xs text-gray-600">{isDragActive ? 'Suelta aquí' : 'Arrastra un PDF o haz clic'}</p>
            </div>
          )}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid gap-4 xl:grid-cols-2">

      {/* ==================== LEFT COLUMN ==================== */}
      <div className="space-y-4">

        {/* === INFORMACIÓN PRINCIPAL DE LA PÓLIZA === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Información principal de la póliza" icon="solar:document-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <FormField id="numeroPoliza" name="numeroPoliza" label="Número Póliza" value={formData.numeroPoliza} onChange={handleInputChange} error={errors.numeroPoliza} required placeholder="POL-2024-XXX" />
              {checkingPoliza && <div className="absolute right-2 top-8"><Spinner size="sm" /></div>}
              {!checkingPoliza && polizaError && !isEditMode && (
                <div className="flex items-center gap-1 mt-0.5 text-amber-600 text-[10px]"><Icon icon="solar:danger-triangle-bold" className="w-3 h-3" /><span>{polizaError}</span></div>
              )}
            </div>

            <FormField id="tipoPoliza" name="tipoPoliza" label="Estado" value={formData.tipoPoliza} onChange={handleInputChange} error={errors.tipoPoliza} required type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'vigente', label: 'Vigente' }, { value: 'vencida', label: 'Vencida' }, { value: 'cancelada', label: 'Cancelada' }, { value: 'cotizacion', label: 'Cotización' }, { value: 'devengada', label: 'Devengada' }, { value: 'expedicion', label: 'Expedición' }, { value: 'no_renovada', label: 'No renovada' },
            ]} />

            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-1.5 text-xs">
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, renovable: !prev.renovable }))} className={`inline-flex h-5 w-9 items-center rounded-full transition ${formData.renovable ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`size-3.5 translate-x-0.5 rounded-full bg-white transition ${formData.renovable ? 'translate-x-4' : ''}`} />
                </button>
                Renovable
              </label>
            </div>

            <FormField id="aseguradora" name="aseguradora" label="Aseguradora" value={formData.aseguradora} onChange={(e: any) => {
              handleInputChange(e);
              const newAseg = e.target.value;
              // Limpiar ramo y subramo si la aseguradora cambia
              if (newAseg !== formData.aseguradora) {
                setFormData(prev => ({ ...prev, aseguradora: newAseg, ramoPrincipal: '', subramo: '' }));
              }
            }} error={errors.aseguradora} required type="select" options={[{ value: '', label: 'Seleccionar' }, ...aseguradoras.map(a => ({ value: a.nombre, label: a.nombre }))]} />

            {(() => {
              // Filtrar ramos: si hay aseguradora seleccionada, mostrar solo ramos que tengan comisión con esa aseguradora
              const selAseg = aseguradoras.find(a => a.nombre === formData.aseguradora);
              const ramosDisponibles = selAseg
                ? ramos.filter(r => r.comisiones_aseguradoras.some(c => c.aseguradora_id === selAseg.id || c.aseguradora_nombre === formData.aseguradora))
                : ramos;
              // Si no hay ramos filtrados por aseguradora pero hay ramos en general, mostrar todos
              const ramosToShow = ramosDisponibles.length > 0 ? ramosDisponibles : ramos;
              return <FormField id="ramoPrincipal" name="ramoPrincipal" label="Ramo" value={formData.ramoPrincipal} onChange={(e: any) => {
                handleInputChange(e);
                const newRamo = e.target.value;
                if (newRamo !== formData.ramoPrincipal) {
                  // Limpiar subramo al cambiar ramo
                  setFormData(prev => ({ ...prev, ramoPrincipal: newRamo, subramo: '' }));
                  // Auto-rellenar comisión e IVA desde config
                  if (selAseg) {
                    const ramoObj = ramos.find(r => r.nombre === newRamo);
                    const comConfig = ramoObj?.comisiones_aseguradoras.find(c => c.aseguradora_id === selAseg.id || c.aseguradora_nombre === formData.aseguradora);
                    if (comConfig) {
                      setFormData(prev => ({
                        ...prev,
                        ramoPrincipal: newRamo,
                        subramo: '',
                        porcentajeComision: comConfig.porcentaje_comision ? String(comConfig.porcentaje_comision) : prev.porcentajeComision,
                        porcentajeIva: comConfig.porcentaje_iva ? String(comConfig.porcentaje_iva) : prev.porcentajeIva,
                        priAPre: comConfig.pri_a_pre_por_defecto ? String(comConfig.pri_a_pre_por_defecto) : prev.priAPre,
                      }));
                    }
                  }
                }
              }} error={errors.ramoPrincipal} required type="select" options={[{ value: '', label: 'Seleccionar' }, ...ramosToShow.map(r => ({ value: r.nombre, label: r.nombre }))]} />;
            })()}

            {(() => {
              const selRamo = ramos.find(r => r.nombre === formData.ramoPrincipal);
              const subs = selRamo && Array.isArray(selRamo.subramo) ? selRamo.subramo : [];
              return <FormField id="subramo" name="subramo" label="Subramo" value={formData.subramo} onChange={handleInputChange} type="select" options={[{ value: '', label: 'Seleccionar subramo' }, ...subs.map(s => ({ value: s, label: s }))]} />;
            })()}

            <FormField id="categoriaPoliza" name="categoriaPoliza" label="Categoría" value={(formData as any).categoriaPoliza || 'individual'} onChange={(e: any) => { handleInputChange(e); onCategoryChange?.(e.target.value); }} type="select" options={[
              { value: 'individual', label: 'Individual' }, { value: 'colectiva', label: 'Colectiva' }, { value: 'agrupadora', label: 'Agrupadora' }, { value: 'coaseguro', label: 'Coaseguro' },
            ]} />

            <FormField id="clasificacionPoliza" name="clasificacionPoliza" label="Clasificación" value={(formData as any).clasificacionPoliza || ''} onChange={handleInputChange} type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'Nuevos', label: 'Nueva' }, { value: 'Renovación', label: 'Renovación' },
            ]} />

            <FormField id="periodicidad" name="periodicidad" label="Periodicidad" value={(formData as any).periodicidad || ''} onChange={handleInputChange} type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'Mensual', label: 'Mensual' }, { value: 'Bimestral', label: 'Bimestral' }, { value: 'Trimestral', label: 'Trimestral' }, { value: 'Semestral', label: 'Semestral' }, { value: 'Anual', label: 'Anual' },
            ]} />

            <FormField id="sede" name="sede" label="Sede" value={formData.sede} onChange={handleInputChange} type="select" options={[{ value: '', label: 'Seleccionar' }, ...sedes.map(s => ({ value: s.nombre, label: s.nombre }))]} />

            {/* Placas de vehículos */}
            {(s => s.includes('auto') || s.includes('soat'))(String(formData.ramoPrincipal || '').toLowerCase()) && (
              <div className="col-span-full z-[100]">
                <Label htmlFor="placa_input" className="text-xs font-medium text-gray-900 dark:text-white">Placas</Label>
                <div className="mt-1 relative">
                  <div className="flex gap-1">
                    <Input id="placa_input" placeholder="ABC123" value={placaInput}
                      onChange={(e: any) => { setPlacaInput((e.target.value || '').toUpperCase()); if ((errors as any)['placas']) clearError('placas'); }}
                      onKeyDown={async (e: any) => { if (e.key === 'Enter') { e.preventDefault(); const v = normalizePlate(placaInput); if (!v) return; placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v) ? addPlate(v) : await createAndAddPlate(v); }}}
                      className={`flex-1 ${(errors as any)['placas'] ? 'border-red-500' : ''}`} />
                    <Button type="button" color="light" size="xs" onClick={async () => { const v = normalizePlate(placaInput); if (!v) return; placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v) ? addPlate(v) : await createAndAddPlate(v); }}>+</Button>
                  </div>
                  {placaInput && (
                    <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-40 overflow-auto">
                      {placaLoading ? <div className="p-2 text-xs text-gray-500">Buscando...</div> : placaSuggestions.length > 0 ? placaSuggestions.map(s => (
                        <div key={`${s.id}-${s.placa}`} className="p-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between" onClick={() => addPlate(String(s.placa || ''))}>
                          <span className="font-medium">{String(s.placa || '')}</span>
                          <span className="text-gray-400">{s.client_name ? s.client_name : ''}</span>
                        </div>
                      )) : <div className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer" onClick={async () => { await createAndAddPlate(placaInput); }}>Crear "{normalizePlate(placaInput)}"</div>}
                    </div>
                  )}
                  {((errors as any)['placas'] || placaError) && <p className="text-red-500 text-[10px] mt-0.5">{(errors as any)['placas'] || placaError}</p>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Array.isArray((formData as any).placas) && (formData as any).placas.map((p: string, idx: number) => (
                    <span key={`${p}-${idx}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px]">
                      {p}
                      <button type="button" className="text-gray-500 hover:text-red-600 text-xs" onClick={() => setFormData(prev => ({ ...prev, placas: ((prev as any).placas || []).filter((x: string) => x !== p) } as any))} aria-label={`Quitar ${p}`}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Riesgo */}
            <FormField id="riesgo" name="riesgo" label="Riesgo Asegurado" value={formData.riesgo} onChange={handleInputChange} placeholder="Descripción del riesgo" className="col-span-2" />
            <div>
              <Label htmlFor="valorRiesgoAsegurado" className="text-xs font-medium text-gray-900 dark:text-white">Valor Riesgo</Label>
              <Input id="valorRiesgoAsegurado" name="valorRiesgoAsegurado" value={formatCurrencyDisplay(formData.valorRiesgoAsegurado)} onChange={handleCurrencyChange('valorRiesgoAsegurado')} placeholder="$0" className={`mt-1 ${errors.valorRiesgoAsegurado ? 'border-red-500' : ''}`} />
            </div>
          </div>
        </div>

        {/* === CLIENTE === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-visible">
          <SectionHeader title="Cliente" icon="solar:user-bold" />
          <div className="space-y-3 overflow-visible">
            <div className="relative" style={{ zIndex: 1000 }}>
              <Label className="text-xs font-medium text-gray-900 dark:text-white mb-1 block">Buscar cliente <span className="text-red-500">*</span></Label>
              <div className="flex gap-1">
                <Input placeholder="Nombre, documento, teléfono..." value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                  onChange={(e) => { setSelectedClient(null); setClientQuery(e.target.value); setFormData(prev => ({ ...prev, cliente_id: undefined as any })); }}
                  className={`flex-1 ${errors['cliente_id'] ? 'border-red-500' : ''}`} required />
                <Button type="button" color="primary" size="xs" onClick={() => { setClientModalMode('new'); setClienteToEdit(null); setShowClientModal(true); }}>
                  <Icon icon="solar:user-plus-bold" className="w-3 h-3" />
                </Button>
                {selectedClient && (
                  <Button type="button" color="light" size="xs" onClick={async () => {
                    setClientModalMode('edit');
                    if (selectedClient.id) { try { const res = await saasApi.getCliente(selectedClient.id); if (res.success && res.data) { setClienteToEdit(res.data as any); setShowClientModal(true); return; } } catch (e) { console.error('Error cargando cliente:', e); } }
                    const mapped = mapSaasClienteToFormulario(selectedClient.raw); setClienteToEdit({ id: selectedClient.id, ...mapped } as any); setShowClientModal(true);
                  }}><Icon icon="solar:pen-bold" className="w-3 h-3" /></Button>
                )}
              </div>
              {errors['cliente_id'] && <p className="text-[10px] text-red-500 mt-0.5">{errors['cliente_id'] as any}</p>}
              {(!selectedClient && (clientQuery.length >= 2 || clientLoading)) && (
                <div className="absolute left-0 right-0 z-[99999] mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-2xl max-h-48 overflow-auto" style={{ position: 'absolute', zIndex: 99999 }}>
                  {clientLoading ? <div className="p-2 text-xs text-gray-500">Buscando...</div> : clientResults.length === 0 ? <div className="p-2 text-xs text-gray-500">Sin resultados</div> : clientResults.map(c => (
                    <div key={c.id} className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => {
                      setSelectedClient(c); setClientQuery('');
                      const raw = c.raw || {}; const persona = raw.persona || {};
                      setFormData(prev => ({ ...prev, cliente_id: c.id as any, nombresCliente: persona.nombres || raw.nombre || prev.nombresCliente, apellidosCliente: persona.apellidos || raw.apellidos || prev.apellidosCliente, dniCliente: persona.documento || raw.empresa?.nit || raw.cuit || prev.dniCliente, celularCliente: raw.celular || raw.celular_principal || prev.celularCliente, correoCliente: raw.email || raw.email_principal || prev.correoCliente, domicilio: raw.direccion || raw.domicilio_principal || prev.domicilio }));
                    }}>
                      <div className="text-xs font-medium">{c.nombre}</div>
                      <div className="text-[10px] text-gray-500">{c.documento || ''} {c.celular ? `• ${c.celular}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="p-2 border rounded bg-gray-50 dark:bg-gray-800/40 text-xs">
                <span className="font-medium">{selectedClient.nombre}</span>
                <span className="text-gray-500 ml-2">{selectedClient.documento || '-'} {selectedClient.celular ? `• ${selectedClient.celular}` : ''}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField id="vendedor_id" name="vendedor_id" label={terminologia.vendedor} type="select" value={selectedVendedorId} onChange={(e) => setSelectedVendedorId((e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Sin asignar' }, ...vendedores.map(v => ({ value: v.id, label: v.nombre }))]} />
              <FormField id="vendedor_id_2" name="vendedor_id_2" label={`${terminologia.vendedor} 2`} type="select" value={selectedVendedorId2} onChange={(e) => setSelectedVendedorId2((e.target as HTMLSelectElement).value)} options={[{ value: '', label: 'Sin asignar' }, ...vendedores.map(v => ({ value: v.id, label: v.nombre }))]} />
            </div>
            <FormField id="enlaceExterno" name="enlaceExterno" label="Enlace Externo" value={formData.enlaceExterno || ''} onChange={handleInputChange} placeholder="https://..." />
          </div>
        </div>

        {/* === VIGENCIA Y FECHAS === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Vigencia" icon="solar:calendar-bold" />
          <div className="grid grid-cols-3 gap-3">
            <FormField id="fechaExpedicion" name="fechaExpedicion" label="Expedición" type="date" value={formData.fechaExpedicion} onChange={handleInputChange} error={errors.fechaExpedicion} required />
            <FormField id="fechaInicio" name="fechaInicio" label="Inicio" type="date" value={formData.fechaInicio} onChange={handleInputChange} error={errors.fechaInicio} required />
            <div>
              <Label htmlFor="fechaFin" className="text-xs font-medium text-gray-900 dark:text-white">Fin *</Label>
              <Input id="fechaFin" name="fechaFin" type="date" value={formData.fechaFin} onChange={handleInputChange} className={`mt-1 ${errors.fechaFin ? 'border-red-500' : ''}`} />
              {errors.fechaFin && <p className="text-red-500 text-[10px] mt-0.5">{errors.fechaFin}</p>}
            </div>
          </div>
        </div>

        {/* === TOMADOR / ASEGURADO === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Tomador / Asegurado" icon="solar:users-group-rounded-bold" />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="policy_holder_name" name="policy_holder_name" label="Tomador" value={(formData as any).policy_holder_name || ''} onChange={handleInputChange} />
            <FormField id="policy_holder_document" name="policy_holder_document" label="Doc. Tomador" value={(formData as any).policy_holder_document || ''} onChange={handleInputChange} />
            <FormField id="insured_name" name="insured_name" label="Asegurado" value={(formData as any).insured_name || ''} onChange={handleInputChange} />
            <FormField id="insured_document" name="insured_document" label="Doc. Asegurado" value={(formData as any).insured_document || ''} onChange={handleInputChange} />
          </div>
        </div>

        {/* === BENEFICIARIOS === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Icon icon="solar:shield-user-bold" className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">Beneficiarios</h3>
            </div>
            <Button type="button" color="light" size="xs" onClick={() => setBeneficiarios(prev => [...prev, emptyBeneficiario()])}>
              <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" /> Agregar
            </Button>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox id="beneficiarioEnRemision" checked={!!formData.beneficiarioEnRemision} onCheckedChange={(v) => setFormData(prev => ({ ...prev, beneficiarioEnRemision: !!v }))} />
              En remisión
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox id="beneficiarioOneroso" checked={(formData as any).beneficiarioOneroso || false} onCheckedChange={(v) => setFormData(prev => ({ ...prev, beneficiarioOneroso: !!v }))} />
              Oneroso
            </label>
          </div>
          <div className="space-y-2">
            {beneficiarios.map((ben, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_80px_28px] gap-2 items-end">
                <div>
                  {idx === 0 && <Label className="text-[10px] text-gray-500 mb-0.5 block">Nombre</Label>}
                  <Input placeholder="Nombre" value={ben.nombre} onChange={(e) => { const v = [...beneficiarios]; v[idx] = { ...v[idx], nombre: e.target.value }; setBeneficiarios(v); }} />
                </div>
                <div>
                  {idx === 0 && <Label className="text-[10px] text-gray-500 mb-0.5 block">Documento</Label>}
                  <Input placeholder="Documento" value={ben.documento} onChange={(e) => { const v = [...beneficiarios]; v[idx] = { ...v[idx], documento: e.target.value }; setBeneficiarios(v); }} />
                </div>
                <div>
                  {idx === 0 && <Label className="text-[10px] text-gray-500 mb-0.5 block">Parentesco</Label>}
                  <Input placeholder="Parentesco" value={ben.parentesco} onChange={(e) => { const v = [...beneficiarios]; v[idx] = { ...v[idx], parentesco: e.target.value }; setBeneficiarios(v); }} />
                </div>
                <div>
                  {idx === 0 && <Label className="text-[10px] text-gray-500 mb-0.5 block">%</Label>}
                  <Input type="number" placeholder="%" value={ben.porcentaje} onChange={(e) => { const v = [...beneficiarios]; v[idx] = { ...v[idx], porcentaje: e.target.value }; setBeneficiarios(v); }} />
                </div>
                <button type="button" className={`text-gray-400 hover:text-red-500 transition pb-1 ${beneficiarios.length <= 1 ? 'invisible' : ''}`} onClick={() => setBeneficiarios(prev => prev.filter((_, i) => i !== idx))} title="Quitar">
                  <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* === OBSERVACIONES === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Observaciones" icon="solar:notes-bold" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="observaciones" className="text-xs font-medium text-gray-900 dark:text-white">Observaciones</Label>
              <Textarea id="observaciones" name="observaciones" value={formData.observaciones} onChange={handleInputChange} placeholder="Observaciones generales" rows={2} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="observacionesInternas" className="text-xs font-medium text-gray-900 dark:text-white">Internas</Label>
              <Textarea id="observacionesInternas" name="observacionesInternas" value={formData.observacionesInternas} onChange={handleInputChange} placeholder="No visibles para el cliente" rows={2} className="mt-1" />
            </div>
          </div>
        </div>

      </div>{/* END LEFT COLUMN */}

      {/* ==================== RIGHT COLUMN ==================== */}
      <div className="space-y-4">

        {/* === INFORMACIÓN FINANCIERA === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Información Financiera" icon="solar:wallet-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="primaNeta" className="text-xs font-medium text-gray-900 dark:text-white">Prima Neta *</Label>
              <Input id="primaNeta" name="primaNeta" value={formatCurrencyDisplay(formData.primaNeta)} onChange={handleCurrencyChange('primaNeta')} placeholder="0" className={`mt-1 ${errors.primaNeta ? 'border-red-500' : ''}`} />
              {errors.primaNeta && <p className="text-red-500 text-[10px] mt-0.5">{errors.primaNeta}</p>}
            </div>
            <div>
              <Label htmlFor="porcentajeIva" className="text-xs font-medium text-gray-900 dark:text-white">% IVA</Label>
              <Input id="porcentajeIva" name="porcentajeIva" type="number" value={formData.porcentajeIva} onChange={handleInputChange} placeholder="19" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="iva" className="text-xs font-medium text-gray-900 dark:text-white">IVA</Label>
              <Input id="iva" name="iva" value={formatCurrencyDisplay(formData.iva)} readOnly className="mt-1 bg-gray-50 dark:bg-gray-800" />
            </div>
            <div>
              <Label htmlFor="gastosAdicionales" className="text-xs font-medium text-gray-900 dark:text-white">Gastos Adic.</Label>
              <Input id="gastosAdicionales" name="gastosAdicionales" value={formatCurrencyDisplay(formData.gastosAdicionales)} onChange={handleCurrencyChange('gastosAdicionales')} placeholder="0" className="mt-1" />
              <div className="flex items-center gap-1 mt-1">
                <Checkbox id="gastosAdicionalesAplicaIva" checked={!!formData.gastosAdicionalesAplicaIva} onCheckedChange={(v) => setFormData(prev => ({ ...prev, gastosAdicionalesAplicaIva: !!v }))} />
                <Label htmlFor="gastosAdicionalesAplicaIva" className="text-[10px] text-gray-500 cursor-pointer">+IVA</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="total" className="text-xs font-medium text-gray-900 dark:text-white">Total</Label>
              <Input id="total" name="total" value={formatCurrencyDisplay(formData.total)} readOnly className="mt-1 font-semibold bg-gray-50 dark:bg-gray-800" />
            </div>
          </div>
        </div>

        {/* === FORMA DE PAGO === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Forma de Pago" icon="solar:card-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="formaPago" name="formaPago" label="Forma" value={formData.formaPago} onChange={handleInputChange} error={errors.formaPago} required type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'contado', label: 'Contado' }, { value: 'credito', label: 'Crédito' }, { value: 'financiado', label: 'Financiado' },
            ]} />
            <FormField id="periodicidadPago" name="periodicidadPago" label="Periodicidad" value={formData.periodicidadPago} onChange={handleInputChange} type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'anual', label: 'Anual' }, { value: 'semestral', label: 'Semestral' }, { value: 'trimestral', label: 'Trimestral' }, { value: 'mensual', label: 'Mensual' },
            ]} />
            <div>
              <Label htmlFor="medioPago" className="text-xs font-medium text-gray-900 dark:text-white">Medio</Label>
              <select id="medioPago" name="medioPago" value={formData.medioPago} onChange={handleInputChange} className={`mt-1 block w-full border rounded-md p-2 text-sm bg-white dark:bg-gray-800 ${errors.medioPago ? 'border-red-500' : ''}`}>
                <option value="">Seleccionar</option>
                <option value="tarjeta_credito">Tarjeta Crédito</option>
                <option value="convenio">Convenio</option>
                <option value="cheque">Cheque</option>
                <option value="cheque_postfechado">Cheque post fechado</option>
                <option value="cheque_al_dia">Cheque al día</option>
                <option value="debito">Débito</option>
                <option value="consignacion">Consignación</option>
                <option value="pse">PSE</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <FormField id="banco" name="banco" label="Banco" value={formData.banco || ''} onChange={handleInputChange} type="select" options={[{ value: '', label: 'Seleccionar' }, ...colombianBanks.map(b => ({ value: b, label: b })), { value: 'otro', label: 'Otro' }]} />

            {/* Campos condicionales de medio de pago */}
            {formData.medioPago === 'tarjeta_credito' && (<>
              <div><Label htmlFor="cuotas" className="text-xs font-medium">Cuotas</Label><Input id="cuotas" name="cuotas" value={formData.cuotas || ''} onChange={handleCuotasChange} placeholder="0" className="mt-1" /></div>
              <div><Label htmlFor="numeroTarjeta" className="text-xs font-medium">N° Tarjeta</Label><Input id="numeroTarjeta" name="numeroTarjeta" value={formData.numeroTarjeta || ''} onChange={handleCardNumberChange} placeholder="Últimos 4" className="mt-1" /></div>
            </>)}
            {formData.medioPago === 'convenio' && (
              <div><Label htmlFor="agreement_term" className="text-xs font-medium">Convenio</Label>
                <select id="agreement_term" name="agreement_term" value={(formData as any).agreement_term || ''} onChange={handleInputChange} className="mt-1 block w-full border rounded-md p-2 text-sm bg-white dark:bg-gray-800">
                  <option value="">Seleccionar</option><option value="contado">Contado</option><option value="30_45">30-45 días</option><option value="30_60">30-60 días</option><option value="60_90">60-90 días</option>
                </select></div>
            )}
            {(formData.medioPago === 'cheque' || formData.medioPago === 'cheque_al_dia') && (
              <div><Label htmlFor="cheque_number" className="text-xs font-medium"># Cheque</Label><Input id="cheque_number" name="cheque_number" value={(formData as any).cheque_number || ''} onChange={handleInputChange} placeholder="000000" className="mt-1" /></div>
            )}
            {formData.medioPago === 'debito' && (
              <div><Label htmlFor="debit_account_number" className="text-xs font-medium">N° Cuenta</Label><Input id="debit_account_number" name="debit_account_number" value={(formData as any).debit_account_number || ''} onChange={handleInputChange} placeholder="0000000000" className="mt-1" /></div>
            )}
          </div>
        </div>

        {/* === COMISIONES === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Comisiones" icon="solar:money-bag-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="porcentajeComision" className="text-xs font-medium">% Comisión</Label>
              <Input id="porcentajeComision" name="porcentajeComision" type="number" value={formData.porcentajeComision} onChange={handleInputChange} placeholder="15" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="comision" className="text-xs font-medium">Comisión</Label>
              <Input id="comision" name="comision" value={formatCurrencyDisplay(formData.comision)} readOnly className="mt-1 bg-gray-50 dark:bg-gray-800" />
            </div>
            <div>
              <Label htmlFor="ivaComision" className="text-xs font-medium">IVA Comisión</Label>
              <Input id="ivaComision" name="ivaComision" value={formatCurrencyDisplay((formData as any).ivaComision)} onChange={handleCurrencyChange('ivaComision' as any)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="porcentajeSobrecomision" className="text-xs font-medium">% Sobrecomisión</Label>
              <Input id="porcentajeSobrecomision" name="porcentajeSobrecomision" type="number" value={(formData as any).porcentajeSobrecomision} onChange={handleInputChange} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sobrecomision" className="text-xs font-medium">Sobrecomisión</Label>
              <Input id="sobrecomision" name="sobrecomision" value={formatCurrencyDisplay((formData as any).sobrecomision)} onChange={handleCurrencyChange('sobrecomision' as any)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="porcentajeComisionVendedor" className="text-xs font-medium">% Com. Vendedor</Label>
              <Input id="porcentajeComisionVendedor" name="porcentajeComisionVendedor" type="number" value={(formData as any).porcentajeComisionVendedor} onChange={handleInputChange} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="comisionVendedor" className="text-xs font-medium">Com. Vendedor</Label>
              <Input id="comisionVendedor" name="comisionVendedor" value={formatCurrencyDisplay((formData as any).comisionVendedor)} onChange={handleCurrencyChange('comisionVendedor' as any)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="coinsuranceParticipation" className="text-xs font-medium">% Coaseguro</Label>
              <Input id="coinsuranceParticipation" name="coinsuranceParticipation" type="number" value={(formData as any).coinsuranceParticipation} onChange={handleInputChange} placeholder="0" className="mt-1" />
            </div>
          </div>
        </div>

        {/* === FINANCIACIÓN === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Financiación" icon="solar:chart-bold" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="porcentajeFinanciacion" className="text-xs font-medium">% Financiación</Label>
              <Input id="porcentajeFinanciacion" name="porcentajeFinanciacion" type="number" value={(formData as any).porcentajeFinanciacion} onChange={handleInputChange} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="valorFinanciacion" className="text-xs font-medium">Valor</Label>
              <Input id="valorFinanciacion" name="valorFinanciacion" value={formatCurrencyDisplay((formData as any).valorFinanciacion)} onChange={handleCurrencyChange('valorFinanciacion' as any)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="totalPolizaFinanciada" className="text-xs font-medium">Total Financiada</Label>
              <Input id="totalPolizaFinanciada" name="totalPolizaFinanciada" value={formatCurrencyDisplay((formData as any).totalPolizaFinanciada)} onChange={handleCurrencyChange('totalPolizaFinanciada' as any)} placeholder="0" className="mt-1" />
            </div>
          </div>
        </div>

        {/* === CARTERA E IMPUESTOS === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Cartera e Impuestos" icon="solar:bill-list-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="estadoCartera" name="estadoCartera" label="Cartera" value={(formData as any).estadoCartera || ''} onChange={handleInputChange} type="select" options={[
              { value: '', label: 'Seleccionar' }, { value: 'Sin pagos Asignados', label: 'Sin pagos' }, { value: 'Al día', label: 'Al día' }, { value: 'En mora', label: 'En mora' }, { value: 'Pagado', label: 'Pagado' },
            ]} />
            <div>
              <Label htmlFor="porcentajeImpuestoBomberos" className="text-xs font-medium">% Imp. Bomberos</Label>
              <Input id="porcentajeImpuestoBomberos" name="porcentajeImpuestoBomberos" type="number" value={(formData as any).porcentajeImpuestoBomberos} onChange={handleInputChange} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="impuestoBomberos" className="text-xs font-medium">Imp. Bomberos</Label>
              <Input id="impuestoBomberos" name="impuestoBomberos" value={formatCurrencyDisplay((formData as any).impuestoBomberos)} onChange={handleCurrencyChange('impuestoBomberos' as any)} placeholder="0" className="mt-1" />
            </div>
            <FormField id="tipoMoneda" name="tipoMoneda" label="Moneda" value={(formData as any).tipoMoneda || ''} onChange={handleInputChange} type="select" options={[
              { value: '', label: 'COP' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
            ]} />
            <div>
              <Label htmlFor="tasaCambio" className="text-xs font-medium">Tasa Cambio</Label>
              <Input id="tasaCambio" name="tasaCambio" type="number" step="0.0001" value={(formData as any).tasaCambio} onChange={handleInputChange} placeholder="0.0000" className="mt-1" />
            </div>
          </div>
        </div>

        {/* PDF Preview when active */}
        {pdfFile && (
          <PdfPreview file={pdfFile} processing={pdfProcessing} progress={processingProgress} confidence={pdfConfidence} onRemove={removePdf} />
        )}

      </div>{/* END RIGHT COLUMN */}

      </div>{/* END GRID */}

      {/* === BOTÓN GUARDAR FIJO === */}
      <div className="sticky bottom-0 z-50 mt-4 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 rounded-b-lg flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {isEditMode ? `Editando: ${formData.numeroPoliza}` : 'Nueva póliza'}
        </div>
        <Button type="button" color="success" disabled={isLoading || !canSavePoliza()} onClick={(e) => handleSubmit(e as any, true)} className="flex items-center gap-2 px-6 py-2 rounded-lg" title={!canSavePoliza() ? 'Complete los campos obligatorios' : ''}>
          {isLoading ? (<><Spinner size="sm" /><span>Guardando...</span></>) : (<><Icon icon="solar:diskette-bold" className="w-4 h-4" /><span>{isEditMode ? 'Actualizar' : 'Crear'} Póliza</span></>)}
        </Button>
      </div>

      </form>

      {/* Modal para crear/editar cliente */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)} size="7xl">
        <Modal.Header>{clientModalMode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Header>
        <Modal.Body>
          <div className="max-h-[80vh] overflow-auto p-1">
            <NuevoCliente
              isEditMode={clientModalMode === 'edit'}
              clienteToEdit={clientModalMode === 'edit' ? (clienteToEdit as any) : undefined}
              onSaveSuccess={(clienteActualizado?: any) => {
                setShowClientModal(false);
                if (clienteActualizado) {
                  const c = clienteActualizado;
                  const nombre = `${c?.nombre || ''} ${c?.apellidos || ''}`.trim() || c?.razon_social || 'Cliente';
                  setSelectedClient({ id: String(c.id), nombre, documento: c.cuit, celular: c.celular_principal, email: c.email_principal, raw: c });
                  const persona = c || {};
                  setFormData(prev => ({ ...prev, cliente_id: String(c.id) as any, nombresCliente: persona.nombre || prev.nombresCliente, apellidosCliente: persona.apellidos || prev.apellidosCliente, dniCliente: persona.cuit || prev.dniCliente, celularCliente: persona.celular_principal || prev.celularCliente, correoCliente: persona.email_principal || prev.correoCliente, domicilio: persona.direccion || prev.domicilio, fechaNacimiento: persona.fecha_nacimiento || prev.fechaNacimiento, genero: typeof persona.genero === 'string' ? persona.genero : prev as any }));
                }
                if (clientQuery && clientQuery.length >= 2) { setClientQuery(clientQuery + ' '); setClientQuery(q => q.trim()); }
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default NuevaPoliza; 
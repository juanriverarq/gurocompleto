import React, { useState, useEffect, useCallback } from 'react';
import { Button, Alert, Spinner, Badge, Progress, Modal } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import FormField from 'src/components/shared/FormField';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { useDropzone } from 'react-dropzone';
import { testPdfJs } from 'src/utils/pdfSetup';
import { polizaService } from 'src/services/polizaService';
import saasApi from 'src/services/saasApi';
import { useAseguradoras, useRamos } from 'src/hooks/useAdminCrudApi';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';

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
                <p className="text-xs text-gray-400 leading-tight">{step.description}</p>
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
  onRemove: () => void;
}> = ({ file, processing, progress, onRemove }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
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
              <p className="text-xs text-gray-500 text-center">{progress}% completado</p>
            </div>
          )}

          <Alert color="info" className="text-xs">
            <div className="flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" className="w-3 h-3" />
              <span>Los campos se llenarán automáticamente</span>
            </div>
          </Alert>

          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden">
            {processing ? (
              <div className="h-96 bg-gray-50 dark:bg-gray-700 p-4 relative">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-6"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
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
              <div className="h-96 bg-gray-50 dark:bg-gray-700 relative">
                {pdfUrl && (
                  <iframe src={pdfUrl} className="w-full h-full border-0" title="Vista previa del PDF" />
                )}
                <div className="absolute top-2 right-2">
                  <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                    <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                    <span>Procesado</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {pdfUrl && !processing && (
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>PDF completamente interactivo</span>
              <div className="flex gap-2">
                <button onClick={() => window.open(pdfUrl!, '_blank')} className="text-primary hover:text-primary-600 font-medium">
                  Abrir en nueva pestaña
                </button>
              </div>
            </div>
          )}
        </div>
      </CardBox>

      {/* Modal de pantalla completa */}
      {isFullscreen && pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-7xl max-h-full">
            <div className="bg-white rounded-lg h-full flex flex-col shadow-2xl">
              <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg">
                <h3 className="text-lg font-semibold text-gray-800 truncate">{file.name}</h3>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-2 transition-colors"
                >
                  <Icon icon="solar:close-bold" className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <iframe src={pdfUrl} className="w-full h-full border-0 rounded-b-lg" title="Vista previa del PDF en pantalla completa" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NuevaPolizaColectiva: React.FC = () => {
  const navigate = useNavigate();

  // Estado del formulario (campos principales requeridos y opcionales)
  const [numeroPoliza, setNumeroPoliza] = useState('');
  const [estadoPoliza, setEstadoPoliza] = useState<'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | ''>('');
  const [renovable, setRenovable] = useState<'si' | 'no' | ''>('');
  const [aseguradora, setAseguradora] = useState('');
  const [ramo, setRamo] = useState('');
  const [aseguradoras, setAseguradoras] = useState<{ id: string; nombre: string }[]>([]);
  const [ramos, setRamos] = useState<{ id: string; nombre: string }[]>([]);
  const [fechaExpedicion, setFechaExpedicion] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [valorAsegurado, setValorAsegurado] = useState('');
  const [tipoMoneda, setTipoMoneda] = useState(''); // Campo visual (no mapeado todavía al backend)
  // Cliente: buscador y selección
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id?: string; nombre?: string; documento?: string; celular?: string; email?: string; raw?: any } | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);

  const [nombreTomador, setNombreTomador] = useState('');
  const [tipoDocTomador, setTipoDocTomador] = useState('CC');
  const [docTomador, setDocTomador] = useState('');

  const [observaciones, setObservaciones] = useState('');

  // Prima y comisiones
  const [primaNeta, setPrimaNeta] = useState('');
  const [priAPre, setPriAPre] = useState('');
  const [participacion, setParticipacion] = useState('');
  const [coCorretaje, setCoCorretaje] = useState(false);
  const [ivaCheck, setIvaCheck] = useState(false);
  const [porcentajeIvaPrima, setPorcentajeIvaPrima] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState('');
  const [comisionAgencia, setComisionAgencia] = useState('');
  const [total, setTotal] = useState('');

  // Pagos
  const [periodicidadPago, setPeriodicidadPago] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [medioPago, setMedioPago] = useState('');
  const [banco, setBanco] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [showImporter, setShowImporter] = useState(false);

  const steps = [
    { title: 'Datos', description: 'Información principal' },
    { title: 'Tomador', description: 'Datos del tomador' },
    { title: 'Observaciones', description: 'Notas y comentarios' },
    { title: 'Prima/Comisiones', description: 'Valores y tasas' },
    { title: 'Pagos', description: 'Forma y periodicidad' }
  ];

  // Catálogos (igual que en individual)
  const { aseguradoras: asegHook } = useAseguradoras();
  const { ramos: ramosHook } = useRamos();

  useEffect(() => {
    setAseguradoras((asegHook || []).map((a: any) => ({ id: String(a.id), nombre: a.nombre || a.name })));
  }, [asegHook]);

  useEffect(() => {
    setRamos((ramosHook || []).map((r: any) => ({ id: String(r.id), nombre: r.nombre || r.name })));
  }, [ramosHook]);

  // Buscador de clientes (debounce)
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

  const prevStep = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);
  const nextStep = useCallback(() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1)), [steps.length]);

  // Dropzone inline (igual a individual)
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles?.length) return;
    const file = acceptedFiles[0];
    setPdfFile(file);
    setPdfProcessing(true);
    setPdfProgress(5);
    await testPdfJs();
    // Simular progreso
    let p = 5;
    const interval = setInterval(() => {
      p = Math.min(95, p + 10);
      setPdfProgress(p);
    }, 250);
    // Simulación de extracción
    setTimeout(() => {
      clearInterval(interval);
      setPdfProgress(100);
      setPdfProcessing(false);
      // Datos simulados; reemplazar con parser real
      const data = {
        numero_poliza: 'AUTO-12345',
        aseguradora: 'Seguros Demo',
        ramo_principal: 'Colectiva Vida',
        fecha_inicio: '2025-01-01',
        fecha_fin: '2025-12-31',
        prima_neta: 1200000,
      } as any;
      if (data.numero_poliza) setNumeroPoliza(data.numero_poliza);
      if (data.aseguradora) setAseguradora(data.aseguradora);
      if (data.ramo_principal) setRamo(data.ramo_principal);
      if (data.fecha_inicio) setFechaInicio(data.fecha_inicio);
      if (data.fecha_fin) setFechaFin(data.fecha_fin);
      if (data.prima_neta) setPrimaNeta(String(data.prima_neta));
    }, 2500);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const validate = () => {
    if (!numeroPoliza.trim()) return 'El número de póliza es obligatorio';
    if (!estadoPoliza) return 'El estado de la póliza es obligatorio';
    if (!renovable) return 'Debes elegir si es renovable';
    if (!aseguradora.trim()) return 'La aseguradora es obligatoria';
    if (!ramo.trim()) return 'El ramo es obligatorio';
    if (!fechaInicio) return 'La fecha de inicio es obligatoria';
    if (!fechaFin) return 'La fecha de fin es obligatoria';
    if (!primaNeta || isNaN(Number(primaNeta))) return 'Prima neta obligatoria y numérica';
    if (!selectedClient?.id) return 'El cliente es obligatorio';
    if (!porcentajeIvaPrima || isNaN(Number(porcentajeIvaPrima))) return 'El % IVA de Prima es obligatorio y numérico';
    if (!participacion || isNaN(Number(participacion))) return 'La participación es obligatoria y numérica';
    if (new Date(fechaFin) <= new Date(fechaInicio)) return 'La fecha de fin debe ser posterior a la de inicio';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      // Mapeo hacia CreatePolizaInput del servicio existente
      const payload: any = {
        numero_poliza: numeroPoliza,
        aseguradora,
        ramo_principal: ramo,
        fecha_expedicion: fechaExpedicion || fechaInicio, // opcional
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        prima_neta: Number(primaNeta),
        cliente_id: selectedClient?.id,
        // Opcionales
        valor_riesgo_asegurado: valorAsegurado ? Number(valorAsegurado) : undefined,
        porcentaje_iva: porcentajeIvaPrima ? Number(porcentajeIvaPrima) : undefined,
        total: total ? Number(total) : undefined,
        porcentaje_comision: porcentajeComision ? Number(porcentajeComision) : undefined,
        comision_agencia: comisionAgencia ? Number(comisionAgencia) : undefined,
        // Extensiones
        fecha_recepcion: fechaRecepcion || undefined,
        renovable: renovable === 'si',
        pri_a_pre: priAPre ? Number(priAPre) : undefined,
        participacion: participacion ? Number(participacion) : undefined,
        co_corretaje: coCorretaje ? 1 : 0,
        // Pagos
        periodicidad_pago: periodicidadPago || undefined,
        forma_pago: formaPago || undefined,
        medio_pago: medioPago || undefined,
        banco: banco || undefined,
        // Metadatos propios de colectiva
        tipo_poliza: 'colectiva',
        observaciones: observaciones || undefined,
      };

      const res = await polizaService.createPoliza(payload);
      if (res.success) {
        navigate('/apps/seguros/polizas');
      } else {
        setErrorMsg(res.message || 'No se pudo crear la póliza.');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error inesperado al crear la póliza.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header como en el individual: título + acciones */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Nueva Póliza</h1>
          <div className="flex gap-2">
            <Button color="gray" onClick={() => navigate('/apps/seguros/polizas')}>
              <Icon icon="solar:arrow-left-bold" className="w-4 h-4 mr-1" /> Volver
            </Button>
            <Button color="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <Icon icon="solar:floppy-disk-bold" className="w-4 h-4 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        {errorMsg && <Alert color="failure" className="mb-3 text-sm">{errorMsg}</Alert>}

        {/* Catálogos y buscador de clientes cargan por hooks/effects superiores */}

        {/* Layout: formulario principal + vista previa PDF (condicional) */}
        <div className={`grid gap-4 ${pdfFile ? 'lg:grid-cols-12' : 'grid-cols-1'} transition-all duration-300`}>
          <div className={pdfFile ? 'lg:col-span-8' : 'col-span-12'}>
            {/* Stepper dentro de contenedor blanco */}
            <CardBox className="mb-4">
              <Stepper currentStep={currentStep} steps={steps} onStepClick={setCurrentStep} />
            </CardBox>

            {/* Sección de Importación de PDF - Plegable (igual a individual) */}
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
            {currentStep === 0 && (
              <CardBox className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField id="numeroPoliza" name="numeroPoliza" label="Número de póliza" value={numeroPoliza} onChange={(e) => setNumeroPoliza(e.target.value)} required />
                  <FormField id="estadoPoliza" name="estadoPoliza" label="Estado Póliza" type="select" value={estadoPoliza} onChange={(e) => setEstadoPoliza(e.target.value as any)} required options={[
                    { value: '', label: 'Selecciona...' },
                    { value: 'ACTIVA', label: 'Activa' },
                    { value: 'VENCIDA', label: 'Vencida' },
                    { value: 'CANCELADA', label: 'Cancelada' },
                    { value: 'SUSPENDIDA', label: 'Suspendida' },
                  ]} />
                  <FormField id="renovable" name="renovable" label="Es renovable" type="select" value={renovable} onChange={(e) => setRenovable(e.target.value as any)} required options={[
                    { value: '', label: 'Selecciona...' },
                    { value: 'si', label: 'Sí' },
                    { value: 'no', label: 'No' },
                  ]} />
                  <FormField
                    id="aseguradora"
                    name="aseguradora"
                    label="Aseguradora"
                    type="select"
                    value={aseguradora}
                    onChange={(e) => setAseguradora(e.target.value)}
                    required
                    options={[{ value: '', label: 'Selecciona...' }, ...aseguradoras.map(a => ({ value: a.nombre, label: a.nombre }))]}
                  />
                  <FormField
                    id="ramo"
                    name="ramo"
                    label="Ramo"
                    type="select"
                    value={ramo}
                    onChange={(e) => setRamo(e.target.value)}
                    required
                    options={[{ value: '', label: 'Selecciona...' }, ...ramos.map(r => ({ value: r.nombre, label: r.nombre }))]}
                  />
                  <FormField id="fechaExpedicion" name="fechaExpedicion" label="Fecha de Expedición" type="date" value={fechaExpedicion} onChange={(e) => setFechaExpedicion(e.target.value)} />
                  <FormField id="fechaRecepcion" name="fechaRecepcion" label="Fecha de Recepción" type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
                  <FormField id="fechaInicio" name="fechaInicio" label="Fecha de Inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
                  <FormField id="fechaFin" name="fechaFin" label="Fecha de Fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
                  <FormField id="valorAsegurado" name="valorAsegurado" label="Valor asegurado" type="number" value={valorAsegurado} onChange={(e) => setValorAsegurado(e.target.value)} required />
                  <FormField id="tipoMoneda" name="tipoMoneda" label="Tipo moneda" value={tipoMoneda} onChange={(e) => setTipoMoneda(e.target.value)} />
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">Buscar y seleccionar cliente <span className="text-red-500">*</span></Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nombre, documento, teléfono o email"
                          value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                          onChange={(e) => { setSelectedClient(null); setClientQuery(e.target.value); }}
                          className={`flex-1`}
                          required
                        />
                        <Button type="button" color="primary" onClick={() => { setClientModalMode('new'); setClienteToEdit(null); setShowClientModal(true); }}>
                          <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-1" /> Nuevo
                        </Button>
                        {selectedClient && (
                          <Button type="button" color="light" onClick={() => {
                            setClientModalMode('edit');
                            setClienteToEdit({ id: selectedClient.id, ...(selectedClient.raw || {}) });
                            setShowClientModal(true);
                          }}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4 mr-1" /> Editar
                          </Button>
                        )}
                      </div>
                      {/* Dropdown resultados */}
                      {(!selectedClient && (clientQuery.length >= 2 || clientLoading)) && (
                        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-auto">
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
                  {/* Resumen de cliente seleccionado */}
                  {selectedClient && (
                    <div className="md:col-span-2 mt-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-800/40 text-sm">
                      <div className="font-medium">Cliente seleccionado</div>
                      <div>{selectedClient.nombre}</div>
                      <div className="text-gray-500">{selectedClient.documento || '-'} {selectedClient.celular ? `• ${selectedClient.celular}` : ''} {selectedClient.email ? `• ${selectedClient.email}` : ''}</div>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <FormField id="categorias" name="categorias" label="Categorías (múltiple)" value={categorias.join(', ')} onChange={(e) => setCategorias(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Escribe categorías separadas por coma" />
                  </div>
                </div>
              </CardBox>
            )}

            {currentStep === 1 && (
              <CardBox className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField id="nombreTomador" name="nombreTomador" label="Nombre Tomador" value={nombreTomador} onChange={(e) => setNombreTomador(e.target.value)} required />
                  <FormField id="tipoDocTomador" name="tipoDocTomador" label="Tipo Documento" type="select" value={tipoDocTomador} onChange={(e) => setTipoDocTomador(e.target.value)} required options={[
                    { value: 'CC', label: 'CC' },
                    { value: 'NIT', label: 'NIT' },
                    { value: 'CE', label: 'CE' },
                    { value: 'PAS', label: 'PAS' },
                  ]} />
                  <FormField id="docTomador" name="docTomador" label="Documento Tomador" value={docTomador} onChange={(e) => setDocTomador(e.target.value)} required />
                </div>
              </CardBox>
            )}

            {currentStep === 2 && (
              <CardBox className="mb-4">
                <FormField id="observaciones" name="observaciones" label="Observaciones" type="textarea" rows={4} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones (opcional)" />
              </CardBox>
            )}

            {currentStep === 3 && (
              <CardBox className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField id="primaNeta" name="primaNeta" label="Prima neta" type="number" value={primaNeta} onChange={(e) => setPrimaNeta(e.target.value)} />
                  <FormField id="priAPre" name="priAPre" label="Pri a Pre" type="number" value={priAPre} onChange={(e) => setPriAPre(e.target.value)} />
                  <FormField id="participacion" name="participacion" label="Participación" type="number" value={participacion} onChange={(e) => setParticipacion(e.target.value)} required />
                  <div className="flex items-center gap-2">
                    <Checkbox id="coCorretaje" checked={coCorretaje} onCheckedChange={(v: any) => setCoCorretaje(Boolean(v))} />
                    <Label htmlFor="coCorretaje">Co-corretaje</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="ivaCheck" checked={ivaCheck} onCheckedChange={(v: any) => setIvaCheck(Boolean(v))} />
                    <Label htmlFor="ivaCheck">IVA</Label>
                  </div>
                  <FormField id="porcentajeIvaPrima" name="porcentajeIvaPrima" label="% IVA Prima" type="number" value={porcentajeIvaPrima} onChange={(e) => setPorcentajeIvaPrima(e.target.value)} required />
                  <FormField id="porcentajeComision" name="porcentajeComision" label="Porcentaje comisión" type="number" value={porcentajeComision} onChange={(e) => setPorcentajeComision(e.target.value)} />
                  <FormField id="comisionAgencia" name="comisionAgencia" label="Comisión agencia" type="number" value={comisionAgencia} onChange={(e) => setComisionAgencia(e.target.value)} />
                  <FormField id="total" name="total" label="Total" type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
                </div>
              </CardBox>
            )}

            {currentStep === 4 && (
              <CardBox className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField id="periodicidadPago" name="periodicidadPago" label="Periodicidad del pago" type="select" value={periodicidadPago} onChange={(e) => setPeriodicidadPago(e.target.value)} required options={[
                    { value: '', label: 'Selecciona...' },
                    { value: 'mensual', label: 'Mensual' },
                    { value: 'trimestral', label: 'Trimestral' },
                    { value: 'semestral', label: 'Semestral' },
                    { value: 'anual', label: 'Anual' },
                  ]} />
                  <FormField id="formaPago" name="formaPago" label="Forma Pago" type="select" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} required options={[
                    { value: '', label: 'Selecciona...' },
                    { value: 'efectivo', label: 'Efectivo' },
                    { value: 'transferencia', label: 'Transferencia' },
                    { value: 'cheque', label: 'Cheque' },
                    { value: 'tarjeta', label: 'Tarjeta' },
                    { value: 'financiacion', label: 'Financiación' },
                  ]} />
                  <FormField id="medioPago" name="medioPago" label="Medio Pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} />
                  <FormField id="banco" name="banco" label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
                </div>
              </CardBox>
            )}

            {/* Botones de Navegación - igual a individual */}
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
                    type="button"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px]"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:diskette-bold" className="w-4 h-4" />
                        <span>Crear Póliza</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha: Vista previa PDF (solo cuando hay archivo) */}
          {pdfFile && (
            <div className="lg:col-span-4">
              <PdfPreview file={pdfFile} processing={pdfProcessing} progress={pdfProgress} onRemove={() => { setPdfFile(null); setPdfProcessing(false); setPdfProgress(0); }} />
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
                  }
                }}
              />
            </div>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default NuevaPolizaColectiva;

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Alert, Spinner, Modal, Textarea, Progress, Badge } from 'flowbite-react';
import { useDropzone } from 'react-dropzone';
import { testPdfJs } from 'src/utils/pdfSetup';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import FormField from 'src/components/shared/FormField';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { polizaService } from 'src/services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import saasApi from 'src/services/saasApi';
import { useAseguradoras, useRamos, useVendedores, useSedes } from 'src/hooks/useAdminCrudApi';
import NuevoCliente from 'src/views/apps/seguros/clientes/NuevoCliente';

const NuevaPolizaColectiva: React.FC = () => {
  const navigate = useNavigate();

  // ===== Estado del formulario =====
  const [numeroPoliza, setNumeroPoliza] = useState('');
  const [estadoPoliza, setEstadoPoliza] = useState<string>('ACTIVA');
  const [renovable, setRenovable] = useState<'si' | 'no' | ''>('');
  const [aseguradora, setAseguradora] = useState('');
  const [ramo, setRamo] = useState('');
  const [aseguradoras, setAseguradoras] = useState<{ id: string; nombre: string }[]>([]);
  const [ramos, setRamos] = useState<{ id: string; nombre: string; subramo: string[]; comisiones_aseguradoras: { aseguradora_id: string; aseguradora_nombre?: string; porcentaje_iva: number; porcentaje_comision: number; pri_a_pre_por_defecto: number }[] }[]>([]);
  const [subramo, setSubramo] = useState('');
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [fechaExpedicion, setFechaExpedicion] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [valorAsegurado, setValorAsegurado] = useState('');
  const [oficinaRadicacion, setOficinaRadicacion] = useState('');
  const [ciudadExpedicion, setCiudadExpedicion] = useState('');
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [sede, setSede] = useState('');

  // Tomador (responsable del pago - empresa o persona)
  const [nombreTomador, setNombreTomador] = useState('');
  const [tipoDocTomador, setTipoDocTomador] = useState('NIT');
  const [docTomador, setDocTomador] = useState('');
  const [telefonoTomador, setTelefonoTomador] = useState('');
  const [direccionTomador, setDireccionTomador] = useState('');
  const [ciudadTomador, setCiudadTomador] = useState('');
  const [correoTomador, setCorreoTomador] = useState('');

  // Cliente: buscador y selección
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id?: string; nombre?: string; documento?: string; celular?: string; email?: string; raw?: any } | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'new' | 'edit'>('new');
  const [clienteToEdit, setClienteToEdit] = useState<any | null>(null);

  const [observaciones, setObservaciones] = useState('');
  const [observacionesInternas, setObservacionesInternas] = useState('');

  // Prima y comisiones
  const [primaNeta, setPrimaNeta] = useState('');
  const [priAPre, setPriAPre] = useState('');
  const [participacion, setParticipacion] = useState('');
  const [coCorretaje, setCoCorretaje] = useState(false);
  const [porcentajeIva, setPorcentajeIva] = useState('19');
  const [iva, setIva] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState('');
  const [comisionAgencia, setComisionAgencia] = useState('');
  const [total, setTotal] = useState('');

  // Pagos
  const [periodicidadPago, setPeriodicidadPago] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [medioPago, setMedioPago] = useState('');
  const [banco, setBanco] = useState('');

  // Riesgo y Placas (vehículos)
  const [riesgo, setRiesgo] = useState('');
  const [placas, setPlacas] = useState<string[]>([]);
  const [placaInput, setPlacaInput] = useState('');
  const [placaSuggestions, setPlacaSuggestions] = useState<Array<{ id: number; placa: string; client_name?: string; poliza_id?: number }>>([]);
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // PDF reader state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [pdfConfidence, setPdfConfidence] = useState<any>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const { toast } = useToast();


  // Catálogos
  const { aseguradoras: asegHook } = useAseguradoras();
  const { ramos: ramosHook } = useRamos();
  const { vendedores: vendedoresHook } = useVendedores();
  const { sedes: sedesHook } = useSedes();

  useEffect(() => {
    const aseguradorasBase = (asegHook || []).map((a: any) => ({ id: String(a.id), nombre: a.nombre || a.name }));
    
    // Agregar aseguradoras solicitadas si no existen
    const aseguradorasAdicionales = ['Finesa', 'Crediseguros', 'Sura', 'Crediestado', 'Previseguro'];
    const existentes = new Set(aseguradorasBase.map(a => a.nombre.toLowerCase()));
    
    // Verificar si existen variaciones similares
    const adicionales = aseguradorasAdicionales
      .filter(nombre => {
        const nombreLower = nombre.toLowerCase();
        const existeExacto = existentes.has(nombreLower);
        
        // Verificar si existe una variación que contenga el nombre
        const existeVariacion = aseguradorasBase.some(a => 
          a.nombre.toLowerCase().includes(nombreLower) || 
          nombreLower.includes(a.nombre.toLowerCase())
        );
        
        return !existeExacto && !existeVariacion;
      })
      .map((nombre, index) => ({
        id: `custom-${index + 1}`,
        nombre
      }));
    
    setAseguradoras([...aseguradorasBase, ...adicionales]);
  }, [asegHook]);
  useEffect(() => { setRamos((ramosHook || []).map((r: any) => ({
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
  }))); }, [ramosHook]);
  useEffect(() => { setVendedores((vendedoresHook || []).map((u: any) => ({ id: String(u.id), nombre: u.nombres || u.nombre || u.name }))); }, [vendedoresHook]);
  useEffect(() => { setSedes((sedesHook || []).map((s: any) => ({ id: String(s.id), nombre: s.nombre || s.name }))); }, [sedesHook]);

  // Buscador de clientes (debounce)
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) { setClientResults([]); return; }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : (resp.data?.data || []);
        const normalized = arr.map((c: any) => {
          const tipo = c.tipo;
          const nombre = tipo === 'EMPRESA' ? (c.empresa?.razon_social || c.empresa?.nombre_comercial || 'Empresa') : `${c.persona?.nombres || c.nombre || ''} ${c.persona?.apellidos || c.apellidos || ''}`.trim();
          const documento = tipo === 'EMPRESA' ? c.empresa?.nit : c.persona?.documento || c.cuit;
          return { id: String(c.id), nombre, documento, celular: c.celular || c.celular_principal, email: c.email || c.email_principal, raw: c };
        });
        setClientResults(normalized);
      } catch { setClientResults([]); } finally { setClientLoading(false); }
    }, 300);
    return () => clearTimeout(handler);
  }, [clientQuery]);

  // Auto-calcular IVA y total
  useEffect(() => {
    const pn = parseFloat(primaNeta) || 0;
    const pctIva = parseFloat(porcentajeIva) || 0;
    const ivaCalc = (pn * pctIva) / 100;
    setIva(ivaCalc.toFixed(2));
    setTotal((pn + ivaCalc).toFixed(2));
  }, [primaNeta, porcentajeIva]);

  const clearStepError = useCallback((field: string) => {
    setStepErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);


  // Placas helpers
  const normalizePlate = useCallback((s: string): string => {
    return (s || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  }, []);

  const isVehicleRamo = useCallback((value: string): boolean => {
    const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('auto')
      || normalized.includes('soat')
      || normalized.includes('moto')
      || normalized.includes('motocicleta')
      || normalized.includes('motocarro')
      || normalized.includes('vehiculo');
  }, []);

  const addPlate = useCallback((raw: string) => {
    const value = normalizePlate(raw);
    if (!value) return;
    if (!/^[A-Z0-9-]{3,20}$/.test(value)) {
      setPlacaError('Formato inválido. Use letras/números, 3-20 caracteres.');
      return;
    }
    setPlacas(prev => prev.includes(value) ? prev : [...prev, value]);
    setPlacaInput('');
    setPlacaSuggestions([]);
    setPlacaError('');
  }, [normalizePlate]);

  const createAndAddPlate = useCallback(async (raw: string) => {
    const value = normalizePlate(raw);
    if (!value) return;
    try {
      const clientId = selectedClient?.id ? Number(selectedClient.id) : undefined;
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
    if (!v || v.length < 2) { setPlacaSuggestions([]); setPlacaLoading(false); return; }
    let aborted = false;
    setPlacaLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await saasApi.getAutomoviles({ search: v, per_page: 5 });
        const payload: any = res.data || {};
        const data = Array.isArray(payload) ? payload : (payload.data || []);
        if (!aborted) {
          setPlacaSuggestions(data.map((a: any) => ({ id: Number(a.id || 0), placa: String(a.placa || ''), client_name: a.client_name, poliza_id: a.poliza_id })));
        }
      } finally { if (!aborted) setPlacaLoading(false); }
    }, 250);
    return () => { aborted = true; clearTimeout(t); };
  }, [placaInput, normalizePlate]);

  const isAutoRamo = isVehicleRamo(String(ramo || ''));

  // PDF functionality
  useEffect(() => { testPdfJs(); }, []);

  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPdfUrl(null);
    }
  }, [pdfFile]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      processPdfFile(file);
    }
  }, [aseguradoras, ramos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const processPdfFile = async (file: File) => {
    setPdfProcessing(true);
    setProcessingProgress(0);
    try {
      const { processPdf } = await import('src/services/advancedPdfProcessor');
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 5, 85));
      }, 300);
      const result = await processPdf(file);
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setPdfConfidence(result.confidence);

      // Map extracted data — backend already matched against real catalogs
      if (result.numeroPoliza) setNumeroPoliza(result.numeroPoliza);

      // Aseguradora: use backend-matched name first, then local fuzzy match
      const matchedAseg = result.aseguradora_nombre || result.aseguradora;
      if (matchedAseg) {
        const src = matchedAseg.toLowerCase();
        const exact = aseguradoras.find(a => a.nombre === matchedAseg)
          || aseguradoras.find(a => a.nombre.toLowerCase() === src)
          || aseguradoras.find(a => src.includes(a.nombre.toLowerCase()))
          || aseguradoras.find(a => a.nombre.toLowerCase().includes(src));
        if (exact) setAseguradora(exact.nombre);
      }

      // Ramo: use backend-matched name first, then local fuzzy match
      const matchedRamo = result.ramo_nombre || result.ramo;
      if (matchedRamo) {
        const src = matchedRamo.toLowerCase();
        const exact = ramos.find(r => r.nombre === matchedRamo)
          || ramos.find(r => r.nombre.toLowerCase() === src)
          || ramos.find(r => src.includes(r.nombre.toLowerCase()))
          || ramos.find(r => r.nombre.toLowerCase().includes(src));
        if (exact) setRamo(exact.nombre);
      }

      // Vendedor: use backend-matched vendedor
      if (result.vendedor_id) {
        const vMatch = vendedores.find(v => String(v.id) === String(result.vendedor_id));
        if (vMatch) setSelectedVendedorId(String(vMatch.id));
      }

      // Fechas
      if (result.fechaExpedicion) setFechaExpedicion(result.fechaExpedicion);
      if (result.fechaInicio) setFechaInicio(result.fechaInicio);
      if (result.fechaFin) setFechaFin(result.fechaFin);
      if (result.fechaRecepcion) setFechaRecepcion(result.fechaRecepcion);

      // Financiero
      if (result.primaNeta) setPrimaNeta(result.primaNeta);
      if (result.iva) setIva(result.iva);
      if (result.total) setTotal(result.total);
      if (result.riesgo) setRiesgo(result.riesgo);
      if (result.valorAsegurado) setValorAsegurado(result.valorAsegurado);

      // Tomador
      if (result.tomadorNombre) setNombreTomador(result.tomadorNombre);
      if (result.tomadorDocumento) setDocTomador(result.tomadorDocumento);
      if (result.tipoDocTomador) setTipoDocTomador(result.tipoDocTomador);
      if (result.tomadorTelefono) setTelefonoTomador(result.tomadorTelefono);
      if (result.tomadorEmail) setCorreoTomador(result.tomadorEmail);
      if (result.tomadorDireccion) setDireccionTomador(result.tomadorDireccion);
      if (result.tomadorCiudad) setCiudadTomador(result.tomadorCiudad);

      // Oficina/Ciudad
      if (result.oficina) setOficinaRadicacion(result.oficina);
      if (result.ciudad) setCiudadExpedicion(result.ciudad);

      // Client auto-find from backend
      if (result.clienteEncontrado) {
        setSelectedClient({
          id: result.clienteEncontrado.id,
          nombre: result.clienteEncontrado.nombre,
          documento: result.clienteEncontrado.documento,
          celular: result.clienteEncontrado.telefono || '',
          email: result.clienteEncontrado.email || '',
          raw: null
        });
      }

      const overallConfidence = result.confidence.overall;
      const highlights: string[] = [];
      if (result.numeroPoliza) highlights.push('número de póliza');
      if (result.aseguradora) highlights.push('aseguradora');
      if (result.ramo) highlights.push('ramo');
      if (result.clienteEncontrado) highlights.push('cliente encontrado');
      const desc = `${overallConfidence.toFixed(0)}% confianza${highlights.length > 0 ? `. Extraído: ${highlights.join(', ')}` : ''}`;
      toast({ title: overallConfidence >= 80 ? '🎯 Extracción exitosa' : '⚠️ Extracción completada', description: desc });
    } catch (error) {
      toast({ title: 'Error al procesar PDF', description: 'No se pudo extraer datos del PDF', variant: 'destructive' as any });
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

  const colombianBanks = ['Bancolombia','Banco de Bogotá','BBVA Colombia','Davivienda','Itaú Colombia','Scotiabank Colpatria','Banco de Occidente','Banco Popular','Banco AV Villas','Banco Caja Social','Banco Agrario','Banco Falabella','Banco Finandina','Banco Pichincha','Banco GNB Sudameris','Banco W','Banco Serfinanza','Lulo Bank','Nu Colombia','Coopcentral','Bancoomeva'];

  const canSave = useCallback((): boolean => {
    if (!numeroPoliza?.trim() || numeroPoliza.trim().length < 3) return false;
    if (!aseguradora?.trim()) return false;
    if (!ramo?.trim()) return false;
    if (!selectedClient?.id) return false;
    if (!fechaInicio) return false;
    if (!fechaFin) return false;
    if (!primaNeta || isNaN(Number(primaNeta)) || parseFloat(primaNeta) < 0) return false;
    return true;
  }, [numeroPoliza, aseguradora, ramo, selectedClient, fechaInicio, fechaFin, primaNeta]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!numeroPoliza.trim()) errs.numeroPoliza = 'El número de póliza es obligatorio';
    if (!aseguradora.trim()) errs.aseguradora = 'La aseguradora es obligatoria';
    if (!ramo.trim()) errs.ramo = 'El ramo es obligatorio';
    if (!selectedClient?.id) errs.cliente = 'Debe seleccionar un cliente';
    if (!fechaExpedicion) errs.fechaExpedicion = 'La fecha de expedición es obligatoria';
    if (!fechaInicio) errs.fechaInicio = 'La fecha de inicio es obligatoria';
    if (!fechaFin) errs.fechaFin = 'La fecha de fin es obligatoria';
    if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) errs.fechaFin = 'Debe ser posterior al inicio';
    if (!primaNeta || isNaN(Number(primaNeta))) errs.primaNeta = 'Prima neta obligatoria y numérica';
    setStepErrors(errs);
    const keys = Object.keys(errs);
    return keys.length > 0 ? errs[keys[0]] : null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const vendedor = vendedores.find(v => v.id === selectedVendedorId);
      const payload: any = {
        // Identificación
        numero_poliza: numeroPoliza,
        aseguradora,
        ramo_principal: ramo,
        subramo: subramo || undefined,
        ramo_id: (() => { const r = ramos.find(x => x.nombre === ramo); return r ? parseInt(r.id) : undefined; })(),
        aseguradora_id: (() => { const a = aseguradoras.find(x => x.nombre === aseguradora); return a ? parseInt(a.id) : undefined; })(),
        policy_category: 'colectiva',
        estado: estadoPoliza || 'ACTIVA',
        renovable: renovable === 'si',
        cliente_id: selectedClient?.id,

        // Fechas
        fecha_expedicion: fechaExpedicion,
        fecha_recepcion: fechaRecepcion || undefined,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,

        // Asesor / Oficina
        vendedor: vendedor?.nombre || undefined,
        vendedor_id: selectedVendedorId ? Number(selectedVendedorId) : undefined,
        sede: sede || undefined,
        oficina_radicacion: oficinaRadicacion || undefined,
        ciudad_expedicion: ciudadExpedicion || undefined,

        // Tomador
        policy_holder_name: nombreTomador || undefined,
        policy_holder_document: docTomador || undefined,
        policy_holder_doc_type: tipoDocTomador || undefined,
        policy_holder_phone: telefonoTomador || undefined,
        policy_holder_email: correoTomador || undefined,
        policy_holder_address: direccionTomador || undefined,
        policy_holder_city: ciudadTomador || undefined,

        // Riesgo
        riesgo: riesgo || undefined,
        valor_riesgo_asegurado: valorAsegurado ? Number(valorAsegurado) : undefined,
        ...(isAutoRamo && placas.length > 0 ? { placas } : {}),

        // Prima y comisiones
        prima_neta: Number(primaNeta),
        porcentaje_iva: porcentajeIva ? Number(porcentajeIva) : undefined,
        iva: iva ? Number(iva) : undefined,
        total: total ? Number(total) : undefined,
        pri_a_pre: priAPre ? Number(priAPre) : undefined,
        participacion: participacion ? Number(participacion) : undefined,
        co_corretaje: coCorretaje ? 1 : 0,
        porcentaje_comision: porcentajeComision ? Number(porcentajeComision) : undefined,
        comision_agencia: comisionAgencia ? Number(comisionAgencia) : undefined,

        // Pagos
        periodicidad_pago: periodicidadPago || undefined,
        forma_pago: formaPago || undefined,
        medio_pago: medioPago || undefined,
        banco: banco || undefined,

        // Observaciones
        observaciones: observaciones || undefined,
        observaciones_internas: observacionesInternas || undefined,
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

  // Render: Client search inline component
  const renderClientSearch = () => (
    <div className="md:col-span-2">
      <div className="relative">
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-1 block">Buscar y seleccionar cliente (tomador)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Razón social, NIT, nombre o email"
            value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
            onChange={(e) => { setSelectedClient(null); setClientQuery(e.target.value); }}
            className="flex-1"
          />
          <Button type="button" color="primary" onClick={() => { setClientModalMode('new'); setClienteToEdit(null); setShowClientModal(true); }}>
            <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-1" /> Nuevo
          </Button>
          {selectedClient && (
            <Button type="button" color="light" onClick={() => { setClientModalMode('edit'); setClienteToEdit({ id: selectedClient.id, ...(selectedClient.raw || {}) }); setShowClientModal(true); }}>
              <Icon icon="solar:pen-bold" className="w-4 h-4 mr-1" /> Editar
            </Button>
          )}
        </div>
        {(!selectedClient && (clientQuery.length >= 2 || clientLoading)) && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-auto">
            {clientLoading ? (
              <div className="p-3 text-sm text-gray-500">Buscando clientes...</div>
            ) : clientResults.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Sin resultados</div>
            ) : (
              clientResults.map((c) => (
                <div key={c.id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => { setSelectedClient(c); setClientQuery(''); }}>
                  <div className="text-sm font-medium">{c.nombre}</div>
                  <div className="text-xs text-gray-500">{c.documento || ''} {c.celular ? `• ${c.celular}` : ''} {c.email ? `• ${c.email}` : ''}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {selectedClient && (
        <div className="mt-2 p-3 border rounded-md bg-blue-50 dark:bg-gray-800/40 text-sm">
          <div className="font-medium text-blue-900 dark:text-blue-200">{selectedClient.nombre}</div>
          <div className="text-blue-700 dark:text-blue-300 text-xs">{selectedClient.documento || '-'} {selectedClient.celular ? `• ${selectedClient.celular}` : ''} {selectedClient.email ? `• ${selectedClient.email}` : ''}</div>
        </div>
      )}
    </div>
  );

  // Section header helper matching NuevaPoliza style
  const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
      <Icon icon={icon} className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">{title}</h3>
    </div>
  );

  return (
    <>
      {/* PDF Processing Banner */}
      {pdfFile && pdfProcessing && (
        <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse">
          <div className="flex items-center gap-3">
            <Spinner size="md" color="info" />
            <div className="flex-1">
              <p className="font-medium text-sm text-blue-800 dark:text-blue-200">Leyendo PDF con Inteligencia Artificial...</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Los campos del formulario se llenarán automáticamente</p>
              <div className="mt-2"><Progress progress={processingProgress} color="blue" size="sm" /></div>
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
                <p className="text-xs text-green-600 dark:text-green-400">Confianza: {pdfConfidence.overall?.toFixed(0) || 0}% — Revisa los campos y guarda la póliza</p>
              </div>
            </div>
            <button onClick={removePdf} className="text-green-600 hover:text-red-500 transition-colors"><Icon icon="solar:close-circle-bold" className="w-4 h-4" /></button>
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

      {errorMsg && <Alert color="failure" className="mb-3 text-sm">{errorMsg}</Alert>}

      {/* Main two-column layout (matching NuevaPoliza) */}
      <div className="grid gap-4 xl:grid-cols-2">

      {/* ==================== LEFT COLUMN ==================== */}
      <div className="space-y-4">

        {/* === INFORMACIÓN PRINCIPAL === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Información de la Póliza Colectiva" icon="solar:document-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="numeroPoliza" name="numeroPoliza" label="Número Póliza *" value={numeroPoliza} onChange={(e) => { setNumeroPoliza(e.target.value); clearStepError('numeroPoliza'); }} placeholder="POL-2024-XXX" error={stepErrors.numeroPoliza} />

            <FormField id="estadoPoliza" name="estadoPoliza" label="Estado" type="select" value={estadoPoliza} onChange={(e) => setEstadoPoliza(e.target.value)} options={[
              { value: 'ACTIVA', label: 'Vigente' }, { value: 'VENCIDA', label: 'Vencida' }, { value: 'CANCELADA', label: 'Cancelada' }, { value: 'SUSPENDIDA', label: 'Suspendida' }, { value: 'COTIZACION', label: 'Cotización' }, { value: 'EXPEDICION', label: 'Expedición' },
            ]} />

            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-1.5 text-xs">
                <button type="button" onClick={() => setRenovable(renovable === 'si' ? 'no' : 'si')} className={`inline-flex h-5 w-9 items-center rounded-full transition ${renovable === 'si' ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`size-3.5 translate-x-0.5 rounded-full bg-white transition ${renovable === 'si' ? 'translate-x-4' : ''}`} />
                </button>
                Renovable
              </label>
            </div>

            <FormField id="aseguradora" name="aseguradora" label="Aseguradora *" type="select" value={aseguradora} onChange={(e) => { setAseguradora(e.target.value); setRamo(''); setSubramo(''); clearStepError('aseguradora'); }} error={stepErrors.aseguradora}
              options={[{ value: '', label: 'Seleccionar' }, ...aseguradoras.map(a => ({ value: a.nombre, label: a.nombre }))]} />

            <FormField id="ramo" name="ramo" label="Ramo *" type="select" value={ramo} onChange={(e) => {
              const newRamo = e.target.value;
              setRamo(newRamo); setSubramo(''); clearStepError('ramo');
              if (aseguradora && newRamo) {
                const ramoObj = ramos.find(r => r.nombre === newRamo);
                const selAseg = aseguradoras.find(a => a.nombre === aseguradora);
                if (ramoObj && selAseg) {
                  const comConfig = ramoObj.comisiones_aseguradoras.find(c => c.aseguradora_id === selAseg.id);
                  if (comConfig) {
                    if (comConfig.porcentaje_comision) setPorcentajeComision(String(comConfig.porcentaje_comision));
                    if (comConfig.porcentaje_iva) setPorcentajeIva(String(comConfig.porcentaje_iva));
                    if (comConfig.pri_a_pre_por_defecto) setPriAPre(String(comConfig.pri_a_pre_por_defecto));
                  }
                }
              }
            }} error={stepErrors.ramo}
              options={[{ value: '', label: 'Seleccionar' }, ...ramos.map(r => ({ value: r.nombre, label: r.nombre }))]} />

            {(() => {
              const selRamo = ramos.find(r => r.nombre === ramo);
              const subs = selRamo && Array.isArray(selRamo.subramo) ? selRamo.subramo : [];
              return <FormField id="subramo" name="subramo" label="Subramo" value={subramo} onChange={(e) => setSubramo(e.target.value)} type="select" options={[{ value: '', label: 'Seleccionar subramo' }, ...subs.map(s => ({ value: s, label: s }))]} />;
            })()}

            <FormField id="sede" name="sede" label="Sede" type="select" value={sede} onChange={(e) => setSede(e.target.value)} options={[{ value: '', label: 'Seleccionar' }, ...sedes.map(s => ({ value: s.nombre, label: s.nombre }))]} />

            {/* Riesgo */}
            <FormField id="riesgo" name="riesgo" label="Riesgo Asegurado" value={riesgo} onChange={(e) => setRiesgo(e.target.value)} placeholder="Descripción del riesgo" className="col-span-2" />
            <FormField id="valorAsegurado" name="valorAsegurado" label="Valor Riesgo" type="number" value={valorAsegurado} onChange={(e) => setValorAsegurado(e.target.value)} placeholder="$0" />

            {/* Placas (visible si ramo automotor) */}
            {isAutoRamo && (
              <div className="col-span-full z-[100]">
                <Label htmlFor="placa_input" className="text-xs font-medium text-gray-900 dark:text-white">Placas</Label>
                <div className="mt-1 relative">
                  <div className="flex gap-1">
                    <Input id="placa_input" placeholder="ABC123" value={placaInput}
                      onChange={(e) => setPlacaInput((e.target.value || '').toUpperCase())}
                      onKeyDown={async (e: any) => { if (e.key === 'Enter') { e.preventDefault(); const v = normalizePlate(placaInput); if (!v) return; placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v) ? addPlate(v) : await createAndAddPlate(v); }}}
                      className={`flex-1 ${placaError ? 'border-red-500' : ''}`} />
                    <Button type="button" color="light" size="xs" onClick={async () => { const v = normalizePlate(placaInput); if (!v) return; placaSuggestions.some(s => String(s.placa || '').toUpperCase() === v) ? addPlate(v) : await createAndAddPlate(v); }}>+</Button>
                  </div>
                  {placaInput && (
                    <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-40 overflow-auto">
                      {placaLoading ? <div className="p-2 text-xs text-gray-500">Buscando...</div> : placaSuggestions.length > 0 ? placaSuggestions.map(s => (
                        <div key={`${s.id}-${s.placa}`} className="p-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between" onClick={() => addPlate(String(s.placa || ''))}>
                          <span className="font-medium">{String(s.placa || '')}</span>
                          <span className="text-gray-400">{s.client_name || ''}</span>
                        </div>
                      )) : <div className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer" onClick={async () => { await createAndAddPlate(placaInput); }}>Crear "{normalizePlate(placaInput)}"</div>}
                    </div>
                  )}
                  {placaError && <p className="text-red-500 text-[10px] mt-0.5">{placaError}</p>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {placas.map((p, idx) => (
                    <span key={`${p}-${idx}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px]">
                      {p}
                      <button type="button" className="text-gray-500 hover:text-red-600 text-xs" onClick={() => setPlacas(prev => prev.filter(x => x !== p))}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === CLIENTE (TOMADOR) === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-visible">
          <SectionHeader title="Cliente (Tomador)" icon="solar:user-bold" />
          <div className="space-y-3 overflow-visible">
            <div className="relative" style={{ zIndex: 1000 }}>
              <Label className="text-xs font-medium text-gray-900 dark:text-white mb-1 block">Buscar cliente</Label>
              <div className="flex gap-1">
                <Input placeholder="Razón social, NIT, nombre o email"
                  value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                  onChange={(e) => { setSelectedClient(null); setClientQuery(e.target.value); }}
                  className={`flex-1 ${stepErrors.cliente ? 'border-red-500' : ''}`} />
                <Button type="button" color="primary" size="xs" onClick={() => { setClientModalMode('new'); setClienteToEdit(null); setShowClientModal(true); }}>
                  <Icon icon="solar:user-plus-bold" className="w-3 h-3" />
                </Button>
                {selectedClient && (
                  <Button type="button" color="light" size="xs" onClick={() => { setClientModalMode('edit'); setClienteToEdit({ id: selectedClient.id, ...(selectedClient.raw || {}) }); setShowClientModal(true); }}>
                    <Icon icon="solar:pen-bold" className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {stepErrors.cliente && <p className="text-[10px] text-red-500 mt-0.5">{stepErrors.cliente}</p>}
              {(!selectedClient && (clientQuery.length >= 2 || clientLoading)) && (
                <div className="absolute left-0 right-0 z-[99999] mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-2xl max-h-48 overflow-auto">
                  {clientLoading ? <div className="p-2 text-xs text-gray-500">Buscando...</div> : clientResults.length === 0 ? <div className="p-2 text-xs text-gray-500">Sin resultados</div> : clientResults.map(c => (
                    <div key={c.id} className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => { setSelectedClient(c); setClientQuery(''); }}>
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
              <FormField id="vendedor" name="vendedor" label="Asesor / Vendedor" type="select" value={selectedVendedorId} onChange={(e) => setSelectedVendedorId(e.target.value)} options={[{ value: '', label: 'Sin asignar' }, ...vendedores.map(v => ({ value: v.id, label: v.nombre }))]} />
              <FormField id="oficinaRadicacion" name="oficinaRadicacion" label="Oficina Radicación" value={oficinaRadicacion} onChange={(e) => setOficinaRadicacion(e.target.value)} placeholder="PROM A-SEGURO" />
            </div>
          </div>
        </div>

        {/* === VIGENCIA === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Vigencia" icon="solar:calendar-bold" />
          <div className="grid grid-cols-3 gap-3">
            <FormField id="fechaExpedicion" name="fechaExpedicion" label="Expedición *" type="date" value={fechaExpedicion} onChange={(e) => { setFechaExpedicion(e.target.value); clearStepError('fechaExpedicion'); }} error={stepErrors.fechaExpedicion} />
            <FormField id="fechaInicio" name="fechaInicio" label="Inicio *" type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); clearStepError('fechaInicio'); }} error={stepErrors.fechaInicio} />
            <FormField id="fechaFin" name="fechaFin" label="Fin *" type="date" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); clearStepError('fechaFin'); }} error={stepErrors.fechaFin} />
          </div>
          {fechaRecepcion || true ? (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <FormField id="fechaRecepcion" name="fechaRecepcion" label="Recepción" type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
              <FormField id="ciudadExpedicion" name="ciudadExpedicion" label="Ciudad" value={ciudadExpedicion} onChange={(e) => setCiudadExpedicion(e.target.value)} placeholder="BOGOTÁ D.C." />
            </div>
          ) : null}
        </div>

        {/* === TOMADOR (DATOS) === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Icon icon="solar:buildings-3-bold" className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">Datos del Tomador</h3>
            </div>
            {selectedClient && (
              <Button color="light" size="xs" onClick={() => {
                const c = selectedClient.raw;
                const tipo = c?.tipo;
                if (tipo === 'EMPRESA') {
                  setNombreTomador(c?.empresa?.razon_social || c?.empresa?.nombre_comercial || selectedClient.nombre || '');
                  setTipoDocTomador('NIT');
                  setDocTomador(c?.empresa?.nit || selectedClient.documento || '');
                  setDireccionTomador(c?.empresa?.direccion || c?.direccion || '');
                  setCiudadTomador(c?.empresa?.ciudad || c?.ciudad || '');
                } else {
                  setNombreTomador(selectedClient.nombre || '');
                  setTipoDocTomador(c?.persona?.tipo_documento || 'CC');
                  setDocTomador(c?.persona?.documento || selectedClient.documento || '');
                  setDireccionTomador(c?.persona?.direccion || c?.direccion || '');
                  setCiudadTomador(c?.persona?.ciudad || c?.ciudad || '');
                }
                setTelefonoTomador(selectedClient.celular || c?.telefono || '');
                setCorreoTomador(selectedClient.email || '');
              }}>
                <Icon icon="solar:copy-bold" className="w-3 h-3 mr-1" /> Copiar del cliente
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="nombreTomador" name="nombreTomador" label="Razón Social / Nombre" value={nombreTomador} onChange={(e) => setNombreTomador(e.target.value)} placeholder="Afiliadora S.A.S" className="col-span-2" />
            <FormField id="tipoDocTomador" name="tipoDocTomador" label="Tipo Doc." type="select" value={tipoDocTomador} onChange={(e) => setTipoDocTomador(e.target.value)} options={[
              { value: 'NIT', label: 'NIT' }, { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' }, { value: 'PAS', label: 'Pasaporte' },
            ]} />
            <FormField id="docTomador" name="docTomador" label="Documento" value={docTomador} onChange={(e) => setDocTomador(e.target.value)} placeholder="8002304477" />
            <FormField id="telefonoTomador" name="telefonoTomador" label="Teléfono" value={telefonoTomador} onChange={(e) => setTelefonoTomador(e.target.value)} />
            <FormField id="correoTomador" name="correoTomador" label="Email" value={correoTomador} onChange={(e) => setCorreoTomador(e.target.value)} placeholder="recepcion@empresa.com" />
            <FormField id="direccionTomador" name="direccionTomador" label="Dirección" value={direccionTomador} onChange={(e) => setDireccionTomador(e.target.value)} placeholder="CR 7 # 127 48 P 5" className="col-span-2" />
            <FormField id="ciudadTomador" name="ciudadTomador" label="Ciudad" value={ciudadTomador} onChange={(e) => setCiudadTomador(e.target.value)} placeholder="MEDELLÍN" />
          </div>
        </div>

        {/* === OBSERVACIONES === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Observaciones" icon="solar:notes-bold" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="observaciones" className="text-xs font-medium text-gray-900 dark:text-white">Observaciones</Label>
              <Textarea id="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones generales" rows={2} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="observacionesInternas" className="text-xs font-medium text-gray-900 dark:text-white">Internas</Label>
              <Textarea id="observacionesInternas" value={observacionesInternas} onChange={(e) => setObservacionesInternas(e.target.value)} placeholder="No visibles para el cliente" rows={2} className="mt-1" />
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
            <FormField id="primaNeta" name="primaNeta" label="Prima Neta *" type="number" value={primaNeta} onChange={(e) => { setPrimaNeta(e.target.value); clearStepError('primaNeta'); }} error={stepErrors.primaNeta} />
            <FormField id="porcentajeIva" name="porcentajeIva" label="% IVA" type="number" value={porcentajeIva} onChange={(e) => setPorcentajeIva(e.target.value)} />
            <FormField id="iva" name="iva" label="IVA" type="number" value={iva} onChange={(e) => setIva(e.target.value)} />
            <FormField id="total" name="total" label="Total" type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
            <FormField id="priAPre" name="priAPre" label="Pri a Pre" type="number" value={priAPre} onChange={(e) => setPriAPre(e.target.value)} />
            <FormField id="participacion" name="participacion" label="Participación (%)" type="number" value={participacion} onChange={(e) => setParticipacion(e.target.value)} />
          </div>
        </div>

        {/* === COMISIONES === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Comisiones" icon="solar:money-bag-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="porcentajeComision" name="porcentajeComision" label="% Comisión" type="number" value={porcentajeComision} onChange={(e) => setPorcentajeComision(e.target.value)} />
            <FormField id="comisionAgencia" name="comisionAgencia" label="Comisión Agencia" type="number" value={comisionAgencia} onChange={(e) => setComisionAgencia(e.target.value)} />
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox id="coCorretaje" checked={coCorretaje} onCheckedChange={(v: any) => setCoCorretaje(Boolean(v))} />
                Co-corretaje
              </label>
            </div>
          </div>
        </div>

        {/* === FORMA DE PAGO === */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <SectionHeader title="Forma de Pago" icon="solar:card-bold" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField id="formaPago" name="formaPago" label="Forma *" type="select" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} options={[
              { value: '', label: 'Seleccionar' }, { value: 'contado', label: 'Contado' }, { value: 'credito', label: 'Crédito' }, { value: 'financiado', label: 'Financiado' },
            ]} />
            <FormField id="periodicidadPago" name="periodicidadPago" label="Periodicidad" type="select" value={periodicidadPago} onChange={(e) => setPeriodicidadPago(e.target.value)} options={[
              { value: '', label: 'Seleccionar' }, { value: 'mensual', label: 'Mensual' }, { value: 'trimestral', label: 'Trimestral' }, { value: 'semestral', label: 'Semestral' }, { value: 'anual', label: 'Anual' },
            ]} />
            <FormField id="medioPago" name="medioPago" label="Medio" type="select" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} options={[
              { value: '', label: 'Seleccionar' }, { value: 'transferencia', label: 'Transferencia' }, { value: 'debito', label: 'Débito' }, { value: 'tarjeta_credito', label: 'Tarjeta Crédito' }, { value: 'cheque', label: 'Cheque' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'corresponsal', label: 'Corresponsal' },
            ]} />
            <FormField id="banco" name="banco" label="Banco" type="select" value={banco} onChange={(e) => setBanco(e.target.value)} options={[{ value: '', label: 'Seleccionar' }, ...colombianBanks.map(b => ({ value: b, label: b }))]} />
          </div>
        </div>

        {/* PDF Preview when active */}
        {pdfFile && (
          <div className="sticky top-4">
            <CardBox className="h-fit">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:document-text-bold" className="w-5 h-5 text-primary" />
                  <span className="font-medium text-sm">Vista Previa PDF</span>
                </div>
                <button onClick={removePdf} className="text-gray-400 hover:text-red-500 transition-colors"><Icon icon="solar:close-circle-bold" className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Icon icon="solar:file-bold" className="w-6 h-6 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{pdfFile.name}</p>
                    <p className="text-xs text-gray-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Badge color="success" size="sm">PDF Válido</Badge>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden">
                  {pdfProcessing ? (
                    <div className="h-64 bg-gray-50 dark:bg-gray-700 p-4 relative">
                      <div className="animate-pulse space-y-3">
                        <div className="h-3 bg-gray-300 rounded w-full"></div>
                        <div className="h-3 bg-gray-300 rounded w-5/6"></div>
                        <div className="h-3 bg-gray-300 rounded w-4/5"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white rounded-lg px-3 py-2 shadow-lg border"><div className="flex items-center space-x-2"><Spinner size="sm" /><span className="text-xs font-medium">Procesando...</span></div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 bg-gray-50 dark:bg-gray-700 relative">
                      {pdfUrl && <iframe src={pdfUrl} className="w-full h-full border-0" title="Vista previa" />}
                      <div className="absolute top-2 right-2">
                        <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                          <Icon icon="solar:check-circle-bold" className="w-3 h-3" /><span>Procesado</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {pdfConfidence && !pdfProcessing && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Confianza</span>
                      <span className="text-sm font-bold">{pdfConfidence.overall.toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${pdfConfidence.overall >= 80 ? 'bg-green-500' : pdfConfidence.overall >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pdfConfidence.overall}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </CardBox>
          </div>
        )}

      </div>{/* END RIGHT COLUMN */}

      </div>{/* END GRID */}

      {/* === STICKY SAVE BUTTON === */}
      <div className="sticky bottom-0 z-50 mt-4 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 rounded-b-lg flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button color="gray" size="sm" onClick={() => navigate('/apps/seguros/polizas')}>
            <Icon icon="solar:arrow-left-bold" className="w-3 h-3 mr-1" /> Pólizas
          </Button>
          <span className="text-xs text-gray-500">Nueva póliza colectiva</span>
        </div>
        <Button type="button" color="success" disabled={submitting || !canSave()} onClick={handleSubmit} className="flex items-center gap-2 px-6 py-2 rounded-lg" title={!canSave() ? 'Complete los campos obligatorios' : ''}>
          {submitting ? (<><Spinner size="sm" /><span>Guardando...</span></>) : (<><Icon icon="solar:diskette-bold" className="w-4 h-4" /><span>Crear Póliza Colectiva</span></>)}
        </Button>
      </div>

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
                }
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default NuevaPolizaColectiva;

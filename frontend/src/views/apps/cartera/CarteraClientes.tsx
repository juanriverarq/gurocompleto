import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Button,
  Spinner,
  Badge,
  Tabs,
  Modal,
} from 'flowbite-react';
import GuroLoader from 'src/components/GuroLoader';
import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import { auth } from 'src/config/firebase';
import api from 'src/config/api';
import { onAuthStateChanged, User } from 'firebase/auth';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';
import { printRecibo, type ReciboPrintData, type BrokerPrintData } from './printRecibo';

interface CarteraItem {
  id: number;
  poliza_id: number | null;
  cliente_id: number | null;
  softseguros_pago_id: number | null;
  numero_poliza: string;
  numero_renovacion: number;
  anexo_numero: string | null;
  cliente: string;
  documento: string;
  aseguradora: string;
  ramo: string;
  subramo: string | null;
  vendedor: string;
  sede: string | null;
  forma_pago: string;
  numero_pago: string | null;
  estado_cartera: 'por_cobrar' | 'por_pagar' | 'comision_por_cobrar' | 'comision_recibida';
  // Financial
  prima_neta: number;
  valor_neto_a_pagar: number;
  prima_total_pago: number;
  prima_total: number;
  saldo_pendiente_oficina: number;
  saldo_pendiente_aseguradora: number;
  valor_recaudado_oficina: number;
  valor_pagado_aseguradora: number;
  comision_a_recibir: number;
  comision_recibida: number;
  comision_vendedor: number;
  porcentaje_comision: number | null;
  // Dates
  dias_vencidos: number;
  fecha_limite_pago: string | null;
  fecha_compromiso_pago: string | null;
  fecha_recaudado_oficina: string | null;
  fecha_pago_aseguradora: string | null;
  fecha_comisionada: string | null;
  fecha_inicio_vigencia: string | null;
  fecha_fin_vigencia: string | null;
  // Extra
  numero_remision: string | null;
  observacion_bitacora: string | null;
  observaciones_pago: string | null;
  // Recibo asociado
  recibo: {
    id: number;
    numero_recibo: string;
    fecha: string | null;
    cliente_nombre: string | null;
    cliente_documento: string | null;
    poliza_numero: string | null;
    aseguradora_nombre: string | null;
    ramo_nombre: string | null;
    forma_pago: string | null;
    valor_recaudado_en_oficina: number;
    valor_a_pagar: number;
    es_anticipo: boolean;
    tipo_recaudo: string | null;
    observaciones: string | null;
  } | null;
}

// Keep legacy interface for modals that still use it
interface PolizaCartera {
  id: string;
  carteraItemId?: number;
  numeroPoliza: string;
  cliente: string;
  clienteId: string;
  documento: string;
  aseguradora: string;
  ramo: string;
  estado: string;
  fechaInicio: string;
  fechaVencimiento: string;
  diasVencimiento: number;
  primaNeta: number;
  iva: number;
  total: number;
  comision: number;
  comisionReal: number;
  formaPago: string;
  valorPendienteCliente: number;
  valorPendienteAseguradora: number;
  valorRecaudado: number;
  valorPagadoAseguradora: number;
  comisionPendiente: number;
  comisionCobrada: number;
  estadoPago: 'Al día' | 'Pendiente' | 'Vencido' | 'Parcial';
  diasMora: number;
  vendedor?: string;
  vendedor_id?: number;
  recaudo_oficina?: { recaudado: number; pendiente: number; total: number; };
  recaudo_aseguradora?: { pagado: number; pendiente: number; total: number; };
  cobro_comision?: { cobrada: number; pendiente: number; total: number; };
}

interface EstadisticasCartera {
  totalPolizas: number;
  totalItems: number;
  primaTotal: number;
  comisionesTotal: number;
  recaudadoTotal: number;
  porCobrarTotal: number;
  porPagarTotal: number;
  comisionesRecibidasTotal: number;
  tasaRecaudo: number;
}

const CarteraClientes = () => {
  const [polizas, setPolizas] = useState<PolizaCartera[]>([]);
  const [carteraItems, setCarteraItems] = useState<CarteraItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCartera | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estado de autenticación usando Firebase directamente
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [paginaClientes, setPaginaClientes] = useState(1);
  const elementosPorPagina = 25;

  const [filtros, setFiltros] = useState({
    busqueda: '',
    estado: '',
    estadoPago: '',
    aseguradora: '',
    ramo: '',
    vendedor: '',
    ordenarPor: 'fechaVencimiento',
    ordenDireccion: 'asc' as 'asc' | 'desc',
  });

  const [tabActivo, setTabActivo] = useState<'general' | 'porCobrar' | 'porPagar' | 'comisionPorCobrar' | 'comisionRecibida'>('porCobrar');
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<PolizaCartera | null>(null);

  // Estado para modal de cartera por cliente
  const [showCarteraClienteModal, setShowCarteraClienteModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [polizasCliente, setPolizasCliente] = useState<PolizaCartera[]>([]);

  // Estados para modales de pagos
  const [showPagoOficinaModal, setShowPagoOficinaModal] = useState(false);
  const [showPagoAseguradoraModal, setShowPagoAseguradoraModal] = useState(false);
  const [showRecaudoAseguradoraDirectoModal, setShowRecaudoAseguradoraDirectoModal] = useState(false);
  const [showCobroComisionModal, setShowCobroComisionModal] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [observacionesPago, setObservacionesPago] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // Recibo print state
  const [reciboParaImprimir, setReciboParaImprimir] = useState<any>(null);
  const [printFormatRecibo, setPrintFormatRecibo] = useState<CarteraItem['recibo'] | null>(null);
  const [brokerInfo, setBrokerInfo] = useState<BrokerPrintData | null>(null);

  // Estados para importación de recaudos masivos
  const [showRecaudoMasivoModal, setShowRecaudoMasivoModal] = useState(false);
  const [archivoImportacion, setArchivoImportacion] = useState<File | null>(null);
  const [datosImportacion, setDatosImportacion] = useState<any[]>([]);
  const [columnasArchivo, setColumnasArchivo] = useState<string[]>([]);
  const [mapeoColumnas, setMapeoColumnas] = useState<Record<string, string>>({});
  const [pasoImportacion, setPasoImportacion] = useState<'subir' | 'mapear' | 'preview' | 'procesando' | 'resultado'>('subir');
  const [procesandoRecaudoMasivo, setProcesandoRecaudoMasivo] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState<{
    exitosos: number;
    fallidos: number;
    errores: { fila: number; poliza: string; motivo: string }[];
    importId?: number;
  } | null>(null);
  const [tipoRecaudoImportacion, setTipoRecaudoImportacion] = useState<'oficina' | 'aseguradora_directo'>('aseguradora_directo');
  const [progresoImportacion, setProgresoImportacion] = useState<{
    procesados: number;
    total: number;
    exitosos: number;
    fallidos: number;
    ultimaPoliza: string;
  }>({ procesados: 0, total: 0, exitosos: 0, fallidos: 0, ultimaPoliza: '' });

  // Estados para historial de importaciones
  const [showHistorialImportaciones, setShowHistorialImportaciones] = useState(false);
  const [historialImportaciones, setHistorialImportaciones] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [revertiendoImportacion, setRevertiendoImportacion] = useState<number | null>(null);

  // Estados para pagos de aseguradora individuales (tab Recaudos Completados)
  const [pagosAseguradora, setPagosAseguradora] = useState<any[]>([]);
  const [pagosAseguradoraPagination, setPagosAseguradoraPagination] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);
  const [cargandoPagosAseguradora, setCargandoPagosAseguradora] = useState(false);

  // Estado para paginación del servidor
  const [serverPagination, setServerPagination] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);

  // Estado para contadores de tabs (totales reales del backend)
  const [contadoresTabs, setContadoresTabs] = useState<{
    general: number;
    porCobrar: number;
    porPagar: number;
    comisionPorCobrar: number;
    comisionRecibida: number;
  }>({ general: 0, porCobrar: 0, porPagar: 0, comisionPorCobrar: 0, comisionRecibida: 0 });

  // Cargar datos con paginación del servidor (cartera_items)
  const cargarCartera = async (
    page: number = 1,
    search: string = '',
    tab: 'general' | 'porCobrar' | 'porPagar' | 'comisionPorCobrar' | 'comisionRecibida' = tabActivo,
  ) => {
    try {
      setLoading(true);
      const perPage = tab === 'general' ? 1000 : 25;
      
      const response = await polizaService.getCarteraPolizas(page, perPage, search, tab);
      
      if (!response.success || !response.data) {
        setCarteraItems([]);
        setPolizas([]);
        return;
      }

      const itemsData: CarteraItem[] = Array.isArray(response.data) ? response.data : [];
      setCarteraItems(itemsData);
      
      // Actualizar paginación del servidor
      if (response.pagination) {
        setServerPagination(response.pagination);
      }

      // Actualizar estadísticas si vienen en la respuesta
      if (response.estadisticas) {
        setEstadisticas(response.estadisticas as EstadisticasCartera);
      }

      // Actualizar contadores de tabs si vienen en la respuesta
      if (response.contadoresTabs) {
        setContadoresTabs({
          general: response.contadoresTabs.general ?? 0,
          porCobrar: response.contadoresTabs.porCobrar ?? 0,
          porPagar: response.contadoresTabs.porPagar ?? 0,
          comisionPorCobrar: response.contadoresTabs.comisionPorCobrar ?? 0,
          comisionRecibida: response.contadoresTabs.comisionRecibida ?? 0,
        });
      }

      // Also map to legacy PolizaCartera for modals that still use it
      const carteraPolizas: PolizaCartera[] = itemsData.map((item) => ({
        id: String(item.poliza_id || item.id),
        carteraItemId: item.id,
        numeroPoliza: item.numero_poliza,
        cliente: item.cliente,
        clienteId: String(item.cliente_id || ''),
        documento: item.documento,
        aseguradora: item.aseguradora,
        ramo: item.ramo,
        estado: 'ACTIVA',
        fechaInicio: item.fecha_inicio_vigencia || '',
        fechaVencimiento: item.fecha_fin_vigencia || '',
        diasVencimiento: -item.dias_vencidos,
        primaNeta: item.prima_neta,
        iva: 0,
        total: item.prima_total_pago || item.valor_neto_a_pagar,
        comision: item.comision_a_recibir,
        comisionReal: item.comision_a_recibir,
        formaPago: item.forma_pago,
        valorPendienteCliente: item.saldo_pendiente_oficina,
        valorPendienteAseguradora: item.saldo_pendiente_aseguradora,
        valorRecaudado: item.valor_recaudado_oficina,
        valorPagadoAseguradora: item.valor_pagado_aseguradora,
        comisionPendiente: item.comision_a_recibir - item.comision_recibida,
        comisionCobrada: item.comision_recibida,
        estadoPago: item.saldo_pendiente_oficina > 0 ? 'Pendiente' : 'Al día',
        diasMora: item.dias_vencidos,
        vendedor: item.vendedor,
        recaudo_oficina: {
          recaudado: item.valor_recaudado_oficina || 0,
          pendiente: item.saldo_pendiente_oficina || 0,
          total: item.prima_total_pago || item.valor_neto_a_pagar || 0,
        },
        recaudo_aseguradora: {
          pagado: item.valor_pagado_aseguradora || 0,
          pendiente: item.saldo_pendiente_aseguradora || 0,
          total: item.saldo_pendiente_aseguradora || 0,
        },
        cobro_comision: {
          cobrada: item.comision_recibida || 0,
          pendiente: (item.comision_a_recibir || 0) - (item.comision_recibida || 0),
          total: item.comision_a_recibir || 0,
        },
      }));
      setPolizas(carteraPolizas);

    } catch (error: any) {
      console.error('Error cargando cartera:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de cartera',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para abrir modal de cartera por cliente
  const abrirCarteraCliente = (clienteData: any) => {
    setClienteSeleccionado(clienteData);
    // Filtrar las pólizas de este cliente
    const polizasDelCliente = polizas.filter(p => p.clienteId === clienteData.clienteId);
    setPolizasCliente(polizasDelCliente);
    setShowCarteraClienteModal(true);
  };

  // Funciones para manejar pagos
  const abrirModalPagoOficina = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.recaudo_oficina?.pendiente || 0).toString());
    setMetodoPago('');
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowPagoOficinaModal(true);
  };

  const abrirModalPagoAseguradora = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.recaudo_aseguradora?.pendiente || 0).toString());
    setMetodoPago('');
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowPagoAseguradoraModal(true);
  };

  // Recaudo directo por aseguradora (va directo a recaudos completados)
  const abrirModalRecaudoAseguradoraDirecto = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    // Default to pending amount (total - already collected)
    const pendiente = poliza.valorPendienteCliente || poliza.recaudo_oficina?.pendiente || poliza.total || 0;
    setMontoPago(pendiente.toString());
    setMetodoPago('');
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowRecaudoAseguradoraDirectoModal(true);
  };

  const abrirModalCobroComision = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.cobro_comision?.pendiente || 0).toString());
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowCobroComisionModal(true);
  };

  const registrarPagoOficina = async () => {
    if (!polizaSeleccionada || !montoPago) return;
    const monto = parseFloat(montoPago);
    const pendiente = polizaSeleccionada.recaudo_oficina?.pendiente ?? polizaSeleccionada.total ?? 0;
    if (monto <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (monto > pendiente + 0.01) {
      toast({ title: 'Error', description: `El monto (${formatCurrency(monto)}) supera el saldo pendiente (${formatCurrency(pendiente)})`, variant: 'destructive' });
      return;
    }

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'oficina',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago,
        polizaSeleccionada.carteraItemId
      );

      if (response.success) {
        const recibo = response.data?.recibo;
        const numRecibo = response.data?.numero_recibo;
        toast({
          title: 'Recaudo registrado',
          description: `Recaudo por oficina registrado${numRecibo ? ` — Recibo #${numRecibo}` : ''}`,
        });
        setShowPagoOficinaModal(false);
        if (recibo) setReciboParaImprimir(recibo);
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando recaudo oficina:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const registrarPagoAseguradora = async () => {
    if (!polizaSeleccionada || !montoPago) return;
    const monto = parseFloat(montoPago);
    const pendiente = polizaSeleccionada.recaudo_aseguradora?.pendiente ?? polizaSeleccionada.valorPendienteAseguradora ?? 0;
    if (monto <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (monto > pendiente + 0.01) {
      toast({ title: 'Error', description: `El monto (${formatCurrency(monto)}) supera el saldo pendiente a aseguradora (${formatCurrency(pendiente)})`, variant: 'destructive' });
      return;
    }

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'aseguradora',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago,
        polizaSeleccionada.carteraItemId
      );

      if (response.success) {
        const recibo = response.data?.recibo;
        const numRecibo = response.data?.numero_recibo;
        toast({
          title: 'Pago registrado',
          description: `Pago a aseguradora registrado${numRecibo ? ` — Recibo #${numRecibo}` : ''}`,
        });
        setShowPagoAseguradoraModal(false);
        if (recibo) setReciboParaImprimir(recibo);
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando pago aseguradora:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  // Función para parsear archivo CSV/Excel
  const parsearArchivoImportacion = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Si es Excel, usar librería xlsx
    if (extension === 'xlsx' || extension === 'xls') {
      const XLSX = await import('xlsx');
      return new Promise<{ columnas: string[]; datos: any[] }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (jsonData.length < 2) {
              reject(new Error('El archivo debe tener al menos una fila de encabezados y una de datos'));
              return;
            }
            
            const columnas = (jsonData[0] as any[]).map(col => String(col || '').trim());
            const datos = jsonData.slice(1).map((row, idx) => {
              const obj: any = { _fila: idx + 2 };
              columnas.forEach((col, i) => {
                obj[col] = row[i] !== undefined ? String(row[i]) : '';
              });
              return obj;
            }).filter(row => columnas.some(col => row[col])); // Filtrar filas vacías
            
            resolve({ columnas, datos });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo Excel'));
        reader.readAsArrayBuffer(file);
      });
    }
    
    // Si es CSV/TXT, parsear como texto
    return new Promise<{ columnas: string[]; datos: any[] }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error('El archivo debe tener al menos una fila de encabezados y una de datos'));
            return;
          }
          
          // Detectar separador (coma, punto y coma, o tab)
          const firstLine = lines[0];
          let separator = ',';
          if (firstLine.includes(';')) separator = ';';
          else if (firstLine.includes('\t')) separator = '\t';
          
          const columnas = firstLine.split(separator).map(col => col.trim().replace(/^"|"$/g, ''));
          const datos = lines.slice(1).map((line, idx) => {
            const valores = line.split(separator).map(val => val.trim().replace(/^"|"$/g, ''));
            const obj: any = { _fila: idx + 2 };
            columnas.forEach((col, i) => {
              obj[col] = valores[i] || '';
            });
            return obj;
          });
          
          resolve({ columnas, datos });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  };

  // Manejar subida de archivo
  const handleArchivoImportacion = async (file: File | null) => {
    if (!file) return;
    
    setArchivoImportacion(file);
    try {
      const { columnas, datos } = await parsearArchivoImportacion(file);
      setColumnasArchivo(columnas);
      setDatosImportacion(datos);
      
      // Auto-mapear columnas conocidas
      const autoMapeo: Record<string, string> = {};
      const columnasLower = columnas.map(c => c.toLowerCase());
      
      if (columnasLower.includes('numero_poliza') || columnasLower.includes('poliza') || columnasLower.includes('número póliza')) {
        autoMapeo.numero_poliza = columnas[columnasLower.findIndex(c => c.includes('poliza'))];
      }
      if (columnasLower.includes('monto') || columnasLower.includes('valor') || columnasLower.includes('amount')) {
        autoMapeo.monto = columnas[columnasLower.findIndex(c => c.includes('monto') || c.includes('valor') || c.includes('amount'))];
      }
      if (columnasLower.includes('fecha') || columnasLower.includes('fecha_pago') || columnasLower.includes('date')) {
        autoMapeo.fecha_pago = columnas[columnasLower.findIndex(c => c.includes('fecha'))];
      }
      if (columnasLower.includes('metodo') || columnasLower.includes('metodo_pago') || columnasLower.includes('payment_method')) {
        autoMapeo.metodo_pago = columnas[columnasLower.findIndex(c => c.includes('metodo'))];
      }
      if (columnasLower.includes('referencia') || columnasLower.includes('reference')) {
        autoMapeo.referencia = columnas[columnasLower.findIndex(c => c.includes('referencia') || c.includes('reference'))];
      }
      
      setMapeoColumnas(autoMapeo);
      setPasoImportacion('mapear');
    } catch (error: any) {
      toast({
        title: 'Error al leer archivo',
        description: error.message || 'No se pudo procesar el archivo',
        variant: 'destructive',
      });
    }
  };

  // Ejecutar importación de recaudos usando la nueva API masiva con registro
  const ejecutarImportacionRecaudos = async () => {
    if (!mapeoColumnas.numero_poliza) {
      toast({
        title: 'Error',
        description: 'Debe mapear al menos la columna de número de póliza',
        variant: 'destructive',
      });
      return;
    }

    setPasoImportacion('procesando');
    setProcesandoRecaudoMasivo(true);
    
    const total = datosImportacion.length;
    setProgresoImportacion({ procesados: 0, total, exitosos: 0, fallidos: 0, ultimaPoliza: '' });

    try {
      // Preparar los recaudos para enviar al backend
      const recaudos = datosImportacion.map(fila => {
        const numeroPoliza = fila[mapeoColumnas.numero_poliza];
        const montoStr = mapeoColumnas.monto ? fila[mapeoColumnas.monto] : null;
        // Soportar valores negativos (ajustes)
        const monto = montoStr ? parseFloat(String(montoStr).replace(/[^0-9.-]/g, '') || '0') : undefined;
        
        return {
          numero_poliza: String(numeroPoliza || '').trim(),
          monto_pagado: monto,
          fecha_pago: mapeoColumnas.fecha_pago ? fila[mapeoColumnas.fecha_pago] : undefined,
          metodo_pago: mapeoColumnas.metodo_pago ? fila[mapeoColumnas.metodo_pago] : undefined,
          referencia_pago: mapeoColumnas.referencia ? fila[mapeoColumnas.referencia] : undefined,
        };
      }).filter(r => r.numero_poliza); // Filtrar filas sin número de póliza

      // Usar la nueva API de importación masiva con registro
      const response = await polizaService.importarRecaudosMasivo({
        tipo_recaudo: tipoRecaudoImportacion,
        recaudos,
        filename: archivoImportacion?.name,
        mapping: mapeoColumnas,
      });

      if (response.success && response.data) {
        const { exitosos, fallidos, errores, import_id } = response.data;
        
        setResultadoImportacion({ 
          exitosos, 
          fallidos, 
          errores: errores || [],
          importId: import_id, // Guardar ID para poder revertir
        });
        setProgresoImportacion({ procesados: total, total, exitosos, fallidos, ultimaPoliza: 'Completado' });
        
        toast({
          title: 'Importación completada',
          description: `${exitosos} recaudos exitosos, ${fallidos} fallidos. ID: ${import_id}`,
        });
      } else {
        throw new Error(response.message || 'Error en importación');
      }
    } catch (error: any) {
      toast({
        title: 'Error en importación',
        description: error.message || 'Error de conexión',
        variant: 'destructive',
      });
      setResultadoImportacion({ exitosos: 0, fallidos: total, errores: [{ fila: 0, poliza: '', motivo: error.message }] });
    }

    setPasoImportacion('resultado');
    setProcesandoRecaudoMasivo(false);
    await cargarCartera();
    await cargarHistorialImportaciones(); // Recargar historial
  };

  // Descargar informe de errores
  const descargarInformeErrores = () => {
    if (!resultadoImportacion?.errores.length) return;

    const csv = [
      'Fila,Número Póliza,Motivo Error',
      ...resultadoImportacion.errores.map(e => `${e.fila},"${e.poliza}","${e.motivo}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `errores_importacion_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Descargar informe de errores de una importación del historial
  const descargarInformeErroresHistorial = (imp: any) => {
    const errores = imp.errores || [];
    if (!errores.length) return;

    const csv = [
      'Fila,Número Póliza,Motivo Error',
      ...errores.map((e: any) => `${e.fila},"${e.poliza || ''}","${(e.motivo || '').replace(/"/g, '""')}"`)
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `errores_importacion_${imp.id}_${(imp.created_at || '').split(' ')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Resetear modal de importación
  const resetearImportacion = () => {
    setArchivoImportacion(null);
    setDatosImportacion([]);
    setColumnasArchivo([]);
    setMapeoColumnas({});
    setPasoImportacion('subir');
    setResultadoImportacion(null);
  };

  // Cargar historial de importaciones
  const cargarHistorialImportaciones = async () => {
    try {
      setCargandoHistorial(true);
      const response = await polizaService.listarImportaciones(20);
      if (response.success && response.data) {
        setHistorialImportaciones(response.data);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Revertir una importación masiva
  const revertirImportacionMasiva = async (importId: number) => {
    if (!confirm('¿Está seguro de revertir esta importación? Se eliminarán TODOS los recaudos creados en esta importación.')) {
      return;
    }

    try {
      setRevertiendoImportacion(importId);
      const response = await polizaService.revertirImportacion(importId);
      
      if (response.success) {
        toast({
          title: 'Importación revertida',
          description: response.message || 'Los recaudos han sido eliminados',
        });
        await cargarHistorialImportaciones();
        await cargarCartera();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo revertir la importación',
        variant: 'destructive',
      });
    } finally {
      setRevertiendoImportacion(null);
    }
  };

  // Cargar pagos de aseguradora individuales (para tab Recaudos Completados)
  const cargarPagosAseguradora = async (page: number = 1, search: string = '') => {
    try {
      setCargandoPagosAseguradora(true);
      const response = await api.get(`/saas/pagos/aseguradora?page=${page}&per_page=25&search=${encodeURIComponent(search)}`);
      const data = response.data;
      
      if (data.success) {
        setPagosAseguradora(data.data || []);
        setPagosAseguradoraPagination(data.pagination || null);
      }
    } catch (error) {
      console.error('Error cargando pagos aseguradora:', error);
    } finally {
      setCargandoPagosAseguradora(false);
    }
  };

  // Revertir un pago individual de aseguradora
  const revertirPagoAseguradoraIndividual = async (pagoId: number, monto: number) => {
    if (!confirm(`¿Está seguro de revertir este pago de ${formatCurrency(monto)}?`)) {
      return;
    }

    try {
      const response = await api.delete(`/saas/pagos/aseguradora/${pagoId}`);
      const data = response.data;
      
      if (data.success) {
        toast({
          title: 'Pago revertido',
          description: data.message || 'El pago ha sido eliminado',
        });
        await cargarPagosAseguradora(pagosAseguradoraPagination?.current_page || 1, filtros.busqueda);
        await cargarCartera(); // Actualizar contadores
      } else {
        toast({
          title: 'Error',
          description: data.message || 'No se pudo revertir el pago',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'No se pudo revertir el pago',
        variant: 'destructive',
      });
    }
  };

  // Registrar recaudo directo por aseguradora (va directo a recaudos completados)
  const registrarRecaudoAseguradoraDirecto = async () => {
    if (!polizaSeleccionada || !montoPago) return;
    const monto = parseFloat(montoPago);
    if (monto <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (monto > (polizaSeleccionada.total || 0) + 0.01) {
      toast({ title: 'Error', description: `El monto (${formatCurrency(monto)}) supera el total de la póliza (${formatCurrency(polizaSeleccionada.total)})`, variant: 'destructive' });
      return;
    }

    try {
      setProcesandoPago(true);
      // Registrar como pago de aseguradora con estado pagado directamente
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'aseguradora_directo',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago,
        polizaSeleccionada.carteraItemId
      );

      if (response.success) {
        const recibo = response.data?.recibo;
        const numRecibo = response.data?.numero_recibo;
        toast({
          title: 'Recaudo registrado',
          description: `Recaudo directo registrado${numRecibo ? ` — Recibo #${numRecibo}` : ''}`,
        });
        setShowRecaudoAseguradoraDirectoModal(false);
        if (recibo) setReciboParaImprimir(recibo);
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando recaudo aseguradora directo:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const registrarCobroComision = async () => {
    if (!polizaSeleccionada || !montoPago) return;
    const monto = parseFloat(montoPago);
    const pendiente = polizaSeleccionada.cobro_comision?.pendiente ?? polizaSeleccionada.comisionPendiente ?? 0;
    if (monto <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (monto > pendiente + 0.01) {
      toast({ title: 'Error', description: `El monto (${formatCurrency(monto)}) supera la comisión pendiente (${formatCurrency(pendiente)})`, variant: 'destructive' });
      return;
    }

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarCobroComision(
        polizaSeleccionada.id,
        parseFloat(montoPago),
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        const recibo = response.data?.recibo;
        const numRecibo = response.data?.numero_recibo;
        toast({
          title: 'Cobro registrado',
          description: `Cobro de comisión registrado${numRecibo ? ` — Recibo #${numRecibo}` : ''}`,
        });
        setShowCobroComisionModal(false);
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando cobro comisión:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const revertirRecaudoOficina = async (poliza: PolizaCartera) => {
    if (!confirm('¿Está seguro de revertir todos los recaudos de oficina de esta póliza? Esta acción eliminará todos los abonos registrados.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await polizaService.revertirRecaudosOficina(poliza.id);

      if (response.success) {
        toast({
          title: 'Recaudos revertidos',
          description: 'Los recaudos de oficina han sido revertidos exitosamente',
        });
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error revirtiendo recaudos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron revertir los recaudos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Revertir recaudo completo (desde Recaudos Completados - elimina todo)
  const revertirRecaudoCompleto = async (poliza: PolizaCartera) => {
    if (!confirm('¿Está seguro de revertir TODO el recaudo de esta póliza? Esto eliminará los pagos de oficina y aseguradora, regresando la póliza a "Por Cobrar".')) {
      return;
    }

    try {
      setLoading(true);
      const response = await polizaService.revertirRecaudoCompleto(poliza.id);

      if (response.success) {
        toast({
          title: 'Recaudo revertido',
          description: 'El recaudo completo ha sido revertido. La póliza está nuevamente en Por Cobrar.',
        });
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error revirtiendo recaudo completo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo revertir el recaudo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Revertir cobro de comisión (desde Comisiones Recibidas)
  const revertirCobroComision = async (item: CarteraItem) => {
    if (!item.poliza_id) return;
    if (!confirm(`¿Está seguro de revertir el cobro de comisión de la póliza ${item.numero_poliza}? La comisión volverá a estado pendiente.`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.delete(`/saas/polizas/${item.poliza_id}/cobrar-comision/ultimo`);
      if (res.data?.success) {
        toast({
          title: 'Cobro revertido',
          description: `El cobro de comisión de la póliza ${item.numero_poliza} ha sido revertido`,
        });
        await cargarCartera();
      } else {
        toast({ title: 'Error', description: res.data?.message || 'Error al revertir cobro', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error revirtiendo cobro comisión:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'No se pudo revertir el cobro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Escuchar cambios de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cargar datos cuando el usuario esté autenticado
  useEffect(() => {
    if (!authLoading && authUser) {
      cargarCartera(1, filtros.busqueda, tabActivo);
      // Load broker info for recibo printing
      api.get('/saas/broker/profile').then(res => {
        const b = res.data;
        if (b?.success) {
          setBrokerInfo({
            nombre: b.legal_name || b.name || '',
            legal_name: b.legal_name || '',
            nit: b.document_number || '',
            direccion: b.address || '',
            ciudad: b.city || '',
            telefono: b.phone || '',
            email: b.email || '',
            logo_url: b.logo_url || '',
          });
        }
      }).catch(() => {});
    }
  }, [authLoading, authUser]);

  // Helper to print recibo from a cartera item
  const imprimirReciboDeItem = (recibo: CarteraItem['recibo'], format: 'media_carta' | 'carta' = 'media_carta') => {
    if (!recibo) return;
    const data: ReciboPrintData = {
      numero_recibo: recibo.numero_recibo,
      fecha: recibo.fecha,
      cliente_nombre: recibo.cliente_nombre,
      cliente_documento: recibo.cliente_documento,
      poliza_numero: recibo.poliza_numero,
      aseguradora_nombre: recibo.aseguradora_nombre,
      ramo_nombre: recibo.ramo_nombre,
      forma_pago: recibo.forma_pago,
      moneda: 'COP',
      valor_recaudado_en_oficina: recibo.valor_recaudado_en_oficina || recibo.valor_a_pagar || 0,
      es_anticipo: recibo.es_anticipo || false,
      observaciones: recibo.observaciones,
    };
    const broker: BrokerPrintData = brokerInfo || { nombre: 'Agencia de Seguros', nit: '' };
    printRecibo(data, broker, format);
  };

  // Tab change is handled by the existing useEffect on [tabActivo] below

  // Buscar manualmente con Enter o botón (ya no es automático)
  const ejecutarBusqueda = () => {
    if (!authLoading && authUser) {
      cargarCartera(1, filtros.busqueda, tabActivo);
    }
  };

  useEffect(() => {
    // Al cambiar de tab: resetear paginación
    setPaginaClientes(1);
    if (!authLoading && authUser) {
      cargarCartera(1, filtros.busqueda, tabActivo);
    }
  }, [tabActivo]);

  // Función para cambiar de página
  const cambiarPagina = (nuevaPagina: number) => {
    cargarCartera(nuevaPagina, filtros.busqueda, tabActivo);
  };

  const polizasFiltradas = useMemo(() => {
    let resultado = [...polizas];

    if (filtros.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      resultado = resultado.filter((p) => {
        const num = (p.numeroPoliza || '').toLowerCase();
        const cli = (p.cliente || '').toLowerCase();
        const doc = (p.documento || '').toLowerCase();
        const aseg = (p.aseguradora || '').toLowerCase();
        const ramo = (p.ramo || '').toLowerCase();
        const estado = (p.estado || '').toLowerCase();
        const estadoPago = (p.estadoPago || '').toLowerCase();
        const clienteId = (p.clienteId || '').toLowerCase();

        return (
          num.includes(busqueda) ||
          cli.includes(busqueda) ||
          doc.includes(busqueda) ||
          aseg.includes(busqueda) ||
          ramo.includes(busqueda) ||
          estado.includes(busqueda) ||
          estadoPago.includes(busqueda) ||
          clienteId.includes(busqueda)
        );
      });
    }

    if (filtros.estado) {
      resultado = resultado.filter(p => p.estado === filtros.estado);
    }

    if (filtros.estadoPago) {
      resultado = resultado.filter(p => p.estadoPago === filtros.estadoPago);
    }

    if (filtros.aseguradora) {
      resultado = resultado.filter(p => p.aseguradora === filtros.aseguradora);
    }

    if (filtros.ramo) {
      resultado = resultado.filter(p => p.ramo === filtros.ramo);
    }

    if (filtros.vendedor) {
      const vendedorBusqueda = filtros.vendedor.toLowerCase();
      resultado = resultado.filter(p => {
        const vendedor = ((p as any).vendedor || '').toLowerCase();
        return vendedor.includes(vendedorBusqueda);
      });
    }

    resultado.sort((a, b) => {
      let valorA: any = a[filtros.ordenarPor as keyof PolizaCartera];
      let valorB: any = b[filtros.ordenarPor as keyof PolizaCartera];

      if (filtros.ordenarPor === 'fechaVencimiento' || filtros.ordenarPor === 'fechaInicio') {
        valorA = valorA ? new Date(valorA).getTime() : 0;
        valorB = valorB ? new Date(valorB).getTime() : 0;
      }

      if (typeof valorA === 'string') {
        return filtros.ordenDireccion === 'asc'
          ? valorA.localeCompare(valorB)
          : valorB.localeCompare(valorA);
      }

      return filtros.ordenDireccion === 'asc' ? valorA - valorB : valorB - valorA;
    });

    return resultado;
  }, [polizas, filtros]);

  // Lista de vendedores únicos para el select
  const vendedoresUnicos = useMemo(() => {
    const vendedores = polizas
      .map(p => p.vendedor)
      .filter((v): v is string => !!v && v !== 'Sin asignar');
    return [...new Set(vendedores)].sort();
  }, [polizas]);

  useEffect(() => {
    setPaginaClientes(1);
  }, [filtros]);

  // All tab data comes pre-filtered from the server via cartera_items
  // For the "general" tab, consolidate by client
  const clientesConsolidados = useMemo(() => {
    return Object.entries(
      carteraItems.reduce((acc, item) => {
        const key = item.cliente_id ? String(item.cliente_id) : item.documento || item.cliente;
        if (!acc[key]) {
          acc[key] = {
            cliente: item.cliente,
            clienteId: String(item.cliente_id || ''),
            documento: item.documento,
            polizas: 0,
            primaTotal: 0,
            comisiones: 0,
            porCobrar: 0,
            recaudado: 0,
            proximoVenc: '',
          };
        }
        acc[key].polizas++;
        acc[key].primaTotal += item.prima_neta || 0;
        acc[key].comisiones += item.comision_a_recibir || 0;
        acc[key].porCobrar += item.saldo_pendiente_oficina || 0;
        acc[key].recaudado += item.valor_recaudado_oficina || 0;
        if (item.fecha_fin_vigencia && (!acc[key].proximoVenc || item.fecha_fin_vigencia < acc[key].proximoVenc)) {
          acc[key].proximoVenc = item.fecha_fin_vigencia;
        }
        return acc;
      }, {} as Record<string, any>)
    ).map(([id, data]) => ({ id, ...data }));
  }, [carteraItems]);

  const clientesPaginados = useMemo(() => {
    const inicio = (paginaClientes - 1) * elementosPorPagina;
    const fin = inicio + elementosPorPagina;
    return clientesConsolidados.slice(inicio, fin);
  }, [clientesConsolidados, paginaClientes, elementosPorPagina]);

  const totalPaginasClientes = Math.ceil(clientesConsolidados.length / elementosPorPagina);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return '-';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVA': return 'success';
      case 'VENCIDA': return 'warning';
      case 'CANCELADA': return 'failure';
      case 'SUSPENDIDA': return 'gray';
      default: return 'gray';
    }
  };

  const getEstadoPagoColor = (estado: string) => {
    switch (estado) {
      case 'Al día': return 'success';
      case 'Pendiente': return 'warning';
      case 'Vencido': return 'failure';
      case 'Parcial': return 'info';
      default: return 'gray';
    }
  };

  // Mostrar spinner mientras se verifica la autenticación
  if (authLoading) {
    return <GuroLoader size={80} />;
  }

  // Mostrar mensaje si el usuario no está autenticado
  if (!authUser) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <Icon icon="solar:lock-keyhole-bold-duotone" className="w-16 h-16 text-gray-400" />
        <p className="text-gray-600">Debes iniciar sesión para ver la cartera</p>
        <Button color="primary" onClick={() => navigate('/auth/login')}>
          Iniciar Sesión
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando cartera...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cartera Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gestión de cartera, recaudos y comisiones</p>
        </div>
        <Link to="/apps/cartera/recibos-caja">
          <Button color="light" className="rounded-[10px]">
            <Icon icon="solar:bill-list-bold-duotone" className="w-4 h-4 mr-2" />
            Recibos de Caja
          </Button>
        </Link>
      </div>

      {/* Estadísticas Principales */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-white dark:bg-darkgray rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Items Cartera</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{estadisticas.totalItems.toLocaleString()}</p>
                <p className="text-[11px] text-gray-400">{estadisticas.totalPolizas} pólizas</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-darkgray rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:wallet-money-bold-duotone" className="w-5 h-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Por Cobrar</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(estadisticas.porCobrarTotal)}</p>
                <p className="text-[11px] text-gray-400">{contadoresTabs.porCobrar} pagos</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-darkgray rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:card-transfer-bold-duotone" className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Por Pagar</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(estadisticas.porPagarTotal)}</p>
                <p className="text-[11px] text-gray-400">{contadoresTabs.porPagar} pagos</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-darkgray rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:hand-money-bold-duotone" className="w-5 h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Comisiones</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(estadisticas.comisionesTotal)}</p>
                <p className="text-[11px] text-gray-400">Recibidas: {formatCurrency(estadisticas.comisionesRecibidasTotal)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-darkgray rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Recaudado</p>
                <p className="text-lg font-bold text-teal-600">{formatCurrency(estadisticas.recaudadoTotal)}</p>
                <p className="text-[11px] text-gray-400">Tasa: {estadisticas.tasaRecaudo.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header de Controles - Fuera de las tabs para que funcione globalmente */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por póliza, cliente o aseguradora..."
                  value={filtros.busqueda || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') ejecutarBusqueda(); }}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            <Button
              color="primary"
              onClick={ejecutarBusqueda}
              disabled={loading}
              className="h-10 px-4 rounded-[10px] flex items-center gap-2"
            >
              <Icon icon="solar:magnifer-bold-duotone" className="w-4 h-4" />
              <span className="hidden sm:inline">Buscar</span>
            </Button>

            <div className="w-52">
              <select
                value={filtros.vendedor || ''}
                onChange={(e) => setFiltros({ ...filtros, vendedor: e.target.value })}
                className="w-full h-10 text-sm rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-darkgray px-3 focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Todos los vendedores</option>
                {vendedoresUnicos.map((vendedor) => (
                  <option key={vendedor} value={vendedor}>
                    {vendedor}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => cargarCartera(1, filtros.busqueda)}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                color="light"
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Exportar"
              >
                <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Cartera */}
      <Card>
        <Tabs
          onActiveTabChange={(tab) => {
            const tabNames: ('general' | 'porCobrar' | 'porPagar' | 'comisionPorCobrar' | 'comisionRecibida')[] = ['porCobrar', 'porPagar', 'comisionPorCobrar', 'comisionRecibida'];
            if (tabNames[tab] && tabNames[tab] !== tabActivo) {
              setTabActivo(tabNames[tab]);
            }
          }}
        >
          {/* TAB: Cartera General — OCULTO por ahora */}
          {false && <Tabs.Item
            active={tabActivo === 'general'}
            title={`Cartera General (${contadoresTabs.general})`}
            icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" />}
          >
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Prima Total</th>
                    <th className="text-right">Recaudado</th>
                    <th className="text-right">Por Cobrar</th>
                    <th className="text-right">Comisiones</th>
                    <th>Próximo Venc.</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPaginados.map((data) => (
                    <tr key={data.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium">{data.cliente}</div>
                          <div className="text-xs text-gray-500">{data.documento}</div>
                        </div>
                      </td>
                      <td className="text-center font-semibold text-blue-600">
                        {data.polizas}
                      </td>
                      <td className="text-right font-semibold">
                        {formatCurrency(data.primaTotal)}
                      </td>
                      <td className="text-right font-semibold text-green-600">
                        {formatCurrency(data.recaudado)}
                      </td>
                      <td className="text-right font-semibold text-orange-600">
                        {formatCurrency(data.porCobrar)}
                      </td>
                      <td className="text-right font-semibold text-indigo-600">
                        {formatCurrency(data.comisiones)}
                      </td>
                      <td>
                        {formatDate(data.proximoVenc)}
                      </td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          <TableMenuItem className="text-blue-600" onClick={() => abrirCarteraCliente(data)}>
                            <Icon icon="solar:wallet-money-bold-duotone" height={18} />
                            <span>Ver Cartera</span>
                          </TableMenuItem>
                          {data.clienteId && (
                            <Link to={`/apps/seguros/clientes/editar/${data.clienteId}`}>
                              <TableMenuItem>
                                <Icon icon="solar:user-bold-duotone" height={18} />
                                <span>Ver Cliente</span>
                              </TableMenuItem>
                            </Link>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginasClientes > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaClientes - 1) * elementosPorPagina) + 1} a {Math.min(paginaClientes * elementosPorPagina, clientesConsolidados.length)} de {clientesConsolidados.length} clientes
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" color="gray" disabled={paginaClientes === 1} onClick={() => setPaginaClientes(p => Math.max(1, p - 1))} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {paginaClientes} de {totalPaginasClientes}</span>
                  <Button size="sm" color="gray" disabled={paginaClientes === totalPaginasClientes} onClick={() => setPaginaClientes(p => Math.min(totalPaginasClientes, p + 1))} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>}

          {/* TAB: Por Cobrar */}
          <Tabs.Item
            active={tabActivo === 'porCobrar'}
            title={`Por Cobrar (${contadoresTabs.porCobrar})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
          >
            <div className="mb-4 flex items-center justify-end gap-2">
              <Button size="sm" color="gray" onClick={() => { setShowHistorialImportaciones(true); cargarHistorialImportaciones(); }}>
                <Icon icon="solar:history-bold-duotone" className="w-4 h-4 mr-2" />
                Historial Importaciones
              </Button>
              <Button size="sm" color="purple" onClick={() => setShowRecaudoMasivoModal(true)}>
                <Icon icon="solar:upload-bold-duotone" className="w-4 h-4 mr-2" />
                Importar Recaudos
              </Button>
            </div>

            <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3.5 border border-orange-100 dark:border-orange-800/30">
                <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:wallet-money-bold-duotone" className="w-4.5 h-4.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">Saldo Pendiente Oficina</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.saldo_pendiente_oficina || 0), 0))}</p>
                  <p className="text-[11px] text-orange-500">{carteraItems.length} pagos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 rounded-xl p-3.5 border border-green-100 dark:border-green-800/30">
                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-4.5 h-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">Ya Recaudado en Oficina</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.valor_recaudado_oficina || 0), 0))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-100 dark:border-blue-800/30">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Prima Total</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.prima_total_pago || 0), 0))}</p>
                </div>
              </div>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th>Vendedor</th>
                    <th className="text-right">Saldo Pendiente</th>
                    <th className="text-right">Recaudado</th>
                    <th className="text-center">Días Venc.</th>
                    <th>Forma Pago</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraItems.map((item) => (
                    <tr key={item.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {item.numero_poliza}
                            {item.numero_renovacion > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                R{item.numero_renovacion}
                              </span>
                            )}
                          </div>
                          {item.numero_pago && <div className="text-xs text-gray-500">Pago #{item.numero_pago}</div>}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{item.cliente}</div>
                          <div className="text-xs text-gray-500">{item.documento}</div>
                        </div>
                      </td>
                      <td className="text-sm">{item.aseguradora}</td>
                      <td className="text-sm">{item.vendedor || '-'}</td>
                      <td className="text-right font-semibold text-orange-600">
                        {formatCurrency(item.saldo_pendiente_oficina)}
                      </td>
                      <td className="text-right font-semibold text-green-600">
                        {formatCurrency(item.valor_recaudado_oficina)}
                      </td>
                      <td className="text-center">
                        {item.dias_vencidos > 0 ? (
                          <Badge color="failure" size="sm">{item.dias_vencidos}d</Badge>
                        ) : item.dias_vencidos === 0 ? (
                          <Badge color="warning" size="sm">Hoy</Badge>
                        ) : (
                          <Badge color="success" size="sm">{Math.abs(item.dias_vencidos)}d</Badge>
                        )}
                      </td>
                      <td className="text-sm">{item.forma_pago || '-'}</td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          {item.poliza_id && (
                            <>
                              <TableMenuItem className="text-green-600" onClick={() => {
                                const p = polizas.find(p => p.id === String(item.poliza_id));
                                if (p) abrirModalPagoOficina(p);
                              }}>
                                <Icon icon="solar:cash-out-bold-duotone" height={18} />
                                <span>Registrar Recaudo</span>
                              </TableMenuItem>
                              <TableMenuItem className="text-blue-600" onClick={() => {
                                const p = polizas.find(p => p.id === String(item.poliza_id));
                                if (p) abrirModalRecaudoAseguradoraDirecto(p);
                              }}>
                                <Icon icon="solar:buildings-bold-duotone" height={18} />
                                <span>Recaudo Directo Aseg.</span>
                              </TableMenuItem>
                              <Link to={`/apps/seguros/polizas/editar/${item.poliza_id}`}>
                                <TableMenuItem>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Póliza</span>
                                </TableMenuItem>
                              </Link>
                            </>
                          )}
                          {item.cliente_id && (
                            <Link to={`/apps/seguros/clientes/editar/${item.cliente_id}`}>
                              <TableMenuItem>
                                <Icon icon="solar:user-bold-duotone" height={18} />
                                <span>Ver Cliente</span>
                              </TableMenuItem>
                            </Link>
                          )}
                          {item.recibo && (
                            <TableMenuItem className="text-amber-600" onClick={() => setPrintFormatRecibo(item.recibo)}>
                              <Icon icon="solar:printer-bold-duotone" height={18} />
                              <span>Recibo #{item.recibo.numero_recibo}</span>
                            </TableMenuItem>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carteraItems.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay cuentas por cobrar pendientes</p>
                </div>
              )}
            </div>

            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} items)
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === 1} onClick={() => cambiarPagina(serverPagination.current_page - 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {serverPagination.current_page} de {serverPagination.last_page}</span>
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === serverPagination.last_page} onClick={() => cambiarPagina(serverPagination.current_page + 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          {/* TAB: Por Pagar */}
          <Tabs.Item
            active={tabActivo === 'porPagar'}
            title={`Por Pagar (${contadoresTabs.porPagar})`}
            icon={() => <Icon icon="solar:card-transfer-bold-duotone" />}
          >
            <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3.5 border border-purple-100 dark:border-purple-800/30">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:card-transfer-bold-duotone" className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Saldo Pendiente Aseguradora</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.saldo_pendiente_aseguradora || 0), 0))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3.5 border border-orange-100 dark:border-orange-800/30">
                <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:clock-circle-bold-duotone" className="w-4.5 h-4.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">Pagos Pendientes</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-200">{carteraItems.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-100 dark:border-blue-800/30">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:dollar-bold-duotone" className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Valor Neto a Pagar</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.valor_neto_a_pagar || 0), 0))}</p>
                </div>
              </div>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th className="text-right">Valor Neto a Pagar</th>
                    <th className="text-right">Saldo Pendiente</th>
                    <th className="text-right">Pagado Aseg.</th>
                    <th>Forma Pago</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraItems.map((item) => (
                    <tr key={item.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {item.numero_poliza}
                            {item.numero_renovacion > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                R{item.numero_renovacion}
                              </span>
                            )}
                          </div>
                          {item.numero_pago && <div className="text-xs text-gray-500">Pago #{item.numero_pago}</div>}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{item.cliente}</div>
                          <div className="text-xs text-gray-500">{item.documento}</div>
                        </div>
                      </td>
                      <td className="text-sm">{item.aseguradora}</td>
                      <td className="text-right font-semibold">{formatCurrency(item.valor_neto_a_pagar)}</td>
                      <td className="text-right font-semibold text-purple-600">{formatCurrency(item.saldo_pendiente_aseguradora)}</td>
                      <td className="text-right font-semibold text-green-600">{formatCurrency(item.valor_pagado_aseguradora)}</td>
                      <td className="text-sm">{item.forma_pago || '-'}</td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          {item.poliza_id && (
                            <>
                              <TableMenuItem className="text-purple-600" onClick={() => {
                                const p = polizas.find(p => p.id === String(item.poliza_id));
                                if (p) abrirModalPagoAseguradora(p);
                              }}>
                                <Icon icon="solar:card-send-bold-duotone" height={18} />
                                <span>Registrar Pago Aseg.</span>
                              </TableMenuItem>
                              <TableMenuItem className="text-red-600" onClick={() => {
                                const p = polizas.find(p => p.id === String(item.poliza_id));
                                if (p) revertirRecaudoOficina(p);
                              }}>
                                <Icon icon="solar:undo-left-bold-duotone" height={18} />
                                <span>Revertir Recaudo</span>
                              </TableMenuItem>
                              <Link to={`/apps/seguros/polizas/editar/${item.poliza_id}`}>
                                <TableMenuItem>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Póliza</span>
                                </TableMenuItem>
                              </Link>
                            </>
                          )}
                          {item.recibo && (
                            <TableMenuItem className="text-amber-600" onClick={() => setPrintFormatRecibo(item.recibo)}>
                              <Icon icon="solar:printer-bold-duotone" height={18} />
                              <span>Recibo #{item.recibo.numero_recibo}</span>
                            </TableMenuItem>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carteraItems.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay pagos pendientes a compañías</p>
                </div>
              )}
            </div>

            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} items)
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === 1} onClick={() => cambiarPagina(serverPagination.current_page - 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {serverPagination.current_page} de {serverPagination.last_page}</span>
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === serverPagination.last_page} onClick={() => cambiarPagina(serverPagination.current_page + 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          {/* TAB: Comisiones por Cobrar */}
          <Tabs.Item
            active={tabActivo === 'comisionPorCobrar'}
            title={`Comisiones por Cobrar (${contadoresTabs.comisionPorCobrar})`}
            icon={() => <Icon icon="solar:hand-money-bold-duotone" />}
          >
            <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3.5 border border-indigo-100 dark:border-indigo-800/30">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:hand-money-bold-duotone" className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">Comisión por Recibir</p>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.comision_a_recibir || 0), 0))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3.5 border border-orange-100 dark:border-orange-800/30">
                <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:clock-circle-bold-duotone" className="w-4.5 h-4.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">Items Pendientes</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-200">{carteraItems.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3.5 border border-teal-100 dark:border-teal-800/30">
                <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:user-check-bold-duotone" className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">Comisión Vendedor</p>
                  <p className="text-lg font-bold text-teal-700 dark:text-teal-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.comision_vendedor || 0), 0))}</p>
                </div>
              </div>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th>Vendedor</th>
                    <th className="text-right">Comisión a Recibir</th>
                    <th className="text-right">% Comisión</th>
                    <th className="text-right">Prima Neta</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraItems.map((item) => (
                    <tr key={item.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {item.numero_poliza}
                            {item.numero_renovacion > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                R{item.numero_renovacion}
                              </span>
                            )}
                          </div>
                          {item.numero_pago && <div className="text-xs text-gray-500">Pago #{item.numero_pago}</div>}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{item.cliente}</div>
                          <div className="text-xs text-gray-500">{item.documento}</div>
                        </div>
                      </td>
                      <td className="text-sm">{item.aseguradora}</td>
                      <td className="text-sm">{item.vendedor || '-'}</td>
                      <td className="text-right font-semibold text-indigo-600">{formatCurrency(item.comision_a_recibir)}</td>
                      <td className="text-right text-sm">{item.porcentaje_comision ? `${(item.porcentaje_comision * 100).toFixed(1)}%` : '-'}</td>
                      <td className="text-right font-semibold">{formatCurrency(item.prima_neta)}</td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          {item.poliza_id && (
                            <>
                              <TableMenuItem className="text-indigo-600" onClick={() => {
                                const p = polizas.find(p => p.id === String(item.poliza_id));
                                if (p) abrirModalCobroComision(p);
                              }}>
                                <Icon icon="solar:hand-money-bold-duotone" height={18} />
                                <span>Registrar Cobro Comisión</span>
                              </TableMenuItem>
                              <TableMenuItem className="text-red-600" onClick={async () => {
                                if (!confirm(`¿Revertir el pago de aseguradora de la póliza ${item.numero_poliza}? La póliza regresará a "Por Pagar".`)) return;
                                try {
                                  setLoading(true);
                                  const res = await api.delete(`/saas/polizas/${item.poliza_id}/pagos/revertir-aseguradora`);
                                  toast({ title: 'Pago revertido', description: res.data?.message || `Póliza ${item.numero_poliza} revertida` });
                                  await cargarCartera();
                                } catch (e: any) {
                                  toast({ title: 'Error', description: e.response?.data?.message || 'No se pudo revertir', variant: 'destructive' });
                                } finally { setLoading(false); }
                              }}>
                                <Icon icon="solar:undo-left-bold-duotone" height={18} />
                                <span>Revertir Pago Aseguradora</span>
                              </TableMenuItem>
                              <Link to={`/apps/seguros/polizas/editar/${item.poliza_id}`}>
                                <TableMenuItem>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Póliza</span>
                                </TableMenuItem>
                              </Link>
                            </>
                          )}
                          {item.recibo && (
                            <TableMenuItem className="text-amber-600" onClick={() => setPrintFormatRecibo(item.recibo)}>
                              <Icon icon="solar:printer-bold-duotone" height={18} />
                              <span>Recibo #{item.recibo.numero_recibo}</span>
                            </TableMenuItem>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carteraItems.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay comisiones pendientes por cobrar</p>
                </div>
              )}
            </div>

            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} items)
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === 1} onClick={() => cambiarPagina(serverPagination.current_page - 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {serverPagination.current_page} de {serverPagination.last_page}</span>
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === serverPagination.last_page} onClick={() => cambiarPagina(serverPagination.current_page + 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          {/* TAB: Comisiones Recibidas */}
          <Tabs.Item
            active={tabActivo === 'comisionRecibida'}
            title={`Comisiones Recibidas (${contadoresTabs.comisionRecibida})`}
            icon={() => <Icon icon="solar:check-circle-bold-duotone" />}
          >
            <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 rounded-xl p-3.5 border border-green-100 dark:border-green-800/30">
                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-4.5 h-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">Comisión Recibida Total</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.comision_recibida || 0), 0))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-100 dark:border-blue-800/30">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:bill-check-bold-duotone" className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Pagos Comisionados</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-200">{carteraItems.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3.5 border border-teal-100 dark:border-teal-800/30">
                <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:user-check-bold-duotone" className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">Comisión Vendedor Pagada</p>
                  <p className="text-lg font-bold text-teal-700 dark:text-teal-200">{formatCurrency(carteraItems.reduce((sum, i) => sum + (i.comision_vendedor || 0), 0))}</p>
                </div>
              </div>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th className="text-right">Comisión Recibida</th>
                    <th className="text-right">% Comisión</th>
                    <th>Fecha Comisionada</th>
                    <th>Vendedor</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraItems.map((item) => (
                    <tr key={item.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {item.numero_poliza}
                            {item.numero_renovacion > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                R{item.numero_renovacion}
                              </span>
                            )}
                          </div>
                          {item.numero_pago && <div className="text-xs text-gray-500">Pago #{item.numero_pago}</div>}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{item.cliente}</div>
                          <div className="text-xs text-gray-500">{item.documento}</div>
                        </div>
                      </td>
                      <td className="text-sm">{item.aseguradora}</td>
                      <td className="text-right font-semibold text-green-600">{formatCurrency(item.comision_recibida)}</td>
                      <td className="text-right text-sm">{item.porcentaje_comision ? `${(item.porcentaje_comision * 100).toFixed(1)}%` : '-'}</td>
                      <td className="text-sm">{item.fecha_comisionada ? formatDate(item.fecha_comisionada) : '-'}</td>
                      <td className="text-sm">{item.vendedor || '-'}</td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          {item.poliza_id && (
                            <>
                              <TableMenuItem className="text-red-600" onClick={() => revertirCobroComision(item)}>
                                <Icon icon="solar:undo-left-bold-duotone" height={18} />
                                <span>Revertir Cobro</span>
                              </TableMenuItem>
                              <Link to={`/apps/seguros/polizas/editar/${item.poliza_id}`}>
                                <TableMenuItem>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Póliza</span>
                                </TableMenuItem>
                              </Link>
                            </>
                          )}
                          {item.cliente_id && (
                            <Link to={`/apps/seguros/clientes/editar/${item.cliente_id}`}>
                              <TableMenuItem>
                                <Icon icon="solar:user-bold-duotone" height={18} />
                                <span>Ver Cliente</span>
                              </TableMenuItem>
                            </Link>
                          )}
                          {item.recibo && (
                            <TableMenuItem className="text-amber-600" onClick={() => setPrintFormatRecibo(item.recibo)}>
                              <Icon icon="solar:printer-bold-duotone" height={18} />
                              <span>Recibo #{item.recibo.numero_recibo}</span>
                            </TableMenuItem>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carteraItems.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay comisiones recibidas</p>
                </div>
              )}
            </div>

            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} items)
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === 1} onClick={() => cambiarPagina(serverPagination.current_page - 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {serverPagination.current_page} de {serverPagination.last_page}</span>
                  <Button size="sm" color="gray" disabled={loading || serverPagination.current_page === serverPagination.last_page} onClick={() => cambiarPagina(serverPagination.current_page + 1)} className="rounded-[10px]">
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Modal de Detalle de Póliza */}
      <Modal show={showDetalleModal} onClose={() => setShowDetalleModal(false)} size="4xl">
        <Modal.Header>
          Detalle de Póliza - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          {polizaSeleccionada && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Información General</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Número:</span>
                    <span className="font-medium">{polizaSeleccionada.numeroPoliza}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{polizaSeleccionada.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Aseguradora:</span>
                    <span className="font-medium">{polizaSeleccionada.aseguradora}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ramo:</span>
                    <span className="font-medium">{polizaSeleccionada.ramo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge color={getEstadoColor(polizaSeleccionada.estado)}>
                      {polizaSeleccionada.estado}
                    </Badge>
                  </div>
                </div>
              </Card>

              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Valores</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prima Neta:</span>
                    <span className="font-semibold">{formatCurrency(polizaSeleccionada.primaNeta)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IVA:</span>
                    <span className="font-medium">{formatCurrency(polizaSeleccionada.iva)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-semibold">Total:</span>
                    <span className="font-bold">{formatCurrency(polizaSeleccionada.total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Comisión:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada.comision)}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Cuentas por Cobrar</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recaudado:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada.valorRecaudado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pendiente:</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(polizaSeleccionada.valorPendienteCliente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge color={getEstadoPagoColor(polizaSeleccionada.estadoPago)}>
                      {polizaSeleccionada.estadoPago}
                    </Badge>
                  </div>

                  {/* Detalle por tipos de recaudo */}
                  <div className="border-t pt-3 mt-3">
                    <h5 className="font-medium text-gray-800 mb-2">Detalle por Tipo de Recaudo</h5>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="text-blue-800 font-medium">Recaudo Oficina:</span>
                        <div className="text-right">
                          <div className="text-sm text-blue-600">Recaudado: {formatCurrency(polizaSeleccionada.recaudo_oficina?.recaudado || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.recaudo_oficina?.pendiente || 0)}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                        <span className="text-purple-800 font-medium">Pago Pendiente:</span>
                        <div className="text-right">
                          <div className="text-sm text-purple-600">Pagado: {formatCurrency(polizaSeleccionada.recaudo_aseguradora?.pagado || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.recaudo_aseguradora?.pendiente || 0)}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                        <span className="text-indigo-800 font-medium">Cobro Comisión:</span>
                        <div className="text-right">
                          <div className="text-sm text-indigo-600">Cobrado: {formatCurrency(polizaSeleccionada.cobro_comision?.cobrada || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.cobro_comision?.pendiente || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Link to={`/apps/seguros/polizas/editar/${polizaSeleccionada?.id}`}>
            <Button color="blue">
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar Póliza
            </Button>
          </Link>
          <Button color="gray" onClick={() => setShowDetalleModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago Oficina */}
      <Modal show={showPagoOficinaModal} onClose={() => setShowPagoOficinaModal(false)} size="md">
        <Modal.Header>
          Registrar Pago por Oficina - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total de la póliza:</span>
                <span className="font-semibold">{formatCurrency(polizaSeleccionada?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ya recaudado:</span>
                <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada?.recaudo_oficina?.recaudado || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Pendiente por cobrar:</span>
                <span className="font-bold text-orange-600">{formatCurrency(polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Recaudar *
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => {
                  const val = e.target.value;
                  setMontoPago(val);
                }}
                placeholder="Ingrese el monto a recaudar"
                className={`w-full ${parseFloat(montoPago) > (polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) ? 'border-red-500 ring-red-500' : ''}`}
                min={0}
                max={polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0}
              />
              {parseFloat(montoPago) > (polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) ? (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  El monto supera el saldo pendiente de {formatCurrency(polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Puede ingresar un monto parcial. El resto quedará pendiente.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar método</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Pago
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Pago
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de recibo, comprobante, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowPagoOficinaModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="blue"
            onClick={registrarPagoOficina}
            disabled={procesandoPago || !montoPago || parseFloat(montoPago) <= 0 || parseFloat(montoPago) > (polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) + 0.01}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago Aseguradora */}
      <Modal show={showPagoAseguradoraModal} onClose={() => setShowPagoAseguradoraModal(false)} size="md">
        <Modal.Header>
          Registrar Pago a Aseguradora - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Valor neto a pagar:</span>
                <span className="font-semibold">{formatCurrency(polizaSeleccionada?.recaudo_aseguradora?.total || polizaSeleccionada?.valorPendienteAseguradora || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ya pagado:</span>
                <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada?.recaudo_aseguradora?.pagado || polizaSeleccionada?.valorPagadoAseguradora || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-purple-200 dark:border-purple-700 pt-2 mt-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Pendiente por pagar:</span>
                <span className="font-bold text-orange-600">{formatCurrency(polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Pagar *
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto a pagar a la aseguradora"
                className={`w-full ${parseFloat(montoPago) > (polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0) ? 'border-red-500 ring-red-500' : ''}`}
                min={0}
                max={polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0}
              />
              {parseFloat(montoPago) > (polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0) ? (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  El monto supera el saldo pendiente de {formatCurrency(polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Puede ingresar un monto parcial.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar método</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="debito_automatico">Débito Automático</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Pago
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Pago
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de póliza aseguradora, recibo, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowPagoAseguradoraModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="purple"
            onClick={registrarPagoAseguradora}
            disabled={procesandoPago || !montoPago || parseFloat(montoPago) <= 0 || parseFloat(montoPago) > (polizaSeleccionada?.recaudo_aseguradora?.pendiente || polizaSeleccionada?.valorPendienteAseguradora || 0) + 0.01}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Recaudo Directo por Aseguradora */}
      <Modal show={showRecaudoAseguradoraDirectoModal} onClose={() => setShowRecaudoAseguradoraDirectoModal(false)} size="md">
        <Modal.Header>
          Recaudo Directo por Aseguradora - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Nota:</strong> Este tipo de recaudo se usa cuando la aseguradora cobra directamente al cliente. 
                La póliza irá directamente a "Recaudos Completados".
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total de la póliza:</span>
                <span className="font-semibold">{formatCurrency(polizaSeleccionada?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ya recaudado:</span>
                <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada?.valorRecaudado || polizaSeleccionada?.recaudo_oficina?.recaudado || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Pendiente:</span>
                <span className="font-bold text-orange-600">{formatCurrency(polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Recaudado *
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto recaudado por la aseguradora"
                className={`w-full ${parseFloat(montoPago) > (polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) ? 'border-red-500 ring-red-500' : ''}`}
                min={0}
                max={polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0}
              />
              {parseFloat(montoPago) > (polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) ? (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  El monto supera el saldo pendiente de {formatCurrency(polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Puede ingresar un monto parcial.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar método</option>
                <option value="debito_automatico">Débito Automático</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Recaudo
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de recibo, comprobante, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowRecaudoAseguradoraDirectoModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="purple"
            onClick={registrarRecaudoAseguradoraDirecto}
            disabled={procesandoPago || !montoPago || parseFloat(montoPago) <= 0 || parseFloat(montoPago) > (polizaSeleccionada?.valorPendienteCliente || polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0) + 0.01}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Recaudo
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Importación de Recaudos */}
      <Modal show={showRecaudoMasivoModal} onClose={() => { setShowRecaudoMasivoModal(false); resetearImportacion(); }} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:upload-bold-duotone" className="w-6 h-6 text-purple-600" />
            Importar Recaudos desde CSV/Excel
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Paso 1: Subir archivo */}
            {pasoImportacion === 'subir' && (
              <>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-purple-500', 'bg-purple-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleArchivoImportacion(files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('import-file-upload')?.click()}
                >
                  <Icon icon="solar:upload-bold-duotone" className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={(e) => handleArchivoImportacion(e.target.files?.[0] || null)}
                    className="hidden"
                    id="import-file-upload"
                  />
                  <p className="text-lg font-medium text-gray-700">Arrastre un archivo aquí o haga clic para seleccionar</p>
                  <p className="text-sm text-gray-500 mt-1">Formatos soportados: CSV, TXT (separado por comas, punto y coma o tabulador)</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-700 mb-2">Instrucciones:</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• El archivo debe tener una fila de encabezados</li>
                    <li>• Columna requerida: <code className="bg-blue-100 px-1 rounded">numero_poliza</code> o similar</li>
                    <li>• Columnas opcionales: monto, fecha_pago, metodo_pago, referencia</li>
                    <li>• Se detectará automáticamente el separador (coma, punto y coma o tab)</li>
                  </ul>
                </div>
              </>
            )}

            {/* Paso 2: Mapear columnas */}
            {pasoImportacion === 'mapear' && (
              <>
                <div className="bg-green-50 p-3 rounded-lg mb-4">
                  <p className="text-green-700">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 inline mr-2" />
                    Archivo cargado: <strong>{archivoImportacion?.name}</strong> ({datosImportacion.length} registros)
                  </p>
                </div>

                <h4 className="font-semibold text-gray-700 mb-3">Mapear Columnas</h4>
                <p className="text-sm text-gray-600 mb-4">Seleccione qué columna del archivo corresponde a cada campo:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Póliza <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapeoColumnas.numero_poliza || ''}
                      onChange={(e) => setMapeoColumnas({ ...mapeoColumnas, numero_poliza: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- Seleccionar columna --</option>
                      {columnasArchivo.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto (opcional)</label>
                    <select
                      value={mapeoColumnas.monto || ''}
                      onChange={(e) => setMapeoColumnas({ ...mapeoColumnas, monto: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- No mapear --</option>
                      {columnasArchivo.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago (opcional)</label>
                    <select
                      value={mapeoColumnas.fecha_pago || ''}
                      onChange={(e) => setMapeoColumnas({ ...mapeoColumnas, fecha_pago: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- No mapear --</option>
                      {columnasArchivo.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago (opcional)</label>
                    <select
                      value={mapeoColumnas.metodo_pago || ''}
                      onChange={(e) => setMapeoColumnas({ ...mapeoColumnas, metodo_pago: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- No mapear --</option>
                      {columnasArchivo.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (opcional)</label>
                    <select
                      value={mapeoColumnas.referencia || ''}
                      onChange={(e) => setMapeoColumnas({ ...mapeoColumnas, referencia: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">-- No mapear --</option>
                      {columnasArchivo.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selector de tipo de recaudo destacado */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <label className="block text-sm font-semibold text-purple-800 mb-3">
                    <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 inline mr-2" />
                    Tipo de Recaudo a Aplicar
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        tipoRecaudoImportacion === 'oficina' 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 bg-white hover:border-orange-300'
                      }`}
                      onClick={() => setTipoRecaudoImportacion('oficina')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input 
                          type="radio" 
                          checked={tipoRecaudoImportacion === 'oficina'} 
                          onChange={() => setTipoRecaudoImportacion('oficina')}
                          className="w-4 h-4 text-orange-600"
                        />
                        <span className="font-semibold text-gray-800">Recaudo por Oficina</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Las pólizas pasarán al tab <strong>"Por Pagar"</strong> (pendiente pago a aseguradora)
                      </p>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        tipoRecaudoImportacion === 'aseguradora_directo' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-white hover:border-green-300'
                      }`}
                      onClick={() => setTipoRecaudoImportacion('aseguradora_directo')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input 
                          type="radio" 
                          checked={tipoRecaudoImportacion === 'aseguradora_directo'} 
                          onChange={() => setTipoRecaudoImportacion('aseguradora_directo')}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="font-semibold text-gray-800">Recaudo Directo Aseguradora</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Las pólizas irán directamente a <strong>"Recaudos Completados"</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vista previa */}
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-700 mb-3">Vista Previa (primeros 5 registros)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Fila</th>
                          <th className="px-3 py-2 text-left">Número Póliza</th>
                          <th className="px-3 py-2 text-left">Monto</th>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Método</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosImportacion.slice(0, 5).map((fila, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 text-gray-500">{fila._fila}</td>
                            <td className="px-3 py-2 font-medium">{mapeoColumnas.numero_poliza ? fila[mapeoColumnas.numero_poliza] : '-'}</td>
                            <td className="px-3 py-2">{mapeoColumnas.monto ? fila[mapeoColumnas.monto] : '-'}</td>
                            <td className="px-3 py-2">{mapeoColumnas.fecha_pago ? fila[mapeoColumnas.fecha_pago] : '-'}</td>
                            <td className="px-3 py-2">{mapeoColumnas.metodo_pago ? fila[mapeoColumnas.metodo_pago] : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Paso 3: Procesando */}
            {pasoImportacion === 'procesando' && (
              <div className="py-8">
                <div className="text-center mb-6">
                  <Spinner size="xl" className="mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700">Procesando recaudos...</p>
                </div>
                
                {/* Barra de progreso */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progreso: {progresoImportacion.procesados} de {progresoImportacion.total}</span>
                    <span>{progresoImportacion.total > 0 ? Math.round((progresoImportacion.procesados / progresoImportacion.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${progresoImportacion.total > 0 ? (progresoImportacion.procesados / progresoImportacion.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Contadores en tiempo real */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{progresoImportacion.procesados}</p>
                    <p className="text-sm text-blue-700">Procesados</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{progresoImportacion.exitosos}</p>
                    <p className="text-sm text-green-700">Exitosos</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{progresoImportacion.fallidos}</p>
                    <p className="text-sm text-red-700">Con errores</p>
                  </div>
                </div>

                {/* Última póliza procesada */}
                {progresoImportacion.ultimaPoliza && (
                  <div className="text-center text-sm text-gray-500">
                    Procesando: <span className="font-mono font-medium">{progresoImportacion.ultimaPoliza}</span>
                  </div>
                )}
              </div>
            )}

            {/* Paso 4: Resultado */}
            {pasoImportacion === 'resultado' && resultadoImportacion && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold text-green-600">{resultadoImportacion.exitosos}</p>
                    <p className="text-sm text-green-700">Recaudos exitosos</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <Icon icon="solar:close-circle-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-red-500" />
                    <p className="text-2xl font-bold text-red-600">{resultadoImportacion.fallidos}</p>
                    <p className="text-sm text-red-700">Con errores</p>
                  </div>
                </div>

                {resultadoImportacion.errores.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-red-700">Detalle de Errores</h4>
                      <Button size="sm" color="red" onClick={descargarInformeErrores}>
                        <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
                        Descargar Informe
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-red-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Fila</th>
                            <th className="px-3 py-2 text-left">Póliza</th>
                            <th className="px-3 py-2 text-left">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoImportacion.errores.slice(0, 10).map((error, idx) => (
                            <tr key={idx} className="border-t border-red-200">
                              <td className="px-3 py-2">{error.fila}</td>
                              <td className="px-3 py-2 font-medium">{error.poliza || '-'}</td>
                              <td className="px-3 py-2 text-red-600">{error.motivo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {resultadoImportacion.errores.length > 10 && (
                        <p className="text-sm text-red-600 mt-2 text-center">
                          ... y {resultadoImportacion.errores.length - 10} errores más. Descargue el informe para ver todos.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => { setShowRecaudoMasivoModal(false); resetearImportacion(); }}
            disabled={procesandoRecaudoMasivo}
          >
            {pasoImportacion === 'resultado' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {pasoImportacion === 'mapear' && (
            <>
              <Button color="gray" onClick={() => setPasoImportacion('subir')}>
                <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <Button
                color="purple"
                onClick={ejecutarImportacionRecaudos}
                disabled={!mapeoColumnas.numero_poliza}
              >
                <Icon icon="solar:play-bold-duotone" className="w-4 h-4 mr-2" />
                Procesar {datosImportacion.length} Registros
              </Button>
            </>
          )}
          {pasoImportacion === 'resultado' && (
            <Button color="purple" onClick={resetearImportacion}>
              <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
              Nueva Importación
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Modal Historial de Importaciones */}
      <Modal show={showHistorialImportaciones} onClose={() => setShowHistorialImportaciones(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:history-bold-duotone" className="w-6 h-6 text-purple-600" />
            Historial de Importaciones de Recaudos
          </div>
        </Modal.Header>
        <Modal.Body>
          {cargandoHistorial ? (
            <div className="flex justify-center py-8">
              <Spinner size="xl" />
            </div>
          ) : historialImportaciones.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No hay importaciones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Archivo</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-center">Exitosos</th>
                    <th className="px-3 py-2 text-center">Fallidos</th>
                    <th className="px-3 py-2 text-right">Monto Total</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialImportaciones.map((imp: any) => (
                    <tr key={imp.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-500">#{imp.id}</td>
                      <td className="px-3 py-2 font-medium truncate max-w-[150px]" title={imp.filename}>
                        {imp.filename || 'Sin nombre'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge color={imp.tipo_recaudo === 'oficina' ? 'warning' : 'success'}>
                          {imp.tipo_recaudo === 'oficina' ? 'Oficina' : 'Aseguradora'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center text-green-600 font-medium">{imp.exitosos}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-medium">{imp.fallidos}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(imp.monto_total_importado || 0)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{imp.created_at}</td>
                      <td className="px-3 py-2 text-center">
                        {imp.status === 'reverted' ? (
                          <Badge color="gray">Revertida</Badge>
                        ) : imp.status === 'completed' ? (
                          <Badge color="success">Completada</Badge>
                        ) : (
                          <Badge color="warning">{imp.status}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {imp.fallidos > 0 && (imp.errores || []).length > 0 && (
                            <Button
                              size="xs"
                              color="gray"
                              onClick={() => descargarInformeErroresHistorial(imp)}
                              title="Descargar informe de errores"
                            >
                              <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-1" />
                              Errores
                            </Button>
                          )}
                          {imp.can_revert && (
                            <Button
                              size="xs"
                              color="failure"
                              onClick={() => revertirImportacionMasiva(imp.id)}
                              disabled={revertiendoImportacion === imp.id}
                            >
                              {revertiendoImportacion === imp.id ? (
                                <Spinner size="xs" className="mr-1" />
                              ) : (
                                <Icon icon="solar:undo-left-bold-duotone" className="w-4 h-4 mr-1" />
                              )}
                              Revertir
                            </Button>
                          )}
                          {imp.reverted_at && (
                            <span className="text-xs text-gray-500">
                              Revertida: {imp.reverted_at}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowHistorialImportaciones(false)}>
            Cerrar
          </Button>
          <Button color="purple" onClick={cargarHistorialImportaciones} disabled={cargandoHistorial}>
            <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Cobro Comisión */}
      <Modal show={showCobroComisionModal} onClose={() => setShowCobroComisionModal(false)} size="md">
        <Modal.Header>
          Registrar Cobro de Comisión - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Comisión total:</span>
                <span className="font-semibold">{formatCurrency(polizaSeleccionada?.cobro_comision?.total || polizaSeleccionada?.comision || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ya cobrada:</span>
                <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada?.cobro_comision?.cobrada || polizaSeleccionada?.comisionCobrada || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-green-200 dark:border-green-700 pt-2 mt-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Pendiente por cobrar:</span>
                <span className="font-bold text-orange-600">{formatCurrency(polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Cobrar *
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto de la comisión a cobrar"
                className={`w-full ${parseFloat(montoPago) > (polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0) ? 'border-red-500 ring-red-500' : ''}`}
                min={0}
                max={polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0}
              />
              {parseFloat(montoPago) > (polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0) ? (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  El monto supera la comisión pendiente de {formatCurrency(polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Puede ingresar un monto parcial.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Cobro
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Cobro
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de recibo, comprobante, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales del cobro"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowCobroComisionModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="green"
            onClick={registrarCobroComision}
            disabled={procesandoPago || !montoPago || parseFloat(montoPago) <= 0 || parseFloat(montoPago) > (polizaSeleccionada?.cobro_comision?.pendiente || polizaSeleccionada?.comisionPendiente || 0) + 0.01}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Cobro
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Cartera por Cliente */}
      <Modal show={showCarteraClienteModal} onClose={() => setShowCarteraClienteModal(false)} size="4xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:wallet-money-bold-duotone" className="w-6 h-6 text-blue-600" />
            <div>
              <div className="font-semibold">Cartera de {clienteSeleccionado?.cliente}</div>
              <div className="text-sm text-gray-500 font-normal">{clienteSeleccionado?.documento}</div>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {/* Resumen del cliente */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Pólizas</p>
              <p className="text-2xl font-bold text-blue-600">{clienteSeleccionado?.polizas || 0}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Prima Total</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(clienteSeleccionado?.primaTotal || 0)}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Por Cobrar</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(clienteSeleccionado?.porCobrar || 0)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Comisiones</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(clienteSeleccionado?.comisiones || 0)}</p>
            </div>
          </div>

          {/* Tabla de pólizas del cliente */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Pólizas y Estado de Recaudo</h4>
            </div>
            <div className="guro-table-wrap max-h-96">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Aseguradora</th>
                    <th>Ramo</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Recaudo Oficina</th>
                    <th className="text-center">Pago Aseg.</th>
                    <th className="text-center">Comisión</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {polizasCliente.map((poliza) => (
                    <tr key={poliza.id} className="group">
                      <td>
                        <div>
                          <div className="font-medium text-sm">{poliza.numeroPoliza}</div>
                          <div className="text-xs text-gray-500">Vence: {formatDate(poliza.fechaVencimiento)}</div>
                        </div>
                      </td>
                      <td className="text-sm">{poliza.aseguradora}</td>
                      <td className="text-sm">{poliza.ramo}</td>
                      <td className="text-right font-semibold">{formatCurrency(poliza.total)}</td>
                      <td className="text-center">
                        <div className="space-y-1">
                          {(poliza.recaudo_oficina?.pendiente || poliza.total || 0) > 0 ? (
                            <>
                              <div className="text-xs text-orange-600 font-semibold">
                                Pend: {formatCurrency(poliza.recaudo_oficina?.pendiente || poliza.total || 0)}
                              </div>
                              <div className="text-xs text-green-600">
                                Rec: {formatCurrency(poliza.recaudo_oficina?.recaudado || 0)}
                              </div>
                            </>
                          ) : (
                            <Badge color="success" size="xs">Completo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="space-y-1">
                          {(poliza.recaudo_aseguradora?.pendiente || 0) > 0 ? (
                            <>
                              <div className="text-xs text-purple-600 font-semibold">
                                Pend: {formatCurrency(poliza.recaudo_aseguradora?.pendiente || 0)}
                              </div>
                              <div className="text-xs text-green-600">
                                Pag: {formatCurrency(poliza.recaudo_aseguradora?.pagado || 0)}
                              </div>
                            </>
                          ) : (poliza.recaudo_aseguradora?.pagado || 0) > 0 ? (
                            <Badge color="success" size="xs">Pagado</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="space-y-1">
                          {(poliza.cobro_comision?.pendiente || 0) > 0 ? (
                            <>
                              <div className="text-xs text-indigo-600 font-semibold">
                                Pend: {formatCurrency(poliza.cobro_comision?.pendiente || 0)}
                              </div>
                              <div className="text-xs text-green-600">
                                Cob: {formatCurrency(poliza.cobro_comision?.cobrada || 0)}
                              </div>
                            </>
                          ) : (poliza.cobro_comision?.cobrada || 0) > 0 ? (
                            <Badge color="success" size="xs">Cobrado</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="sticky-right">
                        <div className="flex gap-1 justify-center">
                          {(poliza.recaudo_oficina?.pendiente || poliza.total || 0) > 0 && (
                            <Button
                              size="xs"
                              color="blue"
                              onClick={() => {
                                setShowCarteraClienteModal(false);
                                abrirModalPagoOficina(poliza);
                              }}
                              title="Registrar Recaudo"
                            >
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4" />
                            </Button>
                          )}
                          {(poliza.recaudo_aseguradora?.pendiente || 0) > 0 && (
                            <Button
                              size="xs"
                              color="purple"
                              onClick={() => {
                                setShowCarteraClienteModal(false);
                                abrirModalPagoAseguradora(poliza);
                              }}
                              title="Pagar Aseguradora"
                            >
                              <Icon icon="solar:building-bold-duotone" className="w-4 h-4" />
                            </Button>
                          )}
                          {(poliza.cobro_comision?.pendiente || 0) > 0 && (
                            <Button
                              size="xs"
                              color="green"
                              onClick={() => {
                                setShowCarteraClienteModal(false);
                                abrirModalCobroComision(poliza);
                              }}
                              title="Cobrar Comisión"
                            >
                              <Icon icon="solar:hand-money-bold-duotone" className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leyenda de flujo de recaudación */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Flujo de Recaudación:</h5>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>1. Cliente paga a Oficina</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>2. Oficina paga a Aseguradora</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>3. Aseguradora paga Comisión</span>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCarteraClienteModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Imprimir Recibo */}
      <Modal show={!!reciboParaImprimir} onClose={() => setReciboParaImprimir(null)} size="md">
        <Modal.Header>
          Recibo #{reciboParaImprimir?.numero_recibo} generado
        </Modal.Header>
        <Modal.Body>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Icon icon="solar:check-circle-bold-duotone" className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Recibo generado exitosamente</p>
              <p className="text-sm text-gray-500 mt-1">
                Recibo #{reciboParaImprimir?.numero_recibo} — {reciboParaImprimir?.cliente_nombre}
              </p>
              {reciboParaImprimir?.poliza_numero && (
                <p className="text-sm text-gray-500">Póliza: {reciboParaImprimir.poliza_numero}</p>
              )}
              <p className="text-lg font-bold text-green-600 mt-2">
                {formatCurrency(reciboParaImprimir?.valor_recaudado_en_oficina || reciboParaImprimir?.valor_a_pagar || 0)}
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex gap-2 w-full justify-end">
            <Button color="blue" onClick={() => {
              if (reciboParaImprimir) {
                const data: ReciboPrintData = {
                  numero_recibo: reciboParaImprimir.numero_recibo,
                  fecha: reciboParaImprimir.fecha,
                  cliente_nombre: reciboParaImprimir.cliente_nombre,
                  cliente_documento: reciboParaImprimir.cliente_documento,
                  poliza_numero: reciboParaImprimir.poliza_numero,
                  aseguradora_nombre: reciboParaImprimir.aseguradora_nombre,
                  ramo_nombre: reciboParaImprimir.ramo_nombre,
                  forma_pago: reciboParaImprimir.forma_pago,
                  moneda: 'COP',
                  valor_recaudado_en_oficina: reciboParaImprimir.valor_recaudado_en_oficina || reciboParaImprimir.valor_a_pagar || 0,
                  es_anticipo: reciboParaImprimir.es_anticipo || false,
                  observaciones: reciboParaImprimir.observaciones,
                };
                const broker: BrokerPrintData = brokerInfo || { nombre: 'Agencia de Seguros', nit: '' };
                printRecibo(data, broker, 'media_carta');
              }
            }}>
              <Icon icon="solar:printer-bold-duotone" className="w-4 h-4 mr-2" />
              Imprimir Media Carta
            </Button>
            <Button color="purple" onClick={() => {
              if (reciboParaImprimir) {
                const data: ReciboPrintData = {
                  numero_recibo: reciboParaImprimir.numero_recibo,
                  fecha: reciboParaImprimir.fecha,
                  cliente_nombre: reciboParaImprimir.cliente_nombre,
                  cliente_documento: reciboParaImprimir.cliente_documento,
                  poliza_numero: reciboParaImprimir.poliza_numero,
                  aseguradora_nombre: reciboParaImprimir.aseguradora_nombre,
                  ramo_nombre: reciboParaImprimir.ramo_nombre,
                  forma_pago: reciboParaImprimir.forma_pago,
                  moneda: 'COP',
                  valor_recaudado_en_oficina: reciboParaImprimir.valor_recaudado_en_oficina || reciboParaImprimir.valor_a_pagar || 0,
                  es_anticipo: reciboParaImprimir.es_anticipo || false,
                  observaciones: reciboParaImprimir.observaciones,
                };
                const broker: BrokerPrintData = brokerInfo || { nombre: 'Agencia de Seguros', nit: '' };
                printRecibo(data, broker, 'carta');
              }
            }}>
              <Icon icon="solar:printer-bold-duotone" className="w-4 h-4 mr-2" />
              Imprimir Carta
            </Button>
            <Button color="gray" onClick={() => setReciboParaImprimir(null)}>
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Print Format Selection Modal */}
      <Modal show={!!printFormatRecibo} onClose={() => setPrintFormatRecibo(null)} size="sm">
        <Modal.Header>
          <span className="flex items-center gap-2">
            <Icon icon="solar:printer-bold-duotone" className="w-5 h-5 text-blue-500" />
            Imprimir Recibo #{printFormatRecibo?.numero_recibo}
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona el formato de impresión:</p>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => { if (printFormatRecibo) { imprimirReciboDeItem(printFormatRecibo, 'media_carta'); setPrintFormatRecibo(null); } }}
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:document-bold-duotone" className="text-blue-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-600">Media Carta</p>
                <p className="text-xs text-gray-400">Sin copia, tamaño reducido</p>
              </div>
            </button>
            <button
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
              onClick={() => { if (printFormatRecibo) { imprimirReciboDeItem(printFormatRecibo, 'carta'); setPrintFormatRecibo(null); } }}
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Icon icon="solar:copy-bold-duotone" className="text-indigo-500 text-2xl" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600">Carta Completa (con copia)</p>
                <p className="text-xs text-gray-400">Original + copia en hoja completa</p>
              </div>
            </button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default CarteraClientes;

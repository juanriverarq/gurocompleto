import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Button,
  Spinner,
  Badge,
  Table,
  Tabs,
  Modal,
  Dropdown,
} from 'flowbite-react';
import GuroLoader from 'src/components/GuroLoader';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';
import { auth } from 'src/config/firebase';
import api from 'src/config/api';
import { onAuthStateChanged, User } from 'firebase/auth';

interface PolizaCartera {
  id: string;
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
    // Nuevos campos para tipos de recaudo
    recaudo_oficina?: {
      recaudado: number;
      pendiente: number;
      total: number;
      pago_id?: string;
      historial?: {
        id: number;
        monto: number;
        fecha: string;
        metodo_pago: string;
        referencia: string;
        estado: string;
        observaciones: string;
      }[];
    };
    recaudo_aseguradora?: {
      pagado: number;
      pendiente: number;
      total: number;
      pago_id?: string;
    };
    cobro_comision?: {
      cobrada: number;
      pendiente: number;
      total: number;
    };
}

interface EstadisticasCartera {
  totalPolizas: number;
  polizasActivas: number;
  polizasVencidas: number;
  polizasPorVencer: number;
  primaTotal: number;
  comisionesTotal: number;
  porCobrarTotal: number;
  porCobrarVencido: number;
  recaudadoTotal: number;
  tasaRecaudo: number;
}

const CarteraClientes = () => {
  const [polizas, setPolizas] = useState<PolizaCartera[]>([]);
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

  const [tabActivo, setTabActivo] = useState<'general' | 'porCobrar' | 'porPagar' | 'recaudosCompletados'>('general');
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
    recaudosCompletados: number;
  }>({ general: 0, porCobrar: 0, porPagar: 0, recaudosCompletados: 0 });

  // Cargar datos con paginación del servidor (solo pólizas)
  const cargarCartera = async (
    page: number = 1,
    search: string = '',
    tab: 'general' | 'porCobrar' | 'porPagar' | 'recaudosCompletados' = tabActivo,
  ) => {
    try {
      setLoading(true);
      // Para tab "general" cargar más registros para consolidar todos los clientes
      // Para otros tabs, usar paginación normal de 25
      const perPage = tab === 'general' ? 1000 : 25;
      
      const response = await polizaService.getCarteraPolizas(page, perPage, search, tab);
      
      if (!response.success || !response.data) {
        setPolizas([]);
        return;
      }

      const polizasData = Array.isArray(response.data) ? response.data : [];
      
      // Actualizar paginación del servidor
      if (response.pagination) {
        setServerPagination(response.pagination);
      }

      // Actualizar estadísticas si vienen en la respuesta
      if (response.estadisticas) {
        setEstadisticas({
          ...response.estadisticas,
          polizasVencidas: 0,
          polizasPorVencer: 0,
          porCobrarVencido: 0,
        });
      }

      // Actualizar contadores de tabs si vienen en la respuesta
      if (response.contadoresTabs) {
        setContadoresTabs({
          general: response.contadoresTabs.general ?? 0,
          porCobrar: response.contadoresTabs.porCobrar ?? 0,
          porPagar: response.contadoresTabs.porPagar ?? 0,
          recaudosCompletados: response.contadoresTabs.recaudosCompletados ?? 0,
        });
      }

      // OPTIMIZACIÓN: Procesamiento simplificado ya que los datos vienen optimizados del backend
      const carteraPolizas: PolizaCartera[] = polizasData.map((poliza: any) => {
        // Calcular valores financieros basados en datos del backend
        const primaNeta = poliza.prima_neta;
        const iva = poliza.iva;
        const total = poliza.total;
        const comision = poliza.comision;

        // Calcular estado de pago basado en datos del backend
        let estadoPago: 'Al día' | 'Pendiente' | 'Vencido' | 'Parcial' = poliza.estado_pago || 'Al día';
        let valorRecaudado = total;
        let valorPendienteCliente = 0;
        let valorPagadoAseguradora = primaNeta;
        let valorPendienteAseguradora = 0;
        let diasMora = 0;

        // Ajustar valores según estado de pago
        switch (estadoPago) {
          case 'Pendiente':
            valorRecaudado = 0;
            valorPendienteCliente = total;
            valorPagadoAseguradora = 0;
            valorPendienteAseguradora = primaNeta;
            break;
          case 'Parcial':
            valorRecaudado = total * 0.5;
            valorPendienteCliente = total * 0.5;
            valorPagadoAseguradora = primaNeta * 0.5;
            valorPendienteAseguradora = primaNeta * 0.5;
            break;
          case 'Vencido':
            valorRecaudado = 0;
            valorPendienteCliente = total;
            valorPagadoAseguradora = 0;
            valorPendienteAseguradora = primaNeta;
            diasMora = Math.max(0, -poliza.dias_vencimiento);
            break;
        }

        return {
          id: String(poliza.id),
          numeroPoliza: poliza.numero_poliza || poliza.policy_number || '',
          cliente: poliza.cliente,
          clienteId: String(poliza.cliente_id),
          documento: poliza.documento,
          aseguradora: poliza.aseguradora,
          ramo: poliza.ramo,
          estado: poliza.estado,
          fechaInicio: poliza.fecha_inicio,
          fechaVencimiento: poliza.fecha_vencimiento,
          diasVencimiento: poliza.dias_vencimiento,
          primaNeta,
          iva,
          total,
          comision,
          formaPago: poliza.forma_pago,
          valorPendienteCliente,
          valorPendienteAseguradora,
          valorRecaudado,
          valorPagadoAseguradora,
          comisionReal: comision,
          comisionPendiente: estadoPago !== 'Al día' ? comision * 0.5 : 0,
          comisionCobrada: estadoPago === 'Al día' ? comision : 0,
          estadoPago,
          diasMora,
          vendedor: poliza.vendedor,
          vendedor_id: poliza.vendedor_id,
          // Nuevos campos de tipos de recaudo
          recaudo_oficina: poliza.recaudo_oficina,
          recaudo_aseguradora: poliza.recaudo_aseguradora,
          cobro_comision: poliza.cobro_comision,
        };
      });

      // OPTIMIZACIÓN: Ya no necesitamos filtrar en frontend porque el backend filtra por estado ACTIVA
      setPolizas(carteraPolizas);
      // No recalculamos estadísticas aquí para mantener los totales globales del servidor
      // calcularEstadisticas(carteraPolizas);

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
    // El monto es el total de la póliza ya que es recaudo directo
    setMontoPago((poliza.total || 0).toString());
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

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'oficina',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Recaudo registrado',
          description: 'El recaudo por oficina ha sido registrado exitosamente',
        });
        setShowPagoOficinaModal(false);
        // Recargar datos
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

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'aseguradora',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Pago registrado',
          description: 'El pago a la aseguradora ha sido registrado exitosamente',
        });
        setShowPagoAseguradoraModal(false);
        // Recargar datos
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
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Recaudo registrado',
          description: 'El recaudo por aseguradora ha sido registrado y la póliza está en recaudos completados',
        });
        setShowRecaudoAseguradoraDirectoModal(false);
        // Recargar datos
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
        toast({
          title: 'Cobro registrado',
          description: 'El cobro de comisión ha sido registrado exitosamente',
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
      // Si estamos en tab recaudosCompletados, cargar pagos individuales
      if (tabActivo === 'recaudosCompletados') {
        cargarPagosAseguradora(1, filtros.busqueda);
      }
    }
  }, [authLoading, authUser]);

  // Cargar pagos de aseguradora cuando se cambia al tab recaudosCompletados
  useEffect(() => {
    if (tabActivo === 'recaudosCompletados' && authUser) {
      cargarPagosAseguradora(1, filtros.busqueda);
    }
  }, [tabActivo]);

  // Recargar cuando cambie la búsqueda (con debounce implícito al escribir)
  useEffect(() => {
    if (!authLoading && authUser) {
      const timeoutId = setTimeout(() => {
        cargarCartera(1, filtros.busqueda, tabActivo);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [filtros.busqueda]);

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

  // Tab "Por Cobrar": en servidor ya viene filtrado cuando tabActivo=porCobrar
  const polizasPorCobrar = useMemo(() => {
    if (tabActivo === 'porCobrar') return polizasFiltradas;
    return polizasFiltradas.filter(p => {
      const pendienteOficina = (p.recaudo_oficina?.pendiente || p.total || 0);
      return pendienteOficina > 0;
    });
  }, [polizasFiltradas, tabActivo]);

  // Tab "Por Pagar": Pólizas donde la oficina ya recaudó del cliente (pendiente oficina = 0) 
  // pero aún debe pagar a la aseguradora (pendiente aseguradora > 0)
  const polizasPorPagar = useMemo(() => {
    if (tabActivo === 'porPagar') return polizasFiltradas;
    return polizasFiltradas.filter(p => {
      const pendienteOficina = (p.recaudo_oficina?.pendiente || 0);
      const recaudadoOficina = (p.recaudo_oficina?.recaudado || 0);
      const pendienteAseguradora = (p.recaudo_aseguradora?.pendiente || 0);
      return pendienteOficina === 0 && recaudadoOficina > 0 && pendienteAseguradora > 0;
    });
  }, [polizasFiltradas, tabActivo]);

  // Tab "Recaudos Completados": Pólizas donde ya se pagó a la aseguradora
  const polizasRecaudosCompletados = useMemo(() => {
    if (tabActivo === 'recaudosCompletados') return polizasFiltradas;
    return polizasFiltradas.filter(p => {
      const recaudadoOficina = (p.recaudo_oficina?.recaudado || 0);
      const pagadoAseguradora = (p.recaudo_aseguradora?.pagado || 0);
      return recaudadoOficina > 0 && pagadoAseguradora > 0;
    });
  }, [polizasFiltradas, tabActivo]);

  const polizasPorCobrarPaginadas = polizasPorCobrar;
  const polizasPorPagarPaginadas = polizasPorPagar;
  const polizasRecaudosCompletadosPaginadas = polizasRecaudosCompletados;

  const clientesConsolidados = useMemo(() => {
    return Object.entries(
      polizasFiltradas.reduce((acc, p) => {
        if (!acc[p.clienteId]) {
          acc[p.clienteId] = {
            cliente: p.cliente,
            clienteId: p.clienteId,
            documento: p.documento,
            polizas: 0,
            primaTotal: 0,
            comisiones: 0,
            porCobrar: 0,
            recaudado: 0,
            proximoVenc: '',
          };
        }
        acc[p.clienteId].polizas++;
        if (p.estado === 'ACTIVA') {
          acc[p.clienteId].primaTotal += p.primaNeta;
          acc[p.clienteId].comisiones += p.comision;
        }
        // Calcular pendiente real descontando pagos de oficina y aseguradora
        const total = p.total || 0;
        const recaudadoOficina = p.recaudo_oficina?.recaudado || 0;
        const pagadoAseguradora = p.recaudo_aseguradora?.pagado || 0;
        acc[p.clienteId].porCobrar += Math.max(0, total - recaudadoOficina - pagadoAseguradora);
        acc[p.clienteId].recaudado += recaudadoOficina + pagadoAseguradora;
        if (!acc[p.clienteId].proximoVenc || p.fechaVencimiento < acc[p.clienteId].proximoVenc) {
          acc[p.clienteId].proximoVenc = p.fechaVencimiento;
        }
        return acc;
      }, {} as Record<string, any>)
    ).map(([id, data]) => ({ id, ...data }));
  }, [polizasFiltradas]);

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
      {/* Estadísticas Principales */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Pólizas en Cartera</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticas.totalPolizas}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {estadisticas.polizasActivas} activas
                </p>
              </div>
              <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Por Cobrar</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  {formatCurrency(estadisticas.porCobrarTotal)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Vencido: {formatCurrency(estadisticas.porCobrarVencido)}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Comisiones</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  {formatCurrency(estadisticas.comisionesTotal)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Recaudo: {estadisticas.tasaRecaudo.toFixed(1)}%
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>
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
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>

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
            const tabNames: ('general' | 'porCobrar' | 'porPagar' | 'recaudosCompletados')[] = ['general', 'porCobrar', 'porPagar', 'recaudosCompletados'];
            if (tabNames[tab] && tabNames[tab] !== tabActivo) {
              setTabActivo(tabNames[tab]);
            }
          }}
        >
          <Tabs.Item
            active={tabActivo === 'general'}
            title={`Cartera General (${contadoresTabs.general})`}
            icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" />}
          >
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="text-center">Pólizas</th>
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
                      <td className="sticky-right">
                        <div className="relative inline-block">
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            style={{ minWidth: '260px' }}
                            renderTrigger={() => (
                              <span className="h-8 w-8 flex justify-center items-center rounded-lg hover:bg-[#573CFF]/10 hover:text-[#573CFF] cursor-pointer transition-colors">
                                <IconDots size={18} />
                              </span>
                            )}
                          >
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-blue-600"
                              onClick={() => abrirCarteraCliente(data)}
                            >
                              <Icon icon="solar:wallet-money-bold-duotone" height={18} />
                              <span>Ver Cartera</span>
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Link to={`/apps/seguros/clientes/editar/${data.clienteId}`}>
                              <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                <Icon icon="solar:user-bold-duotone" height={18} />
                                <span>Ver Cliente</span>
                              </Dropdown.Item>
                            </Link>
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left"
                              onClick={() => navigate(`/apps/seguros/polizas/nueva?cliente_id=${data.clienteId}`)}
                            >
                              <Icon icon="solar:document-add-bold-duotone" height={18} />
                              <span>Nueva Póliza</span>
                            </Dropdown.Item>
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación Por Clientes */}
            {totalPaginasClientes > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaClientes - 1) * elementosPorPagina) + 1} a {Math.min(paginaClientes * elementosPorPagina, clientesConsolidados.length)} de {clientesConsolidados.length} clientes
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaClientes === 1}
                    onClick={() => setPaginaClientes(p => Math.max(1, p - 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {paginaClientes} de {totalPaginasClientes}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaClientes === totalPaginasClientes}
                    onClick={() => setPaginaClientes(p => Math.min(totalPaginasClientes, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'porCobrar'}
            title={`Por Cobrar (${contadoresTabs.porCobrar})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
          >
            {/* Barra de acciones */}
            <div className="mb-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                color="gray"
                onClick={() => { setShowHistorialImportaciones(true); cargarHistorialImportaciones(); }}
              >
                <Icon icon="solar:history-bold-duotone" className="w-4 h-4 mr-2" />
                Historial Importaciones
              </Button>
              <Button
                size="sm"
                color="purple"
                onClick={() => setShowRecaudoMasivoModal(true)}
              >
                <Icon icon="solar:upload-bold-duotone" className="w-4 h-4 mr-2" />
                Importar Recaudos (CSV/Excel)
              </Button>
            </div>

            {/* Estadísticas de Recaudo - Solo lo que los clientes deben pagar */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Pendiente</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(polizasPorCobrar.reduce((sum, p) => {
                      const total = p.total || 0;
                      const recaudadoOficina = p.recaudo_oficina?.recaudado || 0;
                      const pagadoAseguradora = p.recaudo_aseguradora?.pagado || 0;
                      return sum + Math.max(0, total - recaudadoOficina - pagadoAseguradora);
                    }, 0))}
                  </p>
                  <p className="text-xs text-gray-500">{polizasPorCobrar.length} pólizas</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Ya Recaudado</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(polizasPorCobrar.reduce((sum, p) => sum + (p.recaudo_oficina?.recaudado || 0) + (p.recaudo_aseguradora?.pagado || 0), 0))}
                  </p>
                  <p className="text-xs text-gray-500">Oficina + Aseguradora</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Cartera</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(polizasPorCobrar.reduce((sum, p) => sum + (p.total || 0), 0))}
                  </p>
                  <p className="text-xs text-gray-500">Valor total pólizas</p>
                </div>
              </Card>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th>Vendedor</th>
                    <th className="text-right">Total Póliza</th>
                    <th className="text-center">Estado Recaudo</th>
                    <th>Vencimiento</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {polizasPorCobrarPaginadas.map((poliza) => (
                    <tr key={poliza.id} className="group">
                      <td className="font-medium">{poliza.numeroPoliza}</td>
                      <td>
                        <div>
                          <div className="font-medium">{poliza.cliente}</div>
                          <div className="text-xs text-gray-500">{poliza.documento}</div>
                        </div>
                      </td>
                      <td>{poliza.aseguradora}</td>
                      <td>
                        <span className="text-sm">{poliza.vendedor || 'Sin asignar'}</span>
                      </td>
                      <td className="text-right font-semibold">
                        {formatCurrency(poliza.total)}
                      </td>
                      <td className="text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-orange-600">
                            Pendiente: {formatCurrency(Math.max(0, (poliza.total || 0) - (poliza.recaudo_oficina?.recaudado || 0) - (poliza.recaudo_aseguradora?.pagado || 0)))}
                          </div>
                          {(poliza.recaudo_oficina?.recaudado || 0) > 0 && (
                            <div className="text-xs text-blue-600">
                              Recaudado Oficina: {formatCurrency(poliza.recaudo_oficina?.recaudado || 0)}
                            </div>
                          )}
                          {(poliza.recaudo_aseguradora?.pagado || 0) > 0 && (
                            <div className="text-xs text-green-600">
                              Pagado Aseguradora: {formatCurrency(poliza.recaudo_aseguradora?.pagado || 0)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                        {poliza.diasMora > 0 && (
                          <div className="text-xs text-red-600">{poliza.diasMora} días mora</div>
                        )}
                      </td>
                      <td className="sticky-right">
                        <div className="relative inline-block">
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            style={{ minWidth: '260px' }}
                            renderTrigger={() => (
                              <span className="h-8 w-8 flex justify-center items-center rounded-lg hover:bg-[#573CFF]/10 hover:text-[#573CFF] cursor-pointer transition-colors">
                                <IconDots size={18} />
                              </span>
                            )}
                          >
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-blue-600"
                              onClick={() => abrirModalPagoOficina(poliza)}
                            >
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" height={18} />
                              <span>Recaudo por Oficina</span>
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-purple-600"
                              onClick={() => abrirModalRecaudoAseguradoraDirecto(poliza)}
                            >
                              <Icon icon="solar:card-transfer-bold-duotone" height={18} />
                              <span>Recaudo por Aseguradora</span>
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                              <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                <span>Ver Póliza</span>
                              </Dropdown.Item>
                            </Link>
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {polizasPorCobrar.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay cuentas por cobrar pendientes</p>
                </div>
              )}
            </div>

            {/* Paginación del Servidor */}
            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} pólizas totales)
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={loading || serverPagination.current_page === 1}
                    onClick={() => cambiarPagina(serverPagination.current_page - 1)}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {serverPagination.current_page} de {serverPagination.last_page}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={loading || serverPagination.current_page === serverPagination.last_page}
                    onClick={() => cambiarPagina(serverPagination.current_page + 1)}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'porPagar'}
            title={`Por Pagar (${contadoresTabs.porPagar})`}
            icon={() => <Icon icon="solar:card-transfer-bold-duotone" />}
          >
            {/* Estadísticas de Por Pagar */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Por Pagar a Aseguradora</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(polizasPorPagar.reduce((sum, p) => sum + (p.recaudo_aseguradora?.pendiente || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Pólizas Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {polizasPorPagar.length}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Recaudado en Oficina</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(polizasPorPagar.reduce((sum, p) => sum + (p.recaudo_oficina?.recaudado || 0), 0))}
                  </p>
                </div>
              </Card>
            </div>

            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th className="text-right">Prima Neta</th>
                    <th className="text-right">Recaudado Oficina</th>
                    <th className="text-right">Por Pagar</th>
                    <th>Vencimiento</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {polizasPorPagarPaginadas.map((poliza) => (
                    <tr key={poliza.id} className="group">
                      <td className="font-medium">{poliza.numeroPoliza}</td>
                      <td>
                        <div>
                          <div className="font-medium">{poliza.cliente}</div>
                          <div className="text-xs text-gray-500">{poliza.documento}</div>
                        </div>
                      </td>
                      <td>{poliza.aseguradora}</td>
                      <td className="text-right font-semibold">
                        {formatCurrency(poliza.primaNeta)}
                      </td>
                      <td className="text-right font-semibold text-blue-600">
                        {formatCurrency(poliza.recaudo_oficina?.recaudado || 0)}
                      </td>
                      <td className="text-right font-semibold text-purple-600">
                        {formatCurrency(poliza.recaudo_aseguradora?.pendiente || 0)}
                      </td>
                      <td>
                        <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                      </td>
                      <td className="sticky-right">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            color="purple"
                            onClick={() => abrirModalPagoAseguradora(poliza)}
                          >
                            <Icon icon="solar:card-transfer-bold-duotone" className="w-4 h-4 mr-2" />
                            Pagar
                          </Button>
                          {(poliza.recaudo_oficina?.recaudado || 0) > 0 && (
                            <Button
                              size="sm"
                              color="red"
                              onClick={() => revertirRecaudoOficina(poliza)}
                              title="Revertir recaudo de oficina"
                            >
                              <Icon icon="solar:undo-left-bold-duotone" className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {polizasPorPagar.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay pagos pendientes a compañías</p>
                  <p className="text-xs text-gray-400 mt-2">Los pagos pendientes aparecen cuando se registra un recaudo por oficina</p>
                </div>
              )}
            </div>

            {/* Paginación del Servidor */}
            {serverPagination && serverPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando página {serverPagination.current_page} de {serverPagination.last_page} ({serverPagination.total} pólizas totales)
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={loading || serverPagination.current_page === 1}
                    onClick={() => cambiarPagina(serverPagination.current_page - 1)}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {serverPagination.current_page} de {serverPagination.last_page}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={loading || serverPagination.current_page === serverPagination.last_page}
                    onClick={() => cambiarPagina(serverPagination.current_page + 1)}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'recaudosCompletados'}
            title={`Recaudos Completados (${contadoresTabs.recaudosCompletados})`}
            icon={() => <Icon icon="solar:check-circle-bold-duotone" />}
          >
            {/* Estadísticas de Recaudos Completados */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Pagado a Aseguradoras</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(pagosAseguradora.reduce((sum, p) => sum + (p.monto_pagado || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Pagos Registrados</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {pagosAseguradoraPagination?.total || pagosAseguradora.length}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Comisiones Generadas</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(pagosAseguradora.reduce((sum, p) => sum + (p.comision || 0), 0))}
                  </p>
                </div>
              </Card>
            </div>

            <div>
              {cargandoPagosAseguradora ? (
                <div className="text-center py-12">
                  <Spinner size="lg" />
                  <p className="text-gray-500 mt-2">Cargando pagos...</p>
                </div>
              ) : (
                <div className="guro-table-wrap">
                  <table className="guro-table">
                    <thead>
                      <tr>
                        <th>Póliza</th>
                        <th>Cliente</th>
                        <th>Aseguradora</th>
                        <th className="text-right">Monto Pagado</th>
                        <th>Fecha Pago</th>
                        <th>Método</th>
                        <th className="sticky-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosAseguradora.map((pago) => (
                        <tr key={pago.pago_id} className="group">
                          <td className="font-medium">{pago.numero_poliza}</td>
                          <td>
                            <div>
                              <div className="font-medium">{pago.cliente}</div>
                              <div className="text-xs text-gray-500">{pago.documento}</div>
                            </div>
                          </td>
                          <td>{pago.aseguradora}</td>
                          <td className="text-right font-semibold text-green-600">
                            {formatCurrency(pago.monto_pagado)}
                          </td>
                          <td>
                            {pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString('es-CO') : '-'}
                          </td>
                          <td>
                            <Badge color="info" size="sm">
                              {pago.metodo_pago || 'Directo'}
                            </Badge>
                          </td>
                          <td className="sticky-right">
                            <Button
                              size="sm"
                              color="red"
                              onClick={() => revertirPagoAseguradoraIndividual(pago.pago_id, pago.monto_pagado)}
                              title="Revertir este pago"
                            >
                              <Icon icon="solar:undo-left-bold-duotone" className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!cargandoPagosAseguradora && pagosAseguradora.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay pagos de aseguradora</p>
                  <p className="text-xs text-gray-400 mt-2">Aquí aparecen los pagos individuales realizados a las aseguradoras</p>
                </div>
              )}
            </div>

            {/* Paginación de Pagos Aseguradora */}
            {pagosAseguradoraPagination && pagosAseguradoraPagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando página {pagosAseguradoraPagination.current_page} de {pagosAseguradoraPagination.last_page} ({pagosAseguradoraPagination.total} pagos totales)
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={cargandoPagosAseguradora || pagosAseguradoraPagination.current_page === 1}
                    onClick={() => cargarPagosAseguradora(pagosAseguradoraPagination.current_page - 1, filtros.busqueda)}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {pagosAseguradoraPagination.current_page} de {pagosAseguradoraPagination.last_page}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={cargandoPagosAseguradora || pagosAseguradoraPagination.current_page === pagosAseguradoraPagination.last_page}
                    onClick={() => cargarPagosAseguradora(pagosAseguradoraPagination.current_page + 1, filtros.busqueda)}
                    className="rounded-[10px]"
                  >
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
                Monto a Recaudar
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Ingrese el monto a recaudar"
                className="w-full"
                max={polizaSeleccionada?.recaudo_oficina?.pendiente || polizaSeleccionada?.total || 0}
              />
              <p className="text-xs text-gray-500 mt-1">
                Puede ingresar un monto parcial. El resto quedará pendiente.
              </p>
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
            disabled={procesandoPago || !montoPago}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago Aseguradora */}
      <Modal show={showPagoAseguradoraModal} onClose={() => setShowPagoAseguradoraModal(false)} size="md">
        <Modal.Header>
          Registrar Pago por Aseguradora - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Pagado por Aseguradora
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto pagado por la aseguradora"
                className="w-full"
              />
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
            disabled={procesandoPago || !montoPago}
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
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-700">
                <strong>Nota:</strong> Este tipo de recaudo se usa cuando la aseguradora cobra directamente al cliente. 
                La póliza irá directamente a "Recaudos Completados".
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total de la Póliza
              </label>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(polizaSeleccionada?.total || 0)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Recaudado
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto recaudado por la aseguradora"
                className="w-full"
              />
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
            disabled={procesandoPago || !montoPago}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Cobrar
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto de la comisión a cobrar"
                className="w-full"
              />
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
            disabled={procesandoPago || !montoPago}
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
                              {(poliza.recaudo_oficina?.historial?.length || 0) > 0 && (
                                <Badge color="info" size="xs">{poliza.recaudo_oficina?.historial?.length} abono(s)</Badge>
                              )}
                            </>
                          ) : (
                            <Badge color="success" size="xs">Completo</Badge>
                          )}
                          {(poliza.recaudo_oficina?.historial?.length || 0) > 0 && (
                            <div className="mt-2 text-left border-t pt-2">
                              <div className="text-xs font-semibold text-gray-600 mb-1">Abonos:</div>
                              {poliza.recaudo_oficina?.historial?.map((abono, idx) => (
                                <div key={abono.id || idx} className="text-xs bg-gray-50 dark:bg-gray-700 p-1 rounded mb-1">
                                  <div className="flex justify-between">
                                    <span className="text-green-600 font-semibold">{formatCurrency(abono.monto)}</span>
                                    <span className="text-gray-500">{formatDate(abono.fecha)}</span>
                                  </div>
                                  {abono.metodo_pago && (
                                    <div className="text-gray-500">{abono.metodo_pago}</div>
                                  )}
                                </div>
                              ))}
                            </div>
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
    </div>
  );
};

export default CarteraClientes;

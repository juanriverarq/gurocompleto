import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Badge,
  Modal,
  Spinner,
  Progress,
} from 'flowbite-react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';
import {
  polizaService,
  polizaUtils,
  type Poliza,
  type PolizaFilters,
} from 'src/services/polizaService';
import saasApi from 'src/services/saasApi';
import api from 'src/config/api';
import { useToast } from 'src/hooks/use-toast';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import OnboardingGuard from '../../../../components/auth/OnboardingGuard';
import PermissionGate from 'src/components/PermissionGate';
import { printRecibo, type ReciboPrintData, type BrokerPrintData } from '../../cartera/printRecibo';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CumplimientoFormData {
  numero_poliza: string;
  cliente_id: string;
  nombre_asegurado: string;
  nombre_tomador: string;
  vendedor_id: string;
  aseguradora_id: string;
  ramo_id: string;
  subramo: string;
  porcentaje_comision: string;
  prima_neta: string;
  gastos_expedicion: string;
  porcentaje_iva: string;
  total: string;
  tipo_recaudo: '' | 'oficina' | 'aseguradora';
  fecha_recaudacion: string;
  fecha_inicio: string;
  forma_pago: string;
}

const INITIAL_FORM: CumplimientoFormData = {
  numero_poliza: '',
  cliente_id: '',
  nombre_asegurado: '',
  nombre_tomador: '',
  vendedor_id: '',
  aseguradora_id: '',
  ramo_id: '',
  subramo: '',
  porcentaje_comision: '',
  prima_neta: '0.00',
  gastos_expedicion: '0.00',
  porcentaje_iva: '19',
  total: '0.00',
  tipo_recaudo: '',
  fecha_recaudacion: '',
  fecha_inicio: new Date().toISOString().split('T')[0],
  forma_pago: '',
};

// ─── Component ────────────────────────────────────────────────────────────────
const Cumplimiento: React.FC = () => {
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [polizaToDelete, setPolizaToDelete] = useState<Poliza | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPoliza, setEditingPoliza] = useState<Poliza | null>(null);
  const [selectedPoliza, setSelectedPoliza] = useState<Poliza | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Catalogs
  const [aseguradoras, setAseguradoras] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [ramos, setRamos] = useState<any[]>([]);
  const [cumplimientoRamo, setCumplimientoRamo] = useState<any>(null);

  // Form
  const [formData, setFormData] = useState<CumplimientoFormData>(INITIAL_FORM);

  // PDF Reader state
  // Recibo print state
  const [reciboParaImprimir, setReciboParaImprimir] = useState<any>(null);
  const [showPrintFormatModal, setShowPrintFormatModal] = useState(false);
  const [brokerInfo, setBrokerInfo] = useState<BrokerPrintData | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfConfidence, setPdfConfidence] = useState<any>(null);

  // Client search
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading: saasLoading, hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission ? hasPermission('polizas', 'crear') : false;
  const canEdit = hasPermission ? hasPermission('polizas', 'editar') : false;
  const canDelete = hasPermission ? hasPermission('polizas', 'eliminar') : false;

  // Filters - ramo_id will be set once catalogs load
  const [filters, setFilters] = useState<PolizaFilters>({
    search: '',
    ramo: 'CUMPLIMIENTO',
    page: 1,
    per_page: 15,
  });

  // Once cumplimientoRamo is resolved, switch to ramo_id for precise filtering
  useEffect(() => {
    if (cumplimientoRamo) {
      setFilters(prev => ({ ...prev, ramo: '', ramo_id: cumplimientoRamo.id }));
    }
  }, [cumplimientoRamo]);

  // Auth check
  useEffect(() => {
    if (!saasLoading && !user) navigate('/auth/auth1/login');
  }, [saasLoading, user, navigate]);

  // Load broker info for recibo printing
  useEffect(() => {
    api.get('/saas/broker/profile').then(res => {
      const b = res.data;
      if (b?.success) {
        const d = b.data || b;
        setBrokerInfo({
          nombre: d.nombre || d.name || 'Agencia de Seguros',
          legal_name: d.legal_name || d.razon_social,
          nit: d.nit || '',
          direccion: d.direccion || d.address,
          ciudad: d.ciudad || d.city,
          telefono: d.telefono || d.phone,
          email: d.email,
          logo_url: d.logo_url || d.logo,
        });
      }
    }).catch(() => {});
  }, []);

  // Helper to print a recibo
  const imprimirRecibo = (recibo: any, format: 'media_carta' | 'carta' = 'media_carta') => {
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

  // Load catalogs
  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, vRes, rRes] = await Promise.all([
          saasApi.getAseguradoras().catch(() => ({ data: [] })),
          saasApi.getVendedores().catch(() => ({ data: [] })),
          saasApi.getRamos().catch(() => ({ data: [] })),
        ]);
        const aData = Array.isArray((aRes as any)?.data) ? (aRes as any).data : ((aRes as any)?.data?.data || []);
        const vData = Array.isArray((vRes as any)?.data) ? (vRes as any).data : ((vRes as any)?.data?.data || []);
        const rData = Array.isArray((rRes as any)?.data) ? (rRes as any).data : ((rRes as any)?.data?.data || []);
        setAseguradoras(aData);
        setVendedores(vData);
        setRamos(rData);
        // Find CUMPLIMIENTO ramo
        const cr = rData.find((r: any) => (r.nombre || r.name || '').toUpperCase() === 'CUMPLIMIENTO');
        setCumplimientoRamo(cr || null);
      } catch {}
    };
    load();
  }, []);

  // Client search debounce
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!clientQuery || clientQuery.trim().length < 2) {
        setClientResults([]);
        return;
      }
      try {
        setClientLoading(true);
        const resp = await saasApi.getClientes({ search: clientQuery, per_page: 10 });
        const arr = Array.isArray(resp.data) ? (resp.data as any) : ((resp.data as any)?.data || []);
        const normalized = arr.map((c: any) => {
          const nombre = c.nombre || `${c.first_name || c.nombres || ''} ${c.last_name || c.apellidos || ''}`.trim();
          const documento = c.documento || c.document_number || c.dni || '';
          const celular = c.celular || c.celular_principal || c.mobile_phone || '';
          return { id: String(c.id), nombre, documento, celular, raw: c };
        });
        setClientResults(normalized);
      } catch {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [clientQuery]);

  // Load polizas
  const loadPolizas = useCallback(async () => {
    try {
      setLoading(true);
      const response = await polizaService.getPolizas(filters);
      if (response && response.data) {
        const data = response.data;
        if (Array.isArray(data)) {
          setPolizas(data);
          setPagination({ current_page: 1, last_page: 1, per_page: data.length, total: data.length, from: 1, to: data.length });
        } else if (data.data && Array.isArray(data.data)) {
          setPolizas(data.data);
          setPagination({ current_page: data.current_page, last_page: data.last_page, per_page: data.per_page, total: data.total, from: data.from, to: data.to });
        } else {
          setPolizas([]);
        }
      } else {
        setPolizas([]);
      }
    } catch {
      setPolizas([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadPolizas(); }, [loadPolizas]);

  // Format helpers
  const formatDate = (value: any): string => {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [datePart] = value.split('T');
      const [y, m, d] = datePart.split('-');
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return String(value);
  };

  const estadosPoliza = [
    { value: 'ACTIVA', label: 'Activa', color: 'success' },
    { value: 'VENCIDA', label: 'Vencida', color: 'warning' },
    { value: 'CANCELADA', label: 'Cancelada', color: 'failure' },
    { value: 'SUSPENDIDA', label: 'Suspendida', color: 'gray' },
  ];

  const getEstadoBadge = (estado: string) => {
    const e = estadosPoliza.find(x => x.value === estado);
    return e ? (e.color as any) : 'gray';
  };

  // PDF reader
  const handlePdfDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      handleProcessPdf(file);
    }
  }, [aseguradoras, ramos, vendedores]);

  const handleProcessPdf = async (file: File) => {
    setPdfProcessing(true);
    setPdfProgress(0);
    setPdfConfidence(null);
    try {
      const { processPdf } = await import('src/services/advancedPdfProcessor');
      const progressInterval = setInterval(() => {
        setPdfProgress(prev => Math.min(prev + 5, 85));
      }, 300);
      const result = await processPdf(file);
      clearInterval(progressInterval);
      setPdfProgress(100);
      setPdfConfidence(result.confidence);

      // Map aseguradora
      let asegId = '';
      if (result.aseguradora_id) {
        const found = aseguradoras.find((a: any) => a.id === result.aseguradora_id);
        if (found) asegId = String(found.id);
      }
      if (!asegId && result.aseguradora) {
        const src = result.aseguradora.toLowerCase();
        const found = aseguradoras.find((a: any) => a.nombre.toLowerCase() === src)
          || aseguradoras.find((a: any) => src.includes(a.nombre.toLowerCase()))
          || aseguradoras.find((a: any) => a.nombre.toLowerCase().includes(src));
        if (found) asegId = String(found.id);
      }

      // Map ramo
      let ramoId = '';
      if (result.ramo_id) {
        const found = ramos.find((r: any) => r.id === result.ramo_id);
        if (found) ramoId = String(found.id);
      }
      if (!ramoId && result.ramo) {
        const src = result.ramo.toLowerCase();
        const found = ramos.find((r: any) => (r.nombre || '').toLowerCase() === src)
          || ramos.find((r: any) => src.includes((r.nombre || '').toLowerCase()))
          || ramos.find((r: any) => (r.nombre || '').toLowerCase().includes(src));
        if (found) ramoId = String(found.id);
      }
      if (!ramoId && cumplimientoRamo) ramoId = String(cumplimientoRamo.id);

      // Map vendedor
      let vendedorId = '';
      if (result.vendedor_id) {
        const found = vendedores.find((v: any) => v.id === result.vendedor_id);
        if (found) vendedorId = String(found.id);
      }
      if (!vendedorId && result.vendedor) {
        const src = result.vendedor.toLowerCase();
        const found = vendedores.find((v: any) => (v.nombres || v.nombre || '').toLowerCase().includes(src))
          || vendedores.find((v: any) => src.includes((v.nombres || v.nombre || '').toLowerCase()));
        if (found) vendedorId = String(found.id);
      }

      setFormData(prev => ({
        ...prev,
        numero_poliza: result.numeroPoliza || prev.numero_poliza,
        nombre_asegurado: result.aseguradoNombre || result.clienteNombre || prev.nombre_asegurado,
        nombre_tomador: result.tomadorNombre || prev.nombre_tomador,
        vendedor_id: vendedorId || prev.vendedor_id,
        aseguradora_id: asegId || prev.aseguradora_id,
        ramo_id: ramoId || prev.ramo_id,
        porcentaje_comision: result.porcentajeComision || prev.porcentaje_comision,
        prima_neta: result.primaNeta || prev.prima_neta,
        porcentaje_iva: result.iva || prev.porcentaje_iva,
        total: result.total || prev.total,
        fecha_inicio: result.fechaInicio || prev.fecha_inicio,
        forma_pago: result.formaPago || prev.forma_pago,
      }));

      toast({
        title: 'PDF procesado',
        description: `Datos extraídos con ${result.confidence.overall?.toFixed(0) || 0}% de confianza. Revisa los campos.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al leer PDF', description: err?.message || 'No se pudo procesar el archivo.' });
    } finally {
      setPdfProcessing(false);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfConfidence(null);
    setPdfProgress(0);
  };

  const { getRootProps: getPdfRootProps, getInputProps: getPdfInputProps, isDragActive: isPdfDragActive } = useDropzone({
    onDrop: handlePdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    noClick: false,
  });

  // Form handlers
  const openCreateModal = () => {
    setFormData({
      ...INITIAL_FORM,
      ramo_id: cumplimientoRamo ? String(cumplimientoRamo.id) : '',
    });
    setEditingPoliza(null);
    setSelectedClient(null);
    setClientQuery('');
    removePdf();
    setShowCreateModal(true);
  };

  const openEditModal = (poliza: Poliza) => {
    setEditingPoliza(poliza);
    // Determine tipo_recaudo from poliza flags
    let tipoRecaudo: '' | 'oficina' | 'aseguradora' = '';
    if ((poliza as any).recaudado_en_oficina) tipoRecaudo = 'oficina';
    else if ((poliza as any).recaudado) tipoRecaudo = 'aseguradora';

    setFormData({
      numero_poliza: poliza.numero_poliza || '',
      cliente_id: poliza.cliente_id ? String(poliza.cliente_id) : '',
      nombre_asegurado: (poliza as any).insured_name || (poliza as any).nombre_asegurado || '',
      nombre_tomador: (poliza as any).policy_holder_name || (poliza as any).nombre_tomador || '',
      vendedor_id: poliza.vendedor_id ? String(poliza.vendedor_id) : '',
      aseguradora_id: poliza.aseguradora_id ? String(poliza.aseguradora_id) : '',
      ramo_id: poliza.ramo_id ? String(poliza.ramo_id) : (cumplimientoRamo ? String(cumplimientoRamo.id) : ''),
      subramo: poliza.subramo || '',
      porcentaje_comision: poliza.porcentaje_comision != null ? String(poliza.porcentaje_comision) : '',
      prima_neta: poliza.prima_neta != null ? String(poliza.prima_neta) : '0.00',
      gastos_expedicion: (poliza as any).gastos_adicionales != null ? String((poliza as any).gastos_adicionales) : '0.00',
      porcentaje_iva: poliza.porcentaje_iva != null && poliza.porcentaje_iva > 0 ? String(poliza.porcentaje_iva) : '19',
      total: poliza.total != null ? String(poliza.total) : '0.00',
      tipo_recaudo: tipoRecaudo,
      fecha_recaudacion: (poliza as any).fecha_recaudo || '',
      fecha_inicio: poliza.fecha_inicio || new Date().toISOString().split('T')[0],
      forma_pago: poliza.forma_pago || '',
    });
    // Set client from poliza
    if (poliza.cliente_id) {
      setSelectedClient({
        id: String(poliza.cliente_id),
        nombre: `${poliza.nombres_cliente || ''} ${poliza.apellidos_cliente || ''}`.trim() || 'Cliente',
        documento: poliza.dni_cliente || '',
      });
    } else {
      setSelectedClient(null);
    }
    setClientQuery('');
    setShowCreateModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Auto-calculate IVA and Total when financial fields change
  useEffect(() => {
    const primaNeta = parseFloat(formData.prima_neta) || 0;
    const gastosExp = parseFloat(formData.gastos_expedicion) || 0;
    const pctIva = parseFloat(formData.porcentaje_iva) || 0;
    const iva = primaNeta * (pctIva / 100);
    const total = primaNeta + gastosExp + iva;
    setFormData(prev => ({
      ...prev,
      total: total > 0 ? total.toFixed(2) : '0.00',
    }));
  }, [formData.prima_neta, formData.gastos_expedicion, formData.porcentaje_iva]);

  const handleSubmit = async () => {
    if (!formData.numero_poliza.trim()) {
      toast({ variant: 'destructive', title: 'Campo requerido', description: 'El número de póliza es obligatorio.' });
      return;
    }
    if (!formData.aseguradora_id) {
      toast({ variant: 'destructive', title: 'Campo requerido', description: 'La aseguradora es obligatoria.' });
      return;
    }
    if (!formData.vendedor_id) {
      toast({ variant: 'destructive', title: 'Campo requerido', description: 'El vendedor es obligatorio.' });
      return;
    }
    if (formData.tipo_recaudo && !formData.fecha_recaudacion) {
      toast({ variant: 'destructive', title: 'Campo requerido', description: 'Si marcas recaudo debes indicar la fecha de recaudación.' });
      return;
    }

    setSubmitting(true);
    try {
      const selectedAseg = aseguradoras.find((a: any) => String(a.id) === formData.aseguradora_id);
      const selectedRamo = ramos.find((r: any) => String(r.id) === formData.ramo_id) || cumplimientoRamo;
      const clientId = formData.cliente_id || (selectedClient ? selectedClient.id : '');

      const payload: any = {
        numero_poliza: formData.numero_poliza.toUpperCase().replace(/\s+/g, '-'),
        cliente_id: clientId ? parseInt(clientId) : null,
        aseguradora: selectedAseg?.nombre || '',
        aseguradora_id: formData.aseguradora_id ? parseInt(formData.aseguradora_id) : undefined,
        ramo_principal: selectedRamo?.nombre || 'CUMPLIMIENTO',
        ramo_id: formData.ramo_id ? parseInt(formData.ramo_id) : (cumplimientoRamo ? cumplimientoRamo.id : undefined),
        subramo: formData.subramo || undefined,
        insured_name: formData.nombre_asegurado || undefined,
        policy_holder_name: formData.nombre_tomador || undefined,
        vendedor_id: formData.vendedor_id ? parseInt(formData.vendedor_id) : undefined,
        vendedor: vendedores.find((v: any) => String(v.id) === formData.vendedor_id)?.nombres || undefined,
        porcentaje_comision: formData.porcentaje_comision ? parseFloat(formData.porcentaje_comision) : undefined,
        comision: formData.porcentaje_comision ? (parseFloat(formData.prima_neta) || 0) * (parseFloat(formData.porcentaje_comision) / 100) : undefined,
        prima_neta: parseFloat(formData.prima_neta) || 0,
        gastos_adicionales: parseFloat(formData.gastos_expedicion) || 0,
        porcentaje_iva: parseFloat(formData.porcentaje_iva) || 0,
        iva: (parseFloat(formData.prima_neta) || 0) * ((parseFloat(formData.porcentaje_iva) || 0) / 100),
        total: parseFloat(formData.total) || 0,
        fecha_inicio: formData.fecha_inicio,
        fecha_expedicion: formData.fecha_inicio,
        fecha_fin: (() => {
          const d = new Date(formData.fecha_inicio);
          d.setFullYear(d.getFullYear() + 1);
          return d.toISOString().split('T')[0];
        })(),
        forma_pago: formData.forma_pago || undefined,
        estado: 'ACTIVA',
        policy_category: 'individual',
        // Recaudo fields on the poliza
        recaudado: formData.tipo_recaudo === 'aseguradora',
        recaudado_en_oficina: formData.tipo_recaudo === 'oficina',
        fecha_recaudo: formData.fecha_recaudacion || undefined,
      };

      let response;
      if (editingPoliza?.id) {
        response = await polizaService.updatePoliza(editingPoliza.id, payload);
      } else {
        response = await polizaService.createPoliza(payload);
      }

      if (response.success) {
        // If recaudo is marked, register a real PagoPoliza so cartera moves to the correct state
        const polizaId = editingPoliza?.id || (response as any).data?.id || (response as any).data?.data?.id;
        if (formData.tipo_recaudo && polizaId) {
          try {
            const totalPago = parseFloat(formData.total) || parseFloat(formData.prima_neta) || 0;
            const tipoRecaudoPago = formData.tipo_recaudo === 'oficina' ? 'oficina' : 'aseguradora_directo';
            const pagoResponse = await api.post(`/saas/polizas/${polizaId}/pagos`, {
              tipo_recaudo: tipoRecaudoPago,
              monto: totalPago,
              metodo_pago: formData.forma_pago || 'efectivo',
              fecha_pago: formData.fecha_recaudacion || new Date().toISOString().split('T')[0],
              observaciones: `Recaudo ${formData.tipo_recaudo === 'oficina' ? 'en oficina' : 'directo por aseguradora'} - Póliza cumplimiento ${formData.numero_poliza}`,
            });
            const pagoData = pagoResponse?.data?.data || pagoResponse?.data;
            const reciboData = pagoData?.recibo;
            const numRecibo = pagoData?.numero_recibo;
            const estadoMsg = formData.tipo_recaudo === 'oficina' ? 'por pagar a aseguradora' : 'comisión por cobrar';
            toast({
              title: editingPoliza ? 'Póliza actualizada' : 'Póliza creada',
              description: `Operación exitosa. Recaudo registrado${numRecibo ? ` — Recibo #${numRecibo}` : ''} → cartera en "${estadoMsg}".`,
            });
            if (reciboData) {
              setReciboParaImprimir(reciboData);
              setShowPrintFormatModal(true);
            }
          } catch (pagoErr: any) {
            toast({
              title: editingPoliza ? 'Póliza actualizada' : 'Póliza creada',
              description: `Póliza guardada, pero hubo un error al registrar el recaudo: ${pagoErr?.message || 'Error desconocido'}`,
            });
          }
        } else {
          toast({ title: editingPoliza ? 'Póliza actualizada' : 'Póliza creada', description: 'Operación exitosa.' });
        }
        setShowCreateModal(false);
        loadPolizas();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: (response as any).message || 'No se pudo guardar.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'Error al guardar.' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!polizaToDelete) return;
    try {
      await polizaService.deletePoliza(polizaToDelete.id!);
      toast({ title: 'Póliza eliminada' });
      loadPolizas();
    } catch {}
    setShowDeleteModal(false);
    setPolizaToDelete(null);
  };

  // Get subramos for selected ramo
  const getSubramos = (): string[] => {
    const selRamo = ramos.find((r: any) => String(r.id) === formData.ramo_id);
    if (!selRamo) return [];
    const raw = selRamo.subramo;
    if (Array.isArray(raw)) return raw.filter((s: any) => typeof s === 'string' && s.trim());
    if (typeof raw === 'string' && raw.trim()) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.filter((s: any) => typeof s === 'string' && s.trim()); } catch {}
      return [raw.trim()];
    }
    return [];
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <OnboardingGuard>
      <PermissionGate module="polizas" action="ver">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon="solar:shield-check-bold-duotone" className="w-7 h-7 text-blue-600" />
                Cumplimiento
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gestión de pólizas de cumplimiento
                {pagination && <span className="ml-2 text-gray-400">({pagination.total} registros)</span>}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar póliza, cliente..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                  className="pl-10 h-10 w-64 rounded-[10px]"
                />
              </div>
              <Button color="light" onClick={() => loadPolizas()} disabled={loading} className="h-10 w-10 p-0 rounded-[10px]" title="Actualizar">
                <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {canCreate && (
                <HeroButton icon="solar:add-circle-bold-duotone" onClick={openCreateModal}>
                  Nueva Póliza
                </HeroButton>
              )}
            </div>
          </div>

          {/* Table */}
          <Card>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Spinner size="lg" />
                <span className="ml-2">Cargando pólizas...</span>
              </div>
            ) : polizas.length === 0 ? (
              <div className="text-center py-8">
                <Icon icon="solar:shield-check-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No se encontraron pólizas de cumplimiento</p>
                {canCreate && (
                  <HeroButton icon="solar:add-circle-bold-duotone" onClick={openCreateModal} size="lg">Crear primera póliza</HeroButton>
                )}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block">
                  <div className="guro-table-wrap">
                    <table className="guro-table">
                      <thead>
                        <tr>
                          <th>Número</th>
                          <th>Cliente</th>
                          <th>Aseguradora</th>
                          <th>Subramo</th>
                          <th>Estado</th>
                          <th>Prima Neta</th>
                          <th>Vencimiento</th>
                          <th>Recibo</th>
                          <th className="sticky-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {polizas.map((p) => (
                          <tr key={p.id} className="group">
                            <td className="whitespace-nowrap font-medium">
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 text-blue-500" />
                                {p.numero_poliza}
                              </div>
                            </td>
                            <td>
                              {p.nombres_cliente || p.apellidos_cliente ? (
                                <>
                                  <div className="font-medium uppercase">{p.nombres_cliente} {p.apellidos_cliente}</div>
                                  <div className="text-sm text-gray-500">{p.dni_cliente}</div>
                                </>
                              ) : (
                                <span className="text-gray-400 italic text-sm">Sin cliente asignado</span>
                              )}
                            </td>
                            <td>{(p as any).aseguradora_nombre || p.aseguradora}</td>
                            <td>{p.subramo || '-'}</td>
                            <td>
                              <Badge color={getEstadoBadge(p.estado || 'ACTIVA')}>
                                {estadosPoliza.find(e => e.value === p.estado)?.label || p.estado}
                              </Badge>
                            </td>
                            <td className="font-medium">{polizaUtils.formatCurrency(p.prima_neta || 0)}</td>
                            <td>{formatDate(p.fecha_fin)}</td>
                            <td>
                              {(p as any).ultimo_recibo ? (
                                <button
                                  className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                                  onClick={() => { setReciboParaImprimir((p as any).ultimo_recibo); setShowPrintFormatModal(true); }}
                                  title="Imprimir recibo"
                                >
                                  <Icon icon="solar:printer-bold-duotone" className="w-3.5 h-3.5" />
                                  #{(p as any).ultimo_recibo.numero_recibo}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                              <TableActionMenu>
                                <TableMenuItem onClick={() => { setSelectedPoliza(p); setShowModal(true); }}>
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Detalles</span>
                                </TableMenuItem>
                                {canEdit && (
                                  <Link to={`/apps/seguros/polizas/editar/${p.id}`}>
                                    <TableMenuItem>
                                      <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                      <span>Editar completo</span>
                                    </TableMenuItem>
                                  </Link>
                                )}
                                {canEdit && (
                                  <TableMenuItem onClick={() => openEditModal(p)}>
                                    <Icon icon="solar:document-medicine-bold-duotone" height={18} />
                                    <span>Editar rápido</span>
                                  </TableMenuItem>
                                )}
                                {canDelete && (
                                  <TableMenuItem className="text-red-600 hover:text-red-700" onClick={() => { setPolizaToDelete(p); setShowDeleteModal(true); }}>
                                    <Icon icon="solar:trash-bin-minimalistic-bold-duotone" height={18} />
                                    <span>Eliminar</span>
                                  </TableMenuItem>
                                )}
                              </TableActionMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden space-y-4">
                  {polizas.map((p) => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 text-blue-500" />
                          <div>
                            <h3 className="font-medium">{p.numero_poliza}</h3>
                            <p className="text-sm text-gray-500">{(p as any).aseguradora_nombre || p.aseguradora}</p>
                          </div>
                        </div>
                        <Badge color={getEstadoBadge(p.estado || 'ACTIVA')}>
                          {estadosPoliza.find(e => e.value === p.estado)?.label || p.estado}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Cliente</p>
                          {p.nombres_cliente || p.apellidos_cliente ? (
                            <p className="text-sm font-medium uppercase">{p.nombres_cliente} {p.apellidos_cliente}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Sin cliente asignado</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Prima Neta</p>
                          <p className="text-sm font-medium">{polizaUtils.formatCurrency(p.prima_neta || 0)}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <Button size="xs" color="light" onClick={() => { setSelectedPoliza(p); setShowModal(true); }}>Ver</Button>
                        {canEdit && <Button size="xs" color="blue" onClick={() => openEditModal(p)}>Editar</Button>}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-gray-600">
                      Mostrando {pagination.from} a {pagination.to} de {pagination.total}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span>Por página:</span>
                        <select className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray" value={filters.per_page} onChange={(e) => setFilters(prev => ({ ...prev, per_page: Number(e.target.value), page: 1 }))}>
                          <option value={15}>15</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <Button size="sm" color="gray" disabled={pagination.current_page === 1} onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))} className="rounded-[10px]">
                        <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">Página {pagination.current_page} de {pagination.last_page}</span>
                      <Button size="sm" color="gray" disabled={pagination.current_page === pagination.last_page} onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.last_page, (prev.page || 1) + 1) }))} className="rounded-[10px]">
                        <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ─── Create / Edit Modal ─────────────────────────────────────────────── */}
          <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="3xl">
            <Modal.Header>{editingPoliza ? 'Editar póliza' : 'Crear póliza'}</Modal.Header>
            <Modal.Body>
              <div className="space-y-6">
                {/* PDF Reader */}
                {pdfFile && pdfProcessing && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <Spinner size="md" color="info" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-blue-800 dark:text-blue-200">Leyendo PDF con Inteligencia Artificial...</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Los campos del formulario se llenarán automáticamente</p>
                        <div className="mt-2"><Progress progress={pdfProgress} color="blue" size="sm" /></div>
                      </div>
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{pdfProgress}%</span>
                    </div>
                  </div>
                )}
                {pdfFile && !pdfProcessing && pdfConfidence && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-sm text-green-800 dark:text-green-200">PDF procesado correctamente</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Confianza: {pdfConfidence.overall?.toFixed(0) || 0}% — Revisa los campos y guarda</p>
                        </div>
                      </div>
                      <button onClick={removePdf} className="text-green-600 hover:text-red-500 transition-colors" title="Quitar PDF">
                        <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {!pdfFile && (
                  <div {...getPdfRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${isPdfDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}>
                    <input {...getPdfInputProps()} />
                    <div className="flex items-center justify-center gap-3">
                      <Icon icon="solar:cloud-upload-bold-duotone" className="w-6 h-6 text-gray-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{isPdfDragActive ? 'Suelta el PDF aquí' : 'Importar desde PDF con IA'}</p>
                        <p className="text-xs text-gray-500">Arrastra un PDF o haz clic para seleccionar</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 0: Cliente (opcional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative" style={{ zIndex: 1000 }}>
                    <label className="block text-sm font-medium mb-1">Cliente <span className="text-gray-400 text-xs font-normal">(opcional)</span></label>
                    <Input
                      placeholder="Buscar por nombre, documento, teléfono..."
                      value={selectedClient ? `${selectedClient.nombre} (${selectedClient.documento || 'sin doc'})` : clientQuery}
                      onChange={(e) => {
                        setSelectedClient(null);
                        setClientQuery(e.target.value);
                        setFormData(prev => ({ ...prev, cliente_id: '' }));
                      }}
                      className={!formData.cliente_id && !selectedClient ? '' : 'border-green-400'}
                    />
                    {selectedClient && (
                      <button
                        type="button"
                        onClick={() => { setSelectedClient(null); setClientQuery(''); setFormData(prev => ({ ...prev, cliente_id: '' })); }}
                        className="absolute right-2 top-[34px] text-gray-400 hover:text-red-500"
                      >
                        <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                      </button>
                    )}
                    {!selectedClient && (clientQuery.length >= 2 || clientLoading) && (
                      <div className="absolute left-0 right-0 z-[99999] mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-2xl max-h-48 overflow-auto">
                        {clientLoading ? (
                          <div className="p-2 text-xs text-gray-500 flex items-center gap-2"><Spinner size="xs" /> Buscando...</div>
                        ) : clientResults.length === 0 ? (
                          <div className="p-2 text-xs text-gray-500">Sin resultados</div>
                        ) : clientResults.map(c => (
                          <div key={c.id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => {
                            setSelectedClient(c);
                            setClientQuery('');
                            setFormData(prev => ({ ...prev, cliente_id: c.id }));
                          }}>
                            <div className="text-xs font-medium">{c.nombre}</div>
                            <div className="text-[10px] text-gray-500">{c.documento || ''} {c.celular ? `• ${c.celular}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <span className="text-red-500">*</span> Número de póliza
                    </label>
                    <Input name="numero_poliza" value={formData.numero_poliza} onChange={handleFormChange} placeholder="Número de póliza" />
                  </div>
                </div>

                {/* Row 1: Nombre asegurado, Nombre tomador */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre asegurado</label>
                    <Input name="nombre_asegurado" value={formData.nombre_asegurado} onChange={handleFormChange} placeholder="Nombre asegurado" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre tomador</label>
                    <Input name="nombre_tomador" value={formData.nombre_tomador} onChange={handleFormChange} placeholder="Nombre tomador" />
                  </div>
                </div>

                {/* Row 2: Vendedor, Aseguradora, Ramo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <span className="text-red-500">*</span> Vendedor
                    </label>
                    <select name="vendedor_id" value={formData.vendedor_id} onChange={handleFormChange} className="w-full border rounded-md p-2 text-sm dark:bg-darkgray">
                      <option value="">Busca y selecciona un Vendedor</option>
                      {vendedores.map((v: any) => (
                        <option key={v.id} value={v.id}>{v.nombres || v.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <span className="text-red-500">*</span> Aseguradora
                    </label>
                    <select name="aseguradora_id" value={formData.aseguradora_id} onChange={handleFormChange} className="w-full border rounded-md p-2 text-sm dark:bg-darkgray">
                      <option value="">Seleccionar aseguradora</option>
                      {aseguradoras.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <span className="text-red-500">*</span> Ramo
                    </label>
                    <select name="ramo_id" value={formData.ramo_id} onChange={(e) => { handleFormChange(e); setFormData(prev => ({ ...prev, subramo: '' })); }} className="w-full border rounded-md p-2 text-sm dark:bg-darkgray">
                      <option value="">Selecciona un ramo</option>
                      {ramos.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.nombre || r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subramo (if available) */}
                {getSubramos().length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Subramo</label>
                      <select name="subramo" value={formData.subramo} onChange={handleFormChange} className="w-full border rounded-md p-2 text-sm dark:bg-darkgray">
                        <option value="">Seleccionar subramo</option>
                        {getSubramos().map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Row 3: Prima neta, Gastos expedición, % IVA, IVA calculado */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prima neta</label>
                    <Input name="prima_neta" type="number" step="0.01" value={formData.prima_neta} onChange={handleFormChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gastos de expedición</label>
                    <Input name="gastos_expedicion" type="number" step="0.01" value={formData.gastos_expedicion} onChange={handleFormChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">% IVA Prima</label>
                    <Input name="porcentaje_iva" type="number" step="0.01" value={formData.porcentaje_iva} onChange={handleFormChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-500">IVA ($)</label>
                    <Input
                      type="text"
                      readOnly
                      value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format((parseFloat(formData.prima_neta) || 0) * ((parseFloat(formData.porcentaje_iva) || 0) / 100))}
                      className="bg-gray-50 dark:bg-gray-800 cursor-default"
                    />
                  </div>
                </div>

                {/* Row 3b: Porcentaje comisión, Comisión calculada, Total */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">% Comisión</label>
                    <Input name="porcentaje_comision" type="number" step="0.01" value={formData.porcentaje_comision} onChange={handleFormChange} placeholder="%" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-500">Comisión ($)</label>
                    <Input
                      type="text"
                      readOnly
                      value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format((parseFloat(formData.prima_neta) || 0) * ((parseFloat(formData.porcentaje_comision) || 0) / 100))}
                      className="bg-gray-50 dark:bg-gray-800 cursor-default"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-blue-700 dark:text-blue-300 font-bold">Total (auto-calculado)</label>
                    <Input
                      name="total"
                      type="text"
                      readOnly
                      value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(parseFloat(formData.total) || 0)}
                      className="bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-800 dark:text-blue-200 cursor-default text-lg"
                    />
                  </div>
                </div>

                {/* Row 4: Recaudo, Fecha recaudación */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Recaudo (opcional)</label>
                    <div className="flex flex-col gap-1.5 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipo_recaudo"
                          value=""
                          checked={formData.tipo_recaudo === ''}
                          onChange={() => setFormData(prev => ({ ...prev, tipo_recaudo: '', fecha_recaudacion: '' }))}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Sin recaudo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipo_recaudo"
                          value="oficina"
                          checked={formData.tipo_recaudo === 'oficina'}
                          onChange={() => setFormData(prev => ({ ...prev, tipo_recaudo: 'oficina' }))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Recaudado en oficina</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipo_recaudo"
                          value="aseguradora"
                          checked={formData.tipo_recaudo === 'aseguradora'}
                          onChange={() => setFormData(prev => ({ ...prev, tipo_recaudo: 'aseguradora' }))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Recaudado en aseguradora</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Fecha de recaudación
                      {formData.tipo_recaudo && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <Input
                      name="fecha_recaudacion"
                      type="date"
                      value={formData.fecha_recaudacion}
                      onChange={handleFormChange}
                      disabled={!formData.tipo_recaudo}
                      className={!formData.tipo_recaudo ? 'opacity-50' : ''}
                    />
                    {formData.tipo_recaudo && (
                      <p className="text-[10px] text-blue-600 mt-1">
                        Se generará un recibo de caja en cartera al guardar
                      </p>
                    )}
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Row 5: Fecha inicio, Forma de pago */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
                    <Input name="fecha_inicio" type="date" value={formData.fecha_inicio} onChange={handleFormChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Forma de pago</label>
                    <Input name="forma_pago" value={formData.forma_pago} onChange={handleFormChange} placeholder="Forma de pago" />
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <div className="flex justify-end gap-3 w-full">
                <Button color="gray" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                <Button color="blue" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><Spinner size="sm" className="mr-2" /> Guardando...</> : 'Guardar'}
                </Button>
              </div>
            </Modal.Footer>
          </Modal>

          {/* ─── Detail Modal ────────────────────────────────────────────────────── */}
          <Modal show={showModal} onClose={() => setShowModal(false)} size="4xl">
            <Modal.Header>Detalle de Póliza {selectedPoliza?.numero_poliza}</Modal.Header>
            <Modal.Body>
              {selectedPoliza && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Información de la Póliza</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><strong>Número:</strong><span>{selectedPoliza.numero_poliza}</span></div>
                      <div className="flex justify-between"><strong>Aseguradora:</strong><span>{(selectedPoliza as any).aseguradora_nombre || selectedPoliza.aseguradora}</span></div>
                      <div className="flex justify-between"><strong>Ramo:</strong><span>{(selectedPoliza as any).ramo_nombre || selectedPoliza.ramo_principal}</span></div>
                      <div className="flex justify-between"><strong>Subramo:</strong><span>{selectedPoliza.subramo || '-'}</span></div>
                      <div className="flex justify-between items-center"><strong>Estado:</strong><Badge color={getEstadoBadge(selectedPoliza.estado || 'ACTIVA')}>{selectedPoliza.estado}</Badge></div>
                      <div className="flex justify-between"><strong>Prima Neta:</strong><span>{polizaUtils.formatCurrency(selectedPoliza.prima_neta || 0)}</span></div>
                      <div className="flex justify-between"><strong>IVA:</strong><span>{polizaUtils.formatCurrency(selectedPoliza.iva || 0)}</span></div>
                      <div className="flex justify-between font-semibold"><strong>Total:</strong><span>{polizaUtils.formatCurrency(selectedPoliza.total || 0)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Información del Cliente</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><strong>Nombre:</strong><span>{selectedPoliza.nombres_cliente} {selectedPoliza.apellidos_cliente}</span></div>
                      <div className="flex justify-between"><strong>Documento:</strong><span>{selectedPoliza.dni_cliente}</span></div>
                      <div className="flex justify-between"><strong>Teléfono:</strong><span>{selectedPoliza.celular_cliente || '-'}</span></div>
                      <div className="flex justify-between"><strong>Email:</strong><span className="text-right max-w-48 truncate">{selectedPoliza.correo_cliente || '-'}</span></div>
                    </div>
                    <h4 className="font-semibold mb-3 mt-6">Fechas</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><strong>Inicio:</strong><span>{formatDate(selectedPoliza.fecha_inicio)}</span></div>
                      <div className="flex justify-between"><strong>Vencimiento:</strong><span>{formatDate(selectedPoliza.fecha_fin)}</span></div>
                      <div className="flex justify-between"><strong>Vendedor:</strong><span>{selectedPoliza.vendedor || (selectedPoliza as any).vendedor_2 || '-'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </Modal.Body>
          </Modal>

          {/* ─── Delete confirmation ─────────────────────────────────────────────── */}
          <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md">
            <Modal.Header>Confirmar Eliminación</Modal.Header>
            <Modal.Body>
              <div className="text-center">
                <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="mb-5 text-lg font-normal text-gray-500">
                  ¿Estás seguro de que deseas eliminar la póliza <strong>{polizaToDelete?.numero_poliza}</strong>?
                </h3>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button color="failure" onClick={confirmDelete}>Sí, eliminar</Button>
              <Button color="gray" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            </Modal.Footer>
          </Modal>

          {/* ─── Print Format Modal ─────────────────────────────────────────────── */}
          <Modal show={showPrintFormatModal} onClose={() => { setShowPrintFormatModal(false); setReciboParaImprimir(null); }} size="sm">
            <Modal.Header>
              <div className="flex items-center gap-2">
                <Icon icon="solar:printer-bold-duotone" className="w-5 h-5 text-amber-600" />
                Imprimir Recibo {reciboParaImprimir?.numero_recibo ? `#${reciboParaImprimir.numero_recibo}` : ''}
              </div>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-gray-500 mb-4">Selecciona el formato de impresión:</p>
              <div className="flex flex-col gap-3">
                <Button color="blue" onClick={() => { imprimirRecibo(reciboParaImprimir, 'media_carta'); setShowPrintFormatModal(false); setReciboParaImprimir(null); }} className="w-full">
                  <Icon icon="solar:document-bold-duotone" className="w-4 h-4 mr-2" />
                  Media Carta
                </Button>
                <Button color="light" onClick={() => { imprimirRecibo(reciboParaImprimir, 'carta'); setShowPrintFormatModal(false); setReciboParaImprimir(null); }} className="w-full">
                  <Icon icon="solar:documents-bold-duotone" className="w-4 h-4 mr-2" />
                  Carta Completa (con copia)
                </Button>
              </div>
            </Modal.Body>
          </Modal>
        </div>
      </PermissionGate>
    </OnboardingGuard>
  );
};

export default Cumplimiento;

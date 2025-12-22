import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, Modal, TextInput, Select, Badge, Spinner, Tooltip, Label, Table } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { saasApi } from 'src/services/saasApi';
import liquidacionesVendedoresService from 'src/services/liquidacionesVendedoresService';
import { useToast } from 'src/hooks/use-toast';

type Props = { 
  polizaId: string; 
  numeroPoliza: string;
  vendedorId?: number;
  vendedorId2?: number;
  vendedorNombre?: string;
  vendedor2Nombre?: string;
  aseguradoraNombre?: string;
  ramoNombre?: string;
  clienteNombre?: string;
};

type Vendedor = {
  id: number;
  nombres: string;
  porcentaje_comision: number;
  porcentaje_retencion: number;      // RTF
  porcentaje_iva: number;            // % IVA
  porcentaje_retencion_iva: number;  // ReteIVA (% sobre el IVA)
  porcentaje_retencion_ica: number;  // ReteICA
};

type LiquidacionGenerada = {
  id: number;
  codigo: string;
  vendedor?: { id: number; nombres: string };
  periodo_inicio: string;
  periodo_fin: string;
  cantidad_polizas: number;
  monto_neto_total: number;
  created_at: string;
};

type ComisionTemp = {
  id: string;
  vendedor_id: string;
  tipo_movimiento: string;
  anexo: string;
  abono_prima: string;
  porcentaje_comision: string; // % del ramo/aseguradora
  porcentaje_agencia: string;  // % que se queda la agencia
  porcentaje_vendedor: string; // % que se le paga al vendedor
  porcentaje_rtf: string;      // Retención en la fuente
  porcentaje_iva: string;      // % IVA (base para calcular ReteIVA)
  porcentaje_reteiva: string;  // Retención de IVA (% sobre el IVA)
  porcentaje_reteica: string;  // Retención ICA
  esPolizaPrincipal?: boolean;
  esAnexo?: boolean;
};

const TIPOS_MOVIMIENTO = [
  { value: 'CREACIÓN', label: 'Creación' },
  { value: 'RENOVACIÓN', label: 'Renovación' },
  { value: 'ANEXO', label: 'Anexo' },
  { value: 'ENDOSO', label: 'Endoso' },
  { value: 'CANCELACIÓN', label: 'Cancelación' },
  { value: 'AJUSTE', label: 'Ajuste' },
];

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    // Si ya tiene hora, usarla directamente; si no, agregar T00:00:00
    const dateString = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateStr; // Si no es válida, retornar el string original
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr; // En caso de error, retornar el string original
  }
};

const calcularValores = (abonoPrima: number, porcentajeComisionRamo: number, porcentajeVendedor: number, porcentajeRtf: number, porcentajeIva: number, porcentajeReteiva: number, porcentajeReteica: number) => {
  // 1. Comisión total del ramo (lo que paga la aseguradora)
  const comisionTotalRamo = abonoPrima * (porcentajeComisionRamo / 100);
  // 2. Valor comisión del vendedor (su porcentaje de la comisión total)
  const valorComision = comisionTotalRamo * (porcentajeVendedor / 100);
  // 3. IVA: se SUMA al valor de comisión (es un ingreso adicional)
  const ivaCalculado = valorComision * (porcentajeIva / 100);
  // 4. Deducciones (se restan):
  //    - RTF: sobre el valor de comisión
  const rtfCalculada = valorComision * (porcentajeRtf / 100);
  //    - ReteIVA: sobre el IVA
  const reteivaCalculada = ivaCalculado * (porcentajeReteiva / 100);
  //    - ReteICA: sobre el valor de comisión
  const reteicaCalculada = valorComision * (porcentajeReteica / 100);
  // 5. Neto = valor comisión + IVA - deducciones (RTF, ReteIVA, ReteICA)
  const netoComision = valorComision + ivaCalculado - rtfCalculada - reteivaCalculada - reteicaCalculada;
  return { 
    comision_total_ramo: comisionTotalRamo,
    valor_comision: valorComision, 
    iva_calculado: ivaCalculado,
    rtf_calculada: rtfCalculada,
    reteiva_calculada: reteivaCalculada, 
    reteica_calculada: reteicaCalculada, 
    neto_comision: netoComision 
  };
};

const ComisionesPoliza: React.FC<Props> = ({ 
  polizaId, 
  numeroPoliza,
  vendedorId,
  vendedorId2,
  vendedorNombre,
  vendedor2Nombre,
  aseguradoraNombre,
  ramoNombre
}) => {
  const { toast } = useToast();
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionGenerada[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPoliza, setLoadingPoliza] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  
  // Modal de liquidación
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [liquidacionCreada, setLiquidacionCreada] = useState<LiquidacionGenerada | null>(null);
  
  // Comisiones temporales en el modal
  const [comisionesTemp, setComisionesTemp] = useState<ComisionTemp[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState(new Date().toISOString().slice(0, 10));
  const [periodoFin, setPeriodoFin] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');

  // Vendedores de la póliza
  const vendedoresPoliza = useMemo(() => {
    const list: { id: number; nombre: string }[] = [];
    if (vendedorId) list.push({ id: vendedorId, nombre: vendedorNombre || 'Vendedor 1' });
    if (vendedorId2) list.push({ id: vendedorId2, nombre: vendedor2Nombre || 'Vendedor 2' });
    return list;
  }, [vendedorId, vendedorId2, vendedorNombre, vendedor2Nombre]);

  const loadLiquidaciones = async () => {
    setLoading(true);
    try {
      const headers = await saasApi.getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api'}/saas/polizas/${polizaId}/comisiones-manuales/liquidaciones`, { headers });
      const data = await res.json();
      if (data.success) {
        setLiquidaciones(data.data || []);
      }
    } catch (e) {
      console.error('Error loading liquidaciones:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadVendedores = async () => {
    try {
      const res = await saasApi.getVendedores();
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
        setVendedores(list);
      }
    } catch (e) {
      console.error('Error loading vendedores:', e);
    }
  };

  useEffect(() => {
    loadLiquidaciones();
    loadVendedores();
  }, [polizaId]);

  // Cargar datos de la póliza y anexos para precargar el modal
  const loadPolizaData = async () => {
    setLoadingPoliza(true);
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const res = await fetch(`${baseUrl}/saas/polizas/${polizaId}/datos-liquidacion`, { headers });
      const data = await res.json();
      
      if (data.success && data.data) {
        const { poliza, anexos, porcentaje_comision_ramo } = data.data;
        const defaultVendedor = vendedoresPoliza[0];
        const vendedor = defaultVendedor ? vendedores.find(v => v.id === defaultVendedor.id) : null;
        const porcentajeVendedor = vendedor?.porcentaje_comision || 0;
        // % Agencia = 100 - % Vendedor (el vendedor recibe X% de la comisión, la agencia el resto)
        const porcentajeAgencia = Math.max(0, 100 - porcentajeVendedor);
        
        // Usar deducciones del vendedor encontrado en frontend, o del backend como fallback
        const porcentajeRtf = vendedor?.porcentaje_retencion ?? data.data.porcentaje_rtf ?? 0;
        const porcentajeIva = vendedor?.porcentaje_iva ?? 19; // IVA por defecto 19%
        const porcentajeReteiva = vendedor?.porcentaje_retencion_iva ?? data.data.porcentaje_reteiva ?? 0;
        const porcentajeReteica = vendedor?.porcentaje_retencion_ica ?? data.data.porcentaje_reteica ?? 0;
        
        const comisiones: ComisionTemp[] = [];
        
        // Fila de la póliza principal
        comisiones.push({
          id: `poliza-${Date.now()}`,
          vendedor_id: defaultVendedor ? String(defaultVendedor.id) : '',
          tipo_movimiento: 'CREACIÓN',
          anexo: '',
          abono_prima: String(poliza.premium_amount || 0),
          porcentaje_comision: String(porcentaje_comision_ramo || poliza.commission_percentage || 0),
          porcentaje_agencia: String(porcentajeAgencia),
          porcentaje_vendedor: String(porcentajeVendedor),
          porcentaje_rtf: String(porcentajeRtf),
          porcentaje_iva: String(porcentajeIva),
          porcentaje_reteiva: String(porcentajeReteiva),
          porcentaje_reteica: String(porcentajeReteica),
          esPolizaPrincipal: true,
        });
        
        // Filas de anexos
        if (anexos && anexos.length > 0) {
          anexos.forEach((anexo: any, index: number) => {
            comisiones.push({
              id: `anexo-${anexo.id}-${Date.now()}-${index}`,
              vendedor_id: defaultVendedor ? String(defaultVendedor.id) : '',
              tipo_movimiento: 'ANEXO',
              anexo: anexo.anexo_number || String(index + 1),
              abono_prima: String(anexo.prima_neta || 0),
              porcentaje_comision: String(anexo.commission_percentage || porcentaje_comision_ramo || 0),
              porcentaje_agencia: String(porcentajeAgencia),
              porcentaje_vendedor: String(porcentajeVendedor),
              porcentaje_rtf: String(porcentajeRtf),
              porcentaje_iva: String(porcentajeIva),
              porcentaje_reteiva: String(porcentajeReteiva),
              porcentaje_reteica: String(porcentajeReteica),
              esAnexo: true,
            });
          });
        }
        
        setComisionesTemp(comisiones);
      } else {
        // Si no hay datos, crear fila vacía
        handleAddComisionTemp();
      }
    } catch (e) {
      console.error('Error loading poliza data:', e);
      handleAddComisionTemp();
    } finally {
      setLoadingPoliza(false);
    }
  };

  // Abrir modal
  const handleOpenModal = () => {
    setPeriodoInicio(new Date().toISOString().slice(0, 10));
    setPeriodoFin(new Date().toISOString().slice(0, 10));
    setObservaciones('');
    setModalStep(1);
    setLiquidacionCreada(null);
    setComisionesTemp([]);
    setShowModal(true);
    loadPolizaData();
  };

  // Agregar fila en modal
  const handleAddComisionTemp = () => {
    const defaultVendedor = vendedoresPoliza[0];
    const vendedor = defaultVendedor ? vendedores.find(v => v.id === defaultVendedor.id) : null;
    const pctVendedor = vendedor?.porcentaje_comision || 0;
    
    setComisionesTemp(prev => [...prev, {
      id: Date.now().toString(),
      vendedor_id: defaultVendedor ? String(defaultVendedor.id) : '',
      tipo_movimiento: 'CREACIÓN',
      anexo: '',
      abono_prima: '',
      porcentaje_comision: '',
      porcentaje_agencia: String(Math.max(0, 100 - pctVendedor)),
      porcentaje_vendedor: String(pctVendedor),
      porcentaje_rtf: vendedor ? String(vendedor.porcentaje_retencion || 0) : '',
      porcentaje_iva: vendedor ? String(vendedor.porcentaje_iva || 19) : '19',
      porcentaje_reteiva: vendedor ? String(vendedor.porcentaje_retencion_iva || 0) : '',
      porcentaje_reteica: vendedor ? String(vendedor.porcentaje_retencion_ica || 0) : '',
    }]);
  };

  // Eliminar fila en modal
  const handleRemoveComisionTemp = (id: string) => {
    setComisionesTemp(prev => prev.filter(c => c.id !== id));
  };

  // Actualizar fila en modal
  const handleUpdateComisionTemp = (id: string, field: keyof ComisionTemp, value: string) => {
    setComisionesTemp(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      
      // Si cambia el vendedor, actualizar % vendedor, deducciones y recalcular % agencia
      if (field === 'vendedor_id') {
        const vendedor = vendedores.find(v => String(v.id) === value);
        if (vendedor) {
          const pctVendedor = vendedor.porcentaje_comision || 0;
          updated.porcentaje_vendedor = String(pctVendedor);
          updated.porcentaje_rtf = String(vendedor.porcentaje_retencion || 0);
          updated.porcentaje_iva = String(vendedor.porcentaje_iva || 19);
          updated.porcentaje_reteiva = String(vendedor.porcentaje_retencion_iva || 0);
          updated.porcentaje_reteica = String(vendedor.porcentaje_retencion_ica || 0);
          // % Agencia = 100 - % Vendedor (el vendedor recibe X% de la comisión, la agencia el resto)
          updated.porcentaje_agencia = String(Math.max(0, 100 - pctVendedor));
        }
      }
      
      // Si cambia % comisión del ramo, NO afecta el % agencia (es independiente)
      // El % agencia depende solo del % vendedor
      
      // Si cambia % vendedor, recalcular % agencia
      if (field === 'porcentaje_vendedor') {
        const pctVendedor = parseFloat(value) || 0;
        // % Agencia = 100 - % Vendedor
        updated.porcentaje_agencia = String(Math.max(0, 100 - pctVendedor));
      }
      
      return updated;
    }));
  };

  // Calcular totales del modal
  const totalesModal = useMemo(() => {
    let abono_prima = 0;
    let valor_comision = 0;
    let neto_comision = 0;
    
    comisionesTemp.forEach(c => {
      const abono = parseFloat(c.abono_prima) || 0;
      const calc = calcularValores(
        abono, 
        parseFloat(c.porcentaje_comision) || 0,  // % comisión del ramo
        parseFloat(c.porcentaje_vendedor) || 0,  // % del vendedor
        parseFloat(c.porcentaje_rtf) || 0,
        parseFloat(c.porcentaje_iva) || 0,       // % IVA
        parseFloat(c.porcentaje_reteiva) || 0,   // % ReteIVA (sobre el IVA)
        parseFloat(c.porcentaje_reteica) || 0
      );
      abono_prima += abono;
      valor_comision += calc.valor_comision;
      neto_comision += calc.neto_comision;
    });
    
    return { count: comisionesTemp.length, abono_prima, valor_comision, neto_comision };
  }, [comisionesTemp]);

  // Generar liquidación
  const handleGenerarLiquidacion = async () => {
    // Permitir valores negativos en abono_prima (ej: cancelaciones, ajustes)
    const comisionesValidas = comisionesTemp.filter(c => 
      c.vendedor_id && parseFloat(c.abono_prima) !== 0 && parseFloat(c.porcentaje_vendedor) > 0
    );
    
    if (comisionesValidas.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos una comisión válida', variant: 'destructive' });
      return;
    }

    if (!periodoInicio || !periodoFin) {
      toast({ title: 'Error', description: 'Seleccione el período de liquidación', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      
      const payload = {
        poliza_id: polizaId,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        observaciones: observaciones || null,
        comisiones: comisionesValidas.map(c => ({
          vendedor_id: parseInt(c.vendedor_id),
          tipo_movimiento: c.tipo_movimiento,
          anexo: c.anexo || null,
          abono_prima: parseFloat(c.abono_prima) || 0,
          porcentaje_comision: parseFloat(c.porcentaje_comision) || 0,
          porcentaje_agencia: parseFloat(c.porcentaje_agencia) || 0,
          porcentaje_vendedor: parseFloat(c.porcentaje_vendedor) || 0,
          porcentaje_rtf: parseFloat(c.porcentaje_rtf) || 0,
          porcentaje_iva: parseFloat(c.porcentaje_iva) || 0,
          porcentaje_reteiva: parseFloat(c.porcentaje_reteiva) || 0,
          porcentaje_reteica: parseFloat(c.porcentaje_reteica) || 0,
        })),
      };

      const res = await fetch(`${baseUrl}/saas/liquidaciones-manuales-poliza`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setLiquidacionCreada(data.data);
        setModalStep(2);
        toast({ title: 'Éxito', description: `Liquidación ${data.data.codigo} generada correctamente` });
        loadLiquidaciones();
      } else {
        toast({ title: 'Error', description: data.message || 'Error al generar liquidación', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al generar la liquidación', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Descargar PDF
  const handleDownloadPdf = async (liquidacionId: number) => {
    try {
      await liquidacionesVendedoresService.descargarPDF(liquidacionId);
      toast({ title: 'Éxito', description: 'PDF descargado correctamente' });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al descargar el PDF', variant: 'destructive' });
    }
  };

  // Eliminar liquidación
  const handleDeleteLiquidacion = async (liquidacionId: number) => {
    if (!confirm('¿Está seguro de eliminar esta liquidación? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const res = await fetch(`${baseUrl}/saas/liquidaciones-vendedores/${liquidacionId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Éxito', description: 'Liquidación eliminada correctamente' });
        loadLiquidaciones();
      } else {
        toast({ title: 'Error', description: data.message || 'Error al eliminar', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al eliminar la liquidación', variant: 'destructive' });
    }
  };

  // Combinar vendedores
  const vendedorOptions = useMemo(() => {
    const polizaIds = new Set(vendedoresPoliza.map(v => v.id));
    const fromPoliza = vendedoresPoliza.map(v => {
      const full = vendedores.find(vf => vf.id === v.id);
      return { ...v, isPoliza: true, porcentaje: full?.porcentaje_comision };
    });
    const others = vendedores.filter(v => !polizaIds.has(v.id)).map(v => ({
      id: v.id,
      nombre: v.nombres,
      isPoliza: false,
      porcentaje: v.porcentaje_comision,
    }));
    return [...fromPoliza, ...others];
  }, [vendedoresPoliza, vendedores]);

  return (
    <Card>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Liquidación de Comisiones</h3>
            <p className="text-sm text-gray-500">
              Póliza: <strong>{numeroPoliza}</strong> | {aseguradoraNombre} | {ramoNombre}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button color="primary" onClick={handleOpenModal}>
              <Icon icon="solar:document-add-bold" className="w-4 h-4 mr-2" />
              Liquidar Comisión
            </Button>
          </div>
        </div>

        {/* Info vendedores de la póliza */}
        {vendedoresPoliza.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Vendedores de la póliza: </span>
            {vendedoresPoliza.map((v) => (
              <Badge key={v.id} color="info" className="ml-1">{v.nombre}</Badge>
            ))}
          </div>
        )}

        {/* Tabla de liquidaciones generadas */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-2 text-gray-500">Cargando...</span>
          </div>
        ) : liquidaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="solar:document-text-bold-duotone" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay liquidaciones generadas</p>
            <p className="text-sm">Haga clic en "Liquidar Comisión" para crear una nueva</p>
          </div>
        ) : (
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Código</Table.HeadCell>
              <Table.HeadCell>Vendedor</Table.HeadCell>
              <Table.HeadCell>Período</Table.HeadCell>
              <Table.HeadCell className="text-right">Neto Total</Table.HeadCell>
              <Table.HeadCell>Fecha</Table.HeadCell>
              <Table.HeadCell></Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {liquidaciones.map((liq) => (
                <Table.Row key={liq.id}>
                  <Table.Cell className="font-medium">{liq.codigo}</Table.Cell>
                  <Table.Cell>{liq.vendedor?.nombres || '-'}</Table.Cell>
                  <Table.Cell className="text-sm">
                    <div className="flex flex-col">
                      <span><strong>Desde:</strong> {formatDate(liq.periodo_inicio)}</span>
                      <span><strong>Hasta:</strong> {formatDate(liq.periodo_fin)}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono font-semibold text-green-600">
                    {formatCurrency(liq.monto_neto_total)}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-gray-500">
                    {new Date(liq.created_at).toLocaleDateString('es-CO')}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Tooltip content="Descargar PDF">
                        <Button color="light" size="xs" onClick={() => handleDownloadPdf(liq.id)}>
                          <Icon icon="solar:download-bold" className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Eliminar">
                        <Button color="light" size="xs" onClick={() => handleDeleteLiquidacion(liq.id)}>
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 text-red-500" />
                        </Button>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Modal Liquidar Comisión */}
      <Modal show={showModal} onClose={() => !saving && setShowModal(false)} size="7xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:document-add-bold" className="w-5 h-5 text-primary" />
            Liquidar Comisión - Póliza {numeroPoliza}
          </div>
        </Modal.Header>
        <Modal.Body>
          {loadingPoliza ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
              <span className="ml-2 text-gray-500">Cargando datos de la póliza...</span>
            </div>
          ) : modalStep === 1 ? (
            <div className="space-y-4">
              {/* Período */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodo_inicio" value="Período Inicio *" />
                  <TextInput
                    id="periodo_inicio"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="periodo_fin" value="Período Fin *" />
                  <TextInput
                    id="periodo_fin"
                    type="date"
                    value={periodoFin}
                    onChange={(e) => setPeriodoFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <Label htmlFor="observaciones" value="Observaciones / Nota" />
                <TextInput
                  id="observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales para la liquidación..."
                />
              </div>

              {/* Tabla de comisiones */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label value="Comisiones a liquidar" />
                  <Button color="light" size="xs" onClick={handleAddComisionTemp}>
                    <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" />
                    Agregar fila
                  </Button>
                </div>
                <div className="overflow-x-auto border rounded" style={{ maxWidth: '100%' }}>
                  <table className="text-sm" style={{ minWidth: '1400px' }}>
                    <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left" style={{ minWidth: '160px' }}>Vendedor</th>
                        <th className="px-2 py-2 text-left" style={{ minWidth: '100px' }}>Tipo</th>
                        <th className="px-2 py-2 text-left" style={{ minWidth: '70px' }}>Anexo</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '120px' }}>Prima</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '70px' }}>% Com</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '80px' }}>% Agencia</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '80px' }}>% Asesor</th>
                        <th className="px-2 py-2 text-right bg-blue-50 dark:bg-blue-900/30" style={{ minWidth: '110px' }}>Val. Com.</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '70px' }}>% RTF</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '70px' }}>% IVA</th>
                        <th className="px-2 py-2 text-right bg-blue-50 dark:bg-blue-900/30" style={{ minWidth: '100px' }}>IVA</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '80px' }}>% ReteIVA</th>
                        <th className="px-2 py-2 text-right" style={{ minWidth: '80px' }}>% ReteICA</th>
                        <th className="px-2 py-2 text-right bg-green-50 dark:bg-green-900/30 font-semibold" style={{ minWidth: '120px' }}>TOTAL</th>
                        <th className="px-2 py-2" style={{ minWidth: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comisionesTemp.map((c) => {
                        const calc = calcularValores(
                          parseFloat(c.abono_prima) || 0,
                          parseFloat(c.porcentaje_comision) || 0,  // % comisión del ramo
                          parseFloat(c.porcentaje_vendedor) || 0,  // % del vendedor
                          parseFloat(c.porcentaje_rtf) || 0,
                          parseFloat(c.porcentaje_iva) || 0,       // % IVA
                          parseFloat(c.porcentaje_reteiva) || 0,   // % ReteIVA (sobre el IVA)
                          parseFloat(c.porcentaje_reteica) || 0
                        );
                        return (
                          <tr key={c.id} className={`border-b ${c.esPolizaPrincipal ? 'bg-blue-50 dark:bg-blue-900/20' : c.esAnexo ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                            <td className="px-1 py-2">
                              <Select
                                sizing="sm"
                                value={c.vendedor_id}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'vendedor_id', e.target.value)}
                              >
                                <option value="">Seleccionar</option>
                                {vendedorOptions.length > 0 && vendedoresPoliza.length > 0 && (
                                  <optgroup label="Vendedores de la póliza">
                                    {vendedorOptions.filter(v => v.isPoliza).map(v => (
                                      <option key={v.id} value={v.id}>{v.nombre}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {vendedorOptions.filter(v => !v.isPoliza).length > 0 && (
                                  <optgroup label="Otros vendedores">
                                    {vendedorOptions.filter(v => !v.isPoliza).map(v => (
                                      <option key={v.id} value={v.id}>{v.nombre}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </Select>
                            </td>
                            <td className="px-1 py-2">
                              <Select
                                sizing="sm"
                                value={c.tipo_movimiento}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'tipo_movimiento', e.target.value)}
                              >
                                {TIPOS_MOVIMIENTO.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                value={c.anexo}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'anexo', e.target.value)}
                                placeholder="-"
                                disabled={c.esPolizaPrincipal}
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                value={c.abono_prima}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'abono_prima', e.target.value)}
                                placeholder="0"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_comision}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_comision', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_agencia}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_agencia', e.target.value)}
                                placeholder="%"
                                className="text-right bg-gray-50"
                                readOnly
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_vendedor}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_vendedor', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2 text-right font-mono text-blue-600">
                              {formatCurrency(calc.valor_comision)}
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_rtf}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_rtf', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_iva}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_iva', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2 text-right font-mono text-blue-500">
                              {formatCurrency(calc.iva_calculado)}
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_reteiva}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_reteiva', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2">
                              <TextInput
                                sizing="sm"
                                type="number"
                                step="0.01"
                                value={c.porcentaje_reteica}
                                onChange={(e) => handleUpdateComisionTemp(c.id, 'porcentaje_reteica', e.target.value)}
                                placeholder="%"
                                className="text-right"
                              />
                            </td>
                            <td className="px-1 py-2 text-right font-mono font-bold text-green-600">
                              {formatCurrency(calc.neto_comision)}
                            </td>
                            <td className="px-1 py-2">
                              {comisionesTemp.length > 1 && (
                                <button
                                  onClick={() => handleRemoveComisionTemp(c.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Fila de totales */}
                      <tr className="bg-gray-200 dark:bg-gray-600 font-semibold">
                        <td colSpan={3} className="px-3 py-3 text-right text-sm">TOTALES:</td>
                        <td className="px-2 py-3 text-right font-mono">{formatCurrency(totalesModal.abono_prima)}</td>
                        <td colSpan={3} className="px-2 py-3"></td>
                        <td className="px-2 py-3 text-right font-mono bg-blue-100 dark:bg-blue-900/50">{formatCurrency(totalesModal.valor_comision)}</td>
                        <td colSpan={5} className="px-2 py-3 text-center text-xs text-gray-600 dark:text-gray-300">+ IVA − Retenciones</td>
                        <td className="px-2 py-3 text-right font-mono font-bold text-green-700 bg-green-100 dark:bg-green-900/50">{formatCurrency(totalesModal.neto_comision)}</td>
                        <td className="px-2 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="inline-block w-3 h-3 bg-blue-100 mr-1"></span> Póliza principal
                  <span className="inline-block w-3 h-3 bg-yellow-100 ml-3 mr-1"></span> Anexo
                </p>
              </div>
            </div>
          ) : liquidacionCreada && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:check-circle-bold" className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">¡Liquidación Generada!</h3>
              <p className="text-gray-500 mb-4">
                Código: <strong>{liquidacionCreada.codigo}</strong>
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left max-w-md mx-auto">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Vendedor:</span> {liquidacionCreada.vendedor?.nombres}</div>
                  <div><span className="text-gray-500">Período:</span> {liquidacionCreada.periodo_inicio} - {liquidacionCreada.periodo_fin}</div>
                  <div><span className="text-gray-500">Comisiones:</span> {liquidacionCreada.cantidad_polizas}</div>
                  <div><span className="text-gray-500">Neto Total:</span> <strong className="text-green-600">{formatCurrency(liquidacionCreada.monto_neto_total)}</strong></div>
                </div>
              </div>
              <div className="flex justify-center">
                <Button color="primary" onClick={() => handleDownloadPdf(liquidacionCreada.id)}>
                  <Icon icon="solar:download-bold" className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {modalStep === 1 && !loadingPoliza && (
            <>
              <Button color="light" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button 
                color="primary" 
                onClick={handleGenerarLiquidacion} 
                disabled={saving || totalesModal.count === 0}
              >
                {saving ? (
                  <><Spinner size="sm" className="mr-2" /> Generando...</>
                ) : (
                  <><Icon icon="solar:document-add-bold" className="w-4 h-4 mr-2" /> Generar Liquidación</>
                )}
              </Button>
            </>
          )}
          {modalStep === 2 && (
            <Button color="light" onClick={() => setShowModal(false)}>Cerrar</Button>
          )}
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default ComisionesPoliza;

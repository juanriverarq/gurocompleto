import React, { useState, useCallback } from 'react';
import { Card, Button, Label, Spinner, Table, TextInput, Badge, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { saasApi } from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

interface VendedorLiquidacion {
  id: number;
  nombres: string;
  tipo_documento: string;
  numero_documento: string;
  porcentaje_comision: number;
  porcentaje_retencion: number;
  porcentaje_retencion_iva: number;
  porcentaje_retencion_ica: number;
  // Valores calculados
  total_prima: number;
  valor_comision: number;
  retencion_fuente: number;
  retencion_iva: number;
  retencion_ica: number;
  pago_final: number;
  cantidad_polizas: number;
}

interface PolizaDetalle {
  liquidacion_codigo: string;
  liquidacion_fecha: string;
  numero_poliza: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  fecha_poliza: string;
  prima_neta: number;
  porcentaje_comision: number;
  porcentaje_comision_ramo: number | null;
  comision_bruta: number;
  retencion_fuente: number;
  retencion_iva: number;
  retencion_ica: number;
  comision_neta: number;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0 
  }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_more: boolean;
}

const ReporteLiquidaciones: React.FC = () => {
  const { toast } = useToast();
  const { tenant } = useUnifiedAuth();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [liquidaciones, setLiquidaciones] = useState<VendedorLiquidacion[]>([]);
  const [totales, setTotales] = useState({
    total_prima: 0,
    valor_comision: 0,
    retencion_fuente: 0,
    retencion_iva: 0,
    retencion_ica: 0,
    pago_final: 0,
    cantidad_polizas: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0,
    has_more: false,
  });

  // Estado para el modal de reporte por vendedor
  const [showVendedorModal, setShowVendedorModal] = useState(false);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<VendedorLiquidacion | null>(null);
  const [polizasVendedor, setPolizasVendedor] = useState<PolizaDetalle[]>([]);
  const [totalesVendedor, setTotalesVendedor] = useState({
    cantidad_polizas: 0,
    prima_total: 0,
    comision_bruta_total: 0,
    retencion_total: 0,
    reteiva_total: 0,
    retencion_ica_total: 0,
    comision_neta_total: 0,
  });
  const [loadingVendedor, setLoadingVendedor] = useState(false);

  // Obtener logo del tenant
  const logoUrl = (tenant as any)?.logo_url || (tenant as any)?.branding?.logo || null;
  const nombreAgencia = (tenant as any)?.nombre || (tenant as any)?.branding?.nombre_comercial || 'Mi Agencia';

  // Cargar reporte con paginación
  const cargarReporte = useCallback(async (page: number = 1) => {
    if (!periodoInicio || !periodoFin) {
      toast({ title: 'Error', description: 'Seleccione el período de liquidación', variant: 'destructive' });
      return;
    }

    setLoading(true);
    if (page === 1) setLiquidaciones([]);
    
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      
      // Obtener liquidaciones por vendedor en el período (desde liquidaciones_vendedores_cabecera)
      const url = `${baseUrl}/saas/liquidaciones-vendedores/reporte?fecha_inicio=${periodoInicio}&fecha_fin=${periodoFin}&page=${page}&per_page=${pagination.per_page}`;
      const res = await fetch(url, { headers });
      const result = await res.json();
      
      if (result.success && result.data) {
        // El endpoint ya devuelve datos agrupados por vendedor
        const liquidacionesList: VendedorLiquidacion[] = result.data.map((v: any) => ({
          id: v.vendedor_id || 0,
          nombres: v.vendedor || 'Sin nombre',
          tipo_documento: v.porcentajes?.tipo_documento || '',
          numero_documento: v.porcentajes?.numero_documento || '',
          porcentaje_comision: v.porcentajes?.comision || 0,
          porcentaje_retencion: v.porcentajes?.retencion || 0,
          porcentaje_retencion_iva: v.porcentajes?.retencion_iva || 0,
          porcentaje_retencion_ica: v.porcentajes?.retencion_ica || 0,
          total_prima: v.prima_total || 0,
          valor_comision: v.comision_bruta_total || 0,
          retencion_fuente: v.retencion_total || 0,
          retencion_iva: v.reteiva_total || 0,
          retencion_ica: v.retencion_ica_total || 0,
          pago_final: v.comision_neta_total || 0,
          cantidad_polizas: (v.total_polizas || 0) + (v.total_comisiones_manuales || 0),
        }));
        
        setLiquidaciones(liquidacionesList);
        
        // Usar totales del backend (calculados sobre todos los datos)
        if (result.totales) {
          setTotales({
            total_prima: result.totales.prima_total || 0,
            valor_comision: result.totales.comision_bruta_total || 0,
            retencion_fuente: result.totales.retencion_total || 0,
            retencion_iva: result.totales.reteiva_total || 0,
            retencion_ica: result.totales.retencion_ica_total || 0,
            pago_final: result.totales.comision_neta_total || 0,
            cantidad_polizas: result.totales.total_polizas || 0,
          });
        }
        
        // Actualizar paginación
        if (result.pagination) {
          setPagination(result.pagination);
        }
        
        if (page === 1 && liquidacionesList.length > 0) {
          toast({ title: 'Éxito', description: `Se encontraron ${result.pagination?.total || liquidacionesList.length} vendedores con liquidaciones` });
        } else if (page === 1 && liquidacionesList.length === 0) {
          toast({ title: 'Info', description: 'No se encontraron liquidaciones en el período seleccionado' });
        }
      } else {
        if (page === 1) {
          toast({ title: 'Info', description: result.message || 'No se encontraron liquidaciones en el período seleccionado' });
        }
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al generar el reporte. Verifique la conexión.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [periodoInicio, periodoFin, pagination.per_page, toast]);

  // Generar reporte (primera página)
  const handleGenerarReporte = () => cargarReporte(1);

  // Cambiar página
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      cargarReporte(newPage);
    }
  };

  // Obtener TODOS los datos del período (sin paginación) para exportar/imprimir
  const obtenerTodosLosDatos = async (): Promise<VendedorLiquidacion[]> => {
    const headers = await saasApi.getAuthHeaders();
    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
    // Pedir todos los datos (per_page muy alto)
    const url = `${baseUrl}/saas/liquidaciones-vendedores/reporte?fecha_inicio=${periodoInicio}&fecha_fin=${periodoFin}&page=1&per_page=10000`;
    const res = await fetch(url, { headers });
    const result = await res.json();
    
    if (result.success && result.data) {
      return result.data.map((v: any) => ({
        id: v.vendedor_id || 0,
        nombres: v.vendedor || 'Sin nombre',
        tipo_documento: v.porcentajes?.tipo_documento || '',
        numero_documento: v.porcentajes?.numero_documento || '',
        porcentaje_comision: v.porcentajes?.comision || 0,
        porcentaje_retencion: v.porcentajes?.retencion || 0,
        porcentaje_retencion_iva: v.porcentajes?.retencion_iva || 0,
        porcentaje_retencion_ica: v.porcentajes?.retencion_ica || 0,
        total_prima: v.prima_total || 0,
        valor_comision: v.comision_bruta_total || 0,
        retencion_fuente: v.retencion_total || 0,
        retencion_iva: v.reteiva_total || 0,
        retencion_ica: v.retencion_ica_total || 0,
        pago_final: v.comision_neta_total || 0,
        cantidad_polizas: (v.total_polizas || 0) + (v.total_comisiones_manuales || 0),
      }));
    }
    return [];
  };

  // Exportar a Excel (todos los datos del período)
  const handleExportExcel = async () => {
    if (liquidaciones.length === 0) {
      toast({ title: 'Error', description: 'No hay datos para exportar', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      // Obtener TODOS los datos del período
      const todosLosVendedores = await obtenerTodosLosDatos();
      
      // Headers
      const headers = [
        'Vendedor',
        'Documento',
        'Cant. Pólizas',
        'Total Prima',
        '% Comisión',
        'Valor Comisión',
        '% Ret. Fuente',
        'Ret. Fuente',
        '% Ret. IVA',
        'Ret. IVA',
        '% Ret. ICA',
        'Ret. ICA',
        'Pago Final'
      ].map(h => `"${h}"`).join('\t');
      
      // Rows (todos los vendedores)
      const rows = todosLosVendedores.map(v => [
        `"${v.nombres}"`,
        `"${v.tipo_documento} ${v.numero_documento}"`,
        v.cantidad_polizas,
        v.total_prima,
        v.porcentaje_comision,
        v.valor_comision,
        v.porcentaje_retencion,
        v.retencion_fuente,
        v.porcentaje_retencion_iva,
        v.retencion_iva,
        v.porcentaje_retencion_ica,
        v.retencion_ica,
        v.pago_final
      ].join('\t')).join('\n');
      
      // Fila de totales (usar los totales del estado que ya tienen el total general)
      const totalesRow = [
        '"TOTALES"',
        '""',
        totales.cantidad_polizas,
        totales.total_prima,
        '""',
        totales.valor_comision,
        '""',
        totales.retencion_fuente,
        '""',
        totales.retencion_iva,
        '""',
        totales.retencion_ica,
        totales.pago_final
      ].join('\t');

      // Encabezado del reporte
      const titulo = `"REPORTE DE LIQUIDACIONES"\t\t\t\t\t\t\t\t\t\t\t\t`;
      const periodo = `"Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}"\t\t\t\t\t\t\t\t\t\t\t\t`;
      const fechaGen = `"Generado: ${new Date().toLocaleDateString('es-CO')}"\t\t\t\t\t\t\t\t\t\t\t\t`;
      const totalVendedores = `"Total vendedores: ${todosLosVendedores.length}"\t\t\t\t\t\t\t\t\t\t\t\t`;
      
      const content = `${titulo}\n${periodo}\n${fechaGen}\n${totalVendedores}\n\n${headers}\n${rows}\n${totalesRow}`;
      
      // Crear y descargar archivo
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `liquidaciones_${periodoInicio}_${periodoFin}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Éxito', description: `Exportados ${todosLosVendedores.length} vendedores correctamente` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Imprimir reporte (todos los datos del período)
  const handlePrint = async () => {
    if (liquidaciones.length === 0) {
      toast({ title: 'Error', description: 'No hay datos para imprimir', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      // Obtener TODOS los datos del período
      const todosLosVendedores = await obtenerTodosLosDatos();
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reporte de Liquidaciones</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 5px; }
            .periodo { text-align: center; color: #666; margin-bottom: 5px; }
            .total-vendedores { text-align: center; color: #333; margin-bottom: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: right; }
            th { background-color: #f5f5f5; font-weight: bold; }
            td:first-child, th:first-child { text-align: left; }
            .totales { background-color: #e8f4e8; font-weight: bold; }
            .currency { font-family: monospace; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>REPORTE DE LIQUIDACIONES</h1>
          <p class="periodo">Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}</p>
          <p class="total-vendedores">Total vendedores: ${todosLosVendedores.length}</p>
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Documento</th>
                <th>Pólizas</th>
                <th>Total Prima</th>
                <th>% Com</th>
                <th>Valor Comisión</th>
                <th>Ret. Fuente</th>
                <th>Ret. IVA</th>
                <th>Ret. ICA</th>
                <th>PAGO FINAL</th>
              </tr>
            </thead>
            <tbody>
              ${todosLosVendedores.map(v => `
                <tr>
                  <td>${v.nombres}</td>
                  <td>${v.tipo_documento} ${v.numero_documento}</td>
                  <td style="text-align:center">${v.cantidad_polizas}</td>
                  <td class="currency">${formatCurrency(v.total_prima)}</td>
                  <td style="text-align:center">${v.porcentaje_comision}%</td>
                  <td class="currency">${formatCurrency(v.valor_comision)}</td>
                  <td class="currency">${formatCurrency(v.retencion_fuente)}</td>
                  <td class="currency">${formatCurrency(v.retencion_iva)}</td>
                  <td class="currency">${formatCurrency(v.retencion_ica)}</td>
                  <td class="currency" style="font-weight:bold;color:green">${formatCurrency(v.pago_final)}</td>
                </tr>
              `).join('')}
              <tr class="totales">
                <td>TOTALES</td>
                <td></td>
                <td style="text-align:center">${totales.cantidad_polizas}</td>
                <td class="currency">${formatCurrency(totales.total_prima)}</td>
                <td></td>
                <td class="currency">${formatCurrency(totales.valor_comision)}</td>
                <td class="currency">${formatCurrency(totales.retencion_fuente)}</td>
                <td class="currency">${formatCurrency(totales.retencion_iva)}</td>
                <td class="currency">${formatCurrency(totales.retencion_ica)}</td>
                <td class="currency" style="color:green">${formatCurrency(totales.pago_final)}</td>
              </tr>
            </tbody>
          </table>
          <p style="text-align:right;margin-top:20px;font-size:10px;color:#999">
            Generado el ${new Date().toLocaleString('es-CO')}
          </p>
        </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al preparar impresión', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Cargar reporte detallado de un vendedor específico
  const cargarReporteVendedor = async (vendedor: VendedorLiquidacion) => {
    setVendedorSeleccionado(vendedor);
    setShowVendedorModal(true);
    setLoadingVendedor(true);
    setPolizasVendedor([]);

    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const url = `${baseUrl}/saas/liquidaciones-vendedores/reporte-vendedor?vendedor_id=${vendedor.id}&fecha_inicio=${periodoInicio}&fecha_fin=${periodoFin}`;
      const res = await fetch(url, { headers });
      const result = await res.json();

      if (result.success) {
        setPolizasVendedor(result.polizas || []);
        setTotalesVendedor(result.totales || {
          cantidad_polizas: 0,
          prima_total: 0,
          comision_bruta_total: 0,
          retencion_total: 0,
          reteiva_total: 0,
          retencion_ica_total: 0,
          comision_neta_total: 0,
        });
      } else {
        toast({ title: 'Error', description: result.message || 'Error al cargar reporte', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al cargar reporte del vendedor', variant: 'destructive' });
    } finally {
      setLoadingVendedor(false);
    }
  };

  // Exportar reporte del vendedor a Excel
  const exportarReporteVendedor = () => {
    if (!vendedorSeleccionado || polizasVendedor.length === 0) return;

    try {
      const headers = [
        'Nº Póliza',
        'Cliente',
        'Aseguradora',
        'Ramo',
        'Fecha Póliza',
        'Prima Neta',
        'Comisión Bruta',
        'Ret. Fuente',
        'Ret. IVA',
        'Ret. ICA',
        'Comisión Neta'
      ].map(h => `"${h}"`).join('\t');

      const rows = polizasVendedor.map(p => [
        `"${p.numero_poliza}"`,
        `"${p.cliente}"`,
        `"${p.aseguradora}"`,
        `"${p.ramo}"`,
        `"${p.fecha_poliza ? new Date(p.fecha_poliza).toLocaleDateString('es-CO') : ''}"`,
        p.prima_neta,
        p.comision_bruta,
        p.retencion_fuente,
        p.retencion_iva,
        p.retencion_ica,
        p.comision_neta
      ].join('\t')).join('\n');

      const totalesRow = [
        '"TOTALES"',
        '""',
        '""',
        '""',
        `"${totalesVendedor.cantidad_polizas} pólizas"`,
        totalesVendedor.prima_total,
        totalesVendedor.comision_bruta_total,
        totalesVendedor.retencion_total,
        totalesVendedor.reteiva_total,
        totalesVendedor.retencion_ica_total,
        totalesVendedor.comision_neta_total
      ].join('\t');

      const titulo = `"REPORTE DE LIQUIDACIONES - ${vendedorSeleccionado.nombres}"\t\t\t\t\t\t\t\t\t\t\t`;
      const documento = `"${vendedorSeleccionado.tipo_documento}: ${vendedorSeleccionado.numero_documento}"\t\t\t\t\t\t\t\t\t\t\t`;
      const periodo = `"Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}"\t\t\t\t\t\t\t\t\t\t\t`;
      const fechaGen = `"Generado: ${new Date().toLocaleDateString('es-CO')}"\t\t\t\t\t\t\t\t\t\t\t`;

      const content = `${titulo}\n${documento}\n${periodo}\n${fechaGen}\n\n${headers}\n${rows}\n${totalesRow}`;

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `liquidaciones_${vendedorSeleccionado.nombres.replace(/\s+/g, '_')}_${periodoInicio}_${periodoFin}.xls`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Éxito', description: `Exportadas ${polizasVendedor.length} pólizas` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    }
  };

  // Imprimir reporte del vendedor
  const imprimirReporteVendedor = () => {
    if (!vendedorSeleccionado || polizasVendedor.length === 0) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte ${vendedorSeleccionado.nombres}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 5px; font-size: 18px; }
          .vendedor-info { text-align: center; margin-bottom: 5px; }
          .periodo { text-align: center; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { border: 1px solid #ddd; padding: 3px; text-align: right; }
          th { background-color: #f5f5f5; font-weight: bold; }
          td:nth-child(1), td:nth-child(2), td:nth-child(3), td:nth-child(4), th:nth-child(1), th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: left; }
          .totales { background-color: #e8f4e8; font-weight: bold; }
          .currency { font-family: monospace; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>REPORTE DE LIQUIDACIONES</h1>
        <p class="vendedor-info"><strong>${vendedorSeleccionado.nombres}</strong> - ${vendedorSeleccionado.tipo_documento}: ${vendedorSeleccionado.numero_documento}</p>
        <p class="periodo">Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}</p>
        <table>
          <thead>
            <tr>
              <th>Nº Póliza</th>
              <th>Cliente</th>
              <th>Aseguradora</th>
              <th>Ramo</th>
              <th>Prima Neta</th>
              <th>Com. Bruta</th>
              <th>Ret. Fte</th>
              <th>Ret. IVA</th>
              <th>Ret. ICA</th>
              <th>Neto</th>
            </tr>
          </thead>
          <tbody>
            ${polizasVendedor.map(p => `
              <tr>
                <td>${p.numero_poliza}</td>
                <td>${p.cliente}</td>
                <td>${p.aseguradora}</td>
                <td>${p.ramo}</td>
                <td class="currency">${formatCurrency(p.prima_neta)}</td>
                <td class="currency">${formatCurrency(p.comision_bruta)}</td>
                <td class="currency">${formatCurrency(p.retencion_fuente)}</td>
                <td class="currency">${formatCurrency(p.retencion_iva)}</td>
                <td class="currency">${formatCurrency(p.retencion_ica)}</td>
                <td class="currency" style="font-weight:bold;color:green">${formatCurrency(p.comision_neta)}</td>
              </tr>
            `).join('')}
            <tr class="totales">
              <td colspan="4">TOTALES (${totalesVendedor.cantidad_polizas} pólizas)</td>
              <td class="currency">${formatCurrency(totalesVendedor.prima_total)}</td>
              <td class="currency">${formatCurrency(totalesVendedor.comision_bruta_total)}</td>
              <td class="currency">${formatCurrency(totalesVendedor.retencion_total)}</td>
              <td class="currency">${formatCurrency(totalesVendedor.reteiva_total)}</td>
              <td class="currency">${formatCurrency(totalesVendedor.retencion_ica_total)}</td>
              <td class="currency" style="color:green">${formatCurrency(totalesVendedor.comision_neta_total)}</td>
            </tr>
          </tbody>
        </table>
        <p style="text-align:right;margin-top:15px;font-size:9px;color:#999">
          Generado el ${new Date().toLocaleString('es-CO')}
        </p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con logo */}
      <Card className="bg-gradient-to-r from-primary/10 to-blue-50 dark:from-primary/20 dark:to-gray-800 border-none">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
          ) : (
            <div className="h-16 w-16 bg-primary/20 rounded-xl flex items-center justify-center">
              <Icon icon="solar:chart-2-bold-duotone" className="w-10 h-10 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{nombreAgencia}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Reporte de Liquidaciones de Comisiones</p>
          </div>
        </div>
      </Card>

      {/* Configuración del período */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Seleccionar Período</h3>
            <p className="text-sm text-gray-500">Genera un reporte consolidado de comisiones y retenciones</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="periodoInicio" value="Fecha Inicio *" />
            <TextInput
              id="periodoInicio"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="periodoFin" value="Fecha Fin *" />
            <TextInput
              id="periodoFin"
              type="date"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerarReporte} disabled={loading} className="w-full">
              {loading ? (
                <><Spinner size="sm" className="mr-2" /> Generando...</>
              ) : (
                <><Icon icon="solar:play-bold" className="w-4 h-4 mr-2" /> Generar Reporte</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Resultados */}
      {liquidaciones.length > 0 && (
        <>
          {/* Resumen */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Icon icon="solar:chart-bold" className="w-5 h-5 text-primary" />
                <h4 className="font-semibold">Resumen del Período</h4>
                <Badge color="info">{formatDate(periodoInicio)} - {formatDate(periodoFin)}</Badge>
              </div>
              <div className="flex gap-2">
                <Button color="success" size="sm" onClick={handleExportExcel} disabled={exporting}>
                  <Icon icon="solar:file-download-bold" className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button color="light" size="sm" onClick={handlePrint}>
                  <Icon icon="solar:printer-bold" className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Vendedores</p>
                <p className="text-xl font-bold text-primary">{liquidaciones.length}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Pólizas</p>
                <p className="text-xl font-bold">{totales.cantidad_polizas}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Prima</p>
                <p className="text-lg font-bold">{formatCurrency(totales.total_prima)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Comisiones</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(totales.valor_comision)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Ret. Fuente</p>
                <p className="text-lg font-bold text-red-600">-{formatCurrency(totales.retencion_fuente)}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Ret. IVA + ICA</p>
                <p className="text-lg font-bold text-orange-600">-{formatCurrency(totales.retencion_iva + totales.retencion_ica)}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Pago Final</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totales.pago_final)}</p>
              </div>
            </div>
          </Card>

          {/* Tabla detallada */}
          <Card>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:list-bold" className="w-5 h-5" />
              Detalle por Vendedor
            </h4>
            
            <div className="overflow-x-auto">
              <Table striped>
                <Table.Head>
                  <Table.HeadCell>Vendedor</Table.HeadCell>
                  <Table.HeadCell>Documento</Table.HeadCell>
                  <Table.HeadCell className="text-center">Pólizas</Table.HeadCell>
                  <Table.HeadCell className="text-right">Total Prima</Table.HeadCell>
                  <Table.HeadCell className="text-center">% Com</Table.HeadCell>
                  <Table.HeadCell className="text-right">Valor Comisión</Table.HeadCell>
                  <Table.HeadCell className="text-right">Ret. Fuente</Table.HeadCell>
                  <Table.HeadCell className="text-right">Ret. IVA</Table.HeadCell>
                  <Table.HeadCell className="text-right">Ret. ICA</Table.HeadCell>
                  <Table.HeadCell className="text-right font-bold">Pago Final</Table.HeadCell>
                  <Table.HeadCell className="text-center">Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {liquidaciones.map((v) => (
                    <Table.Row key={v.id}>
                      <Table.Cell className="font-medium">{v.nombres}</Table.Cell>
                      <Table.Cell className="text-sm text-gray-500">{v.tipo_documento} {v.numero_documento}</Table.Cell>
                      <Table.Cell className="text-center">{v.cantidad_polizas}</Table.Cell>
                      <Table.Cell className="text-right font-mono">{formatCurrency(v.total_prima)}</Table.Cell>
                      <Table.Cell className="text-center">{v.porcentaje_comision}%</Table.Cell>
                      <Table.Cell className="text-right font-mono text-blue-600">{formatCurrency(v.valor_comision)}</Table.Cell>
                      <Table.Cell className="text-right font-mono text-red-500">-{formatCurrency(v.retencion_fuente)}</Table.Cell>
                      <Table.Cell className="text-right font-mono text-orange-500">-{formatCurrency(v.retencion_iva)}</Table.Cell>
                      <Table.Cell className="text-right font-mono text-orange-500">-{formatCurrency(v.retencion_ica)}</Table.Cell>
                      <Table.Cell className="text-right font-mono font-bold text-green-600">{formatCurrency(v.pago_final)}</Table.Cell>
                      <Table.Cell className="text-center">
                        <Button size="xs" color="light" onClick={() => cargarReporteVendedor(v)} title="Ver detalle por póliza">
                          <Icon icon="solar:eye-bold" className="w-4 h-4" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {/* Fila de totales */}
                  <Table.Row className="bg-gray-100 dark:bg-gray-700 font-bold">
                    <Table.Cell>TOTALES</Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell className="text-center">{totales.cantidad_polizas}</Table.Cell>
                    <Table.Cell className="text-right font-mono">{formatCurrency(totales.total_prima)}</Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell className="text-right font-mono text-blue-600">{formatCurrency(totales.valor_comision)}</Table.Cell>
                    <Table.Cell className="text-right font-mono text-red-500">-{formatCurrency(totales.retencion_fuente)}</Table.Cell>
                    <Table.Cell className="text-right font-mono text-orange-500">-{formatCurrency(totales.retencion_iva)}</Table.Cell>
                    <Table.Cell className="text-right font-mono text-orange-500">-{formatCurrency(totales.retencion_ica)}</Table.Cell>
                    <Table.Cell className="text-right font-mono text-green-600">{formatCurrency(totales.pago_final)}</Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </div>

            {/* Paginación */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total} vendedores
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pagination.current_page === 1 || loading}
                    onClick={() => handlePageChange(1)}
                  >
                    <Icon icon="solar:double-alt-arrow-left-bold" className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pagination.current_page === 1 || loading}
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                  >
                    <Icon icon="solar:alt-arrow-left-bold" className="w-4 h-4" />
                  </Button>
                  <span className="px-3 py-1 text-sm font-medium">
                    Página {pagination.current_page} de {pagination.total_pages}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pagination.current_page === pagination.total_pages || loading}
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                  >
                    <Icon icon="solar:alt-arrow-right-bold" className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pagination.current_page === pagination.total_pages || loading}
                    onClick={() => handlePageChange(pagination.total_pages)}
                  >
                    <Icon icon="solar:double-alt-arrow-right-bold" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Estado vacío */}
      {!loading && liquidaciones.length === 0 && periodoInicio && periodoFin && (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <Icon icon="solar:document-text-bold-duotone" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No se encontraron liquidaciones en el período seleccionado</p>
            <p className="text-sm">Intente con otro rango de fechas</p>
          </div>
        </Card>
      )}

      {/* Modal de reporte por vendedor */}
      <Modal show={showVendedorModal} onClose={() => setShowVendedorModal(false)} size="7xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:user-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <span className="font-bold">{vendedorSeleccionado?.nombres}</span>
              <span className="text-sm text-gray-500 ml-2">
                {vendedorSeleccionado?.tipo_documento}: {vendedorSeleccionado?.numero_documento}
              </span>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {loadingVendedor ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Pólizas</p>
                  <p className="text-lg font-bold">{totalesVendedor.cantidad_polizas}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Prima Total</p>
                  <p className="text-sm font-bold">{formatCurrency(totalesVendedor.prima_total)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Comisión Bruta</p>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(totalesVendedor.comision_bruta_total)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Ret. Fuente</p>
                  <p className="text-sm font-bold text-red-600">-{formatCurrency(totalesVendedor.retencion_total)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Ret. IVA</p>
                  <p className="text-sm font-bold text-orange-600">-{formatCurrency(totalesVendedor.reteiva_total)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Ret. ICA</p>
                  <p className="text-sm font-bold text-orange-600">-{formatCurrency(totalesVendedor.retencion_ica_total)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Neto</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(totalesVendedor.comision_neta_total)}</p>
                </div>
              </div>

              {/* Tabla de pólizas */}
              <div className="overflow-x-auto max-h-96">
                <Table striped>
                  <Table.Head>
                    <Table.HeadCell>Nº Póliza</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Aseguradora</Table.HeadCell>
                    <Table.HeadCell>Ramo</Table.HeadCell>
                    <Table.HeadCell className="text-right">Prima</Table.HeadCell>
                    <Table.HeadCell className="text-right">Com. Bruta</Table.HeadCell>
                    <Table.HeadCell className="text-right">Ret. Fte</Table.HeadCell>
                    <Table.HeadCell className="text-right">Ret. IVA</Table.HeadCell>
                    <Table.HeadCell className="text-right">Ret. ICA</Table.HeadCell>
                    <Table.HeadCell className="text-right font-bold">Neto</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {polizasVendedor.map((p, idx) => (
                      <Table.Row key={idx}>
                        <Table.Cell className="font-medium text-xs">{p.numero_poliza}</Table.Cell>
                        <Table.Cell className="text-xs">{p.cliente}</Table.Cell>
                        <Table.Cell className="text-xs">
                          <Badge color="info" size="xs">{p.aseguradora}</Badge>
                        </Table.Cell>
                        <Table.Cell className="text-xs">
                          <Badge color="purple" size="xs">{p.ramo}</Badge>
                        </Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs">{formatCurrency(p.prima_neta)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs text-blue-600">{formatCurrency(p.comision_bruta)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs text-red-500">-{formatCurrency(p.retencion_fuente)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs text-orange-500">-{formatCurrency(p.retencion_iva)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs text-orange-500">-{formatCurrency(p.retencion_ica)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-xs font-bold text-green-600">{formatCurrency(p.comision_neta)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {polizasVendedor.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p>No se encontraron pólizas para este vendedor en el período</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              <Button color="success" size="sm" onClick={exportarReporteVendedor} disabled={polizasVendedor.length === 0}>
                <Icon icon="solar:file-download-bold" className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
              <Button color="light" size="sm" onClick={imprimirReporteVendedor} disabled={polizasVendedor.length === 0}>
                <Icon icon="solar:printer-bold" className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
            <Button color="gray" onClick={() => setShowVendedorModal(false)}>
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ReporteLiquidaciones;

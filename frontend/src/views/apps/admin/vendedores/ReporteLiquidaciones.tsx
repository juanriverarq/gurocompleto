import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, Label, Spinner, Table, TextInput, Badge, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { saasApi } from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import * as XLSX from 'xlsx';

interface VendedorLiquidacion {
  id: number;
  nombres: string;
  tipo_documento: string;
  numero_documento: string;
  porcentaje_comision: number;
  porcentaje_retencion: number;
  porcentaje_retencion_iva: number;
  porcentaje_retencion_ica: number;
  porcentaje_iva: number;
  // Valores calculados
  total_prima: number;
  valor_comision: number;
  iva_comision: number;
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

interface AgenciaInfo {
  name: string;
  legal_name: string;
  document_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  logo_url: string | null;
}

const ReporteLiquidaciones: React.FC = () => {
  const { toast } = useToast();
  const { tenant } = useUnifiedAuth();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [agenciaInfo, setAgenciaInfo] = useState<AgenciaInfo | null>(null);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [liquidaciones, setLiquidaciones] = useState<VendedorLiquidacion[]>([]);
  const [totales, setTotales] = useState({
    total_prima: 0,
    valor_comision: 0,
    iva_comision: 0,
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

  // Cargar información de la agencia al montar el componente
  useEffect(() => {
    const cargarInfoAgencia = async () => {
      try {
        const headers = await saasApi.getAuthHeaders();
        const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
        const res = await fetch(`${baseUrl}/saas/informacion-agencia`, { headers });
        const data = await res.json();
        if (data.success && data.data) {
          setAgenciaInfo({
            name: data.data.name || data.data.nombre || '',
            legal_name: data.data.legal_name || data.data.razon_social || '',
            document_number: data.data.document_number || data.data.numero_documento || '',
            email: data.data.email || data.data.correo || '',
            phone: data.data.phone || data.data.telefono || '',
            address: data.data.address || data.data.direccion || '',
            city: data.data.city || data.data.ciudad || '',
            logo_url: data.data.logo_url || null,
          });
        }
      } catch (e) {
        console.error('Error cargando info agencia:', e);
      }
    };
    cargarInfoAgencia();
  }, []);

  // Obtener logo del tenant o de la info de agencia
  const logoUrl = agenciaInfo?.logo_url || (tenant as any)?.logo_url || (tenant as any)?.branding?.logo || null;
  const nombreAgencia = agenciaInfo?.name || (tenant as any)?.nombre || (tenant as any)?.branding?.nombre_comercial || 'Mi Agencia';

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
        const liquidacionesList: VendedorLiquidacion[] = result.data.map((v: any) => {
          const comisionBruta = v.comision_bruta_total || 0;
          const porcentajeIva = v.porcentajes?.iva || 0;
          const ivaComision = comisionBruta * (porcentajeIva / 100);
          return {
            id: v.vendedor_id || 0,
            nombres: v.vendedor || 'Sin nombre',
            tipo_documento: v.porcentajes?.tipo_documento || '',
            numero_documento: v.porcentajes?.numero_documento || '',
            porcentaje_comision: v.porcentajes?.comision || 0,
            porcentaje_retencion: v.porcentajes?.retencion || 0,
            porcentaje_retencion_iva: v.porcentajes?.retencion_iva || 0,
            porcentaje_retencion_ica: v.porcentajes?.retencion_ica || 0,
            porcentaje_iva: porcentajeIva,
            total_prima: v.prima_total || 0,
            valor_comision: comisionBruta,
            iva_comision: v.iva_comision_total || ivaComision,
            retencion_fuente: v.retencion_total || 0,
            retencion_iva: v.reteiva_total || 0,
            retencion_ica: v.retencion_ica_total || 0,
            pago_final: v.comision_neta_total || 0,
            cantidad_polizas: (v.total_polizas || 0) + (v.total_comisiones_manuales || 0),
          };
        });
        
        setLiquidaciones(liquidacionesList);
        
        // Usar totales del backend (calculados sobre todos los datos)
        if (result.totales) {
          // Calcular IVA total de comisiones
          const ivaComisionTotal = result.totales.iva_comision_total || 
            liquidacionesList.reduce((sum, v) => sum + v.iva_comision, 0);
          setTotales({
            total_prima: result.totales.prima_total || 0,
            valor_comision: result.totales.comision_bruta_total || 0,
            iva_comision: ivaComisionTotal,
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
      return result.data.map((v: any) => {
        const comisionBruta = v.comision_bruta_total || 0;
        const porcentajeIva = v.porcentajes?.iva || 0;
        const ivaComision = comisionBruta * (porcentajeIva / 100);
        return {
          id: v.vendedor_id || 0,
          nombres: v.vendedor || 'Sin nombre',
          tipo_documento: v.porcentajes?.tipo_documento || '',
          numero_documento: v.porcentajes?.numero_documento || '',
          porcentaje_comision: v.porcentajes?.comision || 0,
          porcentaje_retencion: v.porcentajes?.retencion || 0,
          porcentaje_retencion_iva: v.porcentajes?.retencion_iva || 0,
          porcentaje_retencion_ica: v.porcentajes?.retencion_ica || 0,
          porcentaje_iva: porcentajeIva,
          total_prima: v.prima_total || 0,
          valor_comision: comisionBruta,
          iva_comision: v.iva_comision_total || ivaComision,
          retencion_fuente: v.retencion_total || 0,
          retencion_iva: v.reteiva_total || 0,
          retencion_ica: v.retencion_ica_total || 0,
          pago_final: v.comision_neta_total || 0,
          cantidad_polizas: (v.total_polizas || 0) + (v.total_comisiones_manuales || 0),
        };
      });
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
      
      // Helper para redondear a 2 decimales (centavos COP)
      const round2 = (n: number) => Math.round(n * 100) / 100;
      
      // Crear datos para Excel
      const excelData = [
        ['REPORTE DE LIQUIDACIONES'],
        [`Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}`],
        [`Generado: ${new Date().toLocaleDateString('es-CO')}`],
        [`Total vendedores: ${todosLosVendedores.length}`],
        [], // Fila vacía
        ['Vendedor', 'Documento', 'Cant. Pólizas', 'Total Prima', '% Comisión', 'Valor Comisión', '% IVA', 'IVA Comisión', '% Ret. Fuente', 'Ret. Fuente', '% Ret. IVA', 'Ret. IVA', '% Ret. ICA', 'Ret. ICA', 'Pago Final'],
        ...todosLosVendedores.map(v => [
          v.nombres,
          `${v.tipo_documento} ${v.numero_documento}`,
          v.cantidad_polizas,
          round2(v.total_prima),
          round2(v.porcentaje_comision),
          round2(v.valor_comision),
          round2(v.porcentaje_iva),
          round2(v.iva_comision),
          round2(v.porcentaje_retencion),
          round2(v.retencion_fuente),
          round2(v.porcentaje_retencion_iva),
          round2(v.retencion_iva),
          round2(v.porcentaje_retencion_ica),
          round2(v.retencion_ica),
          round2(v.pago_final)
        ]),
        ['TOTALES', '', totales.cantidad_polizas, round2(totales.total_prima), '', round2(totales.valor_comision), '', round2(totales.iva_comision), '', round2(totales.retencion_fuente), '', round2(totales.retencion_iva), '', round2(totales.retencion_ica), round2(totales.pago_final)]
      ];
      
      // Crear workbook y worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Ajustar ancho de columnas
      ws['!cols'] = [
        { wch: 30 }, // Vendedor
        { wch: 20 }, // Documento
        { wch: 12 }, // Cant. Pólizas
        { wch: 15 }, // Total Prima
        { wch: 12 }, // % Comisión
        { wch: 15 }, // Valor Comisión
        { wch: 8 },  // % IVA
        { wch: 15 }, // IVA Comisión
        { wch: 12 }, // % Ret. Fuente
        { wch: 15 }, // Ret. Fuente
        { wch: 10 }, // % Ret. IVA
        { wch: 12 }, // Ret. IVA
        { wch: 10 }, // % Ret. ICA
        { wch: 12 }, // Ret. ICA
        { wch: 15 }, // Pago Final
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');
      
      // Descargar archivo Excel
      XLSX.writeFile(wb, `liquidaciones_${periodoInicio}_${periodoFin}.xlsx`);
      
      toast({ title: 'Éxito', description: `Exportados ${todosLosVendedores.length} vendedores correctamente` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Función para convertir imagen URL a base64
  const imageToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
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
      
      // Convertir logo a base64 para evitar problemas de CORS en la impresión
      let logoBase64: string | null = null;
      if (logoUrl) {
        logoBase64 = await imageToBase64(logoUrl);
      }
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reporte de Liquidaciones - ${nombreAgencia}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; margin: 0; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #635BFF; }
            .logo-container { flex: 0 0 auto; }
            .logo { max-height: 80px; max-width: 200px; object-fit: contain; }
            .header-info { flex: 1; text-align: right; }
            .agency-name { font-size: 24px; font-weight: bold; color: #1a1a2e; margin: 0; }
            .agency-details { font-size: 12px; color: #666; margin-top: 5px; }
            .report-title { text-align: center; margin: 20px 0; }
            .report-title h1 { font-size: 22px; color: #1a1a2e; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
            .report-title .periodo { font-size: 14px; color: #666; margin: 5px 0; }
            .report-title .total-vendedores { font-size: 13px; color: #333; font-weight: 600; }
            .summary-cards { display: flex; justify-content: space-between; margin: 20px 0; gap: 10px; flex-wrap: wrap; }
            .summary-card { flex: 1; min-width: 120px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #dee2e6; }
            .summary-card.highlight { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-color: #28a745; }
            .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
            .summary-card .value { font-size: 14px; font-weight: bold; color: #1a1a2e; }
            .summary-card.highlight .value { color: #155724; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 20px; }
            th { background: linear-gradient(135deg, #635BFF 0%, #4a47cc 100%); color: white; padding: 10px 6px; text-align: right; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
            th:first-child { text-align: left; border-radius: 6px 0 0 0; }
            th:last-child { border-radius: 0 6px 0 0; }
            td { border-bottom: 1px solid #e9ecef; padding: 8px 6px; text-align: right; }
            td:first-child { text-align: left; font-weight: 500; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            tr:hover { background-color: #e3f2fd; }
            .totales { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%) !important; font-weight: bold; }
            .totales td { border-top: 2px solid #28a745; padding: 12px 6px; }
            .currency { font-family: 'Consolas', monospace; }
            .text-green { color: #28a745; }
            .text-purple { color: #6f42c1; }
            .text-red { color: #dc3545; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #999; }
            .footer-left { text-align: left; }
            .footer-right { text-align: right; }
            @media print { 
              body { padding: 15px; } 
              .header { margin-bottom: 20px; }
              .summary-cards { margin: 15px 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" />` : (logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : `<div style="font-size:28px;font-weight:bold;color:#635BFF;">${nombreAgencia}</div>`)}
            </div>
          </div>

          <div class="report-title">
            <h1>Reporte de Liquidaciones</h1>
            <p class="periodo">Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}</p>
            <p class="total-vendedores">${todosLosVendedores.length} vendedor${todosLosVendedores.length !== 1 ? 'es' : ''}</p>
          </div>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="label">Total Prima</div>
              <div class="value">${formatCurrency(totales.total_prima)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Comisiones</div>
              <div class="value">${formatCurrency(totales.valor_comision)}</div>
            </div>
            <div class="summary-card">
              <div class="label">IVA Comisión</div>
              <div class="value">${formatCurrency(totales.iva_comision)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Retenciones</div>
              <div class="value">${formatCurrency(totales.retencion_fuente + totales.retencion_iva + totales.retencion_ica)}</div>
            </div>
            <div class="summary-card highlight">
              <div class="label">Pago Final</div>
              <div class="value">${formatCurrency(totales.pago_final)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Documento</th>
                <th>Pólizas</th>
                <th>Total Prima</th>
                <th>Valor Comisión</th>
                <th>IVA Comisión</th>
                <th>Ret. Fuente</th>
                <th>Ret. IVA</th>
                <th>Ret. ICA</th>
                <th>Pago Final</th>
              </tr>
            </thead>
            <tbody>
              ${todosLosVendedores.map(v => `
                <tr>
                  <td>${v.nombres}</td>
                  <td>${v.tipo_documento} ${v.numero_documento}</td>
                  <td style="text-align:center">${v.cantidad_polizas}</td>
                  <td class="currency">${formatCurrency(v.total_prima)}</td>
                  <td class="currency">${formatCurrency(v.valor_comision)}</td>
                  <td class="currency text-purple">${formatCurrency(v.iva_comision)}</td>
                  <td class="currency text-red">${formatCurrency(v.retencion_fuente)}</td>
                  <td class="currency text-red">${formatCurrency(v.retencion_iva)}</td>
                  <td class="currency text-red">${formatCurrency(v.retencion_ica)}</td>
                  <td class="currency text-green" style="font-weight:bold">${formatCurrency(v.pago_final)}</td>
                </tr>
              `).join('')}
              <tr class="totales">
                <td>TOTALES</td>
                <td></td>
                <td style="text-align:center">${totales.cantidad_polizas}</td>
                <td class="currency">${formatCurrency(totales.total_prima)}</td>
                <td class="currency">${formatCurrency(totales.valor_comision)}</td>
                <td class="currency text-purple">${formatCurrency(totales.iva_comision)}</td>
                <td class="currency text-red">${formatCurrency(totales.retencion_fuente)}</td>
                <td class="currency text-red">${formatCurrency(totales.retencion_iva)}</td>
                <td class="currency text-red">${formatCurrency(totales.retencion_ica)}</td>
                <td class="currency text-green">${formatCurrency(totales.pago_final)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div class="footer-left">
              ${agenciaInfo?.document_number ? `NIT: ${agenciaInfo.document_number}` : ''}
            </div>
            <div class="footer-right">
              Generado el ${new Date().toLocaleString('es-CO')}
            </div>
          </div>
        </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        // Pequeño delay para asegurar que el contenido se renderice
        setTimeout(() => printWindow.print(), 300);
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

  // Exportar reporte del vendedor a Excel (XLSX real)
  const exportarReporteVendedor = () => {
    if (!vendedorSeleccionado || polizasVendedor.length === 0) return;

    try {
      // Helper para redondear a 2 decimales (centavos COP)
      const round2 = (n: number) => Math.round(n * 100) / 100;
      
      // Crear datos para Excel
      const excelData = [
        [`REPORTE DE LIQUIDACIONES - ${vendedorSeleccionado.nombres}`],
        [`${vendedorSeleccionado.tipo_documento}: ${vendedorSeleccionado.numero_documento}`],
        [`Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}`],
        [`Generado: ${new Date().toLocaleDateString('es-CO')}`],
        [], // Fila vacía
        ['Nº Póliza', 'Cliente', 'Aseguradora', 'Ramo', 'Fecha Póliza', 'Prima Neta', 'Comisión Bruta', 'Ret. Fuente', 'Ret. IVA', 'Ret. ICA', 'Comisión Neta'],
        ...polizasVendedor.map(p => [
          p.numero_poliza,
          p.cliente,
          p.aseguradora,
          p.ramo,
          p.fecha_poliza ? new Date(p.fecha_poliza).toLocaleDateString('es-CO') : '',
          round2(p.prima_neta),
          round2(p.comision_bruta),
          round2(p.retencion_fuente),
          round2(p.retencion_iva),
          round2(p.retencion_ica),
          round2(p.comision_neta)
        ]),
        ['TOTALES', '', '', '', `${totalesVendedor.cantidad_polizas} pólizas`, round2(totalesVendedor.prima_total), round2(totalesVendedor.comision_bruta_total), round2(totalesVendedor.retencion_total), round2(totalesVendedor.reteiva_total), round2(totalesVendedor.retencion_ica_total), round2(totalesVendedor.comision_neta_total)]
      ];
      
      // Crear workbook y worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Ajustar ancho de columnas
      ws['!cols'] = [
        { wch: 15 }, // Nº Póliza
        { wch: 25 }, // Cliente
        { wch: 20 }, // Aseguradora
        { wch: 15 }, // Ramo
        { wch: 12 }, // Fecha Póliza
        { wch: 15 }, // Prima Neta
        { wch: 15 }, // Comisión Bruta
        { wch: 12 }, // Ret. Fuente
        { wch: 12 }, // Ret. IVA
        { wch: 12 }, // Ret. ICA
        { wch: 15 }, // Comisión Neta
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Liquidación Vendedor');
      
      // Descargar archivo Excel
      XLSX.writeFile(wb, `liquidaciones_${vendedorSeleccionado.nombres.replace(/\s+/g, '_')}_${periodoInicio}_${periodoFin}.xlsx`);

      toast({ title: 'Éxito', description: `Exportadas ${polizasVendedor.length} pólizas` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    }
  };

  // Imprimir reporte del vendedor
  const imprimirReporteVendedor = async () => {
    if (!vendedorSeleccionado || polizasVendedor.length === 0) return;

    // Convertir logo a base64 para evitar problemas de CORS en la impresión
    let logoBase64: string | null = null;
    if (logoUrl) {
      logoBase64 = await imageToBase64(logoUrl);
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte ${vendedorSeleccionado.nombres} - ${nombreAgencia}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; margin: 0; color: #333; }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #635BFF; }
          .logo-container { flex: 0 0 auto; }
          .logo { max-height: 80px; max-width: 200px; object-fit: contain; }
          .report-title { text-align: center; margin: 20px 0; }
          .report-title h1 { font-size: 22px; color: #1a1a2e; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
          .report-title .vendedor-info { font-size: 16px; color: #333; margin: 5px 0; font-weight: 600; }
          .report-title .periodo { font-size: 14px; color: #666; margin: 5px 0; }
          .summary-cards { display: flex; justify-content: space-between; margin: 20px 0; gap: 10px; flex-wrap: wrap; }
          .summary-card { flex: 1; min-width: 100px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #dee2e6; }
          .summary-card.highlight { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-color: #28a745; }
          .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
          .summary-card .value { font-size: 14px; font-weight: bold; color: #1a1a2e; }
          .summary-card.highlight .value { color: #155724; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 20px; }
          th { background: linear-gradient(135deg, #635BFF 0%, #4a47cc 100%); color: white; padding: 8px 4px; text-align: right; font-weight: 600; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; }
          th:first-child { text-align: left; border-radius: 6px 0 0 0; }
          th:last-child { border-radius: 0 6px 0 0; }
          td { border-bottom: 1px solid #e9ecef; padding: 6px 4px; text-align: right; }
          td:nth-child(1), td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: left; }
          th:nth-child(1), th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: left; }
          tr:nth-child(even) { background-color: #f8f9fa; }
          tr:hover { background-color: #e3f2fd; }
          .totales { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%) !important; font-weight: bold; }
          .totales td { border-top: 2px solid #28a745; padding: 10px 4px; }
          .currency { font-family: 'Consolas', monospace; }
          .text-green { color: #28a745; }
          .text-red { color: #dc3545; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #999; }
          .footer-left { text-align: left; }
          .footer-right { text-align: right; }
          @media print { 
            body { padding: 15px; } 
            .header { margin-bottom: 20px; }
            .summary-cards { margin: 15px 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" />` : (logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : `<div style="font-size:28px;font-weight:bold;color:#635BFF;">${nombreAgencia}</div>`)}
          </div>
        </div>

        <div class="report-title">
          <h1>Reporte de Comisiones</h1>
          <p class="vendedor-info">${vendedorSeleccionado.nombres}</p>
          <p class="periodo">${vendedorSeleccionado.tipo_documento}: ${vendedorSeleccionado.numero_documento}</p>
          <p class="periodo">Período: ${formatDate(periodoInicio)} al ${formatDate(periodoFin)}</p>
        </div>

        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">Pólizas</div>
            <div class="value">${totalesVendedor.cantidad_polizas}</div>
          </div>
          <div class="summary-card">
            <div class="label">Prima Total</div>
            <div class="value">${formatCurrency(totalesVendedor.prima_total)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Comisión Bruta</div>
            <div class="value">${formatCurrency(totalesVendedor.comision_bruta_total)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Retenciones</div>
            <div class="value">${formatCurrency(totalesVendedor.retencion_total + totalesVendedor.reteiva_total + totalesVendedor.retencion_ica_total)}</div>
          </div>
          <div class="summary-card highlight">
            <div class="label">Comisión Neta</div>
            <div class="value">${formatCurrency(totalesVendedor.comision_neta_total)}</div>
          </div>
        </div>

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
                <td class="currency text-red">${formatCurrency(p.retencion_fuente)}</td>
                <td class="currency text-red">${formatCurrency(p.retencion_iva)}</td>
                <td class="currency text-red">${formatCurrency(p.retencion_ica)}</td>
                <td class="currency text-green" style="font-weight:bold">${formatCurrency(p.comision_neta)}</td>
              </tr>
            `).join('')}
            <tr class="totales">
              <td colspan="4">TOTALES (${totalesVendedor.cantidad_polizas} pólizas)</td>
              <td class="currency">${formatCurrency(totalesVendedor.prima_total)}</td>
              <td class="currency">${formatCurrency(totalesVendedor.comision_bruta_total)}</td>
              <td class="currency text-red">${formatCurrency(totalesVendedor.retencion_total)}</td>
              <td class="currency text-red">${formatCurrency(totalesVendedor.reteiva_total)}</td>
              <td class="currency text-red">${formatCurrency(totalesVendedor.retencion_ica_total)}</td>
              <td class="currency text-green">${formatCurrency(totalesVendedor.comision_neta_total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div class="footer-left">
            ${agenciaInfo?.document_number ? `NIT: ${agenciaInfo.document_number}` : ''}
          </div>
          <div class="footer-right">
            Generado el ${new Date().toLocaleString('es-CO')}
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      // Pequeño delay para asegurar que el contenido se renderice
      setTimeout(() => printWindow.print(), 300);
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
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">IVA Comisión</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(totales.iva_comision)}</p>
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
                  <Table.HeadCell className="text-right">IVA Comisión</Table.HeadCell>
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
                      <Table.Cell className="text-right font-mono text-purple-600">{formatCurrency(v.iva_comision)}</Table.Cell>
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
                    <Table.Cell className="text-right font-mono text-purple-600">{formatCurrency(totales.iva_comision)}</Table.Cell>
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

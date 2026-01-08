import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Label, Select, Spinner, Table, Badge, TextInput, Tabs } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { saasApi } from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

type ReportType = 'polizas' | 'clientes' | 'vendedores';

interface FieldConfig {
  key: string;
  label: string;
  selected: boolean;
  category?: string;
}

// Campos disponibles para cada tipo de reporte (usando nombres del backend transformado)
const CAMPOS_POLIZAS: FieldConfig[] = [
  // Información básica
  { key: 'numero_poliza', label: 'Número de Póliza', selected: true, category: 'Básico' },
  { key: 'ramo_principal', label: 'Ramo', selected: true, category: 'Básico' },
  { key: 'subramo', label: 'Producto/Subramo', selected: false, category: 'Básico' },
  { key: 'estado', label: 'Estado', selected: true, category: 'Básico' },
  { key: 'riesgo', label: 'Riesgo/Descripción', selected: false, category: 'Básico' },
  // Aseguradora
  { key: 'aseguradora', label: 'Aseguradora', selected: true, category: 'Aseguradora' },
  { key: 'aseguradora_nombre', label: 'Nombre Aseguradora', selected: false, category: 'Aseguradora' },
  // Cliente
  { key: 'nombres_cliente', label: 'Nombre Cliente', selected: true, category: 'Cliente' },
  { key: 'dni_cliente', label: 'Documento Cliente', selected: false, category: 'Cliente' },
  { key: 'telefono_cliente', label: 'Teléfono Cliente', selected: false, category: 'Cliente' },
  { key: 'correo_cliente', label: 'Email Cliente', selected: false, category: 'Cliente' },
  // Fechas
  { key: 'fecha_emision', label: 'Fecha Emisión', selected: false, category: 'Fechas' },
  { key: 'fecha_inicio', label: 'Fecha Inicio', selected: true, category: 'Fechas' },
  { key: 'fecha_fin', label: 'Fecha Fin', selected: true, category: 'Fechas' },
  { key: 'fecha_renovacion', label: 'Fecha Renovación', selected: false, category: 'Fechas' },
  // Valores
  { key: 'prima_neta', label: 'Prima Neta', selected: true, category: 'Valores' },
  { key: 'valor_riesgo_asegurado', label: 'Valor Asegurado', selected: false, category: 'Valores' },
  { key: 'porcentaje_comision', label: '% Comisión', selected: true, category: 'Valores' },
  { key: 'comision', label: 'Valor Comisión', selected: false, category: 'Valores' },
  { key: 'total', label: 'Total', selected: false, category: 'Valores' },
  { key: 'iva', label: 'IVA', selected: false, category: 'Valores' },
  // Vendedor
  { key: 'vendedor', label: 'Vendedor', selected: true, category: 'Vendedor' },
  { key: 'vendedor_2', label: 'Vendedor 2', selected: false, category: 'Vendedor' },
  // Otros
  { key: 'periodicidad_pago', label: 'Periodicidad Pago', selected: false, category: 'Otros' },
  { key: 'forma_pago', label: 'Forma de Pago', selected: false, category: 'Otros' },
  { key: 'medio_pago', label: 'Medio de Pago', selected: false, category: 'Otros' },
  { key: 'notas', label: 'Notas', selected: false, category: 'Otros' },
];

const CAMPOS_CLIENTES: FieldConfig[] = [
  // Información básica
  { key: 'first_name', label: 'Nombres', selected: true, category: 'Básico' },
  { key: 'last_name', label: 'Apellidos', selected: true, category: 'Básico' },
  { key: 'client_type', label: 'Tipo Cliente', selected: false, category: 'Básico' },
  { key: 'document_type', label: 'Tipo Documento', selected: true, category: 'Básico' },
  { key: 'document_number', label: 'Número Documento', selected: true, category: 'Básico' },
  { key: 'document_issue_date', label: 'Fecha Expedición Doc.', selected: false, category: 'Básico' },
  // Contacto
  { key: 'email', label: 'Email', selected: true, category: 'Contacto' },
  { key: 'phone', label: 'Teléfono', selected: true, category: 'Contacto' },
  { key: 'mobile_phone', label: 'Celular', selected: false, category: 'Contacto' },
  { key: 'emergency_contact_name', label: 'Contacto Emergencia', selected: false, category: 'Contacto' },
  { key: 'emergency_contact_phone', label: 'Tel. Emergencia', selected: false, category: 'Contacto' },
  // Dirección
  { key: 'address', label: 'Dirección', selected: false, category: 'Dirección' },
  { key: 'city', label: 'Ciudad', selected: false, category: 'Dirección' },
  { key: 'department', label: 'Departamento', selected: false, category: 'Dirección' },
  { key: 'country', label: 'País', selected: false, category: 'Dirección' },
  { key: 'postal_code', label: 'Código Postal', selected: false, category: 'Dirección' },
  // Personal
  { key: 'birth_date', label: 'Fecha Nacimiento', selected: false, category: 'Personal' },
  { key: 'gender', label: 'Género', selected: false, category: 'Personal' },
  { key: 'marital_status', label: 'Estado Civil', selected: false, category: 'Personal' },
  { key: 'occupation', label: 'Ocupación', selected: false, category: 'Personal' },
  // Empresa
  { key: 'company', label: 'Empresa', selected: false, category: 'Empresa' },
  { key: 'company_legal_name', label: 'Razón Social', selected: false, category: 'Empresa' },
  { key: 'legal_representative_name', label: 'Rep. Legal', selected: false, category: 'Empresa' },
  { key: 'work_address', label: 'Dir. Trabajo', selected: false, category: 'Empresa' },
  // Otros
  { key: 'status', label: 'Estado', selected: false, category: 'Otros' },
  { key: 'source', label: 'Fuente', selected: false, category: 'Otros' },
  { key: 'notes', label: 'Notas', selected: false, category: 'Otros' },
  { key: 'created_at', label: 'Fecha Creación', selected: false, category: 'Otros' },
  // Estadísticas
  { key: 'total_policies_count', label: 'Cantidad Pólizas', selected: true, category: 'Estadísticas' },
  { key: 'total_policies_value', label: 'Valor Total Pólizas', selected: false, category: 'Estadísticas' },
];

const CAMPOS_VENDEDORES: FieldConfig[] = [
  // Información básica
  { key: 'id', label: 'ID', selected: false, category: 'Básico' },
  { key: 'nombres', label: 'Nombres', selected: true, category: 'Básico' },
  { key: 'tipo_documento', label: 'Tipo Documento', selected: true, category: 'Básico' },
  { key: 'numero_documento', label: 'Número Documento', selected: true, category: 'Básico' },
  // Contacto
  { key: 'email', label: 'Email', selected: true, category: 'Contacto' },
  { key: 'telefono', label: 'Teléfono', selected: false, category: 'Contacto' },
  { key: 'celular', label: 'Celular', selected: true, category: 'Contacto' },
  // Configuración
  { key: 'tipo_persona', label: 'Tipo Persona', selected: true, category: 'Configuración' },
  { key: 'tipo_retencion', label: 'Tipo Retención', selected: false, category: 'Configuración' },
  { key: 'es_agencia', label: 'Es Agencia', selected: false, category: 'Configuración' },
  { key: 'comisiones_diferentes_por_ano', label: 'Comisiones Dif. por Año', selected: false, category: 'Configuración' },
  // Comisiones
  { key: 'porcentaje_comision', label: '% Comisión', selected: true, category: 'Comisiones' },
  { key: 'calcular_comision_sobre', label: 'Calcular Sobre', selected: false, category: 'Comisiones' },
  // Retenciones
  { key: 'porcentaje_retencion', label: '% Retención Fuente', selected: true, category: 'Retenciones' },
  { key: 'porcentaje_retencion_iva', label: '% Retención IVA', selected: false, category: 'Retenciones' },
  { key: 'porcentaje_retencion_ica', label: '% Retención ICA', selected: false, category: 'Retenciones' },
  { key: 'porcentaje_iva', label: '% IVA', selected: false, category: 'Retenciones' },
  // Bancario
  { key: 'cuenta_bancaria', label: 'Cuenta Bancaria', selected: false, category: 'Bancario' },
  // Fechas
  { key: 'fecha_vinculacion', label: 'Fecha Vinculación', selected: false, category: 'Fechas' },
  { key: 'created_at', label: 'Fecha Creación', selected: false, category: 'Fechas' },
  { key: 'updated_at', label: 'Fecha Actualización', selected: false, category: 'Fechas' },
  // Estadísticas/Producción
  { key: 'polizas_count', label: 'Cantidad Pólizas', selected: true, category: 'Producción' },
  { key: 'polizas_sum_premium_amount', label: 'Producción Total (Primas)', selected: true, category: 'Producción' },
];

interface Props {
  vendedorId?: number; // Si se pasa, filtra por vendedor
}

const ReportesVendedores: React.FC<Props> = ({ vendedorId }) => {
  const { toast } = useToast();
  const { tenant } = useUnifiedAuth();
  const [reportType, setReportType] = useState<ReportType>('polizas');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>(vendedorId ? String(vendedorId) : '');
  
  // Campos seleccionados para cada tipo
  const [camposPolizas, setCamposPolizas] = useState<FieldConfig[]>(CAMPOS_POLIZAS);
  const [camposClientes, setCamposClientes] = useState<FieldConfig[]>(CAMPOS_CLIENTES);
  const [camposVendedores, setCamposVendedores] = useState<FieldConfig[]>(CAMPOS_VENDEDORES);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estadoPoliza, setEstadoPoliza] = useState('');

  // Obtener logo del tenant
  const logoUrl = (tenant as any)?.logo_url || (tenant as any)?.branding?.logo || null;
  const nombreAgencia = (tenant as any)?.nombre || (tenant as any)?.branding?.nombre_comercial || 'Mi Agencia';

  // Cargar vendedores
  useEffect(() => {
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
    loadVendedores();
  }, []);

  // Obtener campos actuales según tipo de reporte
  const currentFields = useMemo(() => {
    switch (reportType) {
      case 'polizas': return camposPolizas;
      case 'clientes': return camposClientes;
      case 'vendedores': return camposVendedores;
    }
  }, [reportType, camposPolizas, camposClientes, camposVendedores]);

  const setCurrentFields = (fields: FieldConfig[]) => {
    switch (reportType) {
      case 'polizas': setCamposPolizas(fields); break;
      case 'clientes': setCamposClientes(fields); break;
      case 'vendedores': setCamposVendedores(fields); break;
    }
  };

  // Agrupar campos por categoría
  const fieldsByCategory = useMemo(() => {
    const grouped: Record<string, FieldConfig[]> = {};
    currentFields.forEach(field => {
      const cat = field.category || 'Otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(field);
    });
    return grouped;
  }, [currentFields]);

  // Toggle campo
  const toggleField = (key: string) => {
    setCurrentFields(currentFields.map(f => 
      f.key === key ? { ...f, selected: !f.selected } : f
    ));
  };

  // Seleccionar/deseleccionar todos
  const selectAll = () => {
    setCurrentFields(currentFields.map(f => ({ ...f, selected: true })));
  };

  const deselectAll = () => {
    setCurrentFields(currentFields.map(f => ({ ...f, selected: false })));
  };

  // Estado para paginación de vista previa
  const [previewPage, setPreviewPage] = useState(1);
  const previewPerPage = 20;

  // Generar reporte
  const handleGenerateReport = async () => {
    setLoading(true);
    setData([]);
    setPreviewPage(1);
    
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      
      const params = new URLSearchParams();
      if (selectedVendedor) params.append('vendedor_id', selectedVendedor);
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      if (estadoPoliza) params.append('estado', estadoPoliza);
      params.append('per_page', '20000'); // Límite aumentado
      
      let endpoint = '';
      switch (reportType) {
        case 'polizas': endpoint = '/saas/polizas'; break;
        case 'clientes': endpoint = '/saas/clientes'; break;
        case 'vendedores': endpoint = '/saas/vendedores'; break;
      }
      
      const url = `${baseUrl}${endpoint}?${params.toString()}`;
      console.log('Fetching:', url);
      
      const res = await fetch(url, { headers });
      const result = await res.json();
      console.log('Response:', result);
      
      if (!res.ok) {
        toast({ title: 'Error', description: result.message || `Error HTTP ${res.status}`, variant: 'destructive' });
        return;
      }
      
      // Extraer items de la respuesta
      let items: any[] = [];
      if (Array.isArray(result.data)) {
        items = result.data;
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        items = result.data.data;
      } else if (Array.isArray(result)) {
        items = result;
      }
      
      console.log('Items extraídos:', items.length, items.slice(0, 2));
      setData(items);
      
      if (items.length > 0) {
        toast({ title: 'Éxito', description: `Se encontraron ${items.length} registros` });
      } else {
        toast({ title: 'Info', description: 'No se encontraron registros con los filtros seleccionados' });
      }
    } catch (e) {
      console.error('Error generando reporte:', e);
      toast({ title: 'Error', description: 'Error al generar el reporte. Verifique la conexión.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  // Datos paginados para vista previa
  const paginatedData = useMemo(() => {
    const start = (previewPage - 1) * previewPerPage;
    return data.slice(start, start + previewPerPage);
  }, [data, previewPage]);
  
  const totalPreviewPages = Math.ceil(data.length / previewPerPage);

  // Función auxiliar para formatear valor de exportación
  const formatExportValue = (value: any, key: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    
    // Formatear fechas
    if (key.includes('fecha') || key.includes('date') || key.includes('created_at') || key.includes('updated_at')) {
      if (value) {
        try {
          return new Date(value).toLocaleDateString('es-CO');
        } catch { return String(value); }
      }
    }
    
    // Formatear números/moneda
    if (key.includes('prima') || key.includes('comision') || key.includes('total') || key.includes('iva') || key.includes('valor')) {
      if (typeof value === 'number') return value.toLocaleString('es-CO');
    }
    
    // Formatear porcentajes
    if (key.includes('porcentaje')) {
      if (typeof value === 'number') return `${value}%`;
    }
    
    return String(value);
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    if (data.length === 0) {
      toast({ title: 'Error', description: 'No hay datos para exportar', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const selectedFields = currentFields.filter(f => f.selected);
      
      // Headers
      const headers = selectedFields.map(f => `"${f.label}"`).join('\t');
      
      // Rows con todos los campos seleccionados
      const rows = data.map(item => {
        return selectedFields.map(field => {
          let value = formatExportValue(item[field.key], field.key);
          // Escapar comillas
          value = String(value).replace(/"/g, '""');
          return `"${value}"`;
        }).join('\t');
      }).join('\n');

      const content = `${headers}\n${rows}`;
      
      // Crear y descargar archivo
      const BOM = '\uFEFF'; // UTF-8 BOM para Excel
      const blob = new Blob([BOM + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_${reportType}_${new Date().toISOString().slice(0, 10)}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Éxito', description: `Exportados ${data.length} registros con ${selectedFields.length} campos` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast({ title: 'Error', description: 'No hay datos para exportar', variant: 'destructive' });
      return;
    }

    try {
      const selectedFields = currentFields.filter(f => f.selected);
      
      // Headers
      const headers = selectedFields.map(f => `"${f.label}"`).join(',');
      
      // Rows con todos los campos seleccionados
      const rows = data.map(item => {
        return selectedFields.map(field => {
          let value = formatExportValue(item[field.key], field.key);
          // Escapar comillas y envolver en comillas
          value = String(value).replace(/"/g, '""');
          return `"${value}"`;
        }).join(',');
      }).join('\n');

      const BOM = '\uFEFF'; // UTF-8 BOM
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Éxito', description: `Exportados ${data.length} registros con ${selectedFields.length} campos` });
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al exportar CSV', variant: 'destructive' });
    }
  };

  const selectedFieldsCount = currentFields.filter(f => f.selected).length;

  return (
    <div className="space-y-6">
      {/* Header con logo */}
      <Card className="bg-gradient-to-r from-primary/10 to-blue-50 dark:from-primary/20 dark:to-gray-800 border-none">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
          ) : (
            <div className="h-16 w-16 bg-primary/20 rounded-xl flex items-center justify-center">
              <Icon icon="solar:document-text-bold-duotone" className="w-10 h-10 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{nombreAgencia}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Centro de Reportes</p>
          </div>
        </div>
      </Card>

      {/* Tipo de Reporte */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Generador de Reportes</h3>
            <p className="text-sm text-gray-500">Selecciona el tipo de reporte que deseas generar</p>
          </div>
        </div>
        
        <Tabs aria-label="Tipo de reporte" onActiveTabChange={(tab) => {
          const types: ReportType[] = ['polizas', 'clientes', 'vendedores'];
          setReportType(types[tab]);
          setData([]);
        }}>
          <Tabs.Item active={reportType === 'polizas'} title="Pólizas" icon={() => <Icon icon="solar:document-bold" className="w-4 h-4 mr-2" />}>
            <p className="text-sm text-gray-500">Genera reportes de pólizas con los campos que necesites.</p>
          </Tabs.Item>
          <Tabs.Item active={reportType === 'clientes'} title="Clientes" icon={() => <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 mr-2" />}>
            <p className="text-sm text-gray-500">Genera reportes de clientes con información de contacto y más.</p>
          </Tabs.Item>
          <Tabs.Item active={reportType === 'vendedores'} title="Vendedores" icon={() => <Icon icon="solar:user-id-bold" className="w-4 h-4 mr-2" />}>
            <p className="text-sm text-gray-500">Genera reportes de vendedores con comisiones y retenciones.</p>
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Filtros */}
      <Card>
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Icon icon="solar:filter-bold" className="w-5 h-5" />
          Filtros
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {reportType === 'polizas' && (
            <>
              <div>
                <Label htmlFor="vendedor" value="Vendedor" />
                <Select
                  id="vendedor"
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                >
                  <option value="">Todos los vendedores</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.nombres}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="estado" value="Estado" />
                <Select
                  id="estado"
                  value={estadoPoliza}
                  onChange={(e) => setEstadoPoliza(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="active">Activa</option>
                  <option value="pending">Pendiente</option>
                  <option value="expired">Vencida</option>
                  <option value="cancelled">Cancelada</option>
                </Select>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="fechaInicio" value="Fecha Inicio" />
            <TextInput
              id="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fechaFin" value="Fecha Fin" />
            <TextInput
              id="fechaFin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Campos a exportar */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Icon icon="solar:checklist-bold" className="w-5 h-5" />
            Campos a Exportar
            <Badge color="info">{selectedFieldsCount} seleccionados</Badge>
          </h4>
          <div className="flex gap-2">
            <Button color="light" size="xs" onClick={selectAll}>
              Seleccionar todos
            </Button>
            <Button color="light" size="xs" onClick={deselectAll}>
              Deseleccionar todos
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <div key={category} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 border-b pb-2">
                {category}
              </h5>
              <div className="space-y-1">
                {fields.map(field => (
                  <label key={field.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={field.selected}
                      onChange={() => toggleField(field.key)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Acciones */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button onClick={handleGenerateReport} disabled={loading || selectedFieldsCount === 0}>
            {loading ? (
              <><Spinner size="sm" className="mr-2" /> Generando...</>
            ) : (
              <><Icon icon="solar:play-bold" className="w-4 h-4 mr-2" /> Generar Reporte</>
            )}
          </Button>
          
          {data.length > 0 && (
            <div className="flex gap-2">
              <Button color="success" onClick={handleExportExcel} disabled={exporting}>
                <Icon icon="solar:file-download-bold" className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
              <Button color="light" onClick={handleExportCSV}>
                <Icon icon="solar:document-text-bold" className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Resumen de totales para pólizas */}
      {data.length > 0 && reportType === 'polizas' && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:chart-square-bold" className="w-5 h-5 text-primary" />
            Resumen del Reporte
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Total Pólizas</p>
              <p className="text-2xl font-bold text-primary">{data.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Prima Total</p>
              <p className="text-xl font-bold text-blue-600">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
                  .format(data.reduce((sum, p) => sum + (parseFloat(p.prima_neta) || 0), 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Comisión Total</p>
              <p className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
                  .format(data.reduce((sum, p) => sum + (parseFloat(p.comision) || 0), 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Vendedores</p>
              <p className="text-2xl font-bold text-purple-600">
                {new Set(data.map(p => p.vendedor).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Vista previa de datos */}
      {data.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Icon icon="solar:eye-bold" className="w-5 h-5" />
              Vista Previa
              <Badge color="success">{data.length} registros</Badge>
            </h4>
          </div>
          
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                {currentFields.filter(f => f.selected).slice(0, 8).map(field => (
                  <Table.HeadCell key={field.key} className="whitespace-nowrap">
                    {field.label}
                  </Table.HeadCell>
                ))}
                {currentFields.filter(f => f.selected).length > 8 && (
                  <Table.HeadCell>...</Table.HeadCell>
                )}
              </Table.Head>
              <Table.Body>
                {paginatedData.map((item, idx) => (
                  <Table.Row key={idx}>
                    {currentFields.filter(f => f.selected).slice(0, 8).map(field => (
                      <Table.Cell key={field.key} className="whitespace-nowrap">
                        {formatValue(item[field.key], field.key)}
                      </Table.Cell>
                    ))}
                    {currentFields.filter(f => f.selected).length > 8 && (
                      <Table.Cell>...</Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          
          {/* Paginación de vista previa */}
          {totalPreviewPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {((previewPage - 1) * previewPerPage) + 1} - {Math.min(previewPage * previewPerPage, data.length)} de {data.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  size="xs" 
                  color="gray" 
                  disabled={previewPage === 1}
                  onClick={() => setPreviewPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {previewPage} de {totalPreviewPages}
                </span>
                <Button 
                  size="xs" 
                  color="gray" 
                  disabled={previewPage === totalPreviewPages}
                  onClick={() => setPreviewPage(p => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

// Función auxiliar para formatear valores
const formatValue = (value: any, key: string): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key.includes('date') || key.includes('fecha') || key.includes('created_at')) {
    if (value) return new Date(value).toLocaleDateString('es-CO');
  }
  if (key.includes('amount') || key.includes('prima')) {
    if (typeof value === 'number') return value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
  }
  if (key.includes('porcentaje')) {
    if (typeof value === 'number') return `${value}%`;
  }
  return String(value);
};

export default ReportesVendedores;

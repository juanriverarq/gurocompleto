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

// Campos disponibles para cada tipo de reporte
const CAMPOS_POLIZAS: FieldConfig[] = [
  // Información básica
  { key: 'policy_number', label: 'Número de Póliza', selected: true, category: 'Básico' },
  { key: 'internal_number', label: 'Número Interno', selected: false, category: 'Básico' },
  { key: 'type', label: 'Tipo/Ramo', selected: true, category: 'Básico' },
  { key: 'product_name', label: 'Producto', selected: false, category: 'Básico' },
  { key: 'status', label: 'Estado', selected: true, category: 'Básico' },
  { key: 'payment_status', label: 'Estado de Pago', selected: false, category: 'Básico' },
  // Aseguradora
  { key: 'insurance_company', label: 'Aseguradora', selected: true, category: 'Aseguradora' },
  { key: 'aseguradora_nombre', label: 'Nombre Aseguradora', selected: false, category: 'Aseguradora' },
  // Cliente
  { key: 'client_name', label: 'Nombre Cliente', selected: true, category: 'Cliente' },
  { key: 'client_document', label: 'Documento Cliente', selected: false, category: 'Cliente' },
  // Fechas
  { key: 'issue_date', label: 'Fecha Emisión', selected: false, category: 'Fechas' },
  { key: 'start_date', label: 'Fecha Inicio', selected: true, category: 'Fechas' },
  { key: 'end_date', label: 'Fecha Fin', selected: true, category: 'Fechas' },
  { key: 'renewal_date', label: 'Fecha Renovación', selected: false, category: 'Fechas' },
  // Valores
  { key: 'premium_amount', label: 'Prima', selected: true, category: 'Valores' },
  { key: 'insured_amount', label: 'Valor Asegurado', selected: false, category: 'Valores' },
  { key: 'commission_percentage', label: '% Comisión', selected: true, category: 'Valores' },
  { key: 'commission_amount', label: 'Valor Comisión', selected: false, category: 'Valores' },
  { key: 'total_amount', label: 'Total', selected: false, category: 'Valores' },
  // Vendedor
  { key: 'seller_name', label: 'Vendedor', selected: true, category: 'Vendedor' },
  { key: 'seller_name_2', label: 'Vendedor 2', selected: false, category: 'Vendedor' },
  // Otros
  { key: 'payment_frequency', label: 'Frecuencia de Pago', selected: false, category: 'Otros' },
  { key: 'payment_method', label: 'Método de Pago', selected: false, category: 'Otros' },
  { key: 'notes', label: 'Notas', selected: false, category: 'Otros' },
  { key: 'created_at', label: 'Fecha Creación', selected: false, category: 'Otros' },
];

const CAMPOS_CLIENTES: FieldConfig[] = [
  // Información básica
  { key: 'first_name', label: 'Nombres', selected: true, category: 'Básico' },
  { key: 'last_name', label: 'Apellidos', selected: true, category: 'Básico' },
  { key: 'document_type', label: 'Tipo Documento', selected: true, category: 'Básico' },
  { key: 'document_number', label: 'Número Documento', selected: true, category: 'Básico' },
  // Contacto
  { key: 'email', label: 'Email', selected: true, category: 'Contacto' },
  { key: 'phone', label: 'Teléfono', selected: true, category: 'Contacto' },
  { key: 'mobile', label: 'Celular', selected: false, category: 'Contacto' },
  // Dirección
  { key: 'address', label: 'Dirección', selected: false, category: 'Dirección' },
  { key: 'city', label: 'Ciudad', selected: false, category: 'Dirección' },
  { key: 'state', label: 'Departamento', selected: false, category: 'Dirección' },
  { key: 'country', label: 'País', selected: false, category: 'Dirección' },
  // Otros
  { key: 'birth_date', label: 'Fecha Nacimiento', selected: false, category: 'Otros' },
  { key: 'gender', label: 'Género', selected: false, category: 'Otros' },
  { key: 'occupation', label: 'Ocupación', selected: false, category: 'Otros' },
  { key: 'company_name', label: 'Empresa', selected: false, category: 'Otros' },
  { key: 'notes', label: 'Notas', selected: false, category: 'Otros' },
  { key: 'created_at', label: 'Fecha Creación', selected: false, category: 'Otros' },
  // Estadísticas
  { key: 'polizas_count', label: 'Cantidad Pólizas', selected: true, category: 'Estadísticas' },
];

const CAMPOS_VENDEDORES: FieldConfig[] = [
  // Información básica
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
  // Comisiones
  { key: 'porcentaje_comision', label: '% Comisión', selected: true, category: 'Comisiones' },
  { key: 'calcular_comision_sobre', label: 'Calcular Sobre', selected: false, category: 'Comisiones' },
  // Retenciones
  { key: 'porcentaje_retencion', label: '% Retención Fuente', selected: true, category: 'Retenciones' },
  { key: 'porcentaje_retencion_iva', label: '% Retención IVA', selected: true, category: 'Retenciones' },
  { key: 'porcentaje_retencion_ica', label: '% Retención ICA', selected: false, category: 'Retenciones' },
  { key: 'porcentaje_iva', label: '% IVA', selected: false, category: 'Retenciones' },
  // Otros
  { key: 'cuenta_bancaria', label: 'Cuenta Bancaria', selected: false, category: 'Otros' },
  { key: 'fecha_vinculacion', label: 'Fecha Vinculación', selected: false, category: 'Otros' },
  { key: 'created_at', label: 'Fecha Creación', selected: false, category: 'Otros' },
  // Estadísticas
  { key: 'polizas_count', label: 'Cantidad Pólizas', selected: true, category: 'Estadísticas' },
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

  // Generar reporte
  const handleGenerateReport = async () => {
    setLoading(true);
    setData([]);
    
    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      
      let url = '';
      const params = new URLSearchParams();
      
      if (selectedVendedor) params.append('vendedor_id', selectedVendedor);
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      if (estadoPoliza) params.append('estado', estadoPoliza);
      params.append('per_page', '1000'); // Obtener todos los registros
      
      switch (reportType) {
        case 'polizas':
          url = `${baseUrl}/saas/polizas?${params.toString()}`;
          break;
        case 'clientes':
          url = `${baseUrl}/saas/clientes?${params.toString()}`;
          break;
        case 'vendedores':
          url = `${baseUrl}/saas/vendedores?${params.toString()}`;
          break;
      }
      
      console.log('Fetching:', url);
      const res = await fetch(url, { headers });
      const result = await res.json();
      console.log('Response:', result);
      
      if (result.success !== false && (result.data || Array.isArray(result))) {
        // Manejar diferentes estructuras de respuesta
        let items: any[] = [];
        if (Array.isArray(result.data)) {
          items = result.data;
        } else if (result.data?.data && Array.isArray(result.data.data)) {
          items = result.data.data;
        } else if (Array.isArray(result)) {
          items = result;
        }
        
        setData(items);
        if (items.length > 0) {
          toast({ title: 'Éxito', description: `Se encontraron ${items.length} registros` });
        } else {
          toast({ title: 'Info', description: 'No se encontraron registros con los filtros seleccionados' });
        }
      } else {
        toast({ title: 'Error', description: result.message || 'Error al generar reporte', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Error generando reporte:', e);
      toast({ title: 'Error', description: 'Error al generar el reporte. Verifique la conexión.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
      
      // Crear contenido del archivo Excel (formato CSV con extensión xlsx para compatibilidad)
      const headers = selectedFields.map(f => `"${f.label}"`).join('\t');
      
      const rows = data.map(item => {
        return selectedFields.map(field => {
          let value = item[field.key];
          
          // Formatear valores especiales
          if (value === null || value === undefined) value = '';
          if (typeof value === 'boolean') value = value ? 'Sí' : 'No';
          if (field.key.includes('date') || field.key.includes('fecha') || field.key.includes('created_at')) {
            if (value) value = new Date(value).toLocaleDateString('es-CO');
          }
          if (field.key.includes('amount') || field.key.includes('prima') || field.key.includes('comision')) {
            if (typeof value === 'number') value = value.toLocaleString('es-CO');
          }
          
          // Escapar comillas y envolver en comillas
          if (typeof value === 'string') {
            value = value.replace(/"/g, '""');
          }
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
      
      toast({ title: 'Éxito', description: 'Archivo exportado correctamente' });
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
      const headers = selectedFields.map(f => f.label).join(',');
      
      // Rows
      const rows = data.map(item => {
        return selectedFields.map(field => {
          let value = item[field.key];
          if (value === null || value === undefined) value = '';
          if (typeof value === 'string' && value.includes(',')) value = `"${value}"`;
          return value;
        }).join(',');
      }).join('\n');

      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      
      toast({ title: 'Éxito', description: 'Archivo CSV exportado correctamente' });
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
                  .format(data.reduce((sum, p) => sum + (parseFloat(p.premium_amount) || 0), 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Comisión Total</p>
              <p className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
                  .format(data.reduce((sum, p) => sum + (parseFloat(p.commission_amount) || 0), 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Vendedores</p>
              <p className="text-2xl font-bold text-purple-600">
                {new Set(data.map(p => p.seller_name).filter(Boolean)).size}
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
          
          <div className="overflow-x-auto max-h-96">
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
                {data.slice(0, 10).map((item, idx) => (
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
            {data.length > 10 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                Mostrando 10 de {data.length} registros. Exporta para ver todos.
              </p>
            )}
          </div>
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

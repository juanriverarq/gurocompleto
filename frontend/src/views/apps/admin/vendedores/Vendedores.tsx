import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label, Tabs, Radio, ToggleSwitch, Badge, Pagination } from 'flowbite-react';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Icon } from '@iconify/react';
import { useVendedores } from 'src/hooks/useAdminCrudApi';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useTerminologia } from 'src/context/TerminologiaContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import saasApi from 'src/services/saasApi';
import type { Vendedor as VendedorType, VendedorCreate } from 'src/types/admin';
import ReportesVendedores from './ReportesVendedores';
import ReporteLiquidaciones from './ReporteLiquidaciones';

const tiposDocumento = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'RUT', label: 'RUT' },
];

// Preajustes de retención según tipo
// Basado en:
// - Persona Natural (con SS): IVA 0%, Ret Fuente 0%, Ret IVA 0%
// - Persona Natural sin SS: IVA 0%, Ret Fuente 10%, Ret IVA 0%
// - Persona Jurídica Simplificado: IVA 19%, Ret Fuente 0%, Ret IVA 15%
// - Persona Jurídica No Simplificado: IVA 19%, Ret Fuente 11%, Ret IVA 0%
const preajustesRetencion: Record<string, { porcentaje_iva: number; porcentaje_retencion: number; porcentaje_retencion_iva: number }> = {
  natural_ss: {
    porcentaje_iva: 0,
    porcentaje_retencion: 0,
    porcentaje_retencion_iva: 0,
  },
  natural_sin_ss_rf10: {
    porcentaje_iva: 0,
    porcentaje_retencion: 10,
    porcentaje_retencion_iva: 0,
  },
  juridica_simplificado: {
    porcentaje_iva: 19,
    porcentaje_retencion: 0,
    porcentaje_retencion_iva: 15,
  },
  juridica_no_simplificado_rf11: {
    porcentaje_iva: 19,
    porcentaje_retencion: 11,
    porcentaje_retencion_iva: 0,
  },
};

const Vendedores = () => {
  const { vendedores, loading, error, createVendedor, updateVendedor, deleteVendedor } = useVendedores();
  const { tenant, usuarioSaas } = useUnifiedAuth();
  const { terminologia } = useTerminologia();
  const location = useLocation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VendedorType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'lista' | 'reportes' | 'liquidaciones'>('lista');
  
  // Abrir vendedor desde query param (búsqueda global)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openVendedorId = params.get('open_vendedor_id');
    
    if (openVendedorId && vendedores.length > 0) {
      const vendedor = vendedores.find(v => String(v.id) === openVendedorId);
      if (vendedor) {
        setSelectedItem(vendedor);
        setIsEditing(true);
        // Inicializar formData con los datos del vendedor
        setFormData({ 
          nombres: vendedor.nombres || '',
          tipo_documento: vendedor.tipo_documento || 'CC',
          numero_documento: vendedor.numero_documento || '',
          telefono: vendedor.telefono || '',
          celular: vendedor.celular || '',
          email: vendedor.email || '',
          cuenta_bancaria: vendedor.cuenta_bancaria || '',
          tipo_persona: vendedor.tipo_persona || 'natural',
          tipo_retencion: vendedor.tipo_retencion || undefined,
          es_agencia: vendedor.es_agencia ?? false,
          porcentaje_comision: parseFloat(String(vendedor.porcentaje_comision)) || 0,
          calcular_comision_sobre: vendedor.calcular_comision_sobre || 'agencia',
          porcentaje_retencion: parseFloat(String(vendedor.porcentaje_retencion)) || 0,
          porcentaje_retencion_ica: parseFloat(String(vendedor.porcentaje_retencion_ica)) || 0,
          porcentaje_iva: parseFloat(String(vendedor.porcentaje_iva)) || 0,
          porcentaje_retencion_iva: parseFloat(String(vendedor.porcentaje_retencion_iva)) || 0,
          comisiones_diferentes_por_ano: vendedor.comisiones_diferentes_por_ano ?? false,
          fecha_vinculacion: vendedor.fecha_vinculacion || undefined
        });
        setShowModal(true);
        // Limpiar el query param
        params.delete('open_vendedor_id');
        navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
      }
    }
  }, [location.search, vendedores, navigate, location.pathname]);
  
  // Estados para búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filtrar y paginar vendedores
  const filteredVendedores = useMemo(() => {
    if (!searchTerm.trim()) return vendedores;
    const term = searchTerm.toLowerCase();
    return vendedores.filter((v) =>
      v.nombres?.toLowerCase().includes(term) ||
      v.email?.toLowerCase().includes(term) ||
      v.numero_documento?.toLowerCase().includes(term) ||
      v.telefono?.includes(term) ||
      v.celular?.includes(term)
    );
  }, [vendedores, searchTerm]);
  
  const totalPages = Math.ceil(filteredVendedores.length / itemsPerPage);
  
  const paginatedVendedores = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVendedores.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVendedores, currentPage, itemsPerPage]);
  
  const [formData, setFormData] = useState<VendedorCreate>({ 
    nombres: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    celular: '',
    email: '',
    cuenta_bancaria: '',
    tipo_persona: 'natural',
    tipo_retencion: undefined,
    es_agencia: false,
    porcentaje_comision: 0,
    calcular_comision_sobre: 'agencia',
    porcentaje_retencion: 0,
    porcentaje_retencion_ica: 0,
    porcentaje_iva: 0,
    porcentaje_retencion_iva: 0,
    comisiones_diferentes_por_ano: false,
    fecha_vinculacion: undefined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para modal de certificado
  const [showCertificadoModal, setShowCertificadoModal] = useState(false);
  const [vendedorCertificado, setVendedorCertificado] = useState<VendedorType | null>(null);
  const [certificadoData, setCertificadoData] = useState({
    comisionPromedio: '',
    nombreFirmante: '',
    cargoFirmante: 'Gerente',
    telefonoContacto: '',
    ciudad: 'Medellín',
    destinatarioPersonalizado: false,
    nombreDestinatario: ''
  });
  
  // Estado para información de la agencia
  const [infoAgencia, setInfoAgencia] = useState<any>(null);
  
  // Cargar información de la agencia al montar
  useEffect(() => {
    const cargarInfoAgencia = async () => {
      try {
        const headers = await saasApi.getAuthHeaders();
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
          { headers }
        );
        const data = await response.json();
        if (data?.success && data?.data) {
          setInfoAgencia(data.data);
        }
      } catch (e) {
        console.error('Error cargando info agencia:', e);
      }
    };
    cargarInfoAgencia();
  }, []);

  // Handler para cambio de tipo de retención con preajustes
  // Los valores 0 se mantienen como 0 para que el campo muestre vacío (gracias al || '' en el value)
  const handleTipoRetencionChange = (tipoRetencion: VendedorCreate['tipo_retencion']) => {
    if (tipoRetencion && preajustesRetencion[tipoRetencion]) {
      const preajuste = preajustesRetencion[tipoRetencion];
      setFormData({
        ...formData,
        tipo_retencion: tipoRetencion,
        porcentaje_iva: preajuste.porcentaje_iva,
        porcentaje_retencion: preajuste.porcentaje_retencion,
        porcentaje_retencion_iva: preajuste.porcentaje_retencion_iva,
      });
    } else {
      setFormData({
        ...formData,
        tipo_retencion: tipoRetencion,
      });
    }
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ 
      nombres: '',
      tipo_documento: 'CC',
      numero_documento: '',
      telefono: '',
      celular: '',
      email: '',
      cuenta_bancaria: '',
      tipo_persona: 'natural',
      es_agencia: false,
      porcentaje_comision: 0,
      calcular_comision_sobre: 'agencia',
      porcentaje_retencion: 0,
      porcentaje_retencion_ica: 0,
      porcentaje_iva: 0,
      porcentaje_retencion_iva: 0,
      comisiones_diferentes_por_ano: false,
      fecha_vinculacion: undefined
    });
    setShowModal(true);
  };

  const handleEdit = (item: VendedorType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({ 
      nombres: item.nombres || '',
      tipo_documento: item.tipo_documento || 'CC',
      numero_documento: item.numero_documento || '',
      telefono: item.telefono || '',
      celular: item.celular || '',
      email: item.email || '',
      cuenta_bancaria: item.cuenta_bancaria || '',
      tipo_persona: item.tipo_persona || 'natural',
      tipo_retencion: item.tipo_retencion || undefined,
      es_agencia: item.es_agencia ?? false,
      porcentaje_comision: parseFloat(String(item.porcentaje_comision)) || 0,
      calcular_comision_sobre: item.calcular_comision_sobre || 'agencia',
      porcentaje_retencion: parseFloat(String(item.porcentaje_retencion)) || 0,
      porcentaje_retencion_ica: parseFloat(String(item.porcentaje_retencion_ica)) || 0,
      porcentaje_iva: parseFloat(String(item.porcentaje_iva)) || 0,
      porcentaje_retencion_iva: parseFloat(String(item.porcentaje_retencion_iva)) || 0,
      comisiones_diferentes_por_ano: item.comisiones_diferentes_por_ano ?? false,
      fecha_vinculacion: item.fecha_vinculacion || undefined
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombres.trim()) return;

    try {
      setIsSubmitting(true);
      // Limpiar datos antes de enviar - convertir strings vacíos a null
      const cleanedData = {
        ...formData,
        fecha_vinculacion: formData.fecha_vinculacion || null,
        telefono: formData.telefono || null,
        celular: formData.celular || null,
        email: formData.email || null,
        cuenta_bancaria: formData.cuenta_bancaria || null,
        tipo_retencion: formData.tipo_retencion || null,
      };
      
      if (isEditing && selectedItem) {
        await updateVendedor(selectedItem.id, cleanedData);
      } else {
        await createVendedor(cleanedData);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error al guardar vendedor:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este vendedor?')) {
      try {
        await deleteVendedor(id);
      } catch (error) {
      }
    }
  };

  // Abrir modal de certificado
  const handleOpenCertificado = (vendedor: VendedorType) => {
    setVendedorCertificado(vendedor);
    setCertificadoData({
      comisionPromedio: '',
      nombreFirmante: usuarioSaas?.nombre || '',
      cargoFirmante: 'Gerente',
      telefonoContacto: tenant?.telefono || '',
      ciudad: tenant?.ciudad || 'Medellín',
      destinatarioPersonalizado: false,
      nombreDestinatario: ''
    });
    setShowCertificadoModal(true);
  };

  // Generar certificado PDF
  const generarCertificadoPDF = async () => {
    if (!vendedorCertificado || !tenant) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25;
    const marginRight = 25;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Usar información de la agencia si está disponible, sino usar tenant
    const agencia = infoAgencia || tenant;
    
    // Cargar logo - priorizar logo_url de infoAgencia
    let logoLoaded = false;
    const logoUrl = agencia?.logo_url || 
                    (tenant as any).logo_url || 
                    (tenant as any).branding?.logo || 
                    (tenant as any).logo;
    
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => {
            try {
              // Centrar logo
              const logoWidth = 50;
              const logoHeight = (img.height / img.width) * logoWidth;
              const logoX = (pageWidth - logoWidth) / 2;
              doc.addImage(img, 'PNG', logoX, 15, logoWidth, logoHeight);
              logoLoaded = true;
              console.log('✅ Logo cargado correctamente:', logoUrl);
            } catch (e) {
              console.warn('Error al agregar logo al PDF:', e);
            }
            resolve();
          };
          img.onerror = (e) => {
            console.warn('Error cargando imagen del logo:', logoUrl, e);
            resolve();
          };
          img.src = logoUrl;
        });
      } catch (e) {
        console.warn('Error en proceso de logo:', e);
      }
    } else {
      console.log('ℹ️ No se encontró logo:', { infoAgencia, tenant });
    }

    // Nombre de la agencia centrado
    const startY = logoLoaded ? 55 : 30;
    const nombreAgencia = agencia?.nombre || agencia?.name || tenant.branding?.nombre_comercial || tenant.nombre || 'AGENCIA DE SEGUROS';
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(nombreAgencia.toUpperCase(), pageWidth / 2, startY, { align: 'center' });

    // Fecha y ciudad - usar ciudad de la agencia si está disponible
    const ciudadAgencia = agencia?.ciudad || agencia?.city || certificadoData.ciudad;
    const fechaActual = new Date();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fechaFormateada = `${ciudadAgencia}, ${fechaActual.getDate()} de ${meses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaFormateada, marginLeft, startY + 25);

    // Destinatario
    doc.setFont('helvetica', 'bold');
    doc.text('Señores', marginLeft, startY + 45);
    doc.setFont('helvetica', 'bolditalic');
    if (certificadoData.destinatarioPersonalizado && certificadoData.nombreDestinatario) {
      doc.text(certificadoData.nombreDestinatario.toUpperCase(), marginLeft, startY + 52);
    } else {
      doc.text('A QUIEN INTERESE', marginLeft, startY + 52);
    }

    // Cuerpo del certificado - usar NIT de infoAgencia
    const nitAgencia = agencia?.nit || agencia?.document_number || tenant.nit || '[NIT]';
    const nombreVendedor = vendedorCertificado.nombres;
    const documentoVendedor = vendedorCertificado.numero_documento;
    
    // Formatear fecha de vinculación desde el vendedor
    let fechaVinculacion = '[FECHA DE VINCULACIÓN]';
    if (vendedorCertificado.fecha_vinculacion) {
      const fecha = new Date(vendedorCertificado.fecha_vinculacion);
      const mesesVinc = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      fechaVinculacion = `${mesesVinc[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
    
    const comisionPromedio = certificadoData.comisionPromedio ? `$${Number(certificadoData.comisionPromedio).toLocaleString('es-CO')}` : '[MONTO]';

    const parrafo = `${nombreAgencia.toUpperCase()} agencia autorizada con NIT. ${nitAgencia} certifica que el señor ${nombreVendedor}, identificado con ${vendedorCertificado.tipo_documento} ${documentoVendedor}, tiene con nosotros vínculos comerciales profesionales desde ${fechaVinculacion}, como asesor externo de seguros ante ${nombreAgencia.toUpperCase()}, con unas comisiones promedio mensual de ${comisionPromedio}`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const splitParrafo = doc.splitTextToSize(parrafo, contentWidth);
    doc.text(splitParrafo, marginLeft, startY + 72);

    // Información de contacto - usar teléfono de la agencia
    const telefonoContacto = certificadoData.telefonoContacto || agencia?.telefono || agencia?.phone || tenant.telefono || '[TELÉFONO]';
    const textoContacto = `Cualquier información adicional con gusto será suministrada teléfono ${telefonoContacto}`;
    
    const yContacto = startY + 72 + (splitParrafo.length * 6) + 15;
    const splitContacto = doc.splitTextToSize(textoContacto, contentWidth);
    doc.text(splitContacto, marginLeft, yContacto);

    // Despedida
    doc.text('Cordialmente', marginLeft, yContacto + 20);

    // Firma
    const yFirma = yContacto + 55;
    doc.setFont('helvetica', 'bold');
    doc.text(certificadoData.nombreFirmante.toUpperCase() || '[NOMBRE DEL FIRMANTE]', marginLeft, yFirma);
    doc.setFont('helvetica', 'normal');
    doc.text(certificadoData.cargoFirmante, marginLeft, yFirma + 6);

    // Descargar PDF
    doc.save(`Certificado_${nombreVendedor.replace(/\s+/g, '_')}.pdf`);
    setShowCertificadoModal(false);
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Gestión de {terminologia.vendedorPlural}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra el equipo de {terminologia.vendedorPlural.toLowerCase()} de tu agencia.
            </p>
          </div>
          {activeTab === 'lista' && (
            <Button onClick={handleCreate} className="flex items-center">
              <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
              Nuevo {terminologia.vendedor}
            </Button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('lista')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'lista'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 inline mr-2" />
            Lista de {terminologia.vendedorPlural}
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'reportes'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon icon="solar:chart-2-bold" className="w-4 h-4 inline mr-2" />
            Reportes
          </button>
          <button
            onClick={() => setActiveTab('liquidaciones')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'liquidaciones'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon icon="solar:calculator-bold" className="w-4 h-4 inline mr-2" />
            Liquidaciones
          </button>
        </div>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'reportes' ? (
        <ReportesVendedores />
      ) : activeTab === 'liquidaciones' ? (
        <ReporteLiquidaciones />
      ) : (
        <>
          {/* Buscador */}
      <Card className="mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:max-w-md">
            <TextInput
              icon={() => <Icon icon="solar:magnifer-linear" className="w-5 h-5 text-gray-400" />}
              placeholder={`Buscar ${terminologia.vendedorPlural.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset a primera página al buscar
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Mostrar:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-500">
              {searchTerm ? (
                <>Encontrados: <strong>{filteredVendedores.length}</strong> de {vendedores.length}</>
              ) : (
                <>Total: <strong>{vendedores.length}</strong></>
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* Contenido principal */}
      {error && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-circle-bold" className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      ) : vendedores.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon icon="solar:user-id-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay {terminologia.vendedorPlural.toLowerCase()} definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza agregando {terminologia.vendedorPlural.toLowerCase()} a tu equipo comercial.
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCreate}>
                <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
                Crear {terminologia.vendedor}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>{terminologia.vendedor}</Table.HeadCell>
                <Table.HeadCell>Documento</Table.HeadCell>
                <Table.HeadCell>Contacto</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Comisión</Table.HeadCell>
                <Table.HeadCell>Retenciones</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {paginatedVendedores.map((item) => (
                  <Table.Row key={item.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon 
                          icon={item.es_agencia ? "solar:buildings-bold" : "solar:user-bold"} 
                          className="w-5 h-5 text-blue-600" 
                        />
                        <div>
                          <div className="font-medium">{item.nombres}</div>
                          <div className="text-xs text-gray-500">{item.email}</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="font-medium">{item.tipo_documento}:</span> {item.numero_documento}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      <div className="text-sm">
                        <div>📞 {item.telefono}</div>
                        <div>📱 {item.celular}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color={item.tipo_persona === 'natural' ? 'green' : 'blue'} size="sm">
                          {item.tipo_persona === 'natural' ? 'Natural' : 'Jurídica'}
                        </Badge>
                        {item.es_agencia && (
                          <Badge color="purple" size="sm">Agencia</Badge>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color="green" size="sm">{item.porcentaje_comision}%</Badge>
                        <div className="text-xs text-gray-400">
                          {item.calcular_comision_sobre === 'agencia' ? 'Sobre agencia' : 'Prima neta'}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color="orange" size="sm">Ret: {item.porcentaje_retencion}%</Badge>
                        <Badge color="red" size="sm">ICA: {item.porcentaje_retencion_ica}%</Badge>
                        <Badge color="purple" size="sm">IVA: {item.porcentaje_iva}%</Badge>
                        <Badge color="pink" size="sm">ReteIVA: {item.porcentaje_retencion_iva}%</Badge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          color="info"
                          onClick={() => handleOpenCertificado(item)}
                          title="Generar Certificado"
                        >
                          <Icon icon="solar:document-text-bold" className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="gray"
                          onClick={() => handleEdit(item)}
                        >
                          <Icon icon="solar:pen-bold" className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="failure"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          
          {/* Paginador */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredVendedores.length)} de {filteredVendedores.length}
                {searchTerm && ` (filtrado de ${vendedores.length} total)`}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                showIcons
              />
            </div>
          )}
        </Card>
      )}

      {/* Modal de formulario extenso con tabs */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="4xl">
        <Modal.Header>
          {isEditing ? `Editar ${terminologia.vendedor}` : `Datos del ${terminologia.vendedor}`}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="max-h-[70vh] overflow-y-auto">
            <Tabs>
              <Tabs.Item active title="Datos principales">
                <div className="space-y-6 mt-4">
                  {/* Información Personal */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos principales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="nombres" value="Nombres *" />
                        <TextInput
                          id="nombres"
                          type="text"
                          placeholder="Nombres"
                          value={formData.nombres}
                          onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tipo_documento" value="Tipo documento" />
                        <select
                          id="tipo_documento"
                          value={formData.tipo_documento}
                          onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        >
                          {tiposDocumento.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="numero_documento" value="Número de documento" />
                        <TextInput
                          id="numero_documento"
                          type="text"
                          placeholder="Número de documento"
                          value={formData.numero_documento}
                          onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefono" value="Teléfono" />
                        <TextInput
                          id="telefono"
                          type="tel"
                          placeholder="Teléfono"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="celular" value="Celular" />
                        <TextInput
                          id="celular"
                          type="tel"
                          placeholder="Celular"
                          value={formData.celular}
                          onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" value="Email" />
                        <TextInput
                          id="email"
                          type="email"
                          placeholder="Email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="cuenta_bancaria" value="Cuenta Bancaria" />
                        <TextInput
                          id="cuenta_bancaria"
                          type="text"
                          placeholder="Cuenta Bancaria"
                          value={formData.cuenta_bancaria}
                          onChange={(e) => setFormData({ ...formData, cuenta_bancaria: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tipo de Persona */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Tipo persona</h4>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Radio
                          id="natural"
                          name="tipo_persona"
                          value="natural"
                          checked={formData.tipo_persona === 'natural'}
                          onChange={(e) => setFormData({ ...formData, tipo_persona: e.target.value as 'natural' | 'juridica' })}
                        />
                        <Label htmlFor="natural">Natural</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Radio
                          id="juridica"
                          name="tipo_persona"
                          value="juridica"
                          checked={formData.tipo_persona === 'juridica'}
                          onChange={(e) => setFormData({ ...formData, tipo_persona: e.target.value as 'natural' | 'juridica' })}
                        />
                        <Label htmlFor="juridica">Jurídica</Label>
                      </div>
                    </div>
                  </div>

                  {/* Tipo de retención (opcional) - con preajustes */}
                  <div>
                    <Label htmlFor="tipo_retencion" value="Tipo de retención (opcional)" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Al seleccionar un tipo, se aplicarán automáticamente los porcentajes de IVA, Retención y ReteIVA correspondientes.</p>
                    <select
                      id="tipo_retencion"
                      value={formData.tipo_retencion || ''}
                      onChange={(e) => handleTipoRetencionChange((e.target.value || undefined) as VendedorCreate['tipo_retencion'])}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                    >
                      <option value="">— Sin especificar —</option>
                      <option value="natural_ss">Persona natural con seguridad social (sin retenciones)</option>
                      <option value="natural_sin_ss_rf10">Persona natural sin seguridad social (con retención en la fuente 10%)</option>
                      <option value="juridica_simplificado">Persona jurídica simplificado (IVA-RETEIVA)</option>
                      <option value="juridica_no_simplificado_rf11">Persona jurídica no simplificado (IVA-Retención en la fuente 11%)</option>
                    </select>
                  </div>

                  {/* Fecha de Vinculación */}
                  <div>
                    <Label htmlFor="fecha_vinculacion" value="Fecha de vinculación" />
                    <TextInput
                      id="fecha_vinculacion"
                      type="date"
                      value={formData.fecha_vinculacion || ''}
                      onChange={(e) => setFormData({ ...formData, fecha_vinculacion: e.target.value || undefined })}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fecha desde la cual el vendedor está vinculado (para certificados)</p>
                  </div>

                  {/* Es Agencia */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="es_agencia"
                        checked={formData.es_agencia}
                        onCheckedChange={(checked) => setFormData({ ...formData, es_agencia: !!checked })}
                      />
                      <Label htmlFor="es_agencia">Es Agencia</Label>
                    </div>
                  </div>
                </div>
              </Tabs.Item>

              <Tabs.Item title="Comisiones">
                <div className="space-y-6 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="porcentaje_comision" value="% Comisión *" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_comision"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="Porcentaje de comisión"
                          value={formData.porcentaje_comision || ''}
                          onChange={(e) => setFormData({ ...formData, porcentaje_comision: parseFloat(e.target.value) || 0 })}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>

                    <div>
                      <Label value="Calcular comisión sobre" />
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Radio
                            id="agencia"
                            name="calcular_comision_sobre"
                            value="agencia"
                            checked={formData.calcular_comision_sobre === 'agencia'}
                            onChange={(e) => setFormData({ ...formData, calcular_comision_sobre: e.target.value as 'agencia' | 'prima_neta' })}
                          />
                          <Label htmlFor="agencia">Agencia</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Radio
                            id="prima_neta"
                            name="calcular_comision_sobre"
                            value="prima_neta"
                            checked={formData.calcular_comision_sobre === 'prima_neta'}
                            onChange={(e) => setFormData({ ...formData, calcular_comision_sobre: e.target.value as 'agencia' | 'prima_neta' })}
                          />
                          <Label htmlFor="prima_neta">Prima neta</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="porcentaje_retencion" value="% Retención Fuente" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_retencion"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% Retención"
                          value={formData.porcentaje_retencion === 0 ? '' : formData.porcentaje_retencion}
                          onChange={(e) => setFormData({ ...formData, porcentaje_retencion: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="porcentaje_retencion_ica" value="% Retención ICA" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_retencion_ica"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% Retención ICA"
                          value={formData.porcentaje_retencion_ica === 0 ? '' : formData.porcentaje_retencion_ica}
                          onChange={(e) => setFormData({ ...formData, porcentaje_retencion_ica: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="porcentaje_iva" value="% IVA" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% IVA"
                          value={formData.porcentaje_iva === 0 ? '' : formData.porcentaje_iva}
                          onChange={(e) => setFormData({ ...formData, porcentaje_iva: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="porcentaje_retencion_iva" value="% ReteIVA" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_retencion_iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% ReteIVA"
                          value={formData.porcentaje_retencion_iva === 0 ? '' : formData.porcentaje_retencion_iva}
                          onChange={(e) => setFormData({ ...formData, porcentaje_retencion_iva: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <ToggleSwitch
                      checked={formData.comisiones_diferentes_por_ano}
                      label="Comisiones diferentes por año"
                      onChange={(checked) => setFormData({ ...formData, comisiones_diferentes_por_ano: checked })}
                    />
                  </div>
                </div>
              </Tabs.Item>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-2 ml-auto">
              <Button
                color="gray"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.nombres.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Modal de Certificado */}
      <Modal show={showCertificadoModal} onClose={() => setShowCertificadoModal(false)} size="lg">
        <Modal.Header>
          Generar Certificado Laboral
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Alert color="info">
              <div className="flex items-center gap-2">
                <Icon icon="solar:info-circle-bold" className="w-5 h-5" />
                <span>Complete los datos para generar el certificado de <strong>{vendedorCertificado?.nombres}</strong></span>
              </div>
            </Alert>

            {/* Mostrar fecha de vinculación del vendedor */}
            {vendedorCertificado?.fecha_vinculacion ? (
              <Alert color="success">
                <span>Fecha de vinculación registrada: <strong>{new Date(vendedorCertificado.fecha_vinculacion).toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}</strong></span>
              </Alert>
            ) : (
              <Alert color="warning">
                <span>Este vendedor no tiene fecha de vinculación registrada. Por favor, edite el vendedor para agregar esta información.</span>
              </Alert>
            )}

            {/* Destinatario */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="destinatarioPersonalizado"
                  checked={certificadoData.destinatarioPersonalizado}
                  onCheckedChange={(checked) => setCertificadoData({ ...certificadoData, destinatarioPersonalizado: !!checked })}
                />
                <Label htmlFor="destinatarioPersonalizado">Dirigir a una persona específica (en lugar de "A QUIEN INTERESE")</Label>
              </div>
              {certificadoData.destinatarioPersonalizado && (
                <TextInput
                  id="nombreDestinatario"
                  type="text"
                  placeholder="Nombre del destinatario"
                  value={certificadoData.nombreDestinatario}
                  onChange={(e) => setCertificadoData({ ...certificadoData, nombreDestinatario: e.target.value })}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="comisionPromedio" value="Comisión promedio mensual ($)" />
                <TextInput
                  id="comisionPromedio"
                  type="number"
                  placeholder="Ej: 2500000"
                  value={certificadoData.comisionPromedio}
                  onChange={(e) => setCertificadoData({ ...certificadoData, comisionPromedio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ciudad" value="Ciudad" />
                <TextInput
                  id="ciudad"
                  type="text"
                  placeholder="Medellín"
                  value={certificadoData.ciudad}
                  onChange={(e) => setCertificadoData({ ...certificadoData, ciudad: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="telefonoContacto" value="Teléfono de contacto" />
                <TextInput
                  id="telefonoContacto"
                  type="text"
                  placeholder="Teléfono"
                  value={certificadoData.telefonoContacto}
                  onChange={(e) => setCertificadoData({ ...certificadoData, telefonoContacto: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="nombreFirmante" value="Nombre del firmante *" />
                <TextInput
                  id="nombreFirmante"
                  type="text"
                  placeholder="Nombre completo"
                  value={certificadoData.nombreFirmante}
                  onChange={(e) => setCertificadoData({ ...certificadoData, nombreFirmante: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="cargoFirmante" value="Cargo del firmante" />
                <TextInput
                  id="cargoFirmante"
                  type="text"
                  placeholder="Gerente"
                  value={certificadoData.cargoFirmante}
                  onChange={(e) => setCertificadoData({ ...certificadoData, cargoFirmante: e.target.value })}
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex gap-2 ml-auto">
            <Button color="gray" onClick={() => setShowCertificadoModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={generarCertificadoPDF}
              disabled={!vendedorCertificado?.fecha_vinculacion || !certificadoData.nombreFirmante}
            >
              <Icon icon="solar:document-text-bold" className="w-4 h-4 mr-2" />
              Generar PDF
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
        </>
      )}
    </>
  );
};

export default Vendedores; 
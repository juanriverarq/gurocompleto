import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSaas } from '../../../contexts/SaasContext';
import { saasApi } from '../../../services/saasApi';
import { ClienteSaaS, UsuarioSaaS } from '../../../types/saas';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../../components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Textarea } from '../../../components/shadcn-ui/Default-Ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../components/shadcn-ui/Default-Ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/shadcn-ui/Default-Ui/tabs';
import { 
  Icon as IconifyIcon 
} from '@iconify/react';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

interface FormData {
  // Datos comunes
  tipo: 'PERSONA' | 'EMPRESA' | 'CONSORCIO';
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  pais: string;
  codigo_postal: string;
  asesor_asignado_id: string;
  origen: string;
  observaciones: string;
  tags: string[];
  
  // Datos específicos
  persona?: {
    nombres: string;
    apellidos: string;
    documento: string;
    tipo_documento: string;
    fecha_nacimiento: string;
    lugar_nacimiento: string;
    genero: string;
    estado_civil: string;
    profesion: string;
    ingresos_mensuales: number;
  };
  
  empresa?: {
    razon_social: string;
    nombre_comercial: string;
    nit: string;
    tipo_empresa: string;
    representante_legal: string;
    documento_representante: string;
    sector_economico: string;
    actividad_economica: string;
    numero_empleados: number;
    ingresos_anuales: number;
    fecha_constitucion: string;
  };
  
  consorcio?: {
    nombre_consorcio: string;
    objeto_consorcio: string;
    empresas_miembro: {
      nombre: string;
      nit: string;
      participacion: number;
      representante: string;
    }[];
    representante_legal: string;
    documento_representante: string;
    duracion_consorcio: string;
  };
}

const NuevoCliente: React.FC = () => {
  const { hasPermission } = useSaas();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<FormData>({
    tipo: 'PERSONA',
    email: '',
    telefono: '',
    celular: '',
    direccion: '',
    ciudad: '',
    departamento: '',
    pais: 'Colombia',
    codigo_postal: '',
    asesor_asignado_id: '',
    origen: 'PRESENCIAL',
    observaciones: '',
    tags: [],
    persona: {
      nombres: '',
      apellidos: '',
      documento: '',
      tipo_documento: 'CC',
      fecha_nacimiento: '',
      lugar_nacimiento: '',
      genero: 'M',
      estado_civil: 'SOLTERO',
      profesion: '',
      ingresos_mensuales: 0
    }
  });
  
  const [asesores, setAsesores] = useState<UsuarioSaaS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTag, setCurrentTag] = useState('');

  const canCreate = hasPermission('clientes', 'crear');

  useEffect(() => {
    if (canCreate) {
      loadAsesores();
    }
  }, [canCreate]);

  const loadAsesores = async () => {
    try {
      const response = await saasApi.getUsuarios({
        rol: 'asesor',
        estado: 'ACTIVO'
      });
      
      if (response.success && response.data) {
        setAsesores(response.data.data);
      }
    } catch (err) {
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section: 'persona' | 'empresa' | 'consorcio', field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleTipoChange = (tipo: 'PERSONA' | 'EMPRESA' | 'CONSORCIO') => {
    setFormData(prev => {
      const newData: FormData = {
        ...prev,
        tipo,
        persona: undefined,
        empresa: undefined,
        consorcio: undefined
      };

      if (tipo === 'PERSONA') {
        newData.persona = {
          nombres: '',
          apellidos: '',
          documento: '',
          tipo_documento: 'CC',
          fecha_nacimiento: '',
          lugar_nacimiento: '',
          genero: 'M',
          estado_civil: 'SOLTERO',
          profesion: '',
          ingresos_mensuales: 0
        };
      } else if (tipo === 'EMPRESA') {
        newData.empresa = {
          razon_social: '',
          nombre_comercial: '',
          nit: '',
          tipo_empresa: 'SAS',
          representante_legal: '',
          documento_representante: '',
          sector_economico: '',
          actividad_economica: '',
          numero_empleados: 0,
          ingresos_anuales: 0,
          fecha_constitucion: ''
        };
      } else if (tipo === 'CONSORCIO') {
        newData.consorcio = {
          nombre_consorcio: '',
          objeto_consorcio: '',
          empresas_miembro: [],
          representante_legal: '',
          documento_representante: '',
          duracion_consorcio: ''
        };
      }

      return newData;
    });
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addEmpresaMiembro = () => {
    if (formData.consorcio) {
      setFormData(prev => ({
        ...prev,
        consorcio: {
          ...prev.consorcio!,
          empresas_miembro: [
            ...prev.consorcio!.empresas_miembro,
            {
              nombre: '',
              nit: '',
              participacion: 0,
              representante: ''
            }
          ]
        }
      }));
    }
  };

  const removeEmpresaMiembro = (index: number) => {
    if (formData.consorcio) {
      setFormData(prev => ({
        ...prev,
        consorcio: {
          ...prev.consorcio!,
          empresas_miembro: prev.consorcio!.empresas_miembro.filter((_, i) => i !== index)
        }
      }));
    }
  };

  const updateEmpresaMiembro = (index: number, field: string, value: any) => {
    if (formData.consorcio) {
      setFormData(prev => ({
        ...prev,
        consorcio: {
          ...prev.consorcio!,
          empresas_miembro: prev.consorcio!.empresas_miembro.map((empresa, i) => 
            i === index ? { ...empresa, [field]: value } : empresa
          )
        }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      
      // Preparar datos para envío
      const clienteData = {
        ...formData,
        estado: 'ACTIVO' as const,
        broker_id: '', // Se asigna en el backend
        documentos_adjuntos: [],
        total_polizas: 0,
        prima_total_anual: 0,
        fecha_ultima_actividad: new Date().toISOString()
      };

      const response = await saasApi.createCliente(clienteData);
      
      if (response.success) {
        navigate('/clientes');
      } else {
        setError(response.message || 'Error al crear cliente');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente');
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin permisos</h2>
          <p className="text-gray-600">No tienes permisos para crear clientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
          <p className="text-gray-600">Registra un nuevo cliente en el sistema</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['PERSONA', 'EMPRESA', 'CONSORCIO'] as const).map((tipo) => (
                <div
                  key={tipo}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.tipo === tipo
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleTipoChange(tipo)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formData.tipo === tipo ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`} />
                    <div>
                      <h3 className="font-medium">{tipo}</h3>
                      <p className="text-sm text-gray-500">
                        {tipo === 'PERSONA' && 'Persona natural'}
                        {tipo === 'EMPRESA' && 'Empresa o corporación'}
                        {tipo === 'CONSORCIO' && 'Consorcio de empresas'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="datos-especificos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="datos-especificos">Datos Específicos</TabsTrigger>
            <TabsTrigger value="contacto">Contacto</TabsTrigger>
            <TabsTrigger value="adicional">Información Adicional</TabsTrigger>
          </TabsList>

          {/* Datos Específicos */}
          <TabsContent value="datos-especificos" className="space-y-6">
            {formData.tipo === 'PERSONA' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombres *</Label>
                      <Input
                        value={formData.persona?.nombres || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'nombres', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Apellidos *</Label>
                      <Input
                        value={formData.persona?.apellidos || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'apellidos', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Documento</Label>
                      <Select 
                        value={formData.persona?.tipo_documento || 'CC'}
                        onValueChange={(value) => handleNestedInputChange('persona', 'tipo_documento', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                          <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                          <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                          <SelectItem value="PP">Pasaporte</SelectItem>
                          <SelectItem value="RC">Registro Civil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Número de Documento *</Label>
                      <Input
                        value={formData.persona?.documento || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'documento', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Fecha de Nacimiento</Label>
                      <Input
                        type="date"
                        value={formData.persona?.fecha_nacimiento || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'fecha_nacimiento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Lugar de Nacimiento</Label>
                      <Input
                        value={formData.persona?.lugar_nacimiento || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'lugar_nacimiento', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Género</Label>
                      <Select 
                        value={formData.persona?.genero || 'M'}
                        onValueChange={(value) => handleNestedInputChange('persona', 'genero', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                          <SelectItem value="OTRO">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Estado Civil</Label>
                      <Select 
                        value={formData.persona?.estado_civil || 'SOLTERO'}
                        onValueChange={(value) => handleNestedInputChange('persona', 'estado_civil', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SOLTERO">Soltero</SelectItem>
                          <SelectItem value="CASADO">Casado</SelectItem>
                          <SelectItem value="UNION_LIBRE">Unión Libre</SelectItem>
                          <SelectItem value="DIVORCIADO">Divorciado</SelectItem>
                          <SelectItem value="VIUDO">Viudo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Profesión</Label>
                      <Input
                        value={formData.persona?.profesion || ''}
                        onChange={(e) => handleNestedInputChange('persona', 'profesion', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Ingresos Mensuales</Label>
                    <Input
                      type="number"
                      value={formData.persona?.ingresos_mensuales || 0}
                      onChange={(e) => handleNestedInputChange('persona', 'ingresos_mensuales', parseInt(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {formData.tipo === 'EMPRESA' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información Empresarial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Razón Social *</Label>
                      <Input
                        value={formData.empresa?.razon_social || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'razon_social', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Nombre Comercial</Label>
                      <Input
                        value={formData.empresa?.nombre_comercial || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'nombre_comercial', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>NIT *</Label>
                      <Input
                        value={formData.empresa?.nit || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'nit', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Tipo de Empresa</Label>
                      <Select 
                        value={formData.empresa?.tipo_empresa || 'SAS'}
                        onValueChange={(value) => handleNestedInputChange('empresa', 'tipo_empresa', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAS">SAS</SelectItem>
                          <SelectItem value="LTDA">LTDA</SelectItem>
                          <SelectItem value="SA">SA</SelectItem>
                          <SelectItem value="COOPERATIVA">Cooperativa</SelectItem>
                          <SelectItem value="FUNDACION">Fundación</SelectItem>
                          <SelectItem value="OTRO">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Representante Legal *</Label>
                      <Input
                        value={formData.empresa?.representante_legal || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'representante_legal', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Documento Representante</Label>
                      <Input
                        value={formData.empresa?.documento_representante || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'documento_representante', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Sector Económico</Label>
                      <Input
                        value={formData.empresa?.sector_economico || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'sector_economico', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Actividad Económica</Label>
                      <Input
                        value={formData.empresa?.actividad_economica || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'actividad_economica', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Número de Empleados</Label>
                      <Input
                        type="number"
                        value={formData.empresa?.numero_empleados || 0}
                        onChange={(e) => handleNestedInputChange('empresa', 'numero_empleados', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Ingresos Anuales</Label>
                      <Input
                        type="number"
                        value={formData.empresa?.ingresos_anuales || 0}
                        onChange={(e) => handleNestedInputChange('empresa', 'ingresos_anuales', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Fecha de Constitución</Label>
                      <Input
                        type="date"
                        value={formData.empresa?.fecha_constitucion || ''}
                        onChange={(e) => handleNestedInputChange('empresa', 'fecha_constitucion', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {formData.tipo === 'CONSORCIO' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información del Consorcio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre del Consorcio *</Label>
                      <Input
                        value={formData.consorcio?.nombre_consorcio || ''}
                        onChange={(e) => handleNestedInputChange('consorcio', 'nombre_consorcio', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Duración del Consorcio</Label>
                      <Input
                        value={formData.consorcio?.duracion_consorcio || ''}
                        onChange={(e) => handleNestedInputChange('consorcio', 'duracion_consorcio', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Objeto del Consorcio</Label>
                    <Textarea
                      value={formData.consorcio?.objeto_consorcio || ''}
                      onChange={(e) => handleNestedInputChange('consorcio', 'objeto_consorcio', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Representante Legal *</Label>
                      <Input
                        value={formData.consorcio?.representante_legal || ''}
                        onChange={(e) => handleNestedInputChange('consorcio', 'representante_legal', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Documento Representante</Label>
                      <Input
                        value={formData.consorcio?.documento_representante || ''}
                        onChange={(e) => handleNestedInputChange('consorcio', 'documento_representante', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Empresas Miembro */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label>Empresas Miembro</Label>
                      <Button type="button" variant="outline" onClick={addEmpresaMiembro}>
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Empresa
                      </Button>
                    </div>
                    
                    {formData.consorcio?.empresas_miembro.map((empresa, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Empresa {index + 1}</h4>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeEmpresaMiembro(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Nombre de la Empresa</Label>
                            <Input
                              value={empresa.nombre}
                              onChange={(e) => updateEmpresaMiembro(index, 'nombre', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>NIT</Label>
                            <Input
                              value={empresa.nit}
                              onChange={(e) => updateEmpresaMiembro(index, 'nit', e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Participación (%)</Label>
                            <Input
                              type="number"
                              value={empresa.participacion}
                              onChange={(e) => updateEmpresaMiembro(index, 'participacion', parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Representante</Label>
                            <Input
                              value={empresa.representante}
                              onChange={(e) => updateEmpresaMiembro(index, 'representante', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contacto */}
          <TabsContent value="contacto" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Teléfono *</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Celular</Label>
                  <Input
                    value={formData.celular}
                    onChange={(e) => handleInputChange('celular', e.target.value)}
                  />
                </div>

                <div>
                  <Label>Dirección *</Label>
                  <Textarea
                    value={formData.direccion}
                    onChange={(e) => handleInputChange('direccion', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Ciudad *</Label>
                    <Input
                      value={formData.ciudad}
                      onChange={(e) => handleInputChange('ciudad', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Departamento *</Label>
                    <Input
                      value={formData.departamento}
                      onChange={(e) => handleInputChange('departamento', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>País</Label>
                    <Input
                      value={formData.pais}
                      onChange={(e) => handleInputChange('pais', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Código Postal</Label>
                  <Input
                    value={formData.codigo_postal}
                    onChange={(e) => handleInputChange('codigo_postal', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Información Adicional */}
          <TabsContent value="adicional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Asesor Asignado</Label>
                    <Select 
                      value={formData.asesor_asignado_id}
                      onValueChange={(value) => handleInputChange('asesor_asignado_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar asesor" />
                      </SelectTrigger>
                      <SelectContent>
                        {asesores.map(asesor => (
                          <SelectItem key={asesor.id} value={asesor.id}>
                            {asesor.nombre} {asesor.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Origen</Label>
                    <Select 
                      value={formData.origen}
                      onValueChange={(value) => handleInputChange('origen', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REFERIDO">Referido</SelectItem>
                        <SelectItem value="WEB">Web</SelectItem>
                        <SelectItem value="TELEFONO">Teléfono</SelectItem>
                        <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                        <SelectItem value="REDES_SOCIALES">Redes Sociales</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Observaciones</Label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => handleInputChange('observaciones', e.target.value)}
                    placeholder="Notas adicionales sobre el cliente..."
                  />
                </div>

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      placeholder="Agregar tag..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/clientes')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cliente
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NuevoCliente; 
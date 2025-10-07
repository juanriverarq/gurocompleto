import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saasApi } from '../../../services/saasApi';
import { ClienteSaaS, UsuarioSaaS } from '../../../types/saas';
import { useSaas } from '../../../contexts/SaasContext';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../../components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Textarea } from '../../../components/shadcn-ui/Default-Ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/shadcn-ui/Default-Ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/shadcn-ui/Default-Ui/tabs';
import saasApi from 'src/services/saasApi';
import ArchivosCliente from 'src/views/apps/seguros/clientes/components/ArchivosCliente';
import { Icon as IconifyIcon } from '@iconify/react';
import { ArrowLeft, Save } from 'lucide-react';

const EditarCliente: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useSaas();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asesores, setAsesores] = useState<UsuarioSaaS[]>([]);
  const [cliente, setCliente] = useState<ClienteSaaS | null>(null);
  

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [clienteRes, asesoresRes] = await Promise.all([
          saasApi.getCliente(id as string),
          saasApi.getUsuarios({ rol: 'asesor', estado: 'ACTIVO' }),
        ]);
        if (clienteRes.success && clienteRes.data) setCliente(clienteRes.data);
        if (asesoresRes.success && asesoresRes.data) setAsesores(asesoresRes.data.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar cliente');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  

  const handleBasicChange = (field: keyof ClienteSaaS, value: any) => {
    setCliente(prev => (prev ? { ...prev, [field]: value } as ClienteSaaS : prev));
  };

  const handlePersonaChange = (field: string, value: any) => {
    setCliente(prev => (
      prev
        ? { ...prev, persona: { ...(prev.persona || {}), [field]: value } as any }
        : prev
    ));
  };

  const handleEmpresaChange = (field: string, value: any) => {
    setCliente(prev => (
      prev
        ? { ...prev, empresa: { ...(prev.empresa || {}), [field]: value } as any }
        : prev
    ));
  };

  const handleConsorcioChange = (field: string, value: any) => {
    setCliente(prev => (
      prev
        ? { ...prev, consorcio: { ...(prev.consorcio || {}), [field]: value } as any }
        : prev
    ));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    try {
      setSaving(true);
      const res = await saasApi.updateCliente(cliente.id, cliente as Partial<ClienteSaaS>);
      if (res.success) navigate(`/apps/saas/clientes/${cliente.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission('clientes', 'editar')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin permisos</h2>
          <p className="text-gray-600">No tienes permisos para editar clientes</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando cliente...</span>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">Cliente no encontrado</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(`/apps/saas/clientes/${cliente.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Cliente</h1>
          <p className="text-gray-600">Actualiza la información del cliente</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 border rounded-lg ${cliente.tipo === 'PERSONA' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                Persona
              </div>
              <div
                className={`p-4 border rounded-lg ${cliente.tipo === 'EMPRESA' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                Empresa
              </div>
              <div
                className={`p-4 border rounded-lg ${cliente.tipo === 'CONSORCIO' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                Consorcio
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="datos-especificos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="datos-especificos">Datos Específicos</TabsTrigger>
            <TabsTrigger value="contacto">Contacto</TabsTrigger>
            <TabsTrigger value="adicional">Información Adicional</TabsTrigger>
            <TabsTrigger value="archivos">Archivos</TabsTrigger>
          </TabsList>

          <TabsContent value="datos-especificos" className="space-y-6">
            {cliente.tipo === 'PERSONA' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombres</Label>
                      <Input value={cliente.persona?.nombres || ''} onChange={(e) => handlePersonaChange('nombres', e.target.value)} />
                    </div>
                    <div>
                      <Label>Apellidos</Label>
                      <Input value={cliente.persona?.apellidos || ''} onChange={(e) => handlePersonaChange('apellidos', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Documento</Label>
                      <Select value={cliente.persona?.tipo_documento || 'CC'} onValueChange={(v) => handlePersonaChange('tipo_documento', v)}>
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
                      <Label>Número de Documento</Label>
                      <Input value={cliente.persona?.documento || ''} onChange={(e) => handlePersonaChange('documento', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {cliente.tipo === 'EMPRESA' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información Empresarial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Razón Social</Label>
                      <Input value={cliente.empresa?.razon_social || ''} onChange={(e) => handleEmpresaChange('razon_social', e.target.value)} />
                    </div>
                    <div>
                      <Label>NIT</Label>
                      <Input value={cliente.empresa?.nit || ''} onChange={(e) => handleEmpresaChange('nit', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {cliente.tipo === 'CONSORCIO' && (
              <Card>
                <CardHeader>
                  <CardTitle>Información del Consorcio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre del Consorcio</Label>
                      <Input value={cliente.consorcio?.nombre_consorcio || ''} onChange={(e) => handleConsorcioChange('nombre_consorcio', e.target.value)} />
                    </div>
                    <div>
                      <Label>Duración</Label>
                      <Input value={cliente.consorcio?.duracion_consorcio || ''} onChange={(e) => handleConsorcioChange('duracion_consorcio', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contacto" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={cliente.email || ''} onChange={(e) => handleBasicChange('email', e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={cliente.telefono || ''} onChange={(e) => handleBasicChange('telefono', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Ciudad</Label>
                    <Input value={cliente.ciudad || ''} onChange={(e) => handleBasicChange('ciudad', e.target.value)} />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Input value={cliente.departamento || ''} onChange={(e) => handleBasicChange('departamento', e.target.value)} />
                  </div>
                  <div>
                    <Label>País</Label>
                    <Input value={cliente.pais || ''} onChange={(e) => handleBasicChange('pais', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Textarea value={cliente.direccion || ''} onChange={(e) => handleBasicChange('direccion', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adicional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Asesor Asignado</Label>
                    <Select value={cliente.asesor_asignado_id || ''} onValueChange={(v) => handleBasicChange('asesor_asignado_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar asesor" />
                      </SelectTrigger>
                      <SelectContent>
                        {asesores.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nombre} {a.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Select value={cliente.estado} onValueChange={(v) => handleBasicChange('estado', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVO">Activo</SelectItem>
                        <SelectItem value="INACTIVO">Inactivo</SelectItem>
                        <SelectItem value="PROSPECTO">Prospecto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Observaciones</Label>
                  <Textarea value={cliente.observaciones || ''} onChange={(e) => handleBasicChange('observaciones', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="archivos" className="space-y-4">
            {id && <ArchivosCliente clienteId={id} />}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(`/apps/saas/clientes/${cliente.id}`)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditarCliente;



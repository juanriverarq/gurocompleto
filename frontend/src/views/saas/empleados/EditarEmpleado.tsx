import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/shadcn-ui/Default-Ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from 'src/components/shadcn-ui/Default-Ui/dialog';
import { useEmpleadosBroker, useAuthenticatedAdminRequest } from 'src/hooks/useAdminCrudApi';
import { Icon as IconifyIcon } from '@iconify/react';

const EditarEmpleado: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateEmpleado, cambiarPasswordEmpleado, generarPasswordTemporal, resetPasswordEmpleado } = useEmpleadosBroker();
  const { makeRequest } = useAuthenticatedAdminRequest();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    password_confirmation: '',
    requiere_cambio_password: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    usuario: '',
    rol_id: '',
    estado: 'activo',
    tipo_vinculacion: 'empleado',
    salario: '',
    fecha_ingreso: '',
    cargo: '',
    departamento: '',
    observaciones: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await makeRequest(`/saas/empleados/${id}`);
        if (res?.data) {
          setForm({
            nombres: res.data.nombres || '',
            apellidos: res.data.apellidos || '',
            email: res.data.email || '',
            telefono: res.data.telefono || '',
            usuario: res.data.usuario || '',
            rol_id: res.data.rol_id || '',
            estado: res.data.estado || 'activo',
            tipo_vinculacion: res.data.tipo_vinculacion || 'empleado',
            salario: res.data.salario || '',
            fecha_ingreso: res.data.fecha_ingreso || '',
            cargo: res.data.cargo || '',
            departamento: res.data.departamento || '',
            observaciones: res.data.observaciones || '',
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar empleado');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const onChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const onPasswordChange = (field: string, value: string | boolean) => setPasswordForm(prev => ({ ...prev, [field]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateEmpleado(Number(id), form as any);
      navigate('/apps/saas/empleados');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar empleado');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPasswordLoading(true);
      setPasswordError(null);
      await cambiarPasswordEmpleado(Number(id), passwordForm);
      setPasswordDialogOpen(false);
      setPasswordForm({
        password: '',
        password_confirmation: '',
        requiere_cambio_password: false,
      });
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Error al cambiar contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGenerarPasswordTemporal = async () => {
    try {
      setPasswordLoading(true);
      const result = await generarPasswordTemporal(Number(id));
      if (result.success && result.password) {
        alert(`Nueva contraseña temporal: ${result.password}\n\nEl empleado deberá cambiarla en el próximo inicio de sesión.`);
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Error al generar contraseña temporal');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm('¿Está seguro de resetear la contraseña? Se generará una nueva contraseña aleatoria.')) {
      return;
    }
    try {
      setPasswordLoading(true);
      const result = await resetPasswordEmpleado(Number(id));
      if (result.success && result.nueva_password) {
        alert(`Nueva contraseña: ${result.nueva_password}\n\nEl empleado deberá cambiarla en el próximo inicio de sesión.`);
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Error al resetear contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando empleado...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Empleado</h1>
          <p className="text-gray-600">Actualiza la información del empleado</p>
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

      <Tabs defaultValue="informacion" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="informacion">Información General</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombres</Label>
                    <Input value={form.nombres} onChange={(e) => onChange('nombres', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Apellidos</Label>
                    <Input value={form.apellidos} onChange={(e) => onChange('apellidos', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => onChange('email', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Usuario</Label>
                    <Input value={form.usuario} onChange={(e) => onChange('usuario', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={form.telefono} onChange={(e) => onChange('telefono', e.target.value)} />
                  </div>
                  <div>
                    <Label>Cargo</Label>
                    <Input value={form.cargo} onChange={(e) => onChange('cargo', e.target.value)} />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Input value={form.departamento} onChange={(e) => onChange('departamento', e.target.value)} />
                  </div>
                  <div>
                    <Label>Fecha de Ingreso</Label>
                    <Input type="date" value={form.fecha_ingreso} onChange={(e) => onChange('fecha_ingreso', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Datos Laborales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Rol</Label>
                    <Input value={form.rol_id} onChange={(e) => onChange('rol_id', e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo de Vinculación</Label>
                    <Select value={form.tipo_vinculacion} onValueChange={(v) => onChange('tipo_vinculacion', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empleado">Empleado</SelectItem>
                        <SelectItem value="contratista">Contratista</SelectItem>
                        <SelectItem value="practicante">Practicante</SelectItem>
                        <SelectItem value="temporal">Temporal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Select value={form.estado} onValueChange={(v) => onChange('estado', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        <SelectItem value="suspendido">Suspendido</SelectItem>
                        <SelectItem value="retirado">Retirado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Salario</Label>
                    <Input type="number" value={form.salario} onChange={(e) => onChange('salario', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Observaciones</Label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows={3}
                    value={form.observaciones}
                    onChange={(e) => onChange('observaciones', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/apps/saas/empleados')}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Contraseña</CardTitle>
              <p className="text-sm text-gray-600">Administra la contraseña del empleado</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-red-700">{passwordError}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <IconifyIcon icon="solar:lock-password-bold" className="w-4 h-4 mr-2" />
                      Cambiar Contraseña
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cambiar Contraseña</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCambiarPassword} className="space-y-4">
                      <div>
                        <Label>Nueva Contraseña</Label>
                        <Input
                          type="password"
                          value={passwordForm.password}
                          onChange={(e) => onPasswordChange('password', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>Confirmar Contraseña</Label>
                        <Input
                          type="password"
                          value={passwordForm.password_confirmation}
                          onChange={(e) => onPasswordChange('password_confirmation', e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="requiere_cambio"
                          checked={passwordForm.requiere_cambio_password}
                          onChange={(e) => onPasswordChange('requiere_cambio_password', e.target.checked)}
                        />
                        <Label htmlFor="requiere_cambio">Requerir cambio en próximo login</Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={passwordLoading}>
                          {passwordLoading ? 'Cambiando...' : 'Cambiar Contraseña'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  onClick={handleGenerarPasswordTemporal}
                  disabled={passwordLoading}
                  className="w-full"
                >
                  <IconifyIcon icon="solar:key-bold" className="w-4 h-4 mr-2" />
                  {passwordLoading ? 'Generando...' : 'Contraseña Temporal'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={passwordLoading}
                  className="w-full"
                >
                  <IconifyIcon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
                  {passwordLoading ? 'Reseteando...' : 'Resetear Contraseña'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditarEmpleado;



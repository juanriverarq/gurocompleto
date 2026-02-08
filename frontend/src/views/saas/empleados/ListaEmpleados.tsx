import React, { useEffect, useState } from 'react';
import { useEmpleadosBroker } from 'src/hooks/useAdminCrudApi';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Card, CardContent } from 'src/components/shadcn-ui/Default-Ui/card';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from 'src/components/shadcn-ui/Default-Ui/dialog';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Icon as IconifyIcon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';

const ListaEmpleados: React.FC = () => {
  const navigate = useNavigate();
  const {
    empleados,
    loading,
    error,
    deleteEmpleado,
    refreshEmpleados,
    generarPasswordTemporal,
    cambiarPasswordEmpleado,
  } = useEmpleadosBroker();

  // Estado para cambio de contraseña rápido desde la lista
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [pwdForm, setPwdForm] = useState({
    password: '',
    password_confirmation: '',
    requiere_cambio_password: false,
  });

  const openPwdDialogFor = (id: number) => {
    setSelectedEmpId(id);
    setPwdForm({ password: '', password_confirmation: '', requiere_cambio_password: false });
    setPwdError(null);
    setPwdDialogOpen(true);
  };

  const onPwdFormChange = (field: 'password' | 'password_confirmation' | 'requiere_cambio_password', value: string | boolean) => {
    setPwdForm(prev => ({ ...prev, [field]: value as any }));
  };

  const submitCambioPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    try {
      setPwdLoading(true);
      setPwdError(null);
      const ok = await cambiarPasswordEmpleado(selectedEmpId, pwdForm);
      if (ok) {
        setPwdDialogOpen(false);
        setPwdForm({ password: '', password_confirmation: '', requiere_cambio_password: false });
        alert('Contraseña actualizada correctamente');
      } else {
        setPwdError('No se pudo actualizar la contraseña');
      }
    } catch (err: any) {
      setPwdError(err?.message || 'Error al cambiar contraseña');
    } finally {
      setPwdLoading(false);
    }
  };

  const generarPassword = async (id: number) => {
    const res = await generarPasswordTemporal(id);
    if (res.success && res.password) {
      alert(`Contraseña temporal: ${res.password}\n\nEl empleado deberá cambiarla al próximo ingreso.`);
    } else {
      alert(res.message || 'Error al generar contraseña temporal');
    }
  };

  useEffect(() => {
    // Asegurar carga inicial
    refreshEmpleados();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-600">Gestión de empleados del broker</p>
        </div>
        <HeroButton icon="solar:user-plus-bold" onClick={() => navigate('/apps/saas/empleados/nuevo')}>Nuevo Empleado</HeroButton>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Cargando empleados...</span>
                      </div>
                    </td>
                  </tr>
                ) : empleados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <IconifyIcon icon="solar:user-hands-bold-duotone" className="w-16 h-16 text-gray-300" />
                        <p className="text-gray-500 text-lg font-medium">No hay empleados registrados</p>
                        <HeroButton icon="solar:user-plus-bold" onClick={() => navigate('/apps/saas/empleados/nuevo')} size="lg">Crear primer empleado</HeroButton>
                      </div>
                    </td>
                  </tr>
                ) : (
                  empleados.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{emp.nombres} {emp.apellidos}</div>
                        <div className="text-xs text-gray-400">ID: {emp.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.rol?.nombre || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.estado}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => navigate(`/apps/saas/empleados/${emp.id}/editar`)}>
                            <IconifyIcon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" onClick={() => openPwdDialogFor(Number(emp.id))} title="Cambiar contraseña">
                            <IconifyIcon icon="solar:lock-password-bold" className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" onClick={() => generarPassword(Number(emp.id))} title="Generar contraseña temporal">
                            <IconifyIcon icon="solar:key-minimalistic-2-bold" className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" onClick={async () => { if (confirm('¿Eliminar empleado?')) await deleteEmpleado(Number(emp.id)); }} title="Eliminar empleado">
                            <IconifyIcon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Diálogo global de cambio de contraseña */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña de empleado</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCambioPassword} className="space-y-4">
            {pwdError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {pwdError}
              </div>
            )}
            <div>
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={pwdForm.password}
                onChange={(e) => onPwdFormChange('password', e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Confirmar contraseña</Label>
              <Input
                type="password"
                value={pwdForm.password_confirmation}
                onChange={(e) => onPwdFormChange('password_confirmation', e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="requiere_cambio_list"
                type="checkbox"
                checked={pwdForm.requiere_cambio_password}
                onChange={(e) => onPwdFormChange('requiere_cambio_password', e.target.checked)}
              />
              <Label htmlFor="requiere_cambio_list">Requerir cambio en próximo login</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPwdDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pwdLoading}>
                {pwdLoading ? 'Cambiando...' : 'Cambiar Contraseña'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListaEmpleados;



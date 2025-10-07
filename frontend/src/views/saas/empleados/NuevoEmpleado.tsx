import React, { useState } from 'react';
import { useEmpleadosBroker, useAuthenticatedAdminRequest } from 'src/hooks/useAdminCrudApi';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { useNavigate } from 'react-router-dom';
import { Icon as IconifyIcon } from '@iconify/react';

const NuevoEmpleado: React.FC = () => {
  const navigate = useNavigate();
  const { createEmpleado } = useEmpleadosBroker();
  const { makeRequest } = useAuthenticatedAdminRequest();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    rol: 'asesor',
    estado: 'ACTIVO',
  });

  const onChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const ok = await createEmpleado({ ...form } as any);
      if (ok) {
        // Generar contraseña temporal y mostrarla
        try {
          const res = await makeRequest('/empleado-auth/generar-password-temporal', {
            method: 'POST',
            body: JSON.stringify({ usuario: form.email })
          });
          alert(`Empleado creado. Contraseña temporal: ${res.password}`);
        } catch {}
        navigate('/apps/saas/empleados');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear empleado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Empleado</h1>
          <p className="text-gray-600">Crea un nuevo empleado dentro del broker</p>
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
            <CardTitle>Datos del empleado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input value={form.nombre} onChange={(e) => onChange('nombre', e.target.value)} required />
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
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => onChange('telefono', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/apps/saas/empleados')}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear Empleado'}</Button>
        </div>
      </form>
    </div>
  );
};

export default NuevoEmpleado;



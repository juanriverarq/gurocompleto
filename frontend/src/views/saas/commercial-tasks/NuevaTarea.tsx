import React, { useEffect, useState } from 'react';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Textarea } from 'src/components/shadcn-ui/Default-Ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { useNavigate } from 'react-router-dom';
import { commercialTasksService, TASK_TYPES, TASK_PRIORITIES } from 'src/services/commercialTasksService';

const NuevaTarea: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    title: '',
    description: '',
    type: 'seguimiento_cliente',
    priority: 'media',
    client_id: undefined,
    assigned_to: undefined,
    due_date: '',
    has_reminder: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const [u, c] = await Promise.all([
          commercialTasksService.getUsers(),
          commercialTasksService.getClients(),
        ]);
        setUsers(u);
        setClients(c);
      } catch {}
    })();
  }, []);

  const onChange = (field: string, value: any) => setForm((p: any) => ({ ...p, [field]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const task = await commercialTasksService.createTask(form);
      navigate(`/apps/saas/commercial-tasks/${task.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Tarea</h1>
        <p className="text-gray-600">Crea una nueva actividad comercial</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4"><span className="text-red-700">{error}</span></div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la tarea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => onChange('title', e.target.value)} required />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => onChange('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => onChange('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={String(form.client_id ?? 'NONE')} onValueChange={(v) => onChange('client_id', v === 'NONE' ? undefined : Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Ninguno</SelectItem>
                    {clients.map(c => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Asignado a</Label>
                <Select value={String(form.assigned_to ?? 'NONE')} onValueChange={(v) => onChange('assigned_to', v === 'NONE' ? undefined : Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin asignar</SelectItem>
                    {users.map(u => (<SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha vencimiento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => onChange('due_date', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => onChange('description', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/apps/saas/commercial-tasks')}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear Tarea'}</Button>
        </div>
      </form>
    </div>
  );
};

export default NuevaTarea;



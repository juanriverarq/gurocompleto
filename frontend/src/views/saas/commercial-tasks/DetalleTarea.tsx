import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Card, CardContent } from 'src/components/shadcn-ui/Default-Ui/card';
import { Icon as IconifyIcon } from '@iconify/react';
import { commercialTasksService, TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES } from 'src/services/commercialTasksService';

const DetalleTarea: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const t = await commercialTasksService.getTask(Number(id));
        setTask(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar tarea');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando tarea...</span>
      </div>
    );
  }

  if (!task || error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error || 'Tarea no encontrada'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
          <p className="text-gray-600">Tipo: {TASK_TYPES[task.type as keyof typeof TASK_TYPES]} | Prioridad: {TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES]}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/apps/saas/commercial-tasks')}>Volver</Button>
          <Button onClick={() => navigate(`/apps/saas/commercial-tasks/${task.id}/editar`)}>Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Detalles</h3>
            <div className="text-sm text-gray-700">Estado: {TASK_STATUSES[task.status as keyof typeof TASK_STATUSES]}</div>
            <div className="text-sm text-gray-700">Vence: {commercialTasksService.formatDate(task.due_date)}</div>
            <div className="text-sm text-gray-700">Asignado a: {task.assigned_user?.name || '-'}</div>
            <div className="text-sm text-gray-700">Cliente: {task.client?.name || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Descripción</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{task.description || '-'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetalleTarea;



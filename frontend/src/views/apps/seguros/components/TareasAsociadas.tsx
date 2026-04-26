import React, { useState, useEffect, useCallback } from 'react';
import {
  seguimientoService,
  SeguimientoItem,
  CreateSeguimientoData,
  PriorityConfig,
  getPriorityStyle,
} from 'src/services/seguimientoService';
import { Button, Badge, Spinner, Card, Table } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useToast } from 'src/hooks/use-toast';

interface TareasAsociadasProps {
  clientId?: number | string;
  polizaId?: number | string;
  clientName?: string;
  polizaNumber?: string;
}

const TIPOS_LABEL: Record<string, string> = {
  seguimiento_cliente: 'Seguimiento Cliente',
  documentacion: 'Documentación',
  inspeccion: 'Inspección',
  renovacion: 'Renovación',
  siniestro: 'Siniestro',
  cotizacion: 'Cotización',
  llamada: 'Llamada',
  reunion: 'Reunión',
  email: 'Email',
  visita: 'Visita',
};

const ESTADOS_LABEL: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'yellow' },
  en_progreso: { label: 'En Progreso', color: 'blue' },
  completada: { label: 'Completada', color: 'green' },
  vencida: { label: 'Vencida', color: 'red' },
  cancelada: { label: 'Cancelada', color: 'gray' },
  pausada: { label: 'Pausada', color: 'purple' },
};

const TareasAsociadas: React.FC<TareasAsociadasProps> = ({
  clientId,
  polizaId,
  clientName,
  polizaNumber,
}) => {
  const { toast } = useToast();
  const [tareas, setTareas] = useState<SeguimientoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [priorityConfigs, setPriorityConfigs] = useState<Record<string, PriorityConfig>>({});

  const [formData, setFormData] = useState<CreateSeguimientoData>({
    title: '',
    description: '',
    type: 'seguimiento_cliente',
    priority: 'media',
    scheduled_for: '',
    due_date: '',
    client_id: clientId ? Number(clientId) : undefined,
    poliza_id: polizaId ? Number(polizaId) : undefined,
  });

  const loadTareas = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (clientId) filters.client_id = Number(clientId);
      if (polizaId) filters.poliza_id = Number(polizaId);

      const res = await seguimientoService.getSeguimientos(filters);
      setTareas(res.data || []);
    } catch (e: any) {
      console.error('Error cargando tareas:', e);
    } finally {
      setLoading(false);
    }
  }, [clientId, polizaId]);

  useEffect(() => {
    loadTareas();
  }, [loadTareas]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      client_id: clientId ? Number(clientId) : undefined,
      poliza_id: polizaId ? Number(polizaId) : undefined,
    }));
  }, [clientId, polizaId]);

  const handleCreate = async () => {
    if (!formData.title?.trim()) {
      toast({ title: 'Título requerido', variant: 'destructive' });
      return;
    }
    if (!formData.description?.trim()) {
      toast({ title: 'Descripción requerida', variant: 'destructive' });
      return;
    }
    try {
      setCreating(true);
      const dataToSend: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          dataToSend[key] = value;
        }
      });
      await seguimientoService.createSeguimiento(dataToSend);
      toast({ title: 'Tarea creada exitosamente' });
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        type: 'seguimiento_cliente',
        priority: 'media',
        scheduled_for: '',
        due_date: '',
        client_id: clientId ? Number(clientId) : undefined,
        poliza_id: polizaId ? Number(polizaId) : undefined,
      });
      await loadTareas();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await seguimientoService.deleteSeguimiento(id);
      toast({ title: 'Tarea eliminada' });
      await loadTareas();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfigs[priority];
    const fallback = {
      baja: { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'solar:flag-bold-duotone', label: 'Baja' },
      media: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'solar:flag-2-bold-duotone', label: 'Media' },
      alta: { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'solar:shield-warning-bold-duotone', label: 'Alta' },
      critica: { bg: 'bg-red-100', text: 'text-red-800', icon: 'solar:danger-triangle-bold-duotone', label: 'Crítica' },
    };
    const style = getPriorityStyle(config, fallback[priority as keyof typeof fallback] || fallback.baja);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon icon={style.icon} className="w-3 h-3" />
        {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tareas de Seguimiento
          </h3>
          <p className="text-sm text-gray-500">
            {clientName && `Cliente: ${clientName}`}
            {clientName && polizaNumber && ' · '}
            {polizaNumber && `Póliza: ${polizaNumber}`}
          </p>
        </div>
        <Button size="sm" color="primary" onClick={() => setShowForm(!showForm)}>
          <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-1" />
          {showForm ? 'Cancelar' : 'Nueva Tarea'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="Título de la tarea"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as any }))}
              >
                {Object.entries(TIPOS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                value={formData.priority}
                onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value as any }))}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Programada</label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                value={formData.scheduled_for || ''}
                onChange={(e) => setFormData((p) => ({ ...p, scheduled_for: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Máxima (Límite)</label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                value={formData.due_date || ''}
                onChange={(e) => setFormData((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe la tarea..."
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" color="primary" onClick={handleCreate} disabled={creating}>
              {creating ? <Spinner size="sm" className="mr-1" /> : <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-1" />}
              Crear Tarea
            </Button>
            <Button size="sm" color="gray" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : tareas.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Icon icon="solar:clipboard-remove-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No hay tareas de seguimiento asociadas</p>
          <p className="text-xs">Crea una nueva tarea para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Título</Table.HeadCell>
              <Table.HeadCell>Tipo</Table.HeadCell>
              <Table.HeadCell>Prioridad</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Fecha Programada</Table.HeadCell>
              <Table.HeadCell>Fecha Máxima</Table.HeadCell>
              <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {tareas.map((t) => {
                const estado = ESTADOS_LABEL[t.status] || { label: t.status, color: 'gray' };
                const scheduled = t.scheduled_for ? new Date(t.scheduled_for).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                const due = t.due_date ? new Date(t.due_date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completada' && t.status !== 'cancelada';
                return (
                  <Table.Row key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Table.Cell className="font-medium text-sm">{t.title}</Table.Cell>
                    <Table.Cell className="text-sm capitalize">{TIPOS_LABEL[t.type] || t.type}</Table.Cell>
                    <Table.Cell>{getPriorityBadge(t.priority)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={estado.color as any} className="text-xs">{estado.label}</Badge>
                    </Table.Cell>
                    <Table.Cell className="text-sm">{scheduled}</Table.Cell>
                    <Table.Cell className={`text-sm font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                      {isOverdue && <Icon icon="solar:alarm-bold-duotone" className="w-3.5 h-3.5 inline mr-1 text-red-500" />}
                      {due}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="xs"
                        color="light"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TareasAsociadas;

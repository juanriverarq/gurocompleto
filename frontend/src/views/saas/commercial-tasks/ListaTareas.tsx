import React, { useEffect, useState } from 'react';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Card, CardContent } from 'src/components/shadcn-ui/Default-Ui/card';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { useNavigate } from 'react-router-dom';
import { Icon as IconifyIcon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';
import { commercialTasksService, TASK_TYPES, TASK_STATUSES, TASK_PRIORITIES } from 'src/services/commercialTasksService';

const ListaTareas: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<any>({ search: '', type: '', status: '', priority: '', per_page: 10, page: 1 });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await commercialTasksService.getTasks(filters);
        setTasks(res.data);
        setCurrentPage(res.current_page);
        setTotalPages(res.last_page);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar tareas');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  const handleFilter = (key: string, value: string) => {
    const normalized = value === 'ALL' ? '' : value;
    setFilters((prev: any) => ({ ...prev, [key]: normalized, page: 1 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas Comerciales</h1>
          <p className="text-gray-600">Planifica y gestiona tus actividades</p>
        </div>
        <HeroButton icon="solar:add-circle-bold" onClick={() => navigate('/apps/saas/commercial-tasks/nueva')}>Nueva Tarea</HeroButton>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <IconifyIcon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input value={filters.search} onChange={(e) => handleFilter('search', e.target.value)} placeholder="Buscar..." className="pl-10" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Tipo</Label>
              <Select value={filters.type || 'ALL'} onValueChange={(v) => handleFilter('type', v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(TASK_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Estado</Label>
              <Select value={filters.status || 'ALL'} onValueChange={(v) => handleFilter('status', v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(TASK_STATUSES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Prioridad</Label>
              <Select value={filters.priority || 'ALL'} onValueChange={(v) => handleFilter('priority', v)}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {Object.entries(TASK_PRIORITIES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <span className="ml-2">Cargando tareas...</span>
                      </div>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <IconifyIcon icon="solar:clipboard-check-bold-duotone" className="w-16 h-16 text-gray-300" />
                        <p className="text-gray-500 text-lg font-medium">No hay tareas</p>
                        <HeroButton icon="solar:add-circle-bold" onClick={() => navigate('/apps/saas/commercial-tasks/nueva')} size="lg">Crear primera tarea</HeroButton>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        <div className="text-xs text-gray-400">#{task.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{TASK_TYPES[task.type as keyof typeof TASK_TYPES]}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES]}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{commercialTasksService.formatDate(task.due_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <TableActionMenu>
                          <TableMenuItem onClick={() => navigate(`/apps/saas/commercial-tasks/${task.id}`)}>
                            <IconifyIcon icon="solar:eye-bold" height={18} />
                            <span>Ver Detalles</span>
                          </TableMenuItem>
                          <TableMenuItem onClick={() => navigate(`/apps/saas/commercial-tasks/${task.id}/editar`)}>
                            <IconifyIcon icon="solar:pen-new-square-bold-duotone" height={18} />
                            <span>Editar</span>
                          </TableMenuItem>
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">Mostrando {((currentPage - 1) * (filters.per_page || 10)) + 1} a {Math.min(currentPage * (filters.per_page || 10), total)} de {total} tareas</div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={currentPage === 1} onClick={() => setFilters((p:any) => ({ ...p, page: (p.page || 1) - 1 }))}>Anterior</Button>
            <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setFilters((p:any) => ({ ...p, page: (p.page || 1) + 1 }))}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaTareas;



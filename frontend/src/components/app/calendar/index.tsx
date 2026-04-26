

import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from "moment";
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { TbCheck } from "react-icons/tb";
import { Icon as IconifyIcon } from '@iconify/react';

import {
  Button,
  Datepicker,
  Label,
  Modal,
  TextInput,
  Spinner,
  Alert,
  Checkbox,
  Select,
} from "flowbite-react";
import CardBox from "../../shared/CardBox";
import React from 'react';
import renovacionesService from 'src/services/renovacionesService';
import { commercialTasksService } from 'src/services/commercialTasksService';
import calendarService from 'src/services/calendarService';
import notificationService from 'src/services/notificationService';
import trackingService from 'src/services/trackingService';
import { clienteService } from 'src/services/clienteService';
import { polizaService } from 'src/services/polizaService';
import salesTeamsService from 'src/services/salesTeamsService';

import { useNavigate } from 'react-router-dom';

moment.locale("es");
const localizer = momentLocalizer(moment);

type EvType = {
  title: string;
  allDay?: boolean;
  start?: Date;
  end?: Date;
  color?: string;
};


const CalendarApp = () => {
  const navigate = useNavigate();
  const [calevents, setCalEvents] = React.useState<any>([]);
  const [filteredEvents, setFilteredEvents] = React.useState<any>([]);
  // Menú contextual de acciones (state-driven, no DOM injection)
  const [actionMenu, setActionMenu] = React.useState<{
    event: any;
    actions: Array<{ id: string; label: string; icon: string; color: string }>;
    x: number;
    y: number;
  } | null>(null);
  // Última posición conocida del mouse (react-big-calendar no propaga MouseEvent en onSelectEvent)
  const lastMousePosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  React.useEffect(() => {
    const track = (e: MouseEvent) => { lastMousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('mousemove', track);
    document.addEventListener('mousedown', track, true);
    return () => {
      document.removeEventListener('mousemove', track);
      document.removeEventListener('mousedown', track, true);
    };
  }, []);
  // Cerrar menú al click fuera o ESC
  React.useEffect(() => {
    if (!actionMenu) return;
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById('calendar-action-menu');
      if (el && !el.contains(e.target as Node)) setActionMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActionMenu(null); };
    setTimeout(() => document.addEventListener('mousedown', onDown), 50);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [actionMenu]);
  const [open, setOpen] = React.useState<boolean>(false);
  const [title, setTitle] = React.useState<string>("");
  const [slot, setSlot] = React.useState<EvType>();
  const [start, setStart] = React.useState<any | null>();
  const [end, setEnd] = React.useState<any | null>();
  const [color, setColor] = React.useState<string>("primary");
  const [update, setUpdate] = React.useState<EvType | undefined | any>();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [eventStats, setEventStats] = React.useState<{
    renovaciones: number;
    tareas: number;
    manuales: number;
  }>({ renovaciones: 0, tareas: 0, manuales: 0 });

  // Filtros del calendario
  const [priorityFilter, setPriorityFilter] = React.useState<string>('todas');
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>('todos');
  const [statusFilter, setStatusFilter] = React.useState<string>('todos');
  const [dateRangeFilter, setDateRangeFilter] = React.useState<string>('todos');
  const [taskTypeFilter, setTaskTypeFilter] = React.useState<string>('todos');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showFilters, setShowFilters] = React.useState<boolean>(false);

  // Estado para configuración de notificaciones
  const [showNotificationsModal, setShowNotificationsModal] = React.useState<boolean>(false);
  const [notificationSettings, setNotificationSettings] = React.useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = React.useState<boolean>(false);

  // Estado para dashboard de procesos
  const [showDashboardModal, setShowDashboardModal] = React.useState<boolean>(false);
  const [processStats, setProcessStats] = React.useState<any>({
    by_company: {},
    by_client: {},
    by_ramo: {},
    by_category: {},
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
  });
  const [loadingDashboard, setLoadingDashboard] = React.useState<boolean>(false);

  // Estado para trazabilidad y bitácora
  const [showTrackingModal, setShowTrackingModal] = React.useState<boolean>(false);
  const [selectedEventForTracking, setSelectedEventForTracking] = React.useState<any>(null);
  const [trackingHistory, setTrackingHistory] = React.useState<any[]>([]);
  const [taskNotes, setTaskNotes] = React.useState<any[]>([]);
  const [newNote, setNewNote] = React.useState<string>('');
  const [isPrivateNote, setIsPrivateNote] = React.useState<boolean>(false);
  const [loadingTracking, setLoadingTracking] = React.useState<boolean>(false);

  // Estado para reasignación de tareas
  const [showReassignModal, setShowReassignModal] = React.useState<boolean>(false);
  const [selectedEventForReassign, setSelectedEventForReassign] = React.useState<any>(null);
  const [availableUsers, setAvailableUsers] = React.useState<any[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<string>('');
  const [reassignReason, setReassignReason] = React.useState<string>('');
  const [loadingReassign, setLoadingReassign] = React.useState<boolean>(false);

  // Estado para modal de creación de tareas generales
  const [showTaskModal, setShowTaskModal] = React.useState<boolean>(false);
  const [taskSlot, setTaskSlot] = React.useState<EvType>();
  const [taskStart, setTaskStart] = React.useState<any | null>();
  const [taskEnd, setTaskEnd] = React.useState<any | null>();

  // Estado para modal de detalle de tarea comercial
  const [showTaskDetailModal, setShowTaskDetailModal] = React.useState<boolean>(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = React.useState<any>(null);
  const [taskTitle, setTaskTitle] = React.useState<string>("");
  const [taskDescription, setTaskDescription] = React.useState<string>("");
  const [taskPriority, setTaskPriority] = React.useState<string>("media");
  const [taskType, setTaskType] = React.useState<string>("seguimiento_cliente");
  const [taskAssignedUser, setTaskAssignedUser] = React.useState<string>("");
  const [loadingTask, setLoadingTask] = React.useState<boolean>(false);

  // Estado para clientes y pólizas
  const [clients, setClients] = React.useState<any>({ data: [] });
  const [selectedClient, setSelectedClient] = React.useState<string>("");
  const [clientPolizas, setClientPolizas] = React.useState<any[]>([]);
  const [selectedPoliza, setSelectedPoliza] = React.useState<string>("");
  const [loadingClients, setLoadingClients] = React.useState<boolean>(false);
  const [loadingPolizas, setLoadingPolizas] = React.useState<boolean>(false);

  // Estado para usuarios y vendedores
  const [systemUsers, setSystemUsers] = React.useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState<boolean>(false);

  const ColorVariation = [
    {
      id: 1,
      eColor: "primary",
      value: "primary",
    },
    {
      id: 2,
      eColor: "success",
      value: "green",
    },
    {
      id: 3,
      eColor: "error",
      value: "red",
    },
    {
      id: 4,
      eColor: "secondary",
      value: "default",
    },
    {
      id: 5,
      eColor: "warning",
      value: "warning",
    },
  ];

  // Función reutilizable para cargar todos los eventos
  const loadCalendarEvents = React.useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        // Cargar eventos base (array vacío al inicio)
        const baseEvents: any[] = [];
        
        // Cargar eventos manuales del backend
        try {
          console.log('[CALENDARIO] Cargando eventos manuales...');
          const manualEvents = await calendarService.getEvents();
          
          console.log('[CALENDARIO] Eventos manuales recibidos:', manualEvents);
          
          if (manualEvents && manualEvents.length > 0) {
            const manualEventsList = manualEvents.map((event) => ({
              title: event.title,
              start: new Date(event.start_date),
              end: new Date(event.end_date),
              allDay: event.all_day || false,
              color: event.color || 'primary',
              eventType: 'manual',
              eventId: `manual-${event.id}`,
              eventData: event,
              icon: 'solar:calendar-bold-duotone', // Icono del sistema
            }));
            
            console.log(`[CALENDARIO] ${manualEventsList.length} eventos manuales agregados`);
            baseEvents.push(...manualEventsList);
          } else {
            console.log('[CALENDARIO] No hay eventos manuales creados');
          }
        } catch (err) {
          console.error('[CALENDARIO] Error al cargar eventos manuales:', err);
        }

        // Cargar renovaciones próximas (solo PENDIENTES, CRITICO, EN_PROCESO - no RENOVADO ni VENCIDO)
        try {
          console.log('[RENOVACIONES] Cargando renovaciones pendientes...');
          const renovacionesData = await renovacionesService.getRenovaciones({
            estado: 'PENDIENTE,CRITICO,EN_PROCESO', // Solo renovaciones activas
            per_page: 200, // Aumentar límite
          });

          console.log('[RENOVACIONES] Datos recibidos del backend:', renovacionesData);
          console.log(`[RENOVACIONES] Total: ${renovacionesData.total || renovacionesData.data?.length || 0}`);

          if (renovacionesData.data && renovacionesData.data.length > 0) {
            const renovacionEvents = renovacionesData.data
              .filter((renovacion) => {
                // Filtrar solo renovaciones con fecha válida y que no estén renovadas
                if (!renovacion.fechaVencimiento) {
                  console.warn('[RENOVACIONES] Renovación sin fecha:', renovacion);
                  return false;
                }
                if (renovacion.estado === 'RENOVADO') {
                  console.log(`[RENOVACIONES] Renovación ya procesada (ignorada): ${renovacion.cliente}`);
                  return false;
                }
                return true;
              })
              .map((renovacion) => {
                // Asegurarse de que la fecha sea válida
                const fechaStr = renovacion.fechaVencimiento;
                let fechaVencimiento: Date;
                
                // Manejar diferentes formatos de fecha
                if (fechaStr.includes('T')) {
                  // Formato ISO
                  fechaVencimiento = new Date(fechaStr);
                } else if (fechaStr.includes('-')) {
                  // Formato YYYY-MM-DD
                  const [year, month, day] = fechaStr.split('-').map(Number);
                  fechaVencimiento = new Date(year, month - 1, day);
                } else {
                  fechaVencimiento = new Date(fechaStr);
                }
                
                const fechaLocal = fechaVencimiento.toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                });
                
                console.log(`[RENOVACIONES] ${renovacion.cliente} - Póliza: ${renovacion.numeroPoliza} - Vence: ${fechaLocal} (${renovacion.diasVencimiento} días)`);
                
                // Determinar color según prioridad y días de vencimiento
                let colorEvento = 'green'; // Default
                if (renovacion.prioridad === 'CRITICA' || renovacion.diasVencimiento <= 7) {
                  colorEvento = 'red';
                } else if (renovacion.prioridad === 'ALTA' || renovacion.diasVencimiento <= 15) {
                  colorEvento = 'warning';
                } else if (renovacion.diasVencimiento <= 30) {
                  colorEvento = 'primary';
                }
                
                // Crear título descriptivo
                const diasTexto = renovacion.diasVencimiento === 0 ? 'HOY' : 
                                 renovacion.diasVencimiento === 1 ? 'MAÑANA' :
                                 `${renovacion.diasVencimiento} días`;
                
                // Asegurarse de usar el mismo formato que Events
                const evento = {
                  title: `Renovación: ${renovacion.cliente} - ${renovacion.numeroPoliza} (${diasTexto})`,
                  start: fechaVencimiento,
                  end: fechaVencimiento,
                  allDay: true,
                  color: colorEvento,
                  // Propiedades adicionales para identificación
                  eventType: 'renovacion',
                  eventId: `renovacion-${renovacion.id}`,
                  eventData: renovacion,
                  icon: 'solar:refresh-bold-duotone', // Icono del sistema
                };
                
                return evento;
              });

            console.log(`[RENOVACIONES] ${renovacionEvents.length} renovaciones agregadas al calendario`);
            renovacionEvents.forEach((evento, idx) => {
              if (idx < 3) { // Mostrar las primeras 3
                console.log(`  - ${evento.title}`);
              }
            });
            if (renovacionEvents.length > 3) {
              console.log(`  ... y ${renovacionEvents.length - 3} más`);
            }
            baseEvents.push(...renovacionEvents);
          } else {
            console.log('[RENOVACIONES] No hay renovaciones pendientes');
          }
        } catch (err) {
          console.error('[RENOVACIONES] Error al cargar:', err);
          if (err instanceof Error) {
            console.error('[RENOVACIONES] Mensaje de error:', err.message);
          }
        }

        // Cargar tareas de seguimiento comercial programadas
        try {
          console.log('[TAREAS] Cargando tareas de seguimiento comercial...');
          const tasksData = await commercialTasksService.getTasks({
            status: 'pendiente,en_progreso', // Solo tareas activas
            per_page: 200,
          });

          console.log('[TAREAS] Datos recibidos del backend:', tasksData);
          console.log(`[TAREAS] Total: ${tasksData.total || tasksData.data?.length || 0}`);

          if (tasksData.data && tasksData.data.length > 0) {
            const taskEvents = tasksData.data
              .filter((task) => {
                // Filtrar tareas con fecha programada o fecha límite
                if (!task.scheduled_for && !task.due_date) {
                  console.warn('[TAREAS] Tarea sin fecha programada:', task.title);
                  return false;
                }
                // Solo incluir tareas pendientes o en progreso
                if (task.status === 'completada' || task.status === 'cancelada') {
                  console.log(`[TAREAS] Tarea completada/cancelada (ignorada): ${task.title}`);
                  return false;
                }
                return true;
              })
              .map((task) => {
                // Preferir scheduled_for (fecha/hora específica) sobre due_date (solo fecha límite)
                const taskDate = task.scheduled_for || task.due_date;
                const taskDateObj = new Date(taskDate!);
                
                const fechaLocal = taskDateObj.toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  ...(task.scheduled_for && { hour: '2-digit', minute: '2-digit' })
                });
                
                console.log(`[TAREAS] ${task.title} - Tipo: ${task.type} - Fecha: ${fechaLocal} - Prioridad: ${task.priority}`);
                
                // Determinar color según prioridad
                let colorEvento = 'primary'; // Default azul
                if (task.priority === 'critica') {
                  colorEvento = 'red';
                } else if (task.priority === 'alta') {
                  colorEvento = 'warning';
                } else if (task.priority === 'media') {
                  colorEvento = 'primary';
                } else {
                  colorEvento = 'green'; // Baja
                }
                
                // Icono según tipo de tarea
                const iconoMap: Record<string, string> = {
                  'seguimiento_cliente': 'solar:user-check-bold-duotone',
                  'documentacion': 'solar:document-text-bold-duotone',
                  'inspeccion': 'solar:eye-scan-bold-duotone',
                  'renovacion': 'solar:refresh-bold-duotone',
                  'siniestro': 'solar:danger-triangle-bold-duotone',
                  'cotizacion': 'solar:calculator-bold-duotone',
                  'llamada': 'solar:phone-bold-duotone',
                  'reunion': 'solar:users-group-rounded-bold-duotone',
                  'email': 'solar:letter-bold-duotone',
                  'visita': 'solar:map-point-bold-duotone',
                };
                const icono = iconoMap[task.type] || 'solar:checklist-minimalistic-bold-duotone';
                
                // Crear título descriptivo con hora si existe
                let titulo = task.title;
                if (task.scheduled_for) {
                  const hora = taskDateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  titulo = `${hora} - ${task.title}`;
                }
                
                return {
                  title: titulo,
                  start: taskDateObj,
                  end: taskDateObj,
                  allDay: !task.scheduled_for, // Si tiene hora programada, no es todo el día
                  color: colorEvento,
                  eventType: 'task',
                  eventId: `task-${task.id}`,
                  eventData: task,
                  icon: icono, // Icono del sistema
                };
              });

            console.log(`[TAREAS] ${taskEvents.length} tareas agregadas al calendario`);
            taskEvents.forEach((evento, idx) => {
              if (idx < 3) { // Mostrar las primeras 3
                console.log(`  - ${evento.title}`);
              }
            });
            if (taskEvents.length > 3) {
              console.log(`  ... y ${taskEvents.length - 3} más`);
            }
            baseEvents.push(...taskEvents);
          } else {
            console.log('[TAREAS] No hay tareas de seguimiento programadas');
          }
        } catch (err) {
          console.error('[TAREAS] Error al cargar:', err);
          if (err instanceof Error) {
            console.error('[TAREAS] Mensaje de error:', err.message);
          }
        }

        // Calcular estadísticas
        const stats = {
          renovaciones: baseEvents.filter((e: any) => e.eventType === 'renovacion').length,
          tareas: baseEvents.filter((e: any) => e.eventType === 'task').length,
          manuales: baseEvents.filter((e: any) => e.eventType === 'manual').length,
        };

        console.log('[CALENDARIO] Estadísticas:', stats);
        console.log('[CALENDARIO] Total de eventos:', baseEvents.length);
        
        // Verificar que las fechas sean objetos Date válidos
        const eventosInvalidos = baseEvents.filter((e: any) => {
          return !(e.start instanceof Date) || isNaN(e.start.getTime()) ||
                 !(e.end instanceof Date) || isNaN(e.end.getTime());
        });
        
        if (eventosInvalidos.length > 0) {
          console.error('⚠️ Eventos con fechas inválidas:', eventosInvalidos);
        }

        setEventStats(stats);
        setCalEvents(baseEvents);
        setFilteredEvents(baseEvents); // Inicializar eventos filtrados
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar eventos');
      } finally {
        setLoading(false);
      }
  }, []);

  // Aplicar filtros cuando cambian los eventos o los filtros
  React.useEffect(() => {
    let filtered = [...calevents];

    // 1. Tipo de evento
    if (eventTypeFilter !== 'todos') {
      filtered = filtered.filter(event => event.eventType === eventTypeFilter);
    }

    // 2. Prioridad
    if (priorityFilter !== 'todas') {
      filtered = filtered.filter(event => {
        if (event.eventType === 'task') {
          return event.eventData?.priority === priorityFilter;
        }
        if (event.eventType === 'renovacion') {
          const renovacion = event.eventData;
          if (priorityFilter === 'critica') return renovacion.prioridad === 'CRITICA';
          if (priorityFilter === 'alta') return renovacion.prioridad === 'ALTA';
          if (priorityFilter === 'media') return renovacion.prioridad === 'MEDIA';
          if (priorityFilter === 'baja') return renovacion.prioridad === 'BAJA';
        }
        return true;
      });
    }

    // 3. Estado de la tarea
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(event => {
        if (event.eventType !== 'task') return true; // No aplica para otros
        return event.eventData?.status === statusFilter;
      });
    }

    // 4. Tipo de tarea (seguimiento_cliente, llamada, reunion, etc.)
    if (taskTypeFilter !== 'todos') {
      filtered = filtered.filter(event => {
        if (event.eventType !== 'task') return true;
        return event.eventData?.type === taskTypeFilter;
      });
    }

    // 5. Rango de fechas
    if (dateRangeFilter !== 'todos') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const next7 = new Date(today);
      next7.setDate(today.getDate() + 7);
      const next30 = new Date(today);
      next30.setDate(today.getDate() + 30);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      filtered = filtered.filter(event => {
        const start = event.start instanceof Date ? event.start : new Date(event.start);
        if (!start || isNaN(start.getTime())) return false;
        switch (dateRangeFilter) {
          case 'hoy':
            return start >= today && start < tomorrow;
          case 'manana':
            const dayAfter = new Date(tomorrow); dayAfter.setDate(tomorrow.getDate() + 1);
            return start >= tomorrow && start < dayAfter;
          case 'esta_semana':
            return start >= startOfWeek && start < endOfWeek;
          case 'este_mes':
            return start >= startOfMonth && start < endOfMonth;
          case 'proximos_7':
            return start >= today && start < next7;
          case 'proximos_30':
            return start >= today && start < next30;
          case 'vencidos':
            return start < today;
          default:
            return true;
        }
      });
    }

    // 6. Búsqueda por texto en título / cliente
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      filtered = filtered.filter(event => {
        const haystack: string[] = [event.title || ''];
        if (event.eventData) {
          haystack.push(event.eventData.client?.name || '');
          haystack.push(event.eventData.cliente || '');
          haystack.push(event.eventData.numeroPoliza || '');
          haystack.push(event.eventData.description || '');
        }
        return haystack.join(' ').toLowerCase().includes(q);
      });
    }

    setFilteredEvents(filtered);
  }, [calevents, priorityFilter, eventTypeFilter, statusFilter, taskTypeFilter, dateRangeFilter, searchQuery]);

  // Contador de filtros activos para mostrar en el botón
  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (priorityFilter !== 'todas') n++;
    if (eventTypeFilter !== 'todos') n++;
    if (statusFilter !== 'todos') n++;
    if (taskTypeFilter !== 'todos') n++;
    if (dateRangeFilter !== 'todos') n++;
    if (searchQuery.trim().length > 0) n++;
    return n;
  }, [priorityFilter, eventTypeFilter, statusFilter, taskTypeFilter, dateRangeFilter, searchQuery]);

  // Cargar eventos al montar el componente
  React.useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  const addNewEventAlert = (slotInfo: EvType) => {
    // Abrir modal de creación de tareas generales en lugar de eventos manuales
    setShowTaskModal(true);
    setTaskSlot(slotInfo);
    setTaskStart(slotInfo.start);
    setTaskEnd(slotInfo.end);
  };

  const editEvent = (event: any) => {
    // Crear menú de acciones directas para eventos del sistema
    if (event.eventType === 'renovacion' || event.eventType === 'task') {
      const actions = getEventActions(event);
      if (actions.length > 0) {
        const { x, y } = lastMousePosRef.current;
        // Ajustar para no salirse de la pantalla (el menú aproximadamente 220x250)
        const menuW = 220, menuH = actions.length * 44 + 12;
        const safeX = Math.min(x, window.innerWidth - menuW - 12);
        const safeY = Math.min(y, window.innerHeight - menuH - 12);
        setActionMenu({ event, actions, x: Math.max(8, safeX), y: Math.max(8, safeY) });
      }
      return;
    }

    // Para eventos manuales, permitir edición normal
    setOpen(true);
    const newEditEvent = calevents.find(
      (elem: EvType) => elem.title === event.title
    );
    setColor(event.color);
    setTitle(newEditEvent.title);
    setColor(newEditEvent.color);
    setStart(newEditEvent.start);
    setEnd(newEditEvent.end);
    setUpdate(event);
  };

  // Obtener acciones disponibles para un evento
  const getEventActions = (event: any) => {
    const actions = [];

    if (event.eventType === 'task') {
      actions.push(
        { id: 'view', label: 'Ver Detalles', icon: 'solar:eye-bold-duotone', color: 'primary' },
        { id: 'edit', label: 'Editar Tarea', icon: 'solar:pen-new-square-bold-duotone', color: 'warning' },
        { id: 'complete', label: 'Marcar Completada', icon: 'solar:check-circle-bold-duotone', color: 'success' },
        { id: 'reassign', label: 'Reasignar', icon: 'solar:users-group-rounded-bold-duotone', color: 'info' },
        { id: 'tracking', label: 'Ver Bitácora', icon: 'solar:book-bookmark-bold-duotone', color: 'secondary' }
      );
    } else if (event.eventType === 'renovacion') {
      actions.push(
        { id: 'view', label: 'Ver Detalles', icon: 'solar:eye-bold-duotone', color: 'primary' },
        { id: 'process', label: 'Gestionar Renovación', icon: 'solar:refresh-bold-duotone', color: 'warning' },
        { id: 'tracking', label: 'Ver Historial', icon: 'solar:clock-circle-bold-duotone', color: 'secondary' }
      );
    }

    return actions;
  };

  // Manejar acción seleccionada del menú
  const handleEventAction = (actionId: string, event: any) => {
    setActionMenu(null); // cerrar menú
    if (!event) return;

    switch (actionId) {
      case 'view':
        showEventDetails(event);
        break;
      case 'edit':
        editTaskEvent(event);
        break;
      case 'complete':
        completeTask(event);
        break;
      case 'reassign':
        openReassignModal(event);
        break;
      case 'tracking':
        openTrackingModal(event);
        break;
      case 'process':
        processRenewal(event);
        break;
      default:
        console.log('Acción no implementada:', actionId);
    }
  };

  // Mostrar detalles del evento
  const showEventDetails = (event: any) => {
    if (event.eventType === 'task') {
      setSelectedTaskDetail(event.eventData);
      setShowTaskDetailModal(true);
    } else if (event.eventType === 'renovacion') {
      const renovacion = event.eventData;
      const mensaje = `RENOVACIÓN DE PÓLIZA\n\n` +
        `Cliente: ${renovacion.cliente}\n` +
        `Póliza: ${renovacion.numeroPoliza}\n` +
        `Aseguradora: ${renovacion.aseguradora}\n` +
        `Tipo: ${renovacion.tipoSeguro}\n` +
        `Prima: $${renovacion.valorPrima?.toLocaleString('es-CO')}\n` +
        `Vence en: ${renovacion.diasVencimiento} días\n` +
        `Estado: ${renovacion.estado}\n` +
        `Prioridad: ${renovacion.prioridad}\n\n` +
        `Acciones rápidas:\n` +
        `1. Gestionar renovación\n` +
        `2. Ver historial\n` +
        `3. Contactar cliente`;
      
      alert(mensaje);
    }
  };

  // Abrir modal de reasignación con evento preseleccionado
  const openReassignModal = async (event: any) => {
    setSelectedEventForReassign(event);
    setSelectedUser('');
    setReassignReason('');
    setShowReassignModal(true);
    // Cargar usuarios disponibles si no están aún
    if (availableUsers.length === 0) {
      try {
        const users = await commercialTasksService.getUsers();
        setAvailableUsers(users || []);
      } catch (e) {
        console.warn('No se pudieron cargar usuarios para reasignar', e);
      }
    }
  };

  // Abrir modal de tracking con evento preseleccionado y cargar bitácora real
  const openTrackingModal = async (event: any) => {
    setSelectedEventForTracking(event);
    setShowTrackingModal(true);
    setTrackingHistory([]);
    setTaskNotes([]);
    const taskId = event?.eventData?.id;
    if (!taskId || event.eventType !== 'task') return;
    try {
      setLoadingTracking(true);
      const log = await commercialTasksService.getActivityLog(taskId);
      const notes = (log || []).filter((e: any) => e.activity === 'Nota agregada');
      const history = (log || []).filter((e: any) => e.activity !== 'Nota agregada');
      setTrackingHistory(history);
      setTaskNotes(notes);
    } catch (e: any) {
      console.error('Error cargando bitácora', e);
    } finally {
      setLoadingTracking(false);
    }
  };

  // Confirmar reasignación
  const submitReassign = async () => {
    const taskId = selectedEventForReassign?.eventData?.id;
    if (!taskId || !selectedUser) return;
    try {
      setLoadingReassign(true);
      await commercialTasksService.reassignTask(taskId, Number(selectedUser), reassignReason || undefined);
      await loadCalendarEvents();
      setShowReassignModal(false);
      setSelectedUser('');
      setReassignReason('');
      alert('✅ Tarea reasignada');
    } catch (e: any) {
      alert(`❌ Error: ${e.message}`);
    } finally {
      setLoadingReassign(false);
    }
  };

  // Agregar nota a bitácora
  const submitNote = async () => {
    const taskId = selectedEventForTracking?.eventData?.id;
    if (!taskId || !newNote.trim()) return;
    try {
      setLoadingTracking(true);
      const log = await commercialTasksService.addNote(taskId, newNote.trim(), isPrivateNote);
      const notes = (log || []).filter((e: any) => e.activity === 'Nota agregada');
      const history = (log || []).filter((e: any) => e.activity !== 'Nota agregada');
      setTrackingHistory(history);
      setTaskNotes(notes);
      setNewNote('');
      setIsPrivateNote(false);
    } catch (e: any) {
      alert(`❌ ${e.message}`);
    } finally {
      setLoadingTracking(false);
    }
  };

  // Marcar tarea como completada (llama al backend)
  const completeTask = async (event: any) => {
    const taskId = event?.eventData?.id;
    if (!taskId) {
      alert('No se pudo identificar la tarea');
      return;
    }
    if (!confirm(`¿Marcar "${event.title}" como completada?`)) return;
    try {
      await commercialTasksService.completeTask(taskId, {
        notes: 'Completada desde el calendario',
      });
      // Recargar eventos para que la tarea desaparezca / cambie de color
      await loadCalendarEvents();
      alert(`✅ Tarea "${event.title}" marcada como completada`);
    } catch (err: any) {
      console.error('Error completando tarea:', err);
      alert(`❌ Error al completar la tarea: ${err?.message || 'desconocido'}`);
    }
  };

  // Editar tarea: deep-link a la página de seguimiento con la tarea preseleccionada
  const editTaskEvent = (event: any) => {
    const taskId = event?.eventData?.id;
    if (!taskId) return;
    navigate(`/apps/seguros/seguimiento?task=${taskId}`);
  };

  // Procesar renovación: navegar a la página de renovaciones
  const processRenewal = (event: any) => {
    const polizaId = event?.eventData?.polizaId || event?.eventData?.poliza_id;
    if (polizaId) {
      navigate(`/apps/seguros/renovaciones?poliza=${polizaId}`);
    } else {
      navigate('/apps/seguros/renovaciones');
    }
  };

  // Funciones para manejar la creación de tareas generales
  const handleTaskSubmit = async (e: React.ChangeEvent<any>) => {
    e.preventDefault();
    
    try {
      setLoadingTask(true);
      
      // Crear la tarea general usando el servicio de tareas comerciales
      const taskData = {
        title: taskTitle,
        description: taskDescription,
        type: taskType,
        priority: taskPriority,
        scheduled_for: taskStart?.toISOString(),
        due_date: taskEnd?.toISOString(),
        status: 'pendiente',
        assigned_user_id: taskAssignedUser || null,
        client_id: selectedClient || null,
        poliza_id: selectedPoliza || null,
      };

      await commercialTasksService.createTask(taskData);
      
      // Recargar eventos del calendario
      await loadCalendarEvents();
      
      // Cerrar modal y limpiar formulario
      setShowTaskModal(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("media");
      setTaskType("general");
      setTaskAssignedUser("");
      setTaskSlot(undefined);
      setTaskStart(null);
      setTaskEnd(null);
      
    } catch (error) {
      console.error('Error al crear tarea:', error);
      alert('Error al crear la tarea. Por favor intenta de nuevo.');
    } finally {
      setLoadingTask(false);
    }
  };

  const handleTaskTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTaskTitle(e.target.value);
  };

  const handleTaskDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTaskDescription(e.target.value);
  };

  const handleTaskPriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskPriority(e.target.value);
  };

  const handleTaskTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskType(e.target.value);
  };

  const handleTaskAssignedUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskAssignedUser(e.target.value);
  };

  const handleTaskStartChange = (newValue: any) => {
    setTaskStart(newValue);
  };

  const handleTaskEndChange = (newValue: any) => {
    setTaskEnd(newValue);
  };

  const handleTaskModalClose = () => {
    setShowTaskModal(false);
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("media");
    setTaskType("seguimiento_cliente");
    setTaskAssignedUser("");
    setSelectedClient("");
    setSelectedPoliza("");
    setTaskSlot(undefined);
    setTaskStart(null);
    setTaskEnd(null);
  };

  // Funciones para cargar datos del sistema
  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const response = await clienteService.getClientes({ per_page: 200 });
      setClients(response);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadClientPolizas = async (clientId: string) => {
    try {
      setLoadingPolizas(true);
      const response = await polizaService.getPolizas({ cliente_id: clientId, per_page: 100 });
      setClientPolizas(response.data?.data || []);
    } catch (error) {
      console.error('Error al cargar pólizas del cliente:', error);
      setClientPolizas([]);
    } finally {
      setLoadingPolizas(false);
    }
  };

  const loadSystemUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await salesTeamsService.list({ per_page: 200 });
      // Extraer usuarios de los equipos de ventas si es necesario
      const users = response.data?.flatMap((team: any) => team.members || []) || [];
      setSystemUsers(users);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Manejadores de cambios
  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value;
    setSelectedClient(clientId);
    setSelectedPoliza(""); // Limpiar póliza seleccionada
    
    if (clientId) {
      loadClientPolizas(clientId);
    } else {
      setClientPolizas([]);
    }
  };

  const handlePolizaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPoliza(e.target.value);
  };

  const handleAssignedUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskAssignedUser(e.target.value);
  };

  // Cargar datos cuando se abre la modal
  React.useEffect(() => {
    if (showTaskModal) {
      loadClients();
      loadSystemUsers();
    }
  }, [showTaskModal]);

  const updateEvent = async (e: any) => {
    e.preventDefault();
    
    try {
      if (update.eventType === 'manual' && update.eventData?.id) {
        // Actualizar en el backend
        await calendarService.updateEvent(update.eventData.id, {
          title,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          all_day: true,
          color,
        });
        
        // Recargar todos los eventos
        await loadCalendarEvents();
      }
      
      setOpen(false);
      setTitle("");
      setColor("");
      setStart("");
      setEnd("");
      setUpdate(null);
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      alert('Error al actualizar el evento. Por favor intenta de nuevo.');
    }
  };
  const inputChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);
  const selectinputChangeHandler = (id: string) => setColor(id);

  const submitHandler = async (e: React.ChangeEvent<any>) => {
    e.preventDefault();
    
    try {
      // Crear evento en el backend
      await calendarService.createEvent({
        title,
        description: '',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        all_day: true,
        color,
      });
      
      // Recargar todos los eventos
      await loadCalendarEvents();
      
      setOpen(false);
      e.target.reset();
      setTitle("");
      setStart(new Date());
      setEnd(new Date());
    } catch (error) {
      console.error('Error al crear evento:', error);
      alert('Error al crear el evento. Por favor intenta de nuevo.');
    }
  };
  const deleteHandler = async (event: any) => {
    try {
      if (event.eventType === 'manual' && event.eventData?.id) {
        // Eliminar del backend
        await calendarService.deleteEvent(event.eventData.id);
        
        // Recargar todos los eventos
        await loadCalendarEvents();
      }
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      alert('Error al eliminar el evento. Por favor intenta de nuevo.');
    }
  };

  const handleClose = () => {
    // eslint-disable-line newline-before-return
    setOpen(false);
    setTitle("");
    setStart(new Date());
    setEnd(new Date());
    setUpdate(null);
  };

  const eventColors = (event: EvType) => {
    if (event.color) {
      return { className: `event-${event.color}` };
    }

    return { className: `event-default` };
  };

  const handleStartChange = (newValue: any) => {
    setStart(newValue);
  };
  const handleEndChange = (newValue: any) => {
    setEnd(newValue);
  };

  const messages = {
    allDay: 'Todo el día',
    previous: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    agenda: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'No hay eventos en este rango',
    showMore: (total: number) => `+ Ver más (${total})`
  };

  return (
    <>
      {error && (
        <Alert color="failure" className="mb-4">
          {error}
        </Alert>
      )}

      <CardBox>
        {loading ? (
          <div className="flex items-center justify-center min-h-[900px]">
            <Spinner size="xl" />
            <span className="ml-3 text-lg">Cargando eventos del calendario...</span>
          </div>
        ) : (
          <>
            {/* Panel de Filtros y Estadísticas */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div className="flex gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-lightwarning flex items-center justify-center">
                      <IconifyIcon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Renovaciones</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{eventStats.renovaciones}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-lightprimary flex items-center justify-center">
                      <IconifyIcon icon="solar:checklist-minimalistic-bold-duotone" className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tareas</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{eventStats.tareas}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-lightsuccess flex items-center justify-center">
                      <IconifyIcon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Eventos Manuales</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{eventStats.manuales}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total de eventos</p>
                  <p className="text-2xl font-bold text-primary">{calevents.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredEvents.length !== calevents.length && `Mostrando ${filteredEvents.length} filtrados`}
                  </p>
                </div>
              </div>

              {/* Controles de Filtros y Notificaciones */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    color="light"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2"
                  >
                    <IconifyIcon icon="solar:filter-bold-duotone" className="w-4 h-4" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <span className="bg-primary text-white text-xs rounded-full px-2 py-1">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                  
                  <Button
                    color="light"
                    size="sm"
                    onClick={() => setShowDashboardModal(true)}
                    className="flex items-center gap-2"
                  >
                    <IconifyIcon icon="solar:chart-square-bold-duotone" className="w-4 h-4" />
                    Dashboard
                  </Button>
                  
                  {activeFilterCount > 0 && (
                    <Button
                      color="light"
                      size="sm"
                      onClick={() => {
                        setPriorityFilter('todas');
                        setEventTypeFilter('todos');
                        setStatusFilter('todos');
                        setTaskTypeFilter('todos');
                        setDateRangeFilter('todos');
                        setSearchQuery('');
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <IconifyIcon icon="solar:close-circle-bold-duotone" className="w-4 h-4" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </div>

              {/* Panel de Filtros Desplegable */}
              {showFilters && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-4">
                  {/* Búsqueda */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <IconifyIcon icon="solar:magnifer-bold-duotone" className="w-4 h-4 inline mr-1" />
                      Búsqueda
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por título, cliente, póliza..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de Evento
                      </label>
                      <select
                        value={eventTypeFilter}
                        onChange={(e) => setEventTypeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="todos">Todos</option>
                        <option value="task">Tareas</option>
                        <option value="renovacion">Renovaciones</option>
                        <option value="manual">Eventos manuales</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prioridad
                      </label>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="todas">Todas</option>
                        <option value="critica">Crítica</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Rango de Fechas
                      </label>
                      <select
                        value={dateRangeFilter}
                        onChange={(e) => setDateRangeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="todos">Todos</option>
                        <option value="hoy">Hoy</option>
                        <option value="manana">Mañana</option>
                        <option value="esta_semana">Esta semana</option>
                        <option value="este_mes">Este mes</option>
                        <option value="proximos_7">Próximos 7 días</option>
                        <option value="proximos_30">Próximos 30 días</option>
                        <option value="vencidos">Vencidos</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Estado (solo tareas)
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="todos">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="en_progreso">En progreso</option>
                        <option value="pausada">Pausada</option>
                        <option value="vencida">Vencida</option>
                        <option value="completada">Completada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de Tarea
                      </label>
                      <select
                        value={taskTypeFilter}
                        onChange={(e) => setTaskTypeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="todos">Todos</option>
                        <option value="seguimiento_cliente">Seguimiento de cliente</option>
                        <option value="llamada">Llamada</option>
                        <option value="reunion">Reunión</option>
                        <option value="email">Email</option>
                        <option value="visita">Visita</option>
                        <option value="cotizacion">Cotización</option>
                        <option value="renovacion">Renovación</option>
                        <option value="siniestro">Siniestro</option>
                        <option value="documentacion">Documentación</option>
                        <option value="inspeccion">Inspección</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Calendar
              selectable
              events={filteredEvents}
              defaultView="month"
              scrollToTime={new Date(1970, 1, 1, 6)}
              defaultDate={new Date()}
              localizer={localizer}
              messages={messages}
              onSelectEvent={(event) => editEvent(event)}
              onSelectSlot={(slotInfo: any) => addNewEventAlert(slotInfo)}
              eventPropGetter={(event: any) => eventColors(event)}
              className="min-h-[900px]"
            />

            {/* Menú contextual de acciones (state-driven) */}
            {actionMenu && (
              <div
                id="calendar-action-menu"
                className="fixed z-[10000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[220px] animate-in fade-in zoom-in-95"
                style={{ left: actionMenu.x, top: actionMenu.y }}
              >
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                    {actionMenu.event.title}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize">
                    {actionMenu.event.eventType === 'task' ? 'Tarea' : 'Renovación'}
                  </p>
                </div>
                {actionMenu.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleEventAction(action.id, actionMenu.event)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <IconifyIcon
                      icon={action.icon}
                      className={`w-4 h-4 ${
                        action.color === 'primary'
                          ? 'text-primary'
                          : action.color === 'warning'
                          ? 'text-amber-500'
                          : action.color === 'success'
                          ? 'text-emerald-500'
                          : action.color === 'info'
                          ? 'text-blue-500'
                          : 'text-gray-500'
                      }`}
                    />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardBox>
      {/* Dialog/Modal */}
      <Modal dismissible show={open} size="lg" onClose={handleClose}>
        <form onSubmit={update ? updateEvent : submitHandler}>
          <Modal.Header>
            {update ? "Actualizar Evento" : "Agregar Evento"}

            <p className="text-darklink dark:text-bodytext font-normal mt-3 text-sm">
              {!update
                ? "Para agregar un evento, completa el título y elige el color del evento, luego presiona el botón agregar"
                : "Para editar/actualizar el evento, cambia el título y elige el color del evento, luego presiona el botón actualizar"}
              {slot?.title}
            </p>
          </Modal.Header>
          <Modal.Body className="pt-0">
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="event" value="Título del Evento" />
                </div>
                <TextInput
                  id="event"
                  type="text"
                  sizing="md"
                  value={title}
                  className="form-control"
                  onChange={inputChangeHandler}
                />
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="StartDate" value="Fecha de Inicio" />
                </div>
                <Datepicker
                  value={start}
                  className="form-control calendar static"
                  onChange={handleStartChange}
                />
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="EndDate" value="Fecha de Fin" />
                </div>
                <Datepicker
                  value={end}
                  className="form-control calendarSec static"
                  onChange={handleEndChange}
                />
              </div>
            </div>

            <h6 className="text-base pt-4">Seleccionar Color del Evento</h6>
            <div className="flex gap-2 items-center mt-2">
              {ColorVariation.map((mcolor) => {
                return (
                  <div
                    className={`h-6 w-6 flex justify-center items-center rounded-full cursor-pointer  bg-${mcolor.eColor}`}
                    key={mcolor.id}
                    onClick={() => selectinputChangeHandler(mcolor.value)}
                  >
                    {mcolor.value === color ? (
                      <TbCheck width="16" className="text-white" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Modal.Body>
          <Modal.Footer>

            {update ? (
              <Button
                type="submit"
                color={"error"}
                onClick={() => deleteHandler(update)}
              >
                Eliminar
              </Button>
            ) : (
              ""
            )}
            <Button color={"primary"} type="submit" disabled={!title}>
              {update ? "Actualizar Evento" : "Agregar Evento"}
            </Button>
            <Button color={"lighterror"} onClick={handleClose}>
              Cerrar
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Modal de Creación de Tareas Generales */}
      <Modal dismissible show={showTaskModal} size="lg" onClose={handleTaskModalClose}>
        <form onSubmit={handleTaskSubmit}>
          <Modal.Header>
            <div className="flex items-center gap-3">
              <IconifyIcon icon="solar:checklist-minimalistic-bold-duotone" className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Crear Tarea General
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Crea una nueva tarea para el día seleccionado
                </p>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body className="pt-0">
            <div className="space-y-4">
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="taskTitle" value="Título de la Tarea" />
                </div>
                <TextInput
                  id="taskTitle"
                  type="text"
                  sizing="md"
                  value={taskTitle}
                  placeholder="Ej: Reunión de equipo, Llamar a cliente, etc."
                  className="form-control"
                  onChange={handleTaskTitleChange}
                  required
                />
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="taskDescription" value="Descripción" />
                </div>
                <textarea
                  id="taskDescription"
                  value={taskDescription}
                  onChange={handleTaskDescriptionChange}
                  placeholder="Describe los detalles de la tarea..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  rows={3}
                />
              </div>

              {/* Cliente y Pólizas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskClient" value="Cliente (Opcional)" />
                  </div>
                  <select
                    id="taskClient"
                    value={selectedClient}
                    onChange={handleClientChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={loadingClients}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clients.data?.map((client: any) => (
                      <option key={client.id} value={client.id}>
                        {client.nombre || client.razon_social || `Cliente ${client.id}`}
                      </option>
                    ))}
                  </select>
                  {loadingClients && <Spinner size="sm" className="mt-2" />}
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskPoliza" value="Póliza (Opcional)" />
                  </div>
                  <select
                    id="taskPoliza"
                    value={selectedPoliza}
                    onChange={handlePolizaChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={!selectedClient || loadingPolizas}
                  >
                    <option value="">Seleccionar póliza...</option>
                    {clientPolizas.map((poliza: any) => (
                      <option key={poliza.id} value={poliza.id}>
                        {poliza.numero_poliza} - {poliza.aseguradora}
                      </option>
                    ))}
                  </select>
                  {loadingPolizas && <Spinner size="sm" className="mt-2" />}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskType" value="Tipo de Tarea" />
                  </div>
                  <select
                    id="taskType"
                    value={taskType}
                    onChange={handleTaskTypeChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="seguimiento_cliente">General</option>
                    <option value="reunion">Reunión</option>
                    <option value="llamada">Llamada</option>
                    <option value="email">Email</option>
                    <option value="visita">Visita</option>
                    <option value="documentacion">Documentación</option>
                    <option value="inspeccion">Inspección</option>
                    <option value="siniestro">Siniestro</option>
                    <option value="cotizacion">Cotización</option>
                    <option value="renovacion">Renovación</option>
                  </select>
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskPriority" value="Prioridad" />
                  </div>
                  <select
                    id="taskPriority"
                    value={taskPriority}
                    onChange={handleTaskPriorityChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskStartDate" value="Fecha y Hora de Inicio" />
                  </div>
                  <Datepicker
                    id="taskStartDate"
                    value={taskStart}
                    className="form-control calendar static"
                    onChange={handleTaskStartChange}
                  />
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="taskEndDate" value="Fecha y Hora de Fin" />
                  </div>
                  <Datepicker
                    id="taskEndDate"
                    value={taskEnd}
                    className="form-control calendarSec static"
                    onChange={handleTaskEndChange}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="taskAssignedUser" value="Asignar a (Opcional)" />
                </div>
                <select
                  id="taskAssignedUser"
                  value={taskAssignedUser}
                  onChange={handleAssignedUserChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  disabled={loadingUsers}
                >
                  <option value="">Sin asignar</option>
                  {systemUsers.map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.email && `(${user.email})`}
                    </option>
                  ))}
                </select>
                {loadingUsers && <Spinner size="sm" className="mt-2" />}
              </div>

              <Alert color="info">
                <div className="flex items-center gap-2">
                  <IconifyIcon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
                  <span>
                    Esta tarea aparecerá en el calendario y podrá ser gestionada con todas las herramientas de seguimiento disponibles.
                  </span>
                </div>
              </Alert>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="primary" type="submit" disabled={!taskTitle || loadingTask}>
              {loadingTask ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <IconifyIcon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                  Crear Tarea
                </>
              )}
            </Button>
            <Button color="light" onClick={handleTaskModalClose}>
              Cancelar
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Modal de Configuración de Notificaciones */}
      <Modal dismissible show={showNotificationsModal} size="xl" onClose={() => setShowNotificationsModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:bell-bing-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Configuración de Notificaciones
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Define la frecuencia de recordatorios según la prioridad de las tareas
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="space-y-6">
            <Alert color="info">
              <div className="flex items-center gap-2">
                <IconifyIcon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
                <span>
                  Las notificaciones te recordarán las tareas pendientes según la prioridad y frecuencia configuradas.
                  Puedes habilitar notificaciones del navegador, por correo electrónico y sonidos.
                </span>
              </div>
            </Alert>

            <div className="grid gap-4">
              {notificationService.getDefaultNotificationRules().map((rule, index) => (
                <div key={rule.task_priority} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: rule.color_code }}
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                          Tareas {rule.task_priority}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{rule.description}</p>
                      </div>
                    </div>
                    <Checkbox
                      id={`active-${rule.task_priority}`}
                      defaultChecked={true}
                      className="w-5 h-5"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frecuencia (horas)
                      </Label>
                      <TextInput
                        type="number"
                        min="1"
                        max="168"
                        defaultValue={rule.frequency_hours}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frecuencia (minutos)
                      </Label>
                      <TextInput
                        type="number"
                        min="0"
                        max="59"
                        defaultValue={rule.frequency_minutes}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Color de notificación
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          defaultValue={rule.color_code}
                          className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600"
                        />
                        <TextInput
                          type="text"
                          defaultValue={rule.color_code}
                          className="flex-1"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`browser-${rule.task_priority}`} defaultChecked={true} />
                      <Label htmlFor={`browser-${rule.task_priority}`} className="text-sm">
                        Notificación del navegador
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox id={`sound-${rule.task_priority}`} defaultChecked={true} />
                      <Label htmlFor={`sound-${rule.task_priority}`} className="text-sm">
                        Sonido
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox id={`email-${rule.task_priority}`} defaultChecked={false} />
                      <Label htmlFor={`email-${rule.task_priority}`} className="text-sm">
                        Correo electrónico
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:lightbulb-bold-duotone" className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">Sugerencias de configuración</h4>
              </div>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>· <strong>Críticas:</strong> Cada 2 horas para acción inmediata</li>
                <li>· <strong>Altas:</strong> Cada 4 horas para seguimiento constante</li>
                <li>· <strong>Medias:</strong> Cada 8 horas para revisión diaria</li>
                <li>· <strong>Bajas:</strong> Cada 24 horas para recordatorio diario</li>
              </ul>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => setShowNotificationsModal(false)}>
            Guardar Configuración
          </Button>
          <Button color="light" onClick={() => setShowNotificationsModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Dashboard de Procesos */}
      <Modal dismissible show={showDashboardModal} size="6xl" onClose={() => setShowDashboardModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:chart-square-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Dashboard de Procesos
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Análisis de tareas por compañía, cliente, ramo y categoría
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="space-y-6">
            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Total Tareas</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{processStats.total_tasks || 0}</p>
                  </div>
                  <IconifyIcon icon="solar:clipboard-list-bold-duotone" className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">Completadas</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{processStats.completed_tasks || 0}</p>
                  </div>
                  <IconifyIcon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{processStats.pending_tasks || 0}</p>
                  </div>
                  <IconifyIcon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">Tasa Completión</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {processStats.total_tasks > 0 
                        ? Math.round((processStats.completed_tasks / processStats.total_tasks) * 100) 
                        : 0}%
                    </p>
                  </div>
                  <IconifyIcon icon="solar:chart-bold-duotone" className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Procesos por Compañía */}
              <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <IconifyIcon icon="solar:buildings-3-bold-duotone" className="w-5 h-5 text-primary" />
                  Procesos por Compañía
                </h4>
                <div className="space-y-3">
                  {Object.entries(processStats.by_company || {}).slice(0, 5).map(([company, data]: [string, any]) => (
                    <div key={company} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{company}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.total} tareas
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {data.completed || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                              {data.pending || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {data.total > 0 ? Math.round(((data.completed || 0) / data.total) * 100) : 0}%
                        </p>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div 
                            className="h-2 bg-green-500 rounded-full" 
                            style={{ width: `${data.total > 0 ? ((data.completed || 0) / data.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Procesos por Cliente */}
              <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <IconifyIcon icon="solar:user-bold-duotone" className="w-5 h-5 text-primary" />
                  Procesos por Cliente
                </h4>
                <div className="space-y-3">
                  {Object.entries(processStats.by_client || {}).slice(0, 5).map(([client, data]: [string, any]) => (
                    <div key={client} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{client}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.total} tareas
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {data.completed || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                              {data.pending || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {data.total > 0 ? Math.round(((data.completed || 0) / data.total) * 100) : 0}%
                        </p>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div 
                            className="h-2 bg-green-500 rounded-full" 
                            style={{ width: `${data.total > 0 ? ((data.completed || 0) / data.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Procesos por Ramo */}
              <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <IconifyIcon icon="solar:document-bold-duotone" className="w-5 h-5 text-primary" />
                  Procesos por Ramo
                </h4>
                <div className="space-y-3">
                  {Object.entries(processStats.by_ramo || {}).slice(0, 5).map(([ramo, data]: [string, any]) => (
                    <div key={ramo} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{ramo}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.total} tareas
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {data.completed || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                              {data.pending || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {data.total > 0 ? Math.round(((data.completed || 0) / data.total) * 100) : 0}%
                        </p>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div 
                            className="h-2 bg-green-500 rounded-full" 
                            style={{ width: `${data.total > 0 ? ((data.completed || 0) / data.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Procesos por Categoría */}
              <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <IconifyIcon icon="solar:tag-bold-duotone" className="w-5 h-5 text-primary" />
                  Procesos por Categoría
                </h4>
                <div className="space-y-3">
                  {Object.entries(processStats.by_category || {}).slice(0, 5).map(([category, data]: [string, any]) => (
                    <div key={category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white capitalize">{category}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.total} tareas
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {data.completed || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                              {data.pending || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {data.total > 0 ? Math.round(((data.completed || 0) / data.total) * 100) : 0}%
                        </p>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div 
                            className="h-2 bg-green-500 rounded-full" 
                            style={{ width: `${data.total > 0 ? ((data.completed || 0) / data.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => setShowDashboardModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Trazabilidad y Bitácora */}
      <Modal dismissible show={showTrackingModal} size="6xl" onClose={() => { setShowTrackingModal(false); setSelectedEventForTracking(null); }}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:book-bookmark-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Trazabilidad y Bitácora
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Historial completo de acciones y notas de seguimiento
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="space-y-6">
            {/* Selector solo si no se ha preseleccionado una tarea */}
            {!selectedEventForTracking && (
              <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seleccionar Tarea
                </Label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  onChange={(e) => {
                    const selected = calevents.find((ev: any) => ev.eventId === e.target.value);
                    if (selected) openTrackingModal(selected);
                  }}
                >
                  <option value="">Seleccionar tarea...</option>
                  {filteredEvents.filter((ev: any) => ev.eventType === 'task').map((event: any) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedEventForTracking && (
              <>
                {/* Información del Elemento Seleccionado */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Elemento Seleccionado
                  </h4>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: selectedEventForTracking.color === 'red' ? '#EF4444' : 
                                               selectedEventForTracking.color === 'warning' ? '#F59E0B' :
                                               selectedEventForTracking.color === 'green' ? '#10B981' : '#3B82F6' }}
                    />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        {selectedEventForTracking.title}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Tipo: {selectedEventForTracking.eventType === 'task' ? 'Tarea' :
                              selectedEventForTracking.eventType === 'renovacion' ? 'Renovación' : 'Evento Manual'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Historial de Acciones */}
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <IconifyIcon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-primary" />
                      Historial de Acciones
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {trackingHistory.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                          No hay historial de acciones para este elemento
                        </p>
                      ) : (
                        trackingHistory.map((entry: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-primary">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {entry.activity}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString('es-ES') : ''}
                              </span>
                            </div>
                            {entry.data && Object.keys(entry.data).length > 0 && (
                              <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs space-y-0.5">
                                {Object.entries(entry.data).map(([k, v]: any, idx: number) => (
                                  <div key={idx} className="text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <IconifyIcon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.user_id || entry.user || '—'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Notas y Comentarios */}
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <IconifyIcon icon="solar:notebook-text-bold-duotone" className="w-5 h-5 text-primary" />
                      Notas y Comentarios
                    </h4>
                    
                    {/* Formulario para añadir nota */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="mb-3">
                        <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nueva Nota
                        </Label>
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={3}
                          placeholder="Añadir una nota o comentario..."
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="private-note"
                            checked={isPrivateNote}
                            onChange={(e) => setIsPrivateNote(e.target.checked)}
                          />
                          <Label htmlFor="private-note" className="text-sm text-gray-700 dark:text-gray-300">
                            Nota privada
                          </Label>
                        </div>
                        <Button
                          color="primary"
                          size="sm"
                          onClick={submitNote}
                          disabled={!newNote.trim() || loadingTracking}
                        >
                          <IconifyIcon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-1" />
                          Añadir
                        </Button>
                      </div>
                    </div>

                    {/* Lista de notas existentes */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {taskNotes.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                          No hay notas para este elemento
                        </p>
                      ) : (
                        taskNotes.map((note: any, index: number) => (
                          <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <IconifyIcon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {note.user_id || 'Usuario'}
                                </span>
                                {note.data?.is_private && (
                                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                    Privada
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {note.timestamp ? new Date(note.timestamp).toLocaleString('es-ES') : ''}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {note.data?.note || ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Estadísticas de Actividad */}
                <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <IconifyIcon icon="solar:chart-bold-duotone" className="w-5 h-5 text-primary" />
                    Estadísticas de Actividad
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{trackingHistory.length}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Acciones Totales</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{taskNotes.length}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Notas Añadidas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {new Set(trackingHistory.map((entry: any) => entry.user_id)).size}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Usuarios Activos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {trackingHistory.length > 0 ? 
                          Math.round((trackingHistory.filter((entry: any) => 
                            (entry.activity || '').toLowerCase().includes('complet') ||
                            (entry.activity || '').toLowerCase().includes('finaliz')
                          ).length / trackingHistory.length) * 100) : 0}%
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Tasa de Finalización</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => { setShowTrackingModal(false); setSelectedEventForTracking(null); }}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Reasignación de Tareas */}
      <Modal dismissible show={showReassignModal} size="lg" onClose={() => setShowReassignModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reasignar Tarea
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Asigna esta tarea a otro miembro del equipo
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="space-y-6">
            {/* Selección de Tarea */}
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Seleccionar Tarea</h4>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                onChange={(e: any) => {
                  const selectedEvent = filteredEvents.find((event: any) => event.eventId === e.target.value);
                  setSelectedEventForReassign(selectedEvent);
                }}
                value={selectedEventForReassign?.eventId || ''}
              >
                <option value="">Seleccionar tarea...</option>
                {filteredEvents
                  .filter((event: any) => event.eventType === 'task')
                  .map((event: any) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.title}
                    </option>
                  ))}
              </select>
            </div>

            {selectedEventForReassign && (
              <>
                {/* Información de la Tarea */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Tarea Seleccionada
                  </h4>
                  <div className="space-y-2">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {selectedEventForReassign.title}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-blue-700 dark:text-blue-300">
                      <span>Prioridad: {selectedEventForReassign.eventData?.priority || 'N/A'}</span>
                      <span>Estado: {selectedEventForReassign.eventData?.status || 'N/A'}</span>
                      {selectedEventForReassign.eventData?.assigned_user && (
                        <span>Asignado a: {selectedEventForReassign.eventData.assigned_user.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selección de Nuevo Usuario */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nuevo Usuario Asignado
                  </Label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {availableUsers.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Motivo de Reasignación */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo de Reasignación
                  </Label>
                  <textarea
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={3}
                    placeholder="Explica el motivo de la reasignación..."
                  />
                </div>

                {/* Confirmación */}
                <Alert color="warning">
                  <div className="flex items-center gap-2">
                    <IconifyIcon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
                    <span>
                      La reasignación notificará al nuevo usuario y registrará la acción en la bitácora de seguimiento.
                    </span>
                  </div>
                </Alert>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="primary"
            onClick={submitReassign}
            disabled={!selectedEventForReassign || !selectedUser || loadingReassign}
          >
            {loadingReassign ? <Spinner size="sm" className="mr-2" /> : null}
            Reasignar Tarea
          </Button>
          <Button color="light" onClick={() => setShowReassignModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Detalle de Tarea Comercial */}
      <Modal dismissible show={showTaskDetailModal} size="lg" onClose={() => setShowTaskDetailModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <IconifyIcon icon="solar:checklist-minimalistic-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalle de Tarea
              </h3>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedTaskDetail && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white text-base mb-1">
                  {selectedTaskDetail.title}
                </h4>
                {selectedTaskDetail.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTaskDetail.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Tipo</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedTaskDetail.type?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Estado</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedTaskDetail.status?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Prioridad</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedTaskDetail.priority || 'N/A'}
                  </p>
                </div>
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Progreso</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedTaskDetail.progress_percentage || 0}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <IconifyIcon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-semibold">Fecha Programada</p>
                  </div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {selectedTaskDetail.scheduled_for
                      ? new Date(selectedTaskDetail.scheduled_for).toLocaleString('es-ES')
                      : 'Sin fecha programada'}
                  </p>
                </div>
                <div className={`p-3 border rounded-lg ${
                  selectedTaskDetail.due_date && new Date(selectedTaskDetail.due_date) < new Date()
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <IconifyIcon icon="solar:alarm-bold-duotone" className={`w-4 h-4 ${
                      selectedTaskDetail.due_date && new Date(selectedTaskDetail.due_date) < new Date()
                        ? 'text-red-600'
                        : 'text-orange-600'
                    }`} />
                    <p className={`text-xs uppercase font-semibold ${
                      selectedTaskDetail.due_date && new Date(selectedTaskDetail.due_date) < new Date()
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}>Fecha Máxima (Límite)</p>
                  </div>
                  <p className={`text-sm font-medium ${
                    selectedTaskDetail.due_date && new Date(selectedTaskDetail.due_date) < new Date()
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-orange-900 dark:text-orange-100'
                  }`}>
                    {selectedTaskDetail.due_date
                      ? new Date(selectedTaskDetail.due_date).toLocaleString('es-ES')
                      : 'Sin fecha límite'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Cliente</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedTaskDetail.client?.name ||
                     selectedTaskDetail.client?.first_name + ' ' + selectedTaskDetail.client?.last_name ||
                     'Sin cliente'}
                  </p>
                </div>
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Asignado a</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedTaskDetail.assigned_user?.name ||
                     selectedTaskDetail.assigned_empleado?.nombres + ' ' + selectedTaskDetail.assigned_empleado?.apellidos ||
                     'Sin asignar'}
                  </p>
                </div>
              </div>

              {selectedTaskDetail.result && (
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Resultado</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedTaskDetail.result}
                  </p>
                </div>
              )}

              {selectedTaskDetail.next_follow_up && (
                <div className="p-3 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <IconifyIcon icon="solar:calendar-mark-bold-duotone" className="w-4 h-4 text-purple-600" />
                    <p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-semibold">Próximo Seguimiento</p>
                  </div>
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    {new Date(selectedTaskDetail.next_follow_up).toLocaleString('es-ES')}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="primary"
            onClick={() => {
              if (selectedTaskDetail?.id) {
                window.open(`/apps/seguros/seguimiento?task=${selectedTaskDetail.id}`, '_blank');
              }
              setShowTaskDetailModal(false);
            }}
          >
            <IconifyIcon icon="solar:pen-new-square-bold-duotone" className="w-4 h-4 mr-1.5" />
            Editar en Seguimiento
          </Button>
          <Button color="gray" onClick={() => setShowTaskDetailModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CalendarApp;

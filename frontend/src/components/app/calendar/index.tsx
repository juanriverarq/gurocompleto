

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
} from "flowbite-react";
import CardBox from "../../shared/CardBox";
import React from 'react';
import renovacionesService from 'src/services/renovacionesService';
import { commercialTasksService } from 'src/services/commercialTasksService';
import calendarService from 'src/services/calendarService';

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
  const [calevents, setCalEvents] = React.useState<any>([]);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar eventos');
      } finally {
        setLoading(false);
      }
  }, []);

  // Cargar eventos al montar el componente
  React.useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  const addNewEventAlert = (slotInfo: EvType) => {
    setOpen(true);
    setSlot(slotInfo);
    setStart(slotInfo.start);
    setEnd(slotInfo.end);
  };

  const editEvent = (event: any) => {
    // No permitir editar eventos de renovaciones o tareas del sistema
    if (event.eventType === 'renovacion') {
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
        `→ Ve a Renovaciones para gestionar esta póliza`;
      alert(mensaje);
      return;
    }
    
    if (event.eventType === 'task') {
      const tarea = event.eventData;
      
      // Mapeo de tipos a nombres legibles
      const tipoNombres: Record<string, string> = {
        'seguimiento_cliente': 'Seguimiento de Cliente',
        'documentacion': 'Documentación',
        'inspeccion': 'Inspección',
        'renovacion': 'Renovación',
        'siniestro': 'Siniestro',
        'cotizacion': 'Cotización',
        'llamada': 'Llamada',
        'reunion': 'Reunión',
        'email': 'Email',
        'visita': 'Visita',
      };
      
      // Mapeo de estados
      const estadoNombres: Record<string, string> = {
        'pendiente': 'Pendiente',
        'en_progreso': 'En Progreso',
        'completada': 'Completada',
        'vencida': 'Vencida',
        'cancelada': 'Cancelada',
        'pausada': 'Pausada',
      };
      
      // Mapeo de prioridades
      const prioridadNombres: Record<string, string> = {
        'baja': 'Baja',
        'media': 'Media',
        'alta': 'Alta',
        'critica': 'Crítica',
      };
      
      const tipoNombre = tipoNombres[tarea.type] || tarea.type_name || tarea.type;
      const estadoNombre = estadoNombres[tarea.status] || tarea.status_name || tarea.status;
      const prioridadNombre = prioridadNombres[tarea.priority] || tarea.priority_name || tarea.priority;
      
      let fechaInfo = '';
      if (tarea.scheduled_for) {
        const fecha = new Date(tarea.scheduled_for);
        fechaInfo = `Programada: ${fecha.toLocaleString('es-ES')}`;
      } else if (tarea.due_date) {
        const fecha = new Date(tarea.due_date);
        fechaInfo = `Fecha límite: ${fecha.toLocaleDateString('es-ES')}`;
      }
      
      const mensaje = `TAREA DE SEGUIMIENTO COMERCIAL\n\n` +
        `Título: ${tarea.title}\n` +
        `${tarea.description ? `Descripción: ${tarea.description}\n` : ''}` +
        `Tipo: ${tipoNombre}\n` +
        `Estado: ${estadoNombre}\n` +
        `Prioridad: ${prioridadNombre}\n` +
        `${fechaInfo}\n` +
        `${tarea.client ? `Cliente: ${tarea.client.nombre || tarea.client.razon_social || 'N/A'}\n` : ''}` +
        `${tarea.assigned_user ? `Asignado a: ${tarea.assigned_user.name}\n` : ''}` +
        `\n→ Ve a Seguimiento Comercial para gestionar esta tarea`;
      
      alert(mensaje);
      return;
    }

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
            {/* Estadísticas de eventos integradas */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between flex-wrap gap-4">
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
                </div>
              </div>
            </div>

            <Calendar
              selectable
              events={calevents}
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
    </>
  );
};

export default CalendarApp;

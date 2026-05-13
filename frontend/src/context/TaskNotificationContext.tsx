import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  priorityConfigService,
  PriorityConfig,
  SeguimientoItem,
  seguimientoService,
} from 'src/services/seguimientoService';
import { useWhatsAppNotifications } from './WhatsAppNotificationContext';

export interface TaskNotification {
  id: string; // task-${taskId}-${notificationIndex}
  taskId: number;
  title: string;
  message: string;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  dueDate: string;
  type: 'task' | 'renovacion';
  timestamp: Date;
  read: boolean;
}

interface TaskNotificationContextType {
  notifications: TaskNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  /** Refrescar manualmente las tareas y volver a evaluar notificaciones */
  refresh: () => Promise<void>;
  /** Dismissar para siempre una notificación de una tarea/ocurrencia (no se vuelve a mostrar) */
  dismiss: (id: string) => void;
}

const TaskNotificationContext = createContext<TaskNotificationContextType | null>(null);

const defaultValue: TaskNotificationContextType = {
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  refresh: async () => {},
  dismiss: () => {},
};

export const useTaskNotifications = () => useContext(TaskNotificationContext) || defaultValue;

const SHOWN_KEY = 'task_notifications_shown_v2';
const READ_KEY = 'task_notifications_read_v2';

interface ShownEntry {
  taskId: number;
  occurrenceIndex: number; // 0 = first notification, 1 = first repeat, etc.
  shownAt: string; // ISO
}

const loadShown = (): ShownEntry[] => {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveShown = (entries: ShownEntry[]) => {
  try {
    // Limpiar entradas mayores a 7 días para no inflar localStorage
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtered = entries.filter((e) => new Date(e.shownAt).getTime() > cutoff);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
};

const loadRead = (): Set<string> => {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveRead = (set: Set<string>) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set)));
  } catch { /* ignore */ }
};

interface Props {
  children: React.ReactNode;
}

export const TaskNotificationProvider: React.FC<Props> = ({ children }) => {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [priorityConfigs, setPriorityConfigs] = useState<Record<string, PriorityConfig>>({});
  const shownRef = useRef<ShownEntry[]>(loadShown());
  const readRef = useRef<Set<string>>(loadRead());

  // Reusar el sistema de sonido/desktop del WhatsApp context (ya está cargado en App.tsx)
  const { soundEnabled, desktopNotificationsEnabled } = useWhatsAppNotifications();

  /** Reproducir sonido de notificación de tareas (tono distinto al de WhatsApp) */
  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  }, [soundEnabled]);

  const showDesktop = useCallback((title: string, body: string) => {
    if (
      desktopNotificationsEnabled &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'guro-task' });
        n.onclick = () => {
          window.focus();
          n.close();
        };
        setTimeout(() => n.close(), 6000);
      } catch { /* ignore */ }
    }
  }, [desktopNotificationsEnabled]);

  /** Cargar configuraciones de prioridad */
  const loadConfigs = useCallback(async () => {
    try {
      const res = await priorityConfigService.getConfigs();
      const map: Record<string, PriorityConfig> = {};
      (res.data || []).forEach((c) => { map[c.priority_key] = c; });
      setPriorityConfigs(map);
    } catch (e) {
      console.warn('[TaskNotif] no se pudieron cargar priority_configs', e);
    }
  }, []);

  /**
   * Calcula si una tarea debe disparar una notificación AHORA, dado su priority_config.
   * Devuelve el índice de ocurrencia (0 = primera, 1 = primera repetición, ...) o -1 si no toca.
   */
  const computeOccurrence = (
    task: SeguimientoItem,
    config: PriorityConfig,
    now: Date,
  ): number => {
    if (!config.enabled) return -1;
    const refStr = task.due_date || task.scheduled_for;
    if (!refStr) return -1;
    const ref = new Date(refStr);
    if (isNaN(ref.getTime())) return -1;

    // first_notification_minutes ANTES de la fecha de referencia
    const firstAt = new Date(ref.getTime() - config.first_notification_minutes * 60_000);

    if (now < firstAt) return -1;
    // Si ya pasó la fecha de referencia + 1 día, dejar de notificar
    const stopAt = new Date(ref.getTime() + 24 * 60 * 60 * 1000);
    if (now > stopAt) return -1;

    // Calcular cuántas ocurrencias deberían haberse disparado hasta ahora
    if (config.repeat_every_minutes <= 0) return 0; // sin repetición → solo la primera
    const elapsedMin = (now.getTime() - firstAt.getTime()) / 60_000;
    const idx = Math.floor(elapsedMin / config.repeat_every_minutes);
    const cap = Math.min(idx, config.max_notifications - 1);
    return Math.max(0, cap);
  };

  /** Evaluar todas las tareas y emitir notificaciones nuevas */
  const evaluate = useCallback(async () => {
    if (Object.keys(priorityConfigs).length === 0) return;
    try {
      const res = await seguimientoService.getSeguimientos({
        status: 'pendiente,en_progreso',
        per_page: 200,
      });
      const tasks = res.data || [];
      const now = new Date();
      const nuevos: TaskNotification[] = [];
      const shown = shownRef.current;

      for (const t of tasks) {
        const cfg = priorityConfigs[t.priority];
        if (!cfg) continue;
        const occIdx = computeOccurrence(t, cfg, now);
        if (occIdx < 0) continue;

        // Para cada ocurrencia desde 0 hasta occIdx, emitir si no se ha mostrado
        for (let i = 0; i <= occIdx; i++) {
          const exists = shown.some((s) => s.taskId === t.id && s.occurrenceIndex === i);
          if (exists) continue;

          const id = `task-${t.id}-${i}`;
          const refDate = new Date((t.due_date || t.scheduled_for)!);
          const minsToDue = Math.round((refDate.getTime() - now.getTime()) / 60_000);
          const dueText = minsToDue > 0
            ? minsToDue >= 1440 ? `en ${Math.round(minsToDue / 1440)}d`
              : minsToDue >= 60 ? `en ${Math.round(minsToDue / 60)}h`
              : `en ${minsToDue}min`
            : minsToDue >= -60 ? 'ahora' : 'vencida';

          nuevos.push({
            id,
            taskId: t.id,
            title: i === 0 ? `🔔 ${cfg.label}: ${t.title}` : `🔁 Recordatorio (${cfg.label}): ${t.title}`,
            message: `${t.client?.name ? t.client.name + ' · ' : ''}${dueText}`,
            priority: t.priority,
            dueDate: t.due_date || t.scheduled_for || '',
            type: 'task',
            timestamp: now,
            read: readRef.current.has(id),
          });

          shown.push({ taskId: t.id, occurrenceIndex: i, shownAt: now.toISOString() });
        }
      }

      if (nuevos.length > 0) {
        shownRef.current = shown;
        saveShown(shown);
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          const merged = [...nuevos.filter((n) => !ids.has(n.id)), ...prev].slice(0, 80);
          return merged;
        });
        // Sonido + desktop solo para los no-leídos
        const fresh = nuevos.filter((n) => !n.read);
        if (fresh.length > 0) {
          playSound();
          showDesktop(fresh[0].title, fresh[0].message);
        }
      }
    } catch (e) {
      console.warn('[TaskNotif] evaluate error', e);
    }
  }, [priorityConfigs, playSound, showDesktop]);

  // Cargar configs al montar
  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Polling periódico
  useEffect(() => {
    if (Object.keys(priorityConfigs).length === 0) return;
    // Primera evaluación a los 4s, luego cada 60s
    const initial = setTimeout(() => evaluate(), 4000);
    const interval = setInterval(() => evaluate(), 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [priorityConfigs, evaluate]);

  const markAsRead = useCallback((id: string) => {
    readRef.current.add(id);
    saveRead(readRef.current);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => readRef.current.add(n.id));
      saveRead(readRef.current);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismiss = useCallback((id: string) => {
    readRef.current.add(id);
    saveRead(readRef.current);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <TaskNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        refresh: evaluate,
        dismiss,
      }}
    >
      {children}
    </TaskNotificationContext.Provider>
  );
};

export default TaskNotificationContext;

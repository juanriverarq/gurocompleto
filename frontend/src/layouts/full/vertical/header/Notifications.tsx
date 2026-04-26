import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Dropdown, Badge, Tooltip } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppNotifications } from "src/context/WhatsAppNotificationContext";
import { useTaskNotifications, TaskNotification } from "src/context/TaskNotificationContext";

interface GroupedNotification {
  phone: string;
  count: number;
  lastMessage: string;
  conversationId?: number;
  timestamp: Date;
  ids: string[];
  read: boolean;
}

type Tab = 'all' | 'whatsapp' | 'tasks';

const PRIORITY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  baja: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', icon: 'solar:flag-bold-duotone' },
  media: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: 'solar:flag-2-bold-duotone' },
  alta: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', icon: 'solar:shield-warning-bold-duotone' },
  critica: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: 'solar:danger-triangle-bold-duotone' },
};

const Notifications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const {
    notifications: waNotifications,
    unreadCount: waUnread,
    markAsRead: waMarkAsRead,
    markAllAsRead: waMarkAllAsRead,
    clearNotifications: waClear,
    soundEnabled,
    setSoundEnabled,
    desktopNotificationsEnabled,
    requestDesktopPermission,
  } = useWhatsAppNotifications();

  const {
    notifications: taskNotifications,
    unreadCount: taskUnread,
    markAsRead: taskMarkAsRead,
    markAllAsRead: taskMarkAllAsRead,
    dismiss: taskDismiss,
    clearNotifications: taskClear,
  } = useTaskNotifications();

  const totalUnread = waUnread + taskUnread;

  // Agrupar notificaciones de WhatsApp por remitente
  const groupedWa = useMemo((): GroupedNotification[] => {
    const groups = new Map<string, GroupedNotification>();
    for (const n of waNotifications) {
      const existing = groups.get(n.phone);
      if (existing) {
        existing.count += 1;
        existing.ids.push(n.id);
        if (!n.read) existing.read = false;
        if (n.timestamp > existing.timestamp) {
          existing.timestamp = n.timestamp;
          existing.lastMessage = n.message;
          if (n.conversationId) existing.conversationId = n.conversationId;
        }
      } else {
        groups.set(n.phone, {
          phone: n.phone,
          count: 1,
          lastMessage: n.message,
          conversationId: n.conversationId,
          timestamp: n.timestamp,
          ids: [n.id],
          read: n.read,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [waNotifications]);

  const sortedTasks = useMemo(() => {
    return [...taskNotifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [taskNotifications]);

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const handleWaClick = (group: GroupedNotification) => {
    group.ids.forEach((id) => waMarkAsRead(id));
    const url = group.conversationId
      ? `/apps/whatsapp/inbox?conversation=${group.conversationId}`
      : '/apps/whatsapp/inbox';
    try {
      navigate(url);
    } catch {
      window.location.href = url;
    }
  };

  const handleTaskClick = (n: TaskNotification) => {
    taskMarkAsRead(n.id);
    const url = `/apps/seguros/seguimiento?task=${n.taskId}`;
    try {
      navigate(url);
    } catch {
      window.location.href = url;
    }
  };

  const markAllVisible = () => {
    if (activeTab === 'whatsapp' || activeTab === 'all') waMarkAllAsRead();
    if (activeTab === 'tasks' || activeTab === 'all') taskMarkAllAsRead();
  };

  const clearVisible = () => {
    if (activeTab === 'whatsapp' || activeTab === 'all') waClear();
    if (activeTab === 'tasks' || activeTab === 'all') taskClear();
  };

  const showWa = activeTab === 'all' || activeTab === 'whatsapp';
  const showTasks = activeTab === 'all' || activeTab === 'tasks';
  const isEmpty = (showWa ? groupedWa.length === 0 : true) && (showTasks ? sortedTasks.length === 0 : true);

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="w-screen sm:w-[400px] py-4 rounded-xl z-[30]"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="relative">
            <span className="h-10 w-10 hover:bg-lightprimary text-darklink dark:text-white rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              <Icon icon="solar:bell-bing-line-duotone" height={20} />
            </span>
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </div>
        )}
      >
        {/* Header */}
        <div className="flex items-center px-4 justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:bell-bold" className="text-primary" height={20} />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notificaciones</h3>
            {totalUnread > 0 && <Badge color="failure" size="sm">{totalUnread}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content={soundEnabled ? 'Silenciar' : 'Activar sonido'}>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundEnabled ? 'text-primary bg-primary/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon icon={soundEnabled ? 'solar:volume-loud-bold' : 'solar:volume-cross-bold'} height={16} />
              </button>
            </Tooltip>
            {(waNotifications.length > 0 || taskNotifications.length > 0) && (
              <Tooltip content="Marcar todo como leído">
                <button
                  onClick={markAllVisible}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icon icon="solar:check-read-bold" height={16} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 mb-3">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <TabButton
              label="Todas"
              active={activeTab === 'all'}
              count={totalUnread}
              onClick={() => setActiveTab('all')}
            />
            <TabButton
              label="WhatsApp"
              icon="ic:baseline-whatsapp"
              active={activeTab === 'whatsapp'}
              count={waUnread}
              onClick={() => setActiveTab('whatsapp')}
            />
            <TabButton
              label="Tareas"
              icon="solar:checklist-minimalistic-bold-duotone"
              active={activeTab === 'tasks'}
              count={taskUnread}
              onClick={() => setActiveTab('tasks')}
            />
          </div>
        </div>

        {/* Notificaciones de escritorio prompt */}
        {!desktopNotificationsEnabled && (
          <div className="mx-4 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Icon icon="solar:bell-bing-bold" className="text-blue-500 mt-0.5" height={18} />
              <div className="flex-1">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Activa las notificaciones de escritorio para no perderte WhatsApps ni tareas
                </p>
                <button
                  onClick={() => requestDesktopPermission()}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Activar notificaciones →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="max-h-[400px] overflow-y-auto">
          {isEmpty ? (
            <div className="px-4 py-8 text-center">
              <Icon
                icon="solar:inbox-line-bold-duotone"
                height={48}
                className="text-gray-300 dark:text-gray-600 mx-auto mb-3"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay notificaciones</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Aparecerán aquí mensajes de WhatsApp y recordatorios de tareas
              </p>
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {/* Tareas (van primero porque suelen ser más urgentes) */}
              {showTasks && sortedTasks.slice(0, 12).map((n) => {
                const style = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.media;
                return (
                  <div
                    key={n.id}
                    className={`relative w-full p-3 rounded-lg transition-colors group/item ${
                      n.read
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        : `${style.bg} hover:opacity-90`
                    }`}
                  >
                    <button
                      onClick={() => handleTaskClick(n)}
                      className="w-full text-left flex items-start gap-3"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        n.read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white/70 dark:bg-gray-900/40'
                      }`}>
                        <Icon icon={style.icon} className={style.text} height={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${
                            n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'
                          }`}>
                            {n.title}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTime(n.timestamp)}
                          </span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${
                          n.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'
                        }`}>
                          {n.message}
                        </p>
                      </div>
                      {!n.read && <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${style.text.replace('text-', 'bg-')}`} />}
                    </button>
                    <Tooltip content="Descartar">
                      <button
                        onClick={(e) => { e.stopPropagation(); taskDismiss(n.id); }}
                        className="absolute top-2 right-2 p-1 rounded text-gray-400 opacity-0 group-hover/item:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      >
                        <Icon icon="solar:close-circle-bold" height={14} />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}

              {/* Separador entre tareas y whatsapp si ambos visibles */}
              {showTasks && showWa && sortedTasks.length > 0 && groupedWa.length > 0 && (
                <div className="text-[10px] uppercase tracking-wider text-gray-400 px-2 pt-2 pb-1 font-semibold">
                  WhatsApp
                </div>
              )}

              {/* WhatsApp */}
              {showWa && groupedWa.slice(0, 10).map((group) => (
                <button
                  key={group.phone}
                  onClick={() => handleWaClick(group)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    group.read
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        group.read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-green-100 dark:bg-green-800'
                      }`}>
                        <Icon
                          icon="ic:baseline-whatsapp"
                          height={20}
                          className={group.read ? 'text-gray-500' : 'text-green-600'}
                        />
                      </div>
                      {group.count > 1 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                          {group.count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${
                          group.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'
                        }`}>
                          {group.phone}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatTime(group.timestamp)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${
                        group.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {group.count > 1 ? `${group.count} mensajes` : group.lastMessage}
                      </p>
                    </div>
                    {!group.read && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-2" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {(waNotifications.length > 0 || taskNotifications.length > 0) && (
          <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3 px-4 flex items-center justify-between">
            <button
              onClick={() => navigate(activeTab === 'whatsapp' ? '/apps/whatsapp/inbox' : '/apps/calendar')}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              {activeTab === 'whatsapp' ? 'Ver conversaciones' : 'Ver calendario'}
            </button>
            <button
              onClick={clearVisible}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Limpiar
            </button>
          </div>
        )}
      </Dropdown>
    </div>
  );
};

const TabButton = ({
  label,
  icon,
  active,
  count,
  onClick,
}: {
  label: string;
  icon?: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
    }`}
  >
    {icon && <Icon icon={icon} height={14} />}
    <span>{label}</span>
    {count > 0 && (
      <span className={`text-[10px] font-bold rounded-full px-1.5 ${active ? 'bg-primary text-white' : 'bg-red-500 text-white'}`}>
        {count > 9 ? '9+' : count}
      </span>
    )}
  </button>
);

export default Notifications;

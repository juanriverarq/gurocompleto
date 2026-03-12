import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { Dropdown, Badge, Tooltip } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppNotifications } from "src/context/WhatsAppNotificationContext";

interface GroupedNotification {
  phone: string;
  count: number;
  lastMessage: string;
  conversationId?: number;
  timestamp: Date;
  ids: string[];
  read: boolean;
}

const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    soundEnabled,
    setSoundEnabled,
    desktopNotificationsEnabled,
    requestDesktopPermission,
  } = useWhatsAppNotifications();

  // Agrupar notificaciones por remitente (phone)
  const groupedNotifications = useMemo((): GroupedNotification[] => {
    const groups = new Map<string, GroupedNotification>();
    
    for (const n of notifications) {
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
  }, [notifications]);

  const handleGroupClick = (group: GroupedNotification) => {
    group.ids.forEach(id => markAsRead(id));
    const url = group.conversationId 
      ? `/apps/whatsapp/inbox?conversation=${group.conversationId}`
      : '/apps/whatsapp/inbox';
    
    try {
      navigate(url);
    } catch {
      window.location.href = url;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const handleEnableDesktop = async () => {
    await requestDesktopPermission();
  };

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="w-screen sm:w-[380px] py-4 rounded-xl z-[30]"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="relative">
            <span className="h-10 w-10 hover:bg-lightprimary text-darklink dark:text-white rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              <Icon icon="solar:bell-bing-line-duotone" height={20} />
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        )}
      >
        {/* Header */}
        <div className="flex items-center px-4 justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:bell-bold" className="text-primary" height={20} />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Notificaciones
            </h3>
            {unreadCount > 0 && (
              <Badge color="failure" size="sm">{unreadCount}</Badge>
            )}
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
            {notifications.length > 0 && (
              <Tooltip content="Marcar todo como leído">
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icon icon="solar:check-read-bold" height={16} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Notificaciones de escritorio */}
        {!desktopNotificationsEnabled && (
          <div className="mx-4 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Icon icon="solar:bell-bing-bold" className="text-blue-500 mt-0.5" height={18} />
              <div className="flex-1">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Activa las notificaciones de escritorio para no perderte ningún mensaje
                </p>
                <button
                  onClick={handleEnableDesktop}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Activar notificaciones →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de notificaciones */}
        <div className="max-h-[350px] overflow-y-auto">
          {groupedNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Icon
                icon="solar:inbox-line-bold-duotone"
                height={48}
                className="text-gray-300 dark:text-gray-600 mx-auto mb-3"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay notificaciones
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Los nuevos mensajes de WhatsApp aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {groupedNotifications.slice(0, 10).map((group) => (
                <button
                  key={group.phone}
                  onClick={() => handleGroupClick(group)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    group.read
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        group.read 
                          ? 'bg-gray-100 dark:bg-gray-700' 
                          : 'bg-green-100 dark:bg-green-800'
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
                          group.read 
                            ? 'text-gray-700 dark:text-gray-300' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {group.phone}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatTime(group.timestamp)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${
                        group.read 
                          ? 'text-gray-500 dark:text-gray-400' 
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {group.count > 1 ? `${group.count} mensajes` : group.lastMessage}
                      </p>
                    </div>
                    {!group.read && (
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3 px-4 flex items-center justify-between">
            <button
              onClick={() => navigate('/apps/whatsapp/inbox')}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Ver todas las conversaciones
            </button>
            <button
              onClick={clearNotifications}
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

export default Notifications;

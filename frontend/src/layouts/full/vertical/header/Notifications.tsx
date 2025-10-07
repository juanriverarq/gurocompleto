import { Icon } from "@iconify/react";
import { Badge, Button, Dropdown } from "flowbite-react";
import { Link } from "react-router";
import { useNotifications } from "../../../../hooks/useNotifications";

const Notifications = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications
  } = useNotifications(true, 120000); // Auto-cargar, polling cada 2 minutos


  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return notificationDate.toLocaleDateString('es-ES');
  };

  const getNotificationIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      poliza: "solar:file-smile-bold-duotone",
      siniestro: "solar:danger-triangle-bold-duotone", 
      renovacion: "solar:refresh-bold-duotone",
      pago: "solar:card-bold-duotone",
      cliente: "solar:user-plus-bold-duotone",
      info: "solar:info-circle-bold-duotone",
      success: "solar:check-circle-bold-duotone",
      warning: "solar:danger-triangle-bold-duotone",
      error: "solar:close-circle-bold-duotone"
    };
    return iconMap[type] || "solar:bell-bing-bold-duotone";
  };

  const getNotificationBgColor = (type: string, priority: string): string => {
    if (priority === 'urgent') return "bg-lighterror dark:bg-lighterror";
    
    const colorMap: Record<string, string> = {
      poliza: "bg-lightprimary dark:bg-lightprimary",
      siniestro: "bg-lighterror dark:bg-lighterror",
      renovacion: "bg-lightwarning dark:bg-lightwarning",
      pago: "bg-lightsuccess dark:bg-lightsuccess", 
      cliente: "bg-lightsecondary dark:bg-lightsecondary",
      info: "bg-lightprimary dark:bg-lightprimary",
      success: "bg-lightsuccess dark:bg-lightsuccess",
      warning: "bg-lightwarning dark:bg-lightwarning",
      error: "bg-lighterror dark:bg-lighterror"
    };
    return colorMap[type] || "bg-lightprimary dark:bg-lightprimary";
  };

  const getNotificationColor = (type: string, priority: string): string => {
    if (priority === 'urgent') return "text-error";
    
    const colorMap: Record<string, string> = {
      poliza: "text-primary",
      siniestro: "text-error",
      renovacion: "text-warning", 
      pago: "text-success",
      cliente: "text-secondary",
      info: "text-primary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error"
    };
    return colorMap[type] || "text-primary";
  };

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    try {
      // Marcar como leída
      await markAsRead(notificationId);

      // Navegar si hay URL de acción
      if (actionUrl) {
        window.location.href = actionUrl;
      }
    } catch (error) {
      console.error('Error al manejar click en notificación:', error);
    }
  };

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="w-screen sm:w-[360px] py-6 rounded-sm"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="relative">
            <span className="h-10 w-10 hover:bg-lightprimary text-darklink dark:text-white rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              <Icon icon="solar:bell-bing-line-duotone" height={20} />
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full absolute end-1 top-1 bg-error text-[10px] h-4 w-4 flex justify-center items-center text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        )}
      >
        <div className="flex items-center px-6 justify-between">
          <h3 className="mb-0 text-lg font-semibold text-ld">Notificaciones</h3>
          {unreadCount > 0 && (
            <Badge color={"primary"}>{unreadCount} nuevas</Badge>
          )}
        </div>

        <div className="max-h-80 mt-3 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-8 text-center">
              <Icon 
                icon="solar:loading-line-duotone" 
                height={24} 
                className="text-primary mx-auto mb-3 animate-spin" 
              />
              <p className="text-bodytext">Cargando notificaciones...</p>
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification, index) => (
              <Dropdown.Item
                onClick={() => handleNotificationClick(notification.id, notification.action_url)}
                className={`px-6 py-3 flex justify-between items-center bg-hover group/link w-full cursor-pointer ${
                  !notification.read ? 'bg-lightprimary/30 dark:bg-lightprimary/10' : ''
                }`}
                key={notification.id}
              >
                <div className="flex items-center w-full">
                  <div className="relative">
                    <div
                      className={`h-11 w-11 flex-shrink-0 rounded-full flex justify-center items-center ${getNotificationBgColor(notification.type, notification.priority)}`}
                    >
                      <Icon icon={getNotificationIcon(notification.type)} height={20} className={getNotificationColor(notification.type, notification.priority)} />
                    </div>
                    {!notification.read && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></div>
                    )}
                    {notification.priority === 'urgent' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div className="ps-4 flex justify-between w-full">
                    <div className="w-3/4 text-start">
                      <h5 className={`mb-1 text-15 font-semibold group-hover/link:text-primary ${
                        !notification.read ? 'text-dark dark:text-white font-bold' : 'text-bodytext'
                      }`}>
                        {notification.title}
                      </h5>
                      <div className="text-sm text-bodytext line-clamp-2">
                        {notification.message}
                      </div>
                      {notification.priority === 'urgent' && (
                        <Badge color="failure" size="sm" className="mt-1">
                          Urgente
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs block self-start pt-1.5 text-bodytext">
                      {formatTimeAgo(notification.created_at)}
                    </div>
                  </div>
                </div>
              </Dropdown.Item>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <Icon 
                icon="solar:bell-off-bold-duotone" 
                height={48} 
                className="text-gray-400 mx-auto mb-3" 
              />
              <p className="text-gray-500">No hay notificaciones</p>
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="pt-5 px-6 border-t dark:border-darkborder">
            <div className="flex gap-2">
              <Button
                color={"primary"}
                className="flex-1"
                onClick={markAllAsRead}
                disabled={loading || unreadCount === 0}
              >
                {loading ? (
                  <>
                    <Icon icon="solar:loading-line-duotone" className="animate-spin mr-2" height={16} />
                    Procesando...
                  </>
                ) : (
                  'Marcar como leídas'
                )}
              </Button>
              <Button
                color={"light"}
                className="flex-1"
                onClick={deleteAllNotifications}
                disabled={loading || notifications.length === 0}
              >
                {loading ? 'Procesando...' : 'Limpiar todo'}
              </Button>
            </div>
          </div>
        )}
      </Dropdown>
    </div>
  );
};

export default Notifications;

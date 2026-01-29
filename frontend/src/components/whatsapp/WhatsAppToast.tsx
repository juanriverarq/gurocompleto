import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useWhatsAppNotifications, WhatsAppNotification } from 'src/context/WhatsAppNotificationContext';

interface ToastItem extends WhatsAppNotification {
  visible: boolean;
}

/**
 * Componente que muestra toasts/alertas cuando llegan nuevos mensajes de WhatsApp
 * Se muestra en la esquina inferior derecha de la pantalla
 */
const WhatsAppToast: React.FC = () => {
  const { notifications, markAsRead, unreadCount } = useWhatsAppNotifications();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showFloatingBadge, setShowFloatingBadge] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Detectar si estamos en el inbox usando window.location
  const isInInbox = typeof window !== 'undefined' && window.location.pathname.includes('/whatsapp/inbox');

  // Detectar nuevas notificaciones y mostrar toast
  useEffect(() => {
    console.log('🔔 [WhatsAppToast] Notificaciones:', notifications.length, 'No leídas:', notifications.filter(n => !n.read).length);
    
    const unreadNotifications = notifications.filter(n => !n.read);
    
    // Solo mostrar toasts para notificaciones nuevas (últimos 10 segundos - aumentado para debug)
    const recentNotifications = unreadNotifications.filter(n => {
      const age = Date.now() - n.timestamp.getTime();
      console.log('🔔 [WhatsAppToast] Notificación edad:', age, 'ms, ID:', n.id);
      return age < 10000; // 10 segundos para dar más margen
    });

    console.log('🔔 [WhatsAppToast] Notificaciones recientes:', recentNotifications.length);

    recentNotifications.forEach(notification => {
      // Verificar si ya existe este toast
      if (!toasts.some(t => t.id === notification.id)) {
        console.log('🔔 [WhatsAppToast] Mostrando toast para:', notification.phone, notification.message);
        setToasts(prev => [...prev, { ...notification, visible: true }]);
        
        // Auto-ocultar después de 8 segundos (más tiempo para leer)
        setTimeout(() => {
          setToasts(prev => prev.map(t => 
            t.id === notification.id ? { ...t, visible: false } : t
          ));
          
          // Remover del DOM después de la animación
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== notification.id));
          }, 300);
        }, 8000);
      }
    });
  }, [notifications, toasts]);

  // Mostrar badge flotante si hay mensajes no leídos y no estamos en inbox
  useEffect(() => {
    setShowFloatingBadge(unreadCount > 0 && !isInInbox);
  }, [unreadCount, isInInbox]);

  const navigateToChat = (conversationId?: number) => {
    const url = conversationId 
      ? `/apps/whatsapp/inbox?conversation=${conversationId}`
      : '/apps/whatsapp/inbox';
    window.location.href = url;
  };

  const handleClick = (toast: ToastItem) => {
    markAsRead(toast.id);
    setToasts(prev => prev.filter(t => t.id !== toast.id));
    navigateToChat(toast.conversationId);
  };

  const handleDismiss = (e: React.MouseEvent, toastId: string) => {
    e.stopPropagation();
    setToasts(prev => prev.map(t => 
      t.id === toastId ? { ...t, visible: false } : t
    ));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 300);
  };

  const handleFloatingClick = () => {
    if (isExpanded) {
      // Si está expandido, ir al inbox
      navigateToChat();
    } else {
      // Si no, expandir para mostrar las notificaciones
      setIsExpanded(true);
    }
  };

  // Obtener las últimas 3 notificaciones no leídas para el badge expandido
  const recentUnread = notifications.filter(n => !n.read).slice(0, 3);

  return (
    <>
      {/* Toasts de notificación (aparecen temporalmente) */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => handleClick(toast)}
            className={`
              bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-green-200 dark:border-green-700
              p-4 cursor-pointer transform transition-all duration-300 ease-out
              hover:scale-[1.02] hover:shadow-3xl ring-2 ring-green-400/50
              ${toast.visible 
                ? 'translate-x-0 opacity-100' 
                : 'translate-x-full opacity-0'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Icono de WhatsApp */}
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg animate-pulse">
                <Icon icon="ic:baseline-whatsapp" className="text-white" height={28} />
              </div>
              
              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {toast.phone}
                  </p>
                  <button
                    onClick={(e) => handleDismiss(e, toast.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold" height={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  {toast.message || '[Multimedia]'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Icon icon="solar:clock-circle-bold" height={12} />
                    Ahora mismo
                  </p>
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Icon icon="solar:arrow-right-bold" height={12} />
                    Clic para abrir
                  </span>
                </div>
              </div>
            </div>
            
            {/* Barra de progreso */}
            <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full animate-shrink-width"
                style={{ animationDuration: '8s' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Badge flotante persistente (cuando hay mensajes no leídos) */}
      {showFloatingBadge && toasts.length === 0 && (
        <div 
          className={`fixed bottom-4 right-4 z-[9998] transition-all duration-300 ${isExpanded ? 'w-80' : 'w-auto'}`}
          onMouseLeave={() => setIsExpanded(false)}
        >
          {isExpanded ? (
            /* Vista expandida con lista de mensajes */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-green-200 dark:border-green-700 overflow-hidden">
              <div className="bg-green-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Icon icon="ic:baseline-whatsapp" height={24} />
                  <span className="font-semibold">{unreadCount} mensaje{unreadCount !== 1 ? 's' : ''} nuevo{unreadCount !== 1 ? 's' : ''}</span>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="text-white/80 hover:text-white"
                >
                  <Icon icon="solar:minimize-bold" height={18} />
                </button>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {recentUnread.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      markAsRead(notif.id);
                      navigateToChat(notif.conversationId);
                    }}
                    className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Icon icon="solar:user-bold" className="text-green-600" height={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {notif.phone}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {notif.message || '[Multimedia]'}
                        </p>
                      </div>
                      <Icon icon="solar:arrow-right-bold" className="text-gray-400" height={16} />
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => navigateToChat()}
                className="w-full px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium text-sm hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors flex items-center justify-center gap-2"
              >
                <Icon icon="solar:inbox-bold" height={18} />
                Ver todos en Inbox
              </button>
            </div>
          ) : (
            /* Vista compacta (solo badge) */
            <button
              onClick={handleFloatingClick}
              onMouseEnter={() => setIsExpanded(true)}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 animate-bounce-subtle"
            >
              <div className="relative">
                <Icon icon="ic:baseline-whatsapp" height={24} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
              <span className="font-medium">Mensajes nuevos</span>
            </button>
          )}
        </div>
      )}

      {/* Estilos para animación sutil */}
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default WhatsAppToast;

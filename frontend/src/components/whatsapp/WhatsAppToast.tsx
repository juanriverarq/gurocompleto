import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useWhatsAppNotifications } from 'src/context/WhatsAppNotificationContext';

interface GroupedToast {
  phone: string;
  count: number;
  lastMessage: string;
  conversationId?: number;
  notificationIds: string[];
  visible: boolean;
  createdAt: number;
}

/**
 * Componente que muestra toasts/alertas cuando llegan nuevos mensajes de WhatsApp
 * Se muestra en la esquina inferior derecha de la pantalla
 * - Agrupa mensajes del mismo remitente (muestra nombre + cantidad)
 * - Sonido contundente en cada nuevo mensaje
 * - Ventana grande y visible abajo a la derecha
 */
const WhatsAppToast: React.FC = () => {
  const { notifications, markAsRead, unreadCount } = useWhatsAppNotifications();
  const [groupedToasts, setGroupedToasts] = useState<GroupedToast[]>([]);
  const [showFloatingBadge, setShowFloatingBadge] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Detectar si estamos en el inbox
  const isInInbox = typeof window !== 'undefined' && window.location.pathname.includes('/whatsapp/inbox');

  // Resetear timer de auto-dismiss para un grupo
  const resetDismissTimer = useCallback((phone: string) => {
    const existing = dismissTimersRef.current.get(phone);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setGroupedToasts(prev => prev.map(g =>
        g.phone === phone ? { ...g, visible: false } : g
      ));
      setTimeout(() => {
        setGroupedToasts(prev => prev.filter(g => g.phone !== phone));
        dismissTimersRef.current.delete(phone);
      }, 400);
    }, 10000); // 10 segundos visible

    dismissTimersRef.current.set(phone, timer);
  }, []);

  // Agregar una notificación al toast (agrupada por remitente)
  const addToast = useCallback((notif: { id: string; phone: string; message: string; conversationId?: number }) => {
    console.log('🔔 [WhatsAppToast] addToast:', notif.phone, notif.message);
    
    setGroupedToasts(prev => {
      const updated = [...prev];
      const existing = updated.find(g => g.phone === notif.phone);
      if (existing) {
        existing.count += 1;
        existing.lastMessage = notif.message || '[Multimedia]';
        existing.notificationIds.push(notif.id);
        if (notif.conversationId) existing.conversationId = notif.conversationId;
        existing.visible = true;
        existing.createdAt = Date.now();
      } else {
        updated.push({
          phone: notif.phone,
          count: 1,
          lastMessage: notif.message || '[Multimedia]',
          conversationId: notif.conversationId,
          notificationIds: [notif.id],
          visible: true,
          createdAt: Date.now(),
        });
      }
      return updated;
    });

    resetDismissTimer(notif.phone);
  }, [resetDismissTimer]);

  // Escuchar evento custom disparado por WhatsAppNotificationContext
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.phone) {
        addToast(detail);
      }
    };

    window.addEventListener('whatsapp-new-notification', handler);
    return () => window.removeEventListener('whatsapp-new-notification', handler);
  }, [addToast]);

  // Badge flotante
  useEffect(() => {
    setShowFloatingBadge(unreadCount > 0 && !isInInbox);
  }, [unreadCount, isInInbox]);

  const navigateToChat = (conversationId?: number) => {
    const url = conversationId
      ? `/apps/whatsapp/inbox?conversation=${conversationId}`
      : '/apps/whatsapp/inbox';
    window.location.href = url;
  };

  const handleToastClick = (toast: GroupedToast) => {
    toast.notificationIds.forEach(id => markAsRead(id));
    setGroupedToasts(prev => prev.filter(g => g.phone !== toast.phone));
    const timer = dismissTimersRef.current.get(toast.phone);
    if (timer) { clearTimeout(timer); dismissTimersRef.current.delete(toast.phone); }
    navigateToChat(toast.conversationId);
  };

  const handleDismiss = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    setGroupedToasts(prev => prev.map(g =>
      g.phone === phone ? { ...g, visible: false } : g
    ));
    const timer = dismissTimersRef.current.get(phone);
    if (timer) { clearTimeout(timer); dismissTimersRef.current.delete(phone); }
    setTimeout(() => {
      setGroupedToasts(prev => prev.filter(g => g.phone !== phone));
    }, 400);
  };

  const handleFloatingClick = () => {
    if (isExpanded) {
      navigateToChat();
    } else {
      setIsExpanded(true);
    }
  };

  // Agrupar notificaciones no leídas por teléfono para el badge expandido
  const groupedUnread = React.useMemo(() => {
    const unread = notifications.filter(n => !n.read);
    const groups: { phone: string; count: number; lastMessage: string; conversationId?: number; ids: string[] }[] = [];
    unread.forEach(n => {
      const existing = groups.find(g => g.phone === n.phone);
      if (existing) {
        existing.count += 1;
        existing.lastMessage = n.message || '[Multimedia]';
        existing.ids.push(n.id);
        if (n.conversationId) existing.conversationId = n.conversationId;
      } else {
        groups.push({ phone: n.phone, count: 1, lastMessage: n.message || '[Multimedia]', conversationId: n.conversationId, ids: [n.id] });
      }
    });
    return groups.slice(0, 5);
  }, [notifications]);

  return (
    <>
      {/* Toasts de notificación agrupados por remitente */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3" style={{ width: 380, maxWidth: 'calc(100vw - 32px)' }}>
        {groupedToasts.map((toast) => (
          <div
            key={toast.phone}
            onClick={() => handleToastClick(toast)}
            className={`
              bg-white dark:bg-gray-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border-l-4 border-l-green-500
              border border-green-200/60 dark:border-green-700/60
              p-4 cursor-pointer transform transition-all duration-400 ease-out
              hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)]
              ${toast.visible
                ? 'translate-x-0 opacity-100'
                : 'translate-x-[120%] opacity-0'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Icono WhatsApp con badge de cantidad */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Icon icon="ic:baseline-whatsapp" className="text-white" height={32} />
                </div>
                {toast.count > 1 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 shadow-md shadow-red-500/40 animate-scale-in">
                    {toast.count}
                  </span>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {toast.phone}
                  </p>
                  <button
                    onClick={(e) => handleDismiss(e, toast.phone)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  >
                    <Icon icon="solar:close-circle-bold" height={20} />
                  </button>
                </div>
                {toast.count > 1 ? (
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1">
                    {toast.count} mensajes nuevos
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                    {toast.lastMessage}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Icon icon="solar:clock-circle-bold" height={12} />
                    Ahora mismo
                  </p>
                  <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Icon icon="solar:arrow-right-bold" height={12} />
                    Abrir chat
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                style={{ animation: 'shrink-width 10s linear forwards' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Badge flotante persistente */}
      {showFloatingBadge && groupedToasts.length === 0 && (
        <div
          className={`fixed bottom-4 right-4 z-[9998] transition-all duration-300 ${isExpanded ? 'w-96' : 'w-auto'}`}
          onMouseLeave={() => setIsExpanded(false)}
        >
          {isExpanded ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-green-200 dark:border-green-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Icon icon="ic:baseline-whatsapp" height={24} />
                  <span className="font-bold">{unreadCount} mensaje{unreadCount !== 1 ? 's' : ''} nuevo{unreadCount !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-white/80 hover:text-white"
                >
                  <Icon icon="solar:minimize-bold" height={18} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {groupedUnread.map((group) => (
                  <div
                    key={group.phone}
                    onClick={() => {
                      group.ids.forEach(id => markAsRead(id));
                      navigateToChat(group.conversationId);
                    }}
                    className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                          <Icon icon="solar:user-bold" className="text-green-600" height={20} />
                        </div>
                        {group.count > 1 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {group.count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {group.phone}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {group.count > 1 ? `${group.count} mensajes` : group.lastMessage}
                        </p>
                      </div>
                      <Icon icon="solar:arrow-right-bold" className="text-gray-400" height={16} />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigateToChat()}
                className="w-full px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-semibold text-sm hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors flex items-center justify-center gap-2"
              >
                <Icon icon="solar:inbox-bold" height={18} />
                Ver todos en Inbox
              </button>
            </div>
          ) : (
            <button
              onClick={handleFloatingClick}
              onMouseEnter={() => setIsExpanded(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl px-5 py-3.5 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all flex items-center gap-3 animate-bounce-subtle"
            >
              <div className="relative">
                <Icon icon="ic:baseline-whatsapp" height={28} />
                <span className="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 shadow-md">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
              <span className="font-bold text-sm">Mensajes nuevos</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        @keyframes shrink-width {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes scale-in {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default WhatsAppToast;

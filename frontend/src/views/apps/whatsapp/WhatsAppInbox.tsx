import React, { useState, useEffect, useRef } from 'react';
import { Badge, Button, Spinner, Alert, Avatar, Dropdown, TextInput, Textarea } from 'flowbite-react';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import whatsappInboxService, { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppDepartment,
  InboxStats 
} from 'src/services/whatsappInboxService';

const WhatsAppInbox: React.FC = () => {
  // Estados principales
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [departments, setDepartments] = useState<WhatsAppDepartment[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar conversaciones cuando cambia el filtro
  useEffect(() => {
    loadConversations();
  }, [filter, searchTerm]);

  // Scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [depts, statsData] = await Promise.all([
        whatsappInboxService.getDepartments(),
        whatsappInboxService.getStats(),
      ]);
      setDepartments(depts);
      setStats(statsData);
      await loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      let data;
      if (filter === 'mine') {
        data = await whatsappInboxService.getMyConversations();
        setConversations(data);
      } else {
        const filters: any = {};
        if (filter === 'unassigned') filters.assigned_to = 'unassigned';
        if (filter === 'pending') filters.status = 'pending';
        if (searchTerm) filters.search = searchTerm;
        const response = await whatsappInboxService.getConversations(filters);
        setConversations(response.data);
      }
    } catch (err: any) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      setLoadingMessages(true);
      const response = await whatsappInboxService.getConversationMessages(conversationId);
      // Mensajes ya vienen ordenados ASC (más antiguos primero) desde el backend
      setMessages(response.data);
    } catch (err: any) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = async (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setSendingMessage(true);
      const message = await whatsappInboxService.sendMessage(selectedConversation.id, newMessage);
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await whatsappInboxService.assignConversation(selectedConversation.id, 0); // 0 = current user
      setSelectedConversation(updated);
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolve = async () => {
    if (!selectedConversation) return;
    try {
      await whatsappInboxService.resolveConversation(selectedConversation.id);
      setSelectedConversation(null);
      loadConversations();
      loadInitialData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'warning',
      assigned: 'info',
      in_progress: 'primary',
      waiting_client: 'purple',
      resolved: 'success',
      closed: 'gray',
    };
    return colors[status] || 'gray';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'gray',
      medium: 'info',
      high: 'warning',
      urgent: 'failure',
    };
    return colors[priority] || 'gray';
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-CO', { weekday: 'short' });
    }
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header con estadísticas */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon icon="solar:inbox-bold-duotone" width={28} className="text-primary" />
              Inbox de WhatsApp
            </h1>
            <p className="text-gray-500 text-sm">Gestiona las conversaciones de tus clientes</p>
          </div>
          <Button color="primary" onClick={loadInitialData}>
            <Icon icon="solar:refresh-bold" className="mr-2" width={18} />
            Actualizar
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.my_conversations}</div>
              <div className="text-xs text-gray-500">Mis conversaciones</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-orange-500">{stats.my_unread}</div>
              <div className="text-xs text-gray-500">Sin leer</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-xs text-gray-500">Pendientes</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-blue-500">{stats.in_progress}</div>
              <div className="text-xs text-gray-500">En progreso</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-red-500">{stats.unassigned}</div>
              <div className="text-xs text-gray-500">Sin asignar</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-500">{stats.resolved_today}</div>
              <div className="text-xs text-gray-500">Resueltas hoy</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-500">{stats.total_conversations}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <CardBox className="flex-1 p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Lista de conversaciones */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Filtros */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1 mb-2">
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'mine', label: 'Mías' },
                  { key: 'unassigned', label: 'Sin asignar' },
                  { key: 'pending', label: 'Pendientes' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as any)}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      filter === f.key
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <TextInput
                icon={() => <Icon icon="solar:magnifer-linear" width={16} />}
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sizing="sm"
              />
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Icon icon="solar:inbox-line-duotone" width={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay conversaciones</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar
                          rounded
                          size="sm"
                          placeholderInitials={conv.contact_push_name?.charAt(0) || conv.phone.slice(-2)}
                        />
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {conv.contact_push_name || conv.contact_name || conv.phone}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{conv.phone}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge color={getStatusColor(conv.status)} size="xs">
                            {conv.status}
                          </Badge>
                          {conv.department && (
                            <Badge color="gray" size="xs">
                              {conv.department.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Área de chat */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Header del chat */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      rounded
                      placeholderInitials={selectedConversation.contact_push_name?.charAt(0) || selectedConversation.phone.slice(-2)}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {selectedConversation.contact_push_name || selectedConversation.contact_name || selectedConversation.phone}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedConversation.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={getStatusColor(selectedConversation.status)}>
                      {selectedConversation.status}
                    </Badge>
                    <Badge color={getPriorityColor(selectedConversation.priority)}>
                      {selectedConversation.priority}
                    </Badge>
                    <Dropdown
                      label=""
                      dismissOnClick
                      renderTrigger={() => (
                        <Button color="gray" size="sm">
                          <Icon icon="solar:menu-dots-bold" width={18} />
                        </Button>
                      )}
                    >
                      <Dropdown.Item onClick={handleAssignToMe}>
                        <Icon icon="solar:user-plus-bold" className="mr-2" width={16} />
                        Asignarme
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleResolve}>
                        <Icon icon="solar:check-circle-bold" className="mr-2" width={16} />
                        Resolver
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item>
                        <Icon icon="solar:tag-bold" className="mr-2" width={16} />
                        Cambiar departamento
                      </Dropdown.Item>
                    </Dropdown>
                  </div>
                </div>

                {/* Mensajes */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900"
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Spinner />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <Icon icon="solar:chat-line-bold-duotone" width={48} className="mx-auto mb-2 opacity-50" />
                        <p>No hay mensajes</p>
                      </div>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.direction === 'outgoing'
                              ? 'bg-primary text-white rounded-br-sm'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'
                          }`}
                        >
                          {msg.sender_type === 'agent' && msg.sender && (
                            <div className="text-xs opacity-75 mb-1">{msg.sender.name}</div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <div className={`text-xs mt-1 ${msg.direction === 'outgoing' ? 'text-white/70' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            {msg.direction === 'outgoing' && (
                              <Icon 
                                icon={msg.status === 'read' ? 'solar:check-read-bold' : 'solar:check-bold'} 
                                className="inline ml-1" 
                                width={14} 
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input de mensaje */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      rows={1}
                      className="flex-1 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button
                      color="primary"
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                    >
                      {sendingMessage ? (
                        <Spinner size="sm" />
                      ) : (
                        <Icon icon="solar:plain-bold" width={20} />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Icon icon="solar:chat-round-dots-bold-duotone" width={64} className="mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Selecciona una conversación</h3>
                  <p className="text-sm">Elige una conversación de la lista para ver los mensajes</p>
                </div>
              </div>
            )}
          </div>

          {/* Panel de detalles (opcional) */}
          {selectedConversation && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 p-4 hidden xl:block">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Detalles</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Teléfono</label>
                  <p className="font-medium">{selectedConversation.phone}</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase">Departamento</label>
                  <p className="font-medium">{selectedConversation.department?.name || 'Sin asignar'}</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase">Agente asignado</label>
                  <p className="font-medium">{selectedConversation.assigned_agent?.name || 'Sin asignar'}</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase">Primera respuesta</label>
                  <p className="font-medium">
                    {selectedConversation.first_response_at 
                      ? new Date(selectedConversation.first_response_at).toLocaleString('es-CO')
                      : 'Pendiente'}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase">Mensajes</label>
                  <p className="font-medium">{selectedConversation.message_count}</p>
                </div>

                {selectedConversation.tags && selectedConversation.tags.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Etiquetas</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedConversation.tags.map((tag, i) => (
                        <Badge key={i} color="gray" size="xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardBox>
    </div>
  );
};

export default WhatsAppInbox;

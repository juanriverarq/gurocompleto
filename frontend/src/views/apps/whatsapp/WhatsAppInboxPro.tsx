import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, Button, Spinner, Alert, Dropdown, Textarea, Tooltip, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router-dom';
import whatsappInboxService, { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppDepartment,
  InboxStats 
} from 'src/services/whatsappInboxService';
import MessageContent from 'src/components/whatsapp/MessageContent';
import { ConversationUpdateEvent } from 'src/hooks/useWhatsAppSocket';

interface QuickReply {
  id: number;
  title: string;
  message: string;
  content?: string;
  shortcut?: string;
}

const WhatsAppInboxPro: React.FC = () => {
  // Parámetros de URL para abrir conversación directamente
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get('conversation');

  // Estados principales
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [departments, setDepartments] = useState<WhatsAppDepartment[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned' | 'pending' | 'urgent'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<number | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(true);
  const [isTyping] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [, setSelectedFile] = useState<File | null>(null);
  const [, setFilePreview] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedConversationRef = useRef<WhatsAppConversation | null>(null);

  // Mantener ref actualizada de la conversación seleccionada para los callbacks de WebSocket
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);


  // Handler para actualizaciones de conversación via WebSocket (no usado actualmente)
  const handleConversationUpdate = useCallback((data: ConversationUpdateEvent) => {
    console.log('🔄 [Inbox] Actualización de conversación via WebSocket:', data);
    
    setConversations(prev => prev.map(conv => {
      if (conv.id === data.conversationId) {
        const updates: Partial<WhatsAppConversation> = {};
        if (data.updates.status) updates.status = data.updates.status as WhatsAppConversation['status'];
        if (data.updates.unread_count !== undefined) updates.unread_count = data.updates.unread_count;
        if (data.updates.last_message_at) updates.last_message_at = data.updates.last_message_at;
        if (data.updates.assigned_to !== undefined) updates.assigned_to = data.updates.assigned_to;
        return { ...conv, ...updates };
      }
      return conv;
    }));

    // Si es la conversación seleccionada, actualizar también
    if (selectedConversationRef.current?.id === data.conversationId) {
      setSelectedConversation(prev => {
        if (!prev) return null;
        const updates: Partial<WhatsAppConversation> = {};
        if (data.updates.status) updates.status = data.updates.status as WhatsAppConversation['status'];
        if (data.updates.unread_count !== undefined) updates.unread_count = data.updates.unread_count;
        if (data.updates.last_message_at) updates.last_message_at = data.updates.last_message_at;
        if (data.updates.assigned_to !== undefined) updates.assigned_to = data.updates.assigned_to;
        return { ...prev, ...updates };
      });
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleConversationUpdate = handleConversationUpdate; // Mantener para uso futuro

  // Emojis completos organizados por categoría
  const emojiCategories = {
    'Caras': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '�', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
    'Gestos': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '�', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
    'Corazones': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '�', '💓', '💗', '💖', '💘', '💝', '💟'],
    'Objetos': ['📱', '�', '🖥️', '📞', '☎️', '📧', '✉️', '📩', '📨', '📝', '✏️', '📎', '📌', '📍', '🔗', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗓️', '⏰', '🕐', '💰', '💵', '💳', '�', '📊', '📈', '📉'],
    'Símbolos': ['✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '🔸', '🔹', '▶️', '⏸️', '⏹️', '⏺️', '⏭️', '⏮️', '🔀', '🔁', '🔂', '🔃', '🔄'],
    'Celebración': ['�', '🎊', '🎈', '🎁', '🎀', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🌟', '⭐', '✨', '💫', '🔥', '💥', '🎯', '🚀']
  };
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('Caras');

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Abrir conversación desde URL (cuando viene de notificación)
  useEffect(() => {
    if (conversationIdFromUrl && conversations.length > 0 && !selectedConversation) {
      const convId = parseInt(conversationIdFromUrl);
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        selectConversationById(convId);
        // Limpiar el parámetro de la URL después de abrir
        setSearchParams({});
      } else {
        // Si no está en la lista, intentar cargarlo directamente
        loadConversationById(convId);
      }
    }
  }, [conversationIdFromUrl, conversations, selectedConversation]);

  // Seleccionar conversación por ID (helper para URL)
  const selectConversationById = async (convId: number) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setSelectedConversation(conv);
      await loadMessages(convId);
    }
  };

  // Cargar una conversación específica por ID
  const loadConversationById = async (convId: number) => {
    try {
      const conv = await whatsappInboxService.getConversation(convId);
      if (conv) {
        // Agregar a la lista si no existe
        setConversations(prev => {
          if (!prev.find(c => c.id === convId)) {
            return [conv, ...prev];
          }
          return prev;
        });
        setSelectedConversation(conv);
        await loadMessages(convId);
        setSearchParams({});
      }
    } catch (err) {
      console.error('Error cargando conversación:', err);
    }
  };

  // Polling cada 5 segundos para actualizar mensajes y conversaciones
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation.id, true);
      }
      loadConversations(true);
    }, 5000); // 5 segundos

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedConversation]);

  useEffect(() => {
    loadConversations();
  }, [filter, searchTerm]);

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
      
      // Cargar respuestas rápidas
      try {
        const replies = await whatsappInboxService.getQuickReplies();
        // Mapear a nuestro tipo QuickReply
        setQuickReplies(replies.map((r: any) => ({
          id: r.id,
          title: r.title,
          message: r.content || r.message || '',
          shortcut: r.shortcut || ''
        })));
      } catch (e) {
        // Quick replies opcionales
      }
      
      await loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let data;
      if (filter === 'mine') {
        data = await whatsappInboxService.getMyConversations();
        setConversations(data);
      } else {
        const filters: any = {};
        if (filter === 'unassigned') filters.assigned_to = 'unassigned';
        if (filter === 'pending') filters.status = 'pending';
        if (filter === 'urgent') filters.priority = 'urgent';
        if (searchTerm) filters.search = searchTerm;
        const response = await whatsappInboxService.getConversations(filters);
        setConversations(response.data);
      }
    } catch (err: any) {
      if (!silent) console.error('Error loading conversations:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const response = await whatsappInboxService.getConversationMessages(conversationId);
      const newMessages = response.data;
      
      // Solo actualizar si hay cambios
      if (JSON.stringify(newMessages) !== JSON.stringify(messages)) {
        setMessages(newMessages);
        // Scroll al final cuando hay nuevos mensajes
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err: any) {
      if (!silent) console.error('Error loading messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
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
      loadConversations(true);
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    setNewMessage(reply.message);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleAssignToMe = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await whatsappInboxService.assignConversation(selectedConversation.id, 0);
      setSelectedConversation(updated);
      loadConversations(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssignToDepartment = async () => {
    if (!selectedConversation || !selectedDepartment) return;
    try {
      // Asignar con razón de transferencia
      await whatsappInboxService.assignConversation(
        selectedConversation.id, 
        0, 
        `Transferido a departamento ${selectedDepartment}`
      );
      setShowAssignModal(false);
      setSelectedDepartment(null);
      loadConversations(true);
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

  const handleAddNote = async () => {
    if (!selectedConversation || !noteText.trim()) return;
    try {
      await whatsappInboxService.addNote(selectedConversation.id, noteText);
      setNoteText('');
      setShowNoteModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangePriority = async (newPriority: string) => {
    if (!selectedConversation) return;
    try {
      // TODO: Implementar cambio de prioridad en el servicio
      console.log('Cambiar prioridad a:', newPriority);
      loadConversations(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    // Validar tamaño (16MB máximo)
    if (file.size > 16 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 16MB.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setSendingMessage(true);
    
    try {
      // Enviar archivo multimedia
      const message = await whatsappInboxService.sendMediaMessage(
        selectedConversation.id,
        file,
        '' // Sin caption por ahora
      );
      
      setMessages(prev => [...prev, message]);
      loadConversations(true);
      
      // Limpiar
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      setError(err.message || 'Error al enviar archivo');
    } finally {
      setSendingMessage(false);
      e.target.value = '';
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

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      in_progress: 'En progreso',
      waiting_client: 'Esperando cliente',
      resolved: 'Resuelto',
      closed: 'Cerrado',
    };
    return labels[status] || status;
  };

  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      low: { icon: 'solar:arrow-down-bold', color: 'text-gray-400' },
      medium: { icon: 'solar:minus-bold', color: 'text-blue-500' },
      high: { icon: 'solar:arrow-up-bold', color: 'text-orange-500' },
      urgent: { icon: 'solar:danger-triangle-bold', color: 'text-red-500' },
    };
    return icons[priority] || icons.medium;
  };

  // Obtener empleados únicos con conversaciones asignadas
  const assignedAgents = React.useMemo(() => {
    const agentsMap = new Map<number, { id: number; name: string; email: string; avatar?: string; count: number }>();
    
    conversations.forEach(conv => {
      if (conv.assigned_agent && conv.assigned_agent.id) {
        const existing = agentsMap.get(conv.assigned_agent.id);
        if (existing) {
          existing.count++;
        } else {
          agentsMap.set(conv.assigned_agent.id, {
            ...conv.assigned_agent,
            count: 1
          });
        }
      }
    });
    
    return Array.from(agentsMap.values()).sort((a, b) => b.count - a.count);
  }, [conversations]);

  // Filtrar conversaciones por empleado seleccionado
  const filteredConversations = React.useMemo(() => {
    if (!selectedAgentFilter) return conversations;
    return conversations.filter(conv => conv.assigned_agent?.id === selectedAgentFilter);
  }, [conversations, selectedAgentFilter]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'Ayer';
    if (days < 7) return date.toLocaleDateString('es-CO', { weekday: 'short' });
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return 'solar:check-bold';
      case 'delivered': return 'solar:double-check-bold';
      case 'read': return 'solar:double-check-bold';
      case 'failed': return 'solar:close-circle-bold';
      default: return 'solar:clock-circle-bold';
    }
  };

  const getMessageStatusColor = (status: string) => {
    switch (status) {
      case 'read': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      default: return 'text-white/60';
    }
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-500">Cargando inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-gray-100 dark:bg-gray-900 -m-6 p-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
            <Icon icon="solar:chat-round-dots-bold" width={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Live Chat</h1>
            <p className="text-xs text-gray-500">
              {stats ? `${stats.my_unread} sin leer • ${stats.pending} pendientes` : 'Cargando...'}
            </p>
          </div>
        </div>
        
        {/* Stats mini */}
        <div className="flex items-center gap-2">
          {stats && (
            <>
              <Tooltip content="Mis conversaciones" trigger="hover">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Icon icon="solar:user-bold" width={16} className="text-primary" />
                  <span className="font-semibold text-sm">{stats.my_conversations}</span>
                </div>
              </Tooltip>
              <Tooltip content="Sin leer" trigger="hover">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Icon icon="solar:letter-unread-bold" width={16} className="text-orange-500" />
                  <span className="font-semibold text-sm">{stats.my_unread}</span>
                </div>
              </Tooltip>
              <Tooltip content="Sin asignar" trigger="hover">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Icon icon="solar:user-cross-bold" width={16} className="text-red-500" />
                  <span className="font-semibold text-sm">{stats.unassigned}</span>
                </div>
              </Tooltip>
            </>
          )}
          <Button color="light" size="sm" onClick={() => loadInitialData()}>
            <Icon icon="solar:refresh-bold" width={16} />
          </Button>
        </div>
      </div>

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)} className="mb-3">
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Lista de conversaciones */}
        <div className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {/* Filtros */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'Todas', icon: 'solar:inbox-bold' },
                { key: 'mine', label: 'Mías', icon: 'solar:user-bold' },
                { key: 'unassigned', label: 'Sin asignar', icon: 'solar:user-cross-bold' },
                { key: 'pending', label: 'Pendientes', icon: 'solar:clock-circle-bold' },
                { key: 'urgent', label: 'Urgentes', icon: 'solar:danger-triangle-bold' },
              ].map(f => (
                <Tooltip key={f.key} content={f.label} trigger="hover">
                  <button
                    onClick={() => setFilter(f.key as any)}
                    className={`p-2 rounded-lg transition-all ${
                      filter === f.key
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon icon={f.icon} width={18} />
                  </button>
                </Tooltip>
              ))}
            </div>
            <div className="relative">
              <Icon icon="solar:magnifer-linear" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conversación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Icon icon="solar:inbox-line-duotone" width={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">{selectedAgentFilter ? 'Sin conversaciones para este empleado' : 'No hay conversaciones'}</p>
                <p className="text-xs mt-1">{selectedAgentFilter ? 'Selecciona otro empleado o "Todos"' : 'Las nuevas conversaciones aparecerán aquí'}</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const priorityInfo = getPriorityIcon(conv.priority);
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`p-3 border-b border-gray-50 dark:border-gray-700/50 cursor-pointer transition-all ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/5 border-l-4 border-l-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                          conv.unread_count > 0 ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          {conv.contact_push_name?.charAt(0).toUpperCase() || conv.phone.slice(-2)}
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium truncate ${conv.unread_count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                            {conv.contact_push_name || conv.contact_name || conv.phone}
                          </span>
                          <div className="flex items-center gap-1">
                            <Icon icon={priorityInfo.icon} width={12} className={priorityInfo.color} />
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {formatTime(conv.last_message_at)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{conv.phone}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            conv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            conv.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            conv.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {getStatusLabel(conv.status)}
                          </span>
                          {conv.assigned_agent && (
                            <span className="text-[10px] text-gray-400 truncate">
                              • {conv.assigned_agent.name?.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Área de chat */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {/* Barra de filtro por empleados */}
          {assignedAgents.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap mr-1">Filtrar por:</span>
                <Tooltip content="Todas las conversaciones" trigger="hover">
                  <button
                    onClick={() => setSelectedAgentFilter(null)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                      selectedAgentFilter === null
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <Icon icon="solar:users-group-rounded-bold" width={16} />
                    <span className="text-xs font-medium">Todos</span>
                  </button>
                </Tooltip>
                {assignedAgents.map(agent => (
                  <Tooltip key={agent.id} content={`${agent.name} (${agent.count} conversaciones)`} trigger="hover">
                    <button
                      onClick={() => setSelectedAgentFilter(selectedAgentFilter === agent.id ? null : agent.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                        selectedAgentFilter === agent.id
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          selectedAgentFilter === agent.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                        }`}>
                          {agent.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-xs font-medium whitespace-nowrap">{agent.name?.split(' ')[0]}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        selectedAgentFilter === agent.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-600'
                      }`}>
                        {agent.count}
                      </span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {selectedConversation ? (
            <>
              {/* Header del chat */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.contact_push_name?.charAt(0).toUpperCase() || selectedConversation.phone.slice(-2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {selectedConversation.contact_push_name || selectedConversation.contact_name || selectedConversation.phone}
                      <Icon icon={getPriorityIcon(selectedConversation.priority).icon} width={14} className={getPriorityIcon(selectedConversation.priority).color} />
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      {selectedConversation.phone}
                      {isTyping && (
                        <span className="text-green-500 flex items-center gap-1">
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                          escribiendo...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content="Asignarme" trigger="hover">
                    <button onClick={handleAssignToMe} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <Icon icon="solar:user-plus-bold" width={18} className="text-gray-500" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Agregar nota" trigger="hover">
                    <button onClick={() => setShowNoteModal(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <Icon icon="solar:document-add-bold" width={18} className="text-gray-500" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Transferir" trigger="hover">
                    <button onClick={() => setShowAssignModal(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <Icon icon="solar:transfer-horizontal-bold" width={18} className="text-gray-500" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Resolver" trigger="hover">
                    <button onClick={handleResolve} className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                      <Icon icon="solar:check-circle-bold" width={18} className="text-green-500" />
                    </button>
                  </Tooltip>
                  <Dropdown
                    label=""
                    dismissOnClick
                    renderTrigger={() => (
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <Icon icon="solar:menu-dots-bold" width={18} className="text-gray-500" />
                      </button>
                    )}
                  >
                    <Dropdown.Item onClick={() => handleChangePriority('urgent')}>
                      <Icon icon="solar:danger-triangle-bold" className="mr-2 text-red-500" width={16} />
                      Marcar urgente
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleChangePriority('high')}>
                      <Icon icon="solar:arrow-up-bold" className="mr-2 text-orange-500" width={16} />
                      Prioridad alta
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item>
                      <Icon icon="solar:tag-bold" className="mr-2" width={16} />
                      Agregar etiqueta
                    </Dropdown.Item>
                    <Dropdown.Item>
                      <Icon icon="solar:user-id-bold" className="mr-2" width={16} />
                      Ver perfil de contacto
                    </Dropdown.Item>
                  </Dropdown>
                  <button 
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    className={`p-2 rounded-lg transition-colors ${showContactInfo ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                  >
                    <Icon icon="solar:info-circle-bold" width={18} />
                  </button>
                </div>
              </div>

              {/* Mensajes */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ 
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                  backgroundColor: '#f8fafc'
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <Icon icon="solar:chat-line-bold-duotone" width={48} className="mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Sin mensajes</p>
                      <p className="text-sm mt-1">Envía el primer mensaje</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isOutgoing = msg.direction === 'outgoing';
                      const showAvatar = idx === 0 || messages[idx - 1].direction !== msg.direction;
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} ${!showAvatar ? 'mt-0.5' : 'mt-3'}`}
                        >
                          {!isOutgoing && showAvatar && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium mr-2 flex-shrink-0">
                              {selectedConversation.contact_push_name?.charAt(0) || '?'}
                            </div>
                          )}
                          {!isOutgoing && !showAvatar && <div className="w-8 mr-2" />}
                          
                          <div className={`max-w-[65%] ${isOutgoing ? 'order-1' : ''}`}>
                            {isOutgoing && msg.sender_type === 'agent' && msg.sender && showAvatar && (
                              <div className="text-[10px] text-gray-400 text-right mb-0.5 mr-1">
                                {msg.sender.name}
                              </div>
                            )}
                            {isOutgoing && msg.sender_type === 'bot' && showAvatar && (
                              <div className="text-[10px] text-gray-400 text-right mb-0.5 mr-1 flex items-center justify-end gap-1">
                                <Icon icon="solar:chat-round-dots-bold" width={10} className="text-green-500" />
                                Chatbot
                              </div>
                            )}
                            <div
                              className={`px-3 py-2 ${
                                isOutgoing
                                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl rounded-tr-sm shadow-sm'
                                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-tl-sm shadow-sm'
                              }`}
                            >
                              <MessageContent
                                messageType={msg.message_type}
                                content={msg.content}
                                media={msg.media}
                                isOutgoing={isOutgoing}
                              />
                              <div className={`flex items-center justify-end gap-1 mt-1 ${isOutgoing ? 'text-white/70' : 'text-gray-400'}`}>
                                <span className="text-[10px]">{formatMessageTime(msg.created_at)}</span>
                                {isOutgoing && (
                                  <Icon 
                                    icon={getMessageStatusIcon(msg.status)} 
                                    width={14}
                                    className={getMessageStatusColor(msg.status)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {isOutgoing && showAvatar && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-white ml-2 flex-shrink-0">
                              {msg.sender?.name?.charAt(0) || (msg.sender_type === 'bot' ? '🤖' : 'A')}
                            </div>
                          )}
                          {isOutgoing && !showAvatar && <div className="w-8 ml-2" />}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input de mensaje mejorado */}
              <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                {/* Quick replies */}
                {showQuickReplies && quickReplies.length > 0 && (
                  <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-40 overflow-y-auto">
                    <div className="text-xs text-gray-500 mb-2 font-medium">Respuestas rápidas</div>
                    <div className="space-y-1">
                      {quickReplies.map(reply => (
                        <button
                          key={reply.id}
                          onClick={() => handleQuickReply(reply)}
                          className="w-full text-left p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="font-medium text-sm">{reply.title}</div>
                          <div className="text-xs text-gray-500 truncate">{reply.message}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Picker de emojis completo */}
                {showEmojiPicker && (
                  <div className="mb-2 bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden">
                    {/* Tabs de categorías */}
                    <div className="flex border-b border-gray-200 dark:border-gray-600 overflow-x-auto">
                      {Object.keys(emojiCategories).map(category => (
                        <button
                          key={category}
                          onClick={() => setSelectedEmojiCategory(category)}
                          className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                            selectedEmojiCategory === category
                              ? 'text-primary border-b-2 border-primary bg-white dark:bg-gray-800'
                              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    {/* Grid de emojis */}
                    <div className="p-2 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-10 gap-0.5">
                        {emojiCategories[selectedEmojiCategory as keyof typeof emojiCategories].map((emoji: string) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="w-8 h-8 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors text-xl flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex gap-1">
                    <Tooltip content="Respuestas rápidas" trigger="hover">
                      <button 
                        onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmojiPicker(false); }}
                        className={`p-2 rounded-lg transition-colors ${showQuickReplies ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                      >
                        <Icon icon="solar:lightning-bold" width={18} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Emojis" trigger="hover">
                      <button 
                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowQuickReplies(false); }}
                        className={`p-2 rounded-lg transition-colors ${showEmojiPicker ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                      >
                        <Icon icon="solar:emoji-funny-circle-bold" width={18} />
                      </button>
                    </Tooltip>
                    <Dropdown
                      label=""
                      dismissOnClick
                      renderTrigger={() => (
                        <Tooltip content="Adjuntar archivo" trigger="hover">
                          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500">
                            <Icon icon="solar:paperclip-bold" width={18} />
                          </button>
                        </Tooltip>
                      )}
                    >
                      <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
                        <Icon icon="solar:gallery-bold" className="mr-2 text-blue-500" width={16} />
                        Imagen
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
                          fileInputRef.current.click();
                        }
                      }}>
                        <Icon icon="solar:document-bold" className="mr-2 text-red-500" width={16} />
                        Documento
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'audio/*';
                          fileInputRef.current.click();
                        }
                      }}>
                        <Icon icon="solar:microphone-bold" className="mr-2 text-purple-500" width={16} />
                        Audio
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'video/*';
                          fileInputRef.current.click();
                        }
                      }}>
                        <Icon icon="solar:video-frame-bold" className="mr-2 text-green-500" width={16} />
                        Video
                      </Dropdown.Item>
                    </Dropdown>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </div>
                  
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      rows={1}
                      className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-primary resize-none"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className={`p-2.5 rounded-xl transition-all ${
                      newMessage.trim() 
                        ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-lg' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {sendingMessage ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icon icon="solar:plain-bold" width={20} />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:chat-round-dots-bold-duotone" width={40} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Selecciona una conversación</h3>
                <p className="text-sm text-gray-500 mt-1">Elige una conversación de la lista para comenzar</p>
              </div>
            </div>
          )}
        </div>

        {/* Panel de información del contacto */}
        {selectedConversation && showContactInfo && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex flex-col overflow-hidden">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                {(selectedConversation.contact_first_name || selectedConversation.contact_push_name)?.charAt(0).toUpperCase() || selectedConversation.phone.slice(-2)}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {selectedConversation.contact_first_name && selectedConversation.contact_last_name
                  ? `${selectedConversation.contact_first_name} ${selectedConversation.contact_last_name}`
                  : selectedConversation.contact_push_name || selectedConversation.contact_name || 'Sin nombre'}
              </h4>
              <p className="text-sm text-gray-500">{selectedConversation.phone}</p>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {/* Datos de contacto capturados */}
              {(selectedConversation.contact_first_name || selectedConversation.contact_last_name || 
                selectedConversation.contact_document_id || selectedConversation.contact_email ||
                selectedConversation.contact_company || selectedConversation.contact_city) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                    <Icon icon="solar:user-id-bold" width={14} />
                    Datos del contacto
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedConversation.contact_first_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Nombre:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_first_name}</span>
                      </div>
                    )}
                    {selectedConversation.contact_last_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Apellido:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_last_name}</span>
                      </div>
                    )}
                    {selectedConversation.contact_document_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cédula:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_document_id}</span>
                      </div>
                    )}
                    {selectedConversation.contact_email && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="font-medium text-gray-900 dark:text-white truncate ml-2">{selectedConversation.contact_email}</span>
                      </div>
                    )}
                    {selectedConversation.contact_phone_secondary && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tel. secundario:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_phone_secondary}</span>
                      </div>
                    )}
                    {selectedConversation.contact_company && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Empresa:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_company}</span>
                      </div>
                    )}
                    {selectedConversation.contact_city && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ciudad:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.contact_city}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Icon icon="solar:tag-bold" width={14} />
                  Estado
                </div>
                <Badge color={getStatusColor(selectedConversation.status)} size="sm">
                  {getStatusLabel(selectedConversation.status)}
                </Badge>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Icon icon="solar:buildings-bold" width={14} />
                  Departamento
                </div>
                <p className="font-medium text-sm">{selectedConversation.department?.name || 'Sin asignar'}</p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Icon icon="solar:user-bold" width={14} />
                  Agente
                </div>
                <p className="font-medium text-sm">{selectedConversation.assigned_agent?.name || 'Sin asignar'}</p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Icon icon="solar:chat-round-dots-bold" width={14} />
                  Mensajes
                </div>
                <p className="font-medium text-sm">{selectedConversation.message_count}</p>
              </div>

              {selectedConversation.contact_notes && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                    <Icon icon="solar:notes-bold" width={14} />
                    Notas del contacto
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedConversation.contact_notes}</p>
                </div>
              )}

              {selectedConversation.tags && selectedConversation.tags.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <Icon icon="solar:tag-horizontal-bold" width={14} />
                    Etiquetas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedConversation.tags.map((tag, i) => (
                      <Badge key={i} color="gray" size="xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Acciones rápidas */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              {selectedConversation.contact_phone_secondary && (
                <Button color="light" size="sm" className="w-full justify-start">
                  <Icon icon="solar:phone-bold" className="mr-2" width={16} />
                  Llamar ({selectedConversation.contact_phone_secondary})
                </Button>
              )}
              {selectedConversation.contact_email && (
                <Button 
                  color="light" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => window.open(`mailto:${selectedConversation.contact_email}`, '_blank')}
                >
                  <Icon icon="solar:letter-bold" className="mr-2" width={16} />
                  Enviar email
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de asignación */}
      <Modal show={showAssignModal} onClose={() => setShowAssignModal(false)} size="md">
        <Modal.Header>Transferir conversación</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Selecciona el departamento al que deseas transferir esta conversación:</p>
            <div className="space-y-2">
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDepartment(dept.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedDepartment === dept.id 
                      ? 'bg-primary/10 border-2 border-primary' 
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                  }`}
                >
                  <div className="font-medium">{dept.name}</div>
                  {dept.description && <div className="text-xs text-gray-500">{dept.description}</div>}
                </button>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
          <Button color="primary" onClick={handleAssignToDepartment} disabled={!selectedDepartment}>
            Transferir
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de nota */}
      <Modal show={showNoteModal} onClose={() => setShowNoteModal(false)} size="md">
        <Modal.Header>Agregar nota interna</Modal.Header>
        <Modal.Body>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escribe una nota sobre esta conversación..."
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-2">
            Las notas son visibles solo para el equipo, no para el cliente.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowNoteModal(false)}>Cancelar</Button>
          <Button color="primary" onClick={handleAddNote} disabled={!noteText.trim()}>
            Guardar nota
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WhatsAppInboxPro;

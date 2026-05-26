import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, Spinner, Alert, Textarea, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import whatsappInboxService, {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppDepartment,
  InboxStats,
  WhatsAppTag
} from 'src/services/whatsappInboxService';
import { commercialTasksService } from 'src/services/commercialTasksService';
import MessageContent from 'src/components/whatsapp/MessageContent';
import { ConversationUpdateEvent } from 'src/hooks/useWhatsAppSocket';
import { auth } from 'src/config/firebase';
import whatsappInstanceService from 'src/services/whatsappInstanceService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

interface QuickReply {
  id: number;
  title: string;
  message: string;
  content?: string;
  shortcut?: string;
  media_url?: string | null;
  media_type?: string | null;
}

const WhatsAppInboxPro: React.FC = () => {
  // Parámetros de URL para abrir conversación directamente
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned' | 'pending' | 'urgent'>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<number | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [isTyping] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedTransferAgent, setSelectedTransferAgent] = useState<number | null>(null);
  const [brokerAgents, setBrokerAgents] = useState<{ id: number; name: string; email: string; role: string; cargo?: string; departamento?: string }[]>([]);
  const [agentDeptFilter, setAgentDeptFilter] = useState<string>('all');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState<{ title: string; type: string; priority: string; description: string; due_date: string; contact_method: string }>({
    title: '', type: 'seguimiento_cliente', priority: 'media', description: '', due_date: '', contact_method: 'whatsapp',
  });
  const [taskSuccessId, setTaskSuccessId] = useState<number | null>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [conversationNotes, setConversationNotes] = useState<any[]>([]);
  const [clientData, setClientData] = useState<any>(null);
  const [clientPolicies, setClientPolicies] = useState<any[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  const [assignmentNotification, setAssignmentNotification] = useState<{ conversationId: number; contactName: string; phone: string; assignedBy: string; escalation?: boolean; reason?: string } | null>(null);
  const prevAssignedIdsRef = useRef<Set<number>>(new Set());
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [replyForm, setReplyForm] = useState({ shortcut: '', title: '', content: '', media_url: '', media_type: '' });
  const [replyMediaFile, setReplyMediaFile] = useState<File | null>(null);
  const [replyMediaPreview, setReplyMediaPreview] = useState<string | null>(null);
  const [uploadingReplyMedia, setUploadingReplyMedia] = useState(false);
  const [slashResults, setSlashResults] = useState<QuickReply[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [instanceOptions, setInstanceOptions] = useState<Array<{ id: number; phone_number: string; status: string }>>([]);
  const [selectedInstanceFilter, setSelectedInstanceFilter] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const [pendingFileCaption, setPendingFileCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [availableTags, setAvailableTags] = useState<WhatsAppTag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const actionsPortalRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});

  // Ventana 24h del servidor (fuente de verdad)
  const [serverWindow, setServerWindow] = useState<{ is_open: boolean; hours_remaining: number; last_client_message_at: string | null; closes_at: string | null; connection_type?: string } | null>(null);

  // Paginación infinita (scroll hacia arriba para cargar más antiguos)
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [currentLastPage, setCurrentLastPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Buscador de mensajes
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<WhatsAppMessage[]>([]);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [searchingMessages, setSearchingMessages] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedConversationRef = useRef<WhatsAppConversation | null>(null);
  const conversationRequestRef = useRef(0);
  const initialLoadDoneRef = useRef(false);

  // Mantener ref actualizada de la conversación seleccionada para los callbacks de WebSocket
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Click-outside handler for custom dropdown menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node) && !(actionsPortalRef.current && actionsPortalRef.current.contains(e.target as Node))) setShowActionsMenu(false);
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false);
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setShowTagDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


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

  // Polling cada 10 segundos para actualizar mensajes y conversaciones.
  // Los mensajes nuevos llegan en tiempo real por WebSocket; este polling
  // es solo respaldo / consistencia. 10s reduce 50% del tráfico vs 5s.
  // IMPORTANT: filter & searchTerm must be in deps so the interval captures the current values
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation.id, true);
      }
      loadConversations(true);
    }, 10000); // 10 segundos

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedConversation, filter, searchTerm, selectedTagFilter]);

  useEffect(() => {
    // Skip on initial mount — loadInitialData already loads conversations
    if (!initialLoadDoneRef.current) return;
    loadConversations();
  }, [filter, searchTerm, selectedTagFilter]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Obtener token para proxy de media (img/audio/video no pueden enviar headers)
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        setAuthToken(token);
      }
      const [depts, statsData, instancesRes] = await Promise.all([
        whatsappInboxService.getDepartments(),
        whatsappInboxService.getStats(),
        whatsappInstanceService.getInstances(),
      ]);
      setDepartments(depts);
      setStats(statsData);
      if (instancesRes.success && instancesRes.data) {
        const activeInst = instancesRes.data
          .filter((i: any) => i.is_active)
          .map((i: any) => ({ id: i.id, phone_number: i.phone_number || i.instance_id, status: i.status }));
        setInstanceOptions(activeInst);
      }
      
      // Cargar etiquetas
      try {
        const tags = await whatsappInboxService.getTags();
        setAvailableTags(tags);
      } catch (e) { /* Tags opcionales */ }

      // Cargar agentes del broker (para transferir)
      try {
        const agents = await whatsappInboxService.getAgents();
        setBrokerAgents(agents);
      } catch (e) { /* Agents opcionales */ }

      // Cargar respuestas rápidas
      try {
        const replies = await whatsappInboxService.getQuickReplies();
        // Mapear a nuestro tipo QuickReply (incluir media_url y media_type)
        setQuickReplies(replies.map((r: any) => ({
          id: r.id,
          title: r.title,
          message: r.content || r.message || '',
          content: r.content || r.message || '',
          shortcut: r.shortcut || '',
          media_url: r.media_url || null,
          media_type: r.media_type || null,
        })));
      } catch (e) {
        // Quick replies opcionales
      }
      
      await loadConversations();
      initialLoadDoneRef.current = true;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (silent = false) => {
    const requestId = ++conversationRequestRef.current;
    try {
      if (!silent) setLoading(true);
      let data;
      if (filter === 'mine') {
        data = await whatsappInboxService.getMyConversations();
        // Discard stale response
        if (requestId !== conversationRequestRef.current) return;
        // Detectar nuevas asignaciones para notificación
        if (silent && data.length > 0) {
          const newIds = new Set(data.map((c: any) => c.id));
          const prevIds = prevAssignedIdsRef.current;
          if (prevIds.size > 0) {
            for (const c of data) {
              if (!prevIds.has(c.id) && c.assigned_at) {
                // Nueva conversación asignada a mí
                const assignedRecently = (Date.now() - new Date(c.assigned_at).getTime()) < 30000; // últimos 30s
                if (assignedRecently) {
                  setAssignmentNotification({
                    conversationId: c.id,
                    contactName: c.contact_push_name || c.contact_name || c.phone,
                    phone: c.phone,
                    assignedBy: c.classification_reason?.includes('chatbot') ? 'Chatbot' : 'Sistema',
                    escalation: c.classification_reason?.includes('Escalado'),
                    reason: c.classification_reason || undefined,
                  });
                  // Reproducir sonido de notificación
                  try { new Audio('/sounds/notification.mp3').play().catch(() => {}); } catch {}
                  break;
                }
              }
            }
          }
          prevAssignedIdsRef.current = newIds;
        } else if (!silent && data.length > 0) {
          prevAssignedIdsRef.current = new Set(data.map((c: any) => c.id));
        }
        setConversations(data);
      } else {
        const filters: any = { per_page: 100 };
        if (filter === 'unassigned') filters.assigned_to = 'unassigned';
        if (filter === 'pending') filters.status = 'pending';
        if (filter === 'urgent') filters.priority = 'urgent';
        if (searchTerm) filters.search = searchTerm;
        if (selectedTagFilter) filters.tag = selectedTagFilter;
        const response = await whatsappInboxService.getConversations(filters);
        // Discard stale response
        if (requestId !== conversationRequestRef.current) return;
        setConversations(response.data);
      }
    } catch (err: any) {
      if (!silent) console.error('Error loading conversations:', err);
    } finally {
      if (requestId === conversationRequestRef.current && !silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      // latest=true: backend ordena DESC y revierte, así page=1 trae los 100 mensajes más recientes en orden cronológico
      const response = await whatsappInboxService.getConversationMessages(conversationId, 1, 100, true) as any;
      const newMessages = response.data;

      // Guardar ventana 24h del servidor (fuente de verdad)
      if (response.conversation_window) {
        setServerWindow(response.conversation_window);
      }

      // Paginación: si hay más páginas, hay mensajes más antiguos disponibles
      setCurrentLastPage(response.last_page || 1);
      setCurrentPage(1);
      setHasOlderMessages((response.last_page || 1) > 1);
      
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

  // Cargar mensajes más antiguos (scroll infinito hacia arriba)
  const loadOlderMessages = async () => {
    if (!selectedConversation || loadingOlder || !hasOlderMessages) return;
    try {
      setLoadingOlder(true);
      const container = chatContainerRef.current;
      const prevScrollHeight = container?.scrollHeight || 0;

      // Con latest=true, page 2 trae los siguientes 100 más recientes (más antiguos que los actuales)
      const nextPage = currentPage + 1;
      const response = await whatsappInboxService.getConversationMessages(selectedConversation.id, nextPage, 100, true);
      const olderMessages = response.data;

      if (olderMessages.length > 0) {
        // Prepend: mensajes antiguos van al inicio
        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentPage(nextPage);
        setHasOlderMessages(nextPage < currentLastPage);

        // Mantener posición de scroll después de prepend
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasOlderMessages(false);
      }
    } catch (err: any) {
      console.error('Error loading older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Buscador de mensajes dentro de la conversación
  const searchMessagesInConversation = async (query: string) => {
    if (!selectedConversation || query.length < 2) {
      setMessageSearchResults([]);
      return;
    }
    try {
      setSearchingMessages(true);
      const response = await whatsappInboxService.searchMessages(selectedConversation.id, query);
      setMessageSearchResults(response.data);
    } catch (err: any) {
      console.error('Error searching messages:', err);
    } finally {
      setSearchingMessages(false);
    }
  };

  const selectConversation = async (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    setServerWindow(null);
    setConversationNotes([]);
    setClientData(null);
    setClientPolicies([]);
    await loadMessages(conversation.id);
    // Cargar notas de la conversación
    try {
      const notes = await whatsappInboxService.getNotes(conversation.id);
      setConversationNotes(notes);
    } catch (e) { /* notas opcionales */ }
    // Cargar cliente y pólizas por teléfono
    try {
      const { client, policies } = await whatsappInboxService.getClientByPhone(conversation.phone);
      setClientData(client);
      setClientPolicies(policies);
    } catch (e) { /* cliente opcional */ }
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

  // ========== TEMPLATE SENDING (Meta Cloud API) ==========
  const loadApprovedTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/saas/whatsapp-inbox/templates?status=APPROVED`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setAvailableTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleOpenTemplateModal = () => {
    loadApprovedTemplates();
    setTemplateParams({});
    setShowTemplateModal(true);
  };

  const extractTemplateVars = (body: string): string[] => {
    const matches = body.match(/\{\{([a-z0-9_]+)\}\}/g);
    return matches ? matches.map(m => m.replace(/[{}]/g, '')) : [];
  };

  const handleSendTemplate = async (template: any) => {
    console.log('📤 [sendTemplate] CALLED with template:', template?.name, 'conversation:', selectedConversation?.id, selectedConversation?.phone);
    if (!selectedConversation) {
      console.error('📤 [sendTemplate] No selectedConversation!');
      return;
    }
    try {
      setSendingTemplate(true);
      const user = auth.currentUser;
      if (!user) {
        console.error('📤 [sendTemplate] No auth user!');
        setError('No estás autenticado');
        return;
      }
      const token = await user.getIdToken();
      console.log('📤 [sendTemplate] Got token, length:', token?.length);

      // Build components with parameter values
      const bodyText = template.parsed?.body || '';
      const vars = extractTemplateVars(bodyText);
      const components: any[] = [];

      if (vars.length > 0) {
        const parameters = vars.map(v => ({
          type: 'text',
          text: templateParams[v] || v,
        }));
        components.push({ type: 'body', parameters });
      }

      const payload = {
        phone: selectedConversation.phone,
        template_name: template.name,
        language: template.language || 'es',
        components,
        template_body: bodyText || `[Plantilla: ${template.name}]`,
      };
      const url = `${API_BASE_URL}/saas/whatsapp-inbox/templates/send`;
      console.log('📤 [sendTemplate] POST', url, JSON.stringify(payload));

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const text = await res.text();
      console.log('📤 [sendTemplate] Response status:', res.status, 'body:', text);
      
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      
      if (res.ok) {
        setShowTemplateModal(false);
        // Add optimistic message to chat
        const templateBody = template.parsed?.body || `[Plantilla: ${template.name}]`;
        setMessages(prev => [...prev, {
          id: Date.now(),
          conversation_id: selectedConversation.id,
          message_id: data.message_id || `tpl-${Date.now()}`,
          direction: 'outgoing',
          sender_type: 'agent',
          message_type: 'template',
          content: templateBody,
          status: 'sent',
          created_at: new Date().toISOString(),
        }]);
        loadMessages(selectedConversation.id);
        loadConversations(true);
      } else {
        console.error('📤 [sendTemplate] Error:', data);
        setError(data.error || `Error ${res.status}: ${text.substring(0, 200)}`);
      }
    } catch (err: any) {
      console.error('📤 [sendTemplate] Exception:', err);
      setError('Error de conexión: ' + (err.message || 'desconocido'));
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleQuickReply = async (reply: QuickReply) => {
    setNewMessage(reply.message || reply.content || '');
    setShowQuickReplies(false);
    inputRef.current?.focus();
    // Si la plantilla tiene media adjunta (data URL), enviar como archivo
    if (reply.media_url && reply.media_type && selectedConversation) {
      try {
        // Convertir data URL a File
        const res = await fetch(reply.media_url);
        const blob = await res.blob();
        const extMap: Record<string, string> = { image: 'jpg', document: 'pdf', video: 'mp4', audio: 'mp3' };
        const ext = extMap[reply.media_type] || 'bin';
        const file = new File([blob], `template_${reply.shortcut || reply.id}.${ext}`, { type: blob.type || `${reply.media_type}/${ext}` });
        // Para audio, enviar directamente sin preview
        if (reply.media_type === 'audio') {
          await sendFileDirectly(file, reply.message || reply.content || '');
          return;
        }
        setPendingFile(file);
        if (reply.media_type === 'image') {
          setPendingFilePreview(reply.media_url);
        }
      } catch (e) {
        console.error('Error loading quick reply media:', e);
      }
    }
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

  const handleTransferToAgent = async () => {
    if (!selectedConversation || !selectedTransferAgent) return;
    try {
      const agent = brokerAgents.find(a => a.id === selectedTransferAgent);
      await whatsappInboxService.assignConversation(
        selectedConversation.id, 
        selectedTransferAgent, 
        `Transferido a ${agent?.name || 'agente'}`
      );
      setShowAssignModal(false);
      setSelectedTransferAgent(null);
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
      // Recargar notas
      const notes = await whatsappInboxService.getNotes(selectedConversation.id);
      setConversationNotes(notes);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangePriority = async (newPriority: string) => {
    if (!selectedConversation) return;
    try {
      const updated = await whatsappInboxService.updateConversation(selectedConversation.id, { priority: newPriority as any });
      setSelectedConversation(updated);
      loadConversations(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openCreateTaskModal = () => {
    if (!selectedConversation) return;
    const contactName = [selectedConversation.contact_first_name, selectedConversation.contact_last_name].filter(Boolean).join(' ')
      || selectedConversation.contact_push_name || selectedConversation.contact_name || selectedConversation.phone;
    setTaskForm({
      title: `Seguimiento: ${contactName}`,
      type: 'seguimiento_cliente',
      priority: 'media',
      description: '',
      due_date: '',
      contact_method: 'whatsapp',
    });
    setTaskSuccessId(null);
    setShowCreateTaskModal(true);
    setShowActionsMenu(false);
  };

  const handleCreateTask = async () => {
    if (!selectedConversation || !taskForm.title.trim()) return;
    setCreatingTask(true);
    try {
      const created = await commercialTasksService.createTask({
        title: taskForm.title,
        type: taskForm.type as any,
        priority: taskForm.priority as any,
        description: taskForm.description || undefined,
        due_date: taskForm.due_date || undefined,
        contact_method: taskForm.contact_method as any,
        contact_phone: selectedConversation.phone,
        contact_email: selectedConversation.contact_email || undefined,
        client_id: selectedConversation.client_id || undefined,
      });
      setTaskSuccessId(created.id);
    } catch (err: any) {
      setError(err.message);
      setShowCreateTaskModal(false);
    } finally {
      setCreatingTask(false);
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

    // Mostrar preview para imágenes, enviar directo para otros
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingFilePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      setPendingFile(file);
      setPendingFileCaption('');
      e.target.value = '';
      return;
    }

    // Para documentos, audio, video: enviar directo
    await sendFileDirectly(file);
    e.target.value = '';
  };

  const sendFileDirectly = async (file: File, caption?: string) => {
    console.log('📤 [sendFileDirectly] Called', { file: file?.name, type: file?.type, size: file?.size, caption, conversationId: selectedConversation?.id });
    if (!selectedConversation) {
      console.error('📤 [sendFileDirectly] No selectedConversation!');
      return;
    }
    setSendingMessage(true);
    try {
      const message = await whatsappInboxService.sendMediaMessage(
        selectedConversation.id,
        file,
        caption || ''
      );
      console.log('📤 [sendFileDirectly] Success, message:', message);
      setMessages(prev => [...prev, message]);
      loadConversations(true);
    } catch (err: any) {
      console.error('📤 [sendFileDirectly] Error:', err.message, err);
      setError(err.message || 'Error al enviar archivo');
    } finally {
      setSendingMessage(false);
    }
  };

  const sendPendingFile = async () => {
    if (!pendingFile) return;
    await sendFileDirectly(pendingFile, pendingFileCaption);
    setPendingFile(null);
    setPendingFilePreview(null);
    setPendingFileCaption('');
  };

  const cancelPendingFile = () => {
    setPendingFile(null);
    setPendingFilePreview(null);
    setPendingFileCaption('');
  };

  // Audio recording with MediaRecorder API
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Meta Cloud API soporta: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (opus)
      // Intentar formatos compatibles con Meta en orden de preferencia
      const metaCompatible = [
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
      ];
      let mimeType = 'audio/webm;codecs=opus'; // fallback
      for (const mt of metaCompatible) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt;
          break;
        }
      }
      console.log('🎙️ Recording with mimeType:', mimeType, 'isWebm:', mimeType.includes('webm'));
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const recordedBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Si grabamos en formato compatible con Meta, enviar directo
        if (!mimeType.includes('webm')) {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : mimeType.includes('mpeg') ? 'mp3' : 'ogg';
          const audioFile = new File([recordedBlob], `audio_${Date.now()}.${ext}`, { type: mimeType });
          await sendFileDirectly(audioFile);
          return;
        }
        
        // WebM fallback: Convertir a WAV usando Web Audio API (Meta acepta audio/ogg)
        try {
          console.log('🎙️ Converting webm to wav for Meta compatibility...');
          const audioContext = new AudioContext();
          const arrayBuffer = await recordedBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Encode to WAV
          const numChannels = audioBuffer.numberOfChannels;
          const sampleRate = audioBuffer.sampleRate;
          const length = audioBuffer.length * numChannels * 2;
          const wavBuffer = new ArrayBuffer(44 + length);
          const view = new DataView(wavBuffer);
          
          // WAV header
          const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + length, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * numChannels * 2, true);
          view.setUint16(32, numChannels * 2, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, length, true);
          
          // Write PCM samples
          let offset = 44;
          for (let i = 0; i < audioBuffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
              const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
              view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
              offset += 2;
            }
          }
          
          // Meta no acepta wav directamente, pero el backend lo puede etiquetar como audio/mpeg
          // Enviamos como .mp4 con tipo audio/mp4 que Meta sí acepta
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          const audioFile = new File([wavBlob], `audio_${Date.now()}.wav`, { type: 'audio/wav' });
          await sendFileDirectly(audioFile);
          audioContext.close();
        } catch (convErr) {
          console.error('🎙️ WAV conversion failed, sending webm anyway:', convErr);
          const audioFile = new File([recordedBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg; codecs=opus' });
          await sendFileDirectly(audioFile);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null; // Prevent sending
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== META CLOUD API: 24h Conversation Window (Server-side) ==========
  // La ventana 24h se calcula en el servidor para máxima precisión según la política de Meta.
  // El backend devuelve conversation_window en cada respuesta de mensajes.
  const conversationWindow = useMemo(() => {
    if (serverWindow) {
      return {
        isOpen: serverWindow.is_open,
        hoursRemaining: serverWindow.hours_remaining,
        lastClientMessageAt: serverWindow.last_client_message_at,
        closesAt: serverWindow.closes_at,
        connectionType: serverWindow.connection_type || 'cloud_api',
      };
    }
    return { isOpen: false, hoursRemaining: 0, lastClientMessageAt: null, closesAt: null, connectionType: 'cloud_api' };
  }, [serverWindow]);

  // Check if the WhatsApp instance linked to this conversation is connected
  const isInstanceConnected = useCallback(() => {
    // First check instanceOptions (live status from API)
    if (instanceOptions.length > 0) {
      const convInstanceId = (selectedConversation as any)?.whatsapp_instance_id || selectedConversation?.instance?.id;
      if (convInstanceId) {
        const inst = instanceOptions.find(i => i.id === convInstanceId);
        if (inst) return inst.status === 'connected' || inst.status === 'authenticated' || inst.status === 'ready';
      }
      // If we have any connected instance, consider it connected
      return instanceOptions.some(i => i.status === 'connected' || i.status === 'authenticated' || i.status === 'ready');
    }
    // Fallback to conversation's embedded instance
    if (!selectedConversation?.instance) return false;
    return selectedConversation.instance.status === 'connected' || selectedConversation.instance.status === 'authenticated' || selectedConversation.instance.status === 'ready';
  }, [selectedConversation, instanceOptions]);

  const instanceConnected = isInstanceConnected();

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

  // Filtrar conversaciones por empleado seleccionado y por línea/instancia
  const filteredConversations = React.useMemo(() => {
    let filtered = conversations;
    if (selectedAgentFilter) {
      filtered = filtered.filter(conv => conv.assigned_agent?.id === selectedAgentFilter);
    }
    if (selectedInstanceFilter) {
      filtered = filtered.filter(conv => {
        const convInstanceId = (conv as any).whatsapp_instance_id || (conv as any).instance?.id;
        return String(convInstanceId) === selectedInstanceFilter;
      });
    }
    return filtered;
  }, [conversations, selectedAgentFilter, selectedInstanceFilter]);

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
    <div className="h-[calc(100vh-64px)] flex flex-col -m-6 -mb-6 bg-[#d1d7db] dark:bg-[#0a0a0a]">

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)} className="mx-4 mt-1 mb-0 relative z-10">
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Lista de conversaciones */}
        <div className="w-[400px] bg-white dark:bg-[#111] flex flex-col overflow-hidden border-r border-[#d1d7db] dark:border-white/[0.06]">
          {/* Header del sidebar */}
          <div className="h-[59px] px-4 bg-[#f0f2f5] dark:bg-[#161616] flex items-center justify-between">
            <div className="w-10 h-10 bg-[#dfe5e7] dark:bg-gray-700 rounded-full flex items-center justify-center cursor-pointer">
              <Icon icon="solar:user-bold" width={20} className="text-[#54656f] dark:text-gray-300" />
            </div>
            <div className="flex items-center gap-1">
              {stats && (
                <span className="text-[12px] text-[#54656f] dark:text-gray-400 mr-1">{stats.my_unread} sin leer</span>
              )}
              <button onClick={() => loadInitialData()} className="p-[8px] rounded-full hover:bg-[#d9dbdf] dark:hover:bg-white/10 transition-colors text-[#54656f] dark:text-gray-400" title="Actualizar">
                <Icon icon="solar:refresh-bold" width={20} />
              </button>
            </div>
          </div>
          {/* Filtros */}
          <div className="px-2 py-[6px] bg-white dark:bg-[#111]">
            {instanceOptions.length > 1 && (
              <select
                className="w-full mb-2 text-xs bg-[#f0f2f5] dark:bg-[#1e1e1e] border border-[#d1d7db] dark:border-white/[0.06] rounded-lg py-1.5 px-2 focus:ring-0 text-[#3b4a54] dark:text-gray-200"
                value={selectedInstanceFilter}
                onChange={(e) => setSelectedInstanceFilter(e.target.value)}
              >
                <option value="">Todas las líneas</option>
                {instanceOptions.map((inst) => (
                  <option key={inst.id} value={String(inst.id)}>
                    {inst.phone_number}{inst.status === 'connected' ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-[6px] mb-[6px] overflow-x-auto scrollbar-hide">
              {[
                { key: 'all', label: 'Todas' },
                { key: 'mine', label: 'Mías' },
                { key: 'unassigned', label: 'Sin asignar' },
                { key: 'pending', label: 'Pendientes' },
                { key: 'urgent', label: 'Urgentes' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className={`px-3 py-[5px] rounded-full text-[13px] font-medium transition-all whitespace-nowrap ${
                    filter === f.key
                      ? 'bg-primary text-white'
                      : 'bg-[#e9edef] dark:bg-[#1e1e1e] text-[#54656f] dark:text-gray-400 hover:bg-[#d9dbdf] dark:hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Filtro por etiquetas */}
            {availableTags.length > 0 && (
              <div className="flex gap-1 mb-[6px] overflow-x-auto scrollbar-hide">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTagFilter(selectedTagFilter === tag.name ? '' : tag.name)}
                    className={`px-2 py-[3px] rounded-full text-[11px] font-medium transition-all whitespace-nowrap border ${
                      selectedTagFilter === tag.name
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-transparent border-gray-300 dark:border-gray-600 text-[#667781] dark:text-gray-400 hover:border-primary/50'
                    }`}
                  >
                    <Icon icon="solar:tag-bold" className="inline mr-0.5" width={10} />
                    {tag.name}
                  </button>
                ))}
                {selectedTagFilter && (
                  <button
                    onClick={() => setSelectedTagFilter('')}
                    className="px-2 py-[3px] rounded-full text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            )}
            <div className="relative">
              <Icon icon="solar:magnifer-linear" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-gray-500" />
              <input
                type="text"
                placeholder="Buscar o empezar un chat nuevo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-[34px] pr-3 py-[7px] text-[14px] bg-[#f0f2f5] dark:bg-[#1e1e1e] border-0 rounded-lg focus:ring-0 text-[#3b4a54] dark:text-gray-200 placeholder-[#667781] dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-[#54656f] dark:text-gray-400">
                <Icon icon="solar:inbox-line-duotone" width={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">{selectedAgentFilter ? 'Sin conversaciones para este empleado' : 'No hay conversaciones'}</p>
                <p className="text-xs mt-1 text-[#667781]">{selectedAgentFilter ? 'Selecciona otro empleado o "Todos"' : 'Las nuevas conversaciones aparecerán aquí'}</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const priorityInfo = getPriorityIcon(conv.priority);
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`flex items-center px-3 py-0 cursor-pointer transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-[#f0f2f5] dark:bg-[#1e1e1e]'
                        : 'hover:bg-[#f5f6f6] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-[49px] h-[49px] rounded-full bg-[#dfe5e7] dark:bg-gray-700 flex items-center justify-center text-[#54656f] dark:text-gray-300 text-lg flex-shrink-0 mr-3">
                      {conv.contact_push_name?.charAt(0).toUpperCase() || conv.phone.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0 py-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[16px] text-[#111b21] dark:text-white truncate">
                          {conv.contact_push_name || conv.contact_name || conv.phone}
                        </span>
                        <span className={`text-[12px] ml-2 flex-shrink-0 ${conv.unread_count > 0 ? 'text-primary' : 'text-[#667781] dark:text-gray-400'}`}>
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-[2px]">
                        <p className="text-[13.5px] text-[#667781] dark:text-gray-400 truncate flex-1 mr-2">
                          {(conv as any).last_message_preview || conv.phone}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="min-w-[20px] h-[20px] bg-primary text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Área de chat */}
        <div className="flex-1 bg-[#f0f2f5] dark:bg-[#0a0a0a] flex flex-col overflow-hidden relative min-w-0">
          {/* WhatsApp wallpaper pattern */}
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23000\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M20 20h8v8h-8zM60 60h8v8h-8zM100 20h8v8h-8zM140 60h8v8h-8zM180 20h8v8h-8zM220 60h8v8h-8zM260 20h8v8h-8zM300 60h8v8h-8zM340 20h8v8h-8zM380 60h8v8h-8zM20 100h8v8h-8zM60 140h8v8h-8zM100 100h8v8h-8zM140 140h8v8h-8zM180 100h8v8h-8zM220 140h8v8h-8zM260 100h8v8h-8zM300 140h8v8h-8zM340 100h8v8h-8zM380 140h8v8h-8zM20 180h8v8h-8zM60 220h8v8h-8zM100 180h8v8h-8zM140 220h8v8h-8zM180 180h8v8h-8zM220 220h8v8h-8zM260 180h8v8h-8zM300 220h8v8h-8zM340 180h8v8h-8zM380 220h8v8h-8zM20 260h8v8h-8zM60 300h8v8h-8zM100 260h8v8h-8zM140 300h8v8h-8zM180 260h8v8h-8zM220 300h8v8h-8zM260 260h8v8h-8zM300 300h8v8h-8zM340 260h8v8h-8zM380 300h8v8h-8zM20 340h8v8h-8zM60 380h8v8h-8zM100 340h8v8h-8zM140 380h8v8h-8zM180 340h8v8h-8zM220 380h8v8h-8zM260 340h8v8h-8zM300 380h8v8h-8zM340 340h8v8h-8zM380 380h8v8h-8z\'/%3E%3C/g%3E%3C/svg%3E")'}} />
          {/* Barra de filtro por empleados */}
          {assignedAgents.length > 0 && (
            <div className="px-4 py-2 border-b border-[#d1d7db] dark:border-white/[0.06] bg-[#f0f2f5] dark:bg-[#161616] relative z-10">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-[#54656f] dark:text-gray-400 font-medium whitespace-nowrap mr-1">Filtrar por:</span>
                <button
                  title="Todas las conversaciones"
                  onClick={() => setSelectedAgentFilter(null)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                    selectedAgentFilter === null
                      ? 'bg-primary text-white'
                      : 'bg-[#e9edef] dark:bg-[#1e1e1e] text-[#54656f] dark:text-gray-200 hover:bg-[#d9dbdf] dark:hover:bg-white/10'
                  }`}
                >
                  <Icon icon="solar:users-group-rounded-bold" width={16} />
                  <span className="text-xs font-medium">Todos</span>
                </button>
                {assignedAgents.map(agent => (
                  <button
                    key={agent.id}
                    title={`${agent.name} (${agent.count} conversaciones)`}
                    onClick={() => setSelectedAgentFilter(selectedAgentFilter === agent.id ? null : agent.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                      selectedAgentFilter === agent.id
                        ? 'bg-primary text-white'
                        : 'bg-[#e9edef] dark:bg-[#1e1e1e] text-[#54656f] dark:text-gray-200 hover:bg-[#d9dbdf] dark:hover:bg-white/10'
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
                      selectedAgentFilter === agent.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'
                    }`}>
                      {agent.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedConversation ? (
            <>
              {/* Header del chat */}
              <div className="h-[59px] px-4 border-b border-[#d1d7db] dark:border-white/[0.06] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#161616] relative z-40 overflow-visible">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowContactInfo(!showContactInfo)}>
                  <div className="w-10 h-10 bg-[#dfe5e7] dark:bg-gray-700 rounded-full flex items-center justify-center text-[#54656f] dark:text-gray-300 font-medium text-sm hover:opacity-80 transition-opacity">
                    {selectedConversation.contact_push_name?.charAt(0).toUpperCase() || selectedConversation.phone.slice(-2)}
                  </div>
                  <div>
                    <h3 className="font-normal text-[16px] text-[#111b21] dark:text-white flex items-center gap-2 hover:underline">
                      {selectedConversation.contact_push_name || selectedConversation.contact_name || selectedConversation.phone}
                      <Icon icon={getPriorityIcon(selectedConversation.priority).icon} width={14} className={getPriorityIcon(selectedConversation.priority).color} />
                    </h3>
                    <p className="text-[13px] text-[#667781] dark:text-gray-400 flex items-center gap-2">
                      {selectedConversation.phone}
                      {isTyping && (
                        <span className="text-primary flex items-center gap-1">
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                          escribiendo...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0">
                  <button 
                    onClick={() => setShowMessageSearch(!showMessageSearch)}
                    className={`p-[8px] rounded-full transition-colors ${showMessageSearch ? 'bg-gray-200 dark:bg-white/10 text-primary' : 'hover:bg-gray-200 dark:hover:bg-white/10 text-[#54656f] dark:text-gray-400'}`}
                    title="Buscar en conversación"
                  >
                    <Icon icon="solar:magnifer-bold" width={22} />
                  </button>
                  <div className="relative" ref={actionsMenuRef}>
                    <button 
                      ref={actionsButtonRef}
                      className="p-[8px] hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-[#54656f] dark:text-gray-400"
                      onClick={() => {
                        if (!showActionsMenu && actionsButtonRef.current) {
                          const rect = actionsButtonRef.current.getBoundingClientRect();
                          setActionsMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        }
                        setShowActionsMenu(!showActionsMenu);
                        setShowAttachMenu(false);
                      }}
                    >
                      <Icon icon="tabler:dots-vertical" width={22} />
                    </button>
                    {showActionsMenu && createPortal(
                      <div 
                        ref={actionsPortalRef}
                        className="fixed w-56 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#233138] z-[99999] py-1"
                        style={{ top: actionsMenuPos.top, right: actionsMenuPos.right }}
                      >
                        <button onClick={() => { setShowContactInfo(!showContactInfo); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
                          Info. del contacto
                        </button>
                        <button onClick={() => { handleAssignToMe(); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:user-plus-bold" className="mr-2" width={16} />
                          Asignarme
                        </button>
                        <button onClick={() => { setShowAssignModal(true); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:transfer-horizontal-bold" className="mr-2" width={16} />
                          Transferir
                        </button>
                        <button onClick={() => { setShowNoteModal(true); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:document-add-bold" className="mr-2" width={16} />
                          Agregar nota
                        </button>
                        <button onClick={openCreateTaskModal} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:checklist-minimalistic-bold" className="mr-2 text-primary" width={16} />
                          Crear tarea
                        </button>
                        {/* Etiquetas sub-menu */}
                        <button onClick={() => setShowTagMenu(!showTagMenu)} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:tag-bold" className="mr-2" width={16} />
                          Etiquetas
                          <Icon icon={showTagMenu ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="ml-auto" width={14} />
                        </button>
                        {showTagMenu && (
                          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-[#1a2730]">
                            {/* Tags existentes */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {availableTags.map(tag => {
                                const isAssigned = (selectedConversation?.tags || []).includes(tag.name);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={async () => {
                                      if (!selectedConversation) return;
                                      try {
                                        if (isAssigned) {
                                          const tags = await whatsappInboxService.removeTagFromConversation(selectedConversation.id, tag.name);
                                          setSelectedConversation({ ...selectedConversation, tags });
                                        } else {
                                          const tags = await whatsappInboxService.addTagToConversation(selectedConversation.id, tag.name);
                                          setSelectedConversation({ ...selectedConversation, tags });
                                        }
                                        loadConversations(true);
                                      } catch (e: any) { setError(e.message); }
                                    }}
                                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                                      isAssigned
                                        ? 'bg-primary/20 border-primary text-primary font-medium'
                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:border-primary/50'
                                    }`}
                                  >
                                    {isAssigned && <Icon icon="solar:check-read-bold" className="inline mr-0.5" width={12} />}
                                    {tag.name}
                                  </button>
                                );
                              })}
                              {availableTags.length === 0 && <p className="text-xs text-gray-400">Sin etiquetas</p>}
                            </div>
                            {/* Crear nueva etiqueta */}
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                placeholder="Nueva etiqueta..."
                                className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newTagInput.trim()) {
                                    try {
                                      const tag = await whatsappInboxService.createTag(newTagInput.trim());
                                      setAvailableTags(prev => [...prev, tag]);
                                      if (selectedConversation) {
                                        const tags = await whatsappInboxService.addTagToConversation(selectedConversation.id, tag.name);
                                        setSelectedConversation({ ...selectedConversation, tags });
                                        loadConversations(true);
                                      }
                                      setNewTagInput('');
                                    } catch (err: any) { setError(err.message); }
                                  }
                                }}
                              />
                              <button
                                onClick={async () => {
                                  if (!newTagInput.trim()) return;
                                  try {
                                    const tag = await whatsappInboxService.createTag(newTagInput.trim());
                                    setAvailableTags(prev => [...prev, tag]);
                                    if (selectedConversation) {
                                      const tags = await whatsappInboxService.addTagToConversation(selectedConversation.id, tag.name);
                                      setSelectedConversation({ ...selectedConversation, tags });
                                      loadConversations(true);
                                    }
                                    setNewTagInput('');
                                  } catch (err: any) { setError(err.message); }
                                }}
                                className="text-xs px-2 py-1 rounded bg-primary text-white hover:bg-primary/90"
                              >
                                <Icon icon="solar:add-circle-bold" width={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
                        <button onClick={() => { handleResolve(); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:check-circle-bold" className="mr-2 text-primary" width={16} />
                          Resolver conversación
                        </button>
                        <button onClick={() => { handleChangePriority('urgent'); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:danger-triangle-bold" className="mr-2 text-red-500" width={16} />
                          Marcar urgente
                        </button>
                        <button onClick={() => { handleChangePriority('high'); setShowActionsMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          <Icon icon="solar:arrow-up-bold" className="mr-2 text-orange-500" width={16} />
                          Prioridad alta
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>

              {/* Buscador de mensajes */}
              {showMessageSearch && (
                <div className="px-3 py-2 border-b border-[#d1d7db] dark:border-white/[0.06] bg-[#f0f2f5] dark:bg-[#161616] absolute top-[59px] left-0 right-0 z-20 shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Buscar en la conversación..."
                        value={messageSearchTerm}
                        onChange={(e) => {
                          setMessageSearchTerm(e.target.value);
                          if (e.target.value.length >= 2) {
                            searchMessagesInConversation(e.target.value);
                          } else {
                            setMessageSearchResults([]);
                          }
                        }}
                        className="w-full text-sm px-3 py-1.5 rounded-lg border-0 bg-white dark:bg-[#1e1e1e] text-[#111b21] dark:text-gray-200 placeholder-[#667781] dark:placeholder-gray-500 focus:ring-0"
                        autoFocus
                      />
                      {searchingMessages && (
                        <Spinner size="xs" className="absolute right-2 top-2" />
                      )}
                    </div>
                    <button onClick={() => { setShowMessageSearch(false); setMessageSearchTerm(''); setMessageSearchResults([]); }} className="text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-gray-300">
                      <Icon icon="solar:close-circle-bold" width={20} />
                    </button>
                  </div>
                  {messageSearchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {messageSearchResults.map(msg => (
                        <div key={msg.id} className="text-xs p-2 rounded bg-gray-50 dark:bg-[#1e1e1e] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                          <div className="flex justify-between">
                            <span className={`font-medium ${msg.direction === 'incoming' ? 'text-primary' : 'text-primary/70'}`}>
                              {msg.direction === 'incoming' ? selectedConversation?.contact_push_name || 'Cliente' : 'Tú'}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500">{new Date(msg.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-200 mt-0.5 line-clamp-2">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {messageSearchTerm.length >= 2 && !searchingMessages && messageSearchResults.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">No se encontraron mensajes</p>
                  )}
                </div>
              )}

              {/* Mensajes */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-[5%] lg:px-[7%] py-2 space-y-[1px] relative z-10"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollTop < 80 && hasOlderMessages && !loadingOlder) {
                    loadOlderMessages();
                  }
                }}
              >
                {/* Botón para cargar mensajes más antiguos */}
                {hasOlderMessages && (
                  <div className="text-center py-2">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                      className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto"
                    >
                      {loadingOlder ? <Spinner size="xs" /> : <Icon icon="solar:arrow-up-bold" width={12} />}
                      {loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}
                    </button>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-[#667781] dark:text-gray-400">
                      <Icon icon="solar:chat-line-bold-duotone" width={48} className="mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Sin mensajes</p>
                      <p className="text-sm mt-1">Envía el primer mensaje</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isOutgoing = msg.direction === 'outgoing';
                      const isFirst = idx === 0 || messages[idx - 1].direction !== msg.direction;
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-[12px]' : 'mt-[2px]'}`}
                        >
                          <div className={`max-w-[65%] ${isOutgoing ? '' : ''}`}>
                            {!isOutgoing && isFirst && msg.sender && (msg.sender_type as string) !== 'contact' && (
                              <div className="text-[12.5px] text-primary mb-[2px] ml-1 font-medium">
                                {msg.sender.name || selectedConversation?.contact_push_name || 'Cliente'}
                              </div>
                            )}
                            {isOutgoing && isFirst && msg.sender_type === 'bot' && (
                              <div className="text-[12.5px] text-primary/70 text-right mb-[2px] mr-1">
                                Chatbot
                              </div>
                            )}
                            {isOutgoing && isFirst && msg.sender_type === 'agent' && msg.sender && (
                              <div className="text-[12.5px] text-primary/70 text-right mb-[2px] mr-1">
                                {msg.sender.name}
                              </div>
                            )}
                            <div
                              className={`px-[9px] py-[5px] text-[14.2px] leading-[19px] ${
                                isOutgoing
                                  ? `bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] ${isFirst ? 'rounded-[7.5px] rounded-tr-none' : 'rounded-[7.5px]'} shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`
                                  : `bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] ${isFirst ? 'rounded-[7.5px] rounded-tl-none' : 'rounded-[7.5px]'} shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`
                              }`}
                            >
                              <MessageContent
                                messageType={msg.message_type}
                                content={msg.content}
                                media={msg.media}
                                isOutgoing={isOutgoing}
                                authToken={authToken}
                              />
                              <div className={`flex items-center justify-end gap-1 mt-[1px] ${isOutgoing ? 'text-[#667781] dark:text-[rgba(255,255,255,0.55)]' : 'text-[#667781] dark:text-gray-400'}`}>
                                <span className="text-[11px]">{formatMessageTime(msg.created_at)}</span>
                                {isOutgoing && (
                                  <Icon 
                                    icon={getMessageStatusIcon(msg.status)} 
                                    width={16}
                                    className={msg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#667781] dark:text-[rgba(255,255,255,0.55)]'}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input de mensaje mejorado */}
              <div className="px-3 py-[5px] bg-[#f0f2f5] dark:bg-[#161616] relative z-10">
                {/* Preview de archivo pendiente */}
                {pendingFile && pendingFilePreview && (
                  <div className="mb-2 p-3 bg-gray-50 dark:bg-[#1e1e1e] rounded-xl">
                    <div className="flex items-start gap-3">
                      <img src={pendingFilePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">{pendingFile.name}</p>
                        <input
                          type="text"
                          value={pendingFileCaption}
                          onChange={(e) => setPendingFileCaption(e.target.value)}
                          placeholder="Agregar descripción..."
                          className="w-full text-sm bg-white dark:bg-[#1e1e1e] border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              sendPendingFile();
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={cancelPendingFile} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors">
                          <Icon icon="solar:close-circle-bold" width={18} className="text-gray-400" />
                        </button>
                        <button
                          onClick={sendPendingFile}
                          disabled={sendingMessage}
                          className="p-1.5 bg-primary text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                        >
                          {sendingMessage ? <Spinner size="sm" /> : <Icon icon="solar:plain-bold" width={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick replies */}
                {showQuickReplies && (
                  <div className="mb-2 p-3 bg-gray-50 dark:bg-[#1e1e1e] rounded-lg max-h-[280px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">Respuestas rápidas</span>
                      <button
                        onClick={() => { setEditingReply(null); setReplyForm({ shortcut: '', title: '', content: '', media_url: '', media_type: '' }); setReplyMediaFile(null); setReplyMediaPreview(null); setShowQuickReplyModal(true); }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Icon icon="solar:add-circle-bold" width={14} /> Nueva
                      </button>
                    </div>
                    {quickReplies.length > 0 ? (
                      <div className="space-y-1 overflow-y-auto flex-1">
                        {quickReplies.map(reply => (
                          <div key={reply.id} className="flex items-center gap-1 group">
                            <button
                              onClick={() => handleQuickReply(reply)}
                              className="flex-1 text-left p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors min-w-0"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">/{reply.shortcut}</span>
                                <span className="font-medium text-sm text-gray-900 dark:text-gray-200 truncate">{reply.title}</span>
                                {reply.media_url && <Icon icon={reply.media_type === 'image' ? 'solar:gallery-bold' : reply.media_type === 'audio' ? 'solar:music-note-bold' : reply.media_type === 'video' ? 'solar:video-frame-bold' : 'solar:document-bold'} width={12} className="text-gray-400 shrink-0" />}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">{reply.message}</div>
                            </button>
                            <div className="hidden group-hover:flex gap-0.5 shrink-0">
                              <button
                                onClick={() => { setEditingReply(reply); setReplyForm({ shortcut: reply.shortcut || '', title: reply.title, content: reply.message || reply.content || '', media_url: reply.media_url || '', media_type: reply.media_type || '' }); setReplyMediaFile(null); setReplyMediaPreview(null); setShowQuickReplyModal(true); }}
                                className="p-1 text-gray-400 hover:text-primary rounded"
                                title="Editar"
                              >
                                <Icon icon="solar:pen-bold" width={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('¿Eliminar esta respuesta rápida?')) return;
                                  try {
                                    await whatsappInboxService.deleteQuickReply(reply.id);
                                    setQuickReplies(prev => prev.filter(r => r.id !== reply.id));
                                  } catch (e: any) { setError(e.message); }
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 rounded"
                                title="Eliminar"
                              >
                                <Icon icon="solar:trash-bin-trash-bold" width={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">No hay respuestas rápidas. Crea una para empezar.</p>
                    )}
                  </div>
                )}

                {/* Picker de emojis completo */}
                {showEmojiPicker && (
                  <div className="mb-2 bg-gray-50 dark:bg-[#1e1e1e] rounded-xl overflow-hidden">
                    {/* Tabs de categorías */}
                    <div className="flex border-b border-gray-200 dark:border-gray-600 overflow-x-auto">
                      {Object.keys(emojiCategories).map(category => (
                        <button
                          key={category}
                          onClick={() => setSelectedEmojiCategory(category)}
                          className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                            selectedEmojiCategory === category
                              ? 'text-primary border-b-2 border-primary bg-white dark:bg-[#1e1e1e]'
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
                            className="w-8 h-8 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors text-xl flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Instance disconnected check */}
                {!instanceConnected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <Icon icon="solar:link-broken-bold" width={20} className="text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">
                          Línea de WhatsApp no conectada
                        </p>
                        <p className="text-[11px] text-red-600 dark:text-red-500">
                          Debes conectar primero tu línea de WhatsApp Cloud API para poder enviar y recibir mensajes.
                        </p>
                      </div>
                    </div>
                    <button
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors text-sm font-medium"
                      onClick={() => navigate('/apps/whatsapp/conexiones')}
                    >
                      <Icon icon="solar:plug-circle-bold" width={16} />
                      Ir a Conexiones WhatsApp
                    </button>
                  </div>
                ) : isRecording ? (
                  <div className="flex items-center gap-3 py-1">
                    <button onClick={cancelRecording} title="Cancelar grabación" className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Icon icon="solar:trash-bin-trash-bold" width={20} className="text-red-500" />
                    </button>
                    <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
                      <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        Grabando {formatRecordingTime(recordingDuration)}
                      </span>
                      <div className="flex-1 flex items-center gap-0.5">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-red-300 dark:bg-red-600 rounded-full animate-pulse"
                            style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 50}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={stopRecording}
                      title="Enviar nota de voz"
                      className="p-2.5 bg-primary text-white rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                      <Icon icon="solar:plain-bold" width={20} />
                    </button>
                  </div>
                ) : !conversationWindow.isOpen && conversationWindow.connectionType !== 'baileys' ? (
                  /* 24h Window Closed - Meta Cloud API / YCloud restriction */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <Icon icon="solar:clock-circle-bold" width={18} className="text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          Ventana de conversación cerrada (24h)
                        </p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-500">
                          Según las directrices de Meta, solo puedes enviar plantillas aprobadas fuera de la ventana de 24 horas.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                        onClick={handleOpenTemplateModal}
                      >
                        <Icon icon="solar:document-text-bold" width={16} />
                        Enviar plantilla aprobada
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 24h Window Open - Free-form messaging allowed */
                  <div className="space-y-1">
                    {/* Window status indicator */}
                    {conversationWindow.hoursRemaining <= 4 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                        <Icon icon="solar:clock-circle-bold" width={12} className="text-amber-500" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          Ventana de conversación: {conversationWindow.hoursRemaining}h restantes
                        </span>
                      </div>
                    )}
                    <div className="flex items-end gap-[5px]">
                      {/* Left icons: emoji, quick replies, attach */}
                      <button 
                        title="Emojis"
                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowQuickReplies(false); }}
                        className={`p-[6px] rounded-full transition-colors ${showEmojiPicker ? 'text-primary' : 'text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-gray-300'}`}
                      >
                        <Icon icon="solar:emoji-funny-circle-bold" width={24} />
                      </button>
                      <button 
                        title="Respuestas rápidas"
                        onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmojiPicker(false); }}
                        className={`p-[6px] rounded-full transition-colors ${showQuickReplies ? 'text-primary' : 'text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-gray-300'}`}
                      >
                        <Icon icon="solar:lightning-bold" width={24} />
                      </button>
                      <div className="relative" ref={attachMenuRef}>
                        <button 
                          title="Adjuntar archivo" 
                          className="p-[6px] rounded-full transition-colors text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-gray-300"
                          onClick={() => { setShowAttachMenu(!showAttachMenu); setShowActionsMenu(false); }}
                        >
                          <Icon icon="solar:paperclip-bold" width={24} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                        {showAttachMenu && (
                          <div className="absolute left-0 bottom-full mb-2 w-48 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#233138] z-[9999] py-1 overflow-hidden">
                            <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                              <Icon icon="solar:gallery-bold" className="mr-2 text-blue-500" width={16} />
                              Imagen
                            </button>
                            <button onClick={() => { docInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                              <Icon icon="solar:document-bold" className="mr-2 text-red-500" width={16} />
                              Documento
                            </button>
                            <button onClick={() => { audioInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                              <Icon icon="solar:music-note-bold" className="mr-2 text-purple-500" width={16} />
                              Audio
                            </button>
                            <button onClick={() => { videoInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                              <Icon icon="solar:video-frame-bold" className="mr-2 text-green-500" width={16} />
                              Video
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Hidden file inputs */}
                      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                      <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={handleFileSelect} />
                      <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleFileSelect} />
                      <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
                      
                      {/* Input field */}
                      <div className="flex-1 relative">
                        {/* Slash command autocomplete menu */}
                        {showSlashMenu && slashResults.length > 0 && (
                          <div className="absolute bottom-full mb-1 left-0 right-0 bg-white dark:bg-[#233138] rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50 max-h-[200px] overflow-y-auto">
                            {slashResults.map((reply, idx) => (
                              <button
                                key={reply.id}
                                onClick={() => {
                                  setShowSlashMenu(false);
                                  setSlashResults([]);
                                  handleQuickReply(reply);
                                }}
                                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                                  idx === slashSelectedIndex ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                <span className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded shrink-0">/{reply.shortcut}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{reply.title}</div>
                                  <div className="text-xs text-gray-500 truncate">{reply.message || reply.content}</div>
                                </div>
                                {reply.media_url && <Icon icon={reply.media_type === 'image' ? 'solar:gallery-bold' : reply.media_type === 'audio' ? 'solar:music-note-bold' : reply.media_type === 'video' ? 'solar:video-frame-bold' : 'solar:document-bold'} width={14} className="text-gray-400 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                        <textarea
                          ref={inputRef}
                          value={newMessage}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewMessage(val);
                            // Slash command detection
                            if (val.startsWith('/') && val.length > 1) {
                              const query = val.slice(1).toLowerCase();
                              const matches = quickReplies.filter(r =>
                                (r.shortcut && r.shortcut.toLowerCase().includes(query)) ||
                                r.title.toLowerCase().includes(query)
                              );
                              setSlashResults(matches);
                              setShowSlashMenu(matches.length > 0);
                              setSlashSelectedIndex(0);
                            } else if (val === '/') {
                              setSlashResults(quickReplies);
                              setShowSlashMenu(quickReplies.length > 0);
                              setSlashSelectedIndex(0);
                            } else {
                              setShowSlashMenu(false);
                              setSlashResults([]);
                            }
                          }}
                          placeholder="Escribe un mensaje o / para plantillas"
                          rows={1}
                          className="w-full px-[12px] py-[9px] text-[15px] bg-white dark:bg-[#1e1e1e] border-0 rounded-[8px] focus:ring-0 text-[#111b21] dark:text-gray-200 placeholder-[#667781] dark:placeholder-gray-500 resize-none"
                          style={{ minHeight: '42px', maxHeight: '120px' }}
                          onKeyDown={(e) => {
                            // Slash menu navigation
                            if (showSlashMenu && slashResults.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSlashSelectedIndex(prev => Math.min(prev + 1, slashResults.length - 1));
                                return;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
                                return;
                              }
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const selected = slashResults[slashSelectedIndex];
                                if (selected) {
                                  setShowSlashMenu(false);
                                  setSlashResults([]);
                                  handleQuickReply(selected);
                                }
                                return;
                              }
                              if (e.key === 'Escape') {
                                setShowSlashMenu(false);
                                setSlashResults([]);
                                return;
                              }
                            }
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
                      
                      {/* Mic or Send button */}
                      <button
                        onClick={newMessage.trim() ? sendMessage : startRecording}
                        disabled={newMessage.trim() ? sendingMessage : isRecording}
                        className="p-[6px] rounded-full transition-colors text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-gray-300"
                        title={newMessage.trim() ? 'Enviar mensaje' : 'Grabar nota de voz'}
                      >
                        {sendingMessage ? <Spinner size="sm" /> : (
                          <Icon icon={newMessage.trim() ? "solar:plain-bold" : "solar:microphone-bold"} width={24} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center relative z-10">
              {instanceOptions.length === 0 && !loading ? (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Icon icon="solar:smartphone-bold-duotone" className="text-gray-400" width={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    No hay conexiones configuradas
                  </h3>
                  <p className="text-gray-500 mt-2 max-w-md mx-auto">
                    Crea una nueva conexión para empezar a usar WhatsApp Business y enviar mensajes a tus clientes.
                  </p>
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => navigate('/apps/whatsapp/conexiones')}
                      className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Icon icon="solar:add-circle-bold" width={18} />
                      Crear Primera Conexión
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-[320px] mx-auto mb-6">
                    <Icon icon="solar:chat-round-dots-bold-duotone" width={80} className="text-gray-300 dark:text-gray-800 mx-auto" />
                  </div>
                  <h3 className="text-[28px] font-light text-gray-600 dark:text-white">Guro Live Chat</h3>
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-3 max-w-[480px]">Envía y recibe mensajes. Selecciona una conversación para empezar.</p>
                  <div className="mt-6 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-[14px]">
                    <Icon icon="solar:lock-keyhole-bold" width={14} />
                    <span>Cifrado de extremo a extremo</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel de información del contacto */}
        {selectedConversation && showContactInfo && (
          <div className="w-[340px] bg-[#f0f2f5] dark:bg-[#111] border-l border-[#d1d7db] dark:border-white/[0.06] flex flex-col overflow-hidden">
            {/* Right panel header */}
            <div className="h-[59px] px-6 bg-[#f0f2f5] dark:bg-[#161616] border-b border-[#d1d7db] dark:border-white/[0.06] flex items-center gap-6">
              <button onClick={() => setShowContactInfo(false)} className="text-[#54656f] dark:text-gray-400 hover:text-[#111b21] dark:hover:text-white transition-colors">
                <Icon icon="solar:close-circle-bold" width={24} />
              </button>
              <span className="text-[16px] text-[#111b21] dark:text-white">Info. del contacto</span>
            </div>
            <div className="text-center py-8 bg-white dark:bg-[#111]">
              <div className="w-[200px] h-[200px] bg-[#dfe5e7] dark:bg-gray-700 rounded-full flex items-center justify-center text-[#54656f] dark:text-gray-300 text-6xl font-light mx-auto mb-4">
                {(selectedConversation.contact_first_name || selectedConversation.contact_push_name)?.charAt(0).toUpperCase() || selectedConversation.phone.slice(-2)}
              </div>
              <h4 className="text-[22px] font-normal text-[#111b21] dark:text-white">
                {selectedConversation.contact_first_name && selectedConversation.contact_last_name
                  ? `${selectedConversation.contact_first_name} ${selectedConversation.contact_last_name}`
                  : selectedConversation.contact_push_name || selectedConversation.contact_name || 'Sin nombre'}
              </h4>
              <p className="text-[14px] text-[#667781] dark:text-gray-400 mt-1">{selectedConversation.phone}</p>
            </div>

            <div className="space-y-0 flex-1 overflow-y-auto">
              {/* Datos de contacto capturados */}
              {(selectedConversation.contact_first_name || selectedConversation.contact_last_name || 
                selectedConversation.contact_document_id || selectedConversation.contact_email ||
                selectedConversation.contact_company || selectedConversation.contact_city) && (
                <div className="px-7 py-4 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                  <div className="flex items-center gap-2 text-xs text-primary mb-3 font-medium">
                    <Icon icon="solar:user-id-bold" width={14} />
                    Datos del contacto
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedConversation.contact_first_name && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Nombre:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_first_name}</span>
                      </div>
                    )}
                    {selectedConversation.contact_last_name && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Apellido:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_last_name}</span>
                      </div>
                    )}
                    {selectedConversation.contact_document_id && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Cédula:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_document_id}</span>
                      </div>
                    )}
                    {selectedConversation.contact_email && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Email:</span>
                        <span className="font-medium text-[#111b21] dark:text-white truncate ml-2">{selectedConversation.contact_email}</span>
                      </div>
                    )}
                    {selectedConversation.contact_phone_secondary && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Tel. secundario:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_phone_secondary}</span>
                      </div>
                    )}
                    {selectedConversation.contact_company && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Empresa:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_company}</span>
                      </div>
                    )}
                    {selectedConversation.contact_city && (
                      <div className="flex justify-between">
                        <span className="text-[#667781] dark:text-gray-400">Ciudad:</span>
                        <span className="font-medium text-[#111b21] dark:text-white">{selectedConversation.contact_city}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-1">
                  <Icon icon="solar:tag-bold" width={14} />
                  Estado
                </div>
                <Badge color={getStatusColor(selectedConversation.status)} size="sm">
                  {getStatusLabel(selectedConversation.status)}
                </Badge>
              </div>

              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-1">
                  <Icon icon="solar:buildings-bold" width={14} />
                  Departamento
                </div>
                <p className="font-medium text-sm text-[#111b21] dark:text-white">{selectedConversation.department?.name || 'Sin asignar'}</p>
              </div>

              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-1">
                  <Icon icon="solar:user-bold" width={14} />
                  Agente
                </div>
                <p className="font-medium text-sm text-[#111b21] dark:text-white">{selectedConversation.assigned_agent?.name || 'Sin asignar'}</p>
              </div>

              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-1">
                  <Icon icon="solar:chat-round-dots-bold" width={14} />
                  Mensajes
                </div>
                <p className="font-medium text-sm text-[#111b21] dark:text-white">{selectedConversation.message_count}</p>
              </div>

              {selectedConversation.contact_notes && (
                <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
                    <Icon icon="solar:notes-bold" width={14} />
                    Notas del contacto
                  </div>
                  <p className="text-sm text-[#3b4a54] dark:text-gray-200">{selectedConversation.contact_notes}</p>
                </div>
              )}

              {selectedConversation.tags && selectedConversation.tags.length > 0 && (
                <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                  <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-2">
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

              {/* Notas internas de la conversación */}
              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400">
                    <Icon icon="solar:document-add-bold" width={14} />
                    Notas internas ({conversationNotes.length})
                  </div>
                  <button 
                    onClick={() => setShowNoteModal(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Agregar
                  </button>
                </div>
                {conversationNotes.length > 0 ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {conversationNotes.map((note: any) => (
                      <div key={note.id} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
                        <p className="text-xs text-[#3b4a54] dark:text-gray-200 whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#667781] dark:text-gray-500">
                          <span className="font-medium">{note.user?.name || 'Sistema'}</span>
                          <span>·</span>
                          <span>{new Date(note.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Sin notas</p>
                )}
              </div>

              {/* Pólizas del cliente */}
              <div className="px-7 py-3 bg-white dark:bg-[#111] border-b border-[#e9edef] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-gray-400 mb-2">
                  <Icon icon="solar:shield-check-bold" width={14} />
                  Pólizas del cliente ({clientPolicies.length})
                </div>
                {clientPolicies.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {clientPolicies.map((pol: any) => {
                      const isActive = pol.status === 'active' || pol.status === 'vigente';
                      return (
                        <div key={pol.id} className={`p-2.5 rounded-lg border ${isActive ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/30'}`}>
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="text-xs font-semibold text-[#111b21] dark:text-white truncate">{pol.policy_number}</span>
                              </div>
                              <p className="text-[11px] text-[#667781] dark:text-gray-400 truncate">{pol.insurance_company} · {pol.product_name || pol.type || 'Póliza'}</p>
                              {pol.premium_amount && (
                                <p className="text-[11px] text-[#111b21] dark:text-gray-300 font-medium mt-0.5">
                                  ${Number(pol.premium_amount).toLocaleString('es-CO')} {pol.payment_frequency || ''}
                                </p>
                              )}
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {pol.start_date ? new Date(pol.start_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'} → {pol.end_date ? new Date(pol.end_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                                const lines = [
                                  `*Póliza No. ${pol.policy_number}*`,
                                  ``,
                                  `*Aseguradora:* ${pol.insurance_company || 'N/A'}`,
                                  `*Producto:* ${pol.product_name || pol.type || 'N/A'}`,
                                  pol.premium_amount ? `*Prima:* $${Number(pol.premium_amount).toLocaleString('es-CO')}` : null,
                                  pol.insured_amount ? `*Valor asegurado:* $${Number(pol.insured_amount).toLocaleString('es-CO')}` : null,
                                  `*Inicio:* ${fmtDate(pol.start_date)}`,
                                  `*Vencimiento:* ${fmtDate(pol.end_date)}`,
                                  pol.payment_frequency ? `*Frecuencia de pago:* ${pol.payment_frequency}` : null,
                                  pol.vehicle_plates ? `*Placas:* ${pol.vehicle_plates}` : null,
                                  pol.beneficiary_name ? `*Beneficiario:* ${pol.beneficiary_name}` : null,
                                  pol.insured_name ? `*Asegurado:* ${pol.insured_name}` : null,
                                  `*Estado:* ${isActive ? 'Vigente' : pol.status || 'N/A'}`,
                                ].filter(Boolean).join('\n');
                                setNewMessage(lines);
                                inputRef.current?.focus();
                              }}
                              className="p-1 text-primary hover:bg-primary/10 rounded shrink-0"
                              title="Enviar info al chat"
                            >
                              <Icon icon="solar:plain-bold" width={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : clientData ? (
                  <p className="text-xs text-gray-400 italic">Sin pólizas registradas</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 italic">No se encontró cliente con este teléfono</p>
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-500 font-medium">Vincular con un cliente existente:</p>
                      <div className="relative">
                        <input
                          type="text"
                          value={clientSearchQuery}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setClientSearchQuery(val);
                            if (val.length < 2) { setClientSearchResults([]); return; }
                            setSearchingClients(true);
                            try {
                              const results = await whatsappInboxService.searchClients(val);
                              setClientSearchResults(results);
                            } catch { setClientSearchResults([]); }
                            setSearchingClients(false);
                          }}
                          placeholder="Buscar por nombre, cédula, email..."
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-primary focus:border-primary"
                        />
                        {searchingClients && <div className="absolute right-2 top-1.5"><Icon icon="svg-spinners:ring-resize" width={14} className="text-primary" /></div>}
                      </div>
                      {clientSearchResults.length > 0 && (
                        <div className="space-y-1 max-h-[180px] overflow-y-auto">
                          {clientSearchResults.map((c: any) => (
                            <button
                              key={c.id}
                              disabled={linkingClient}
                              onClick={async () => {
                                if (!selectedConversation) return;
                                setLinkingClient(true);
                                try {
                                  const result = await whatsappInboxService.linkClientPhone(c.id, selectedConversation.phone);
                                  setClientData(result.client);
                                  setClientPolicies(result.policies);
                                  setClientSearchQuery('');
                                  setClientSearchResults([]);
                                } catch (err: any) {
                                  setError(err.message || 'Error al vincular');
                                }
                                setLinkingClient(false);
                              }}
                              className="w-full text-left p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-[#111b21] dark:text-white truncate">{c.first_name} {c.last_name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {c.document_number && `CC ${c.document_number}`}{c.email && ` · ${c.email}`}
                                  </p>
                                </div>
                                <Icon icon="solar:link-bold" width={14} className="text-primary shrink-0 ml-1" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="px-7 py-4 border-t border-[#e9edef] dark:border-white/[0.04] space-y-2">
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

      {/* Modal de transferencia a agente */}
      <Modal show={showAssignModal} onClose={() => { setShowAssignModal(false); setSelectedTransferAgent(null); setAgentDeptFilter('all'); }} size="md">
        <Modal.Header>Transferir conversación</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            {/* Filtro por departamento */}
            {(() => {
              const depts = Array.from(new Set(brokerAgents.map(a => a.cargo).filter(Boolean))) as string[];
              if (depts.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Filtrar por departamento:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setAgentDeptFilter('all')}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${agentDeptFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary/50'}`}
                    >
                      Todos
                    </button>
                    {depts.map(dept => (
                      <button
                        key={dept}
                        onClick={() => setAgentDeptFilter(dept)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${agentDeptFilter === dept ? 'bg-primary text-white border-primary' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary/50'}`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="text-sm text-gray-500">Selecciona el agente al que deseas transferir esta conversación:</p>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {brokerAgents
                .filter(a => agentDeptFilter === 'all' || a.cargo === agentDeptFilter)
                .map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedTransferAgent(agent.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                    selectedTransferAgent === agent.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {agent.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-gray-500 truncate">{agent.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {agent.cargo && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{agent.cargo}</span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">{agent.role}</span>
                  </div>
                </button>
              ))}
              {brokerAgents.filter(a => agentDeptFilter === 'all' || a.cargo === agentDeptFilter).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No hay agentes disponibles</p>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => { setShowAssignModal(false); setSelectedTransferAgent(null); setAgentDeptFilter('all'); }}>Cancelar</Button>
          <Button color="primary" onClick={handleTransferToAgent} disabled={!selectedTransferAgent}>
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

      {/* Modal crear tarea */}
      <Modal show={showCreateTaskModal} onClose={() => setShowCreateTaskModal(false)} size="md">
        <Modal.Header>Crear tarea de seguimiento</Modal.Header>
        <Modal.Body>
          {taskSuccessId ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Icon icon="solar:check-circle-bold" width={32} className="text-green-500" />
              </div>
              <p className="font-semibold text-gray-800 dark:text-white">¡Tarea creada exitosamente!</p>
              <p className="text-sm text-gray-500">La tarea fue creada y quedó disponible en seguimiento.</p>
              <div className="flex gap-2 justify-center">
                <Button color="gray" size="sm" onClick={() => setShowCreateTaskModal(false)}>Cerrar</Button>
                <Button color="primary" size="sm" onClick={() => { setShowCreateTaskModal(false); navigate('/apps/seguros/seguimiento'); }}>
                  <Icon icon="solar:arrow-right-bold" className="mr-1.5" width={14} />
                  Ver en seguimiento
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo</label>
                  <select
                    value={taskForm.type}
                    onChange={(e) => setTaskForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  >
                    <option value="seguimiento_cliente">Seguimiento cliente</option>
                    <option value="llamada">Llamada</option>
                    <option value="cotizacion">Cotización</option>
                    <option value="renovacion">Renovación</option>
                    <option value="documentacion">Documentación</option>
                    <option value="siniestro">Siniestro</option>
                    <option value="reunion">Reunión</option>
                    <option value="email">Email</option>
                    <option value="visita">Visita</option>
                    <option value="inspeccion">Inspección</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prioridad</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha límite</label>
                  <input
                    type="datetime-local"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Método contacto</label>
                  <select
                    value={taskForm.contact_method}
                    onChange={(e) => setTaskForm(p => ({ ...p, contact_method: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Teléfono</option>
                    <option value="email">Email</option>
                    <option value="in_person">Presencial</option>
                    <option value="video_call">Videollamada</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción</label>
                <Textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Contexto adicional de la tarea..."
                  rows={3}
                />
              </div>
              {selectedConversation?.phone && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Icon icon="solar:phone-bold" width={12} />
                  Teléfono: {selectedConversation.phone}
                  {selectedConversation.client_id && <span className="ml-2 text-green-600 dark:text-green-400 flex items-center gap-0.5"><Icon icon="solar:user-check-rounded-bold" width={12} /> Cliente vinculado</span>}
                </p>
              )}
            </div>
          )}
        </Modal.Body>
        {!taskSuccessId && (
          <Modal.Footer>
            <Button color="gray" onClick={() => setShowCreateTaskModal(false)}>Cancelar</Button>
            <Button color="primary" onClick={handleCreateTask} disabled={!taskForm.title.trim() || creatingTask}>
              {creatingTask ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />}
              Crear tarea
            </Button>
          </Modal.Footer>
        )}
      </Modal>

      {/* Modal de crear/editar respuesta rápida */}
      <Modal show={showQuickReplyModal} onClose={() => { setShowQuickReplyModal(false); setEditingReply(null); setReplyMediaFile(null); setReplyMediaPreview(null); }} size="md">
        <Modal.Header>{editingReply ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Atajo (sin /)</label>
              <input
                type="text"
                value={replyForm.shortcut}
                onChange={(e) => setReplyForm(prev => ({ ...prev, shortcut: e.target.value.replace(/\s/g, '').toLowerCase() }))}
                placeholder="ej: saludo, precios, horario"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-gray-400 mt-1">Escribe /{replyForm.shortcut || 'atajo'} en el chat para usar esta plantilla</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
              <input
                type="text"
                value={replyForm.title}
                onChange={(e) => setReplyForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ej: Saludo inicial"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
              <Textarea
                value={replyForm.content}
                onChange={(e) => setReplyForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Escribe el contenido del mensaje..."
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Archivo adjunto (opcional)</label>
              {(replyMediaPreview || replyForm.media_url) ? (
                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {replyForm.media_type === 'image' && (replyMediaPreview || replyForm.media_url) ? (
                    <img src={replyMediaPreview || replyForm.media_url} alt="" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center shrink-0">
                      <Icon icon={replyForm.media_type === 'audio' ? 'solar:music-note-bold' : replyForm.media_type === 'video' ? 'solar:video-frame-bold' : 'solar:document-bold'} width={20} className="text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{replyMediaFile?.name || 'Archivo adjunto'}</p>
                    <p className="text-[10px] text-gray-400">{replyForm.media_type === 'audio' ? 'Audio MP3' : replyForm.media_type}</p>
                    {replyForm.media_type === 'audio' && replyMediaPreview && replyMediaPreview.startsWith('data:') && (
                      <audio controls className="mt-1 h-7 w-full max-w-[240px]" src={replyMediaPreview} />
                    )}
                  </div>
                  <button
                    onClick={() => { setReplyMediaFile(null); setReplyMediaPreview(null); setReplyForm(prev => ({ ...prev, media_url: '', media_type: '' })); }}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" width={16} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Icon icon="solar:upload-bold" width={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Haz clic para adjuntar imagen, audio o archivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,.mp3,.ogg,.wav,.m4a,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setReplyMediaFile(file);
                      let mtype = 'document';
                      if (file.type.startsWith('image/')) mtype = 'image';
                      else if (file.type.startsWith('video/')) mtype = 'video';
                      else if (file.type.startsWith('audio/')) mtype = 'audio';
                      setReplyForm(prev => ({ ...prev, media_type: mtype }));
                      if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setReplyMediaPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setReplyMediaPreview('file-attached');
                      }
                    }}
                  />
                </label>
              )}
              {uploadingReplyMedia && <p className="text-xs text-primary animate-pulse">Subiendo archivo...</p>}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => { setShowQuickReplyModal(false); setEditingReply(null); setReplyMediaFile(null); setReplyMediaPreview(null); }}>Cancelar</Button>
          <Button 
            color="primary" 
            disabled={!replyForm.shortcut.trim() || !replyForm.title.trim() || (!replyForm.content.trim() && !replyForm.media_url && !replyMediaFile) || uploadingReplyMedia}
            onClick={async () => {
              try {
                let mediaUrl = replyForm.media_url;
                let mediaType = replyForm.media_type;
                
                // Si hay archivo nuevo, subirlo via el endpoint de media (reutilizar sendMediaMessage concept)
                if (replyMediaFile && !mediaUrl) {
                  setUploadingReplyMedia(true);
                  // Subir como plantilla media: usar un conversation temporal o endpoint dedicado
                  // Por ahora guardar como data URL para archivos pequeños, o como referencia
                  const reader = new FileReader();
                  const dataUrl = await new Promise<string>((resolve) => {
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsDataURL(replyMediaFile);
                  });
                  mediaUrl = dataUrl;
                  setUploadingReplyMedia(false);
                }

                if (editingReply) {
                  const updated = await whatsappInboxService.updateQuickReply(editingReply.id, {
                    shortcut: replyForm.shortcut,
                    title: replyForm.title,
                    content: replyForm.content,
                    media_url: mediaUrl || null,
                    media_type: mediaType || null,
                  });
                  setQuickReplies(prev => prev.map(r => r.id === editingReply.id ? { ...r, shortcut: updated.shortcut, title: updated.title, message: updated.content || replyForm.content, content: updated.content, media_url: updated.media_url, media_type: updated.media_type } : r));
                } else {
                  const created = await whatsappInboxService.createQuickReply({
                    shortcut: replyForm.shortcut,
                    title: replyForm.title,
                    content: replyForm.content,
                    media_url: mediaUrl || null,
                    media_type: mediaType || null,
                  });
                  setQuickReplies(prev => [...prev, { id: created.id, shortcut: created.shortcut, title: created.title, message: created.content || replyForm.content, content: created.content, media_url: created.media_url, media_type: created.media_type }]);
                }
                setShowQuickReplyModal(false);
                setEditingReply(null);
                setReplyForm({ shortcut: '', title: '', content: '', media_url: '', media_type: '' });
                setReplyMediaFile(null);
                setReplyMediaPreview(null);
              } catch (err: any) {
                setUploadingReplyMedia(false);
                setError(err.message);
              }
            }}
          >
            {editingReply ? 'Guardar cambios' : 'Crear respuesta'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========== TEMPLATE PICKER MODAL ========== */}
      <Modal show={showTemplateModal} onClose={() => setShowTemplateModal(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:document-text-bold" width={20} className="text-blue-500" />
            <span>Enviar plantilla aprobada</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : availableTemplates.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon icon="solar:document-text-bold-duotone" width={28} className="text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Sin plantillas aprobadas</h3>
                <p className="text-xs text-gray-500 mt-1">Crea plantillas desde el apartado de Plantillas y espera la aprobación de Meta.</p>
                <Button color="light" size="sm" className="mt-3 mx-auto" onClick={() => { setShowTemplateModal(false); navigate('/apps/whatsapp/plantillas'); }}>
                  <Icon icon="solar:arrow-right-bold" className="mr-1" width={14} />
                  Ir a Plantillas
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500">Selecciona una plantilla aprobada por Meta para enviar a <span className="font-medium text-gray-700 dark:text-gray-300">{selectedConversation?.contact_first_name || selectedConversation?.contact_push_name || selectedConversation?.phone}</span>:</p>
                {availableTemplates.map((tpl) => {
                  const bodyText = tpl.parsed?.body || '';
                  const vars = extractTemplateVars(bodyText);
                  const contactName = selectedConversation?.contact_first_name || selectedConversation?.contact_push_name || '';

                  return (
                    <div key={tpl.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{tpl.name}</span>
                          <div className="flex gap-1.5 mt-1">
                            <Badge color={tpl.category === 'MARKETING' ? 'purple' : tpl.category === 'UTILITY' ? 'info' : 'gray'} size="xs">
                              {tpl.category === 'MARKETING' ? 'Marketing' : tpl.category === 'UTILITY' ? 'Utilidad' : tpl.category}
                            </Badge>
                            <Badge color="gray" size="xs">{tpl.language === 'es' ? 'Español' : tpl.language}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="bg-[#e5ddd5] dark:bg-gray-900 rounded-lg p-3 mb-3">
                        <div className="max-w-[280px] bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2.5">
                          {tpl.parsed?.header?.text && (
                            <p className="font-bold text-xs text-gray-900 dark:text-white mb-1">{tpl.parsed.header.text}</p>
                          )}
                          <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bodyText}</p>
                          {tpl.parsed?.footer && (
                            <p className="text-[10px] text-gray-400 mt-1">{tpl.parsed.footer}</p>
                          )}
                          {tpl.parsed?.buttons?.length > 0 && (
                            <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-1.5 space-y-1">
                              {tpl.parsed.buttons.map((btn: any, i: number) => (
                                <div key={i} className="text-center py-1 text-[11px] text-blue-500 font-medium border border-blue-50 dark:border-blue-900 rounded">
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Variable inputs */}
                      {vars.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Variables</p>
                          {vars.map((v) => (
                            <div key={v} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-blue-500 w-36 flex-shrink-0">{`{{${v}}}`}</span>
                              <input
                                type="text"
                                value={templateParams[v] ?? (v === 'customer_name' ? contactName : '')}
                                onChange={(e) => setTemplateParams(p => ({ ...p, [v]: e.target.value }))}
                                placeholder={v === 'customer_name' ? contactName || 'Nombre' : v}
                                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        color="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          // Auto-fill customer_name if not set
                          if (vars.includes('customer_name') && !templateParams['customer_name']) {
                            setTemplateParams(p => ({ ...p, customer_name: contactName }));
                          }
                          handleSendTemplate(tpl);
                        }}
                        disabled={sendingTemplate}
                      >
                        {sendingTemplate ? <Spinner size="sm" className="mr-1.5" /> : <Icon icon="solar:plain-bold" className="mr-1.5" width={14} />}
                        Enviar plantilla
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </Modal.Body>
      </Modal>
      {/* Notificación de asignación de conversación */}
      {assignmentNotification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center transform animate-bounceIn">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${assignmentNotification.escalation ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-primary/10'}`}>
              <Icon icon={assignmentNotification.escalation ? 'solar:danger-triangle-bold' : 'solar:chat-round-call-bold'} width={32} className={assignmentNotification.escalation ? 'text-orange-500' : 'text-primary'} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {assignmentNotification.escalation ? 'Conversación escalada' : 'Nueva conversación asignada'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {assignmentNotification.assignedBy === 'Chatbot' ? 'El chatbot transfirió esta conversación' : 'Se te asignó una nueva conversación'}
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
              <p className="text-base font-semibold text-gray-900 dark:text-white">{assignmentNotification.contactName}</p>
              <p className="text-sm text-gray-400">{assignmentNotification.phone}</p>
              {assignmentNotification.reason && (
                <p className="text-xs text-orange-500 mt-1.5 italic">{assignmentNotification.reason}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAssignmentNotification(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const conv = conversations.find(c => c.id === assignmentNotification.conversationId);
                  if (conv) selectConversation(conv);
                  setAssignmentNotification(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
              >
                Abrir conversación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppInboxPro;

import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Spinner, Tooltip, Modal, Table } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { auth } from 'src/config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

interface WhatsAppContact {
  phone: string;
  latest_conversation_id: number;
  contact_push_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_company: string | null;
  contact_city: string | null;
  contact_document_id: string | null;
  contact_notes: string | null;
  total_conversations: number;
  total_messages: number;
  last_interaction_at: string | null;
  first_interaction_at: string | null;
  open_conversations: number;
  conversation_window_open: boolean;
  display_name: string;
  data_consent_at: string | null;
}

interface ContactStats {
  total_contacts: number;
  active_contacts_24h: number;
  new_contacts_this_month: number;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const WhatsAppContactos: React.FC = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editForm, setEditForm] = useState({
    contact_first_name: '',
    contact_last_name: '',
    contact_email: '',
    contact_company: '',
    contact_city: '',
    contact_document_id: '',
    contact_notes: '',
  });
  const [saving, setSaving] = useState(false);

  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No autenticado');
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  };

  const loadContacts = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), per_page: '25' });
      if (search) params.set('search', search);

      const data = await makeRequest(`/saas/whatsapp-inbox/contacts?${params}`);
      setContacts(data.contacts || []);
      setStats(data.stats || null);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts(currentPage, searchTerm);
  }, [currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      loadContacts(1, searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenDetail = (contact: WhatsAppContact) => {
    setSelectedContact(contact);
    setEditForm({
      contact_first_name: contact.contact_first_name || '',
      contact_last_name: contact.contact_last_name || '',
      contact_email: contact.contact_email || '',
      contact_company: contact.contact_company || '',
      contact_city: contact.contact_city || '',
      contact_document_id: contact.contact_document_id || '',
      contact_notes: contact.contact_notes || '',
    });
    setShowDetailModal(true);
  };

  const handleSaveContact = async () => {
    if (!selectedContact) return;
    try {
      setSaving(true);
      await makeRequest(`/saas/whatsapp-inbox/contacts/${encodeURIComponent(selectedContact.phone)}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setShowDetailModal(false);
      loadContacts(currentPage, searchTerm);
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenConversation = (contact: WhatsAppContact) => {
    navigate(`/apps/whatsapp/inbox?conversation=${contact.latest_conversation_id}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return formatDate(dateStr);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Icon icon="solar:users-group-rounded-bold-duotone" width={28} className="text-green-600" />
            </div>
            Contactos WhatsApp
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Icon icon="logos:meta" width={14} />
            Registro de contactos vía Cloud API de Meta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="light" size="sm" onClick={() => loadContacts(currentPage, searchTerm)}>
            <Icon icon="solar:refresh-bold" className="mr-1.5" width={16} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Icon icon="solar:users-group-rounded-bold" width={24} className="text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_contacts}</p>
                <p className="text-xs text-gray-500">Total contactos registrados</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <Icon icon="solar:clock-circle-bold" width={24} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active_contacts_24h}</p>
                <p className="text-xs text-gray-500">Ventana activa (24h)</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${stats.total_contacts > 0 ? (stats.active_contacts_24h / stats.total_contacts) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {stats.total_contacts > 0 ? Math.round((stats.active_contacts_24h / stats.total_contacts) * 100) : 0}% con ventana abierta
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Icon icon="solar:user-plus-bold" width={24} className="text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.new_contacts_this_month}</p>
                <p className="text-xs text-gray-500">Nuevos este mes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cloud API Info Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
        <Icon icon="solar:info-circle-bold" width={20} className="text-blue-500 flex-shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-400">
          <span className="font-medium">Directrices Meta Cloud API:</span> Los contactos se registran automáticamente cuando un usuario envía un mensaje a tu número de WhatsApp Business.
          La ventana de conversación de 24h permite enviar mensajes de formato libre. Fuera de esta ventana, solo se permiten plantillas aprobadas.
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Icon icon="solar:magnifer-bold" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, teléfono, email, empresa..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-primary"
              />
            </div>
            {pagination && (
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {pagination.total} contacto{pagination.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="xl" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:users-group-rounded-bold-duotone" width={32} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Sin contactos</h3>
            <p className="text-sm text-gray-500 mt-1">Los contactos aparecerán aquí cuando alguien te escriba por WhatsApp</p>
          </div>
        ) : (
          <div className="guro-table-wrap">
            <table className="guro-table">
              <thead>
                <tr>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Ventana 24h</th>
                  <th>Conversaciones</th>
                  <th>Mensajes</th>
                  <th>Última interacción</th>
                  <th>Consentimiento</th>
                  <th className="sticky-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.phone} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          contact.conversation_window_open 
                            ? 'bg-gradient-to-br from-green-400 to-green-600' 
                            : 'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          {(contact.contact_first_name || contact.contact_push_name || contact.phone)?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {contact.display_name}
                          </p>
                          {contact.contact_company && (
                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Icon icon="solar:buildings-bold" width={10} />
                              {contact.contact_company}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{contact.phone}</span>
                    </td>
                    <td>
                      {contact.conversation_window_open ? (
                        <Badge color="success" size="sm">
                          <Icon icon="solar:check-circle-bold" width={12} className="mr-1" />
                          Abierta
                        </Badge>
                      ) : (
                        <Tooltip content="Solo se pueden enviar plantillas aprobadas por Meta" trigger="hover">
                          <Badge color="gray" size="sm">
                            <Icon icon="solar:lock-bold" width={12} className="mr-1" />
                            Cerrada
                          </Badge>
                        </Tooltip>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{contact.total_conversations}</span>
                        {Number(contact.open_conversations) > 0 && (
                          <Badge color="info" size="xs">{contact.open_conversations} abierta{Number(contact.open_conversations) > 1 ? 's' : ''}</Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{contact.total_messages}</span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-500">{formatRelativeTime(contact.last_interaction_at)}</span>
                    </td>
                    <td>
                      {contact.data_consent_at ? (
                        <Tooltip content={`Aceptó el ${new Date(contact.data_consent_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`} trigger="hover">
                          <Badge color="success" size="sm">
                            <Icon icon="solar:shield-check-bold" width={12} className="mr-1" />
                            Aceptado
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Badge color="gray" size="sm">
                          <Icon icon="solar:shield-bold" width={12} className="mr-1" />
                          Pendiente
                        </Badge>
                      )}
                    </td>
                    <td className="sticky-right">
                      <div className="flex justify-center gap-1.5">
                        <Tooltip content="Ver conversación" trigger="hover">
                          <Button size="xs" color="light" onClick={() => handleOpenConversation(contact)}>
                            <Icon icon="solar:chat-round-dots-bold" width={14} className="text-green-500" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Editar contacto" trigger="hover">
                          <Button size="xs" color="light" onClick={() => handleOpenDetail(contact)}>
                            <Icon icon="solar:pen-bold" width={14} className="text-blue-500" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500">
              Página {pagination.current_page} de {pagination.last_page} ({pagination.total} contactos)
            </span>
            <div className="flex gap-1">
              <Button
                size="xs"
                color="light"
                disabled={pagination.current_page <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <Icon icon="solar:arrow-left-bold" width={14} />
              </Button>
              <Button
                size="xs"
                color="light"
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <Icon icon="solar:arrow-right-bold" width={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Detail / Edit Modal */}
      <Modal show={showDetailModal} onClose={() => setShowDetailModal(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
              {(selectedContact?.contact_first_name || selectedContact?.contact_push_name || selectedContact?.phone)?.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold">{selectedContact?.display_name}</span>
              <p className="text-xs text-gray-500 font-mono">{selectedContact?.phone}</p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-5">
            {/* Contact Window Status */}
            {selectedContact && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                selectedContact.conversation_window_open
                  ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
              }`}>
                <Icon
                  icon={selectedContact.conversation_window_open ? "solar:check-circle-bold" : "solar:clock-circle-bold"}
                  width={18}
                  className={selectedContact.conversation_window_open ? 'text-green-500' : 'text-amber-500'}
                />
                <div className="text-xs">
                  <span className={`font-medium ${selectedContact.conversation_window_open ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {selectedContact.conversation_window_open
                      ? 'Ventana de conversación abierta — puedes enviar mensajes de formato libre'
                      : 'Ventana de conversación cerrada — solo plantillas aprobadas por Meta'}
                  </span>
                </div>
              </div>
            )}

            {/* Stats Row */}
            {selectedContact && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedContact.total_conversations}</p>
                  <p className="text-[10px] text-gray-500">Conversaciones</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedContact.total_messages}</p>
                  <p className="text-[10px] text-gray-500">Mensajes</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formatDate(selectedContact.first_interaction_at)}</p>
                  <p className="text-[10px] text-gray-500">Primer contacto</p>
                </div>
              </div>
            )}

            {/* Edit Form */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.contact_first_name}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_first_name: e.target.value }))}
                  placeholder="Nombre"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Apellido</label>
                <input
                  type="text"
                  value={editForm.contact_last_name}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_last_name: e.target.value }))}
                  placeholder="Apellido"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.contact_email}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cédula/DNI</label>
                <input
                  type="text"
                  value={editForm.contact_document_id}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_document_id: e.target.value }))}
                  placeholder="Documento de identidad"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Empresa</label>
                <input
                  type="text"
                  value={editForm.contact_company}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_company: e.target.value }))}
                  placeholder="Nombre de empresa"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={editForm.contact_city}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_city: e.target.value }))}
                  placeholder="Ciudad"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notas</label>
                <textarea
                  value={editForm.contact_notes}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_notes: e.target.value }))}
                  placeholder="Notas sobre este contacto..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-between w-full">
            <Button color="light" size="sm" onClick={() => selectedContact && handleOpenConversation(selectedContact)}>
              <Icon icon="solar:chat-round-dots-bold" className="mr-1.5" width={16} />
              Ir a conversación
            </Button>
            <div className="flex gap-2">
              <Button color="gray" size="sm" onClick={() => setShowDetailModal(false)}>
                Cancelar
              </Button>
              <Button color="primary" size="sm" onClick={handleSaveContact} disabled={saving}>
                {saving ? <Spinner size="sm" className="mr-1.5" /> : <Icon icon="solar:diskette-bold" className="mr-1.5" width={16} />}
                Guardar
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WhatsAppContactos;

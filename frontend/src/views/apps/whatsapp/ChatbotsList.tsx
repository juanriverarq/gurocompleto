import React, { useState, useEffect } from 'react';
import { Badge, Button, Spinner, Modal, TextInput, Textarea, Alert, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { Link } from 'react-router-dom';
import chatbotService, { Chatbot, CreateChatbotRequest } from 'src/services/chatbotService';
import whatsappInstanceService from 'src/services/whatsappInstanceService';
import { useToast } from 'src/hooks/use-toast';

interface WhatsAppInstance {
  id: number;
  instance_id: string;
  phone_number?: string;
  status: string;
  connection_type?: string;
}

const ChatbotsList: React.FC = () => {
  const { toast } = useToast();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    chatbotToActivate: Chatbot;
    activeChatbotName: string;
    activeChatbotId: number;
  } | null>(null);

  const [newChatbot, setNewChatbot] = useState<CreateChatbotRequest>({
    name: '',
    description: '',
    instance_id: '',
    welcome_message: '¡Hola! 👋 Soy un asistente virtual. ¿En qué puedo ayudarte?',
    fallback_message: 'Lo siento, no entendí tu mensaje. Por favor, intenta de nuevo o escribe "ayuda" para ver las opciones disponibles.',
    ai_enabled: false,
    ai_provider: 'none',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [chatbotsRes, instancesRes] = await Promise.all([
        chatbotService.getChatbots(),
        whatsappInstanceService.getInstances(),
      ]);
      
      if (chatbotsRes.success && chatbotsRes.data) {
        setChatbots(chatbotsRes.data);
      }
      
      if (instancesRes.success && instancesRes.data) {
        setInstances(instancesRes.data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los chatbots');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChatbot = async () => {
    if (!newChatbot.name.trim()) {
      setError('El nombre del chatbot es requerido');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const result = await chatbotService.createChatbot(newChatbot);
      
      if (result.success) {
        toast({
          title: '¡Chatbot creado!',
          description: `El chatbot "${newChatbot.name}" se ha creado exitosamente.`,
        });
        setShowCreateModal(false);
        setNewChatbot({
          name: '',
          description: '',
          instance_id: '',
          welcome_message: '¡Hola! 👋 Soy un asistente virtual. ¿En qué puedo ayudarte?',
          fallback_message: 'Lo siento, no entendí tu mensaje. Por favor, intenta de nuevo.',
          ai_enabled: false,
          ai_provider: 'none',
        });
        await loadData();
      } else {
        setError(result.message || 'Error al crear el chatbot');
      }
    } catch (error: any) {
      console.error('Error creando chatbot:', error);
      setError(error.message || 'Error al crear el chatbot');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (chatbot: Chatbot, forceDeactivateOther = false) => {
    try {
      const result = await chatbotService.updateChatbot(chatbot.id, { 
        is_active: !chatbot.is_active,
        ...(forceDeactivateOther ? { force_deactivate_other: true } : {}),
      });
      
      if (result.success) {
        const deactivatedName = result.deactivated_chatbot_name;
        toast({
          title: chatbot.is_active ? 'Chatbot pausado' : 'Chatbot activado',
          description: deactivatedName
            ? `"${chatbot.name}" activado. Se desactivó "${deactivatedName}" automáticamente.`
            : `El chatbot "${chatbot.name}" ha sido ${chatbot.is_active ? 'pausado' : 'activado'}.`,
        });
        await loadData();
      } else if (result.active_chatbot_id && result.active_chatbot_name) {
        setConflictInfo({
          chatbotToActivate: chatbot,
          activeChatbotName: result.active_chatbot_name,
          activeChatbotId: result.active_chatbot_id,
        });
        setShowConflictModal(true);
      } else {
        toast({
          title: 'No se pudo activar el chatbot',
          description: result.message || 'Solo puede haber un chatbot activo por línea.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error actualizando chatbot:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al actualizar el chatbot.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteChatbot = async (chatbot: Chatbot) => {
    if (!confirm(`¿Estás seguro de eliminar el chatbot "${chatbot.name}"?`)) return;

    try {
      const result = await chatbotService.deleteChatbot(chatbot.id);
      
      if (result.success) {
        toast({
          title: 'Chatbot eliminado',
          description: `El chatbot "${chatbot.name}" ha sido eliminado.`,
        });
        await loadData();
      }
    } catch (error) {
      console.error('Error eliminando chatbot:', error);
    }
  };

  const handleChangeInstance = async (chatbot: Chatbot, newInstanceId: string) => {
    try {
      const result = await chatbotService.updateChatbot(chatbot.id, { 
        instance_id: newInstanceId || null 
      });
      if (result.success) {
        const inst = instances.find(i => i.instance_id === newInstanceId);
        toast({
          title: 'Conexión actualizada',
          description: `"${chatbot.name}" ahora usa ${inst ? (inst.phone_number || inst.instance_id) : 'todas las conexiones'}.`,
        });
        await loadData();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo cambiar la conexión.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error cambiando instancia:', error);
    }
  };

  const handleDuplicateChatbot = async (chatbot: Chatbot) => {
    try {
      const result = await chatbotService.duplicateChatbot(chatbot.id);
      
      if (result.success) {
        toast({
          title: 'Chatbot duplicado',
          description: `Se ha creado una copia de "${chatbot.name}".`,
        });
        await loadData();
      }
    } catch (error) {
      console.error('Error duplicando chatbot:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner size="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Header — matches flow editor style */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
              <Icon icon="solar:dialog-bold-duotone" className="text-indigo-600 dark:text-indigo-400" width={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Mis Chatbots
              </h1>
              <p className="text-sm text-gray-500 dark:text-[#9CA3AF] mt-0.5">
                Automatiza respuestas en WhatsApp con flujos inteligentes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Icon icon="solar:add-circle-bold" width={16} />
              Crear Chatbot
            </button>
          </div>
        </div>

        {/* Stats row */}
        {chatbots.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Chatbots', value: chatbots.length, icon: 'solar:dialog-bold-duotone', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400' },
              { label: 'Activos', value: chatbots.filter((c) => c.is_active).length, icon: 'solar:check-circle-bold', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
              { label: 'Flujos', value: chatbots.reduce((s, c) => s + (c.flows_count || 0), 0), icon: 'solar:routing-bold-duotone', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
              { label: 'Triggers', value: chatbots.reduce((s, c) => s + (c.triggers_count || 0), 0), icon: 'solar:bolt-bold-duotone', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
            ].map((s) => (
              <div
                key={s.label}
                className="px-4 py-3 rounded-xl border border-gray-200 dark:border-[#1F1F1F] bg-white dark:bg-[#111111] flex items-center gap-3"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${s.bg} ${s.border}`}>
                  <Icon icon={s.icon} className={s.text} width={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">{s.value}</div>
                  <div className="text-[11px] text-gray-500 dark:text-[#9CA3AF] mt-1 uppercase tracking-wide">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Chatbots Grid */}
      {chatbots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#1F1F1F] bg-white dark:bg-[#111111] p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 mx-auto bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Icon icon="solar:dialog-bold-duotone" className="text-indigo-500 dark:text-indigo-400" width={40} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No hay chatbots configurados
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#9CA3AF] mt-2">
              Crea tu primer chatbot para responder automáticamente a tus clientes en WhatsApp 24/7.
            </p>
            <div className="flex justify-center mt-6">
              <HeroButton icon="solar:add-circle-bold" onClick={() => setShowCreateModal(true)} size="lg">Crear Primer Chatbot</HeroButton>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chatbots.map((chatbot) => (
            <div
              key={chatbot.id}
              className="group relative rounded-2xl border border-gray-200 dark:border-[#1F1F1F] bg-white dark:bg-[#111111] hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5 transition-all overflow-hidden"
            >
              {/* Accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${chatbot.is_active ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500' : 'bg-gray-200 dark:bg-[#1F1F1F]'}`} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                        chatbot.is_active
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-gray-100 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2F2F2F]'
                      }`}
                    >
                      <Icon
                        icon="solar:dialog-bold-duotone"
                        className={chatbot.is_active ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400'}
                        width={24}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {chatbot.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-[#9CA3AF] line-clamp-1 mt-0.5">
                        {chatbot.description || 'Sin descripción'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                      chatbot.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-[#9CA3AF] border-gray-200 dark:border-[#2F2F2F]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${chatbot.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                      {chatbot.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-100 dark:border-[#1F1F1F] flex items-center gap-2">
                    <Icon icon="solar:bolt-bold-duotone" className="text-amber-400 shrink-0" width={16} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{chatbot.triggers_count || 0}</div>
                      <div className="text-[10px] text-gray-500 dark:text-[#9CA3AF] mt-0.5 uppercase tracking-wide">Triggers</div>
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-100 dark:border-[#1F1F1F] flex items-center gap-2">
                    <Icon icon="solar:routing-bold-duotone" className="text-blue-400 shrink-0" width={16} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{chatbot.flows_count || 0}</div>
                      <div className="text-[10px] text-gray-500 dark:text-[#9CA3AF] mt-0.5 uppercase tracking-wide">Flujos</div>
                    </div>
                  </div>
                </div>

                {/* Instance selector */}
                <div className="mt-3">
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-[#9CA3AF] mb-1 uppercase tracking-wide">
                    Conexión WhatsApp
                  </label>
                  <Select
                    sizing="sm"
                    value={chatbot.instance_id || ''}
                    onChange={(e) => handleChangeInstance(chatbot, e.target.value)}
                  >
                    <option value="">Todas las conexiones</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.instance_id}>
                        {inst.phone_number || inst.instance_id}
                        {inst.connection_type === 'cloud_api' ? ' (Cloud API)' : ''}
                        {inst.status === 'connected' ? ' ✓' : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1F1F1F] flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(chatbot)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      chatbot.is_active
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <Icon icon={chatbot.is_active ? 'solar:pause-bold' : 'solar:play-bold'} width={14} />
                    {chatbot.is_active ? 'Pausar' : 'Activar'}
                  </button>
                  <Link to={`/apps/whatsapp/chatbots/flujos?id=${chatbot.id}`} title="Editar flujos del chatbot">
                    <button className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1A1A1A] hover:bg-indigo-50 dark:hover:bg-[#1F1F1F] hover:border-indigo-500/40 text-gray-500 dark:text-[#9CA3AF] hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center justify-center transition-all">
                      <Icon icon="solar:pen-new-square-bold-duotone" width={16} />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDuplicateChatbot(chatbot)}
                    title="Duplicar"
                    className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-[#1F1F1F] text-gray-600 dark:text-[#9CA3AF] hover:text-white flex items-center justify-center transition-all"
                  >
                    <Icon icon="solar:copy-bold" width={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteChatbot(chatbot)}
                    title="Eliminar"
                    className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1A1A1A] hover:bg-red-500/10 hover:border-red-500/40 text-red-500 flex items-center justify-center transition-all"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" width={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Chatbot Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <Modal.Header>
          Crear Nuevo Chatbot
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Chatbot *
              </label>
              <TextInput
                placeholder="Ej: Asistente de Ventas"
                value={newChatbot.name}
                onChange={(e) => setNewChatbot({ ...newChatbot, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <Textarea
                placeholder="Describe el propósito de este chatbot..."
                value={newChatbot.description}
                onChange={(e) => setNewChatbot({ ...newChatbot, description: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Conexión WhatsApp (opcional)
              </label>
              <Select
                value={newChatbot.instance_id || ''}
                onChange={(e) => setNewChatbot({ ...newChatbot, instance_id: e.target.value })}
              >
                <option value="">Sin asignar (todas las conexiones)</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.instance_id}>
                    {instance.phone_number || instance.instance_id}
                    {instance.connection_type === 'cloud_api' ? ' (Cloud API)' : ''}
                    {instance.status === 'connected' ? ' ✓' : ''}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Si no seleccionas una conexión, el chatbot responderá en todas las conexiones activas.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje de Bienvenida
              </label>
              <Textarea
                placeholder="Mensaje que se envía cuando un usuario inicia conversación..."
                value={newChatbot.welcome_message}
                onChange={(e) => setNewChatbot({ ...newChatbot, welcome_message: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje de Fallback
              </label>
              <Textarea
                placeholder="Mensaje cuando el bot no entiende..."
                value={newChatbot.fallback_message}
                onChange={(e) => setNewChatbot({ ...newChatbot, fallback_message: e.target.value })}
                rows={2}
              />
            </div>

            {error && (
              <Alert color="failure" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>
            Cancelar
          </Button>
          <Button color="blue" onClick={handleCreateChatbot} disabled={creating}>
            {creating ? <Spinner size="sm" className="mr-2" /> : null}
            Crear Chatbot
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Conflict Modal - Another chatbot active on same line */}
      <Modal show={showConflictModal} onClose={() => setShowConflictModal(false)} size="md">
        <Modal.Header>
          <span className="flex items-center gap-2 text-yellow-600">
            <Icon icon="solar:danger-triangle-bold" width={22} />
            Conflicto de línea
          </span>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              Ya existe un chatbot activo en esta línea:
            </p>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <Icon icon="solar:bot-bold-duotone" className="text-yellow-500" width={24} />
              <span className="font-semibold text-gray-900 dark:text-white">
                {conflictInfo?.activeChatbotName}
              </span>
              <Badge color="success" className="ml-auto">Activo</Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Solo puede haber <strong>un chatbot activo por línea</strong>. Si continúas, el chatbot 
              <strong> "{conflictInfo?.activeChatbotName}"</strong> será desactivado automáticamente y se activará 
              <strong> "{conflictInfo?.chatbotToActivate?.name}"</strong>.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowConflictModal(false)}>
            Cancelar
          </Button>
          <Button 
            color="warning" 
            onClick={async () => {
              if (conflictInfo) {
                setShowConflictModal(false);
                await handleToggleActive(conflictInfo.chatbotToActivate, true);
              }
            }}
          >
            <Icon icon="solar:restart-bold" className="mr-2" width={18} />
            Desactivar "{conflictInfo?.activeChatbotName}" y activar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ChatbotsList;

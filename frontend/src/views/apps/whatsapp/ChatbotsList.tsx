import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Spinner, Modal, TextInput, Textarea, Alert, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import chatbotService, { Chatbot, CreateChatbotRequest } from 'src/services/chatbotService';
import whatsappInstanceService from 'src/services/whatsappInstanceService';
import { useToast } from 'src/hooks/use-toast';

interface WhatsAppInstance {
  id: number;
  instance_id: string;
  phone_number?: string;
  status: string;
}

const ChatbotsList: React.FC = () => {
  const { toast } = useToast();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
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

  const handleToggleActive = async (chatbot: Chatbot) => {
    try {
      const result = await chatbotService.updateChatbot(chatbot.id, { 
        is_active: !chatbot.is_active 
      });
      
      if (result.success) {
        toast({
          title: chatbot.is_active ? 'Chatbot pausado' : 'Chatbot activado',
          description: `El chatbot "${chatbot.name}" ha sido ${chatbot.is_active ? 'pausado' : 'activado'}.`,
        });
        await loadData();
      }
    } catch (error) {
      console.error('Error actualizando chatbot:', error);
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:bot-bold-duotone" className="text-blue-500" width={28} />
            Mis Chatbots
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona tus bots de respuesta automática
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/apps/whatsapp/chatbots/analisis">
            <Button color="purple">
              <Icon icon="solar:chart-2-bold" className="mr-2" width={20} />
              Análisis
            </Button>
          </Link>
          <Button color="blue" onClick={() => setShowCreateModal(true)}>
            <Icon icon="solar:add-circle-bold" className="mr-2" width={20} />
            Crear Chatbot
          </Button>
        </div>
      </div>

      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Chatbots Grid */}
      {chatbots.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Icon icon="solar:bot-bold-duotone" className="text-gray-400" width={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No hay chatbots configurados
            </h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Crea tu primer chatbot para automatizar respuestas en WhatsApp
            </p>
            <div className="flex justify-center mt-6">
              <Button color="light" onClick={() => setShowCreateModal(true)}>
                <Icon icon="solar:add-circle-bold" className="mr-2" width={18} />
                Crear Primer Chatbot
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${chatbot.is_active ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Icon 
                      icon="solar:bot-bold-duotone" 
                      className={chatbot.is_active ? 'text-blue-500' : 'text-gray-400'} 
                      width={28} 
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {chatbot.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-1">
                      {chatbot.description || 'Sin descripción'}
                    </p>
                  </div>
                </div>
                <Badge color={chatbot.is_active ? 'success' : 'gray'}>
                  {chatbot.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Icon icon="solar:bolt-bold" width={16} />
                  <span>{chatbot.triggers_count || 0} triggers</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Icon icon="solar:routing-bold" width={16} />
                  <span>{chatbot.flows_count || 0} flujos</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    color={chatbot.is_active ? 'warning' : 'success'}
                    className="flex-1"
                    onClick={() => handleToggleActive(chatbot)}
                  >
                    <Icon icon={chatbot.is_active ? 'solar:pause-bold' : 'solar:play-bold'} className="mr-1" width={16} />
                    {chatbot.is_active ? 'Pausar' : 'Activar'}
                  </Button>
                  <Link to={`/apps/whatsapp/chatbots/flujos?id=${chatbot.id}`}>
                    <Button size="sm" color="light">
                      <Icon icon="solar:settings-bold" width={16} />
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    color="light"
                    onClick={() => handleDuplicateChatbot(chatbot)}
                    title="Duplicar"
                  >
                    <Icon icon="solar:copy-bold" width={16} />
                  </Button>
                  <Button 
                    size="sm" 
                    color="light"
                    onClick={() => handleDeleteChatbot(chatbot)}
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="text-red-500" width={16} />
                  </Button>
                </div>
              </div>
            </Card>
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
                    {instance.phone_number || instance.instance_id} {instance.status === 'connected' ? '✓' : ''}
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
    </div>
  );
};

export default ChatbotsList;

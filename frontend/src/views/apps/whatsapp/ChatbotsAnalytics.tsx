import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Spinner, Select, Table, Tabs, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import chatbotService, { Chatbot } from 'src/services/chatbotService';

interface ConversationFlow {
  id: string;
  contact_name: string;
  contact_phone: string;
  chatbot_name: string;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed' | 'abandoned' | 'transferred';
  messages_count: number;
  flow_path: FlowStep[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  ai_summary: string | null;
}

interface FlowStep {
  node_id: string;
  node_name: string;
  node_type: string;
  timestamp: string;
  user_input?: string;
  bot_response?: string;
}

interface ContactCreated {
  id: number;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
  source_chatbot: string;
  conversation_id: string;
}

interface AnalyticsSummary {
  total_conversations: number;
  active_conversations: number;
  completed_conversations: number;
  abandoned_conversations: number;
  avg_messages_per_conversation: number;
  contacts_created: number;
  positive_sentiment_pct: number;
  neutral_sentiment_pct: number;
  negative_sentiment_pct: number;
  top_flows: { name: string; count: number }[];
  peak_hours: { hour: number; count: number }[];
}

const ChatbotsAnalytics: React.FC = () => {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  
  // Mock data - en producción vendrá del backend
  const [conversations, setConversations] = useState<ConversationFlow[]>([]);
  const [contacts, setContacts] = useState<ContactCreated[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationFlow | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Simular carga de datos cuando cambia el filtro
    loadAnalyticsData();
  }, [selectedChatbot, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const chatbotsRes = await chatbotService.getChatbots();
      if (chatbotsRes.success && chatbotsRes.data) {
        setChatbots(chatbotsRes.data);
      }
      await loadAnalyticsData();
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async () => {
    // Mock data - simular datos de análisis
    const mockConversations: ConversationFlow[] = [
      {
        id: 'conv-001',
        contact_name: 'Juan Pérez',
        contact_phone: '+57 300 123 4567',
        chatbot_name: 'Asistente de Ventas',
        started_at: '2025-01-23T08:30:00',
        ended_at: '2025-01-23T08:45:00',
        status: 'completed',
        messages_count: 12,
        sentiment: 'positive',
        ai_summary: 'El cliente consultó sobre seguros de vida. Mostró interés en el plan familiar. Se programó una llamada de seguimiento.',
        flow_path: [
          { node_id: '1', node_name: 'Bienvenida', node_type: 'message', timestamp: '2025-01-23T08:30:00', bot_response: '¡Hola! Bienvenido a Seguros ABC' },
          { node_id: '2', node_name: 'Menú Principal', node_type: 'menu', timestamp: '2025-01-23T08:30:15', user_input: 'Cotizar seguro', bot_response: '¿Qué tipo de seguro te interesa?' },
          { node_id: '3', node_name: 'Tipo Seguro', node_type: 'question', timestamp: '2025-01-23T08:31:00', user_input: 'Seguro de vida', bot_response: 'Excelente elección. Te cuento sobre nuestros planes...' },
          { node_id: '4', node_name: 'Captura Datos', node_type: 'input', timestamp: '2025-01-23T08:35:00', user_input: 'Juan Pérez', bot_response: 'Gracias Juan. ¿Cuál es tu correo?' },
          { node_id: '5', node_name: 'Finalización', node_type: 'message', timestamp: '2025-01-23T08:45:00', bot_response: 'Un asesor te contactará pronto. ¡Gracias!' },
        ],
      },
      {
        id: 'conv-002',
        contact_name: 'María García',
        contact_phone: '+57 310 987 6543',
        chatbot_name: 'Soporte Técnico',
        started_at: '2025-01-23T09:15:00',
        ended_at: null,
        status: 'active',
        messages_count: 5,
        sentiment: 'neutral',
        ai_summary: null,
        flow_path: [
          { node_id: '1', node_name: 'Bienvenida', node_type: 'message', timestamp: '2025-01-23T09:15:00', bot_response: '¡Hola! ¿En qué puedo ayudarte?' },
          { node_id: '2', node_name: 'Consulta', node_type: 'question', timestamp: '2025-01-23T09:15:30', user_input: 'Tengo un problema con mi póliza', bot_response: 'Entiendo. ¿Puedes darme tu número de póliza?' },
        ],
      },
      {
        id: 'conv-003',
        contact_name: 'Carlos López',
        contact_phone: '+57 320 555 1234',
        chatbot_name: 'Asistente de Ventas',
        started_at: '2025-01-22T14:20:00',
        ended_at: '2025-01-22T14:25:00',
        status: 'abandoned',
        messages_count: 3,
        sentiment: 'negative',
        ai_summary: 'El cliente abandonó la conversación después de preguntar por precios. Posible frustración con el tiempo de respuesta.',
        flow_path: [
          { node_id: '1', node_name: 'Bienvenida', node_type: 'message', timestamp: '2025-01-22T14:20:00', bot_response: '¡Hola! Bienvenido' },
          { node_id: '2', node_name: 'Menú', node_type: 'menu', timestamp: '2025-01-22T14:20:30', user_input: 'Precios', bot_response: 'Procesando...' },
        ],
      },
      {
        id: 'conv-004',
        contact_name: 'Ana Martínez',
        contact_phone: '+57 315 222 3333',
        chatbot_name: 'Asistente de Ventas',
        started_at: '2025-01-22T10:00:00',
        ended_at: '2025-01-22T10:30:00',
        status: 'transferred',
        messages_count: 8,
        sentiment: 'positive',
        ai_summary: 'Cliente interesado en seguro empresarial. Requirió atención personalizada por la complejidad del caso. Transferido a asesor senior.',
        flow_path: [
          { node_id: '1', node_name: 'Bienvenida', node_type: 'message', timestamp: '2025-01-22T10:00:00', bot_response: '¡Hola!' },
          { node_id: '2', node_name: 'Consulta Empresa', node_type: 'question', timestamp: '2025-01-22T10:05:00', user_input: 'Seguro para mi empresa', bot_response: '¿Cuántos empleados tiene?' },
          { node_id: '3', node_name: 'Transferencia', node_type: 'transfer', timestamp: '2025-01-22T10:30:00', bot_response: 'Te transfiero con un asesor especializado' },
        ],
      },
    ];

    const mockContacts: ContactCreated[] = [
      { id: 1, name: 'Juan Pérez', phone: '+57 300 123 4567', email: 'juan@email.com', created_at: '2025-01-23T08:35:00', source_chatbot: 'Asistente de Ventas', conversation_id: 'conv-001' },
      { id: 2, name: 'Ana Martínez', phone: '+57 315 222 3333', email: 'ana@empresa.com', created_at: '2025-01-22T10:15:00', source_chatbot: 'Asistente de Ventas', conversation_id: 'conv-004' },
      { id: 3, name: 'Pedro Sánchez', phone: '+57 318 444 5555', created_at: '2025-01-21T16:00:00', source_chatbot: 'Soporte Técnico', conversation_id: 'conv-005' },
    ];

    const mockSummary: AnalyticsSummary = {
      total_conversations: 156,
      active_conversations: 3,
      completed_conversations: 120,
      abandoned_conversations: 18,
      avg_messages_per_conversation: 8.5,
      contacts_created: 45,
      positive_sentiment_pct: 65,
      neutral_sentiment_pct: 25,
      negative_sentiment_pct: 10,
      top_flows: [
        { name: 'Cotización Seguro', count: 45 },
        { name: 'Consulta Estado Póliza', count: 38 },
        { name: 'Soporte General', count: 32 },
        { name: 'Renovación', count: 25 },
      ],
      peak_hours: [
        { hour: 9, count: 25 },
        { hour: 10, count: 32 },
        { hour: 11, count: 28 },
        { hour: 14, count: 22 },
        { hour: 15, count: 30 },
        { hour: 16, count: 19 },
      ],
    };

    setConversations(mockConversations);
    setContacts(mockContacts);
    setSummary(mockSummary);
  };

  const analyzeWithAI = async (conversation: ConversationFlow) => {
    setAnalyzingAI(true);
    // Simular análisis con IA
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updatedConversation = {
      ...conversation,
      ai_summary: conversation.ai_summary || 'Análisis generado: El cliente mostró interés moderado en los servicios. La conversación fue fluida y el bot respondió correctamente a las consultas. Se recomienda seguimiento proactivo.',
      sentiment: conversation.sentiment || 'neutral' as const,
    };
    
    setSelectedConversation(updatedConversation);
    setAnalyzingAI(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'info',
      completed: 'success',
      abandoned: 'failure',
      transferred: 'warning',
    };
    const labels: Record<string, string> = {
      active: 'Activa',
      completed: 'Completada',
      abandoned: 'Abandonada',
      transferred: 'Transferida',
    };
    return <Badge color={colors[status] || 'gray'}>{labels[status] || status}</Badge>;
  };

  const getSentimentIcon = (sentiment: string | null) => {
    if (!sentiment) return <Icon icon="solar:question-circle-bold" className="text-gray-400" width={20} />;
    const icons: Record<string, { icon: string; color: string }> = {
      positive: { icon: 'solar:emoji-funny-circle-bold', color: 'text-green-500' },
      neutral: { icon: 'solar:emoji-bold', color: 'text-yellow-500' },
      negative: { icon: 'solar:emoji-sad-circle-bold', color: 'text-red-500' },
    };
    const config = icons[sentiment];
    return <Icon icon={config.icon} className={config.color} width={20} />;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:chart-2-bold-duotone" className="text-purple-500" width={28} />
            Análisis de Chatbots
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visualiza el flujo de conversaciones, contactos creados y análisis con IA
          </p>
        </div>
        <Link to="/apps/whatsapp/chatbots">
          <Button color="light">
            <Icon icon="solar:arrow-left-bold" className="mr-2" width={18} />
            Volver a Chatbots
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-bold" className="text-gray-500" width={20} />
            <span className="font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
          </div>
          <Select
            value={selectedChatbot}
            onChange={(e) => setSelectedChatbot(e.target.value)}
            className="w-48"
          >
            <option value="all">Todos los chatbots</option>
            {chatbots.map((bot) => (
              <option key={bot.id} value={bot.id.toString()}>{bot.name}</option>
            ))}
          </Select>
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="w-40"
          >
            <option value="today">Hoy</option>
            <option value="7days">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="all">Todo el tiempo</option>
          </Select>
        </div>
      </Card>

      {/* Resumen de métricas */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="text-center">
            <div className="text-3xl font-bold text-blue-600">{summary.total_conversations}</div>
            <div className="text-sm text-gray-500">Conversaciones</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-green-600">{summary.completed_conversations}</div>
            <div className="text-sm text-gray-500">Completadas</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{summary.active_conversations}</div>
            <div className="text-sm text-gray-500">Activas</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-red-600">{summary.abandoned_conversations}</div>
            <div className="text-sm text-gray-500">Abandonadas</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-purple-600">{summary.contacts_created}</div>
            <div className="text-sm text-gray-500">Contactos Creados</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-indigo-600">{summary.avg_messages_per_conversation}</div>
            <div className="text-sm text-gray-500">Msgs Promedio</div>
          </Card>
        </div>
      )}

      {/* Análisis de Sentimiento */}
      {summary && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:emoji-funny-square-bold-duotone" className="text-purple-500" width={24} />
            Análisis de Sentimiento (IA)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Icon icon="solar:emoji-funny-circle-bold" className="text-green-500" width={16} />
                  Positivo
                </span>
                <span className="font-semibold text-green-600">{summary.positive_sentiment_pct}%</span>
              </div>
              <Progress progress={summary.positive_sentiment_pct} color="green" size="lg" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Icon icon="solar:emoji-bold" className="text-yellow-500" width={16} />
                  Neutral
                </span>
                <span className="font-semibold text-yellow-600">{summary.neutral_sentiment_pct}%</span>
              </div>
              <Progress progress={summary.neutral_sentiment_pct} color="yellow" size="lg" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Icon icon="solar:emoji-sad-circle-bold" className="text-red-500" width={16} />
                  Negativo
                </span>
                <span className="font-semibold text-red-600">{summary.negative_sentiment_pct}%</span>
              </div>
              <Progress progress={summary.negative_sentiment_pct} color="red" size="lg" />
            </div>
          </div>
        </Card>
      )}

      {/* Tabs de contenido */}
      <Tabs aria-label="Análisis tabs" variant="underline">
        <Tabs.Item 
          active 
          title={
            <span className="flex items-center gap-2">
              <Icon icon="solar:chat-round-dots-bold" width={18} />
              Conversaciones ({conversations.length})
            </span>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Lista de conversaciones */}
            <Card>
              <h4 className="font-semibold mb-4">Historial de Conversaciones</h4>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedConversation?.id === conv.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:user-circle-bold" className="text-gray-400" width={24} />
                        <div>
                          <div className="font-medium text-sm">{conv.contact_name}</div>
                          <div className="text-xs text-gray-500">{conv.contact_phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSentimentIcon(conv.sentiment)}
                        {getStatusBadge(conv.status)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:bot-bold" width={14} />
                        {conv.chatbot_name}
                      </span>
                      <span>{formatDate(conv.started_at)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:chat-line-bold" width={14} />
                        {conv.messages_count} mensajes
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:routing-bold" width={14} />
                        {conv.flow_path.length} pasos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Detalle de conversación seleccionada */}
            <Card>
              {selectedConversation ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Flujo de Conversación</h4>
                    <Button
                      size="sm"
                      color="purple"
                      onClick={() => analyzeWithAI(selectedConversation)}
                      disabled={analyzingAI}
                    >
                      {analyzingAI ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <Icon icon="solar:magic-stick-3-bold" className="mr-2" width={16} />
                      )}
                      Analizar con IA
                    </Button>
                  </div>

                  {/* Resumen IA */}
                  {selectedConversation.ai_summary && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:magic-stick-3-bold" className="text-purple-500" width={18} />
                        <span className="font-medium text-purple-700 dark:text-purple-300">Resumen IA</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedConversation.ai_summary}</p>
                    </div>
                  )}

                  {/* Timeline del flujo */}
                  <div className="relative pl-6 space-y-4 max-h-[400px] overflow-y-auto">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                    {selectedConversation.flow_path.map((step, index) => (
                      <div key={index} className="relative">
                        <div className={`absolute -left-4 w-4 h-4 rounded-full border-2 ${
                          step.node_type === 'message' ? 'bg-blue-500 border-blue-500' :
                          step.node_type === 'menu' ? 'bg-green-500 border-green-500' :
                          step.node_type === 'question' ? 'bg-yellow-500 border-yellow-500' :
                          step.node_type === 'input' ? 'bg-purple-500 border-purple-500' :
                          step.node_type === 'transfer' ? 'bg-orange-500 border-orange-500' :
                          'bg-gray-500 border-gray-500'
                        }`}></div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{step.node_name}</span>
                            <Badge color="gray" size="xs">{step.node_type}</Badge>
                          </div>
                          {step.user_input && (
                            <div className="text-sm bg-blue-100 dark:bg-blue-900/30 rounded p-2 mb-1">
                              <span className="text-xs text-gray-500">Usuario:</span>
                              <p className="text-blue-700 dark:text-blue-300">{step.user_input}</p>
                            </div>
                          )}
                          {step.bot_response && (
                            <div className="text-sm bg-green-100 dark:bg-green-900/30 rounded p-2">
                              <span className="text-xs text-gray-500">Bot:</span>
                              <p className="text-green-700 dark:text-green-300">{step.bot_response}</p>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(step.timestamp).toLocaleTimeString('es-CO')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Icon icon="solar:chat-round-dots-bold-duotone" className="mx-auto mb-3 opacity-50" width={48} />
                  <p>Selecciona una conversación para ver el flujo</p>
                </div>
              )}
            </Card>
          </div>
        </Tabs.Item>

        <Tabs.Item
          title={
            <span className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-bold" width={18} />
              Contactos Creados ({contacts.length})
            </span>
          }
        >
          <Card className="mt-4">
            <div className="overflow-x-auto">
              <Table striped>
                <Table.Head>
                  <Table.HeadCell>Contacto</Table.HeadCell>
                  <Table.HeadCell>Teléfono</Table.HeadCell>
                  <Table.HeadCell>Email</Table.HeadCell>
                  <Table.HeadCell>Chatbot Origen</Table.HeadCell>
                  <Table.HeadCell>Fecha Creación</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {contacts.map((contact) => (
                    <Table.Row key={contact.id}>
                      <Table.Cell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Icon icon="solar:user-bold" className="text-blue-500" width={16} />
                          </div>
                          {contact.name}
                        </div>
                      </Table.Cell>
                      <Table.Cell>{contact.phone}</Table.Cell>
                      <Table.Cell>{contact.email || '-'}</Table.Cell>
                      <Table.Cell>
                        <Badge color="purple">{contact.source_chatbot}</Badge>
                      </Table.Cell>
                      <Table.Cell>{formatDate(contact.created_at)}</Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button size="xs" color="light" title="Ver conversación">
                            <Icon icon="solar:chat-round-dots-bold" width={14} />
                          </Button>
                          <Link to={`/apps/clientes/editar/${contact.id}`}>
                            <Button size="xs" color="light" title="Ver cliente">
                              <Icon icon="solar:eye-bold" width={14} />
                            </Button>
                          </Link>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Card>
        </Tabs.Item>

        <Tabs.Item
          title={
            <span className="flex items-center gap-2">
              <Icon icon="solar:graph-new-bold" width={18} />
              Flujos Populares
            </span>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Top Flujos */}
            <Card>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:star-bold" className="text-yellow-500" width={20} />
                Flujos Más Utilizados
              </h4>
              <div className="space-y-3">
                {summary?.top_flows.map((flow, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{flow.name}</span>
                    </div>
                    <Badge color="blue">{flow.count} usos</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Horas Pico */}
            <Card>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold" className="text-blue-500" width={20} />
                Horas de Mayor Actividad
              </h4>
              <div className="space-y-2">
                {summary?.peak_hours.map((hour, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="w-16 text-sm text-gray-600">{hour.hour}:00</span>
                    <div className="flex-1">
                      <Progress 
                        progress={(hour.count / Math.max(...summary.peak_hours.map(h => h.count))) * 100} 
                        color="blue" 
                        size="sm"
                      />
                    </div>
                    <span className="w-12 text-sm text-right text-gray-600">{hour.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default ChatbotsAnalytics;

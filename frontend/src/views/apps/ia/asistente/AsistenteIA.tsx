import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Card, TextInput, Badge } from 'flowbite-react';
import { Icon } from '@iconify/react';
import api from 'src/config/api';
import { sanitizeHtml } from 'src/utils/sanitize';
import saraAvatar from 'src/assets/images/profile/sara.webp';

export interface ExportData {
  available: boolean;
  data: {
    headers: string[];
    rows: any[][];
    total_rows: number;
  };
  filename: string;
}

export interface MensajeType {
  id: string;
  tipo: 'usuario' | 'asistente' | 'error';
  mensaje: string;
  timestamp: Date;
  datos?: any;
  intent?: string;
  executionTime?: number;
  mode?: 'rules' | 'ai_sql' | 'fallback' | string;
  export?: ExportData;
}

// Contextos disponibles para búsqueda
const CONTEXTOS = [
  { id: 'auto', label: 'Automático', icon: 'solar:magic-stick-3-bold', color: 'purple', description: 'Detecta automáticamente' },
  { id: 'polizas', label: 'Pólizas', icon: 'solar:document-bold', color: 'blue', description: 'Buscar en pólizas' },
  { id: 'clientes', label: 'Clientes', icon: 'solar:users-group-rounded-bold', color: 'green', description: 'Buscar en clientes' },
  { id: 'siniestros', label: 'Siniestros', icon: 'solar:danger-triangle-bold', color: 'red', description: 'Buscar en siniestros' },
  { id: 'cartera', label: 'Cartera', icon: 'solar:wallet-bold', color: 'yellow', description: 'Cobros y comisiones' },
  { id: 'negocios', label: 'Negocios', icon: 'solar:chart-bold', color: 'indigo', description: 'Embudo de ventas' },
  { id: 'vendedores', label: 'Vendedores', icon: 'solar:user-id-bold', color: 'orange', description: 'Rendimiento' },
  { id: 'vehiculos', label: 'Vehículos', icon: 'solar:car-bold', color: 'cyan', description: 'Autos asegurados' },
];

const AsistenteIA = () => {
  const [mensajes, setMensajes] = useState<MensajeType[]>([
    {
      id: '1',
      tipo: 'asistente',
      mensaje: '¡Hola! Soy **Sara** 👋\n\nTu asistente virtual de Guro para gestionar tu negocio de seguros. Puedo ayudarte con:\n\n📊 **Análisis de tu cartera** - Pólizas, vencimientos, renovaciones\n👥 **Información de clientes** - Búsquedas, historial, contactos\n🚗 **Vehículos asegurados** - Consultas por placa, marca, modelo\n💰 **Finanzas** - Comisiones, pagos, cartera pendiente\n📈 **Reportes personalizados** - Exportables a Excel\n\n**Pregúntame lo que necesites en lenguaje natural.** Por ejemplo:\n• "¿Cuál es el cliente con más pólizas?"\n• "Vehículo con placa ABC123"\n• "Pólizas que vencen este mes"',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}`);
  const [contextoActivo, setContextoActivo] = useState('auto');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, scrollToBottom]);

  // Formatear markdown básico en el mensaje
  const formatMessage = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  // Obtener contexto activo
  const getContextoInfo = () => CONTEXTOS.find(c => c.id === contextoActivo);

  // Enviar mensaje al backend
  const enviarMensaje = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage = inputMessage.trim();
    const contextoInfo = getContextoInfo();
    
    const nuevoMensajeUsuario: MensajeType = {
      id: Date.now().toString(),
      tipo: 'usuario',
      mensaje: contextoActivo !== 'auto' 
        ? `[${contextoInfo?.label}] ${userMessage}` 
        : userMessage,
      timestamp: new Date(),
    };

    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Preparar historial de conversación (últimos 6 mensajes para contexto)
      const recentMessages = mensajes.slice(-6).map(m => ({
        role: m.tipo === 'usuario' ? 'user' : 'assistant',
        content: m.mensaje,
        data: m.datos ? JSON.stringify(m.datos).substring(0, 500) : undefined
      }));

      const response = await api.post('/saas/assistant/query', {
        message: userMessage,
        conversation_id: conversationId,
        context: {
          area: contextoActivo !== 'auto' ? contextoActivo : undefined,
          force_area: contextoActivo !== 'auto',
          history: recentMessages
        }
      });

      const data = response.data;
      
      const respuestaAsistente: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: data.success ? 'asistente' : 'error',
        mensaje: data.response || data.error || 'No pude procesar tu consulta.',
        timestamp: new Date(),
        datos: data.data,
        intent: data.intent?.function,
        executionTime: data.execution_time_ms,
        mode: data.mode,
        export: data.export
      };

      setMensajes(prev => [...prev, respuestaAsistente]);

    } catch (error: any) {
      console.error('Error en consulta al asistente:', error);
      
      const errorMessage: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: 'error',
        mensaje: error.response?.data?.error || error.message || 'Error de conexión con el servidor. Por favor intenta de nuevo.',
        timestamp: new Date(),
      };
      
      setMensajes(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // Manejar Enter para enviar
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  // Usar sugerencia
  const usarSugerencia = (sugerencia: string) => {
    setInputMessage(sugerencia);
    inputRef.current?.focus();
  };

  // Limpiar chat
  const limpiarChat = () => {
    setMensajes([{
      id: Date.now().toString(),
      tipo: 'asistente',
      mensaje: '¡Chat limpiado! ¿En qué puedo ayudarte?',
      timestamp: new Date(),
    }]);
  };

  // Toggle expandir/contraer mensaje
  const toggleExpandMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Formatear resultados expandidos
  const formatExpandedResults = (exportData: ExportData): string => {
    if (!exportData?.data?.rows?.length) return '';
    
    const { headers, rows } = exportData.data;
    let result = '\n\n---\n**📋 Todos los resultados:**\n\n';
    
    rows.forEach((row, index) => {
      result += `**${index + 1}.** `;
      const parts: string[] = [];
      row.forEach((cell, cellIndex) => {
        if (cell !== null && cell !== '') {
          parts.push(`${headers[cellIndex]}: ${cell}`);
        }
      });
      result += parts.slice(0, 5).join(' | ') + '\n';
    });
    
    return result;
  };

  // Exportar a Excel
  const exportarExcel = (exportData: ExportData) => {
    if (!exportData?.available || !exportData?.data?.rows?.length) {
      alert('No hay datos para exportar');
      return;
    }

    const { headers, rows } = exportData.data;
    
    // Crear contenido CSV (compatible con Excel)
    let csvContent = '\uFEFF'; // BOM para UTF-8
    csvContent += headers.join(';') + '\n';
    
    rows.forEach(row => {
      const rowData = row.map(cell => {
        // Escapar comillas y manejar valores con comas
        const cellStr = String(cell ?? '');
        if (cellStr.includes(';') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvContent += rowData.join(';') + '\n';
    });

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', exportData.filename.replace('.xlsx', '.csv'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sugerencias = [
    "¿Cuántas pólizas tengo activas?",
    "Pólizas próximas a vencer en 30 días",
    "Dame un resumen del dashboard",
    "¿Cuántos clientes tengo?",
    "Estado de la cartera",
    "Estadísticas de siniestros",
    "Mejores clientes por prima",
    "Rendimiento de vendedores"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] sm:h-[calc(100vh-90px)] md:h-[calc(100vh-100px)] p-2 sm:p-4">
        {/* Header - Compacto en móvil */}
        <Card className="mb-2 sm:mb-4 p-2 sm:p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <img 
                  src={saraAvatar} 
                  alt="Sara" 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg border-2 border-primary/30"
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-dark dark:text-white">Sara</h3>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">BETA</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Tu asistente virtual de Guro</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Badge color="success" className="capitalize text-xs">
                <span className="hidden sm:inline">Conectado</span>
                <span className="sm:hidden">●</span>
              </Badge>
              <Button size="xs" color="light" onClick={limpiarChat} title="Limpiar chat">
                <Icon icon="solar:trash-bin-minimalistic-outline" width={16} />
              </Button>
            </div>
          </div>
          
          {/* Selector de Contexto - Scroll horizontal en móvil */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 sm:pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium hidden sm:block">📍 Contexto de búsqueda:</p>
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:flex-wrap scrollbar-hide">
              {CONTEXTOS.map((ctx) => (
                <button
                  key={ctx.id}
                  onClick={() => setContextoActivo(ctx.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    contextoActivo === ctx.id
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={ctx.description}
                >
                  <Icon icon={ctx.icon} width={14} />
                  <span className="hidden sm:inline">{ctx.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Chat Messages */}
        <Card className="flex-1 p-2 sm:p-4 overflow-hidden min-h-0">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mb-2 sm:mb-4 pr-1 sm:pr-2">
              {mensajes.map((mensaje) => (
                <div
                  key={mensaje.id}
                  className={`flex ${mensaje.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                >
                  {mensaje.tipo !== 'usuario' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 ${
                      mensaje.tipo === 'error' ? 'bg-red-500' : 'bg-gradient-to-br from-primary to-blue-600'
                    }`}>
                      <Icon 
                        icon={mensaje.tipo === 'error' ? "solar:danger-triangle-bold" : "solar:cpu-bolt-bold"} 
                        className="text-white" 
                        width={16} 
                      />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] sm:max-w-[80%] md:max-w-3xl ${mensaje.tipo === 'usuario' ? '' : ''}`}>
                    <div
                      className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-sm ${
                        mensaje.tipo === 'usuario'
                          ? 'bg-primary text-white rounded-br-md'
                          : mensaje.tipo === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md'
                          : 'bg-gray-50 dark:bg-gray-800 text-dark dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                      }`}
                    >
                      <div 
                        className="whitespace-pre-line text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeHtml(formatMessage(
                            mensaje.mensaje + 
                            (expandedMessages.has(mensaje.id) && mensaje.export?.available 
                              ? formatExpandedResults(mensaje.export) 
                              : '')
                          ))
                        }}
                      />
                      
                      {/* Botón Ver más / Ver menos */}
                      {mensaje.export?.available && mensaje.export.data.total_rows > 10 && (
                        <button
                          onClick={() => toggleExpandMessage(mensaje.id)}
                          className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        >
                          <Icon 
                            icon={expandedMessages.has(mensaje.id) ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} 
                            width={14} 
                          />
                          {expandedMessages.has(mensaje.id) 
                            ? 'Ver menos' 
                            : `Ver todos (${mensaje.export.data.total_rows} resultados)`
                          }
                        </button>
                      )}
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                        <p className="text-xs opacity-60">
                          {mensaje.timestamp.toLocaleTimeString()}
                        </p>
                        <div className="flex items-center gap-2">
                          {/* Botón de exportar */}
                          {mensaje.export?.available && (
                            <button
                              onClick={() => exportarExcel(mensaje.export!)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
                              title="Exportar a Excel"
                            >
                              <Icon icon="solar:file-download-bold" width={14} />
                              Exportar ({mensaje.export.data.total_rows})
                            </button>
                          )}
                          {mensaje.mode && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              mensaje.mode === 'ai_sql' 
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                : mensaje.mode === 'rules'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {mensaje.mode === 'ai_sql' ? '🤖 IA' : mensaje.mode === 'rules' ? '⚡ Reglas' : mensaje.mode}
                            </span>
                          )}
                          {mensaje.executionTime && (
                            <span className="text-xs opacity-60">
                              {mensaje.executionTime}ms
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                    <Icon icon="solar:cpu-bolt-bold" className="text-white" width={16} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl rounded-bl-md border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-xs text-gray-500">Consultando base de datos...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias rápidas */}
            {mensajes.length === 1 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3 font-medium">
                  💡 Prueba estas consultas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sugerencias.map((sugerencia, index) => (
                    <Button
                      key={index}
                      size="xs"
                      color="light"
                      onClick={() => usarSugerencia(sugerencia)}
                      className="text-xs hover:bg-blue-100 dark:hover:bg-blue-800"
                    >
                      {sugerencia}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="flex gap-2 p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-800 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <TextInput
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Pregunta algo..."
                  onKeyDown={handleKeyPress}
                  disabled={isTyping}
                  className="border-0 bg-transparent focus:ring-0 text-sm"
                />
              </div>
              <Button
                color="primary"
                onClick={enviarMensaje}
                disabled={!inputMessage.trim() || isTyping}
                className="px-3 sm:px-6 flex-shrink-0"
              >
                {isTyping ? (
                  <Icon icon="solar:loading-bold" className="animate-spin" width={20} />
                ) : (
                  <Icon icon="solar:plain-bold" width={20} />
                )}
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
};

export default AsistenteIA; 
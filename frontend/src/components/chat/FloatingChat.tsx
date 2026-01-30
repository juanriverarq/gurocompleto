import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, TextInput, Textarea } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import api from 'src/config/api';
import { sanitizeHtml } from 'src/utils/sanitize';
import saraAvatar from 'src/assets/images/profile/sara.webp';

interface ExportData {
  available: boolean;
  data: {
    headers: string[];
    rows: any[][];
    total_rows: number;
  };
  filename: string;
}

interface MensajeType {
  id: string;
  tipo: 'usuario' | 'asistente' | 'error';
  mensaje: string;
  timestamp: Date;
  datos?: any;
  intent?: string;
  executionTime?: number;
  mode?: string;
  export?: ExportData;
}

interface SoporteForm {
  nombre: string;
  email: string;
  asunto: string;
  mensaje: string;
}

const SUPPORT_EMAIL = 'info@gurocontable.com';

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSoporteForm, setShowSoporteForm] = useState(false);
  const [soporteForm, setSoporteForm] = useState<SoporteForm>({
    nombre: '',
    email: '',
    asunto: '',
    mensaje: ''
  });
  const [enviandoSoporte, setEnviandoSoporte] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeType[]>([
    {
      id: '1',
      tipo: 'asistente',
      mensaje: '¡Hola! Soy **Sara** 👋\n\nTu asistente virtual de Guro. Puedo ayudarte con:\n\n📊 **Pólizas** - Consultas, vencimientos, renovaciones\n👥 **Clientes** - Búsquedas, historial, contactos\n🚗 **Vehículos** - Consultas por placa, marca, modelo\n💰 **Finanzas** - Comisiones, pagos, cartera\n📈 **Reportes** - Exportables a Excel\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}`);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Función para exportar a Excel
  const exportToExcel = (exportData: ExportData) => {
    if (!exportData?.available || !exportData?.data) return;
    
    const { headers, rows } = exportData.data;
    
    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportData.filename || 'reporte_sara.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Toggle expandir mensaje
  const toggleExpandMessage = (msgId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

  // Ocultar mensaje de bienvenida después de unos segundos o al abrir el chat
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setShowWelcome(false), 8000);
      return () => clearTimeout(timer);
    } else {
      setShowWelcome(false);
    }
  }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Ya no detectamos comandos especiales automáticamente
  // El soporte se accede solo desde el link "contáctanos" abajo
  const detectarComandoEspecial = (_mensaje: string): string | null => {
    return null;
  };

  // Enviar formulario de soporte
  const enviarSoporte = async () => {
    if (!soporteForm.nombre || !soporteForm.email || !soporteForm.asunto || !soporteForm.mensaje) {
      return;
    }
    
    setEnviandoSoporte(true);
    try {
      await api.post('/saas/support/ticket', {
        nombre: soporteForm.nombre,
        email: soporteForm.email,
        asunto: soporteForm.asunto,
        mensaje: soporteForm.mensaje,
        destinatario: SUPPORT_EMAIL
      });
      
      setShowSoporteForm(false);
      setSoporteForm({ nombre: '', email: '', asunto: '', mensaje: '' });
      
      const respuesta: MensajeType = {
        id: Date.now().toString(),
        tipo: 'asistente',
        mensaje: '✅ **¡Ticket enviado correctamente!**\n\nNuestro equipo de soporte revisará tu solicitud y te contactará pronto al correo proporcionado.\n\n¿Hay algo más en lo que pueda ayudarte?',
        timestamp: new Date(),
      };
      setMensajes(prev => [...prev, respuesta]);
    } catch (error) {
      const respuesta: MensajeType = {
        id: Date.now().toString(),
        tipo: 'error',
        mensaje: 'No pude enviar el ticket. Por favor intenta de nuevo o contáctanos por WhatsApp.',
        timestamp: new Date(),
      };
      setMensajes(prev => [...prev, respuesta]);
    } finally {
      setEnviandoSoporte(false);
    }
  };

  const enviarMensaje = async () => {
    const userMessage = inputMessage.trim();
    if (!userMessage || isTyping) return;

    const nuevoMensajeUsuario: MensajeType = {
      id: Date.now().toString(),
      tipo: 'usuario',
      mensaje: userMessage,
      timestamp: new Date(),
    };

    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInputMessage('');
    
    // Detectar comandos especiales
    const comando = detectarComandoEspecial(userMessage);
    
    // Los comandos especiales ya no se usan
    // El soporte se accede solo desde el link "Contáctanos" abajo
    if (comando) {
      // No hacer nada, continuar con la consulta normal
    }

    setIsTyping(true);

    try {
      const recentMessages = mensajes.slice(-6).map(m => ({
        role: m.tipo === 'usuario' ? 'user' : 'assistant',
        content: m.mensaje,
        data: m.datos ? JSON.stringify(m.datos).substring(0, 500) : undefined
      }));

      const response = await api.post('/saas/assistant/query', {
        message: userMessage,
        conversation_id: conversationId,
        context: {
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
      const errorMessage: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: 'error',
        mensaje: error.response?.data?.error || 'Error de conexión. Intenta de nuevo.',
        timestamp: new Date(),
      };
      setMensajes(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const abrirCompleto = () => {
    navigate('/apps/ia/asistente');
  };

  const nuevaConversacion = () => {
    setMensajes([
      {
        id: Date.now().toString(),
        tipo: 'asistente',
        mensaje: '¡Hola! Soy **Sara** 👋\n\nTu asistente virtual de Guro. Puedo ayudarte con:\n\n📊 **Pólizas** - Consultas, vencimientos, renovaciones\n👥 **Clientes** - Búsquedas, historial, contactos\n🚗 **Vehículos** - Consultas por placa, marca, modelo\n💰 **Finanzas** - Comisiones, pagos, cartera\n📈 **Reportes** - Exportables a Excel\n\n¿En qué puedo ayudarte hoy?',
        timestamp: new Date(),
      }
    ]);
    setExpandedMessages(new Set());
    setShowSoporteForm(false);
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Mensaje flotante de bienvenida */}
      {!isOpen && showWelcome && (
        <div 
          className="fixed bottom-24 right-6 z-50 bg-white dark:bg-darkgray rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs animate-in slide-in-from-right duration-500 cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-start gap-3">
            <img 
              src={saraAvatar} 
              alt="Sara" 
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-400"
            />
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                <strong>¡Hola! Soy Sara</strong> 👋
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Tu asistente virtual. ¿Necesitas ayuda con algo?
              </p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowWelcome(false); }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <Icon icon="solar:close-circle-linear" className="text-lg" />
          </button>
        </div>
      )}

      {/* Botón flotante con avatar de Sara */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 overflow-hidden border-2 ${
          isOpen 
            ? 'bg-gray-600 hover:bg-gray-700 border-gray-500' 
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-white/30'
        }`}
      >
        {isOpen ? (
          <Icon icon="solar:close-circle-bold" className="text-white text-2xl" />
        ) : (
          <img src={saraAvatar} alt="Sara" className="w-full h-full object-cover object-top" />
        )}
      </button>

      {/* Chat flotante */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[520px] bg-white dark:bg-darkgray rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={saraAvatar} 
                alt="Sara" 
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-sm">Sara</h3>
                  <span className="text-[10px] bg-white/20 text-white/90 px-1.5 py-0.5 rounded font-medium">BETA</span>
                </div>
                <p className="text-white/70 text-xs">Asistente de Guro</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={nuevaConversacion}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Nueva conversación"
              >
                <Icon icon="solar:add-circle-bold" className="text-white text-lg" />
              </button>
              <button
                onClick={abrirCompleto}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Abrir en pantalla completa"
              >
                <Icon icon="solar:maximize-bold" className="text-white text-lg" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Minimizar"
              >
                <Icon icon="solar:minus-circle-bold" className="text-white text-lg" />
              </button>
            </div>
          </div>

          {/* Formulario de soporte */}
          {showSoporteForm && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-purple-800 dark:text-purple-300 text-sm">📝 Formulario de Soporte</h4>
                <button onClick={() => setShowSoporteForm(false)} className="text-purple-600 hover:text-purple-800">
                  <Icon icon="solar:close-circle-linear" />
                </button>
              </div>
              <div className="space-y-2">
                <TextInput
                  sizing="sm"
                  placeholder="Tu nombre"
                  value={soporteForm.nombre}
                  onChange={(e) => setSoporteForm(prev => ({ ...prev, nombre: e.target.value }))}
                />
                <TextInput
                  sizing="sm"
                  type="email"
                  placeholder="Tu correo electrónico"
                  value={soporteForm.email}
                  onChange={(e) => setSoporteForm(prev => ({ ...prev, email: e.target.value }))}
                />
                <TextInput
                  sizing="sm"
                  placeholder="Asunto"
                  value={soporteForm.asunto}
                  onChange={(e) => setSoporteForm(prev => ({ ...prev, asunto: e.target.value }))}
                />
                <Textarea
                  rows={2}
                  placeholder="Describe tu problema o solicitud..."
                  value={soporteForm.mensaje}
                  onChange={(e) => setSoporteForm(prev => ({ ...prev, mensaje: e.target.value }))}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  color="purple"
                  className="w-full"
                  onClick={enviarSoporte}
                  disabled={enviandoSoporte || !soporteForm.nombre || !soporteForm.email || !soporteForm.asunto || !soporteForm.mensaje}
                >
                  {enviandoSoporte ? 'Enviando...' : 'Enviar Ticket'}
                </Button>
              </div>
            </div>
          )}

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-dark">
            {mensajes.map((msg) => {
              const isExpanded = expandedMessages.has(msg.id);
              const hasMoreResults = msg.mensaje.includes('_... y ') && msg.mensaje.includes(' más_');
              
              // Procesar mensaje para mostrar versión expandida o colapsada
              let displayMessage = msg.mensaje;
              if (hasMoreResults && isExpanded && msg.export?.data?.rows) {
                // Mostrar todos los resultados desde los datos de exportación
                const headers = msg.export.data.headers;
                const rows = msg.export.data.rows;
                
                // Reconstruir el mensaje con todos los resultados
                const lines = displayMessage.split('\n');
                const headerLines = lines.filter(l => !l.match(/^\d+\.\s/) && !l.includes('_... y '));
                
                const allResults = rows.map((row, idx) => {
                  const parts = headers.map((h, i) => `${h}: ${row[i] || ''}`).filter(p => !p.endsWith(': '));
                  return `${idx + 1}. ${parts.join(' | ')}`;
                }).join('\n');
                
                displayMessage = headerLines.join('\n') + '\n' + allResults;
              }
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.tipo !== 'usuario' && (
                    <img src={saraAvatar} alt="Sara" className="w-7 h-7 rounded-full object-cover mr-2 mt-1" />
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.tipo === 'usuario'
                        ? 'bg-blue-600 text-white'
                        : msg.tipo === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-white dark:bg-darkgray text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatMessage(displayMessage)) }}
                      className="leading-relaxed"
                    />
                    
                    {/* Botones de acción para resultados */}
                    {msg.tipo === 'asistente' && (hasMoreResults || msg.export?.available) && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex gap-2 flex-wrap">
                        {hasMoreResults && (
                          <button
                            onClick={() => toggleExpandMessage(msg.id)}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1"
                          >
                            <Icon icon={isExpanded ? "solar:minimize-bold" : "solar:maximize-bold"} className="text-sm" />
                            {isExpanded ? 'Ver menos' : 'Ver todos'}
                          </button>
                        )}
                        {msg.export?.available && (
                          <button
                            onClick={() => exportToExcel(msg.export!)}
                            className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-1"
                          >
                            <Icon icon="solar:download-bold" className="text-sm" />
                            Exportar Excel
                          </button>
                        )}
                      </div>
                    )}
                    
                    {msg.executionTime && (
                      <div className="mt-1 text-xs opacity-60">
                        ⚡ {msg.executionTime}ms
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {isTyping && (
              <div className="flex justify-start">
                <img src={saraAvatar} alt="Sara" className="w-7 h-7 rounded-full object-cover mr-2" />
                <div className="bg-white dark:bg-darkgray border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Link discreto de ayuda */}
          <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-dark text-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              ¿Problemas?{' '}
              <button onClick={() => setShowSoporteForm(true)} className="underline hover:text-gray-600 dark:hover:text-gray-400">
                Contáctanos
              </button>
            </span>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-darkgray">
            <div className="flex gap-2">
              <TextInput
                ref={inputRef}
                type="text"
                placeholder="Escribe tu pregunta..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isTyping}
                className="flex-1"
                sizing="sm"
              />
              <Button
                color="primary"
                size="sm"
                onClick={enviarMensaje}
                disabled={!inputMessage.trim() || isTyping}
                className="px-3"
              >
                <Icon icon="solar:plain-bold" className="text-lg" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChat;

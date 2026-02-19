import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import api from 'src/config/api';
import { sanitizeHtml } from 'src/utils/sanitize';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import guroToast from 'src/components/GuroToast/GuroToast';

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
  const { user } = useUnifiedAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'usuario';
  const [mensajes, setMensajes] = useState<MensajeType[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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
      guroToast.warning('Sin datos', 'No hay datos para exportar');
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

  const hasMessages = mensajes.length > 0;

  return (
    <div className="h-[calc(100vh-80px)] -mx-2 -mt-2 flex bg-gray-50 dark:bg-[#212121] text-gray-900 dark:text-white overflow-hidden rounded-2xl" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* ── Left icon sidebar ── */}
      <div className="w-[52px] shrink-0 flex flex-col items-center pt-4 gap-3">
        {/* Top actions */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/10 dark:shadow-black/40">
          <button onClick={limpiarChat} title="Nuevo chat"
            className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all active:scale-90">
            <Icon icon="solar:pen-new-square-linear" width={17} />
            <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#333] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">Nuevo chat</div>
          </button>
          <button onClick={() => setShowHistory(!showHistory)} title="Historial"
            className={`group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
              showHistory ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }`}>
            <Icon icon="solar:clock-circle-linear" width={17} />
            <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#333] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">Historial</div>
          </button>
        </div>

        {/* Context filters */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200 dark:border-white/[0.06] shadow-lg shadow-black/10 dark:shadow-black/40">
          {CONTEXTOS.map((ctx) => (
            <button key={ctx.id} onClick={() => setContextoActivo(ctx.id)} title={ctx.label}
              className={`group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 ${
                contextoActivo === ctx.id ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}>
              <Icon icon={ctx.icon} width={15} />
              <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#333] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">{ctx.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-11 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Sara</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">IA</span>
          </div>
          <div className="flex items-center gap-2">
            {contextoActivo !== 'auto' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/[0.06]">
                <Icon icon={getContextoInfo()?.icon || ''} width={11} className="inline mr-1" />
                {getContextoInfo()?.label}
              </span>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="max-w-3xl mx-auto w-full">
            {/* Empty state: greeting */}
            {!hasMessages && !isTyping && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-8 text-center">
                  Me alegro de verte, {firstName}.
                </h1>
              </div>
            )}

            {/* Messages */}
            {hasMessages && (
              <div className="space-y-6 py-4">
                {mensajes.map((mensaje) => (
                  <div key={mensaje.id} className={`flex gap-3 ${mensaje.tipo === 'usuario' ? 'justify-end' : ''}`}>
                    {/* Avatar */}
                    {mensaje.tipo !== 'usuario' && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                        mensaje.tipo === 'error' ? 'bg-red-500/20' : 'bg-purple-500/15'
                      }`}>
                        <Icon
                          icon={mensaje.tipo === 'error' ? 'solar:danger-triangle-bold' : 'solar:cpu-bolt-bold'}
                          width={14}
                          className={mensaje.tipo === 'error' ? 'text-red-400' : 'text-purple-400'}
                        />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`max-w-[85%] sm:max-w-[80%] ${
                      mensaje.tipo === 'usuario'
                        ? 'bg-gray-200 dark:bg-[#2f2f2f] rounded-2xl rounded-br-md px-4 py-3'
                        : mensaje.tipo === 'error'
                        ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl rounded-bl-md px-4 py-3'
                        : ''
                    }`}>
                      <div
                        className={`whitespace-pre-line text-[14px] leading-relaxed ${
                          mensaje.tipo === 'usuario' ? 'text-gray-800 dark:text-gray-100' : mensaje.tipo === 'error' ? 'text-red-600 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(formatMessage(
                            mensaje.mensaje +
                            (expandedMessages.has(mensaje.id) && mensaje.export?.available
                              ? formatExpandedResults(mensaje.export)
                              : '')
                          ))
                        }}
                      />

                      {/* Expand/collapse */}
                      {mensaje.export?.available && mensaje.export.data.total_rows > 10 && (
                        <button
                          onClick={() => toggleExpandMessage(mensaje.id)}
                          className="mt-2 flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Icon icon={expandedMessages.has(mensaje.id) ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} width={13} />
                          {expandedMessages.has(mensaje.id) ? 'Ver menos' : `Ver todos (${mensaje.export.data.total_rows})`}
                        </button>
                      )}

                      {/* Footer meta */}
                      {mensaje.tipo !== 'usuario' && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200/50 dark:border-white/[0.04]">
                          {mensaje.export?.available && (
                            <button
                              onClick={() => exportarExcel(mensaje.export!)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                              <Icon icon="solar:file-download-bold" width={12} />
                              Exportar ({mensaje.export.data.total_rows})
                            </button>
                          )}
                          {mensaje.mode && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${
                              mensaje.mode === 'ai_sql' ? 'bg-purple-500/10 text-purple-400'
                                : mensaje.mode === 'rules' ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-white/5 text-gray-500'
                            }`}>
                              {mensaje.mode === 'ai_sql' ? '🤖 IA' : mensaje.mode === 'rules' ? '⚡ Reglas' : mensaje.mode}
                            </span>
                          )}
                          {mensaje.executionTime && (
                            <span className="text-[10px] text-gray-600">{mensaje.executionTime}ms</span>
                          )}
                          <span className="text-[10px] text-gray-600 ml-auto">{mensaje.timestamp.toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mt-1">
                      <Icon icon="solar:cpu-bolt-bold" width={14} className="text-purple-400" />
                    </div>
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-[11px] text-gray-500">Consultando...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Suggestions (only when empty) */}
        {!hasMessages && !isTyping && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-wrap gap-2 justify-center">
                {sugerencias.slice(0, 4).map((s, i) => (
                  <button key={i} onClick={() => usarSugerencia(s)}
                    className="px-3 py-1.5 rounded-xl text-[11px] text-gray-500 dark:text-gray-400 bg-white dark:bg-[#2f2f2f] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-[#383838] hover:text-gray-700 dark:hover:text-gray-200 transition-all shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom input bar ── */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#1a1a1a] px-3 py-2 shadow-xl shadow-black/5 dark:shadow-black/20 focus-within:border-gray-300 dark:focus-within:border-[#333] transition-colors">
              <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shrink-0" title="Adjuntar">
                <Icon icon="solar:add-circle-linear" width={20} />
              </button>
              <input
                ref={inputRef as any}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isTyping}
                placeholder="Pregunta lo que quieras"
                className="flex-1 !bg-transparent dark:!bg-[#1a1a1a] !border-0 outline-none text-[14px] text-gray-800 dark:!text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 py-1"
              />
              <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shrink-0" title="Voz">
                <Icon icon="solar:microphone-3-linear" width={18} />
              </button>
              <button
                onClick={enviarMensaje}
                disabled={!inputMessage.trim() || isTyping}
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  inputMessage.trim() && !isTyping
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-[#212121] hover:bg-gray-700 dark:hover:bg-gray-200 active:scale-90'
                    : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
                title="Enviar"
              >
                {isTyping
                  ? <Icon icon="solar:stop-bold" width={14} />
                  : <Icon icon="solar:arrow-up-bold" width={16} />
                }
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-2">Sara puede cometer errores. Verifica la información importante.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsistenteIA; 
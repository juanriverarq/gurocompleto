import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import api from 'src/config/api';
import { sanitizeHtml } from 'src/utils/sanitize';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import guroToast from 'src/components/GuroToast/GuroToast';

interface ExportData {
  available: boolean;
  data: { headers: string[]; rows: any[][]; total_rows: number };
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

type OrbVariant = 'fab' | 'avatar' | 'hero' | 'topbar';

const AntiMatterOrb = ({ variant, className = '' }: { variant: OrbVariant; className?: string }) => {
  const sizes: Record<OrbVariant, string> = {
    fab: 'h-16 w-16',
    avatar: 'h-6 w-6',
    hero: 'h-12 w-12',
    topbar: 'h-9 w-9',
  };
  const shadows =
    variant === 'fab'
      ? 'shadow-[0_0_22px_rgba(87,60,255,0.45),0_0_48px_rgba(251,146,60,0.14)] group-hover:shadow-[0_0_28px_rgba(87,60,255,0.55),0_0_56px_rgba(251,146,60,0.2)]'
      : variant === 'topbar'
        ? 'shadow-[0_0_14px_rgba(87,60,255,0.4),0_0_28px_rgba(251,146,60,0.1)] group-hover:shadow-[0_0_18px_rgba(87,60,255,0.55),0_0_36px_rgba(251,146,60,0.16)]'
        : variant === 'hero'
          ? 'shadow-[0_0_16px_rgba(87,60,255,0.3)]'
          : '';

  return (
    <span
      className={`relative flex ${sizes[variant]} shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#573CFF] via-[#573CFF] to-orange-400 p-px transition-shadow ${shadows} ${className}`}
    >
      <span className="relative h-full w-full overflow-hidden rounded-full bg-black">
        <span className="fa-anti-halo pointer-events-none" aria-hidden />
        <span className="fa-anti-ring pointer-events-none" aria-hidden />
        <span className="fa-anti-core pointer-events-none" aria-hidden />
        <span className="fa-anti-spark pointer-events-none" aria-hidden />
      </span>
    </span>
  );
};

interface FloatingAssistantProps {
  variant?: OrbVariant;
}

const FloatingAssistant = ({ variant = 'topbar' }: FloatingAssistantProps = {}) => {
  const { user } = useUnifiedAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'usuario';

  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeType[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}`);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, scrollToBottom]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const formatMessage = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  const enviarMensaje = async () => {
    if (!inputMessage.trim() || isTyping) return;
    const userMessage = inputMessage.trim();

    const nuevoMensaje: MensajeType = {
      id: Date.now().toString(),
      tipo: 'usuario',
      mensaje: userMessage,
      timestamp: new Date(),
    };

    setMensajes((prev) => [...prev, nuevoMensaje]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const recentMessages = mensajes.slice(-6).map((m) => ({
        role: m.tipo === 'usuario' ? 'user' : 'assistant',
        content: m.mensaje,
        data: m.datos ? JSON.stringify(m.datos).substring(0, 500) : undefined,
      }));

      const response = await api.post('/saas/assistant/query', {
        message: userMessage,
        conversation_id: conversationId,
        context: {
          area: undefined,
          force_area: false,
          history: recentMessages,
        },
      });

      const data = response.data;
      setMensajes((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          tipo: data.success ? 'asistente' : 'error',
          mensaje: data.response || data.error || 'No pude procesar tu consulta.',
          timestamp: new Date(),
          datos: data.data,
          intent: data.intent?.function,
          executionTime: data.execution_time_ms,
          mode: data.mode,
          export: data.export,
        },
      ]);
    } catch (error: any) {
      setMensajes((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          tipo: 'error',
          mensaje: error.response?.data?.error || error.message || 'Error de conexión.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const limpiarChat = () => {
    setMensajes([
      {
        id: Date.now().toString(),
        tipo: 'asistente',
        mensaje: '¡Chat limpiado! ¿En qué puedo ayudarte?',
        timestamp: new Date(),
      },
    ]);
  };

  const toggleExpand = (id: string) => {
    setExpandedMessages((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const formatExpandedResults = (exp: ExportData) => {
    if (!exp?.data?.rows?.length) return '';
    let r = '\n\n---\n**Todos los resultados:**\n\n';
    exp.data.rows.forEach((row, i) => {
      r += `**${i + 1}.** `;
      const parts: string[] = [];
      row.forEach((cell, ci) => {
        if (cell !== null && cell !== '') parts.push(`${exp.data.headers[ci]}: ${cell}`);
      });
      r += parts.slice(0, 5).join(' | ') + '\n';
    });
    return r;
  };

  const exportarExcel = (exp: ExportData) => {
    if (!exp?.available || !exp?.data?.rows?.length) {
      guroToast.warning('Sin datos', 'No hay datos para exportar');
      return;
    }
    let csv = '\uFEFF' + exp.data.headers.join(';') + '\n';
    exp.data.rows.forEach((row) => {
      csv +=
        row
          .map((c) => {
            const s = String(c ?? '');
            return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = exp.filename.replace('.xlsx', '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sugerencias = [
    '¿Cuántas pólizas tengo activas?',
    'Pólizas próximas a vencer',
    'Resumen del dashboard',
    'Estado de la cartera',
  ];

  const hasMessages = mensajes.length > 0;

  // Panel y overlay van a document.body vía portal para que ocupen toda la ventana
  // sin quedar atrapados por contenedores con overflow/transform del layout.
  const portalContent = createPortal(
    <>
      <style>{`
        @keyframes fa-anti-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fa-anti-pulse {
          0%, 100% { opacity: 0.85; filter: brightness(1); transform: scale(1); }
          50% { opacity: 1; filter: brightness(1.2); transform: scale(1.03); }
        }
        @keyframes fa-anti-flicker {
          0%, 100% { opacity: 0.4; }
          25% { opacity: 0.75; }
          40% { opacity: 0.35; }
          60% { opacity: 0.9; }
        }
        .fa-anti-halo {
          position: absolute;
          inset: -40%;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            #573CFF,
            #7B61FF,
            #A78BFA,
            #fb923c,
            #f97316,
            #573CFF
          );
          animation: fa-anti-spin 5s linear infinite;
          opacity: 0.45;
          filter: blur(10px);
        }
        .fa-anti-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: conic-gradient(
            from 180deg,
            transparent 0deg,
            rgba(87, 60, 255, 0.5) 90deg,
            rgba(251, 146, 60, 0.45) 180deg,
            rgba(167, 139, 250, 0.4) 270deg,
            transparent 360deg
          );
          animation: fa-anti-spin 3.5s linear infinite reverse;
          mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
        }
        .fa-anti-core {
          position: absolute;
          inset: 3px;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.35) 0%, transparent 28%),
            radial-gradient(circle at 50% 55%, rgba(87, 60, 255, 0.55) 0%, rgba(26, 16, 53, 0.95) 48%, #000000 72%);
          box-shadow:
            inset 0 0 14px rgba(167, 139, 250, 0.35),
            inset 0 -6px 16px rgba(251, 146, 60, 0.12),
            0 0 18px rgba(87, 60, 255, 0.45),
            0 0 32px rgba(251, 146, 60, 0.12);
          animation: fa-anti-pulse 2.4s ease-in-out infinite;
        }
        .fa-anti-spark {
          position: absolute;
          inset: 18%;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
          animation: fa-anti-flicker 1.8s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        ref={panelRef}
        className={`floating-assistant-panel fixed top-0 right-0 h-full w-full sm:w-[440px] bg-[#0d0d0e] z-[10000] flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ fontFamily: "'General Sans', sans-serif" }}
      >
        <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-neutral-800/60">
          <div className="flex items-center min-w-0">
            <span className="text-[13px] font-semibold text-white truncate">Octupus</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={limpiarChat}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
              title="Nuevo chat"
            >
              <Icon icon="solar:pen-new-square-linear" width={16} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
              title="Cerrar"
            >
              <Icon icon="solar:close-circle-linear" width={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {!hasMessages && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="mb-4">
                <AntiMatterOrb variant="hero" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Hola, {firstName}</h2>
              <p className="text-neutral-500 text-xs mb-6">¿En qué puedo ayudarte hoy?</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {sugerencias.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputMessage(s);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-xl text-[11px] text-neutral-400 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-200 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="space-y-4 py-4">
              {mensajes.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.tipo === 'usuario' ? 'justify-end' : ''}`}>
                  {msg.tipo !== 'usuario' && (
                    <div className="shrink-0 mt-0.5">
                      {msg.tipo === 'error' ? (
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Icon icon="solar:danger-triangle-bold" width={12} className="text-red-400" />
                        </div>
                      ) : (
                        <AntiMatterOrb variant="avatar" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] ${
                      msg.tipo === 'usuario'
                        ? 'bg-[#1e1e1e] rounded-2xl rounded-br-md px-3 py-2.5'
                        : msg.tipo === 'error'
                          ? 'bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-md px-3 py-2.5'
                          : ''
                    }`}
                  >
                    <div
                      className={`whitespace-pre-line text-[13px] leading-relaxed ${
                        msg.tipo === 'usuario'
                          ? 'text-neutral-200'
                          : msg.tipo === 'error'
                            ? 'text-red-300'
                            : 'text-neutral-300'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          formatMessage(
                            msg.mensaje +
                              (expandedMessages.has(msg.id) && msg.export?.available ? formatExpandedResults(msg.export) : ''),
                          ),
                        ),
                      }}
                    />

                    {msg.export?.available && msg.export.data.total_rows > 10 && (
                      <button
                        onClick={() => toggleExpand(msg.id)}
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <Icon
                          icon={expandedMessages.has(msg.id) ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                          width={11}
                        />
                        {expandedMessages.has(msg.id) ? 'Ver menos' : `Ver todos (${msg.export.data.total_rows})`}
                      </button>
                    )}

                    {msg.tipo !== 'usuario' && (
                      <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-neutral-800/30">
                        {msg.export?.available && (
                          <button
                            onClick={() => exportarExcel(msg.export!)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <Icon icon="solar:file-download-bold" width={11} />
                            Exportar ({msg.export.data.total_rows})
                          </button>
                        )}
                        {msg.mode && msg.mode === 'rules' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            Reglas
                          </span>
                        )}
                        {msg.executionTime && (
                          <span className="text-[9px] text-neutral-600">{msg.executionTime}ms</span>
                        )}
                        <span className="text-[9px] text-neutral-600 ml-auto">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    <AntiMatterOrb variant="avatar" />
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                      <div
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500">Consultando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-neutral-800/70 bg-[#08090b] px-3 pb-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1 rounded-xl border border-[#3f3f46] bg-[#26262e] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-[#573CFF]/50 focus-within:ring-1 focus-within:ring-[#573CFF]/20 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isTyping}
                placeholder="Pregunta lo que quieras..."
                className="w-full !bg-transparent !border-0 outline-none text-[13px] text-neutral-100 placeholder:text-neutral-400 disabled:text-neutral-500 focus:ring-0 py-0.5"
              />
            </div>
            <button
              onClick={enviarMensaje}
              disabled={!inputMessage.trim() || isTyping}
              className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                inputMessage.trim() && !isTyping
                  ? 'bg-[#573CFF] text-white hover:bg-[#6b4fff] active:scale-90'
                  : 'bg-[#26262e] border border-[#3f3f46] text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isTyping ? (
                <Icon icon="solar:stop-bold" width={13} />
              ) : (
                <Icon icon="solar:arrow-up-bold" width={14} />
              )}
            </button>
          </div>
          <p className="text-center text-[9px] text-neutral-700 mt-1.5">
            Octupus puede cometer errores. Verifica la información importante.
          </p>
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <>
      {/* Botón trigger: inline, para que quede dentro del topbar donde lo monta el Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-transform hover:scale-110 active:scale-95 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#573CFF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0d0d0e] rounded-full flex items-center justify-center"
        title="Octupus"
        aria-label="Abrir Octupus"
      >
        <AntiMatterOrb variant={variant} />
      </button>
      {portalContent}
    </>
  );
};

export default FloatingAssistant;

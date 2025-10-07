import { useState, useRef, useEffect } from 'react';
import { Button, Card, TextInput, Badge, Avatar, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';

export interface MensajeType {
  id: string;
  tipo: 'usuario' | 'asistente';
  mensaje: string;
  timestamp: Date;
  acciones?: AccionType[];
  datos?: any;
}

export interface AccionType {
  tipo: 'buscar_poliza' | 'crear_siniestro' | 'ver_cliente' | 'calcular_prima' | 'generar_reporte';
  label: string;
  datos: any;
}

const AsistenteDeepSeek = () => {
  const [mensajes, setMensajes] = useState<MensajeType[]>([
    {
      id: '1',
      tipo: 'asistente',
      mensaje: '¡Hola! Soy Guro AI, tu asistente inteligente especializado en seguros, potenciado por tecnología avanzada de inteligencia artificial. Ofrezco análisis más profundos y respuestas más precisas gracias a mi avanzada capacidad de procesamiento. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedScript, setEmbedScript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  // Función para llamar a la API de IA
  const llamarAPIIA = async (mensaje: string): Promise<{ respuesta: string; acciones?: AccionType[] }> => {
    try {
      const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
      
      if (!apiKey) {
        return {
          respuesta: 'Error: API key de IA no configurada. Por favor, configura VITE_DEEPSEEK_API_KEY en tu archivo .env.local'
        };
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Eres Guro AI, un asistente inteligente especializado en seguros. Tienes acceso a análisis avanzados y capacidades predictivas. Responde de forma profesional y enfocada en el sector de seguros.'
            },
            {
              role: 'user',
              content: mensaje
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Error de API: ${response.status}`);
      }

      const data = await response.json();
      const respuestaAPI = data.choices[0]?.message?.content || 'No se pudo obtener respuesta del asistente IA';
      
      return {
        respuesta: respuestaAPI,
        acciones: generarAccionesContextuales(mensaje)
      };
    } catch (error) {
      return {
        respuesta: 'Error al conectar con el asistente IA. Usando respuesta local como respaldo.',
        ...generarRespuestaDeepSeekLocal(mensaje)
      };
    }
  };

  // Función para generar acciones contextuales basadas en el mensaje
  const generarAccionesContextuales = (mensaje: string): AccionType[] => {
    const mensajeLower = mensaje.toLowerCase();
    const acciones: AccionType[] = [];

    if (mensajeLower.includes('poliza') || mensajeLower.includes('póliza')) {
      acciones.push({
        tipo: 'buscar_poliza',
        label: 'Buscar Pólizas',
        datos: { filtro: 'general' }
      });
    }

    if (mensajeLower.includes('siniestro')) {
      acciones.push({
        tipo: 'crear_siniestro',
        label: 'Gestionar Siniestros',
        datos: {}
      });
    }

    if (mensajeLower.includes('cliente')) {
      acciones.push({
        tipo: 'ver_cliente',
        label: 'Buscar Cliente',
        datos: {}
      });
    }

    if (mensajeLower.includes('reporte') || mensajeLower.includes('análisis')) {
      acciones.push({
        tipo: 'generar_reporte',
        label: 'Generar Reporte',
        datos: { tipo: 'general' }
      });
    }

    return acciones;
  };

  // Simulador de respuestas específicas de IA (fallback)
  const generarRespuestaDeepSeekLocal = (mensaje: string): { respuesta: string; acciones?: AccionType[] } => {
    const mensajeLower = mensaje.toLowerCase();
    
    if (mensajeLower.includes('ia') || mensajeLower.includes('inteligencia') || mensajeLower.includes('diferencia')) {
      return {
        respuesta: 'Como Guro AI, ofrezco capacidades avanzadas de procesamiento y análisis. Mis principales ventajas incluyen:\\n\\n• 🎯 Análisis más profundo de patrones en datos de seguros\\n• 📊 Predicciones más precisas basadas en machine learning\\n• 🔍 Procesamiento de documentos con mayor precisión\\n• 💡 Recomendaciones contextuales inteligentes\\n• 🚀 Respuestas más rápidas y eficientes\\n\\n¿Te gustaría probar alguna de estas capacidades avanzadas?'
      };
    }
    
    if (mensajeLower.includes('análisis') || mensajeLower.includes('analizar')) {
      return {
        respuesta: 'Con Guro AI puedo realizar análisis avanzados de tus datos de seguros. Puedo analizar:\\n\\n• 📈 Tendencias de siniestralidad\\n• 💰 Patrones de rentabilidad por cliente\\n• 🔄 Predicciones de renovación\\n• 📊 Análisis de riesgo personalizado\\n• 🎯 Optimización de tarifas\\n\\nSelecciona el tipo de análisis que necesitas.',
        acciones: [
          {
            tipo: 'generar_reporte',
            label: 'Análisis de Siniestralidad',
            datos: { tipo: 'siniestralidad' }
          },
          {
            tipo: 'generar_reporte',
            label: 'Análisis de Rentabilidad',
            datos: { tipo: 'rentabilidad' }
          }
        ]
      };
    }
    
    if (mensajeLower.includes('predicción') || mensajeLower.includes('predecir')) {
      return {
        respuesta: 'Mis capacidades predictivas con IA incluyen:\\n\\n• 🔮 Probabilidad de renovación de pólizas\\n• ⚠️ Riesgo de siniestro por cliente\\n• 📉 Tendencias de cancelación\\n• 💸 Proyección de primas futuras\\n• 🎯 Identificación de leads potenciales\\n\\n¿Qué tipo de predicción necesitas?',
        acciones: [
          {
            tipo: 'generar_reporte',
            label: 'Predicción de Renovaciones',
            datos: { tipo: 'renovaciones' }
          },
          {
            tipo: 'generar_reporte',
            label: 'Análisis de Riesgo',
            datos: { tipo: 'riesgo' }
          }
        ]
      };
    }
    
    if (mensajeLower.includes('documento') || mensajeLower.includes('pdf')) {
      return {
        respuesta: 'Con Guro AI puedo procesar documentos de seguros con alta precisión:\\n\\n• 📄 Extracción de datos de pólizas\\n• 📋 Análisis de condiciones\\n• 🔍 Verificación de documentos\\n• 📊 Comparación de coberturas\\n• 🎯 Detección de inconsistencias\\n\\n¿Qué documento necesitas procesar?',
        acciones: [
          {
            tipo: 'ver_cliente',
            label: 'Procesar Documento',
            datos: { tipo: 'documento' }
          }
        ]
      };
    }
    
    if (mensajeLower.includes('optimizar') || mensajeLower.includes('mejorar')) {
      return {
        respuesta: 'Te puedo ayudar a optimizar diferentes aspectos de tu negocio de seguros:\\n\\n• 💰 Tarifas y precios\\n• 📈 Procesos de venta\\n• 🎯 Estrategias de marketing\\n• 📊 Gestión de cartera\\n• ⚡ Eficiencia operativa\\n\\n¿Qué área te gustaría optimizar?',
        acciones: [
          {
            tipo: 'calcular_prima',
            label: 'Optimizar Tarifas',
            datos: { tipo: 'tarifas' }
          },
          {
            tipo: 'generar_reporte',
            label: 'Análisis de Procesos',
            datos: { tipo: 'procesos' }
          }
        ]
      };
    }
    
    // Respuestas generales mejoradas con IA
    if (mensajeLower.includes('poliza') || mensajeLower.includes('póliza')) {
      return {
        respuesta: 'Con Guro AI puedo ofrecerte un análisis inteligente de pólizas. Actualmente tienes 2,847 pólizas activas. He detectado patrones interesantes en tu cartera:\\n\\n• 📊 15% muestran alta probabilidad de renovación\\n• ⚠️ 23 requieren atención inmediata\\n• 💡 87 son candidatas para ventas cruzadas\\n\\n¿Qué acción específica necesitas?',
        acciones: [
          {
            tipo: 'buscar_poliza',
            label: 'Pólizas de Alta Prioridad',
            datos: { filtro: 'alta_prioridad' }
          },
          {
            tipo: 'generar_reporte',
            label: 'Análisis Inteligente de Cartera',
            datos: { tipo: 'cartera_inteligente' }
          }
        ]
      };
    }
    
    // Respuesta por defecto mejorada
    return {
      respuesta: 'Como tu asistente Guro AI, puedo ayudarte con análisis avanzados, predicciones inteligentes y optimización de procesos. Mi procesamiento mejorado me permite ofrecer insights más profundos sobre tu negocio de seguros. ¿En qué área específica te gustaría que aplique mis capacidades avanzadas?'
    };
  };

  const enviarMensaje = async () => {
    if (!inputMessage.trim()) return;

    const nuevoMensajeUsuario: MensajeType = {
      id: Date.now().toString(),
      tipo: 'usuario',
      mensaje: inputMessage,
      timestamp: new Date(),
    };

    const mensajeParaAPI = inputMessage;
    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Llamada real a la API de IA
      const { respuesta, acciones } = await llamarAPIIA(mensajeParaAPI);
      
      const respuestaAsistente: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: 'asistente',
        mensaje: respuesta,
        timestamp: new Date(),
        acciones: acciones,
      };

      setMensajes(prev => [...prev, respuestaAsistente]);
    } catch (error) {
      const respuestaError: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: 'asistente',
        mensaje: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.',
        timestamp: new Date(),
      };
      setMensajes(prev => [...prev, respuestaError]);
    } finally {
      setIsTyping(false);
    }
  };

  const iniciarReconocimientoVoz = () => {
    setIsListening(!isListening);
  };

  // Función para generar script de embebido
  const generarEmbedScript = () => {
    const script = `<!-- Guro AI Assistant Widget -->
<div id="guro-ai-widget"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/embed/guro-ai-widget.js';
    script.async = true;
    script.onload = function() {
      GuroAI.init({
        containerId: 'guro-ai-widget',
        apiEndpoint: '${window.location.origin}/api/chat',
        theme: 'auto',
        position: 'bottom-right',
        title: 'Guro AI - Asistente de Seguros',
        subtitle: 'Powered by AI',
        primaryColor: '#7c3aed',
        width: '400px',
        height: '600px'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;
    
    setEmbedScript(script);
    setShowEmbedModal(true);
  };

  // Función para copiar script al portapapeles
  const copiarScript = async () => {
    try {
      await navigator.clipboard.writeText(embedScript);
      // Podrías mostrar una notificación de éxito aquí
    } catch (err) {
    }
  };

  const ejecutarAccion = (accion: AccionType) => {
    const mensajeAccion: MensajeType = {
      id: Date.now().toString(),
      tipo: 'asistente',
      mensaje: `Ejecutando análisis IA: ${accion.label}. Procesando con algoritmos avanzados...`,
      timestamp: new Date(),
    };
    
    setMensajes(prev => [...prev, mensajeAccion]);
  };

  const sugerenciasIA = [
    "Analiza las tendencias de mi cartera de seguros",
    "Predice las renovaciones del próximo mes",
    "Optimiza mis tarifas actuales",
    "Procesa documentos de pólizas con IA",
    "Genera insights avanzados de siniestralidad"
  ];

  return (
    <div>
      
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Header */}
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Icon icon="solar:cpu-bolt-bold" className="text-white" width={24} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark dark:text-white">Chatbot</h3>
                <p className="text-sm text-gray-500">Guro AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="purple" className="capitalize">
                AI Active
              </Badge>
              <Button size="xs" color="light" onClick={generarEmbedScript}>
                <Icon icon="solar:code-bold" width={16} />
              </Button>
              <Button size="xs" color="light">
                <Icon icon="solar:settings-bold" width={16} />
              </Button>
            </div>
          </div>
        </Card>

        {/* Chat Messages */}
        <Card className="flex-1 p-4 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {mensajes.map((mensaje) => (
                <div
                  key={mensaje.id}
                  className={`flex ${mensaje.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-3xl ${mensaje.tipo === 'usuario' ? 'order-2' : ''}`}>
                    <div
                      className={`p-3 rounded-lg ${
                        mensaje.tipo === 'usuario'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white ml-auto'
                          : 'bg-gray-100 dark:bg-gray-700 text-dark dark:text-white'
                      }`}
                    >
                      <p className="whitespace-pre-line">{mensaje.mensaje}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {mensaje.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    
                    {/* Acciones sugeridas */}
                    {mensaje.acciones && mensaje.acciones.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {mensaje.acciones.map((accion, index) => (
                          <Button
                            key={index}
                            size="xs"
                            color="light"
                            onClick={() => ejecutarAccion(accion)}
                            className="mr-2"
                          >
                            <Icon icon="solar:play-bold" className="mr-1" width={12} />
                            {accion.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {mensaje.tipo === 'asistente' && (
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                      <Icon icon="solar:cpu-bolt-bold" className="text-white" width={16} />
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                    <Icon icon="solar:cpu-bolt-bold" className="text-white" width={16} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias DeepSeek */}
            {mensajes.length === 1 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Prueba las capacidades avanzadas de Guro AI:</p>
                <div className="flex flex-wrap gap-2">
                  {sugerenciasIA.map((sugerencia, index) => (
                    <Button
                      key={index}
                      size="xs"
                      color="light"
                      onClick={() => setInputMessage(sugerencia)}
                      className="border-purple-200 hover:border-purple-400"
                    >
                      {sugerencia}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <TextInput
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Pregunta a Guro AI sobre análisis avanzados..."
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                  disabled={isTyping}
                />
              </div>
              <Button
                color="light"
                onClick={iniciarReconocimientoVoz}
                disabled={isTyping}
                className={isListening ? 'bg-red-100 text-red-600' : ''}
              >
                <Icon 
                  icon={isListening ? "solar:microphone-bold" : "solar:microphone-outline"} 
                  width={20} 
                />
              </Button>
              <Button
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={enviarMensaje}
                disabled={!inputMessage.trim() || isTyping}
              >
                <Icon icon="solar:arrow-right-bold" width={20} />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal para generar script embed */}
      <Modal show={showEmbedModal} onClose={() => setShowEmbedModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:code-bold" width={20} />
            Generar Script de Embebido
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Embed Guro AI en tu sitio web</h3>
              <p className="text-gray-600 mb-4">
                Copia y pega el siguiente script en tu página web para integrar el asistente Guro AI.
              </p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <div className="absolute top-2 right-2">
                <Button size="xs" color="light" onClick={copiarScript}>
                  <Icon icon="solar:copy-bold" width={16} className="mr-1" />
                  Copiar
                </Button>
              </div>
              <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap">
                <code>{embedScript}</code>
              </pre>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Características del widget:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Interfaz responsive y adaptable</li>
                <li>• Soporte para modo oscuro/claro</li>
                <li>• Posicionamiento personalizable</li>
                <li>• Colores y branding configurables</li>
                <li>• Análisis inteligente de seguros</li>
              </ul>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowEmbedModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AsistenteDeepSeek;

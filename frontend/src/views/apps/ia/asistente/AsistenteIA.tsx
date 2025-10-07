import { useState, useRef, useEffect } from 'react';
import { Button, Card, TextInput, Badge, Avatar } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/ia",
    title: "Inteligencia Artificial",
  },
  {
    title: "Asistente IA",
  },
];

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

const AsistenteIA = () => {
  const [mensajes, setMensajes] = useState<MensajeType[]>([
    {
      id: '1',
      tipo: 'asistente',
      mensaje: '¡Hola! Soy Guro IA, tu asistente inteligente especializado en seguros. Puedo ayudarte con consultas sobre pólizas, siniestros, clientes, cálculos de primas y mucho más. ¿En qué puedo asistirte hoy?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  // Simulador de respuestas inteligentes
  const generarRespuesta = (mensaje: string): { respuesta: string; acciones?: AccionType[] } => {
    const mensajeLower = mensaje.toLowerCase();
    
    if (mensajeLower.includes('poliza') || mensajeLower.includes('póliza')) {
      if (mensajeLower.includes('buscar') || mensajeLower.includes('encontrar')) {
        return {
          respuesta: 'He encontrado las pólizas relacionadas con tu consulta. Te muestro las más relevantes:',
          acciones: [
            {
              tipo: 'buscar_poliza',
              label: 'Ver Póliza POL-2024-001',
              datos: { numero: 'POL-2024-001', cliente: 'María González' }
            },
            {
              tipo: 'buscar_poliza',
              label: 'Ver Póliza POL-2024-003',
              datos: { numero: 'POL-2024-003', cliente: 'Ana Rodríguez' }
            }
          ]
        };
      }
      if (mensajeLower.includes('vence') || mensajeLower.includes('renovar')) {
        return {
          respuesta: 'Tienes 3 pólizas próximas a vencer en los próximos 30 días. ¿Te gustaría ver el detalle o iniciar el proceso de renovación?',
          acciones: [
            {
              tipo: 'buscar_poliza',
              label: 'Ver Renovaciones Pendientes',
              datos: { filtro: 'renovaciones' }
            }
          ]
        };
      }
      return {
        respuesta: 'Puedo ayudarte con información sobre pólizas. Actualmente tienes 2,847 pólizas activas en el sistema. ¿Necesitas buscar una póliza específica, verificar renovaciones o crear una nueva?'
      };
    }
    
    if (mensajeLower.includes('siniestro')) {
      if (mensajeLower.includes('crear') || mensajeLower.includes('reportar')) {
        return {
          respuesta: 'Te ayudo a crear un nuevo siniestro. ¿Tienes el número de póliza afectada?',
          acciones: [
            {
              tipo: 'crear_siniestro',
              label: 'Crear Nuevo Siniestro',
              datos: {}
            }
          ]
        };
      }
      return {
        respuesta: 'Actualmente tienes 73 siniestros pendientes de gestión. 12 están en investigación y 8 requieren documentos adicionales. ¿Quieres ver algún siniestro específico?',
        acciones: [
          {
            tipo: 'crear_siniestro',
            label: 'Ver Siniestros Pendientes',
            datos: { filtro: 'pendientes' }
          }
        ]
      };
    }
    
    if (mensajeLower.includes('cliente')) {
      return {
        respuesta: 'Tienes 1,245 clientes activos. Puedo ayudarte a buscar información de un cliente específico, ver su historial de pólizas o gestionar su información.',
        acciones: [
          {
            tipo: 'ver_cliente',
            label: 'Buscar Cliente',
            datos: {}
          }
        ]
      };
    }
    
    if (mensajeLower.includes('prima') || mensajeLower.includes('calcular') || mensajeLower.includes('cotizar')) {
      return {
        respuesta: 'Puedo calcular primas para diferentes tipos de seguros. ¿Qué tipo de seguro necesitas cotizar? (Automóvil, Vida, Hogar, Salud, Empresarial)',
        acciones: [
          {
            tipo: 'calcular_prima',
            label: 'Calculadora de Primas',
            datos: {}
          }
        ]
      };
    }
    
    if (mensajeLower.includes('reporte') || mensajeLower.includes('estadisticas') || mensajeLower.includes('análisis')) {
      return {
        respuesta: 'Puedo generar varios tipos de reportes: financieros, de ventas, siniestralidad, renovaciones. ¿Qué tipo de reporte necesitas?',
        acciones: [
          {
            tipo: 'generar_reporte',
            label: 'Generar Reporte',
            datos: {}
          }
        ]
      };
    }
    
    if (mensajeLower.includes('hola') || mensajeLower.includes('ayuda')) {
      return {
        respuesta: '¡Hola! Puedo ayudarte con:\n\n• Consultas sobre pólizas y renovaciones\n• Gestión de siniestros\n• Información de clientes\n• Cálculo de primas\n• Generación de reportes\n• Análisis de datos\n\n¿Qué necesitas hacer?'
      };
    }
    
    // Respuesta por defecto
    return {
      respuesta: 'Entiendo tu consulta. Como asistente especializado en seguros, puedo ayudarte con pólizas, siniestros, clientes, cálculos y reportes. ¿Podrías ser más específico sobre lo que necesitas?'
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

    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInputMessage('');
    setIsTyping(true);

    // Simular delay de procesamiento
    setTimeout(() => {
      const { respuesta, acciones } = generarRespuesta(inputMessage);
      
      const respuestaAsistente: MensajeType = {
        id: (Date.now() + 1).toString(),
        tipo: 'asistente',
        mensaje: respuesta,
        timestamp: new Date(),
        acciones: acciones,
      };

      setMensajes(prev => [...prev, respuestaAsistente]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const iniciarReconocimientoVoz = () => {
    setIsListening(!isListening);
    // Aquí iría la implementación real del reconocimiento de voz
  };

  const ejecutarAccion = (accion: AccionType) => {
    // Aquí se ejecutarían las acciones reales
    const mensajeAccion: MensajeType = {
      id: Date.now().toString(),
      tipo: 'asistente',
      mensaje: `Ejecutando acción: ${accion.label}. En una implementación real, esto abriría la página correspondiente o ejecutaría la función solicitada.`,
      timestamp: new Date(),
    };
    
    setMensajes(prev => [...prev, mensajeAccion]);
  };

  const sugerencias = [
    "¿Cuántas pólizas tengo próximas a vencer?",
    "Buscar póliza de María González",
    "Crear un nuevo siniestro",
    "Calcular prima para seguro de auto",
    "Generar reporte de ventas del mes"
  ];

  return (
    <>
      <BreadcrumbComp title="Asistente IA" items={BCrumb} />
      
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Header */}
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <Icon icon="solar:cpu-bolt-bold" className="text-white" width={24} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark dark:text-white">Guro IA</h3>
                <p className="text-sm text-gray-500">Asistente Inteligente de Seguros</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="success" className="capitalize">
                En línea
              </Badge>
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
                          ? 'bg-primary text-white ml-auto'
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
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                      <Icon icon="solar:cpu-bolt-bold" className="text-white" width={16} />
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                    <Icon icon="solar:cpu-bolt-bold" className="text-white" width={16} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias rápidas */}
            {mensajes.length === 1 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Prueba estas consultas:</p>
                <div className="flex flex-wrap gap-2">
                  {sugerencias.map((sugerencia, index) => (
                    <Button
                      key={index}
                      size="xs"
                      color="light"
                      onClick={() => setInputMessage(sugerencia)}
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
                  placeholder="Escribe tu consulta o pregunta..."
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
                color="primary"
                onClick={enviarMensaje}
                disabled={!inputMessage.trim() || isTyping}
              >
                <Icon icon="solar:arrow-right-bold" width={20} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

export default AsistenteIA; 
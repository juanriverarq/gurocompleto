import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useAIAssistant } from '../../hooks/useAIAssistant';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({ isOpen, onClose }) => {
  const [chatHistory, setChatHistory] = useState<Array<{id: string, question: string, response: string, timestamp: Date}>>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Hook de AI Assistant (DeepSeek + OpenAI TTS)
  const { 
    isListening, 
    isProcessing, 
    isSpeaking, 
    error, 
    lastResponse,
    transcript,
    startListening,
    stopListening,
    askQuestion, 
    speakText, 
    testVoice, 
    clearError,
    clearConversation
  } = useAIAssistant();

  // Efecto para agregar respuestas al historial cuando se completan
  useEffect(() => {
    if (lastResponse && transcript && transcript.includes('Dijiste:')) {
      const question = transcript.replace('Dijiste: "', '').replace('"', '');
      const newEntry = {
        id: Date.now().toString(),
        question: question,
        response: lastResponse,
        timestamp: new Date()
      };
      
      setChatHistory(prev => [newEntry, ...prev]);
    }
  }, [lastResponse, transcript]);

  // Animación del canvas futurista
  useEffect(() => {
    if (!isOpen || !canvasRef.current || isMinimized) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 400;
    canvas.height = 400;
    
    let time = 0;
    const nebulaParticles: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      angle: number;
      opacity: number;
      baseX: number;
      baseY: number;
      pulsePhase: number;
      color: { r: number; g: number; b: number };
    }> = [];
    
    const sparkParticles: Array<{
      x: number;
      y: number;
      size: number;
      life: number;
      maxLife: number;
      velocity: { x: number; y: number };
      opacity: number;
    }> = [];
    
    // Crear partículas de nebulosa (núcleo principal)
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 120 + 20;
      const baseX = canvas.width / 2 + Math.cos(angle) * distance;
      const baseY = canvas.height / 2 + Math.sin(angle) * distance;
      
      nebulaParticles.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: Math.random() * 6 + 2,
        speed: Math.random() * 0.5 + 0.2,
        angle: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.4 + 0.1,
        pulsePhase: Math.random() * Math.PI * 2,
        color: {
          r: Math.random() * 50 + 59, // Azul base
          g: Math.random() * 50 + 130,
          b: Math.random() * 50 + 246
        }
      });
    }
    
    // Crear partículas de chispas (efectos dinámicos)
    const createSpark = () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 60 + 40;
      sparkParticles.push({
        x: canvas.width / 2 + Math.cos(angle) * distance,
        y: canvas.height / 2 + Math.sin(angle) * distance,
        size: Math.random() * 3 + 1,
        life: 0,
        maxLife: Math.random() * 60 + 30,
        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2
        },
        opacity: Math.random() * 0.8 + 0.2
      });
    };
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += isProcessing ? 0.02 : isListening ? 0.008 : isSpeaking ? 0.012 : 0.005;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Crear chispas dinámicas según el estado (menos frecuentes)
      if (isProcessing && Math.random() < 0.15) {
        createSpark();
      } else if (isListening && Math.random() < 0.05) {
        createSpark();
      } else if (isSpeaking && Math.random() < 0.08) {
        createSpark();
      }
      
      // Nebulosa de fondo con respiración suave
      const breathe = Math.sin(time * 0.8) * 0.1 + 0.9; // Efecto respiración lenta
      const nebulaRadius = (isProcessing ? 180 : isListening ? 150 : isSpeaking ? 160 : 120) * breathe;
      const nebulaGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, nebulaRadius);

      // Intensidad de colores más suave y comprensible
      const intensity = isProcessing ? 0.6 : isListening ? 0.4 : isSpeaking ? 0.5 : 0.3;

      if (isProcessing) {
        nebulaGradient.addColorStop(0, `rgba(147, 51, 234, ${0.5 * intensity})`);
        nebulaGradient.addColorStop(0.3, `rgba(59, 130, 246, ${0.4 * intensity})`);
        nebulaGradient.addColorStop(0.6, `rgba(34, 197, 94, ${0.3 * intensity})`);
        nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        nebulaGradient.addColorStop(0, `rgba(239, 68, 68, ${0.4 * intensity})`);
        nebulaGradient.addColorStop(0.4, `rgba(59, 130, 246, ${0.3 * intensity})`);
        nebulaGradient.addColorStop(0.8, `rgba(147, 51, 234, ${0.2 * intensity})`);
        nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        nebulaGradient.addColorStop(0, `rgba(147, 51, 234, ${0.5 * intensity})`);
        nebulaGradient.addColorStop(0.4, `rgba(168, 85, 247, ${0.4 * intensity})`);
        nebulaGradient.addColorStop(0.8, `rgba(139, 92, 246, ${0.3 * intensity})`);
        nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        nebulaGradient.addColorStop(0, `rgba(99, 102, 241, ${0.4 * intensity})`);
        nebulaGradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.3 * intensity})`);
        nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      
      ctx.fillStyle = nebulaGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Actualizar y dibujar partículas de nebulosa
      nebulaParticles.forEach((particle) => {
        // Movimiento orbital más lento y suave
        const orbitSpeed = isProcessing ? 0.01 : isListening ? 0.004 : isSpeaking ? 0.007 : 0.002;
        particle.angle += orbitSpeed;

        // Pulsación más lenta y visible
        const pulseSpeed = isProcessing ? 0.05 : isListening ? 0.025 : isSpeaking ? 0.035 : 0.015;
        particle.pulsePhase += pulseSpeed;
        const pulse = Math.sin(particle.pulsePhase) * 0.6 + 0.4; // Más contraste en la pulsación

        // Movimiento orbital más pronunciado
        const orbitRadius = isProcessing ? 50 : isListening ? 25 : isSpeaking ? 35 : 12;
        const orbitIntensity = isProcessing ? 1.2 : isListening ? 0.8 : isSpeaking ? 1.0 : 0.5;
        particle.x = particle.baseX + Math.cos(particle.angle) * orbitRadius * pulse * orbitIntensity;
        particle.y = particle.baseY + Math.sin(particle.angle) * orbitRadius * pulse * orbitIntensity;

        // Tamaño dinámico más suave
        const dynamicSize = particle.size * (0.6 + pulse * 0.4);

        // Opacidad más suave y comprensible
        const stateOpacity = isProcessing ? 0.9 : isListening ? 0.7 : isSpeaking ? 0.8 : 0.5;
        const finalOpacity = particle.opacity * stateOpacity * (0.7 + pulse * 0.3);

        // Dibujar partícula con efecto de brillo
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const particleGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, dynamicSize * 2
        );

        const { r, g, b } = particle.color;
        particleGradient.addColorStop(0, `rgba(${r + 50}, ${g + 50}, ${b + 50}, ${finalOpacity})`);
        particleGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${finalOpacity * 0.6})`);
        particleGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, dynamicSize * 2, 0, Math.PI * 2);
        ctx.fillStyle = particleGradient;
        ctx.fill();
        ctx.restore();
      });

      // Actualizar y dibujar chispas
      for (let i = sparkParticles.length - 1; i >= 0; i--) {
        const spark = sparkParticles[i];
        spark.life++;
        spark.x += spark.velocity.x;
        spark.y += spark.velocity.y;

        const lifeRatio = spark.life / spark.maxLife;
        const sparkOpacity = spark.opacity * (1 - lifeRatio);

        if (sparkOpacity <= 0 || spark.life >= spark.maxLife) {
          sparkParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * (1 - lifeRatio * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkOpacity})`;
        ctx.fill();
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, isListening, isProcessing, isSpeaking, isMinimized]);

  // Función para repetir una respuesta del historial
  const handleRepeatResponse = async (response: string) => {
    try {
      await speakText(response);
    } catch (error) {
    }
  };

  // Función para limpiar errores
  const handleClearError = () => {
    clearError();
  };

  // Función para hacer una pregunta de las sugerencias
  const handleSuggestionClick = async (suggestion: string) => {
    try {
      await askQuestion(suggestion);
    } catch (error) {
    }
  };

  // Función para limpiar todo el historial
  const handleClearHistory = () => {
    setChatHistory([]);
    clearConversation();
  };

  // Función para minimizar/maximizar
  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) return null;

  // Modo minimizado - Chat compacto abajo a la derecha
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-80 border border-gray-200 dark:border-gray-700">
          {/* Header minimizado */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Icon icon="solar:cpu-bolt-bold" className="text-white" width="16" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Guro AI</h3>
                <div className="flex items-center gap-1">
                  {isSpeaking && <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>}
                  {isListening && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                  {isProcessing && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isSpeaking ? 'Hablando...' : isListening ? 'Escuchando...' : isProcessing ? 'Procesando...' : 'Activo'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleMinimize}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Expandir"
              >
                <Icon icon="solar:maximize-bold" width="16" className="text-gray-500" />
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Cerrar"
              >
                <Icon icon="solar:close-circle-bold" width="16" className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Controles compactos */}
          <div className="p-4">
            {/* Error compacto */}
            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-red-800 dark:text-red-200">{error}</span>
                  <button onClick={handleClearError} className="text-red-600">
                    <Icon icon="solar:close-circle-bold" width="12" />
                  </button>
                </div>
              </div>
            )}

            {/* Transcripción compacta */}
            {transcript && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
                <p className="text-blue-800 dark:text-blue-200 text-xs">{transcript}</p>
              </div>
            )}

            {/* Botón de voz principal */}
            <div className="flex justify-center mb-3">
              {!isListening ? (
                <button
                  onClick={startListening}
                  disabled={isProcessing || isSpeaking}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 text-sm"
                >
                  <Icon icon="solar:microphone-bold" width="16" />
                  Hablar
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200 transform hover:scale-105 shadow-lg animate-pulse text-sm"
                >
                  <Icon icon="solar:stop-bold" width="16" />
                  Detener
                </button>
              )}
            </div>

            {/* Última respuesta */}
            {lastResponse && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:cpu-bolt-bold" className="text-purple-600 mt-1" width="14" />
                  <div className="flex-1">
                    <p className="text-purple-800 dark:text-purple-200 text-xs leading-relaxed">{lastResponse}</p>
                    <button
                      onClick={() => handleRepeatResponse(lastResponse)}
                      disabled={isSpeaking || isProcessing}
                      className="mt-2 text-purple-600 hover:text-purple-800 disabled:opacity-50 text-xs flex items-center gap-1"
                    >
                      <Icon icon="solar:volume-loud-bold" width="12" />
                      Repetir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Controles adicionales */}
            <div className="flex justify-center gap-2 mt-3">
              <button
                onClick={testVoice}
                disabled={isSpeaking || isProcessing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                title="Probar voz"
              >
                <Icon icon="solar:volume-loud-bold" width="14" className="text-gray-500" />
              </button>
              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  disabled={isSpeaking || isProcessing}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  title="Limpiar historial"
                >
                  <Icon icon="solar:trash-bin-2-bold" width="14" className="text-gray-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo expandido - Modal completo
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Guro AI</h2>
              <p className="text-gray-600 dark:text-gray-400">DeepSeek + OpenAI TTS</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400">Capacidades visuales activas</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={testVoice}
                disabled={isSpeaking || isProcessing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Probar voz"
              >
                <Icon icon="solar:volume-loud-bold" width="20" className="text-gray-500" />
              </button>
              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  disabled={isSpeaking || isProcessing}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Limpiar historial y contexto"
                >
                  <Icon icon="solar:trash-bin-2-bold" width="20" className="text-gray-500" />
                </button>
              )}
              <button
                onClick={handleToggleMinimize}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Minimizar"
              >
                <Icon icon="solar:minimize-bold" width="20" className="text-gray-500" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold" width="24" className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Estado del asistente */}
          <div className="flex justify-center mb-4">
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-white">
                {isSpeaking && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                    <span className="text-purple-600 dark:text-purple-400">Hablando...</span>
                  </div>
                )}
                {isListening && !isSpeaking && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-600 dark:text-red-400">Escuchando...</span>
                  </div>
                )}
                {isProcessing && !isSpeaking && !isListening && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 dark:text-green-400">Procesando con DeepSeek...</span>
                  </div>
                )}
                {!isProcessing && !isSpeaking && !isListening && (
                  <div className="text-blue-600 dark:text-blue-400">
                    Listo para responder con IA
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Canvas de animación */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="w-80 h-80 rounded-full"
                style={{ filter: 'blur(0.3px)' }}
              />
            </div>
          </div>

          {/* Controles de voz */}
          <div className="flex justify-center gap-4 mb-6">
            {!isListening ? (
              <button
                onClick={startListening}
                disabled={isProcessing || isSpeaking}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon icon="solar:microphone-bold" width="20" />
                Hablar con Guro AI
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200 transform hover:scale-105 shadow-lg animate-pulse"
              >
                <Icon icon="solar:stop-bold" width="20" />
                Detener
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:danger-bold" className="text-red-600" width="16" />
                  <span className="text-red-800 dark:text-red-200 text-sm">{error}</span>
                </div>
                <button
                  onClick={handleClearError}
                  className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                >
                  <Icon icon="solar:close-circle-bold" width="16" />
                </button>
              </div>
            </div>
          )}

          {/* Transcripción actual */}
          {transcript && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200 text-sm">{transcript}</p>
            </div>
          )}

          {/* Historial de chat */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {chatHistory.map((entry) => (
              <div key={entry.id} className="space-y-2">
                {/* Pregunta del usuario */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:user-bold" className="text-blue-600 mt-1" width="20" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Tú:</p>
                      <p className="text-blue-800 dark:text-blue-200">{entry.question}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {entry.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Respuesta de Guro AI */}
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:cpu-bolt-bold" className="text-purple-600 mt-1" width="20" />
                    <div className="flex-1">
                      <p className="font-medium text-purple-900 dark:text-purple-100 mb-1">Guro AI:</p>
                      <p className="text-purple-800 dark:text-purple-200">{entry.response}</p>
                    </div>
                    <button
                      onClick={() => handleRepeatResponse(entry.response)}
                      disabled={isSpeaking || isProcessing}
                      className="p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Repetir respuesta con voz Nova colombiana"
                    >
                      <Icon icon="solar:volume-loud-bold" width="16" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sugerencias */}
          {chatHistory.length === 0 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preguntas sugeridas:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "¿Qué veo en pantalla?",
                  "Ve a dashboard",
                  "¿Qué puedo hacer aquí?",
                  "Abre clientes",
                  "Haz clic en configuración",
                  "¿Qué tipos de seguros manejan?"
                ].map((suggestion, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-white dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantModal; 
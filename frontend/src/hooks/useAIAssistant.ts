import { useState, useCallback, useRef, useEffect } from 'react';
import { DEEPSEEK_CONFIG, TTS_CONFIG, processTextForTTS, validateAudioConfig, RETRY_CONFIG } from '../config/ttsConfig';
import { useDOMAnalyzer } from './useDOMAnalyzer';
import { useSmartActions } from './useSmartActions';
import { useIntentAnalyzer } from './useIntentAnalyzer';

// Declaraciones de tipos para Speech Recognition API
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  const SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIAssistantState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  error: string | null;
  lastResponse: string | null;
  transcript: string;
  hasVisionCapabilities: boolean;
}

// Prompt del sistema profesional para seguros
const PROFESSIONAL_SYSTEM_PROMPT = `Eres Guro AI, un asistente virtual profesional especializado en seguros.

CAPACIDADES PRINCIPALES:
1. NAVEGACIÓN INTELIGENTE: Puedes navegar automáticamente a cualquier página del sistema
2. ANÁLISIS VISUAL: Puedes ver e interpretar el contenido de la página actual
3. INTERACCIÓN DOM: Puedes hacer clic en botones, llenar formularios y realizar acciones
4. CONSULTAS EXPERTAS: Respondes preguntas especializadas sobre seguros

INSTRUCCIONES PROFESIONALES:
- Siempre interpreta la intención real del usuario
- Si solicitan ir a una página, navega automáticamente
- Si preguntan sobre seguros, proporciona información experta
- Si necesitan realizar una acción, ejecuta la acción correspondiente
- Mantén un tono profesional y conciso
- Confirma las acciones realizadas

EJEMPLO DE RESPUESTAS:
- "Quiero ver las pólizas" → Navegar a pólizas y confirmar
- "¿Qué es una franquicia?" → Explicar conceptos de seguros
- "Crear una nueva póliza" → Navegar a crear póliza
- "¿Cuántos siniestros tengo?" → Navegar a siniestros y analizar

Responde siempre en español profesional, máximo 2-3 oraciones.`;

export const useAIAssistant = () => {
  const [state, setState] = useState<AIAssistantState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    error: null,
    lastResponse: null,
    transcript: '',
    hasVisionCapabilities: true
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Usar useRef para mantener el historial actualizado
  const conversationHistoryRef = useRef<ChatMessage[]>([
    {
      role: 'system',
      content: PROFESSIONAL_SYSTEM_PROMPT
    }
  ]);

  // Integrar capacidades inteligentes
  const { getPageDescription, startAutoAnalysis, navigateToPage } = useDOMAnalyzer();
  const { executeAction } = useSmartActions();
  const { analyzeIntent, isInsuranceQuery } = useIntentAnalyzer();

  // Inicializar análisis automático del DOM
  useEffect(() => {
    const cleanup = startAutoAnalysis();
    return cleanup;
  }, [startAutoAnalysis]);

  // Función principal para procesar la intención del usuario
  const processUserIntent = useCallback(async (userText: string): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      // 1. Analizar intención con IA
      const intentAnalysis = await analyzeIntent(userText);
      
      // 2. Ejecutar acción basada en la intención
      let finalResponse = '';
      
      switch (intentAnalysis.type) {
        case 'navigation':
          if (intentAnalysis.targetRoute) {
            // Navegar automáticamente
            navigateToPage(intentAnalysis.targetRoute.path);
            finalResponse = `Te he llevado a ${intentAnalysis.targetRoute.title}. ${intentAnalysis.targetRoute.description}`;
          } else {
            finalResponse = 'No pude identificar a qué página quieres ir. ¿Puedes ser más específico?';
          }
          break;
          
        case 'information':
          if (intentAnalysis.targetRoute) {
            // Navegar a la página relevante para mostrar información
            navigateToPage(intentAnalysis.targetRoute.path);
            
            // Generar respuesta contextual con DeepSeek
            const contextualResponse = await queryDeepSeekWithContext(userText, intentAnalysis);
            finalResponse = contextualResponse;
          } else if (isInsuranceQuery(userText)) {
            // Consulta general sobre seguros
            const insuranceResponse = await queryDeepSeekWithContext(userText, intentAnalysis);
            finalResponse = insuranceResponse;
          } else {
            finalResponse = intentAnalysis.explanation;
          }
          break;
          
        case 'action':
          // Ejecutar acción específica
          const result = await executeAction(intentAnalysis.action || 'unknown', intentAnalysis.parameters);
          finalResponse = result.message;
          break;
          
        default:
          // Usar DeepSeek para respuesta general
          const generalResponse = await queryDeepSeekWithContext(userText, intentAnalysis);
          finalResponse = generalResponse;
      }
      
      setState(prev => ({ ...prev, isProcessing: false }));
      return finalResponse;
      
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      return 'Disculpa, tuve un problema procesando tu solicitud. ¿Puedes intentar nuevamente?';
    }
  }, [analyzeIntent, navigateToPage, executeAction, isInsuranceQuery]);

  // Función para convertir texto a voz con OpenAI TTS
  const speakWithOpenAI = useCallback(async (text: string): Promise<void> => {
    try {
      // Validar configuración de audio
      if (!validateAudioConfig()) {
        setState(prev => ({ ...prev, error: 'Configuración de audio no compatible' }));
        return;
      }

      setState(prev => ({ ...prev, isSpeaking: true }));

      // Procesar texto para mejorar pronunciación
      const processedText = processTextForTTS(text);

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: TTS_CONFIG.model,
          input: processedText,
          voice: TTS_CONFIG.voice,
          response_format: TTS_CONFIG.response_format,
          speed: TTS_CONFIG.speed
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Configurar audio para mejor calidad
      audio.volume = 0.8;
      audio.preload = 'auto';

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setState(prev => ({ ...prev, isSpeaking: false }));
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setState(prev => ({ ...prev, isSpeaking: false }));
          reject(new Error('Error playing audio'));
        };
        
        // Agregar fade-in suave
        audio.addEventListener('loadeddata', () => {
          audio.play().catch(reject);
        });
      });
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isSpeaking: false, 
        error: 'Error al reproducir la respuesta' 
      }));
      throw error;
    }
  }, []);

  // Función para consultar DeepSeek con contexto
  const queryDeepSeekWithContext = useCallback(async (question: string, intentAnalysis?: any): Promise<string> => {
    try {
      // Obtener contexto de la página actual
      const pageContext = getPageDescription();
      
      // Construir prompt con contexto
      const contextualPrompt = `
CONTEXTO DE LA PÁGINA ACTUAL:
${pageContext}

PREGUNTA DEL USUARIO: ${question}

${intentAnalysis ? `ANÁLISIS DE INTENCIÓN: ${JSON.stringify(intentAnalysis)}` : ''}

Responde de manera profesional y concisa en español. Si es sobre seguros, proporciona información experta. Si necesita navegar, indica la acción realizada.`;

      const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_CONFIG.model,
          messages: [
            {
              role: 'system',
              content: PROFESSIONAL_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: contextualPrompt
            }
          ],
          temperature: DEEPSEEK_CONFIG.temperature,
          max_tokens: DEEPSEEK_CONFIG.maxTokens,
          top_p: DEEPSEEK_CONFIG.top_p,
          frequency_penalty: DEEPSEEK_CONFIG.frequency_penalty,
          presence_penalty: DEEPSEEK_CONFIG.presence_penalty
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'No pude procesar tu consulta.';

      // Actualizar historial de conversación
      conversationHistoryRef.current.push(
        { role: 'user', content: question },
        { role: 'assistant', content: aiResponse }
      );

      // Mantener historial limitado
      if (conversationHistoryRef.current.length > 10) {
        conversationHistoryRef.current = [
          conversationHistoryRef.current[0], // Mantener system prompt
          ...conversationHistoryRef.current.slice(-8) // Últimas 8 interacciones
        ];
      }

      return aiResponse;
    } catch (error) {
      return 'Tengo dificultades técnicas en este momento. Por favor, intenta nuevamente.';
    }
  }, [getPageDescription]);

  // Función para iniciar reconocimiento de voz
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setState(prev => ({ 
        ...prev, 
        error: 'El reconocimiento de voz no está disponible en este navegador' 
      }));
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'es-ES'; // Español estándar
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState(prev => ({ 
          ...prev, 
          isListening: true, 
          error: null,
          transcript: 'Escuchando...'
        }));
      };

      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setState(prev => ({ 
          ...prev, 
          isListening: false,
          transcript: `Dijiste: "${transcript}"`
        }));

        // Procesar la intención del usuario de manera inteligente
        await askQuestion(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setState(prev => ({ 
          ...prev, 
          isListening: false,
          error: `Error en reconocimiento de voz: ${event.error}`
        }));
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Error al iniciar el reconocimiento de voz'
      }));
    }
  }, []);

  // Función para detener reconocimiento de voz
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Función principal: procesa intención y habla respuesta
  const askQuestion = useCallback(async (question: string) => {
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null,
      lastResponse: null 
    }));

    try {
      // 1. Procesar intención del usuario de manera inteligente
      const aiResponse = await processUserIntent(question);
      
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        lastResponse: aiResponse 
      }));

      // 2. Hablar la respuesta
      await speakWithOpenAI(aiResponse);

      return aiResponse;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: 'Error al procesar tu pregunta' 
      }));
      throw error;
    }
  }, [processUserIntent, speakWithOpenAI]);

  // Función para solo hablar un texto
  const speakText = useCallback(async (text: string) => {
    try {
      await speakWithOpenAI(text);
    } catch (error) {
    }
  }, [speakWithOpenAI]);

  // Función para probar la voz
  const testVoice = useCallback(async () => {
    const testMessage = "Hola, soy Guro AI, tu asistente virtual para seguros. Puedo ayudarte a navegar por el sistema, consultar información y realizar tareas. ¿En qué puedo asistirte hoy?";
    await speakText(testMessage);
  }, [speakText]);

  // Función para limpiar errores
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Función para limpiar el historial de conversación
  const clearConversation = useCallback(() => {
    conversationHistoryRef.current = [
      {
        role: 'system',
        content: PROFESSIONAL_SYSTEM_PROMPT
      }
    ];
    setState(prev => ({
      ...prev,
      lastResponse: null,
      transcript: ''
    }));
  }, []);

  return {
    // Estado
    isListening: state.isListening,
    isProcessing: state.isProcessing,
    isSpeaking: state.isSpeaking,
    error: state.error,
    lastResponse: state.lastResponse,
    transcript: state.transcript,
    hasVisionCapabilities: state.hasVisionCapabilities,
    
    // Funciones principales
    startListening,
    stopListening,
    askQuestion,
    speakText,
    testVoice,
    clearError,
    clearConversation
  };
}; 
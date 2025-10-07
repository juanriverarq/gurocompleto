// Configuración para OpenAI TTS
export const TTS_CONFIG = {
  model: 'tts-1', // Usar modelo HD para mejor calidad
  voice: 'nova', // Voz masculina clara para español
  speed: 1, // Velocidad óptima para comprensión
  response_format: 'mp3'
} as const;

// Configuración para reconocimiento de voz
export const STT_CONFIG = {
  language: 'es-ES', // Español estándar de España
  continuous: false,
  interimResults: false,
  maxAlternatives: 1
} as const;

// Configuración para DeepSeek
export const DEEPSEEK_CONFIG = {
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  temperature: 0.2, // Más determinístico
  max_tokens: 150,  // Respuestas más concisas
  maxTokens: 150,   // Alias para compatibilidad
  top_p: 0.9,
  frequency_penalty: 0.1,
  presence_penalty: 0.1
} as const;

// Configuración para OpenAI (para compatibilidad)
export const OPENAI_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1'
} as const;

// Configuración de audio para evitar problemas
export const AUDIO_CONFIG = {
  sampleRate: 24000,     // Frecuencia de muestreo alta
  bitRate: 128,          // Bitrate adecuado
  channels: 1,           // Mono para claridad
  format: 'mp3',         // Formato compatible
  bufferSize: 4096,      // Buffer adecuado
  volume: 0.8,           // Volumen controlado
  fadeIn: 100,           // Fade in suave
  fadeOut: 100           // Fade out suave
} as const;

// Configuración de texto para mejorar pronunciación
export const TEXT_PROCESSING_CONFIG = {
  // Reemplazos para mejorar pronunciación en español
  replacements: {
    'AI': 'Inteligencia Artificial',
    'IA': 'I A',
    'API': 'A P I',
    'URL': 'U R L',
    'HTTP': 'H T T P',
    'HTTPS': 'H T T P S',
    'PDF': 'P D F',
    'CEO': 'C E O',
    'CTO': 'C T O',
    'FAQ': 'F A Q',
    'GPS': 'G P S',
    'SMS': 'S M S',
    'USB': 'U S B',
    'WiFi': 'Wi Fi',
    'email': 'correo electrónico',
    'dashboard': 'panel de control',
    'login': 'iniciar sesión',
    'logout': 'cerrar sesión',
    'admin': 'administrador',
    'user': 'usuario',
    'password': 'contraseña',
    'username': 'nombre de usuario'
  },
  
  // Patrones para mejorar pausas
  pausePatterns: {
    '.': '<break time="0.5s"/>',
    ',': '<break time="0.3s"/>',
    ';': '<break time="0.4s"/>',
    ':': '<break time="0.4s"/>',
    '!': '<break time="0.6s"/>',
    '?': '<break time="0.6s"/>'
  },
  
  // Configuración de énfasis
  emphasis: {
    important: '<emphasis level="strong">',
    moderate: '<emphasis level="moderate">',
    reduced: '<emphasis level="reduced">'
  }
} as const;

// Función para procesar texto antes del TTS
export const processTextForTTS = (text: string): string => {
  let processedText = text;
  
  // Aplicar reemplazos de pronunciación
  Object.entries(TEXT_PROCESSING_CONFIG.replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    processedText = processedText.replace(regex, value);
  });
  
  // Limpiar caracteres problemáticos
  processedText = processedText
    .replace(/[^\w\s.,;:!?¿¡áéíóúüñÁÉÍÓÚÜÑ]/g, ' ') // Solo caracteres seguros
    .replace(/\s+/g, ' ') // Espacios múltiples
    .replace(/([.!?])\s*([.!?])/g, '$1 $2') // Espaciar puntuación
    .trim();
  
  // Limitar longitud para evitar problemas
  if (processedText.length > 4000) {
    processedText = processedText.substring(0, 3997) + '...';
  }
  
  // Asegurar que termine con puntuación para mejor entonación
  if (!/[.!?]$/.test(processedText)) {
    processedText += '.';
  }
  
  return processedText;
};

// Función para detectar y corregir problemas de audio
export const validateAudioConfig = (): boolean => {
  try {
    // Verificar soporte de audio
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      return false;
    }
    
    // Verificar soporte de MediaRecorder
    if (!window.MediaRecorder) {
      return false;
    }
    
    // Verificar soporte de Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

// Configuración de retry para problemas de conexión
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 5000
} as const;

// Opciones de voces alternativas (ordenadas por calidad en español)
export const VOICE_OPTIONS = [
  'echo',    // Masculina, clara y natural
  'alloy',   // Neutral, buena pronunciación
  'fable',   // Masculina, expresiva
  'onyx',    // Masculina, profunda
  'nova',    // Femenina, vivaz
  'shimmer'  // Femenina, suave
] as const;

// Mensaje de prueba profesional
export const getTestMessage = (): string => {
  return "Hola, soy Guro AI, tu asistente virtual para seguros. Estoy aquí para ayudarte con pólizas, reportes y consultas. ¿En qué puedo asistirte hoy?";
}; 
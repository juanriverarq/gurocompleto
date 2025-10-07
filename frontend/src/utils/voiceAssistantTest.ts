// Script de prueba para el asistente de voz mejorado
import { processTextForTTS, validateAudioConfig } from '../config/ttsConfig';

export interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

export const runVoiceAssistantTests = async (): Promise<TestResult[]> => {
  const results: TestResult[] = [];

  // Test 1: Validación de configuración de audio
  try {
    const audioValid = validateAudioConfig();
    results.push({
      test: 'Configuración de Audio',
      passed: audioValid,
      message: audioValid ? 'Configuración de audio válida' : 'Problemas con configuración de audio',
      details: {
        hasAudioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
        hasMediaRecorder: !!window.MediaRecorder,
        hasSpeechRecognition: !!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
      }
    });
  } catch (error) {
    results.push({
      test: 'Configuración de Audio',
      passed: false,
      message: `Error en validación: ${error}`,
      details: { error }
    });
  }

  // Test 2: Procesamiento de texto para TTS
  try {
    const testTexts = [
      'Hola, soy tu asistente de IA para seguros.',
      'Navega al dashboard principal.',
      'API, URL, HTTP, y otros términos técnicos.',
      'Email, login, admin, password.'
    ];

    const processedTexts = testTexts.map(text => ({
      original: text,
      processed: processTextForTTS(text)
    }));

    const allProcessed = processedTexts.every(item => 
      item.processed && 
      item.processed.length > 0 && 
      item.processed !== item.original
    );

    results.push({
      test: 'Procesamiento de Texto TTS',
      passed: allProcessed,
      message: allProcessed ? 'Procesamiento de texto funcionando' : 'Problemas con procesamiento de texto',
      details: { processedTexts }
    });
  } catch (error) {
    results.push({
      test: 'Procesamiento de Texto TTS',
      passed: false,
      message: `Error en procesamiento: ${error}`,
      details: { error }
    });
  }

  // Test 3: Variables de entorno
  try {
    const hasOpenAIKey = !!import.meta.env.VITE_OPENAI_API_KEY;
    const hasDeepSeekKey = !!import.meta.env.VITE_DEEPSEEK_API_KEY;

    results.push({
      test: 'Variables de Entorno',
      passed: hasOpenAIKey && hasDeepSeekKey,
      message: hasOpenAIKey && hasDeepSeekKey ? 
        'Todas las API keys configuradas' : 
        'Faltan API keys en variables de entorno',
      details: {
        openai: hasOpenAIKey ? 'Configurado' : 'Faltante',
        deepseek: hasDeepSeekKey ? 'Configurado' : 'Faltante'
      }
    });
  } catch (error) {
    results.push({
      test: 'Variables de Entorno',
      passed: false,
      message: `Error verificando variables: ${error}`,
      details: { error }
    });
  }

  // Test 4: Conexión a APIs (simulado)
  try {
    // Test de conectividad básica a OpenAI
    const openaiReachable = await testAPIReachability('https://api.openai.com/v1/models');
    const deepseekReachable = await testAPIReachability('https://api.deepseek.com/v1/models');

    results.push({
      test: 'Conectividad APIs',
      passed: openaiReachable && deepseekReachable,
      message: openaiReachable && deepseekReachable ? 
        'APIs accesibles' : 
        'Problemas de conectividad con APIs',
      details: {
        openai: openaiReachable ? 'Accesible' : 'No accesible',
        deepseek: deepseekReachable ? 'Accesible' : 'No accesible'
      }
    });
  } catch (error) {
    results.push({
      test: 'Conectividad APIs',
      passed: false,
      message: `Error probando conectividad: ${error}`,
      details: { error }
    });
  }

  return results;
};

// Función auxiliar para probar conectividad
const testAPIReachability = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.status < 500; // Cualquier cosa que no sea error de servidor
  } catch (error) {
    return false;
  }
};

// Función para mostrar resultados de prueba en consola
export const displayTestResults = (results: TestResult[]): void => {
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    if (result.details) {
    }
  });

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  
  if (passedTests === totalTests) {
  } else {
  }
  
};

// Función para ejecutar pruebas automáticamente
export const autoRunTests = async (): Promise<void> => {
  const results = await runVoiceAssistantTests();
  displayTestResults(results);
}; 
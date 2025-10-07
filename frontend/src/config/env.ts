// Configuración avanzada de variables de entorno para el procesamiento de PDFs
export const pdfProcessingConfig = {
  // APIs de IA
  deepseek: {
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    enabled: !!import.meta.env.VITE_DEEPSEEK_API_KEY,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 1500,
    temperature: 0.1
  },
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    enabled: !!import.meta.env.VITE_OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-turbo-preview',
    maxTokens: 1500,
    temperature: 0.1
  },
  claude: {
    apiKey: import.meta.env.VITE_CLAUDE_API_KEY || '',
    enabled: !!import.meta.env.VITE_CLAUDE_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 1500,
    temperature: 0.1
  },

  // APIs de OCR
  googleVision: {
    apiKey: import.meta.env.VITE_GOOGLE_VISION_API_KEY || '',
    enabled: !!import.meta.env.VITE_GOOGLE_VISION_API_KEY,
    endpoint: 'https://vision.googleapis.com/v1/images:annotate'
  },
  awsTextract: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    enabled: !!(import.meta.env.VITE_AWS_ACCESS_KEY_ID && import.meta.env.VITE_AWS_SECRET_ACCESS_KEY)
  },

  // Configuración general
  processing: {
    mode: import.meta.env.VITE_PDF_PROCESSING_MODE || 'advanced-hybrid',
    maxFileSizeMB: parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB || '20'),
    enableLearning: import.meta.env.VITE_ENABLE_PDF_LEARNING !== 'false',
    enableCrossValidation: import.meta.env.VITE_ENABLE_CROSS_VALIDATION !== 'false',
    parallelProcessing: import.meta.env.VITE_PARALLEL_PROCESSING !== 'false'
  }
};

// Verificar configuración avanzada
export const checkPdfProcessingConfig = () => {
  const config = pdfProcessingConfig;
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Verificar APIs de IA
  const aiApis = [config.deepseek.enabled, config.openai.enabled, config.claude.enabled];
  const enabledAiCount = aiApis.filter(Boolean).length;
  
  if (enabledAiCount === 0) {
    warnings.push('⚠️ No hay APIs de IA configuradas. Solo funcionarán patrones básicos.');
    recommendations.push('Configura al menos OpenAI o DeepSeek para mejor precisión');
  } else if (enabledAiCount === 1) {
    recommendations.push('Configura múltiples APIs de IA para redundancia y mejor precisión');
  }

  // Verificar APIs de OCR
  const ocrApis = [config.googleVision.enabled, config.awsTextract.enabled];
  const enabledOcrCount = ocrApis.filter(Boolean).length;
  
  if (enabledOcrCount === 0) {
    warnings.push('⚠️ No hay APIs de OCR configuradas. PDFs escaneados tendrán baja precisión.');
    recommendations.push('Configura Google Vision o AWS Textract para procesar PDFs escaneados');
  }

  // Verificar configuración de procesamiento
  if (config.processing.maxFileSizeMB > 50) {
    warnings.push('⚠️ Tamaño máximo de archivo muy alto. Puede causar problemas de rendimiento.');
  }

  const capabilities = {
    textExtraction: true,
    ocrProcessing: enabledOcrCount > 0,
    aiProcessing: enabledAiCount > 0,
    learningEnabled: config.processing.enableLearning,
    crossValidation: config.processing.enableCrossValidation,
    parallelProcessing: config.processing.parallelProcessing
  };

  return {
    config,
    warnings,
    recommendations,
    capabilities,
    isOptimallyConfigured: warnings.length === 0 && enabledAiCount >= 2 && enabledOcrCount >= 1
  };
};

// Obtener configuración recomendada para un caso de uso específico
export const getRecommendedConfig = (useCase: 'development' | 'production' | 'testing') => {
  const baseConfig = {
    development: {
      mode: 'hybrid',
      maxFileSizeMB: 10,
      enableLearning: true,
      parallelProcessing: false
    },
    production: {
      mode: 'advanced-hybrid',
      maxFileSizeMB: 20,
      enableLearning: true,
      parallelProcessing: true
    },
    testing: {
      mode: 'patterns-only',
      maxFileSizeMB: 5,
      enableLearning: false,
      parallelProcessing: false
    }
  };

  return baseConfig[useCase];
};
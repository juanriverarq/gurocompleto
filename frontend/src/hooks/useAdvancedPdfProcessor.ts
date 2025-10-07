import { useState, useCallback } from 'react';
import { processPdf, type ProcessedPdfData } from '../services/advancedPdfProcessor';
import { learningEngine } from '../services/learningEngine';
import { toast } from './use-toast';

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  currentStep: string;
  result: ProcessedPdfData | null;
  error: string | null;
  predictions: any | null;
}

export interface UseAdvancedPdfProcessorReturn {
  state: ProcessingState;
  processFile: (file: File) => Promise<ProcessedPdfData | null>;
  predictSuccess: (file: File) => Promise<any>;
  recordCorrection: (original: ProcessedPdfData, corrected: ProcessedPdfData, feedback?: any) => Promise<void>;
  getRecommendations: (insurer?: string) => Promise<any>;
  exportLearningData: () => Promise<string>;
  importLearningData: (data: string) => Promise<void>;
  clearLearningData: () => Promise<void>;
  reset: () => void;
}

export const useAdvancedPdfProcessor = (): UseAdvancedPdfProcessorReturn => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    currentStep: '',
    result: null,
    error: null,
    predictions: null
  });

  const updateState = useCallback((updates: Partial<ProcessingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const processFile = useCallback(async (file: File): Promise<ProcessedPdfData | null> => {
    try {
      updateState({
        isProcessing: true,
        progress: 0,
        currentStep: 'Iniciando procesamiento...',
        error: null,
        result: null
      });

      // Validaciones iniciales
      if (!file) {
        throw new Error('No se proporcionó archivo');
      }

      if (file.type !== 'application/pdf') {
        throw new Error('El archivo debe ser un PDF');
      }

      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        throw new Error('El archivo es demasiado grande (máximo 20MB)');
      }

      // Predicción de éxito
      updateState({ 
        progress: 10, 
        currentStep: 'Analizando documento...' 
      });

      try {
        const predictions = await learningEngine.predictExtractionSuccess(
          file.name,
          file.size,
          'unknown' // Se detectará durante el procesamiento
        );
        updateState({ predictions });
      } catch (error) {
        console.warn('Error en predicción:', error);
      }

      // Procesamiento principal
      updateState({ 
        progress: 20, 
        currentStep: 'Extrayendo datos...' 
      });

      const result = await processPdf(file);

      updateState({ 
        progress: 90, 
        currentStep: 'Finalizando...' 
      });

      // Mostrar resultado
      updateState({
        progress: 100,
        currentStep: 'Completado',
        result,
        isProcessing: false
      });

      // Mostrar notificación basada en la confianza
      const confidence = result.confidence.overall;
      if (confidence >= 90) {
        toast({
          title: "Extracción exitosa",
          description: `Datos extraídos con ${confidence.toFixed(0)}% de confianza`,
        });
      } else if (confidence >= 70) {
        toast({
          title: "Extracción completada",
          description: `Revise los datos extraídos (${confidence.toFixed(0)}% confianza)`,
          variant: "default"
        });
      } else {
        toast({
          title: "Extracción con advertencias",
          description: `Baja confianza (${confidence.toFixed(0)}%). Revise cuidadosamente los datos`,
          variant: "destructive"
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      updateState({
        isProcessing: false,
        error: errorMessage,
        progress: 0,
        currentStep: ''
      });

      toast({
        title: "Error en procesamiento",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    }
  }, [updateState]);

  const predictSuccess = useCallback(async (file: File) => {
    try {
      const prediction = await learningEngine.predictExtractionSuccess(
        file.name,
        file.size,
        'unknown'
      );
      
      updateState({ predictions: prediction });
      return prediction;
    } catch (error) {
      console.warn('Error en predicción:', error);
      return null;
    }
  }, [updateState]);

  const recordCorrection = useCallback(async (
    original: ProcessedPdfData,
    corrected: ProcessedPdfData,
    feedback?: any
  ) => {
    try {
      // Registrar la extracción original
      const recordId = await learningEngine.recordExtraction(
        original,
        original.metadata?.fileName || 'unknown.pdf',
        original.metadata?.fileSize || 0,
        original.metadata?.detectedInsurer || 'unknown',
        original.method,
        original.confidence.overall,
        original.metadata?.processingTime || 0
      );

      // Registrar la corrección
      await learningEngine.recordCorrection(recordId, corrected, feedback);

      toast({
        title: "Corrección registrada",
        description: "El sistema ha aprendido de tu corrección",
      });

    } catch (error) {
      console.error('Error registrando corrección:', error);
      toast({
        title: "Error al registrar corrección",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive"
      });
    }
  }, []);

  const getRecommendations = useCallback(async (insurer?: string) => {
    try {
      return await learningEngine.getRecommendations(insurer);
    } catch (error) {
      console.error('Error obteniendo recomendaciones:', error);
      return { patterns: [], strategies: [], improvements: [] };
    }
  }, []);

  const exportLearningData = useCallback(async (): Promise<string> => {
    try {
      const data = await learningEngine.exportLearningData();
      
      toast({
        title: "Datos exportados",
        description: "Los datos de aprendizaje han sido exportados exitosamente",
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error al exportar",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const importLearningData = useCallback(async (data: string): Promise<void> => {
    try {
      await learningEngine.importLearningData(data);
      
      toast({
        title: "Datos importados",
        description: "Los datos de aprendizaje han sido importados exitosamente",
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error al importar",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const clearLearningData = useCallback(async (): Promise<void> => {
    try {
      await learningEngine.clearLearningData();
      
      toast({
        title: "Datos eliminados",
        description: "Todos los datos de aprendizaje han sido eliminados",
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error al eliminar datos",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      currentStep: '',
      result: null,
      error: null,
      predictions: null
    });
  }, []);

  return {
    state,
    processFile,
    predictSuccess,
    recordCorrection,
    getRecommendations,
    exportLearningData,
    importLearningData,
    clearLearningData,
    reset
  };
};

// Hook para métricas de rendimiento
export const usePdfPerformanceMetrics = (insurer?: string) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [performanceMetrics, recommendations, report] = await Promise.all([
        learningEngine.getPerformanceMetrics(),
        learningEngine.getRecommendations(insurer),
        learningEngine.generateLearningReport()
      ]);

      setMetrics({
        performance: performanceMetrics,
        recommendations,
        report
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error cargando métricas:', err);
    } finally {
      setLoading(false);
    }
  }, [insurer]);

  return {
    metrics,
    loading,
    error,
    loadMetrics,
    refresh: loadMetrics
  };
};

// Hook para validación en tiempo real
export const usePdfValidation = () => {
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateData = useCallback(async (data: ProcessedPdfData) => {
    try {
      setIsValidating(true);
      
      // Importar el validador
      const { dataValidator } = await import('../services/dataValidator');
      
      const results = await dataValidator.validateAllFields(data, {
        extractedData: data
      });
      
      setValidationResults(results);
      
      return results;
    } catch (error) {
      console.error('Error en validación:', error);
      return [];
    } finally {
      setIsValidating(false);
    }
  }, []);

  const getValidationSummary = useCallback(() => {
    if (validationResults.length === 0) {
      return {
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        overallConfidence: 100
      };
    }

    const errors = validationResults.filter(r => r.severity === 'error' && !r.isValid);
    const warnings = validationResults.filter(r => r.severity === 'warning' && !r.isValid);
    const avgConfidence = validationResults.reduce((sum, r) => sum + r.confidence, 0) / validationResults.length;

    return {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      overallConfidence: avgConfidence * 100
    };
  }, [validationResults]);

  return {
    validationResults,
    isValidating,
    validateData,
    getValidationSummary
  };
};
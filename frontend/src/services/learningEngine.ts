// Motor de aprendizaje adaptativo para mejorar la precisión del procesamiento PDF
// Aprende de correcciones manuales y optimiza patrones automáticamente

export interface LearningRecord {
  id: string;
  timestamp: string;
  fileName: string;
  fileSize: number;
  insurer: string;
  documentType: string;
  originalExtraction: Record<string, any>;
  correctedData: Record<string, any>;
  extractionMethod: string;
  confidence: number;
  processingTime: number;
  userFeedback?: UserFeedback;
}

export interface UserFeedback {
  rating: 1 | 2 | 3 | 4 | 5; // 1 = muy malo, 5 = excelente
  comments?: string;
  mostAccurateFields: string[];
  leastAccurateFields: string[];
}

export interface ErrorPattern {
  field: string;
  insurer: string;
  errorType: 'format' | 'extraction' | 'validation' | 'logic';
  frequency: number;
  examples: string[];
  suggestedFix?: string;
}

export interface DynamicPattern {
  field: string;
  insurer: string;
  pattern: string;
  confidence: number;
  successRate: number;
  lastUpdated: string;
  examples: string[];
  frequency: number;
}

export interface PerformanceMetrics {
  totalExtractions: number;
  successRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  errorsByField: Record<string, number>;
  errorsByInsurer: Record<string, number>;
  improvementTrend: number; // Porcentaje de mejora en el último mes
}

export class LearningEngine {
  private storageKey = 'pdf_learning_data';
  private patternsKey = 'pdf_dynamic_patterns';
  private metricsKey = 'pdf_performance_metrics';

  // ===== REGISTRO Y ALMACENAMIENTO =====

  async recordExtraction(
    originalData: Record<string, any>,
    fileName: string,
    fileSize: number,
    insurer: string,
    method: string,
    confidence: number,
    processingTime: number
  ): Promise<string> {
    const record: LearningRecord = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      fileName,
      fileSize,
      insurer,
      documentType: this.detectDocumentType(fileName),
      originalExtraction: originalData,
      correctedData: {}, // Se llenará cuando haya corrección
      extractionMethod: method,
      confidence,
      processingTime
    };

    await this.saveRecord(record);
    await this.updateMetrics(record);
    
    return record.id;
  }

  async recordCorrection(
    recordId: string,
    correctedData: Record<string, any>,
    userFeedback?: UserFeedback
  ): Promise<void> {
    const records = await this.getRecords();
    const recordIndex = records.findIndex(r => r.id === recordId);
    
    if (recordIndex === -1) {
      throw new Error('Registro de extracción no encontrado');
    }

    const record = records[recordIndex];
    record.correctedData = correctedData;
    record.userFeedback = userFeedback;

    records[recordIndex] = record;
    await this.saveRecords(records);

    // Analizar errores y actualizar patrones
    await this.analyzeAndLearn(record);
  }

  // ===== ANÁLISIS Y APRENDIZAJE =====

  private async analyzeAndLearn(record: LearningRecord): Promise<void> {
    // 1. Identificar errores por campo
    const errorPatterns = this.identifyErrorPatterns(record);
    
    // 2. Actualizar patrones dinámicos
    await this.updateDynamicPatterns(errorPatterns, record);
    
    // 3. Optimizar estrategias de extracción
    await this.optimizeExtractionStrategy(record);
    
    // 4. Actualizar métricas de rendimiento
    await this.updatePerformanceMetrics(record);
  }

  private identifyErrorPatterns(record: LearningRecord): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];
    const { originalExtraction, correctedData, insurer } = record;

    for (const [field, originalValue] of Object.entries(originalExtraction)) {
      const correctedValue = correctedData[field];
      
      if (originalValue !== correctedValue) {
        const errorType = this.classifyError(field, originalValue, correctedValue);
        
        patterns.push({
          field,
          insurer,
          errorType,
          frequency: 1,
          examples: [`Original: "${originalValue}" → Correcto: "${correctedValue}"`],
          suggestedFix: this.generateSuggestedFix(field, originalValue, correctedValue)
        });
      }
    }

    return patterns;
  }

  private classifyError(field: string, original: any, corrected: any): ErrorPattern['errorType'] {
    if (!original && corrected) return 'extraction'; // No se extrajo pero debería
    if (original && !corrected) return 'extraction'; // Se extrajo pero no debería
    
    // Analizar tipo de error basado en el campo
    if (field.includes('fecha')) {
      return 'format'; // Probablemente error de formato de fecha
    }
    
    if (field.includes('monto') || field.includes('prima') || field.includes('iva') || field.includes('total')) {
      return 'format'; // Error de formato numérico
    }
    
    if (field === 'numeroPoliza') {
      return 'extraction'; // Error de extracción de número
    }
    
    return 'validation'; // Error general de validación
  }

  private generateSuggestedFix(field: string, original: any, corrected: any): string {
    if (field.includes('fecha')) {
      return 'Mejorar patrones de detección de fechas y normalización de formatos';
    }
    
    if (field.includes('monto')) {
      return 'Ajustar patrones de extracción de montos y limpieza de caracteres';
    }
    
    if (field === 'numeroPoliza') {
      return 'Refinar patrones de número de póliza para esta aseguradora';
    }
    
    return 'Revisar patrones de extracción para este campo';
  }

  private async updateDynamicPatterns(errorPatterns: ErrorPattern[], record: LearningRecord): Promise<void> {
    const existingPatterns = await this.getDynamicPatterns();
    
    for (const errorPattern of errorPatterns) {
      const key = `${errorPattern.insurer}_${errorPattern.field}`;
      
      if (existingPatterns[key]) {
        // Actualizar patrón existente
        existingPatterns[key].frequency += 1;
        existingPatterns[key].examples.push(...errorPattern.examples);
        existingPatterns[key].lastUpdated = new Date().toISOString();
        
        // Mantener solo los últimos 10 ejemplos
        if (existingPatterns[key].examples.length > 10) {
          existingPatterns[key].examples = existingPatterns[key].examples.slice(-10);
        }
      } else {
        // Crear nuevo patrón
        existingPatterns[key] = {
          field: errorPattern.field,
          insurer: errorPattern.insurer,
          pattern: this.generateImprovedPattern(errorPattern),
          confidence: 0.5, // Inicial
          successRate: 0,
          lastUpdated: new Date().toISOString(),
          examples: errorPattern.examples,
          frequency: 1
        };
      }
    }

    await this.saveDynamicPatterns(existingPatterns);
  }

  private generateImprovedPattern(errorPattern: ErrorPattern): string {
    // Generar patrón mejorado basado en los errores identificados
    // Esta es una implementación básica que se puede expandir
    
    switch (errorPattern.field) {
      case 'numeroPoliza':
        return `(?:póliza|poliza|número|no\\.?|nro\\.?)\\s*:?\\s*([a-zA-Z0-9\\-_]{3,50})`;
      
      case 'fechaInicio':
      case 'fechaFin':
      case 'fechaExpedicion':
        return `(\\d{1,2}[\/\\-]\\d{1,2}[\/\\-]\\d{4})`;
      
      case 'primaNeta':
        return `(?:prima\\s*neta|valor\\s*prima)\\s*:?\\s*\\$?\\s*([\\d,\\.]+)`;
      
      default:
        return `${errorPattern.field}\\s*:?\\s*([A-ZÁÉÍÓÚÑ0-9\\s,\\.\\-@]+)`;
    }
  }

  // ===== OPTIMIZACIÓN DE ESTRATEGIAS =====

  private async optimizeExtractionStrategy(record: LearningRecord): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    // Analizar qué método funciona mejor para esta aseguradora
    const insurerRecords = (await this.getRecords())
      .filter(r => r.insurer === record.insurer && r.correctedData && Object.keys(r.correctedData).length > 0);

    if (insurerRecords.length < 5) return; // Necesitamos al menos 5 registros para optimizar

    const methodPerformance = new Map<string, { success: number; total: number; avgConfidence: number }>();

    for (const r of insurerRecords) {
      const method = r.extractionMethod;
      const current = methodPerformance.get(method) || { success: 0, total: 0, avgConfidence: 0 };
      
      current.total += 1;
      current.avgConfidence += r.confidence;
      
      // Considerar exitoso si la confianza es > 70%
      if (r.confidence > 70) {
        current.success += 1;
      }
      
      methodPerformance.set(method, current);
    }

    // Calcular tasas de éxito
    const optimizedStrategy: any = {};
    for (const [method, stats] of methodPerformance.entries()) {
      optimizedStrategy[method] = {
        successRate: (stats.success / stats.total) * 100,
        averageConfidence: stats.avgConfidence / stats.total,
        recommendedOrder: 0
      };
    }

    // Guardar estrategia optimizada
    await this.saveOptimizedStrategy(record.insurer, optimizedStrategy);
  }

  // ===== MÉTRICAS Y REPORTES =====

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const stored = localStorage.getItem(this.metricsKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Error cargando métricas:', error);
    }

    // Métricas por defecto
    return {
      totalExtractions: 0,
      successRate: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      errorsByField: {},
      errorsByInsurer: {},
      improvementTrend: 0
    };
  }

  private async updateMetrics(record: LearningRecord): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    metrics.totalExtractions += 1;
    metrics.averageConfidence = (
      (metrics.averageConfidence * (metrics.totalExtractions - 1)) + record.confidence
    ) / metrics.totalExtractions;
    
    metrics.averageProcessingTime = (
      (metrics.averageProcessingTime * (metrics.totalExtractions - 1)) + record.processingTime
    ) / metrics.totalExtractions;

    await this.saveMetrics(metrics);
  }

  private async updatePerformanceMetrics(record: LearningRecord): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    // Actualizar tasa de éxito basada en correcciones
    const records = await this.getRecords();
    const correctedRecords = records.filter(r => Object.keys(r.correctedData).length > 0);
    
    if (correctedRecords.length > 0) {
      const successfulExtractions = correctedRecords.filter(r => {
        // Considerar exitoso si al menos 70% de los campos fueron correctos
        const totalFields = Object.keys(r.originalExtraction).length;
        const correctFields = Object.keys(r.originalExtraction).filter(
          field => r.originalExtraction[field] === r.correctedData[field]
        ).length;
        
        return (correctFields / totalFields) >= 0.7;
      }).length;
      
      metrics.successRate = (successfulExtractions / correctedRecords.length) * 100;
    }

    // Actualizar errores por campo
    for (const [field, originalValue] of Object.entries(record.originalExtraction)) {
      const correctedValue = record.correctedData[field];
      if (originalValue !== correctedValue) {
        metrics.errorsByField[field] = (metrics.errorsByField[field] || 0) + 1;
      }
    }

    // Actualizar errores por aseguradora
    if (Object.keys(record.correctedData).length > 0) {
      const hasErrors = Object.keys(record.originalExtraction).some(
        field => record.originalExtraction[field] !== record.correctedData[field]
      );
      
      if (hasErrors) {
        metrics.errorsByInsurer[record.insurer] = (metrics.errorsByInsurer[record.insurer] || 0) + 1;
      }
    }

    await this.saveMetrics(metrics);
  }

  // ===== RECOMENDACIONES INTELIGENTES =====

  async getRecommendations(insurer?: string): Promise<{
    patterns: string[];
    strategies: string[];
    improvements: string[];
  }> {
    const records = await this.getRecords();
    const errorPatterns = await this.getErrorPatterns();
    const metrics = await this.getPerformanceMetrics();

    const recommendations = {
      patterns: [] as string[],
      strategies: [] as string[],
      improvements: [] as string[]
    };

    // Recomendaciones basadas en errores frecuentes
    const frequentErrors = Object.entries(metrics.errorsByField)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    for (const [field, count] of frequentErrors) {
      if (count > 3) {
        recommendations.patterns.push(
          `Mejorar patrones de extracción para ${field} (${count} errores detectados)`
        );
      }
    }

    // Recomendaciones por aseguradora
    if (insurer && metrics.errorsByInsurer[insurer] > 5) {
      recommendations.strategies.push(
        `Crear procesador específico para ${insurer} (${metrics.errorsByInsurer[insurer]} errores)`
      );
    }

    // Recomendaciones generales
    if (metrics.successRate < 80) {
      recommendations.improvements.push(
        'Implementar validación cruzada más estricta'
      );
    }

    if (metrics.averageConfidence < 75) {
      recommendations.improvements.push(
        'Mejorar algoritmos de cálculo de confianza'
      );
    }

    if (metrics.averageProcessingTime > 5000) {
      recommendations.improvements.push(
        'Optimizar rendimiento del procesamiento'
      );
    }

    return recommendations;
  }

  // ===== PATRONES DINÁMICOS =====

  async getDynamicPatternsForInsurer(insurer: string): Promise<DynamicPattern[]> {
    const allPatterns = await this.getDynamicPatterns();
    return Object.values(allPatterns).filter(p => p.insurer === insurer);
  }

  async updatePatternSuccess(insurer: string, field: string, wasSuccessful: boolean): Promise<void> {
    const patterns = await this.getDynamicPatterns();
    const key = `${insurer}_${field}`;
    
    if (patterns[key]) {
      const pattern = patterns[key];
      const totalAttempts = pattern.successRate * 100; // Aproximación
      const newTotal = totalAttempts + 1;
      const newSuccesses = (pattern.successRate * totalAttempts / 100) + (wasSuccessful ? 1 : 0);
      
      pattern.successRate = (newSuccesses / newTotal) * 100;
      pattern.confidence = Math.min(95, pattern.confidence + (wasSuccessful ? 1 : -2));
      pattern.lastUpdated = new Date().toISOString();
      
      await this.saveDynamicPatterns(patterns);
    }
  }

  // ===== ANÁLISIS PREDICTIVO =====

  async predictExtractionSuccess(
    fileName: string,
    fileSize: number,
    insurer: string
  ): Promise<{
    expectedConfidence: number;
    recommendedMethod: string;
    estimatedTime: number;
    riskFactors: string[];
  }> {
    const records = await this.getRecords();
    const similarRecords = records.filter(r => 
      r.insurer === insurer && 
      Math.abs(r.fileSize - fileSize) < fileSize * 0.5 // Tamaño similar
    );

    if (similarRecords.length === 0) {
      return {
        expectedConfidence: 70, // Estimación conservadora
        recommendedMethod: 'hybrid',
        estimatedTime: 3000,
        riskFactors: ['Sin datos históricos para esta aseguradora']
      };
    }

    const avgConfidence = similarRecords.reduce((sum, r) => sum + r.confidence, 0) / similarRecords.length;
    const avgTime = similarRecords.reduce((sum, r) => sum + r.processingTime, 0) / similarRecords.length;
    
    // Determinar mejor método
    const methodStats = new Map<string, { confidence: number; count: number }>();
    for (const record of similarRecords) {
      const current = methodStats.get(record.extractionMethod) || { confidence: 0, count: 0 };
      current.confidence += record.confidence;
      current.count += 1;
      methodStats.set(record.extractionMethod, current);
    }

    let bestMethod = 'hybrid';
    let bestAvgConfidence = 0;
    for (const [method, stats] of methodStats.entries()) {
      const avgConf = stats.confidence / stats.count;
      if (avgConf > bestAvgConfidence) {
        bestAvgConfidence = avgConf;
        bestMethod = method;
      }
    }

    // Identificar factores de riesgo
    const riskFactors: string[] = [];
    if (fileSize > 5 * 1024 * 1024) riskFactors.push('Archivo grande (>5MB)');
    if (avgConfidence < 60) riskFactors.push('Baja confianza histórica para esta aseguradora');
    if (avgTime > 8000) riskFactors.push('Tiempo de procesamiento alto esperado');

    return {
      expectedConfidence: Math.round(avgConfidence),
      recommendedMethod: bestMethod,
      estimatedTime: Math.round(avgTime),
      riskFactors
    };
  }

  // ===== REPORTES Y ESTADÍSTICAS =====

  async generateLearningReport(): Promise<{
    summary: any;
    topErrors: any[];
    improvements: any[];
    recommendations: any[];
  }> {
    const records = await this.getRecords();
    const metrics = await this.getPerformanceMetrics();
    const errorPatterns = await this.getErrorPatterns();

    const summary = {
      totalDocuments: records.length,
      documentsWithCorrections: records.filter(r => Object.keys(r.correctedData).length > 0).length,
      averageAccuracy: metrics.successRate,
      mostProblematicInsurer: this.getMostProblematicInsurer(metrics.errorsByInsurer),
      mostProblematicField: this.getMostProblematicField(metrics.errorsByField)
    };

    const topErrors = Object.entries(metrics.errorsByField)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([field, count]) => ({ field, count }));

    const improvements = this.calculateImprovements(records);
    const recommendations = await this.getRecommendations();

    return {
      summary,
      topErrors,
      improvements,
      recommendations: [
        ...recommendations.patterns,
        ...recommendations.strategies,
        ...recommendations.improvements
      ]
    };
  }

  private calculateImprovements(records: LearningRecord[]): any[] {
    // Calcular mejoras en el tiempo
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentRecords = records.filter(r => new Date(r.timestamp) > oneMonthAgo);
    const olderRecords = records.filter(r => new Date(r.timestamp) <= oneMonthAgo);

    if (olderRecords.length === 0 || recentRecords.length === 0) {
      return [];
    }

    const recentAvgConfidence = recentRecords.reduce((sum, r) => sum + r.confidence, 0) / recentRecords.length;
    const olderAvgConfidence = olderRecords.reduce((sum, r) => sum + r.confidence, 0) / olderRecords.length;
    
    const improvement = ((recentAvgConfidence - olderAvgConfidence) / olderAvgConfidence) * 100;

    return [{
      metric: 'Confianza promedio',
      improvement: `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`,
      trend: improvement > 0 ? 'up' : 'down'
    }];
  }

  private getMostProblematicInsurer(errorsByInsurer: Record<string, number>): string {
    const entries = Object.entries(errorsByInsurer);
    if (entries.length === 0) return 'Ninguna';
    
    return entries.sort(([,a], [,b]) => b - a)[0][0];
  }

  private getMostProblematicField(errorsByField: Record<string, number>): string {
    const entries = Object.entries(errorsByField);
    if (entries.length === 0) return 'Ninguno';
    
    return entries.sort(([,a], [,b]) => b - a)[0][0];
  }

  // ===== MÉTODOS DE ALMACENAMIENTO =====

  private async getRecords(): Promise<LearningRecord[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async saveRecord(record: LearningRecord): Promise<void> {
    const records = await this.getRecords();
    records.push(record);
    
    // Mantener solo los últimos 1000 registros
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
    
    await this.saveRecords(records);
  }

  private async saveRecords(records: LearningRecord[]): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
    } catch (error) {
      console.error('Error guardando registros de aprendizaje:', error);
    }
  }

  private async getDynamicPatterns(): Promise<Record<string, DynamicPattern>> {
    try {
      const stored = localStorage.getItem(this.patternsKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private async saveDynamicPatterns(patterns: Record<string, DynamicPattern>): Promise<void> {
    try {
      localStorage.setItem(this.patternsKey, JSON.stringify(patterns));
    } catch (error) {
      console.error('Error guardando patrones dinámicos:', error);
    }
  }

  private async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      localStorage.setItem(this.metricsKey, JSON.stringify(metrics));
    } catch (error) {
      console.error('Error guardando métricas:', error);
    }
  }

  private async getErrorPatterns(): Promise<ErrorPattern[]> {
    // Implementación futura para obtener patrones de error
    return [];
  }

  private async saveOptimizedStrategy(insurer: string, strategy: any): Promise<void> {
    try {
      const key = `optimized_strategy_${insurer}`;
      localStorage.setItem(key, JSON.stringify(strategy));
    } catch (error) {
      console.error('Error guardando estrategia optimizada:', error);
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private detectDocumentType(fileName: string): string {
    const name = fileName.toLowerCase();
    
    if (name.includes('poliza') || name.includes('policy')) return 'policy';
    if (name.includes('certificado') || name.includes('certificate')) return 'certificate';
    if (name.includes('endoso') || name.includes('endorsement')) return 'endorsement';
    if (name.includes('anexo') || name.includes('addendum')) return 'addendum';
    
    return 'unknown';
  }

  // ===== API PÚBLICA =====

  async getHistoricalData(insurer: string): Promise<LearningRecord[]> {
    const records = await this.getRecords();
    return records.filter(r => r.insurer === insurer);
  }

  async exportLearningData(): Promise<string> {
    const data = {
      records: await this.getRecords(),
      patterns: await this.getDynamicPatterns(),
      metrics: await this.getPerformanceMetrics(),
      exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  async importLearningData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.records) await this.saveRecords(data.records);
      if (data.patterns) await this.saveDynamicPatterns(data.patterns);
      if (data.metrics) await this.saveMetrics(data.metrics);
      
    } catch (error) {
      throw new Error(`Error importando datos: ${(error as Error).message}`);
    }
  }

  async clearLearningData(): Promise<void> {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.patternsKey);
    localStorage.removeItem(this.metricsKey);
  }
}

// Instancia singleton
export const learningEngine = new LearningEngine();
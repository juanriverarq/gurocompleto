import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, TextInput, Textarea, Alert, Progress } from 'flowbite-react';
import { IconEdit, IconCheck, IconAlertTriangle, IconInfoCircle, IconTrendingUp } from '@tabler/icons-react';
import type { ProcessedPdfData, ConfidenceMetrics } from '../../services/advancedPdfProcessor';
import { learningEngine } from '../../services/learningEngine';

interface PdfExtractionResultsProps {
  extractionResult: ProcessedPdfData;
  onCorrection?: (correctedData: ProcessedPdfData) => void;
  onAccept?: (data: ProcessedPdfData) => void;
  showLearningMetrics?: boolean;
}

const PdfExtractionResults: React.FC<PdfExtractionResultsProps> = ({
  extractionResult,
  onCorrection,
  onAccept,
  showLearningMetrics = true
}) => {
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctedData, setCorrectedData] = useState<ProcessedPdfData>(extractionResult);
  const [userFeedback, setUserFeedback] = useState({
    rating: 3 as 1 | 2 | 3 | 4 | 5,
    comments: '',
    mostAccurateFields: [] as string[],
    leastAccurateFields: [] as string[]
  });
  const [learningMetrics, setLearningMetrics] = useState<any>(null);

  useEffect(() => {
    if (showLearningMetrics) {
      loadLearningMetrics();
    }
  }, [showLearningMetrics, extractionResult.metadata?.detectedInsurer]);

  const loadLearningMetrics = async () => {
    try {
      const metrics = await learningEngine.getPerformanceMetrics();
      const recommendations = await learningEngine.getRecommendations(
        extractionResult.metadata?.detectedInsurer
      );
      setLearningMetrics({ metrics, recommendations });
    } catch (error) {
      console.warn('Error cargando métricas de aprendizaje:', error);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 95) return 'success';
    if (confidence >= 85) return 'info';
    if (confidence >= 70) return 'warning';
    if (confidence >= 50) return 'failure';
    return 'gray';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 95) return 'Excelente';
    if (confidence >= 85) return 'Alta';
    if (confidence >= 70) return 'Media';
    if (confidence >= 50) return 'Baja';
    return 'Crítica';
  };

  const handleFieldChange = (field: keyof ProcessedPdfData, value: string) => {
    setCorrectedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveCorrection = async () => {
    try {
      // Registrar corrección en el motor de aprendizaje
      const recordId = await learningEngine.recordExtraction(
        extractionResult,
        extractionResult.metadata?.fileName || 'unknown.pdf',
        extractionResult.metadata?.fileSize || 0,
        extractionResult.metadata?.detectedInsurer || 'unknown',
        extractionResult.method,
        extractionResult.confidence.overall,
        extractionResult.metadata?.processingTime || 0
      );

      await learningEngine.recordCorrection(recordId, correctedData, userFeedback);

      // Notificar al componente padre
      onCorrection?.(correctedData);
      
      setShowCorrectionModal(false);
      
      // Recargar métricas
      await loadLearningMetrics();
      
    } catch (error) {
      console.error('Error guardando corrección:', error);
    }
  };

  const renderConfidenceMetrics = (confidence: ConfidenceMetrics) => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{confidence.overall.toFixed(0)}%</div>
        <div className="text-sm text-gray-600">General</div>
        <Progress progress={confidence.overall} color={getConfidenceColor(confidence.overall)} size="sm" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">{confidence.extraction.toFixed(0)}%</div>
        <div className="text-xs text-gray-600">Extracción</div>
        <Progress progress={confidence.extraction} color="blue" size="sm" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">{confidence.validation.toFixed(0)}%</div>
        <div className="text-xs text-gray-600">Validación</div>
        <Progress progress={confidence.validation} color="green" size="sm" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">{confidence.consistency.toFixed(0)}%</div>
        <div className="text-xs text-gray-600">Consistencia</div>
        <Progress progress={confidence.consistency} color="purple" size="sm" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">{confidence.historical.toFixed(0)}%</div>
        <div className="text-xs text-gray-600">Histórica</div>
        <Progress progress={confidence.historical} color="yellow" size="sm" />
      </div>
    </div>
  );

  const renderExtractionField = (label: string, field: keyof ProcessedPdfData, value: string) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="font-medium text-gray-700 w-1/3">{label}:</span>
      <span className="text-gray-900 w-2/3 text-right">{value || '-'}</span>
    </div>
  );

  const renderCorrectionField = (label: string, field: keyof ProcessedPdfData, value: string) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <TextInput
        value={value || ''}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        placeholder={`Ingrese ${label.toLowerCase()}`}
      />
    </div>
  );

  return (
    <>
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Resultados de Extracción PDF
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge color={getConfidenceColor(extractionResult.confidence.overall)}>
                {getConfidenceLabel(extractionResult.confidence.overall)}
              </Badge>
              <span className="text-sm text-gray-500">
                Método: {extractionResult.method}
              </span>
              {extractionResult.metadata?.processingTime && (
                <span className="text-sm text-gray-500">
                  {(extractionResult.metadata.processingTime / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="gray"
              onClick={() => setShowCorrectionModal(true)}
            >
              <IconEdit className="w-4 h-4 mr-2" />
              Corregir
            </Button>
            <Button
              size="sm"
              color="blue"
              onClick={() => onAccept?.(extractionResult)}
            >
              <IconCheck className="w-4 h-4 mr-2" />
              Aceptar
            </Button>
          </div>
        </div>

        {/* Métricas de confianza */}
        {renderConfidenceMetrics(extractionResult.confidence)}

        {/* Alertas y errores */}
        {extractionResult.errors.length > 0 && (
          <Alert color="warning" className="mb-4">
            <IconAlertTriangle className="w-4 h-4" />
            <span className="ml-2">
              <strong>Advertencias:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {extractionResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </span>
          </Alert>
        )}

        {/* Datos extraídos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Información de la Póliza</h4>
            {renderExtractionField('Número de Póliza', 'numeroPoliza', extractionResult.numeroPoliza)}
            {renderExtractionField('Aseguradora', 'aseguradora', extractionResult.aseguradora)}
            {renderExtractionField('Ramo', 'ramo', extractionResult.ramo)}
            {renderExtractionField('Fecha Expedición', 'fechaExpedicion', extractionResult.fechaExpedicion)}
            {renderExtractionField('Fecha Inicio', 'fechaInicio', extractionResult.fechaInicio)}
            {renderExtractionField('Fecha Fin', 'fechaFin', extractionResult.fechaFin)}
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Información del Cliente</h4>
            {renderExtractionField('Nombre', 'clienteNombre', extractionResult.clienteNombre)}
            {renderExtractionField('Apellido', 'clienteApellido', extractionResult.clienteApellido)}
            {renderExtractionField('Cédula', 'clienteCedula', extractionResult.clienteCedula)}
            {renderExtractionField('Teléfono', 'clienteTelefono', extractionResult.clienteTelefono)}
            {renderExtractionField('Email', 'clienteEmail', extractionResult.clienteEmail)}
            {renderExtractionField('Dirección', 'clienteDireccion', extractionResult.clienteDireccion)}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-gray-800 mb-3">Información Financiera</h4>
          <div className="grid grid-cols-3 gap-4">
            {renderExtractionField('Prima Neta', 'primaNeta', extractionResult.primaNeta)}
            {renderExtractionField('IVA', 'iva', extractionResult.iva)}
            {renderExtractionField('Total', 'total', extractionResult.total)}
          </div>
        </div>

        {/* Métricas de aprendizaje */}
        {showLearningMetrics && learningMetrics && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
              <IconTrendingUp className="w-4 h-4 mr-2" />
              Métricas de Aprendizaje
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {learningMetrics.metrics.successRate.toFixed(1)}%
                </div>
                <div className="text-gray-600">Tasa de Éxito</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {learningMetrics.metrics.totalExtractions}
                </div>
                <div className="text-gray-600">Documentos Procesados</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {learningMetrics.metrics.averageConfidence.toFixed(0)}%
                </div>
                <div className="text-gray-600">Confianza Promedio</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {(learningMetrics.metrics.averageProcessingTime / 1000).toFixed(1)}s
                </div>
                <div className="text-gray-600">Tiempo Promedio</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de corrección */}
      <Modal show={showCorrectionModal} onClose={() => setShowCorrectionModal(false)} size="4xl">
        <Modal.Header>Corregir Datos Extraídos</Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Información del documento */}
            <Alert color="info">
              <IconInfoCircle className="w-4 h-4" />
              <span className="ml-2">
                Corrige los datos incorrectos. El sistema aprenderá de tus correcciones para mejorar futuras extracciones.
              </span>
            </Alert>

            {/* Formulario de corrección */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-800 mb-4">Información de la Póliza</h4>
                {renderCorrectionField('Número de Póliza', 'numeroPoliza', correctedData.numeroPoliza)}
                {renderCorrectionField('Aseguradora', 'aseguradora', correctedData.aseguradora)}
                {renderCorrectionField('Ramo', 'ramo', correctedData.ramo)}
                {renderCorrectionField('Fecha Expedición', 'fechaExpedicion', correctedData.fechaExpedicion)}
                {renderCorrectionField('Fecha Inicio', 'fechaInicio', correctedData.fechaInicio)}
                {renderCorrectionField('Fecha Fin', 'fechaFin', correctedData.fechaFin)}
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-4">Información del Cliente</h4>
                {renderCorrectionField('Nombre', 'clienteNombre', correctedData.clienteNombre)}
                {renderCorrectionField('Apellido', 'clienteApellido', correctedData.clienteApellido)}
                {renderCorrectionField('Cédula', 'clienteCedula', correctedData.clienteCedula)}
                {renderCorrectionField('Teléfono', 'clienteTelefono', correctedData.clienteTelefono)}
                {renderCorrectionField('Email', 'clienteEmail', correctedData.clienteEmail)}
                {renderCorrectionField('Dirección', 'clienteDireccion', correctedData.clienteDireccion)}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-4">Información Financiera</h4>
              <div className="grid grid-cols-3 gap-4">
                {renderCorrectionField('Prima Neta', 'primaNeta', correctedData.primaNeta)}
                {renderCorrectionField('IVA', 'iva', correctedData.iva)}
                {renderCorrectionField('Total', 'total', correctedData.total)}
              </div>
            </div>

            {/* Feedback del usuario */}
            <div className="pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4">Feedback (Opcional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calificación general (1-5)
                  </label>
                  <select
                    value={userFeedback.rating}
                    onChange={(e) => setUserFeedback(prev => ({ ...prev, rating: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value={1}>1 - Muy malo</option>
                    <option value={2}>2 - Malo</option>
                    <option value={3}>3 - Regular</option>
                    <option value={4}>4 - Bueno</option>
                    <option value={5}>5 - Excelente</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comentarios
                  </label>
                  <Textarea
                    value={userFeedback.comments}
                    onChange={(e) => setUserFeedback(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Comentarios sobre la extracción..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCorrectionModal(false)}>
            Cancelar
          </Button>
          <Button color="blue" onClick={handleSaveCorrection}>
            Guardar Corrección
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Componente para mostrar métricas de rendimiento
export const PdfPerformanceMetrics: React.FC<{ insurer?: string }> = ({ insurer }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [insurer]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const performanceMetrics = await learningEngine.getPerformanceMetrics();
      const recommendations = await learningEngine.getRecommendations(insurer);
      const report = await learningEngine.generateLearningReport();
      
      setMetrics({
        performance: performanceMetrics,
        recommendations,
        report
      });
    } catch (error) {
      console.error('Error cargando métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando métricas...</p>
        </div>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          No hay métricas disponibles
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas generales */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Rendimiento del Sistema
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metrics.performance.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Tasa de Éxito</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {metrics.performance.totalExtractions}
            </div>
            <div className="text-sm text-gray-600">Total Procesados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {metrics.performance.averageConfidence.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Confianza Promedio</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {(metrics.performance.averageProcessingTime / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">Tiempo Promedio</div>
          </div>
        </div>
      </Card>

      {/* Errores más frecuentes */}
      {metrics.report.topErrors.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Campos con Más Errores
          </h3>
          <div className="space-y-2">
            {metrics.report.topErrors.slice(0, 5).map((error: any, index: number) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="font-medium">{error.field}</span>
                <Badge color="failure">{error.count} errores</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recomendaciones */}
      {metrics.recommendations.improvements.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recomendaciones de Mejora
          </h3>
          <div className="space-y-2">
            {metrics.recommendations.improvements.map((rec: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <IconInfoCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PdfExtractionResults;
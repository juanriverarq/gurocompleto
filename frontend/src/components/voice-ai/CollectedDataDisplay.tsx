import React from 'react';
import { Badge } from '../shadcn-ui/Default-Ui/badge';
import { Label } from '../shadcn-ui/Default-Ui/label';
import { Icon } from '@iconify/react';

interface CollectedDataItem {
  value: any;
  confidence?: number;
  source?: string;
  pattern_used?: string;
}

interface CollectedDataDisplayProps {
  collectedData: Record<string, CollectedDataItem>;
  className?: string;
}

const CollectedDataDisplay: React.FC<CollectedDataDisplayProps> = ({
  collectedData,
  className = ''
}) => {
  if (!collectedData || Object.keys(collectedData).length === 0) {
    return (
      <div className={`text-center py-4 text-gray-500 dark:text-gray-400 ${className}`}>
        <Icon icon="solar:database-outline" className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No se recolectaron datos en esta llamada</p>
      </div>
    );
  }

  const getFieldIcon = (fieldName: string) => {
    const name = fieldName.toLowerCase();
    if (name.includes('email')) return 'solar:letter-bold';
    if (name.includes('phone') || name.includes('telefono')) return 'solar:phone-bold';
    if (name.includes('document') || name.includes('cedula')) return 'solar:card-bold';
    if (name.includes('address') || name.includes('direccion')) return 'solar:map-point-bold';
    if (name.includes('name') || name.includes('nombre')) return 'solar:user-bold';
    if (name.includes('age') || name.includes('edad')) return 'solar:calendar-bold';
    if (name.includes('date') || name.includes('fecha')) return 'solar:calendar-date-bold';
    if (name.includes('amount') || name.includes('monto')) return 'solar:dollar-bold';
    return 'solar:document-text-bold';
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-600';
    if (confidence >= 0.8) return 'bg-green-100 text-green-700';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return 'N/A';
    if (confidence >= 0.8) return 'Alta';
    if (confidence >= 0.6) return 'Media';
    return 'Baja';
  };

  const formatFieldName = (fieldName: string) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon icon="solar:database-bold" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <Label className="font-medium text-gray-900 dark:text-white">
          Datos Recolectados ({Object.keys(collectedData).length})
        </Label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(collectedData).map(([fieldName, data]) => (
          <div key={fieldName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon 
                  icon={getFieldIcon(fieldName)} 
                  className="w-4 h-4 text-blue-600 dark:text-blue-400" 
                />
                <Label className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatFieldName(fieldName)}
                </Label>
              </div>
              {data.confidence !== undefined && (
                <Badge className={`text-xs ${getConfidenceColor(data.confidence)}`}>
                  {getConfidenceLabel(data.confidence)}
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatValue(data.value)}
                </p>
              </div>
              
              {(data.source || data.pattern_used) && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {data.source && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:info-circle-outline" className="w-3 h-3" />
                      Fuente: {data.source}
                    </span>
                  )}
                  {data.pattern_used && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:code-outline" className="w-3 h-3" />
                      Patrón personalizado
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Resumen de confianza */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon icon="solar:chart-square-bold" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <Label className="text-xs font-medium text-blue-800 dark:text-blue-200">
            Resumen de Calidad
          </Label>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {Object.values(collectedData).filter(d => (d.confidence || 0) >= 0.8).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Alta confianza</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {Object.values(collectedData).filter(d => (d.confidence || 0) >= 0.6 && (d.confidence || 0) < 0.8).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Media confianza</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {Object.values(collectedData).filter(d => (d.confidence || 0) < 0.6).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Baja confianza</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectedDataDisplay;
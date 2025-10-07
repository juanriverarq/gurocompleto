import React from 'react';
import { Brain, FileText, AlertCircle, XCircle } from 'lucide-react';

interface ProcessingStatusProps {
  status: string;
  confidence: number;
  errors: string[];
  processingMethod?: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ 
  status, 
  confidence, 
  errors, 
  processingMethod = 'none' 
}) => {
  const getStatusIcon = () => {
    switch (processingMethod) {
      case 'deepseek-ai':
        return <Brain className="w-4 h-4 text-blue-500" />;
      case 'openai-ai':
        return <Brain className="w-4 h-4 text-green-500" />;
      case 'patterns-fallback':
        return <FileText className="w-4 h-4 text-orange-500" />;
      case 'empty-result':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    if (status === 'completed') return 'text-green-600';
    if (status === 'processing') return 'text-blue-600';
    if (status === 'error') return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusText = () => {
    if (status === 'completed') return 'Completado';
    if (status === 'processing') return 'Procesando...';
    if (status === 'error') return 'Error';
    return 'Inactivo';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Estado del Procesamiento</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingStatus; 
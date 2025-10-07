import React, { useState, useEffect } from 'react';
import { Button, Modal, Badge, Checkbox } from 'flowbite-react';
import { Icon } from '@iconify/react';

interface ColumnOption {
  key: string;
  label: string;
  description: string;
  icon: string;
  defaultVisible: boolean;
}

interface ColumnsCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
}

const AVAILABLE_COLUMNS: ColumnOption[] = [
  {
    key: 'numero_poliza',
    label: 'Número',
    description: 'Número de póliza',
    icon: 'solar:document-text-bold',
    defaultVisible: true
  },
  {
    key: 'cliente',
    label: 'Cliente',
    description: 'Nombre y documento',
    icon: 'solar:user-bold',
    defaultVisible: true
  },
  {
    key: 'aseguradora',
    label: 'Aseguradora',
    description: 'Compañía aseguradora',
    icon: 'solar:buildings-bold',
    defaultVisible: true
  },
  {
    key: 'ramo',
    label: 'Ramo',
    description: 'Tipo de seguro',
    icon: 'solar:shield-check-bold',
    defaultVisible: true
  },
  {
    key: 'estado',
    label: 'Estado',
    description: 'Estado actual',
    icon: 'solar:check-circle-bold',
    defaultVisible: true
  },
  {
    key: 'prima_neta',
    label: 'Prima Neta',
    description: 'Valor prima',
    icon: 'solar:dollar-bold',
    defaultVisible: true
  },
  {
    key: 'vencimiento',
    label: 'Vencimiento',
    description: 'Fecha de vencimiento',
    icon: 'solar:calendar-bold',
    defaultVisible: false
  },
  {
    key: 'vendedor',
    label: 'Vendedor',
    description: 'Agente vendedor',
    icon: 'solar:user-id-bold',
    defaultVisible: false
  },
  {
    key: 'sede',
    label: 'Sede',
    description: 'Oficina de origen',
    icon: 'solar:home-bold',
    defaultVisible: false
  },
  {
    key: 'forma_pago',
    label: 'Forma de Pago',
    description: 'Método de pago',
    icon: 'solar:card-bold',
    defaultVisible: false
  }
];

const ColumnsCustomizationModal: React.FC<ColumnsCustomizationModalProps> = ({
  isOpen,
  onClose,
  visibleColumns,
  onVisibleColumnsChange
}) => {
  const [localColumns, setLocalColumns] = useState<string[]>(visibleColumns);

  // Sincronizar con props cuando cambien
  useEffect(() => {
    setLocalColumns(visibleColumns);
  }, [visibleColumns]);

  const handleColumnToggle = (columnKey: string) => {
    setLocalColumns(prev => {
      const isCurrentlyVisible = prev.includes(columnKey);
      
      if (isCurrentlyVisible) {
        // Remover columna (mínimo 1 columna)
        if (prev.length <= 1) return prev;
        return prev.filter(col => col !== columnKey);
      } else {
        // Agregar columna solo si no excede el máximo
        if (prev.length >= 6) {
          return prev; // No agregar si ya hay 6
        }
        return [...prev, columnKey];
      }
    });
  };

  const applyChanges = () => {
    onVisibleColumnsChange(localColumns);
    onClose();
  };

  const resetToDefault = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.key);
    setLocalColumns(defaultColumns);
  };

  const selectAll = () => {
    const allColumns = AVAILABLE_COLUMNS.slice(0, 6).map(col => col.key);
    setLocalColumns(allColumns);
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="xl" popup>
      <Modal.Header className="px-6 pb-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Icon icon="solar:settings-bold" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Personalizar Columnas
              </h3>
              <p className="text-xs text-gray-500">
                Selecciona las columnas que deseas ver en la tabla
              </p>
            </div>
          </div>
          <Badge color="info" size="sm" className="ml-3">
            {localColumns.length}/6
          </Badge>
        </div>
      </Modal.Header>
      
      <Modal.Body className="px-6 pb-6">
        <div className="space-y-4">
          {/* Controles rápidos */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
                Máximo 6 columnas
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="xs"
                  color="light"
                  onClick={resetToDefault}
                  className="text-xs px-2 py-1"
                >
                  <Icon icon="solar:refresh-bold" className="w-3 h-3" />
                </Button>
                <Button
                  size="xs"
                  color="blue"
                  onClick={selectAll}
                  disabled={localColumns.length === 6}
                  className="text-xs px-2 py-1"
                >
                  <Icon icon="solar:check-square-bold" className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AVAILABLE_COLUMNS.map((column) => {
              const isVisible = localColumns.includes(column.key);
              const canToggle = !isVisible || localColumns.length > 1;
              const canAdd = isVisible || localColumns.length < 6;
              const isDisabled = !canToggle || !canAdd;
              
              return (
                <div
                  key={column.key}
                  className={`relative p-3 border-2 rounded-lg transition-all duration-200 cursor-pointer ${
                    isVisible 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && handleColumnToggle(column.key)}
                >
                  {/* Badge de posición si está visible */}
                  {isVisible && (
                    <div className="absolute -top-2 -right-2">
                      <Badge color="blue" size="sm" className="font-bold">
                        {localColumns.indexOf(column.key) + 1}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <div className={`p-1.5 rounded-md ${
                        isVisible 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                      }`}>
                        <Icon icon={column.icon} className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-sm font-semibold ${
                          isVisible 
                            ? 'text-blue-900 dark:text-blue-200' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {column.label}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {column.description}
                        </p>
                        {column.defaultVisible && (
                          <Badge color="gray" size="xs" className="mt-1">
                            Recomendada
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-2">
                      <Checkbox
                        checked={isVisible}
                        onChange={() => !isDisabled && handleColumnToggle(column.key)}
                        disabled={isDisabled}
                        className="scale-110"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vista previa del orden */}
          {localColumns.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Icon icon="solar:eye-bold" className="w-4 h-4" />
                Vista Previa del Orden
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {localColumns.map((columnKey, index) => {
                  const column = AVAILABLE_COLUMNS.find(col => col.key === columnKey);
                  return (
                    <div
                      key={columnKey}
                      className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border"
                    >
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                        {index + 1}
                      </span>
                      <Icon icon={column?.icon || 'solar:question-bold'} className="w-4 h-4" />
                      <span className="text-sm font-medium">{column?.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={applyChanges}
              className="flex-1"
              color="primary"
              disabled={localColumns.length === 0}
            >
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
              Aplicar Cambios
            </Button>
            <Button
              onClick={onClose}
              className="flex-1"
              color="light"
            >
              <Icon icon="solar:close-circle-bold" className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ColumnsCustomizationModal; 
import React, { useState, useEffect } from 'react';
import { Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';

interface DashboardConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDashboards: Array<{
    id: string;
    name: string;
    icon: string;
    enabled: boolean;
  }>;
  onSave: (enabledDashboards: string[]) => void;
}

const DashboardConfigModal: React.FC<DashboardConfigModalProps> = ({
  isOpen,
  onClose,
  availableDashboards,
  onSave
}) => {
  const [localDashboards, setLocalDashboards] = useState(availableDashboards);

  // Sincronizar con los cambios externos
  useEffect(() => {
    setLocalDashboards(availableDashboards);
  }, [availableDashboards]);

  const toggleDashboard = (id: string) => {
    setLocalDashboards(prev =>
      prev.map(dashboard =>
        dashboard.id === id
          ? { ...dashboard, enabled: !dashboard.enabled }
          : dashboard
      )
    );
  };

  const handleSave = () => {
    const enabledIds = localDashboards
      .filter(dashboard => dashboard.enabled)
      .map(dashboard => dashboard.id);
    onSave(enabledIds);
    onClose();
  };

  const handleCancel = () => {
    setLocalDashboards(availableDashboards);
    onClose();
  };

  const enabledCount = localDashboards.filter(d => d.enabled).length;
  const totalCount = localDashboards.length;

  return (
    <Modal show={isOpen} onClose={handleCancel} size="lg">
      <Modal.Header>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Icon icon="solar:settings-bold-duotone" height={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurar Dashboards
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {enabledCount} de {totalCount} dashboards activos
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Icon icon="solar:info-circle-bold" height={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Personaliza tu vista</p>
              <p className="text-blue-700 dark:text-blue-300">
                Selecciona qué dashboards deseas mostrar en las pestañas. Los cambios se guardarán automáticamente.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            {localDashboards.map((dashboard, index) => (
              <div
                key={dashboard.id}
                className={`group relative flex items-center justify-between p-4 border-2 rounded-xl transition-all duration-200 ${
                  dashboard.enabled
                    ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-2.5 rounded-lg transition-colors ${
                    dashboard.enabled
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon
                      icon={dashboard.icon}
                      height={24}
                      className={`transition-colors ${
                        dashboard.enabled
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold transition-colors ${
                        dashboard.enabled
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {dashboard.name}
                      </span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {dashboard.enabled ? 'Visible en pestañas' : 'Oculto'}
                    </p>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dashboard.enabled}
                    onChange={() => toggleDashboard(dashboard.id)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 shadow-inner"></div>
                </label>
              </div>
            ))}
          </div>

          {enabledCount === 0 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-start gap-3">
                <Icon icon="solar:danger-triangle-bold" height={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    ¡Atención!
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Debes seleccionar al menos un dashboard para poder visualizar información.
                  </p>
                </div>
              </div>
            </div>
          )}

          {enabledCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Icon icon="solar:check-circle-bold" height={18} className="text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200">
                {enabledCount === 1
                  ? '1 dashboard seleccionado'
                  : `${enabledCount} dashboards seleccionados`}
              </span>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
          <button
            onClick={handleCancel}
            className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500 dark:focus:ring-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={enabledCount === 0}
            className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold" height={18} />
              Guardar Cambios
            </span>
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DashboardConfigModal;

import React, { useState } from 'react';
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

  return (
    <Modal show={isOpen} onClose={handleCancel}>
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:settings-outline" height={24} />
          <span>Configurar Dashboards</span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Selecciona qué dashboards deseas mostrar en las pestañas:
          </p>
          
          <div className="space-y-3">
            {localDashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon icon={dashboard.icon} height={20} className="text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {dashboard.name}
                  </span>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dashboard.enabled}
                    onChange={() => toggleDashboard(dashboard.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>

          {localDashboards.filter(d => d.enabled).length === 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Icon icon="solar:warning-outline" height={16} className="text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  Debes seleccionar al menos un dashboard
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex gap-3 ml-auto">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={localDashboards.filter(d => d.enabled).length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar Cambios
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DashboardConfigModal;

import React, { useState, useEffect } from 'react';
import { Tabs } from "flowbite-react";
import { Icon } from "@iconify/react";
import Dashboard3 from '../dashboard/Dashboard3';
import VoiceAIDashboard from '../voice-ai/VoiceAIDashboard';
import ElectronicInvoicingDashboard from '../dashboards/ElectronicInvoicingDashboard';
import ConfiguracionMasiva from '../saas/configuracion-masiva/ConfiguracionMasiva';
import Plantillas from '../apps/marketing/plantillas/Plantillas';
import CarteraClientes from '../apps/cartera/CarteraClientes';
import DashboardConfigModal from '../../components/modals/DashboardConfigModal';
import { useWelcomeModal } from '../../hooks/useWelcomeModal';
import type { TutorialSection } from '../../components/modals/OnboardingTutorialModal';
import OnboardingTutorialModal from '../../components/modals/OnboardingTutorialModal';
// import { getAuth } from 'firebase/auth';

interface DashboardConfig {
  id: string;
  name: string;
  icon: string;
  component: React.ComponentType;
  enabled: boolean;
}

const CombinedDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  
  // Hook para la modal de bienvenida
  const { showWelcomeModal, closeWelcomeModal, userName } = useWelcomeModal(true);

  // Config del tutorial (según indicaciones del usuario)
  const tutorialVideoId = 'abc123XYZ';
  const tutorialSections: TutorialSection[] = [
    { label: 'Introducción', seconds: '00:00' },
    { label: 'Personaliza tus formularios', seconds: '01:36' },
    { label: 'Activa enlaces', seconds: '02:22' },
    { label: 'Activación de ramos', seconds: '04:06' },
    { label: 'Vista del cliente', seconds: '07:09' },
    { label: 'Notificaciones', seconds: '07:57' },
    { label: 'Estadísticas', seconds: '10:00' },
    { label: 'Recursos', seconds: '11:28' },
  ];
  
  // Available dashboards configuration
  const [availableDashboards, setAvailableDashboards] = useState<DashboardConfig[]>([
    {
      id: 'dashboard',
      name: 'Dashboard Principal',
      icon: 'solar:graph-linear',
      component: Dashboard3,
      enabled: true
    },
    {
      id: 'voice-ai',
      name: 'Call Center IA',
      icon: 'solar:phone-calling-rounded-outline',
      component: VoiceAIDashboard,
      enabled: false
    },
    {
      id: 'whatsapp',
      name: 'Dashboard WhatsApp',
      icon: 'solar:chat-round-dots-bold-duotone',
      component: ConfiguracionMasiva,
      enabled: false
    },
    {
      id: 'email-marketing',
      name: 'Email Marketing',
      icon: 'solar:letter-bold-duotone',
      component: Plantillas,
      enabled: false
    },
    {
      id: 'cartera',
      name: 'Dashboard Cartera',
      icon: 'solar:wallet-bold-duotone',
      component: CarteraClientes,
      enabled: false
    }
  ]);

  // Load saved configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('dashboardConfig');
    if (savedConfig) {
      try {
        const enabledDashboards = JSON.parse(savedConfig);
        setAvailableDashboards(prev => 
          prev.map(dashboard => ({
            ...dashboard,
            enabled: enabledDashboards.includes(dashboard.id)
          }))
        );
      } catch (error) {
      }
    }
  }, []);

  // Abrir el tutorial con ?tutorial=1
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tutorial') === '1') {
        setTutorialOpen(true);
      }
    } catch {}
  }, []);

  // Si la lógica de bienvenida indica mostrar modal, abrimos el tutorial
  useEffect(() => {
    if (showWelcomeModal) {
      setTutorialOpen(true);
    }
  }, [showWelcomeModal]);
  
  const enabledDashboards = availableDashboards.filter(d => d.enabled);

  const handleConfigClick = () => {
    setIsConfigModalOpen(true);
  };

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force re-render of dashboard components
    window.location.reload();
    
    setIsRefreshing(false);
  };


  const handleSaveDashboardConfig = (enabledDashboardIds: string[]) => {
    // Update state
    setAvailableDashboards(prev => 
      prev.map(dashboard => ({
        ...dashboard,
        enabled: enabledDashboardIds.includes(dashboard.id)
      }))
    );
    
    // Save to localStorage
    localStorage.setItem('dashboardConfig', JSON.stringify(enabledDashboardIds));
    
    // If current active tab is disabled, switch to first enabled
    const newEnabledDashboards = availableDashboards.filter(d => enabledDashboardIds.includes(d.id));
    if (newEnabledDashboards.length > 0 && !enabledDashboardIds.includes(activeTab)) {
      setActiveTab(newEnabledDashboards[0].id);
    }
  };

  // Show loading state if no dashboards are enabled
  if (enabledDashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Icon icon="solar:settings-outline" height={48} className="text-gray-400" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No hay dashboards configurados
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Configura qué dashboards deseas mostrar
          </p>
          <button
            onClick={handleConfigClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Configurar Dashboards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs con acciones en la misma línea */}
      <div className="relative mb-4 overflow-hidden">
        <div className="absolute right-0 top-0 flex gap-2 z-10 xl:z-[20]">
          <button
            onClick={handleConfigClick}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            title="Configurar Dashboards"
          >
            <Icon icon="solar:settings-outline" height={18} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refrescar Dashboards"
          >
            <Icon 
              icon={isRefreshing ? "solar:loading-outline" : "solar:refresh-outline"} 
              height={18} 
              className={`text-gray-600 dark:text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
          </button>
          <button
            onClick={() => setTutorialOpen(true)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            title="Ver tutorial"
          >
            <Icon icon="solar:play-circle-bold" height={18} className="text-blue-600 dark:text-blue-400" />
          </button>
        </div>
        <div className="[&_[role=tablist]]:pr-24">
          <Tabs aria-label="Combined Tabs" variant="underline" onActiveTabChange={(tab) => setActiveTab(enabledDashboards[Number(tab)]?.id || enabledDashboards[0]?.id)}>
            {enabledDashboards.map((dashboard, index) => {
              const Component = dashboard.component;
              const isActive = activeTab === dashboard.id;
              
              return (
                <Tabs.Item
                  key={dashboard.id}
                  active={index === 0}
                  title={dashboard.name}
                  icon={() => <Icon icon={dashboard.icon} height={20} />}
                >
                  {/* Solo renderizar el componente si el tab está activo */}
                  {isActive && <Component />}
                  {!isActive && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Icon icon="solar:loading-outline" height={48} className="text-gray-400 animate-spin mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-gray-400">Cargando {dashboard.name}...</p>
                      </div>
                    </div>
                  )}
                </Tabs.Item>
              );
            })}
          </Tabs>
        </div>
      </div>

      {/* Configuration Modal */}
      <DashboardConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        availableDashboards={availableDashboards.map(d => ({
          id: d.id,
          name: d.name,
          icon: d.icon,
          enabled: d.enabled
        }))}
        onSave={handleSaveDashboardConfig}
      />

      {/* Tutorial Onboarding Modal (reemplaza a la WelcomeModal) */}
      <OnboardingTutorialModal
        isOpen={tutorialOpen || showWelcomeModal}
        onClose={() => {
          setTutorialOpen(false);
          closeWelcomeModal();
        }}
        videoId={tutorialVideoId}
        title="Tutorial: Guro"
        subtitle="Aprende a utilizar Guro en menos de 15 minutos"
        sections={tutorialSections}
      />
    </div>
  );
};

export default CombinedDashboard;


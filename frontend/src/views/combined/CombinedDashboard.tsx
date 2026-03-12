import React, { useState, useEffect } from 'react';
import { Tabs } from "flowbite-react";
import { Icon } from "@iconify/react";
import Dashboard3 from '../dashboard/Dashboard3';
import VoiceAIDashboard from '../voice-ai/VoiceAIDashboard';
import ConfiguracionMasiva from '../saas/configuracion-masiva/ConfiguracionMasiva';
import Plantillas from '../apps/marketing/plantillas/Plantillas';
import CarteraClientes from '../apps/cartera/CarteraClientes';
import DashboardConfigModal from '../../components/modals/DashboardConfigModal';
import { useWelcomeModal } from '../../hooks/useWelcomeModal';
import type { TutorialSection } from '../../components/modals/OnboardingTutorialModal';
import OnboardingTutorialModal from '../../components/modals/OnboardingTutorialModal';

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
  const { showWelcomeModal, closeWelcomeModal } = useWelcomeModal(true);
  
  // La verificación de datos incompletos ahora está en UnifiedProtectedFullLayout
  // Ya no necesitamos duplicar esa lógica aquí
  
  // Verificar si es primera vez (solo para tutoriales, no para onboarding obligatorio)
  const isFirstTime = !localStorage.getItem('guro_onboarding_completed');

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

  // El modal de onboarding obligatorio ahora está en UnifiedProtectedFullLayout
  // Aquí solo manejamos el tutorial de bienvenida
  useEffect(() => {
    if (showWelcomeModal && isFirstTime) {
      // Solo mostrar tutorial si el onboarding no está completado
      setTutorialOpen(true);
    }
  }, [showWelcomeModal, isFirstTime]);
  
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
      <div className="flex flex-col items-center justify-center h-64 space-y-4" style={{ fontFamily: "'General Sans', sans-serif" }}>
        <div className="w-14 h-14 rounded-2xl bg-[#573CFF]/10 flex items-center justify-center">
          <Icon icon="solar:settings-outline" height={28} className="text-[#573CFF]" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-[#0d0d0d] mb-1">
            No hay dashboards configurados
          </h3>
          <p className="text-gray-400 text-sm mb-5">
            Configura qué dashboards deseas mostrar
          </p>
          <button
            onClick={handleConfigClick}
            className="px-5 py-2.5 bg-[#0d0d0d] hover:bg-[#573CFF] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Configurar Dashboards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header con acciones */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTutorialOpen(true)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            title="Ver tutorial"
          >
            <Icon icon="solar:play-circle-bold" height={18} className="text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refrescar Dashboards"
          >
            <Icon 
              icon={isRefreshing ? "svg-spinners:ring-resize" : "solar:refresh-outline"} 
              height={18} 
              className={`text-gray-600 dark:text-gray-300`} 
            />
          </button>
          <button
            onClick={handleConfigClick}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            title="Configurar Dashboards"
          >
            <Icon icon="solar:settings-outline" height={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative mb-4 overflow-hidden">
        <div className="[&_[role=tablist]]:pr-24">
          <Tabs aria-label="Combined Tabs" variant="underline" onActiveTabChange={(tab) => setActiveTab(enabledDashboards[Number(tab)]?.id || enabledDashboards[0]?.id)}>
            {enabledDashboards.map((dashboard) => {
              const Component = dashboard.component;
              const isActive = activeTab === dashboard.id;
              
              return (
                <Tabs.Item
                  key={dashboard.id}
                  active={activeTab === dashboard.id}
                  title={dashboard.name}
                  icon={() => <Icon icon={dashboard.icon} height={20} />}
                >
                  {isActive && <Component />}
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

      {/* Tutorial Onboarding Modal (para usuarios que ya completaron onboarding) */}
      <OnboardingTutorialModal
        isOpen={tutorialOpen && !isFirstTime}
        onClose={() => {
          setTutorialOpen(false);
          closeWelcomeModal();
        }}
        videoId={tutorialVideoId}
        title="Tutorial: Guro"
        subtitle="Aprende a utilizar Guro en menos de 15 minutos"
        sections={tutorialSections}
      />

      {/* El modal de onboarding obligatorio ahora está en UnifiedProtectedFullLayout */}
    </div>
  );
};

export default CombinedDashboard;


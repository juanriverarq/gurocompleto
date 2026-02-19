import React, { useState, useEffect } from 'react';
import { Tabs } from "flowbite-react";
import { Icon } from "@iconify/react";
import VoiceAIStats from './components/dashboard/VoiceAIStats';
import CallsChart from './components/dashboard/CallsChart';
import PerformanceChart from './components/dashboard/PerformanceChart';
import AgentsUsageChart from './components/dashboard/AgentsUsageChart';
import CallHistoryWidget from './components/dashboard/CallHistoryWidget';
import AgentsManagementWidget from './components/dashboard/AgentsManagementWidget';

import CampaignsManagementWidget from './components/CampaignsManagementWidget';
import VoiceSettings from './components/VoiceSettings';
import { useLocation, useNavigate } from 'react-router-dom';

const VoiceAIDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Leer pestaña desde query param (?tab=dashboard|calls|agents|campaigns)
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tabParam = params.get('tab');
  const activeTabKey = (tabParam || 'dashboard').toLowerCase();

  // Limpiar el query param una vez leído para evitar re-triggers
  useEffect(() => {
    if (!tabParam) return;
    params.delete('tab');
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleNewCampaignClick = () => {
    setActiveTab('3'); // Cambiar a la pestaña de Gestión de Campañas
    // Trigger para abrir el modal de nueva campaña se manejará desde el componente hijo
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-[30px]">
        {/* Main Tabs Navigation */}
        <div className="col-span-12">
          <div className="p-6 bg-white dark:bg-darkgray rounded-lg">
            <Tabs aria-label="Call center IA" variant="underline" onActiveTabChange={(tab) => setActiveTab(tab.toString())}>
              <Tabs.Item
                active={activeTabKey === 'dashboard'}
                title="Call center IA"
                icon={() => <Icon icon="solar:graph-linear" height={20} />}
              >
                <div className="mt-6 space-y-6">
                  {/* Estadísticas principales */}
                  <div className="grid grid-cols-12 gap-[30px]">
                    <div className="col-span-12">
                      <VoiceAIStats />
                    </div>
                  </div>
                  
                  {/* Gráfico de actividad de llamadas - columna completa */}
                  <div className="grid grid-cols-12 gap-[30px]">
                    <div className="col-span-12">
                      <CallsChart />
                    </div>
                  </div>
                  
                  {/* Gráfico de tasa de éxito - columna completa */}
                  <div className="grid grid-cols-12 gap-[30px]">
                    <div className="col-span-12">
                      <PerformanceChart />
                    </div>
                  </div>
                  
                  {/* Agentes más usados y panel lateral */}
                  <div className="grid grid-cols-12 gap-[30px]">
                    <div className="xl:col-span-8 col-span-12">
                      <AgentsUsageChart />
                    </div>
                    
                    {/* Panel de información adicional */}
                    <div className="xl:col-span-4 col-span-12 space-y-6">
                      {/* Resumen rápido */}
                      <div className="bg-white dark:bg-darkgray rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resumen del Mes</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Estado del sistema:</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Operativo
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Agentes activos:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">Todos</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Período:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">Último mes</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Idioma:</span>
                            <span className="font-semibold text-blue-600">Español (100%)</span>
                          </div>
                        </div>
                      </div>

                      {/* Indicadores de rendimiento */}
                      <div className="bg-white dark:bg-darkgray rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Indicadores Clave</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-800 dark:text-green-200">Tiempo de respuesta</span>
                            </div>
                            <span className="font-semibold text-green-700 dark:text-green-300">Óptimo</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm text-blue-800 dark:text-blue-200">Calidad de audio</span>
                            </div>
                            <span className="font-semibold text-blue-700 dark:text-blue-300">Excelente</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span className="text-sm text-purple-800 dark:text-purple-200">Satisfacción</span>
                            </div>
                            <span className="font-semibold text-purple-700 dark:text-purple-300">Alta</span>
                          </div>
                        </div>
                      </div>

                      {/* (Acciones Rápidas eliminadas por solicitud) */}
                    </div>
                  </div>
                </div>
              </Tabs.Item>

              <Tabs.Item
                active={activeTabKey === 'calls'}
                title="Historial de Llamadas"
                icon={() => <Icon icon="solar:phone-calling-rounded-outline" height={20} />}
              >
                <div className="mt-6">
                  <CallHistoryWidget />
                </div>
              </Tabs.Item>

              <Tabs.Item
                active={activeTabKey === 'agents'}
                title="Gestión de Agentes"
                icon={() => <Icon icon="solar:users-group-rounded-outline" height={20} />}
              >
                <div className="mt-6">
                  <AgentsManagementWidget />
                </div>
              </Tabs.Item>

              <Tabs.Item
                active={activeTabKey === 'campaigns'}
                title="Gestión de Campañas"
                icon={() => <Icon icon="solar:target-outline" height={20} />}
              >
                <div className="mt-6">
                  <CampaignsManagementWidget />
                </div>
              </Tabs.Item>

              <Tabs.Item
                active={activeTabKey === 'settings'}
                title="Configuración"
                icon={() => <Icon icon="solar:settings-outline" height={20} />}
              >
                <div className="mt-6">
                  <VoiceSettings />
                </div>
              </Tabs.Item>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceAIDashboard;

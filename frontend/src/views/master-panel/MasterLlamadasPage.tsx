import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService, { MasterStats } from '../../services/masterPanelService';

const MasterLlamadasPage: React.FC = () => {
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:phone-calling-bold-duotone" className="text-indigo-600" />
            Llamadas de Voz AI
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Estadísticas globales de llamadas automatizadas
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {stats && (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Llamadas</CardTitle>
                <IconifyIcon icon="solar:phone-bold-duotone" className="h-5 w-5 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{stats.llamadas_voz.total.toLocaleString()}</div>
                <p className="text-xs text-gray-500 mt-1">Llamadas realizadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                <IconifyIcon icon="solar:check-circle-bold-duotone" className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.llamadas_voz.completadas.toLocaleString()}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.llamadas_voz.total > 0 
                    ? `${((stats.llamadas_voz.completadas / stats.llamadas_voz.total) * 100).toFixed(1)}% de éxito`
                    : '0% de éxito'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Duración Total</CardTitle>
                <IconifyIcon icon="solar:clock-circle-bold-duotone" className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.llamadas_voz.duracion_minutos.toLocaleString()} min</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.llamadas_voz.completadas > 0 
                    ? `~${(stats.llamadas_voz.duracion_minutos / stats.llamadas_voz.completadas).toFixed(1)} min/llamada`
                    : '0 min/llamada'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
                <IconifyIcon icon="solar:dollar-bold-duotone" className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${stats.llamadas_voz.costo_total_usd.toFixed(2)} USD</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.llamadas_voz.completadas > 0 
                    ? `~$${(stats.llamadas_voz.costo_total_usd / stats.llamadas_voz.completadas).toFixed(3)}/llamada`
                    : '$0/llamada'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Campañas de Voz */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:microphone-3-bold-duotone" className="h-5 w-5 text-purple-600" />
                Campañas de Voz AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
                  <IconifyIcon icon="solar:folder-bold-duotone" className="h-12 w-12 mx-auto text-purple-600 mb-3" />
                  <p className="text-3xl font-bold text-purple-600">{stats.automatizacion.campanas_voz.total}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Campañas</p>
                </div>
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                  <IconifyIcon icon="solar:play-circle-bold-duotone" className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  <p className="text-3xl font-bold text-green-600">{stats.automatizacion.campanas_voz.activas}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Campañas Activas</p>
                </div>
                <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                  <IconifyIcon icon="solar:pause-circle-bold-duotone" className="h-12 w-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-3xl font-bold text-gray-600">{stats.automatizacion.campanas_voz.total - stats.automatizacion.campanas_voz.activas}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Campañas Inactivas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas detalladas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chart-2-bold-duotone" className="h-5 w-5 text-blue-600" />
                  Rendimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">Tasa de Éxito</span>
                      <span className="font-medium">
                        {stats.llamadas_voz.total > 0 
                          ? `${((stats.llamadas_voz.completadas / stats.llamadas_voz.total) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${stats.llamadas_voz.total > 0 ? (stats.llamadas_voz.completadas / stats.llamadas_voz.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {stats.llamadas_voz.completadas > 0 
                            ? (stats.llamadas_voz.duracion_minutos / stats.llamadas_voz.completadas).toFixed(1)
                            : '0'}
                        </p>
                        <p className="text-xs text-gray-500">Min promedio/llamada</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          ${stats.llamadas_voz.duracion_minutos > 0 
                            ? (stats.llamadas_voz.costo_total_usd / stats.llamadas_voz.duracion_minutos).toFixed(4)
                            : '0'}
                        </p>
                        <p className="text-xs text-gray-500">USD/minuto</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:info-circle-bold-duotone" className="h-5 w-5 text-cyan-600" />
                  Información del Servicio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                    <IconifyIcon icon="solar:cpu-bolt-bold-duotone" className="h-6 w-6 text-cyan-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Proveedor</p>
                      <p className="text-sm text-gray-500">ElevenLabs / Vapi AI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <IconifyIcon icon="solar:microphone-bold-duotone" className="h-6 w-6 text-indigo-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Tipo de Voz</p>
                      <p className="text-sm text-gray-500">Voces AI personalizadas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <IconifyIcon icon="solar:shield-check-bold-duotone" className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Estado</p>
                      <p className="text-sm text-gray-500">Servicio activo</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MasterLlamadasPage;

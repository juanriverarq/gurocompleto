import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService, { MasterStats } from '../../services/masterPanelService';

const MasterFinanzasPage: React.FC = () => {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
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
            <IconifyIcon icon="solar:wallet-bold-duotone" className="text-green-600" />
            Finanzas Globales
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Resumen financiero de toda la plataforma
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
                <CardTitle className="text-sm font-medium">Valor Total Primas</CardTitle>
                <IconifyIcon icon="solar:dollar-minimalistic-bold-duotone" className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${stats.polizas.valor_primas_formato}</div>
                <p className="text-xs text-gray-500 mt-1">En pólizas activas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comisiones Totales</CardTitle>
                <IconifyIcon icon="solar:hand-money-bold-duotone" className="h-5 w-5 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">${stats.polizas.valor_comisiones_formato}</div>
                <p className="text-xs text-gray-500 mt-1">Generadas por brokers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo en Wallets</CardTitle>
                <IconifyIcon icon="solar:wallet-bold-duotone" className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${stats.finanzas.saldo_wallets_formato}</div>
                <p className="text-xs text-gray-500 mt-1">{stats.finanzas.wallets_con_saldo} wallets con saldo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suscripciones</CardTitle>
                <IconifyIcon icon="solar:crown-bold-duotone" className="h-5 w-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.finanzas.suscripciones_activas}</div>
                <p className="text-xs text-gray-500 mt-1">de {stats.finanzas.suscripciones_total} totales</p>
              </CardContent>
            </Card>
          </div>

          {/* Detalles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chart-2-bold-duotone" className="h-5 w-5 text-primary" />
                  Resumen de Pólizas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Total Pólizas</span>
                    <span className="font-bold text-lg">{stats.polizas.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-green-700 dark:text-green-400">Pólizas Activas</span>
                    <span className="font-bold text-lg text-green-600">{stats.polizas.activas.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-blue-700 dark:text-blue-400">Valor Primas</span>
                    <span className="font-bold text-lg text-blue-600">{formatCurrency(stats.polizas.valor_primas)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-purple-700 dark:text-purple-400">Comisiones</span>
                    <span className="font-bold text-lg text-purple-600">{formatCurrency(stats.polizas.valor_comisiones)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:wallet-bold-duotone" className="h-5 w-5 text-orange-600" />
                  Wallets y Suscripciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <span className="text-orange-700 dark:text-orange-400">Saldo Total Wallets</span>
                    <span className="font-bold text-lg text-orange-600">${stats.finanzas.saldo_wallets_formato}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Wallets con Saldo</span>
                    <span className="font-bold text-lg">{stats.finanzas.wallets_con_saldo}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <span className="text-yellow-700 dark:text-yellow-400">Suscripciones Activas</span>
                    <span className="font-bold text-lg text-yellow-600">{stats.finanzas.suscripciones_activas}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Total Suscripciones</span>
                    <span className="font-bold text-lg">{stats.finanzas.suscripciones_total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Costo Llamadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:phone-calling-bold-duotone" className="h-5 w-5 text-indigo-600" />
                Costos de Llamadas Voz AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-center">
                  <IconifyIcon icon="solar:phone-bold-duotone" className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
                  <p className="text-2xl font-bold text-indigo-600">{stats.llamadas_voz.total.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total Llamadas</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <IconifyIcon icon="solar:clock-circle-bold-duotone" className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{stats.llamadas_voz.duracion_minutos.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Minutos Totales</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <IconifyIcon icon="solar:dollar-bold-duotone" className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-green-600">${stats.llamadas_voz.costo_total_usd.toFixed(2)} USD</p>
                  <p className="text-sm text-gray-500">Costo Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MasterFinanzasPage;

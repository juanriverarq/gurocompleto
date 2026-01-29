import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService, { MasterStats } from '../../services/masterPanelService';

const MasterCampanasPage: React.FC = () => {
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
            <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="text-green-600" />
            Campañas y Automatización
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Resumen global de campañas de marketing y automatización
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {stats && (
        <>
          {/* Campañas por tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* WhatsApp */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="h-5 w-5 text-green-600" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.automatizacion.campanas_whatsapp.total}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    {stats.automatizacion.campanas_whatsapp.activas} activas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Voz AI */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconifyIcon icon="solar:phone-calling-bold-duotone" className="h-5 w-5 text-purple-600" />
                  Voz AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{stats.automatizacion.campanas_voz.total}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                    {stats.automatizacion.campanas_voz.activas} activas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Email */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconifyIcon icon="solar:letter-bold-duotone" className="h-5 w-5 text-blue-600" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.automatizacion.campanas_email.total}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {stats.automatizacion.campanas_email.activas} activas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Chatbots */}
            <Card className="border-l-4 border-l-cyan-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconifyIcon icon="solar:bot-bold-duotone" className="h-5 w-5 text-cyan-600" />
                  Chatbots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-600">{stats.automatizacion.chatbots.total}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs rounded-full">
                    {stats.automatizacion.chatbots.activos} activos
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Instancias WhatsApp */}
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <IconifyIcon icon="solar:smartphone-2-bold-duotone" className="h-5 w-5 text-emerald-600" />
                  Instancias WA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{stats.automatizacion.instancias_whatsapp.total}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {stats.automatizacion.instancias_whatsapp.conectadas} conectadas
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalles por canal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WhatsApp Detalle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="h-5 w-5 text-green-600" />
                  WhatsApp Business
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconifyIcon icon="solar:chat-round-dots-bold" className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium">Campañas de Mensajes</p>
                        <p className="text-sm text-gray-500">Mensajes masivos y automatizados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{stats.automatizacion.campanas_whatsapp.total}</p>
                      <p className="text-xs text-gray-500">{stats.automatizacion.campanas_whatsapp.activas} activas</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconifyIcon icon="solar:smartphone-2-bold" className="h-8 w-8 text-emerald-600" />
                      <div>
                        <p className="font-medium">Instancias Conectadas</p>
                        <p className="text-sm text-gray-500">Números de WhatsApp activos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{stats.automatizacion.instancias_whatsapp.conectadas}</p>
                      <p className="text-xs text-gray-500">de {stats.automatizacion.instancias_whatsapp.total} totales</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconifyIcon icon="solar:bot-bold" className="h-8 w-8 text-cyan-600" />
                      <div>
                        <p className="font-medium">Chatbots IA</p>
                        <p className="text-sm text-gray-500">Asistentes virtuales</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-cyan-600">{stats.automatizacion.chatbots.activos}</p>
                      <p className="text-xs text-gray-500">de {stats.automatizacion.chatbots.total} totales</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Otros canales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:layers-bold-duotone" className="h-5 w-5 text-indigo-600" />
                  Otros Canales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconifyIcon icon="solar:phone-calling-bold" className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="font-medium">Campañas de Voz AI</p>
                        <p className="text-sm text-gray-500">Llamadas automatizadas con IA</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">{stats.automatizacion.campanas_voz.total}</p>
                      <p className="text-xs text-gray-500">{stats.automatizacion.campanas_voz.activas} activas</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconifyIcon icon="solar:letter-bold" className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">Campañas de Email</p>
                        <p className="text-sm text-gray-500">Email marketing automatizado</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{stats.automatizacion.campanas_email.total}</p>
                      <p className="text-xs text-gray-500">{stats.automatizacion.campanas_email.activas} activas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen total */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:chart-2-bold-duotone" className="h-5 w-5 text-primary" />
                Resumen Total de Automatización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.automatizacion.campanas_whatsapp.total + 
                     stats.automatizacion.campanas_voz.total + 
                     stats.automatizacion.campanas_email.total}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Total Campañas</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {stats.automatizacion.campanas_whatsapp.activas + 
                     stats.automatizacion.campanas_voz.activas + 
                     stats.automatizacion.campanas_email.activas}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Campañas Activas</p>
                </div>
                <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-cyan-600">{stats.automatizacion.chatbots.activos}</p>
                  <p className="text-sm text-gray-500 mt-1">Chatbots Activos</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-emerald-600">{stats.automatizacion.instancias_whatsapp.conectadas}</p>
                  <p className="text-sm text-gray-500 mt-1">WhatsApp Conectados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MasterCampanasPage;

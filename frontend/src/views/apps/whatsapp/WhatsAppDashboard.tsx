import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { Link } from 'react-router-dom';
import whatsappMicroservice from 'src/services/whatsappMicroservice';

interface DashboardStats {
  totalInstances: number;
  connectedInstances: number;
  totalChatbots: number;
  activeChatbots: number;
  totalCampaigns: number;
  messagesLast7Days: number;
  conversationsToday: number;
}

const WhatsAppDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalInstances: 0,
    connectedInstances: 0,
    totalChatbots: 0,
    activeChatbots: 0,
    totalCampaigns: 0,
    messagesLast7Days: 0,
    conversationsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Cargar instancias
      try {
        const instancesResponse = await whatsappMicroservice.getInstances();
        if (instancesResponse.success) {
          setInstances(instancesResponse.instances || []);
          const connected = (instancesResponse.instances || []).filter((i: any) => i.connected).length;
          setStats(prev => ({
            ...prev,
            totalInstances: instancesResponse.instances?.length || 0,
            connectedInstances: connected,
          }));
        }
      } catch (e) {
        console.log('No se pudieron cargar instancias');
      }

      // Cargar estadísticas de campañas
      try {
        const campaignsResponse = await whatsappMicroservice.getCampaigns({ limit: 100 });
        if (campaignsResponse.success) {
          setStats(prev => ({
            ...prev,
            totalCampaigns: campaignsResponse.total || 0,
          }));
        }
      } catch (e) {
        console.log('No se pudieron cargar campañas');
      }

    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    subtitle 
  }: { 
    title: string; 
    value: number | string; 
    icon: string; 
    color: string;
    subtitle?: string;
  }) => (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon icon={icon} width={22} />
        </div>
      </div>
    </Card>
  );

  const QuickActionCard = ({ 
    title, 
    description, 
    icon, 
    href, 
    color 
  }: { 
    title: string; 
    description: string; 
    icon: string; 
    href: string;
    color: string;
  }) => (
    <Link to={href}>
      <Card className="hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer h-full">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon icon={icon} width={20} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner size="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon icon="solar:chat-round-dots-bold-duotone" className="text-green-500" width={32} />
              WhatsApp Business
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gestiona tus conexiones, envíos masivos y chatbots
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/apps/whatsapp/conexiones">
              <HeroButton icon="solar:add-circle-bold">Nueva Conexión</HeroButton>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Conexiones Activas"
          value={`${stats.connectedInstances}/${stats.totalInstances}`}
          icon="solar:smartphone-bold-duotone"
          color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          subtitle="Instancias WhatsApp"
        />
        <StatCard
          title="Chatbots Activos"
          value={stats.activeChatbots}
          icon="solar:bot-bold-duotone"
          color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          subtitle={`de ${stats.totalChatbots} configurados`}
        />
        <StatCard
          title="Campañas"
          value={stats.totalCampaigns}
          icon="solar:letter-bold-duotone"
          color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          subtitle="Total de campañas"
        />
        <StatCard
          title="Mensajes (7 días)"
          value={stats.messagesLast7Days}
          icon="solar:chat-line-bold-duotone"
          color="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          subtitle="Enviados y recibidos"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="Nueva Campaña"
            description="Crear envío masivo de mensajes"
            icon="solar:mailbox-bold-duotone"
            href="/apps/whatsapp/campanas/nueva"
            color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          />
          <QuickActionCard
            title="Crear Chatbot"
            description="Configurar respuestas automáticas"
            icon="solar:bot-bold-duotone"
            href="/apps/whatsapp/chatbots/nuevo"
            color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          />
          <QuickActionCard
            title="Ver Conexiones"
            description="Gestionar instancias WhatsApp"
            icon="solar:smartphone-bold-duotone"
            href="/apps/whatsapp/conexiones"
            color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          />
          <QuickActionCard
            title="Reportes"
            description="Estadísticas y métricas"
            icon="solar:chart-2-bold-duotone"
            href="/apps/whatsapp/reportes"
            color="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          />
        </div>
      </div>

      {/* Instances Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Instances */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Estado de Conexiones
            </h3>
            <Link to="/apps/whatsapp/conexiones">
              <Button size="xs" color="light">Ver todas</Button>
            </Link>
          </div>
          
          {instances.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                <Icon icon="solar:smartphone-bold-duotone" className="text-gray-400" width={28} />
              </div>
              <p className="text-gray-500 mt-2">No hay conexiones configuradas</p>
              <div className="flex justify-center mt-4">
                <Link to="/apps/whatsapp/conexiones">
                  <Button size="sm" color="light">
                    <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
                    Agregar Conexión
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.slice(0, 5).map((instance) => (
                <div 
                  key={instance.instanceId} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${instance.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {instance.instanceId}
                      </p>
                      <p className="text-xs text-gray-500">
                        {instance.phone || 'Sin número asignado'}
                      </p>
                    </div>
                  </div>
                  <Badge color={instance.connected ? 'success' : 'gray'}>
                    {instance.connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Módulos Disponibles
            </h3>
          </div>
          
          <div className="space-y-3">
            <Link to="/apps/whatsapp/campanas" className="block">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Icon icon="solar:letter-bold-duotone" className="text-purple-500" width={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Envíos Masivos</p>
                    <p className="text-xs text-gray-500">Campañas y mensajes programados</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" className="text-gray-400" width={20} />
              </div>
            </Link>

            <Link to="/apps/whatsapp/chatbots" className="block">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Icon icon="solar:bot-bold-duotone" className="text-blue-500" width={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Chatbots</p>
                    <p className="text-xs text-gray-500">Respuestas automáticas y flujos</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" className="text-gray-400" width={20} />
              </div>
            </Link>

            <Link to="/apps/whatsapp/plantillas" className="block">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Icon icon="solar:document-text-bold-duotone" className="text-green-500" width={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Plantillas</p>
                    <p className="text-xs text-gray-500">Mensajes predefinidos</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" className="text-gray-400" width={20} />
              </div>
            </Link>

            <Link to="/apps/whatsapp/inbox" className="block">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-2 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon icon="solar:inbox-bold-duotone" className="text-primary" width={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Inbox</p>
                    <p className="text-xs text-gray-500">Gestión de conversaciones</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" className="text-gray-400" width={20} />
              </div>
            </Link>

            
            <Link to="/apps/whatsapp/reportes" className="block">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                    <Icon icon="solar:chart-2-bold-duotone" className="text-orange-500" width={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Reportes</p>
                    <p className="text-xs text-gray-500">Estadísticas y análisis</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" className="text-gray-400" width={20} />
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppDashboard;

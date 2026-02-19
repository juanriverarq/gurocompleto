import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../components/shadcn-ui/Default-Ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/shadcn-ui/Default-Ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/shadcn-ui/Default-Ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/shadcn-ui/Default-Ui/dialog';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService from '../../services/masterPanelService';
import { MODULES } from '../../components/landingpage/pricing-calculator/modules';

const PLAN_PRESETS: Record<string, string[]> = {
  starter: ['clientes','polizas','siniestros','renovaciones','automoviles','seguimiento','documentos','crm','cartera'],
  professional: ['clientes','polizas','siniestros','renovaciones','automoviles','seguimiento','documentos','crm','cartera','whatsapp','email','miniweb','ia_chatbot','lector_pdf_ia'],
  business: MODULES.map(m => m.key),
  custom: [],
};

const MasterBrokerDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAction, setWalletAction] = useState<'add' | 'subtract'>('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletDescription, setWalletDescription] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    status: '',
    period: '',
    monthly_amount: '',
    current_period_end: '',
    users_count: '',
    storage_gb: '',
    plan: '',
    broker_status: '',
    trial_ends_at: '',
  });
  const [subFeatures, setSubFeatures] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getBrokerFullDetail(Number(id));
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error loading broker detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSubscriptionModal = () => {
    const b = data?.broker;
    setSubscriptionForm({
      status: data?.subscription?.status || 'active',
      period: data?.subscription?.period || 'monthly',
      monthly_amount: data?.subscription?.totals?.monthly?.toString() || data?.subscription?.totals?.total?.toString() || '0',
      current_period_end: data?.subscription?.current_period_end ? new Date(data.subscription.current_period_end).toISOString().split('T')[0] : '',
      users_count: data?.subscription?.users_count?.toString() || b?.max_users?.toString() || '5',
      storage_gb: data?.subscription?.storage_gb?.toString() || '10',
      plan: b?.plan || 'starter',
      broker_status: b?.status || 'trial',
      trial_ends_at: b?.trial_ends_at ? new Date(b.trial_ends_at).toISOString().split('T')[0] : '',
    });
    setSubFeatures(new Set(b?.features || []));
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionUpdate = async () => {
    setSubscriptionLoading(true);
    try {
      const updateData: any = {
        status: subscriptionForm.status,
        period: subscriptionForm.period,
        plan: subscriptionForm.plan,
        broker_status: subscriptionForm.broker_status,
        features: Array.from(subFeatures),
        max_users: parseInt(subscriptionForm.users_count) || 5,
      };
      if (subscriptionForm.monthly_amount) updateData.monthly_amount = parseFloat(subscriptionForm.monthly_amount);
      if (subscriptionForm.current_period_end) updateData.current_period_end = subscriptionForm.current_period_end;
      if (subscriptionForm.users_count) updateData.users_count = parseInt(subscriptionForm.users_count);
      if (subscriptionForm.storage_gb) updateData.storage_gb = parseInt(subscriptionForm.storage_gb);
      updateData.trial_ends_at = subscriptionForm.broker_status === 'trial' && subscriptionForm.trial_ends_at
        ? subscriptionForm.trial_ends_at
        : null;

      const response = await masterPanelService.updateBrokerSubscription(Number(id), updateData);
      if (response.success) {
        setShowSubscriptionModal(false);
        loadData();
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleWalletUpdate = async () => {
    if (!walletAmount || parseFloat(walletAmount) <= 0) return;
    
    setWalletLoading(true);
    try {
      const response = await masterPanelService.updateBrokerWallet(Number(id), {
        action: walletAction,
        amount: parseFloat(walletAmount),
        description: walletDescription || `${walletAction === 'add' ? 'Recarga' : 'Descuento'} manual`,
      });
      if (response.success) {
        setShowWalletModal(false);
        setWalletAmount('');
        setWalletDescription('');
        loadData();
      }
    } catch (error) {
      console.error('Error updating wallet:', error);
    } finally {
      setWalletLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
      error: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      inactive: 'bg-gray-100 text-gray-700',
      credit: 'bg-green-100 text-green-700',
      debit: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <IconifyIcon icon="solar:danger-triangle-bold" className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <p className="text-gray-500">Broker no encontrado</p>
        <Button onClick={() => navigate('/master-panel/brokers')} className="mt-4">Volver</Button>
      </div>
    );
  }

  const { broker, wallet, wallet_transactions, polizas, clientes, campanas, llamadas_voz, chatbots, instancias_whatsapp, usuarios, empleados, siniestros } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/master-panel/brokers')}>
            <IconifyIcon icon="solar:arrow-left-linear" className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <IconifyIcon icon="solar:buildings-2-bold-duotone" className="text-primary" />
              {broker.name}
            </h1>
            <p className="text-gray-500">ID: #{broker.id} • {broker.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => navigate(`/master-panel/brokers/${id}/editar`)}>
            <IconifyIcon icon="solar:pen-linear" className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:document-text-bold-duotone" className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{polizas.stats.total}</p>
            <p className="text-xs text-gray-500">Pólizas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:users-group-rounded-bold-duotone" className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-2xl font-bold">{clientes.stats.total}</p>
            <p className="text-xs text-gray-500">Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:wallet-bold-duotone" className="w-8 h-8 mx-auto text-orange-600 mb-2" />
            <p className="text-2xl font-bold">{wallet?.balance_cop_formatted || '$0'}</p>
            <p className="text-xs text-gray-500">Saldo Wallet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:dollar-bold-duotone" className="w-8 h-8 mx-auto text-purple-600 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(polizas.stats.valor_primas)}</p>
            <p className="text-xs text-gray-500">Primas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:user-bold-duotone" className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
            <p className="text-2xl font-bold">{usuarios?.length || 0}</p>
            <p className="text-xs text-gray-500">Usuarios</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="w-8 h-8 mx-auto text-cyan-600 mb-2" />
            <p className="text-2xl font-bold">{(campanas.whatsapp?.length || 0) + (campanas.voz?.length || 0)}</p>
            <p className="text-xs text-gray-500">Campañas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="wallet" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="wallet" className="flex items-center gap-1">
            <IconifyIcon icon="solar:wallet-bold" className="w-4 h-4" /> Wallet
          </TabsTrigger>
          <TabsTrigger value="polizas" className="flex items-center gap-1">
            <IconifyIcon icon="solar:document-text-bold" className="w-4 h-4" /> Pólizas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex items-center gap-1">
            <IconifyIcon icon="solar:users-group-rounded-bold" className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="campanas" className="flex items-center gap-1">
            <IconifyIcon icon="solar:chat-round-dots-bold" className="w-4 h-4" /> Campañas
          </TabsTrigger>
          <TabsTrigger value="llamadas" className="flex items-center gap-1">
            <IconifyIcon icon="solar:phone-calling-bold" className="w-4 h-4" /> Llamadas
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-1">
            <IconifyIcon icon="solar:user-bold" className="w-4 h-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-1">
            <IconifyIcon icon="solar:info-circle-bold" className="w-4 h-4" /> Info
          </TabsTrigger>
          <TabsTrigger value="suscripcion" className="flex items-center gap-1">
            <IconifyIcon icon="solar:crown-bold" className="w-4 h-4" /> Suscripción
          </TabsTrigger>
        </TabsList>

        {/* Tab: Wallet */}
        <TabsContent value="wallet">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <IconifyIcon icon="solar:wallet-bold-duotone" className="w-5 h-5 text-orange-600" />
                    Saldo Actual
                  </span>
                  <Button size="sm" onClick={() => setShowWalletModal(true)}>
                    <IconifyIcon icon="solar:add-circle-linear" className="w-4 h-4 mr-1" />
                    Ajustar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wallet ? (
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl">
                      <p className="text-4xl font-bold text-orange-600">{wallet.balance_cop_formatted}</p>
                      <p className="text-sm text-gray-500 mt-1">Saldo COP</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-lg font-bold">${typeof wallet.balance_usd === 'number' ? wallet.balance_usd.toFixed(2) : parseFloat(wallet.balance_usd || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Saldo USD</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-lg font-bold">{formatCurrency(wallet.total_earnings || 0)}</p>
                        <p className="text-xs text-gray-500">Total Recargas</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">Sin wallet configurado</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:history-bold-duotone" className="w-5 h-5 text-blue-600" />
                  Historial de Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Saldo Después</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wallet_transactions?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Sin transacciones
                          </TableCell>
                        </TableRow>
                      ) : (
                        wallet_transactions?.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{new Date(t.created_at).toLocaleString()}</TableCell>
                            <TableCell>{getStatusBadge(t.type)}</TableCell>
                            <TableCell className={`font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount_cop)}
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{t.description}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(t.balance_cop_after)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Pólizas */}
        <TabsContent value="polizas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <IconifyIcon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-blue-600" />
                  Pólizas ({polizas.stats.total})
                </span>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">Activas: {polizas.stats.activas}</span>
                  <span className="text-blue-600">Primas: {formatCurrency(polizas.stats.valor_primas)}</span>
                  <span className="text-purple-600">Comisiones: {formatCurrency(polizas.stats.valor_comisiones)}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Prima</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Creación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {polizas.items?.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell><span className="font-mono text-xs">#{p.id}</span></TableCell>
                        <TableCell className="font-medium">{p.policy_number}</TableCell>
                        <TableCell>{getStatusBadge(p.status)}</TableCell>
                        <TableCell>{formatCurrency(p.premium_amount)}</TableCell>
                        <TableCell>{formatCurrency(p.commission_amount)}</TableCell>
                        <TableCell className="text-sm">
                          {p.start_date && new Date(p.start_date).toLocaleDateString()} - {p.end_date && new Date(p.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <IconifyIcon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-green-600" />
                  Clientes ({clientes.stats.total})
                </span>
                <span className="text-sm text-green-600">Activos: {clientes.stats.activos}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.items?.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell><span className="font-mono text-xs">#{c.id}</span></TableCell>
                        <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Campañas */}
        <TabsContent value="campanas">
          <div className="space-y-6">
            {/* WhatsApp */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-green-600" />
                  Campañas WhatsApp ({campanas.whatsapp?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead>Fallidos</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanas.whatsapp?.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-4 text-gray-500">Sin campañas</TableCell></TableRow>
                    ) : campanas.whatsapp?.map((c: any) => (
                      <TableRow key={c.id} className={c.failed_count > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell><span className="font-mono text-xs">#{c.id}</span></TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-green-600">{c.sent_count}</TableCell>
                        <TableCell className="text-red-600">{c.failed_count}</TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{c.error_message || '-'}</TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Voz AI */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:phone-calling-bold-duotone" className="w-5 h-5 text-purple-600" />
                  Campañas Voz AI ({campanas.voz?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Completadas</TableHead>
                      <TableHead>Fallidas</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanas.voz?.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-4 text-gray-500">Sin campañas</TableCell></TableRow>
                    ) : campanas.voz?.map((c: any) => (
                      <TableRow key={c.id} className={c.failed_calls > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell><span className="font-mono text-xs">#{c.id}</span></TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-green-600">{c.completed_calls}</TableCell>
                        <TableCell className="text-red-600">{c.failed_calls}</TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{c.error_message || '-'}</TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:letter-bold-duotone" className="w-5 h-5 text-blue-600" />
                  Campañas Email ({campanas.email?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead>Fallidos</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanas.email?.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-500">Sin campañas</TableCell></TableRow>
                    ) : campanas.email?.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell><span className="font-mono text-xs">#{c.id}</span></TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-green-600">{c.sent_count}</TableCell>
                        <TableCell className="text-red-600">{c.failed_count}</TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Llamadas */}
        <TabsContent value="llamadas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:phone-calling-bold-duotone" className="w-5 h-5 text-indigo-600" />
                Historial de Llamadas Voz AI ({llamadas_voz?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>VAPI ID</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {llamadas_voz?.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Sin llamadas</TableCell></TableRow>
                    ) : llamadas_voz?.map((l: any) => (
                      <TableRow key={l.id} className={l.status === 'failed' || l.error_message ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell><span className="font-mono text-xs">#{l.id}</span></TableCell>
                        <TableCell className="font-medium">{l.phone_number}</TableCell>
                        <TableCell>{getStatusBadge(l.status)}</TableCell>
                        <TableCell>{l.duration_seconds ? `${Math.floor(l.duration_seconds / 60)}:${(l.duration_seconds % 60).toString().padStart(2, '0')}` : '-'}</TableCell>
                        <TableCell>${l.total_cost_usd?.toFixed(4) || '0'}</TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[150px] truncate">{l.error_message || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{l.vapi_call_id || '-'}</TableCell>
                        <TableCell className="text-sm">{new Date(l.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Usuarios */}
        <TabsContent value="usuarios">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:user-bold-duotone" className="w-5 h-5 text-indigo-600" />
                  Usuarios ({usuarios?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios?.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell><span className="font-mono text-xs">#{u.id}</span></TableCell>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>{getStatusBadge(u.user_type?.toLowerCase())}</TableCell>
                        <TableCell>{getStatusBadge(u.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-cyan-600" />
                  Empleados ({empleados?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleados?.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-500">Sin empleados</TableCell></TableRow>
                    ) : empleados?.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell><span className="font-mono text-xs">#{e.id}</span></TableCell>
                        <TableCell className="font-medium">{e.nombre}</TableCell>
                        <TableCell className="text-sm">{e.email}</TableCell>
                        <TableCell>{e.cargo || '-'}</TableCell>
                        <TableCell>{e.rol || '-'}</TableCell>
                        <TableCell>{getStatusBadge(e.estado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Info */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:buildings-2-bold-duotone" className="w-5 h-5 text-primary" />
                  Información del Broker
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">ID</span>
                    <span className="font-mono">#{broker.id}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Nombre</span>
                    <span className="font-medium">{broker.name}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Razón Social</span>
                    <span>{broker.legal_name || '-'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Email</span>
                    <span>{broker.email}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Teléfono</span>
                    <span>{broker.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Ciudad</span>
                    <span>{broker.city}, {broker.country}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Plan</span>
                    <span className="font-medium uppercase">{broker.plan}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Estado</span>
                    {getStatusBadge(broker.status)}
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-gray-500">Fecha Creación</span>
                    <span>{new Date(broker.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconifyIcon icon="solar:user-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Propietario
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {broker.owner ? (
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {broker.owner.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{broker.owner.name}</p>
                        <p className="text-sm text-gray-500">{broker.owner.email}</p>
                        <p className="text-xs text-gray-400">ID: #{broker.owner.id}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">Sin propietario asignado</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconifyIcon icon="solar:smartphone-2-bold-duotone" className="w-5 h-5 text-green-600" />
                    Instancias WhatsApp ({instancias_whatsapp?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {instancias_whatsapp?.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Sin instancias</p>
                  ) : (
                    <div className="space-y-2">
                      {instancias_whatsapp?.map((i: any) => (
                        <div key={i.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <p className="font-medium">{i.name}</p>
                            <p className="text-sm text-gray-500">{i.phone_number}</p>
                          </div>
                          {getStatusBadge(i.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Suscripción */}
        <TabsContent value="suscripcion">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <IconifyIcon icon="solar:crown-bold-duotone" className="w-5 h-5 text-yellow-600" />
                    Plan Actual
                  </span>
                  <Button size="sm" onClick={openSubscriptionModal}>
                    <IconifyIcon icon="solar:pen-linear" className="w-4 h-4 mr-1" />
                    Modificar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.subscription ? (
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl">
                      <IconifyIcon icon="solar:crown-bold-duotone" className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
                      <p className="text-2xl font-bold uppercase">{({ starter: 'Starter', professional: 'Professional', business: 'Business', custom: 'A tu medida' } as Record<string, string>)[broker.plan || ''] || broker.plan || 'Starter'}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {data.subscription.period === 'monthly' ? 'Mensual' : 'Anual'}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-gray-500">Estado</span>
                        {getStatusBadge(data.subscription.status)}
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-gray-500">Periodicidad</span>
                        <span className="font-medium">{data.subscription.period === 'monthly' ? 'Mensual' : 'Anual'}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-gray-500">Monto a Cobrar</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(data.subscription.totals?.monthly || data.subscription.totals?.total || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-gray-500">Usuarios Permitidos</span>
                        <span className="font-medium">{data.subscription.users_count}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-gray-500">Almacenamiento</span>
                        <span className="font-medium">{data.subscription.storage_gb} GB</span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-gray-500">Inicio Suscripción</span>
                        <span>{data.subscription.starts_at ? new Date(data.subscription.starts_at).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="text-gray-500">Próximo Cobro</span>
                        <span className="font-medium text-blue-600">
                          {data.subscription.current_period_end ? new Date(data.subscription.current_period_end).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <IconifyIcon icon="solar:crown-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Sin suscripción activa</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:history-bold-duotone" className="w-5 h-5 text-blue-600" />
                  Historial de Suscripciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Periodo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.subscription_history?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Sin historial
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.subscription_history?.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell><span className="font-mono text-xs">#{s.id}</span></TableCell>
                            <TableCell>{s.period === 'monthly' ? 'Mensual' : 'Anual'}</TableCell>
                            <TableCell>{getStatusBadge(s.status)}</TableCell>
                            <TableCell>{formatCurrency(s.totals?.monthly || s.totals?.total || 0)}</TableCell>
                            <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Módulos contratados */}
            {data?.subscription?.modules && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconifyIcon icon="solar:widget-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Módulos Contratados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.subscription.modules || {}).map(([key, value]: [string, any]) => (
                      value && (
                        <span key={key} className="px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-sm">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Wallet Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:wallet-bold-duotone" className="w-5 h-5 text-orange-600" />
              Ajustar Saldo Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={walletAction === 'add' ? 'default' : 'outline'}
                onClick={() => setWalletAction('add')}
                className={walletAction === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <IconifyIcon icon="solar:add-circle-linear" className="w-4 h-4 mr-2" />
                Agregar
              </Button>
              <Button
                variant={walletAction === 'subtract' ? 'default' : 'outline'}
                onClick={() => setWalletAction('subtract')}
                className={walletAction === 'subtract' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <IconifyIcon icon="solar:minus-circle-linear" className="w-4 h-4 mr-2" />
                Descontar
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Monto (COP)</Label>
              <Input
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={walletDescription}
                onChange={(e) => setWalletDescription(e.target.value)}
                placeholder="Motivo del ajuste..."
              />
            </div>
            <Button onClick={handleWalletUpdate} disabled={walletLoading} className="w-full">
              {walletLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Confirmar Ajuste
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Modal */}
      <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:crown-bold-duotone" className="w-5 h-5 text-yellow-600" />
              Gestión de Plan — {broker?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">

            {/* Estado del Broker */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <IconifyIcon icon="solar:shield-check-bold" className="w-4 h-4 text-green-600" />
                Estado del Broker
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <select
                    value={subscriptionForm.broker_status}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, broker_status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="active">Activo</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspendido</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                {subscriptionForm.broker_status === 'trial' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fin del Trial</Label>
                    <Input
                      type="date"
                      value={subscriptionForm.trial_ends_at}
                      onChange={(e) => setSubscriptionForm({...subscriptionForm, trial_ends_at: e.target.value})}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Plan y Facturación */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <IconifyIcon icon="solar:crown-bold" className="w-4 h-4 text-yellow-600" />
                Plan y Facturación
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Plan</Label>
                  <select
                    value={subscriptionForm.plan}
                    onChange={(e) => {
                      const plan = e.target.value;
                      setSubscriptionForm({...subscriptionForm, plan});
                      if (plan !== 'custom' && PLAN_PRESETS[plan]) {
                        setSubFeatures(new Set(PLAN_PRESETS[plan]));
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="business">Business</option>
                    <option value="custom">A tu medida</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Periodicidad</Label>
                  <select
                    value={subscriptionForm.period}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, period: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado Suscripción</Label>
                  <select
                    value={subscriptionForm.status}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="active">Activo</option>
                    <option value="trialing">En Trial</option>
                    <option value="canceled">Cancelado</option>
                    <option value="incomplete">Incompleto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Monto Fijo (COP)</Label>
                  <Input
                    type="number"
                    value={subscriptionForm.monthly_amount}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, monthly_amount: e.target.value})}
                    placeholder="0"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuarios</Label>
                  <Input
                    type="number"
                    value={subscriptionForm.users_count}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, users_count: e.target.value})}
                    placeholder="5"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage (GB)</Label>
                  <Input
                    type="number"
                    value={subscriptionForm.storage_gb}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, storage_gb: e.target.value})}
                    placeholder="10"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Próximo Cobro</Label>
                  <Input
                    type="date"
                    value={subscriptionForm.current_period_end}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, current_period_end: e.target.value})}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Módulos */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <IconifyIcon icon="solar:widget-5-bold" className="w-4 h-4 text-purple-600" />
                  Módulos ({subFeatures.size})
                </h4>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setSubFeatures(new Set(MODULES.map(m => m.key)))}
                    className="px-2 py-1 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                    Todos
                  </button>
                  <button type="button" onClick={() => setSubFeatures(new Set())}
                    className="px-2 py-1 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto">
                {MODULES.map((mod) => {
                  const active = subFeatures.has(mod.key);
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => {
                        setSubFeatures(prev => {
                          const next = new Set(prev);
                          if (next.has(mod.key)) next.delete(mod.key);
                          else next.add(mod.key);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs ${
                        active
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 ${
                        active ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        {active && <IconifyIcon icon="solar:check-read-linear" className="w-2.5 h-2.5" />}
                      </div>
                      <span className={`truncate ${active ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500'}`}>
                        {mod.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleSubscriptionUpdate} disabled={subscriptionLoading} className="w-full">
              {subscriptionLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterBrokerDetailPage;

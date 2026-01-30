import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
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

interface BrokerFacturacion {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  created_at: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  owner: { id: number; name: string; email: string } | null;
  subscription: {
    id: number;
    status: string;
    period: string;
    starts_at: string;
    current_period_end: string;
    totals: any;
  } | null;
  en_mora: boolean;
  dias_mora: number;
  ultimo_pago: {
    id: number;
    reference: string;
    amount: number;
    status: string;
    created_at: string;
    wompi_transaction_id: string;
  } | null;
  total_pagos: number;
  monto_total_pagado: number;
}

interface PaymentDetail {
  id: number;
  reference: string;
  amount: number;
  amount_formatted: string;
  currency: string;
  status: string;
  wompi_transaction_id: string;
  created_at: string;
  metadata: any;
}

const MasterFacturacionPage: React.FC = () => {
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState<BrokerFacturacion[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterMora, setFilterMora] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerFacturacion | null>(null);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterMora]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getFacturacion(
        filterMora ? { en_mora: 'true' } : undefined
      );
      if (response.success) {
        setBrokers(response.data.brokers);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading facturacion:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBrokerPayments = async (broker: BrokerFacturacion) => {
    setSelectedBroker(broker);
    setShowPaymentsModal(true);
    setLoadingPayments(true);
    try {
      const response = await masterPanelService.getBrokerPayments(broker.id);
      if (response.success) {
        setPayments(response.data.payments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      voided: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      canceled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:bill-list-bold-duotone" className="text-green-600" />
            Facturación y Pagos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Control de suscripciones, pagos y estado de mora de brokers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterMora ? 'default' : 'outline'}
            onClick={() => setFilterMora(!filterMora)}
            className={filterMora ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            <IconifyIcon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4 mr-2" />
            {filterMora ? 'Mostrando en Mora' : 'Ver en Mora'}
          </Button>
          <Button variant="outline" onClick={loadData}>
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <IconifyIcon icon="solar:buildings-2-bold-duotone" className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total_brokers}</p>
                  <p className="text-sm text-gray-500">Total Brokers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <IconifyIcon icon="solar:danger-triangle-bold-duotone" className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.brokers_en_mora}</p>
                  <p className="text-sm text-gray-500">En Mora</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <IconifyIcon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.brokers_al_dia}</p>
                  <p className="text-sm text-gray-500">Al Día</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <IconifyIcon icon="solar:crown-bold-duotone" className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{stats.suscripciones_activas}</p>
                  <p className="text-sm text-gray-500">Suscripciones Activas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <IconifyIcon icon="solar:dollar-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_recaudado)}</p>
                  <p className="text-sm text-gray-500">Total Recaudado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:list-bold-duotone" className="h-5 w-5 text-primary" />
            Brokers y Estado de Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Suscripción</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado Pago</TableHead>
                    <TableHead>Último Pago</TableHead>
                    <TableHead>Total Pagado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                        <IconifyIcon icon="solar:bill-list-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No se encontraron brokers
                      </TableCell>
                    </TableRow>
                  ) : (
                    brokers.map((broker) => (
                      <TableRow key={broker.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${broker.en_mora ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            #{broker.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{broker.name}</p>
                            <p className="text-xs text-gray-500">{broker.email}</p>
                            <p className="text-xs text-gray-400">
                              Desde: {new Date(broker.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            broker.plan === 'pro' ? 'bg-purple-100 text-purple-700' :
                            broker.plan === 'enterprise' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {broker.plan?.toUpperCase() || 'BASIC'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {broker.subscription ? (
                            <div>
                              {getStatusBadge(broker.subscription.status)}
                              <p className="text-xs text-gray-500 mt-1">
                                {broker.subscription.period === 'monthly' ? 'Mensual' : 'Anual'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin suscripción</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {broker.subscription?.current_period_end ? (
                            <div>
                              <p className="text-sm">{new Date(broker.subscription.current_period_end).toLocaleDateString()}</p>
                              {broker.en_mora && (
                                <p className="text-xs text-red-600 font-medium">
                                  {broker.dias_mora} días vencido
                                </p>
                              )}
                            </div>
                          ) : broker.trial_ends_at ? (
                            <div>
                              <p className="text-sm text-orange-600">Trial</p>
                              <p className="text-xs text-gray-500">{new Date(broker.trial_ends_at).toLocaleDateString()}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {broker.en_mora ? (
                            <div className="flex items-center gap-1">
                              <IconifyIcon icon="solar:danger-triangle-bold" className="w-4 h-4 text-red-600" />
                              <span className="text-red-600 font-medium text-sm">EN MORA</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <IconifyIcon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600" />
                              <span className="text-green-600 text-sm">Al día</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {broker.ultimo_pago ? (
                            <div>
                              <p className="text-sm font-medium">{formatCurrency(broker.ultimo_pago.amount)}</p>
                              <p className="text-xs text-gray-500">{new Date(broker.ultimo_pago.created_at).toLocaleDateString()}</p>
                              {getStatusBadge(broker.ultimo_pago.status)}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin pagos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-green-600">{formatCurrency(broker.monto_total_pagado)}</p>
                            <p className="text-xs text-gray-500">{broker.total_pagos} pagos</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadBrokerPayments(broker)}
                              title="Ver historial de pagos"
                            >
                              <IconifyIcon icon="solar:history-bold-duotone" className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/master-panel/brokers/${broker.id}/editar`)}
                              title="Editar broker"
                            >
                              <IconifyIcon icon="solar:pen-linear" className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Modal */}
      <Dialog open={showPaymentsModal} onOpenChange={setShowPaymentsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:history-bold-duotone" className="h-5 w-5 text-primary" />
              Historial de Pagos - {selectedBroker?.name}
            </DialogTitle>
          </DialogHeader>

          {loadingPayments ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Broker Info */}
              {selectedBroker && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">ID Broker</p>
                      <p className="font-medium">#{selectedBroker.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Plan</p>
                      <p className="font-medium">{selectedBroker.plan?.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Activación</p>
                      <p className="font-medium">{new Date(selectedBroker.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Pagado</p>
                      <p className="font-medium text-green-600">{formatCurrency(selectedBroker.monto_total_pagado)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments Table */}
              {payments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <IconifyIcon icon="solar:bill-list-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay pagos registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>ID Transacción</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            #{payment.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{payment.reference}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{payment.amount_formatted}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>
                          {payment.wompi_transaction_id ? (
                            <span className="font-mono text-xs text-blue-600">{payment.wompi_transaction_id}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{new Date(payment.created_at).toLocaleString()}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterFacturacionPage;

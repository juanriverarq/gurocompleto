import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn-ui/Default-Ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn-ui/Default-Ui/card';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Input } from '../shadcn-ui/Default-Ui/input';
import { Badge } from '../shadcn-ui/Default-Ui/badge';
import { Label } from '../shadcn-ui/Default-Ui/label';
import { Tabs, TabsRef } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { walletApi, WalletBalance, TransactionHistoryResponse } from '../../services/api/walletApi';
import CardBox from '../shared/CardBox';
import { useToast } from '../../hooks/use-toast';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';

// Cargar widget Wompi una sola vez
const ensureWompiWidgetLoaded = () => {
  if (typeof window === 'undefined') return;
  const src = 'https://checkout.wompi.co/widget.js';
  const existing = document.querySelector(`script[src="${src}"]`);
  if (!existing) {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }
};

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
  walletData: WalletBalance | null;
  onWalletUpdate: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onOpenChange,
  walletData,
  onWalletUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: overview, 1: transactions, 2: referrals, 3: manage
  const [transactions, setTransactions] = useState<TransactionHistoryResponse['data']>([]);
  const [txFilter, setTxFilter] = useState<'all' | 'approved' | 'pending' | 'failed'>('all');
  const [referralUrl, setReferralUrl] = useState('');
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 3,
    pendingReferrals: 1,
    totalEarnings: 150000,
    thisMonthReferrals: 2
  });

  const tabsRef = useRef<TabsRef>(null);
  const { toast } = useToast();
  const { user, usuarioSaas, tenant } = useUnifiedAuth();

  // Función para formatear el saldo
  const formatBalance = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Función para iniciar checkout de Wompi y redirigir
  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (!addAmount || isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Ingresa una cantidad válida', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);

      const brokerId = tenant?.id || usuarioSaas?.broker_id || '';
      if (!brokerId) {
        toast({ title: 'Error', description: 'No se encontró el broker del usuario', variant: 'destructive' });
        return;
      }

      const uuid = (window.crypto && 'randomUUID' in window.crypto) ? (window.crypto as any).randomUUID() : Math.random().toString(36).slice(2);
      const reference = `wallet:${brokerId}:${uuid}`;
      const redirectUrl = `${window.location.origin}/wallet/return?ref=${encodeURIComponent(reference)}`;
      const customerEmail = (user?.email) || (usuarioSaas as any)?.email || '';

      // Intentar primero Widget (nativo)
      ensureWompiWidgetLoaded();

      // 1) pedir firma al backend (con token Firebase)
      const tokenForSignature = await (await import('../../config/firebase')).auth.currentUser?.getIdToken();
      const sigResp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/saas/wallet/signature/wompi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenForSignature ? { 'Authorization': `Bearer ${tokenForSignature}` } : {}),
        },
        body: JSON.stringify({
          reference,
          amount_in_cents: Math.round(amount * 100),
          currency: 'COP',
        })
      });
      const sigJson = await sigResp.json();
      if (!sigResp.ok || !sigJson?.success) {
        throw new Error(sigJson?.message || 'No se pudo obtener la firma');
      }

      const publicKey = sigJson.data.public_key;
      const signature = sigJson.data.signature;

      // 2) cerrar modal antes de abrir el widget (evita overlay bloqueando interacción)
      try { onOpenChange(false); } catch {}

      // abrir widget
      const openWidget = () => new Promise<void>((resolve, reject) => {
        // @ts-ignore
        const WidgetCheckout = (window as any).WidgetCheckout;
        if (!WidgetCheckout) {
          return reject(new Error('Widget de Wompi no cargó'));
        }
        const checkout = new WidgetCheckout({
          currency: 'COP',
          amountInCents: Math.round(amount * 100),
          reference,
          publicKey,
          redirectUrl,
          // integrity signature
          signature: { integrity: signature },
          customerData: customerEmail ? { email: customerEmail } : undefined,
        });

        checkout.open(async (result: any) => {
          try {
            const transaction = result?.transaction;
            if (transaction?.id) {
              // Confirmar en backend por transaction_id
              const token = await (await import('../../config/firebase')).auth.currentUser?.getIdToken();
              await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/saas/wallet/confirm/wompi`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ reference, transaction_id: transaction.id })
              });
              onWalletUpdate();
              toast({ title: 'Pago confirmado', description: 'Tu saldo ha sido actualizado' });
              resolve();
              return;
            }
            // Si no hay id, fallback a redirect
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });

      try {
        await openWidget();
        return;
      } catch (_) {
        // Fallback: Web Checkout (redirigir)
        const res = await walletApi.startWompiCheckout({
          amountCOP: amount,
          customerEmail,
          redirectUrl,
          reference,
        });
        if (res.success && res.checkout_url) {
          window.location.href = res.checkout_url;
          return;
        }
        throw new Error(res.message || 'No se pudo iniciar el checkout de Wompi');
      }
    } catch (error: any) {
      const description = error?.response?.data?.message || error?.message || 'Error de conexión';
      toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Generar URL de referido
  const generateReferralUrl = () => {
    // En producción esto vendría del backend con el ID real del usuario
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/registro?ref=${userId}`;
    setReferralUrl(url);
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    generateReferralUrl();
  }, []);

  // Cargar transacciones cuando la pestaña de transacciones esté activa
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const res = await walletApi.getTransactionHistory();
        if (res.success) {
          setTransactions(res.data || []);
        }
      } catch (_) {}
    };
    if (isOpen && activeTab === 1) {
      loadTransactions();
    }
  }, [isOpen, activeTab]);

  // Resetear estado cuando se cierre el modal
  useEffect(() => {
    if (!isOpen) {
      setActiveTab(0); // overview
      setAddAmount('');
    }
  }, [isOpen]);

  // Copiar URL de referido
  const copyReferralUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast({
        title: 'Copiado',
        description: 'URL de referido copiada al portapapeles'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar la URL',
        variant: 'destructive'
      });
    }
  };

  // Compartir URL de referido
  const shareReferralUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a nuestra plataforma',
          text: '¡Únete usando mi enlace de referido y aprovecha todas las funciones!',
          url: referralUrl,
        });
      } catch (error) {
        copyReferralUrl();
      }
    } else {
      copyReferralUrl();
    }
  };



  // Datos de ejemplo para transacciones recientes
  const recentTransactions = [
    {
      id: '1',
      type: 'income',
      amount: 100000,
      description: 'Recarga de saldo',
      date: '2024-08-07',
      status: 'completed'
    },
    {
      id: '2',
      type: 'expense',
      amount: 15000,
      description: 'Llamadas Call Center (150 min)',
      date: '2024-08-07',
      status: 'completed'
    },
    {
      id: '3',
      type: 'expense',
      amount: 8500,
      description: 'Mensajes WhatsApp (85 mensajes)',
      date: '2024-08-06',
      status: 'completed'
    },
    {
      id: '4',
      type: 'expense',
      amount: 3200,
      description: 'SMS masivos (160 SMS)',
      date: '2024-08-06',
      status: 'completed'
    },
    {
      id: '5',
      type: 'income',
      amount: 50000,
      description: 'Comisión de referido - Plan Anual',
      date: '2024-08-05',
      status: 'completed'
    },
    {
      id: '6',
      type: 'expense',
      amount: 12000,
      description: 'Campaña de voz AI (120 llamadas)',
      date: '2024-08-05',
      status: 'completed'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" width="24" />
            Mi Wallet
          </DialogTitle>
        </DialogHeader>

        <Tabs 
          aria-label="Wallet tabs" 
          ref={tabsRef}
          onActiveTabChange={(tab) => setActiveTab(tab)}
          className="w-full"
        >

          {/* Tab Vista General */}
          <Tabs.Item 
            active 
            title="Vista General" 
            icon={() => <Icon icon="solar:home-linear" width="20" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Saldo Principal */}
              <CardBox>
                <div className="text-center">
                  <Icon icon="solar:wallet-money-bold-duotone" width="48" className="mx-auto text-primary mb-3" />
                  <h3 className="text-2xl font-bold text-dark dark:text-white">
                    {walletData ? formatBalance(walletData.balance_cop) : '$0 COP'}
                  </h3>
                  <p className="text-bodytext">Saldo Disponible</p>
                  <Badge variant="default" className="mt-2">
                    {walletData?.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </CardBox>

              {/* Saldo Pendiente */}
              <CardBox>
                <div className="text-center">
                  <Icon icon="solar:clock-circle-bold-duotone" width="48" className="mx-auto text-warning mb-3" />
                  <h3 className="text-2xl font-bold text-dark dark:text-white">
                    {walletData ? formatBalance(walletData.pending_balance) : '$0 COP'}
                  </h3>
                  <p className="text-bodytext">Saldo Pendiente</p>
                  <Badge variant="secondary" className="mt-2">
                    En proceso
                  </Badge>
                </div>
              </CardBox>

              {/* Total Ganado */}
              <CardBox>
                <div className="text-center">
                  <Icon icon="solar:medal-star-bold-duotone" width="48" className="mx-auto text-success mb-3" />
                  <h3 className="text-2xl font-bold text-dark dark:text-white">
                    {walletData ? formatBalance(walletData.total_earnings) : '$0 COP'}
                  </h3>
                  <p className="text-bodytext">Total Ganado</p>
                  <Badge variant="outline" className="mt-2">
                    Histórico
                  </Badge>
                </div>
              </CardBox>
            </div>

            {/* Acciones Rápidas */}
            <CardBox className="mt-6">
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => tabsRef.current?.setActiveTab(3)}
                    className="flex items-center gap-2"
                  >
                    <Icon icon="solar:card-send-bold-duotone" width="20" />
                    Recargar Saldo
                  </Button>
                  {/* TEMPORALMENTE OCULTO - Botón Mis Referidos
                  <Button 
                    variant="outline"
                    onClick={() => tabsRef.current?.setActiveTab(2)}
                    className="flex items-center gap-2"
                  >
                    <Icon icon="solar:users-group-rounded-bold-duotone" width="20" />
                    Mis Referidos
                  </Button>
                  */}
                  <Button 
                    variant="outline"
                    onClick={() => tabsRef.current?.setActiveTab(1)}
                    className="flex items-center gap-2"
                  >
                    <Icon icon="solar:history-bold-duotone" width="20" />
                    Ver Historial
                  </Button>
                </div>
              </CardContent>
            </CardBox>
          </Tabs.Item>

          {/* Tab Transacciones */}
          <Tabs.Item 
            title="Transacciones" 
            icon={() => <Icon icon="solar:history-bold-duotone" width="20" />}
          >
            <CardBox>
              <CardHeader>
                <CardTitle>Transacciones Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Filtros rápidos */}
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { key: 'all', label: 'Todos' },
                      { key: 'approved', label: 'Aprobados' },
                      { key: 'pending', label: 'Pendientes' },
                      { key: 'failed', label: 'Fallidos' },
                    ] as const).map(({ key, label }) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={txFilter === key ? 'default' : 'outline'}
                        onClick={() => setTxFilter(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  {(!transactions || transactions.length === 0) && (
                    <div className="p-4 text-sm text-bodytext">No hay transacciones aún</div>
                  )}
                  {(transactions || [])
                    .filter((tx) => {
                      if (txFilter === 'all') return true;
                      if (txFilter === 'approved') return tx.type === 'credit';
                      if (txFilter === 'pending') return tx.type === 'hold';
                      if (txFilter === 'failed') return tx.type === 'failed';
                      return true;
                    })
                    .map((tx) => {
                      const isCredit = tx.type === 'credit';
                      const isHold = tx.type === 'hold';
                      const isFailed = tx.type === 'failed';
                      const isDebit = tx.type === 'debit';
                      const amountAbs = Math.abs(Number(tx.amount_cop || 0));
                      const createdAt = tx.created_at ? new Date(tx.created_at).toLocaleString() : '';
                      const label = tx.description || (tx.reference_type === 'voice_campaign_call' ? 'Cargo por llamada de voz' : 'Transacción');
                      const iconClass = isCredit
                        ? 'bg-green-100 text-green-600'
                        : isHold
                        ? 'bg-yellow-100 text-yellow-600'
                        : isFailed
                        ? 'bg-red-100 text-red-600'
                        : isDebit
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600';
                      const iconName = isCredit
                        ? 'solar:arrow-down-bold'
                        : isHold
                        ? 'solar:clock-circle-bold'
                        : isFailed
                        ? 'solar:close-circle-bold'
                        : isDebit
                        ? 'solar:arrow-up-bold'
                        : 'solar:dot-point-line-duotone';
                      const amountClass = isCredit
                        ? 'text-green-600'
                        : isHold
                        ? 'text-yellow-600'
                        : isFailed || isDebit
                        ? 'text-red-600'
                        : 'text-bodytext';
                      const sign = isCredit ? '+' : isDebit ? '-' : '';
                      return (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${iconClass}`}>
                              <Icon icon={iconName} width="20" />
                            </div>
                            <div>
                              <p className="font-medium text-dark dark:text-white">{label}</p>
                              <p className="text-sm text-bodytext">
                                {createdAt} {isHold ? '• Pendiente' : isFailed ? '• Fallida' : isDebit ? '• Gasto' : '• Ingreso'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${amountClass}`}>
                              {sign}{formatBalance(amountAbs)}
                            </p>
                            {typeof tx.balance_cop_after === 'number' && (
                              <div className="text-xs text-bodytext">Saldo: {formatBalance(tx.balance_cop_after)}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </CardBox>
          </Tabs.Item>

          {/* Tab Referidos - TEMPORALMENTE OCULTO */}
          {/*
          <Tabs.Item 
            title="Referidos" 
            icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" width="20" />}
          >
            <div className="space-y-6">
              {/* Estadísticas de Referidos *//*}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <CardBox>
                  <div className="text-center">
                    <Icon icon="solar:users-group-rounded-bold-duotone" width="40" className="mx-auto text-primary mb-2" />
                    <h3 className="text-xl font-bold text-dark dark:text-white">{referralStats.totalReferrals}</h3>
                    <p className="text-sm text-bodytext">Total Referidos</p>
                  </div>
                </CardBox>
                
                <CardBox>
                  <div className="text-center">
                    <Icon icon="solar:clock-circle-bold-duotone" width="40" className="mx-auto text-warning mb-2" />
                    <h3 className="text-xl font-bold text-dark dark:text-white">{referralStats.pendingReferrals}</h3>
                    <p className="text-sm text-bodytext">Pendientes</p>
                  </div>
                </CardBox>
                
                <CardBox>
                  <div className="text-center">
                    <Icon icon="solar:calendar-bold-duotone" width="40" className="mx-auto text-info mb-2" />
                    <h3 className="text-xl font-bold text-dark dark:text-white">{referralStats.thisMonthReferrals}</h3>
                    <p className="text-sm text-bodytext">Este Mes</p>
                  </div>
                </CardBox>
                
                <CardBox>
                  <div className="text-center">
                    <Icon icon="solar:money-bag-bold-duotone" width="40" className="mx-auto text-success mb-2" />
                    <h3 className="text-xl font-bold text-dark dark:text-white">{formatBalance(referralStats.totalEarnings)}</h3>
                    <p className="text-sm text-bodytext">Total Ganado</p>
                  </div>
                </CardBox>
              </div>

              {/* URL de Referido *//*}
              <CardBox>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon icon="solar:link-bold-duotone" width="24" />
                    Tu Enlace de Referido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={referralUrl}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      onClick={copyReferralUrl}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Icon icon="solar:copy-bold-duotone" width="20" />
                      Copiar
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={shareReferralUrl}
                      className="flex-1 flex items-center gap-2"
                    >
                      <Icon icon="solar:share-bold-duotone" width="20" />
                      Compartir
                    </Button>
                    <Button
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('¡Únete usando mi enlace de referido! ' + referralUrl)}`, '_blank')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Icon icon="solar:chat-round-bold-duotone" width="20" />
                      WhatsApp
                    </Button>
                    <Button
                      onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('¡Únete a esta increíble plataforma! ' + referralUrl)}`, '_blank')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Icon icon="solar:hashtag-bold-duotone" width="20" />
                      Twitter
                    </Button>
                  </div>
                </CardContent>
              </CardBox>

              {/* Información del Programa *//*}
              <CardBox>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon icon="solar:gift-bold-duotone" width="24" />
                    Programa de Referidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-primary text-white p-2 rounded-full">
                          <Icon icon="solar:dollar-bold" width="24" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-dark dark:text-white">¡Gana $50.000 COP por referido!</h4>
                          <p className="text-sm text-bodytext">Por cada plan anual que se registre con tu enlace</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h5 className="font-medium text-dark dark:text-white mb-2">Cómo funciona:</h5>
                        <ul className="space-y-1 text-bodytext">
                          <li>• Comparte tu enlace único</li>
                          <li>• Tu referido se registra y contrata plan anual</li>
                          <li>• Recibes $50.000 COP automáticamente</li>
                          <li>• Sin límite de referidos</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-dark dark:text-white mb-2">Condiciones:</h5>
                        <ul className="space-y-1 text-bodytext">
                          <li>• Solo planes anuales califican</li>
                          <li>• El pago debe completarse</li>
                          <li>• Comisión acreditada en 24-48h</li>
                          <li>• No se permite auto-referenciarse</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CardBox>

              {/* Historial de Referidos *//*}
              <CardBox>
                <CardHeader>
                  <CardTitle>Referidos Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: 'Carlos M.', date: '2024-08-07', status: 'completed', earnings: 50000 },
                      { name: 'Ana R.', date: '2024-08-05', status: 'completed', earnings: 50000 },
                      { name: 'Luis G.', date: '2024-08-03', status: 'pending', earnings: 50000 }
                    ].map((referral, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            referral.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            <Icon icon="solar:user-bold" width="16" />
                          </div>
                          <div>
                            <p className="font-medium text-dark dark:text-white">{referral.name}</p>
                            <p className="text-sm text-bodytext">{referral.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            referral.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {formatBalance(referral.earnings)}
                          </p>
                          <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'}>
                            {referral.status === 'completed' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CardBox>
            </div>
          </Tabs.Item>
          */}

          {/* Tab Gestionar */}
          <Tabs.Item 
            title="Gestionar" 
            icon={() => <Icon icon="solar:settings-bold-duotone" width="20" />}
          >
            <div className="max-w-md mx-auto">
              {/* Agregar Fondos */}
              <CardBox>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-center">
                    <Icon icon="solar:card-send-bold-duotone" width="24" />
                    Recargar Saldo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="addAmount">Cantidad (COP)</Label>
                    <Input
                      id="addAmount"
                      type="number"
                      placeholder="Ej: 100000"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleAddFunds} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Icon icon="solar:loading-line-duotone" width="20" className="animate-spin mr-2" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:add-circle-bold-duotone" width="20" className="mr-2" />
                        Agregar Fondos
                      </>
                    )}
                  </Button>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[50000, 100000, 250000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setAddAmount(amount.toString())}
                        className="text-xs"
                      >
                        ${(amount/1000)}K
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </CardBox>
            </div>

            {/* Información Adicional */}
            <CardBox className="mt-6">
              <CardHeader>
                <CardTitle>Información Importante</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-bodytext">
                  <p>• Las recargas se reflejan inmediatamente en tu saldo</p>
                  <p>• No hay comisiones por recargas</p>
                  <p>• El saldo pendiente se liberará automáticamente según los términos</p>
                  <p>• Puedes usar tu saldo para servicios dentro de la plataforma</p>
                </div>
              </CardContent>
            </CardBox>
          </Tabs.Item>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;

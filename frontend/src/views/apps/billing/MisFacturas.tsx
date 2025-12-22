import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Badge } from '../../../components/shadcn-ui/Default-Ui/badge';
import { Skeleton } from '../../../components/shadcn-ui/Default-Ui/skeleton';
import { 
  FileText, 
  Download, 
  Calendar, 
  CreditCard, 
  Users, 
  HardDrive,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../config/api';

interface Invoice {
  id: string;
  type: 'payment' | 'trial';
  date: string;
  description: string;
  period: string;
  users_count: number;
  storage_gb: number;
  modules: string[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: 'paid' | 'pending' | 'active' | 'expired';
}

const MisFacturas: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/saas/billing/invoices');
      if (response.data.success) {
        setInvoices(response.data.data || []);
      } else {
        setError(response.data.message || 'Error al cargar facturas');
      }
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err?.response?.data?.message || 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      setDownloadingId(invoiceId);
      const response = await api.get(`/saas/billing/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      
      // Crear URL del blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Factura-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      alert('Error al descargar la factura. Por favor intente de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Pagado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><CheckCircle className="w-3 h-3 mr-1" /> Activo</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" /> Expirado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly':
        return 'Mensual';
      case 'annual':
        return 'Anual';
      case 'trial':
        return 'Prueba';
      default:
        return period;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <XCircle className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">Error al cargar facturas</h3>
                <p className="text-sm">{error}</p>
              </div>
            </div>
            <Button 
              onClick={fetchInvoices} 
              variant="outline" 
              className="mt-4"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Facturas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Historial de pagos y facturas de tu suscripción
          </p>
        </div>
        <Button 
          onClick={() => navigate('/apps/billing/suscripcion')}
          variant="outline"
          className="gap-2"
        >
          Ver mi suscripción
          <ArrowUpRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Facturas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CreditCard className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Pagado</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.status === 'paid' ? inv.total : 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Última Factura</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {invoices.length > 0 ? formatDate(invoices[0].date) : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historial de Facturas
          </CardTitle>
          <CardDescription>
            Todas tus facturas y comprobantes de pago
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay facturas aún
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Cuando realices tu primer pago, aparecerá aquí tu factura.
              </p>
              <Button onClick={() => navigate('/apps/billing/suscripcion')}>
                Ver planes disponibles
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-4 mb-4 sm:mb-0">
                    <div className={`p-3 rounded-lg ${
                      invoice.type === 'trial' 
                        ? 'bg-purple-100 dark:bg-purple-900/30' 
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {invoice.type === 'trial' ? (
                        <Clock className={`w-5 h-5 ${
                          invoice.type === 'trial' 
                            ? 'text-purple-600 dark:text-purple-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {invoice.id}
                        </span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {invoice.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(invoice.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {invoice.users_count} usuarios
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {invoice.storage_gb} GB
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="text-right flex-1 sm:flex-none">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(invoice.total)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getPeriodLabel(invoice.period)}
                      </p>
                    </div>
                    {invoice.type !== 'trial' && invoice.status === 'paid' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        disabled={downloadingId === invoice.id}
                      >
                        {downloadingId === invoice.id ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            Descargando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            PDF
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                ¿Necesitas ayuda con tu facturación?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Nuestro equipo de soporte está disponible para resolver tus dudas sobre pagos y facturas.
              </p>
            </div>
            <Button variant="outline" className="whitespace-nowrap">
              Contactar Soporte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MisFacturas;

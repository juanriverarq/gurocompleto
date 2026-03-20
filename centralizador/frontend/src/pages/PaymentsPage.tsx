import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Wallet } from 'lucide-react';

interface PaymentSummary {
  byStatus: Array<{ status: string; _count: number; _sum: { amountDue: number; amountPaid: number; balance: number } }>;
  totals: { _sum: { amountDue: number; amountPaid: number; balance: number }; _count: number };
}

export function PaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/stats/summary').then((res) => {
      setSummary(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, string> = { PENDING: 'Pendiente', PARTIAL: 'Parcial', PAID: 'Pagado', OVERDUE: 'Vencido', CANCELLED: 'Cancelado' };
  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', PARTIAL: 'bg-blue-100 text-blue-700', PAID: 'bg-green-100 text-green-700', OVERDUE: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-600' };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cartera</h1>
        <p className="text-sm text-gray-500 mt-1">Pagos y recaudos de todas las aseguradoras</p>
      </div>

      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Total Por Cobrar</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totals._sum.amountDue)}</p>
              <p className="text-xs text-gray-400 mt-1">{summary.totals._count} pagos</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Recaudado</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totals._sum.amountPaid)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Saldo Pendiente</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(summary.totals._sum.balance)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Por Estado</h2>
            {summary.byStatus.length === 0 ? (
              <div className="py-8 text-center">
                <Wallet className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm text-gray-500">Sin datos de cartera. Sincroniza una aseguradora para ver pagos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[s.status] || 'bg-gray-100'}`}>
                        {statusLabel[s.status] || s.status}
                      </span>
                      <span className="text-sm text-gray-500">{s._count} pagos</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(s._sum.balance)}</p>
                      <p className="text-xs text-gray-400">pendiente</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">Conecta una aseguradora para ver datos de cartera</p>
        </div>
      )}
    </div>
  );
}

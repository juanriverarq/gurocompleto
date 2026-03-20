import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { HandCoins } from 'lucide-react';

interface CommissionSummary {
  byStatus: Array<{ status: string; _count: number; _sum: { commissionAmount: number } }>;
  totals: { _sum: { commissionAmount: number }; _count: number };
}

export function CommissionsPage() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/commissions/stats/summary').then((res) => {
      setSummary(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, string> = { PENDING: 'Pendiente', RECEIVED: 'Recibida', PARTIAL: 'Parcial' };
  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', RECEIVED: 'bg-green-100 text-green-700', PARTIAL: 'bg-blue-100 text-blue-700' };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-sm text-gray-500 mt-1">Comisiones de todas las aseguradoras conectadas</p>
      </div>

      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Total Comisiones</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totals._sum.commissionAmount)}</p>
              <p className="text-xs text-gray-400 mt-1">{summary.totals._count} registros</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Pendientes por Cobrar</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {formatCurrency(summary.byStatus.find((s) => s.status === 'PENDING')?._sum.commissionAmount || 0)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Por Estado</h2>
            {summary.byStatus.length === 0 ? (
              <div className="py-8 text-center">
                <HandCoins className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm text-gray-500">Sin datos de comisiones</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[s.status] || 'bg-gray-100'}`}>
                        {statusLabel[s.status] || s.status}
                      </span>
                      <span className="text-sm text-gray-500">{s._count} comisiones</span>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(s._sum.commissionAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <HandCoins className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">Conecta una aseguradora para ver comisiones</p>
        </div>
      )}
    </div>
  );
}

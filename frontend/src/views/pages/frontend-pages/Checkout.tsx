import { useEffect, useState } from 'react';
import api from 'src/config/api';
import { Icon } from '@iconify/react';
import { numberFormat } from 'src/components/landingpage/pricing-calculator/modules';

const Checkout = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<any | null>(null);
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await api.get('/billing/status');
        const data = resp.data?.data || {};
        setHasActive(Boolean(data.has_active_subscription));
        setIntent(data.pending_intent || null);
      } catch (e: any) {
        setError(e?.message || 'Error cargando estado de suscripción');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="animate-pulse text-gray-500">Cargando checkout...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
      </div>
    );
  }

  if (hasActive) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
          Ya tienes una suscripción activa.
        </div>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          No encontramos una selección pendiente. Regresa a la página de precios para crear tu plan.
        </div>
      </div>
    );
  }

  const modules = Array.isArray(intent.modules) ? intent.modules : [];
  const totals = intent.totals || {};
  const period = intent.period;
  const extraSummary =
    period === 'monthly'
      ? (totals.subtotalMonthly as number) ?? 0
      : (totals.subtotalAnnual as number) ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 border rounded-lg bg-white">
            <h2 className="text-lg font-semibold mb-2">Tu plan</h2>
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">Periodo:</span>
                <span>{period === 'annual' ? 'Anual' : 'Mensual'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Usuarios:</span>
                <span>{intent.users_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Almacenamiento:</span>
                <span>{intent.storage_gb} GB</span>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-white">
            <h2 className="text-lg font-semibold mb-2">Módulos seleccionados</h2>
            {modules.length === 0 ? (
              <div className="text-sm text-gray-600">Sin módulos adicionales.</div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {modules.map((m: any, i: number) => (
                  <li key={i}>{typeof m === 'string' ? m : m?.name || JSON.stringify(m)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-white h-fit">
          <h3 className="text-lg font-semibold mb-3">Resumen</h3>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Subtotal ({period === 'annual' ? 'año' : 'mes'})</span>
            <span className="font-semibold">{numberFormat(extraSummary || 0)}</span>
          </div>
          <div className="border-t my-3" />
          <button
            onClick={async () => {
              try {
                const resp = await api.post('/billing/checkout-link', {});
                const url = resp.data?.data?.checkout_url;
                if (url) {
                  window.location.href = url;
                } else {
                  throw new Error('No se pudo generar link de pago');
                }
              } catch (e: any) {
                alert(e?.message || 'No se pudo iniciar el pago');
              }
            }}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg flex items-center justify-center gap-2"
          >
            <Icon icon="solar:wallet-bold" />
            Ir a pagar con Wompi
          </button>
          <p className="text-[11px] text-gray-500 mt-2">Serás redirigido a Wompi.</p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

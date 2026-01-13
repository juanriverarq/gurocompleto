import { useEffect, useState } from 'react';
import api from 'src/config/api';
import { Icon } from '@iconify/react';
import { numberFormat } from 'src/components/landingpage/pricing-calculator/modules';

const SURA_LOGO_URL =
  'https://www.sura.co/documents/43501/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717';

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
  const coupon = intent.coupon || null;
  const hasSuraCoupon = coupon?.code === 'SURA30';
  
  // Para Sura: usar subtotal SIN descuento 12%, luego aplicar solo 30% Sura
  const subtotalWithDiscount = (totals.subtotalAnnual as number) ?? 0;
  const discountAnnual = (totals.discountAnnual as number) ?? 0;
  const subtotalBeforeDiscount = subtotalWithDiscount + discountAnnual;
  
  const subtotal =
    period === 'monthly'
      ? (totals.subtotalMonthly as number) ?? 0
      : hasSuraCoupon ? subtotalBeforeDiscount : subtotalWithDiscount;
  
  // Calcular descuento Sura (30% solo en plan anual, sin el 12%)
  const suraDiscountAmount = hasSuraCoupon && period === 'annual' ? Math.round(subtotal * 0.30) : 0;
  const totalFinal = subtotal - suraDiscountAmount;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Banner Sura */}
      {hasSuraCoupon && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0033A0] to-[#00A1E4] p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={SURA_LOGO_URL}
                alt="Logo SURA"
                className="h-10 w-auto"
              />
              <div className="h-8 w-px bg-white/30 hidden sm:block" />
              <div>
                <p className="text-white/80 text-xs font-medium">Convenio exclusivo</p>
                <h2 className="text-white text-lg font-bold">SURA + Guro</h2>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-white text-sm font-bold">30% OFF</span>
              <span className="text-white/90 text-xs">aplicado</span>
            </div>
          </div>
        </div>
      )}

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
            <span className="font-semibold">{numberFormat(subtotal || 0)}</span>
          </div>
          {hasSuraCoupon && suraDiscountAmount > 0 && (
            <div className="flex justify-between text-sm text-[#00A1E4] font-medium mt-2">
              <span>Cupón SURA30 (-30%)</span>
              <span>-{numberFormat(suraDiscountAmount)}</span>
            </div>
          )}
          <div className="border-t my-3" />
          <div className="flex justify-between text-base font-bold mb-3">
            <span>Total a pagar</span>
            <span className={hasSuraCoupon ? 'text-[#00A1E4]' : 'text-primary'}>
              {numberFormat(totalFinal)}
            </span>
          </div>
          {hasSuraCoupon && (
            <div className="text-xs text-gray-400 line-through text-right mb-3">
              Antes: {numberFormat(subtotal)}
            </div>
          )}
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

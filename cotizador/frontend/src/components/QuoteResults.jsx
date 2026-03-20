import React, { useState, useEffect } from 'react';
import { BarChart3, Shield, AlertCircle, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, Car } from 'lucide-react';
import * as api from '../api';

export default function QuoteResults({ quote }) {
  const [quoteData, setQuoteData] = useState(quote);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!quote?.quoteId) return;
    if (quote.status === 'processing') {
      setPolling(true);
      const interval = setInterval(async () => {
        try {
          const updated = await api.getQuote(quote.quoteId);
          setQuoteData(updated);
          if (updated.status === 'completed' || updated.status === 'error') {
            setPolling(false);
            clearInterval(interval);
          }
        } catch {
          // keep polling
        }
      }, 2000);
      return () => clearInterval(interval);
    }
    setQuoteData(quote);
  }, [quote]);

  if (!quote) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin resultados</h3>
          <p className="text-sm text-slate-500">Realice una cotización para ver los resultados aquí</p>
        </div>
      </div>
    );
  }

  const formatPrice = (p) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(p);

  const data = quoteData || quote;
  const results = data.results || [];
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Resultados de Cotización</h2>
          {data.vehicle && (
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <Car className="w-4 h-4" />
              {data.vehicle?.brand} {data.vehicle?.line} {data.vehicle?.model}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data.status === 'processing' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              <span className="text-sm font-medium text-amber-700">
                Cotizando... ({data.completedInsurers || 0}/{data.totalInsurers || 0})
              </span>
            </div>
          )}
          {data.status === 'completed' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Completado</span>
            </div>
          )}
          {data.status === 'error' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">{data.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Comparador de planes */}
      {successResults.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {successResults.map((result, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Insurer header */}
              <div className="px-5 py-4 border-b border-slate-100" style={{ borderTopColor: result.insurerColor || '#6366f1', borderTopWidth: '3px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{result.insurer || result.methodId}</h3>
                    <p className="text-xs text-slate-500">{result.plans?.length || 0} plan(es) disponibles</p>
                  </div>
                </div>
              </div>

              {/* Plans */}
              <div className="p-5">
                {(result.plans || []).map((plan, pi) => (
                  <div key={pi} className={`${pi > 0 ? 'mt-4 pt-4 border-t border-slate-100' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-800">{plan.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-indigo-600">{formatPrice(plan.premium)}</span>
                      <span className="text-xs text-slate-400">/año</span>
                    </div>
                    {plan.deductible > 0 && (
                      <p className="text-xs text-slate-500 mt-1">Deducible: {formatPrice(plan.deductible)}</p>
                    )}
                    {plan.coverages?.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {plan.coverages.slice(0, 5).map((cov, ci) => (
                          <div key={ci} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{cov.name}</span>
                            <span className="text-slate-800 font-medium">
                              {cov.value ? formatPrice(cov.value) : cov.limit || '-'}
                            </span>
                          </div>
                        ))}
                        {plan.coverages.length > 5 && (
                          <p className="text-xs text-indigo-500 font-medium">+{plan.coverages.length - 5} coberturas más</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!result.plans || result.plans.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Sin planes disponibles</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : data.status === 'completed' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center mb-6">
          <AlertCircle className="w-12 h-12 text-amber-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin cotizaciones exitosas</h3>
          <p className="text-sm text-slate-500">Ninguna aseguradora retornó cotizaciones. Verifique las conexiones.</p>
        </div>
      ) : null}

      {/* Failed connections */}
      {failedResults.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            Conexiones con error ({failedResults.length})
          </h3>
          <div className="space-y-2">
            {failedResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <span className="text-sm font-medium text-red-800">{r.insurer || r.methodId}</span>
                <span className="text-xs text-red-600">{r.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

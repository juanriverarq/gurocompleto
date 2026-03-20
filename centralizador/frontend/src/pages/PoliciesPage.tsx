import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { FileText, Search, ChevronLeft, ChevronRight, X, Shield, Car, User, Building2, CreditCard, Loader2 } from 'lucide-react';

interface Policy {
  id: string;
  policyNumber: string;
  branch: string;
  branchCode: string;
  product: string;
  status: string;
  holderName: string;
  holderDocument: string;
  holderDocumentType: string;
  insuredName: string;
  insuredDocument: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  premium: number;
  totalAmount: number;
  commissionAmount: number;
  paymentMethod: string;
  office: string;
  channel: string;
  rawData: any;
  insurer: { slug: string; name: string };
  client: any;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, [pagination.page]);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/policies', {
        params: { page: pagination.page, limit: pagination.limit, search: search || undefined },
      });
      setPolicies(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (policy: Policy) => {
    setSelectedPolicy(policy);
    if (!policy.rawData?._detail) {
      setDetailLoading(true);
      try {
        const res = await api.get(`/policies/${policy.id}`);
        setSelectedPolicy(res.data.data);
      } catch (err) {
        console.error('Error loading detail:', err);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchPolicies();
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    VIGENTE: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    SUSPENDED: 'bg-orange-100 text-orange-700',
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Vigente',
    VIGENTE: 'Vigente',
    EXPIRED: 'Vencida',
    CANCELLED: 'Cancelada',
    PENDING: 'Pendiente',
    SUSPENDED: 'Suspendida',
  };

  const detail = selectedPolicy?.rawData?._detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pólizas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pagination.total} pólizas de todas las aseguradoras
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, tomador, documento..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        ) : policies.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">No se encontraron pólizas. Sincroniza una aseguradora primero.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Aseguradora</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nº Póliza</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ramo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Tomador</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Vigencia</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Prima</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {policies.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                        {p.insurer.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{p.policyNumber}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.branch || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.product || '-'}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{p.holderName || '-'}</p>
                        <p className="text-[10px] text-gray-500">{p.holderDocument || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDate(p.startDate)} — {formatDate(p.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium">
                      {p.premium ? formatCurrency(p.premium) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-gray-500">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── DETAIL PANEL ─── */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelectedPolicy(null)}>
          <div
            className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Póliza {selectedPolicy.policyNumber}</h2>
                <p className="text-sm text-gray-500">{selectedPolicy.branch} — {selectedPolicy.product}</p>
              </div>
              <button onClick={() => setSelectedPolicy(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Status + dates */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusColor[selectedPolicy.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel[selectedPolicy.status] || selectedPolicy.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(selectedPolicy.startDate)} — {formatDate(selectedPolicy.endDate)}
                  </span>
                  {selectedPolicy.insurer && (
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{selectedPolicy.insurer.name}</span>
                  )}
                </div>

                {/* Tomador */}
                <DetailSection icon={User} title="Tomador">
                  <DetailRow label="Nombre" value={detail?.nombreTomador || selectedPolicy.holderName} />
                  <DetailRow label="Documento" value={`${detail?.tipoDniTomador || selectedPolicy.holderDocumentType || ''} ${(detail?.dniTomador || selectedPolicy.holderDocument || '').replace(/^[A-Z]/, '')}`} />
                  <DetailRow label="Teléfono" value={detail?.numeroTelefono} />
                  <DetailRow label="Dirección" value={detail?.direccion} />
                  <DetailRow label="Ciudad" value={detail?.ciudad} />
                </DetailSection>

                {/* Asegurado (if different from holder) */}
                {detail?.nombreAsegurado && detail.nombreAsegurado !== detail.nombreTomador && (
                  <DetailSection icon={Shield} title="Asegurado">
                    <DetailRow label="Nombre" value={detail.nombreAsegurado} />
                    <DetailRow label="Documento" value={`${detail.tipoDniAsegurado || ''} ${(detail.dniAsegurado || '').replace(/^[A-Z]/, '')}`} />
                    <DetailRow label="Correo" value={detail.correoAsegurado} />
                  </DetailSection>
                )}

                {/* Beneficiario */}
                {detail?.nombreBeneficiario && detail.nombreBeneficiario !== detail.nombreTomador && (
                  <DetailSection icon={User} title="Beneficiario">
                    <DetailRow label="Nombre" value={detail.nombreBeneficiario} />
                    <DetailRow label="Documento" value={`${detail.tipoDniBenficiario || ''} ${(detail.dniBenficiario || '').replace(/^[A-Z]/, '')}`} />
                  </DetailSection>
                )}

                {/* Vehicle info (autos) */}
                {detail?.placa && (
                  <DetailSection icon={Car} title="Vehículo">
                    <DetailRow label="Placa" value={detail.placa} highlight />
                    <DetailRow label="Marca / Modelo" value={detail.marca} />
                    <DetailRow label="Año" value={detail.modelo} />
                    <DetailRow label="Motor" value={detail.motor} />
                    <DetailRow label="Chasis" value={detail.chasis} />
                    <DetailRow label="Valor Vehículo" value={detail.valorVehiculo} />
                    <DetailRow label="Zona" value={detail.zona} />
                    <DetailRow label="Municipio" value={detail.municipio} />
                    <DetailRow label="Fasecolda" value={detail.cdFaseColda} />
                  </DetailSection>
                )}

                {/* Policy details */}
                <DetailSection icon={Building2} title="Información de la Póliza">
                  <DetailRow label="Número" value={selectedPolicy.policyNumber} highlight />
                  <DetailRow label="Plan" value={detail?.plan || selectedPolicy.product} />
                  <DetailRow label="Tipo" value={detail?.tipoPoliza} />
                  <DetailRow label="Oficina" value={detail?.oficina || selectedPolicy.office} />
                  <DetailRow label="Canal" value={selectedPolicy.channel} />
                  <DetailRow label="Expedición" value={detail?.fechaExpedicion ? formatDate(detail.fechaExpedicion) : formatDate(selectedPolicy.issueDate)} />
                  <DetailRow label="Financiada" value={detail?.snFinanciada === 'S' ? 'Sí' : detail?.snFinanciada === 'N' ? 'No' : undefined} />
                  <DetailRow label="Bonificación" value={detail?.bonificacion && detail.bonificacion !== '0.0' ? detail.bonificacion + '%' : undefined} />
                </DetailSection>

                {/* Prima / Payment */}
                <DetailSection icon={CreditCard} title="Prima y Pago">
                  <DetailRow label="Prima" value={detail?.ptprimaformapago ? `$${detail.ptprimaformapago}` : formatCurrency(selectedPolicy.premium || selectedPolicy.totalAmount)} highlight />
                  <DetailRow label="IVA Prima" value={detail?.ptPrimaFormaPagoIva ? `$${detail.ptPrimaFormaPagoIva}` : undefined} />
                  <DetailRow label="Forma de Pago" value={detail?.formaPago || selectedPolicy.paymentMethod} />
                </DetailSection>

                {/* Coberturas */}
                {detail?.coberturas && detail.coberturas.length > 0 && (
                  <DetailSection icon={Shield} title={`Coberturas (${detail.coberturas.length})`}>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Tipo</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Cobertura</th>
                            <th className="px-2 py-1.5 text-right font-medium text-gray-500">Deducible</th>
                            <th className="px-2 py-1.5 text-right font-medium text-gray-500">Valor Asegurado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.coberturas.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-gray-600">{c.tipoCobertura}</td>
                              <td className="px-2 py-1.5 font-medium text-gray-800">{c.nombreCobertura}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600">{c.porcentajeDeducibleMinimo}</td>
                              <td className="px-2 py-1.5 text-right font-medium">{c.ptaAsegurado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>
                )}

                {/* Asesores */}
                {detail?.asesores && detail.asesores.length > 0 && (
                  <DetailSection icon={User} title="Asesores">
                    {detail.asesores.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-800">{a.nombre?.trim()} <span className="text-gray-400 text-xs">(Cód. {a.codigo})</span></span>
                        <span className="text-xs text-gray-500">{a.porcentajeParticipacion}%{a.esLider === 'S' ? ' — Líder' : ''}</span>
                      </div>
                    ))}
                  </DetailSection>
                )}

                {/* No detail available */}
                {!detail && (
                  <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                    No hay detalle disponible para esta póliza. Sincroniza de nuevo para obtener la información completa.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b">
        <Icon className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value || value.trim() === '' || value.trim() === '-') return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-right ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

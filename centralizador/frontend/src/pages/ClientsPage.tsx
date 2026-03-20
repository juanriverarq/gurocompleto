import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Client {
  id: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string | null;
  cellphone: string | null;
  city: string | null;
  _count: { policies: number };
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchClients(); }, [pagination.page]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients', {
        params: { page: pagination.page, limit: pagination.limit, search: search || undefined },
      });
      setClients(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500 mt-1">{pagination.total} clientes unificados de todas las aseguradoras</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, documento, email..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90">Buscar</button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">No se encontraron clientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Documento</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Celular</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ciudad</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Pólizas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="text-xs text-gray-400 mr-1">{c.documentType}</span>
                      {c.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.cellphone || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.city || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                        {c._count.policies}
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
            <p className="text-sm text-gray-500">Página {pagination.page} de {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.totalPages} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

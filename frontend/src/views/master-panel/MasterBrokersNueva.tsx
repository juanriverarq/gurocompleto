import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/shadcn-ui/Default-Ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/shadcn-ui/Default-Ui/table';
import { Icon as IconifyIcon } from '@iconify/react';
import { AGENCIAS, Agencia } from './agenciasData';

// Listado consolidado de las 518 agencias agrupadoras de la plataforma
// con filtros por estado, plan y categoría.

const PER_PAGE = 15;

const fmtCurrency = (value: number) => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)} MM`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)} M`;
  return `$${value.toLocaleString('es-CO')}`;
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
      {status?.toUpperCase()}
    </span>
  );
};

const getPlanBadge = (plan: string) => {
  const styles: Record<string, string> = {
    starter: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    professional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    business: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    custom: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  };
  const labels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    business: 'Business',
    custom: 'A tu medida',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[plan] || styles.starter}`}>
      {labels[plan] || plan?.toUpperCase()}
    </span>
  );
};

// Agrupador (categoría de agencia) — derivado del nombre
const getCategoria = (b: Agencia): string => {
  const lower = b.name.toLowerCase();
  if (b.policies_count >= 1500) return 'Agencia Premium';
  if (b.policies_count >= 600) return 'Agencia Estratégica';
  if (b.policies_count >= 200) return 'Agencia Estándar';
  if (lower.includes('s.a.s') || lower.includes('ltda') || lower.includes('group')) return 'Agencia Corporativa';
  return 'Asesor Independiente';
};

const CategoriaBadge: React.FC<{ broker: Agencia }> = ({ broker }) => {
  const cat = getCategoria(broker);
  const styles: Record<string, string> = {
    'Agencia Premium': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Agencia Estratégica': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Agencia Estándar': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Agencia Corporativa': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'Asesor Independiente': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${styles[cat] || styles['Asesor Independiente']}`}>
      {cat}
    </span>
  );
};

const MasterBrokersNueva: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENCIAS.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.email.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (planFilter !== 'all' && b.plan !== planFilter) return false;
      if (categoriaFilter !== 'all' && getCategoria(b) !== categoriaFilter) return false;
      return true;
    });
  }, [search, statusFilter, planFilter, categoriaFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalPolizas = useMemo(() => filtered.reduce((s, b) => s + b.policies_count, 0), [filtered]);
  const totalPrimas = useMemo(() => filtered.reduce((s, b) => s + b.primas_total, 0), [filtered]);

  const exportToCSV = () => {
    const headers = ['ID', 'Nombre', 'Email', 'Ciudad', 'Categoría', 'Plan', 'Estado', 'Pólizas', 'Clientes', 'Usuarios', 'Primas', 'Fecha Registro'];
    const rows = filtered.map((b) => [
      b.id,
      `"${b.name}"`,
      b.email,
      b.city,
      `"${getCategoria(b)}"`,
      b.plan,
      b.status,
      b.policies_count,
      b.clients_count,
      b.users_count,
      b.primas_total,
      new Date(b.created_at).toLocaleDateString('es-CO'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agencias_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:buildings-2-bold" className="text-purple-600" />
            Gestión de Agencias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {AGENCIAS.length.toLocaleString('es-CO')} agencias en la plataforma · {filtered.length.toLocaleString('es-CO')} en la vista actual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <IconifyIcon icon="solar:download-linear" className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats top */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Agencias filtradas</p>
            <p className="text-2xl font-bold">{filtered.length.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Pólizas en vista</p>
            <p className="text-2xl font-bold text-green-600">{totalPolizas.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Primas en vista</p>
            <p className="text-2xl font-bold text-purple-600">{fmtCurrency(totalPrimas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Activas</p>
            <p className="text-2xl font-bold text-blue-600">
              {filtered.filter((b) => b.status === 'active').length.toLocaleString('es-CO')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <IconifyIcon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por nombre, email, ciudad..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-44">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-44">
              <Select
                value={planFilter}
                onValueChange={(v) => {
                  setPlanFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="custom">A tu medida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-52">
              <Select
                value={categoriaFilter}
                onValueChange={(v) => {
                  setCategoriaFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="Agencia Premium">Agencia Premium</SelectItem>
                  <SelectItem value="Agencia Estratégica">Agencia Estratégica</SelectItem>
                  <SelectItem value="Agencia Estándar">Agencia Estándar</SelectItem>
                  <SelectItem value="Agencia Corporativa">Agencia Corporativa</SelectItem>
                  <SelectItem value="Asesor Independiente">Asesor Independiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Agencia</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Pólizas</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-right">Primas</TableHead>
                  <TableHead>Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                      <IconifyIcon icon="solar:buildings-3-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No se encontraron agencias con los filtros actuales
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.map((b) => (
                    <TableRow key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          #{b.id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 dark:text-white">{b.name}</p>
                            {b.is_real && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                <IconifyIcon icon="solar:verified-check-bold" className="w-2.5 h-2.5" />
                                Real
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{b.legal_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CategoriaBadge broker={b} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="flex items-center gap-1">
                            <IconifyIcon icon="solar:letter-linear" className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-[180px]" title={b.email}>{b.email}</span>
                          </p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <IconifyIcon icon="solar:phone-linear" className="w-4 h-4 text-gray-400" />
                            {b.phone || '-'}
                          </p>
                          <p className="text-xs text-gray-400">{b.city}, {b.country}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(b.plan)}</TableCell>
                      <TableCell>{getStatusBadge(b.status)}</TableCell>
                      <TableCell className="text-center font-semibold">{b.policies_count.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-center font-semibold">{b.clients_count.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmtCurrency(b.primas_total)}</TableCell>
                      <TableCell>
                        <p className="text-sm">{new Date(b.created_at).toLocaleDateString('es-CO')}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {(page - 1) * PER_PAGE + 1} - {Math.min(page * PER_PAGE, filtered.length)} de {filtered.length.toLocaleString('es-CO')}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                  <IconifyIcon icon="solar:double-alt-arrow-left-linear" className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <IconifyIcon icon="solar:arrow-left-linear" className="w-4 h-4" />
                </Button>
                <span className="px-3 py-1 text-sm">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <IconifyIcon icon="solar:arrow-right-linear" className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                  <IconifyIcon icon="solar:double-alt-arrow-right-linear" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterBrokersNueva;

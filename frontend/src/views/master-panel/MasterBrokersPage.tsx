import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
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
import masterPanelService from '../../services/masterPanelService';

interface Broker {
  id: number;
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  plan: string;
  status: string;
  policies_count: number;
  clients_count: number;
  users_count: number;
  created_at: string;
  trial_ends_at: string | null;
}

const MasterBrokersPage: React.FC = () => {
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBrokers, setTotalBrokers] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadBrokers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getBrokers({
        search,
        status: statusFilter === 'all' ? '' : statusFilter,
        plan: planFilter === 'all' ? '' : planFilter,
        page: currentPage,
        per_page: 15,
      });

      if (response.success) {
        setBrokers(response.data.data || []);
        setTotalPages(response.data.last_page || 1);
        setTotalBrokers(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading brokers:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, planFilter, currentPage]);

  useEffect(() => {
    loadBrokers();
  }, [loadBrokers]);

  const handleToggleStatus = async (brokerId: number) => {
    setActionLoading(brokerId);
    try {
      const response = await masterPanelService.toggleBrokerStatus(brokerId);
      if (response.success) {
        loadBrokers();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setActionLoading(null);
    }
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
      basic: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      pro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      enterprise: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[plan] || styles.basic}`}>
        {plan?.toUpperCase() || 'BASIC'}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nombre', 'Email', 'Ciudad', 'Plan', 'Estado', 'Pólizas', 'Clientes', 'Usuarios', 'Fecha Registro'];
    const rows = brokers.map(b => [
      b.id,
      b.name,
      b.email,
      b.city,
      b.plan,
      b.status,
      b.policies_count,
      b.clients_count,
      b.users_count,
      new Date(b.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brokers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:buildings-2-bold" className="text-purple-600" />
            Gestión de Brokers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalBrokers} brokers registrados en la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadBrokers}>
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <IconifyIcon icon="solar:download-linear" className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <IconifyIcon icon="solar:add-circle-linear" className="w-4 h-4 mr-2" />
            Nuevo Broker
          </Button>
        </div>
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
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
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
            <div className="w-full md:w-48">
              <Select value={planFilter} onValueChange={(value) => { setPlanFilter(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Pólizas</TableHead>
                      <TableHead className="text-center">Clientes</TableHead>
                      <TableHead className="text-center">Usuarios</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brokers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                          <IconifyIcon icon="solar:buildings-3-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          No se encontraron brokers
                        </TableCell>
                      </TableRow>
                    ) : (
                      brokers.map((broker) => (
                        <TableRow key={broker.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell>
                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              #{broker.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{broker.name}</p>
                              <p className="text-xs text-gray-500">{broker.legal_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="flex items-center gap-1">
                                <IconifyIcon icon="solar:letter-linear" className="w-4 h-4 text-gray-400" />
                                {broker.email}
                              </p>
                              <p className="text-gray-500 flex items-center gap-1">
                                <IconifyIcon icon="solar:phone-linear" className="w-4 h-4 text-gray-400" />
                                {broker.phone || '-'}
                              </p>
                              <p className="text-xs text-gray-400">{broker.city}, {broker.country}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getPlanBadge(broker.plan)}</TableCell>
                          <TableCell>{getStatusBadge(broker.status)}</TableCell>
                          <TableCell className="text-center font-semibold">{broker.policies_count?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-center font-semibold">{broker.clients_count?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-center">{broker.users_count || 0}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{new Date(broker.created_at).toLocaleDateString()}</p>
                              {broker.trial_ends_at && (
                                <p className="text-xs text-orange-500">
                                  Trial: {new Date(broker.trial_ends_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/master-panel/brokers/${broker.id}/detalle`)}
                                title="Ver detalle completo"
                              >
                                <IconifyIcon icon="solar:eye-linear" className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/master-panel/brokers/${broker.id}/editar`)}
                                title="Editar"
                              >
                                <IconifyIcon icon="solar:pen-linear" className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(broker.id)}
                                disabled={actionLoading === broker.id}
                                title={broker.status === 'active' ? 'Suspender' : 'Activar'}
                                className={broker.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                              >
                                {actionLoading === broker.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : broker.status === 'active' ? (
                                  <IconifyIcon icon="solar:close-circle-linear" className="w-4 h-4" />
                                ) : (
                                  <IconifyIcon icon="solar:check-circle-linear" className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-gray-500">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <IconifyIcon icon="solar:arrow-left-linear" className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <IconifyIcon icon="solar:arrow-right-linear" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterBrokersPage;

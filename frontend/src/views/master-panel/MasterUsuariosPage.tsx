import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../components/shadcn-ui/Default-Ui/card';
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

interface Usuario {
  id: number;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  role: string;
  status: string;
  broker_id: number;
  broker_name?: string;
  last_login_at: string | null;
  created_at: string;
}

const MasterUsuariosPage: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getUsuarios({
        search,
        user_type: userTypeFilter === 'all' ? '' : userTypeFilter,
        status: statusFilter === 'all' ? '' : statusFilter,
        page: currentPage,
        per_page: 20,
      });

      if (response.success) {
        setUsuarios(response.data.data || []);
        setTotalPages(response.data.last_page || 1);
        setTotalUsuarios(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading usuarios:', error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [search, userTypeFilter, statusFilter, currentPage]);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status?.toUpperCase() || 'N/A'}
      </span>
    );
  };

  const getUserTypeBadge = (userType: string) => {
    const styles: Record<string, string> = {
      MASTER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      ADMIN: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      EMPLEADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      USUARIO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[userType] || styles.USUARIO}`}>
        {userType || 'N/A'}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nombre', 'Email', 'Tipo', 'Rol', 'Estado', 'Broker ID', 'Último Login', 'Registro'];
    const rows = usuarios.map(u => [
      u.id,
      u.name,
      u.email,
      u.user_type,
      u.role,
      u.status,
      u.broker_id || '',
      u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '',
      new Date(u.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:users-group-two-rounded-bold" className="text-blue-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalUsuarios} usuarios en toda la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadUsuarios}>
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <IconifyIcon icon="solar:download-linear" className="w-4 h-4 mr-2" />
            Exportar
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
                  placeholder="Buscar por nombre, email..."
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
              <Select value={userTypeFilter} onValueChange={(value) => { setUserTypeFilter(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="MASTER">Master</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="EMPLEADO">Empleado</SelectItem>
                  <SelectItem value="USUARIO">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                          <IconifyIcon icon="solar:users-group-rounded-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          No se encontraron usuarios
                        </TableCell>
                      </TableRow>
                    ) : (
                      usuarios.map((usuario) => (
                        <TableRow key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                {usuario.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{usuario.name}</p>
                                <p className="text-xs text-gray-500">ID: {usuario.id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              <p className="flex items-center gap-1">
                                <IconifyIcon icon="solar:letter-linear" className="w-4 h-4 text-gray-400" />
                                {usuario.email}
                              </p>
                              {usuario.phone && (
                                <p className="flex items-center gap-1 text-gray-500">
                                  <IconifyIcon icon="solar:phone-linear" className="w-4 h-4 text-gray-400" />
                                  {usuario.phone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getUserTypeBadge(usuario.user_type)}</TableCell>
                          <TableCell>
                            <span className="text-sm">{usuario.role || '-'}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(usuario.status)}</TableCell>
                          <TableCell>
                            {usuario.broker_id ? (
                              <span className="flex items-center gap-1 text-sm">
                                <IconifyIcon icon="solar:buildings-linear" className="w-4 h-4 text-gray-400" />
                                {usuario.broker_name || `#${usuario.broker_id}`}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {usuario.last_login_at
                                ? new Date(usuario.last_login_at).toLocaleString()
                                : 'Nunca'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(usuario.created_at).toLocaleDateString()}
                            </span>
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

export default MasterUsuariosPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Spinner, Badge, Table, Modal, Avatar } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label as ShLabel } from 'src/components/shadcn-ui/Default-Ui/label';
import {
  Select as ShSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'src/components/shadcn-ui/Default-Ui/select';
import { salesFunnelService } from 'src/services/salesFunnelService';
import salesTeamsService from 'src/services/salesTeamsService';
import { useVendedores } from 'src/hooks/useAdminCrudApi';

interface Miembro {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: 'Líder' | 'Asesor Senior' | 'Asesor Junior' | 'Trainee';
  ventasMes: number;
  metaMes: number;
  porcentajeMeta: number;
  fechaIngreso: string;
  estado: 'Activo' | 'Inactivo' | 'Vacaciones';
}

interface Equipo {
  id: string;
  nombre: string;
  descripcion: string;
  lider: string;
  liderUserId?: number;
  miembros: Miembro[];
  metaEquipo: number;
  ventasEquipo: number;
  porcentajeEquipo: number;
  territorio: string;
  especialidad: string;
  fechaCreacion: string;
  estado: 'Activo' | 'Inactivo' | 'Reestructuración';
}

const mockEquipos: Equipo[] = [];

const EquiposVentas = () => {
  const [equipos, setEquipos] = useState<Equipo[]>(mockEquipos);
  const [loading, setLoading] = useState(false);
  const [showModalEquipo, setShowModalEquipo] = useState(false);
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [showModalMiembro, setShowModalMiembro] = useState(false);
  // const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>('');
  const [equipoIdGestion, setEquipoIdGestion] = useState<string>('');
  const [vistaActual, setVistaActual] = useState<'equipos' | 'miembros'>('equipos');

  const [nuevoEquipo, setNuevoEquipo] = useState({
    nombre: '',
    descripcion: '',
    lider: '',
    territorio: '',
    especialidad: '',
    metaEquipo: '',
  });

  const [editarEquipo, setEditarEquipo] = useState({
    id: '',
    nombre: '',
    descripcion: '',
    territorio: '',
    especialidad: '',
    estado: 'Activo',
  });

  // Estado no usado: nuevoMiembro

  const { vendedores: vendedoresHook } = useVendedores();
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: number; first_name: string; last_name: string; email?: string }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<
    'Líder' | 'Asesor Senior' | 'Asesor Junior' | 'Trainee'
  >('Asesor Junior');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  const [selectedEditLeaderId, setSelectedEditLeaderId] = useState<string>('');
  const [monthlyGoal, setMonthlyGoal] = useState<string>('');

  // Filtros y paginación (persistencia local)
  const LS_PER_PAGE_KEY = 'comercial_equipos_per_page';
  const [perPage, setPerPage] = useState<number>(() => {
    const stored = localStorage.getItem(LS_PER_PAGE_KEY);
    return stored ? parseInt(stored, 10) : 10;
  });
  useEffect(() => {
    localStorage.setItem(LS_PER_PAGE_KEY, String(perPage));
  }, [perPage]);

  // Estado de filtros para Equipos
  const [searchEquipo, setSearchEquipo] = useState<string>('');
  const [filtroEstadoEquipo, setFiltroEstadoEquipo] = useState<string>('todos');
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<string>('todas');
  const [pageEquipos, setPageEquipos] = useState<number>(1);

  // Estado de filtros para Miembros
  const [searchMiembro, setSearchMiembro] = useState<string>('');
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [filtroEstadoMiembro, setFiltroEstadoMiembro] = useState<string>('todos');
  const [pageMiembros, setPageMiembros] = useState<number>(1);
  const [sortKey, setSortKey] = useState<
    'miembro' | 'rol' | 'equipo' | 'metaMes' | 'ventasMes' | 'porcentajeMeta' | 'estado'
  >('miembro');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const estadoColors = {
    Activo: 'success',
    Inactivo: 'failure',
    Vacaciones: 'warning',
    Reestructuración: 'info',
  };

  const rolColors = {
    Líder: 'purple',
    'Asesor Senior': 'info',
    'Asesor Junior': 'success',
    Trainee: 'warning',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getProgressColor = (porcentaje: number) => {
    if (porcentaje >= 100) return 'green';
    if (porcentaje >= 80) return 'blue';
    if (porcentaje >= 60) return 'yellow';
    return 'red';
  };

  const totalVentas = equipos.reduce((sum, e) => sum + e.ventasEquipo, 0);
  const totalMetas = equipos.reduce((sum, e) => sum + e.metaEquipo, 0);
  const promedioEquipos = totalMetas > 0 ? (totalVentas / totalMetas) * 100 : 0;
  const totalMiembros = equipos.reduce((sum, e) => sum + e.miembros.length, 0);

  // Export helpers
  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportEquiposCsv = () => {
    const headers = [
      'Equipo',
      'Lider',
      'Miembros',
      'Territorio',
      'Especialidad',
      'Meta Equipo',
      'Ventas Equipo',
      '% Cumplimiento',
    ];
    const rows = equipos.map((e) => [
      e.nombre,
      e.lider,
      String(e.miembros.length),
      e.territorio,
      e.especialidad,
      String(e.metaEquipo),
      String(e.ventasEquipo),
      e.porcentajeEquipo.toFixed(1),
    ]);
    downloadCsv('equipos.csv', [headers, ...rows]);
  };

  const exportTeamMembersCsv = (equipo: Equipo) => {
    const headers = [
      'Equipo',
      'Miembro',
      'Email',
      'Rol',
      'Meta Mes',
      'Ventas Mes',
      '% Meta',
      'Estado',
    ];
    const rows = equipo.miembros.map((m) => [
      equipo.nombre,
      m.nombre,
      m.email || '',
      m.rol,
      String(m.metaMes || 0),
      String(m.ventasMes || 0),
      (m.porcentajeMeta ?? 0).toFixed(1),
      m.estado,
    ]);
    downloadCsv(`equipo_${equipo.nombre.replace(/\s+/g, '_')}_miembros.csv`, [headers, ...rows]);
  };

  const exportTeamMembersXls = (equipo: Equipo) => {
    const headers = [
      'Equipo',
      'Miembro',
      'Email',
      'Rol',
      'Meta Mes',
      'Ventas Mes',
      '% Meta',
      'Estado',
    ];
    const rows = equipo.miembros.map((m) => [
      equipo.nombre,
      m.nombre,
      m.email || '',
      m.rol,
      String(m.metaMes || 0),
      String(m.ventasMes || 0),
      (m.porcentajeMeta ?? 0).toFixed(1),
      m.estado,
    ]);
    const escapeHtml = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const thead = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const tbody = rows
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${thead}${tbody}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipo_${equipo.nombre.replace(/\s+/g, '_')}_miembros.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derivados: filtros, orden y paginación
  const especialidades = useMemo(() => {
    const set = new Set<string>();
    equipos.forEach((e) => set.add(e.especialidad));
    return Array.from(set);
  }, [equipos]);

  const vendedoresOptions = useMemo(() => {
    return (vendedoresHook || []).map((v: any) => ({
      id: String(v.id),
      nombre: v.nombres || v.nombre || v.name,
      email: v.email,
    }));
  }, [vendedoresHook]);

  const usuariosOptions = useMemo(() => {
    return availableUsers.map((u) => ({
      id: String(u.id),
      nombre: `${u.first_name} ${u.last_name}`,
      email: u.email,
    }));
  }, [availableUsers]);

  const filteredEquipos = useMemo(() => {
    return equipos.filter((e) => {
      const matchesSearch =
        searchEquipo.trim() === '' ||
        e.nombre.toLowerCase().includes(searchEquipo.toLowerCase()) ||
        e.descripcion.toLowerCase().includes(searchEquipo.toLowerCase()) ||
        e.territorio.toLowerCase().includes(searchEquipo.toLowerCase());
      const matchesEstado =
        filtroEstadoEquipo === 'todos' || e.estado === (filtroEstadoEquipo as any);
      const matchesEspecialidad =
        filtroEspecialidad === 'todas' || e.especialidad === filtroEspecialidad;
      return matchesSearch && matchesEstado && matchesEspecialidad;
    });
  }, [equipos, searchEquipo, filtroEstadoEquipo, filtroEspecialidad]);

  useEffect(() => {
    setPageEquipos(1);
  }, [searchEquipo, filtroEstadoEquipo, filtroEspecialidad]);

  const totalEquiposPages = Math.max(1, Math.ceil(filteredEquipos.length / perPage));
  const paginatedEquipos = useMemo(() => {
    const start = (pageEquipos - 1) * perPage;
    return filteredEquipos.slice(start, start + perPage);
  }, [filteredEquipos, pageEquipos, perPage]);

  type MiembroRow = Miembro & { equipoNombre: string };
  const allMiembros: MiembroRow[] = useMemo(() => {
    return equipos.flatMap((equipo) =>
      equipo.miembros.map((m) => ({ ...m, equipoNombre: equipo.nombre })),
    );
  }, [equipos]);

  const filteredMiembros = useMemo(() => {
    return allMiembros.filter((m) => {
      const s = searchMiembro.trim().toLowerCase();
      const matchesSearch =
        s === '' || m.nombre.toLowerCase().includes(s) || m.email.toLowerCase().includes(s);
      const matchesRol = filtroRol === 'todos' || m.rol === (filtroRol as any);
      const matchesEstado =
        filtroEstadoMiembro === 'todos' || m.estado === (filtroEstadoMiembro as any);
      return matchesSearch && matchesRol && matchesEstado;
    });
  }, [allMiembros, searchMiembro, filtroRol, filtroEstadoMiembro]);

  const sortedMiembros = useMemo(() => {
    const arr = [...filteredMiembros];
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'miembro':
          return a.nombre.localeCompare(b.nombre) * dir;
        case 'rol':
          return a.rol.localeCompare(b.rol) * dir;
        case 'equipo':
          return a.equipoNombre.localeCompare(b.equipoNombre) * dir;
        case 'metaMes':
          return (a.metaMes - b.metaMes) * dir;
        case 'ventasMes':
          return (a.ventasMes - b.ventasMes) * dir;
        case 'porcentajeMeta':
          return (a.porcentajeMeta - b.porcentajeMeta) * dir;
        case 'estado':
          return a.estado.localeCompare(b.estado) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredMiembros, sortKey, sortDir]);

  useEffect(() => {
    setPageMiembros(1);
  }, [searchMiembro, filtroRol, filtroEstadoMiembro]);

  // Sincronizar rol seleccionado cuando cambia el usuario seleccionado o el equipo
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedRole('Asesor Junior');
      return;
    }
    const equipo = equipos.find((e) => e.id === equipoIdGestion);
    const miembro = equipo?.miembros.find((m) => m.id === selectedUserId);
    setSelectedRole((miembro?.rol as any) || 'Asesor Junior');
  }, [selectedUserId, equipoIdGestion, equipos]);

  const totalMiembrosPages = Math.max(1, Math.ceil(sortedMiembros.length / perPage));
  const paginatedMiembros = useMemo(() => {
    const start = (pageMiembros - 1) * perPage;
    return sortedMiembros.slice(start, start + perPage);
  }, [sortedMiembros, pageMiembros, perPage]);

  const handleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportAllMembersCsv = () => {
    const headers = [
      'Equipo',
      'Miembro',
      'Email',
      'Rol',
      'Meta Mes',
      'Ventas Mes',
      '% Meta',
      'Estado',
    ];
    const rows: string[][] = [];
    equipos.forEach((equipo) => {
      equipo.miembros.forEach((m) => {
        rows.push([
          equipo.nombre,
          m.nombre,
          m.email || '',
          m.rol,
          String(m.metaMes || 0),
          String(m.ventasMes || 0),
          (m.porcentajeMeta ?? 0).toFixed(1),
          m.estado,
        ]);
      });
    });
    downloadCsv('equipos_miembros.csv', [headers, ...rows]);
  };

  const exportAllMembersXls = () => {
    const headers = [
      'Equipo',
      'Miembro',
      'Email',
      'Rol',
      'Meta Mes',
      'Ventas Mes',
      '% Meta',
      'Estado',
    ];
    const rows: string[][] = [];
    equipos.forEach((equipo) => {
      equipo.miembros.forEach((m) => {
        rows.push([
          equipo.nombre,
          m.nombre,
          m.email || '',
          m.rol,
          String(m.metaMes || 0),
          String(m.ventasMes || 0),
          (m.porcentajeMeta ?? 0).toFixed(1),
          m.estado,
        ]);
      });
    });
    const escapeHtml = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const thead = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const tbody = rows
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\" /></head><body><table>${thead}${tbody}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'equipos_miembros.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCrearEquipo = () => {
    const nuevo: Equipo = {
      id: Date.now().toString(),
      nombre: nuevoEquipo.nombre,
      descripcion: nuevoEquipo.descripcion,
      lider: nuevoEquipo.lider,
      miembros: [],
      metaEquipo: parseFloat(nuevoEquipo.metaEquipo),
      ventasEquipo: 0,
      porcentajeEquipo: 0,
      territorio: nuevoEquipo.territorio,
      especialidad: nuevoEquipo.especialidad,
      fechaCreacion: new Date().toISOString().split('T')[0],
      estado: 'Activo',
    };

    setEquipos([nuevo, ...equipos]);
    setShowModalEquipo(false);
    setNuevoEquipo({
      nombre: '',
      descripcion: '',
      lider: '',
      territorio: '',
      especialidad: '',
      metaEquipo: '',
    });
  };

  // Cargar equipos persistidos
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Intentar listar equipos
        const existing = await salesTeamsService.list({ per_page: 50 });
        if (existing?.data && existing.data.length > 0) {
          const equiposApi: Equipo[] = (existing.data || []).map((t: any) => ({
            id: String(t.id),
            nombre: t.name,
            descripcion: t.description || '',
            lider: t.leader_name || t.leader?.name || t.leaderVendedor?.nombres || '-',
            liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
            miembros: (t.members || []).map((m: any) => ({
              id: String(m.user_id),
              nombre:
                m.vendedor_name || m.vendedor?.nombres || m.user?.name || `Vendedor ${m.user_id}`,
              email: m.vendedor?.email || m.user?.email || '',
              telefono: '',
              rol: (m.role as any) || 'Asesor Junior',
              ventasMes: 0,
              metaMes: Number(m.monthly_goal || 0),
              porcentajeMeta: 0,
              fechaIngreso: '',
              estado: m.status === 'inactive' ? 'Inactivo' : 'Activo',
            })),
            metaEquipo: 0,
            ventasEquipo: 0,
            porcentajeEquipo: 0,
            territorio: t.territory || 'N/A',
            especialidad: t.specialty || 'Comercial',
            fechaCreacion: (t.created_at || '').slice(0, 10),
            estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
          }));
          setEquipos(equiposApi);
          return;
        }
        // Obtener usuarios
        const users = await salesFunnelService.getAvailableAgents();
        // Para cada usuario, obtener leads del mes actual para calcular ventas
        const start = new Date();
        start.setDate(1);
        const created_from = start.toISOString().slice(0, 10);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        const created_to = end.toISOString().slice(0, 10);

        const miembros: Miembro[] = [];
        for (const u of users) {
          try {
            const res = await salesFunnelService.getLeads({
              assigned_agent_id: u.id,
              per_page: 100,
              created_from,
              created_to,
            });
            const ventasMes = (res.data || []).reduce(
              (acc, l) => acc + (l.potential_value || 0),
              0,
            );
            const metaMes = Math.max(ventasMes * 1.1, 1); // objetivo simple (10% por encima)
            const porcentajeMeta = (ventasMes / metaMes) * 100;
            miembros.push({
              id: String(u.id),
              nombre: `${u.first_name} ${u.last_name}`,
              email: u.email || '',
              telefono: '',
              rol: 'Asesor Junior',
              ventasMes,
              metaMes,
              porcentajeMeta,
              fechaIngreso: '',
              estado: 'Activo',
            });
          } catch (_) {}
        }

        const ventasEquipo = miembros.reduce((s, m) => s + m.ventasMes, 0);
        const metaEquipo = miembros.reduce((s, m) => s + m.metaMes, 0);
        const porcentajeEquipo = metaEquipo > 0 ? (ventasEquipo / metaEquipo) * 100 : 0;

        const equipo: Equipo = {
          id: '1',
          nombre: 'Equipo Comercial',
          descripcion: 'Equipo generado desde agentes activos',
          lider: miembros[0]?.nombre || '-',
          miembros,
          metaEquipo,
          ventasEquipo,
          porcentajeEquipo,
          territorio: 'Nacional',
          especialidad: 'Comercial',
          fechaCreacion: new Date().toISOString().slice(0, 10),
          estado: 'Activo',
        };

        setEquipos([equipo]);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        {/* Estadísticas Generales */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    className="h-8 w-8 text-blue-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Equipos Activos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {equipos.filter((e) => e.estado === 'Activo').length}
                  </p>
                  <p className="text-sm text-blue-600">de {equipos.length} totales</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:user-bold-duotone" className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Miembros</p>
                  <p className="text-2xl font-bold text-gray-900">{totalMiembros}</p>
                  <p className="text-sm text-green-600">vendedores</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:dollar-minimalistic-bold-duotone"
                    className="h-8 w-8 text-purple-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Ventas Totales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalVentas)}</p>
                  <p className="text-sm text-purple-600">este mes</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:target-bold-duotone" className="h-8 w-8 text-orange-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">% Meta General</p>
                  <p className="text-2xl font-bold text-gray-900">{promedioEquipos.toFixed(1)}%</p>
                  <p className="text-sm text-orange-600">promedio equipos</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Navegación */}
        <div className="col-span-12">
          <Card>
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <Button
                  color={vistaActual === 'equipos' ? 'blue' : 'light'}
                  onClick={() => setVistaActual('equipos')}
                >
                  <Icon icon="solar:users-group-rounded-bold-duotone" className="mr-2 h-4 w-4" />
                  Equipos
                </Button>
                <Button
                  color={vistaActual === 'miembros' ? 'blue' : 'light'}
                  onClick={() => setVistaActual('miembros')}
                >
                  <Icon icon="solar-user-bold-duotone" className="mr-2 h-4 w-4" />
                  Todos los Miembros
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button color="light" size="sm" onClick={exportEquiposCsv}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button color="light" size="sm" onClick={exportAllMembersCsv}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Miembros CSV
                </Button>
                <Button color="light" size="sm" onClick={exportAllMembersXls}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Miembros XLS
                </Button>
                <Button onClick={() => setShowModalEquipo(true)}>
                  <Icon icon="solar:add-circle-bold-duotone" className="mr-2 h-4 w-4" />
                  Nuevo Equipo
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Filtros por vista */}
        <div className="col-span-12">
          <Card>
            {vistaActual === 'equipos' ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <ShLabel htmlFor="buscar-equipo">Buscar</ShLabel>
                  <Input
                    id="buscar-equipo"
                    placeholder="Nombre, territorio o descripción"
                    value={searchEquipo}
                    onChange={(e) => setSearchEquipo(e.target.value)}
                  />
                </div>
                <div>
                  <ShLabel>Estado</ShLabel>
                  <ShSelect
                    value={filtroEstadoEquipo}
                    onValueChange={(v) => setFiltroEstadoEquipo(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Activo">Activo</SelectItem>
                      <SelectItem value="Inactivo">Inactivo</SelectItem>
                      <SelectItem value="Reestructuración">Reestructuración</SelectItem>
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <ShLabel>Especialidad</ShLabel>
                  <ShSelect
                    value={filtroEspecialidad}
                    onValueChange={(v) => setFiltroEspecialidad(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {especialidades.map((es) => (
                        <SelectItem key={es} value={es}>
                          {es}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <ShLabel>Por página</ShLabel>
                  <ShSelect
                    value={String(perPage)}
                    onValueChange={(v) => setPerPage(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <ShLabel htmlFor="buscar-miembro">Buscar</ShLabel>
                  <Input
                    id="buscar-miembro"
                    placeholder="Nombre o correo"
                    value={searchMiembro}
                    onChange={(e) => setSearchMiembro(e.target.value)}
                  />
                </div>
                <div>
                  <ShLabel>Rol</ShLabel>
                  <ShSelect value={filtroRol} onValueChange={(v) => setFiltroRol(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Líder">Líder</SelectItem>
                      <SelectItem value="Asesor Senior">Asesor Senior</SelectItem>
                      <SelectItem value="Asesor Junior">Asesor Junior</SelectItem>
                      <SelectItem value="Trainee">Trainee</SelectItem>
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <ShLabel>Estado</ShLabel>
                  <ShSelect
                    value={filtroEstadoMiembro}
                    onValueChange={(v) => setFiltroEstadoMiembro(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Activo">Activo</SelectItem>
                      <SelectItem value="Inactivo">Inactivo</SelectItem>
                      <SelectItem value="Vacaciones">Vacaciones</SelectItem>
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <ShLabel>Por página</ShLabel>
                  <ShSelect
                    value={String(perPage)}
                    onValueChange={(v) => setPerPage(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Vista de Equipos */}
        {vistaActual === 'equipos' && (
          <div className="col-span-12">
            {paginatedEquipos.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Icon
                    icon="solar:users-group-two-rounded-bold-duotone"
                    className="h-10 w-10 text-gray-400 mb-2"
                  />
                  <p className="text-gray-600">No hay equipos que coincidan con los filtros.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paginatedEquipos.map((equipo) => (
                  <Card key={equipo.id}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{equipo.nombre}</h3>
                        <p className="text-sm text-gray-600">{equipo.descripcion}</p>
                      </div>
                      <Badge color={estadoColors[equipo.estado]} size="sm">
                        {equipo.estado}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Líder:</span>
                        <span className="font-medium">{equipo.lider}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Miembros:</span>
                        <span className="font-medium">{equipo.miembros.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Territorio:</span>
                        <span className="font-medium">{equipo.territorio}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Especialidad:</span>
                        <span className="font-medium">{equipo.especialidad}</span>
                      </div>

                      <hr className="my-3" />

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Meta del Equipo:</span>
                          <span className="font-semibold">{formatCurrency(equipo.metaEquipo)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Ventas Actuales:</span>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(equipo.ventasEquipo)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">% Cumplimiento:</span>
                          <span className="font-semibold">
                            {equipo.porcentajeEquipo.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              getProgressColor(equipo.porcentajeEquipo) === 'green'
                                ? 'bg-green-500'
                                : getProgressColor(equipo.porcentajeEquipo) === 'blue'
                                ? 'bg-blue-500'
                                : getProgressColor(equipo.porcentajeEquipo) === 'yellow'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(equipo.porcentajeEquipo, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="flex -space-x-2">
                        {equipo.miembros.slice(0, 3).map((miembro, index) => (
                          <Avatar
                            key={miembro.id}
                            alt={miembro.nombre}
                            img={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                              miembro.nombre,
                            )}&background=random`}
                            rounded
                            size="sm"
                            className="border-2 border-white"
                          />
                        ))}
                        {equipo.miembros.length > 3 && (
                          <div className="flex items-center justify-center w-8 h-8 text-xs font-medium text-white bg-gray-700 border-2 border-white rounded-full">
                            +{equipo.miembros.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => {
                            setEquipoIdGestion(equipo.id);
                            setSelectedUserId('');
                            setMonthlyGoal('');
                            setShowModalMiembro(true);
                          }}
                        >
                          <Icon
                            icon="solar:users-group-two-rounded-bold-duotone"
                            className="h-4 w-4"
                          />
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => exportTeamMembersCsv(equipo)}
                        >
                          <Icon icon="solar:export-bold-duotone" className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => exportTeamMembersXls(equipo)}
                        >
                          <Icon icon="solar:export-bold-duotone" className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => {
                            setEditarEquipo({
                              id: equipo.id,
                              nombre: equipo.nombre,
                              descripcion: equipo.descripcion,
                              territorio: equipo.territorio,
                              especialidad: equipo.especialidad,
                              estado: equipo.estado,
                            });
                            setSelectedEditLeaderId(
                              equipo.liderUserId ? String(equipo.liderUserId) : '',
                            );
                            setShowModalEditar(true);
                          }}
                        >
                          <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          onClick={async () => {
                            if (!confirm('¿Eliminar este equipo?')) return;
                            try {
                              await salesTeamsService.remove(Number(equipo.id));
                              const refreshed = await salesTeamsService.list({ per_page: 50 });
                              const equiposApi: any[] = refreshed?.data || [];
                              setEquipos(
                                equiposApi.map((t: any) => ({
                                  id: String(t.id),
                                  nombre: t.name,
                                  descripcion: t.description || '',
                                  lider:
                                    t.leader_name ||
                                    t.leader?.name ||
                                    t.leaderVendedor?.nombres ||
                                    '-',
                                  liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
                                  miembros: (t.members || []).map((m: any) => ({
                                    id: String(m.user_id),
                                    nombre:
                                      m.vendedor_name ||
                                      m.vendedor?.nombres ||
                                      m.user?.name ||
                                      `Vendedor ${m.user_id}`,
                                    email: m.vendedor?.email || m.user?.email || '',
                                    telefono: '',
                                    rol: m.role || 'Asesor Junior',
                                    ventasMes: 0,
                                    metaMes: Number(m.monthly_goal || 0),
                                    porcentajeMeta: 0,
                                    fechaIngreso: '',
                                    estado: m.status === 'inactive' ? 'Inactivo' : 'Activo',
                                  })),
                                  metaEquipo: 0,
                                  ventasEquipo: 0,
                                  porcentajeEquipo: 0,
                                  territorio: t.territory || 'Nacional',
                                  especialidad: t.specialty || 'Comercial',
                                  fechaCreacion: (t.created_at || '').slice(0, 10),
                                  estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
                                })),
                              );
                            } catch (_) {}
                          }}
                        >
                          <Icon
                            icon="solar:trash-bin-minimalistic-bold-duotone"
                            className="h-4 w-4"
                          />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {/* Paginación Equipos */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Mostrando {Math.min((pageEquipos - 1) * perPage + 1, filteredEquipos.length)}–
                {Math.min(pageEquipos * perPage, filteredEquipos.length)} de{' '}
                {filteredEquipos.length}
              </p>
              <div className="flex space-x-2">
                <Button
                  color="light"
                  onClick={() => setPageEquipos((p) => Math.max(1, p - 1))}
                  disabled={pageEquipos === 1}
                >
                  Anterior
                </Button>
                <Button
                  color="light"
                  onClick={() => setPageEquipos((p) => Math.min(totalEquiposPages, p + 1))}
                  disabled={pageEquipos === totalEquiposPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Todos los Miembros */}
        {vistaActual === 'miembros' && (
          <div className="col-span-12">
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Todos los Miembros
                </h3>
                <Button onClick={() => setShowModalMiembro(true)}>
                  <Icon icon="solar:add-circle-bold-duotone" className="mr-2 h-4 w-4" />
                  Nuevo Miembro
                </Button>
              </div>

              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-b-[10px]">
                {paginatedMiembros.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Icon icon="solar:user-bold-duotone" className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-gray-600">No hay miembros que coincidan con los filtros.</p>
                  </div>
                ) : (
                  <Table striped>
                    <Table.Head className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('miembro')}
                      >
                        Miembro {sortKey === 'miembro' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell className="cursor-pointer" onClick={() => handleSort('rol')}>
                        Rol {sortKey === 'rol' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('equipo')}
                      >
                        Equipo {sortKey === 'equipo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('metaMes')}
                      >
                        Meta Mes {sortKey === 'metaMes' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('ventasMes')}
                      >
                        Ventas Mes {sortKey === 'ventasMes' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('porcentajeMeta')}
                      >
                        % Meta {sortKey === 'porcentajeMeta' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell
                        className="cursor-pointer"
                        onClick={() => handleSort('estado')}
                      >
                        Estado {sortKey === 'estado' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </Table.HeadCell>
                      <Table.HeadCell>Acciones</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y">
                      {paginatedMiembros.map((miembro) => (
                        <Table.Row
                          key={miembro.id}
                          className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <Table.Cell className="whitespace-nowrap">
                            <div className="flex items-center">
                              <Avatar
                                alt={miembro.nombre}
                                img={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  miembro.nombre,
                                )}&background=random`}
                                rounded
                                size="sm"
                                className="mr-3"
                              />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {miembro.nombre}
                                </div>
                                <div className="text-sm text-gray-500">{miembro.email}</div>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color={rolColors[miembro.rol]} size="sm">
                              {miembro.rol}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell>{miembro.equipoNombre}</Table.Cell>
                          <Table.Cell className="font-semibold">
                            {formatCurrency(miembro.metaMes)}
                          </Table.Cell>
                          <Table.Cell className="font-semibold text-green-600">
                            {formatCurrency(miembro.ventasMes)}
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center">
                              <span
                                className={`font-semibold mr-2 ${
                                  miembro.porcentajeMeta >= 100
                                    ? 'text-green-600'
                                    : miembro.porcentajeMeta >= 80
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {miembro.porcentajeMeta.toFixed(1)}%
                              </span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color={estadoColors[miembro.estado]} size="sm">
                              {miembro.estado}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex space-x-1">
                              <Button size="sm" color="light">
                                <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" />
                              </Button>
                              <Button size="sm" color="light">
                                <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" />
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                )}
              </div>

              {/* Paginación Miembros */}
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Mostrando {Math.min((pageMiembros - 1) * perPage + 1, sortedMiembros.length)}–
                  {Math.min(pageMiembros * perPage, sortedMiembros.length)} de{' '}
                  {sortedMiembros.length}
                </p>
                <div className="flex space-x-2">
                  <Button
                    color="light"
                    onClick={() => setPageMiembros((p) => Math.max(1, p - 1))}
                    disabled={pageMiembros === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    color="light"
                    onClick={() => setPageMiembros((p) => Math.min(totalMiembrosPages, p + 1))}
                    disabled={pageMiembros === totalMiembrosPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Modal Nuevo Equipo */}
      <Modal show={showModalEquipo} onClose={() => setShowModalEquipo(false)}>
        <Modal.Header>Nuevo Equipo de Ventas</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <ShLabel htmlFor="nombre">Nombre del Equipo</ShLabel>
              <Input
                id="nombre"
                value={nuevoEquipo.nombre}
                onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, nombre: e.target.value })}
                placeholder="Ej: Equipo Seguros Generales"
              />
            </div>
            <div>
              <ShLabel htmlFor="descripcion">Descripción</ShLabel>
              <Input
                id="descripcion"
                value={nuevoEquipo.descripcion}
                onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, descripcion: e.target.value })}
                placeholder="Descripción del equipo"
              />
            </div>
            <div>
              <ShLabel htmlFor="lider">Líder del Equipo</ShLabel>
              <ShSelect value={selectedLeaderId} onValueChange={(v) => setSelectedLeaderId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar líder" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoresOptions.length === 0 ? (
                    <SelectItem value="no-vendedores" disabled>
                      Cargando vendedores...
                    </SelectItem>
                  ) : (
                    vendedoresOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </ShSelect>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <ShLabel htmlFor="territorio">Territorio</ShLabel>
                <Input
                  id="territorio"
                  value={nuevoEquipo.territorio}
                  onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, territorio: e.target.value })}
                  placeholder="Ej: Bogotá y Cundinamarca"
                />
              </div>
              <div>
                <ShLabel htmlFor="especialidad">Especialidad</ShLabel>
                <ShSelect
                  value={nuevoEquipo.especialidad}
                  onValueChange={(v) => setNuevoEquipo({ ...nuevoEquipo, especialidad: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Seguros Generales">Seguros Generales</SelectItem>
                    <SelectItem value="SOAT y Vida">SOAT y Vida</SelectItem>
                    <SelectItem value="Seguros Empresariales">Seguros Empresariales</SelectItem>
                    <SelectItem value="Seguros de Salud">Seguros de Salud</SelectItem>
                  </SelectContent>
                </ShSelect>
              </div>
            </div>
            <div>
              <ShLabel htmlFor="metaEquipo">Meta del Equipo (Mensual)</ShLabel>
              <Input
                id="metaEquipo"
                type="number"
                value={nuevoEquipo.metaEquipo}
                onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, metaEquipo: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={async () => {
              try {
                // El líder se selecciona desde vendedores, pero necesitamos enviar como leader_user_id
                // Por ahora, enviar el ID del vendedor directamente (asumiendo que vendedor.id puede usarse)
                const payload = {
                  name: nuevoEquipo.nombre,
                  description: nuevoEquipo.descripcion,
                  territory: nuevoEquipo.territorio,
                  specialty: nuevoEquipo.especialidad,
                  leader_user_id: selectedLeaderId ? Number(selectedLeaderId) : undefined,
                  status: 'active',
                };
                await salesTeamsService.create(payload);
                const refreshed = await salesTeamsService.list({ per_page: 50 });
                const equiposApi: any[] = refreshed?.data || [];
                setEquipos(
                  equiposApi.map((t: any) => ({
                    id: String(t.id),
                    nombre: t.name,
                    descripcion: t.description || '',
                    lider: t.leader_name || t.leader?.name || t.leaderVendedor?.nombres || '-',
                    liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
                    miembros: (t.members || []).map((m: any) => ({
                      id: String(m.user_id),
                      nombre:
                        m.vendedor_name ||
                        m.vendedor?.nombres ||
                        m.user?.name ||
                        `Vendedor ${m.user_id}`,
                      email: m.vendedor?.email || m.user?.email || '',
                      telefono: '',
                      rol: 'Asesor Junior',
                      ventasMes: 0,
                      metaMes: Number(m.monthly_goal || 0),
                      porcentajeMeta: 0,
                      fechaIngreso: '',
                      estado: m.status === 'inactive' ? 'Inactivo' : 'Activo',
                    })),
                    metaEquipo: 0,
                    ventasEquipo: 0,
                    porcentajeEquipo: 0,
                    territorio: t.territory || 'Nacional',
                    especialidad: t.specialty || 'Comercial',
                    fechaCreacion: (t.created_at || '').slice(0, 10),
                    estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
                  })),
                );
                setShowModalEquipo(false);
                setSelectedLeaderId('');
              } catch (_) {}
            }}
          >
            Crear Equipo
          </Button>
          <Button color="gray" onClick={() => setShowModalEquipo(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Equipo */}
      <Modal show={showModalEditar} onClose={() => setShowModalEditar(false)}>
        <Modal.Header>Editar Equipo</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <ShLabel htmlFor="e_nombre">Nombre</ShLabel>
              <Input
                id="e_nombre"
                value={editarEquipo.nombre}
                onChange={(e) => setEditarEquipo({ ...editarEquipo, nombre: e.target.value })}
              />
            </div>
            <div>
              <ShLabel htmlFor="e_desc">Descripción</ShLabel>
              <Input
                id="e_desc"
                value={editarEquipo.descripcion}
                onChange={(e) => setEditarEquipo({ ...editarEquipo, descripcion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <ShLabel htmlFor="e_terr">Territorio</ShLabel>
                <Input
                  id="e_terr"
                  value={editarEquipo.territorio}
                  onChange={(e) => setEditarEquipo({ ...editarEquipo, territorio: e.target.value })}
                />
              </div>
              <div>
                <ShLabel htmlFor="e_espec">Especialidad</ShLabel>
                <Input
                  id="e_espec"
                  value={editarEquipo.especialidad}
                  onChange={(e) =>
                    setEditarEquipo({ ...editarEquipo, especialidad: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <ShLabel>Líder del Equipo</ShLabel>
              <ShSelect
                value={selectedEditLeaderId}
                onValueChange={(v) => setSelectedEditLeaderId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar líder" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoresOptions.length === 0 ? (
                    <SelectItem value="no-vendedores" disabled>
                      Cargando vendedores...
                    </SelectItem>
                  ) : (
                    vendedoresOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </ShSelect>
            </div>
            <div>
              <ShLabel>Estado</ShLabel>
              <ShSelect
                value={editarEquipo.estado}
                onValueChange={(v) => setEditarEquipo({ ...editarEquipo, estado: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                  <SelectItem value="Reestructuración">Reestructuración</SelectItem>
                </SelectContent>
              </ShSelect>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={async () => {
              try {
                // El líder se selecciona desde vendedores
                await salesTeamsService.update(Number(editarEquipo.id), {
                  name: editarEquipo.nombre,
                  description: editarEquipo.descripcion,
                  territory: editarEquipo.territorio,
                  specialty: editarEquipo.especialidad,
                  leader_user_id: selectedEditLeaderId ? Number(selectedEditLeaderId) : undefined,
                  status:
                    editarEquipo.estado === 'Inactivo'
                      ? 'inactive'
                      : editarEquipo.estado === 'Reestructuración'
                      ? 'restructuring'
                      : 'active',
                });
                const refreshed = await salesTeamsService.list({ per_page: 50 });
                const equiposApi: any[] = refreshed?.data || [];
                setEquipos(
                  equiposApi.map((t: any) => ({
                    id: String(t.id),
                    nombre: t.name,
                    descripcion: t.description || '',
                    lider: t.leader_name || t.leader?.name || t.leaderVendedor?.nombres || '-',
                    liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
                    miembros: (t.members || []).map((m: any) => ({
                      id: String(m.user_id),
                      nombre:
                        m.vendedor_name ||
                        m.vendedor?.nombres ||
                        m.user?.name ||
                        `Vendedor ${m.user_id}`,
                      email: m.vendedor?.email || m.user?.email || '',
                      telefono: '',
                      rol: 'Asesor Junior',
                      ventasMes: 0,
                      metaMes: Number(m.monthly_goal || 0),
                      porcentajeMeta: 0,
                      fechaIngreso: '',
                      estado: m.status === 'inactive' ? 'Inactivo' : 'Activo',
                    })),
                    metaEquipo: 0,
                    ventasEquipo: 0,
                    porcentajeEquipo: 0,
                    territorio: t.territory || 'Nacional',
                    especialidad: t.specialty || 'Comercial',
                    fechaCreacion: (t.created_at || '').slice(0, 10),
                    estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
                  })),
                );
                setShowModalEditar(false);
              } catch (_) {}
            }}
          >
            Guardar Cambios
          </Button>
          <Button color="gray" onClick={() => setShowModalEditar(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Gestionar Miembros */}
      <Modal show={showModalMiembro} onClose={() => setShowModalMiembro(false)}>
        <Modal.Header>Gestionar Miembros</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <ShLabel>Agregar vendedor al equipo</ShLabel>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                <div className="md:col-span-2">
                  <ShSelect
                    value={selectedUserId || ''}
                    onValueChange={(v) => setSelectedUserId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendedoresOptions.filter((v) => {
                        const equipo = equipos.find((e) => e.id === equipoIdGestion);
                        return !equipo?.miembros.some((m) => m.id === v.id);
                      }).length === 0 ? (
                        <SelectItem value="no-disponibles" disabled>
                          No hay vendedores disponibles
                        </SelectItem>
                      ) : (
                        vendedoresOptions
                          .filter((v) => {
                            const equipo = equipos.find((e) => e.id === equipoIdGestion);
                            return !equipo?.miembros.some((m) => m.id === v.id);
                          })
                          .map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.nombre}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <ShSelect value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Líder">Líder</SelectItem>
                      <SelectItem value="Asesor Senior">Asesor Senior</SelectItem>
                      <SelectItem value="Asesor Junior">Asesor Junior</SelectItem>
                      <SelectItem value="Trainee">Trainee</SelectItem>
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Meta mensual"
                    value={monthlyGoal}
                    onChange={(e) => setMonthlyGoal(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-2">
                <Button
                  disabled={!selectedUserId}
                  onClick={async () => {
                    try {
                      const equipo = equipos.find((e) => e.id === equipoIdGestion);
                      if (equipo?.miembros.some((m) => m.id === selectedUserId)) {
                        alert('Este vendedor ya es miembro del equipo');
                        return;
                      }
                      await salesTeamsService.addMember(Number(equipoIdGestion), {
                        user_id: Number(selectedUserId),
                        role: selectedRole,
                        monthly_goal: parseFloat(monthlyGoal || '0'),
                      });
                      const refreshed = await salesTeamsService.list({ per_page: 50 });
                      const equiposApi: any[] = refreshed?.data || [];
                      setEquipos(
                        equiposApi.map((t: any) => ({
                          id: String(t.id),
                          nombre: t.name,
                          descripcion: t.description || '',
                          lider:
                            t.leader_name || t.leader?.name || t.leaderVendedor?.nombres || '-',
                          liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
                          miembros: (t.members || []).map((m: any) => ({
                            id: String(m.user_id),
                            nombre:
                              m.vendedor_name ||
                              m.vendedor?.nombres ||
                              m.user?.name ||
                              `Vendedor ${m.user_id}`,
                            email: m.vendedor?.email || m.user?.email || '',
                            telefono: '',
                            rol: m.role || 'Asesor Junior',
                            ventasMes: 0,
                            metaMes: Number(m.monthly_goal || 0),
                            porcentajeMeta: 0,
                            fechaIngreso: '',
                            estado: m.status === 'inactive' ? 'Inactivo' : 'Activo',
                          })),
                          metaEquipo: 0,
                          ventasEquipo: 0,
                          porcentajeEquipo: 0,
                          territorio: t.territory || 'Nacional',
                          especialidad: t.specialty || 'Comercial',
                          fechaCreacion: (t.created_at || '').slice(0, 10),
                          estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
                        })),
                      );
                      setSelectedUserId('');
                      setSelectedRole('Asesor Junior');
                      setMonthlyGoal('');
                    } catch (err: any) {
                      if (err?.response?.data?.message) {
                        alert(err.response.data.message);
                      }
                    }
                  }}
                >
                  Agregar
                </Button>
              </div>
            </div>

            <div>
              <ShLabel>Miembros actuales</ShLabel>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>Miembro</Table.HeadCell>
                    <Table.HeadCell>Meta mensual</Table.HeadCell>
                    <Table.HeadCell>Acciones</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {equipos
                      .find((e) => e.id === equipoIdGestion)
                      ?.miembros.map((m) => (
                        <Table.Row key={m.id}>
                          <Table.Cell>{m.nombre}</Table.Cell>
                          <Table.Cell>{formatCurrency(m.metaMes || 0)}</Table.Cell>
                          <Table.Cell>
                            <Button
                              size="xs"
                              color="light"
                              onClick={async () => {
                                if (!confirm('¿Quitar miembro del equipo?')) return;
                                try {
                                  await salesTeamsService.removeMember(
                                    Number(equipoIdGestion),
                                    Number(m.id),
                                  );
                                  const refreshed = await salesTeamsService.list({ per_page: 50 });
                                  const equiposApi: any[] = refreshed?.data || [];
                                  setEquipos(
                                    equiposApi.map((t: any) => ({
                                      id: String(t.id),
                                      nombre: t.name,
                                      descripcion: t.description || '',
                                      lider:
                                        t.leader_name ||
                                        t.leader?.name ||
                                        t.leaderVendedor?.nombres ||
                                        '-',
                                      liderUserId: t.leader_user_id || (t.leader?.id ?? undefined),
                                      miembros: (t.members || []).map((x: any) => ({
                                        id: String(x.user_id),
                                        nombre:
                                          x.vendedor_name ||
                                          x.vendedor?.nombres ||
                                          x.user?.name ||
                                          `Vendedor ${x.user_id}`,
                                        email: x.vendedor?.email || x.user?.email || '',
                                        telefono: '',
                                        rol: x.role || 'Asesor Junior',
                                        ventasMes: 0,
                                        metaMes: Number(x.monthly_goal || 0),
                                        porcentajeMeta: 0,
                                        fechaIngreso: '',
                                        estado: x.status === 'inactive' ? 'Inactivo' : 'Activo',
                                      })),
                                      metaEquipo: 0,
                                      ventasEquipo: 0,
                                      porcentajeEquipo: 0,
                                      territorio: t.territory || 'Nacional',
                                      especialidad: t.specialty || 'Comercial',
                                      fechaCreacion: (t.created_at || '').slice(0, 10),
                                      estado: t.status === 'inactive' ? 'Inactivo' : 'Activo',
                                    })),
                                  );
                                } catch (_) {}
                              }}
                            >
                              <Icon
                                icon="solar:trash-bin-minimalistic-bold-duotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowModalMiembro(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default EquiposVentas;

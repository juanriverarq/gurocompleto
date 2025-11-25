import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Badge,
  Table,
  TextInput,
  Select,
  Progress,
  Modal,
  Label,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { salesFunnelService } from 'src/services/salesFunnelService';
import goalsService from 'src/services/goalsService';
import salesTeamsService from 'src/services/salesTeamsService';
import { useVendedores, useEmpleadosBroker } from 'src/hooks/useAdminCrudApi';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

interface Meta {
  id: string;
  asesor: string;
  periodo: string;
  tipoMeta: 'Primas' | 'Pólizas' | 'Comisiones' | 'Clientes';
  metaValor: number;
  valorActual: number;
  porcentajeCumplimiento: number;
  estado: 'En Progreso' | 'Cumplida' | 'Vencida' | 'Pendiente';
  fechaInicio: string;
  fechaFin: string;
  observaciones: string;
}

interface ObjetivoEquipo {
  id: string;
  equipo: string;
  descripcion: string;
  metaTotal: number;
  avanceTotal: number;
  porcentajeEquipo: number;
  miembros: number;
  estado: 'Activo' | 'Completado' | 'Pausado';
}

const mockMetas: Meta[] = [];

const mockObjetivos: ObjetivoEquipo[] = [];

const MetasObjetivos = () => {
  const { hasPermission } = useUnifiedAuth();
  const { vendedores: vendedoresHook } = useVendedores();
  const { empleados: empleadosHook } = useEmpleadosBroker();
  const canCreate = hasPermission('metas_objetivos', 'crear');
  const canEdit = hasPermission('metas_objetivos', 'editar');
  const canDelete = hasPermission('metas_objetivos', 'eliminar');
  const [metas, setMetas] = useState<Meta[]>(mockMetas);
  const [objetivos, setObjetivos] = useState<ObjetivoEquipo[]>(mockObjetivos);
  const [loading, setLoading] = useState(false);
  const [showModalMeta, setShowModalMeta] = useState(false);
  const [showModalEditar, setShowModalEditar] = useState(false);

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const [filtros, setFiltros] = useState({
    asesor: '',
    tipoMeta: '',
    estado: '',
    periodo: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`,
    rangoTipo: 'mes' as '7dias' | '15dias' | 'mes' | 'trimestre' | 'anual' | 'personalizado',
    fechaInicio: inicioMes.toISOString().slice(0, 10),
    fechaFin: finMes.toISOString().slice(0, 10),
  });

  const [nuevaMeta, setNuevaMeta] = useState({
    asesor: '',
    tipoMeta: 'Primas',
    metaValor: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: '',
  });
  const [assignType, setAssignType] = useState<'global' | 'equipo' | 'responsable'>('global');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedResponsableId, setSelectedResponsableId] = useState<string>('');
  const [tipoResponsable, setTipoResponsable] = useState<'vendedor' | 'empleado'>('vendedor');
  const [teams, setTeams] = useState<Array<{ id: number; name: string; members: any[] }>>([]);
  const [usuarios, setUsuarios] = useState<
    Array<{ id: string; nombre: string; tipo: 'vendedor' | 'empleado' }>
  >([]);

  const [editarMeta, setEditarMeta] = useState({
    id: '',
    tipoMeta: 'Primas',
    metaValor: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: '',
    estado: 'En Progreso',
  });

  const estadoColors = {
    'En Progreso': 'info',
    Cumplida: 'success',
    Vencida: 'failure',
    Pendiente: 'warning',
  };

  const tipoColors = {
    Primas: 'success',
    Pólizas: 'info',
    Comisiones: 'purple',
    Clientes: 'warning',
  };

  // Metas individuales (solo responsables, no equipos)
  const metasIndividuales = metas.filter((meta) => {
    // Excluir metas de equipos (que tienen nombre de equipo en asesor)
    const esEquipo = teams.some((t) => t.name === meta.asesor);
    return !esEquipo;
  });

  const metasFiltradas = metasIndividuales.filter((meta) => {
    return (
      (filtros.asesor === '' || meta.asesor === filtros.asesor) &&
      (filtros.tipoMeta === '' || meta.tipoMeta === filtros.tipoMeta) &&
      (filtros.estado === '' || meta.estado === filtros.estado) &&
      (filtros.periodo === '' || meta.periodo === filtros.periodo)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CO').format(value);
  };

  const getProgressColor = (porcentaje: number) => {
    if (porcentaje >= 100) return 'green';
    if (porcentaje >= 80) return 'blue';
    if (porcentaje >= 60) return 'yellow';
    return 'red';
  };

  const metasCumplidas = metasFiltradas.filter((m) => m.estado === 'Cumplida').length;
  const metasEnProgreso = metasFiltradas.filter((m) => m.estado === 'En Progreso').length;
  const promedioAvance =
    metasFiltradas.reduce((sum, m) => sum + m.porcentajeCumplimiento, 0) / metasFiltradas.length ||
    0;

  // Resumen por asignación (agrupar por asesor/equipo/global)
  const resumenAsignacion = useMemo(() => {
    const map: Record<string, { meta: number; actual: number }> = {};
    metasFiltradas.forEach((m) => {
      const key = m.asesor || 'Global';
      if (!map[key]) map[key] = { meta: 0, actual: 0 };
      map[key].meta += m.metaValor || 0;
      map[key].actual += m.valorActual || 0;
    });
    return Object.entries(map).map(([k, v]) => ({
      asignacion: k,
      ...v,
      progreso: v.meta > 0 ? (v.actual / v.meta) * 100 : 0,
    }));
  }, [metasFiltradas]);

  // Exportadores CSV
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

  const exportMetasCsv = () => {
    const headers = [
      'Asignación',
      'Periodo',
      'Tipo',
      'Meta',
      'Actual',
      'Progreso(%)',
      'Estado',
      'Inicio',
      'Fin',
      'Observaciones',
    ];
    const rows = metasFiltradas.map((m) => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || '',
    ]);
    downloadCsv(`metas_${filtros.periodo}.csv`, [headers, ...rows]);
  };

  const exportResumenCsv = () => {
    const headers = ['Asignación', 'Meta', 'Actual', 'Progreso(%)'];
    const rows = resumenAsignacion.map((r) => [
      r.asignacion,
      String(r.meta),
      String(r.actual),
      r.progreso.toFixed(1),
    ]);
    downloadCsv(`metas_resumen_${filtros.periodo}.csv`, [headers, ...rows]);
  };

  // Exportadores CSV con ; y XLS (HTML table)
  const downloadCsvWithDelimiter = (filename: string, rows: string[][], delimiter: string) => {
    const csv = rows.map((r) => r.map((cell) => String(cell ?? '')).join(delimiter)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMetasCsvSemicolon = () => {
    const headers = [
      'Asignación',
      'Periodo',
      'Tipo',
      'Meta',
      'Actual',
      'Progreso(%)',
      'Estado',
      'Inicio',
      'Fin',
      'Observaciones',
    ];
    const rows = metasFiltradas.map((m) => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || '',
    ]);
    downloadCsvWithDelimiter(`metas_${filtros.periodo}.csv`, [headers, ...rows], ';');
  };

  const exportXlsFromRows = (filename: string, headers: string[], rows: string[][]) => {
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
    a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMetasXls = () => {
    const headers = [
      'Asignación',
      'Periodo',
      'Tipo',
      'Meta',
      'Actual',
      'Progreso(%)',
      'Estado',
      'Inicio',
      'Fin',
      'Observaciones',
    ];
    const rows = metasFiltradas.map((m) => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || '',
    ]);
    exportXlsFromRows(`metas_${filtros.periodo}.xls`, headers, rows);
  };

  const handleCrearMeta = () => {
    const nueva: Meta = {
      id: Date.now().toString(),
      asesor: nuevaMeta.asesor,
      periodo: filtros.periodo,
      tipoMeta: nuevaMeta.tipoMeta as 'Primas' | 'Pólizas' | 'Comisiones' | 'Clientes',
      metaValor: parseFloat(nuevaMeta.metaValor),
      valorActual: 0,
      porcentajeCumplimiento: 0,
      estado: 'Pendiente',
      fechaInicio: nuevaMeta.fechaInicio,
      fechaFin: nuevaMeta.fechaFin,
      observaciones: nuevaMeta.observaciones,
    };

    setMetas([nueva, ...metas]);
    setShowModalMeta(false);
    setNuevaMeta({
      asesor: '',
      tipoMeta: 'Primas',
      metaValor: '',
      fechaInicio: '',
      fechaFin: '',
      observaciones: '',
    });
  };

  // Cargar equipos, vendedores/empleados y metas
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // Cargar equipos
        try {
          const t = await salesTeamsService.list({ per_page: 100 });
          const equiposData = (t?.data || []).map((x: any) => ({
            id: x.id,
            name: x.name,
            members: x.members || [],
          }));
          setTeams(equiposData);

          // Construir objetivos desde equipos
          const objetivosEquipos: ObjetivoEquipo[] = equiposData.map((eq: any) => ({
            id: String(eq.id),
            equipo: eq.name,
            descripcion: `Meta del equipo ${eq.name}`,
            metaTotal: eq.members.reduce((s: number, m: any) => s + Number(m.monthly_goal || 0), 0),
            avanceTotal: 0,
            porcentajeEquipo: 0,
            miembros: eq.members.length,
            estado: 'Activo' as const,
          }));
          setObjetivos(objetivosEquipos);
        } catch (_) {}

        // Cargar vendedores y empleados como usuarios
        const usuariosLista: Array<{ id: string; nombre: string; tipo: 'vendedor' | 'empleado' }> =
          [];

        // Vendedores
        if (vendedoresHook && vendedoresHook.length > 0) {
          vendedoresHook.forEach((v: any) => {
            usuariosLista.push({
              id: String(v.id),
              nombre: v.nombres || v.nombre || v.name,
              tipo: 'vendedor',
            });
          });
        }

        // Empleados
        if (empleadosHook && empleadosHook.length > 0) {
          empleadosHook.forEach((e: any) => {
            usuariosLista.push({
              id: String(e.id),
              nombre: e.nombre_completo || `${e.nombres} ${e.apellidos}` || e.nombre || e.name,
              tipo: 'empleado',
            });
          });
        }

        setUsuarios(usuariosLista);

        // Cargar metas del período
        const periodo =
          filtros.periodo ||
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        try {
          const apiGoals = await goalsService.list({ period: periodo, per_page: 100 });
          if (apiGoals?.data) {
            const metasApi: Meta[] = apiGoals.data.map((g: any) => ({
              id: String(g.id),
              asesor: g.user?.name || (g.team ? g.team.name : 'Global'),
              periodo: g.period,
              tipoMeta: g.type,
              metaValor: Number(g.target_value || 0),
              valorActual: Number(g.current_value || 0),
              porcentajeCumplimiento:
                (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
              estado: g.status || 'En Progreso',
              fechaInicio: g.starts_at || '',
              fechaFin: g.ends_at || '',
              observaciones: g.notes || '',
            }));
            setMetas(metasApi);
          }
        } catch (_) {
          setMetas([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filtros.periodo, vendedoresHook]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <PermissionGate
      route="/apps/comercial/metas-objetivos"
      action="ver"
      fallback={
        <Alert color="warning" className="my-6">
          No tienes permisos para ver Metas y Objetivos.
        </Alert>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Estadísticas Generales */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:target-bold-duotone" className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Metas Cumplidas</p>
                  <p className="text-2xl font-bold text-gray-900">{metasCumplidas}</p>
                  <p className="text-sm text-green-600">de {metasFiltradas.length} totales</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:clock-circle-bold-duotone" className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">En Progreso</p>
                  <p className="text-2xl font-bold text-gray-900">{metasEnProgreso}</p>
                  <p className="text-sm text-blue-600">activas</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:chart-square-bold-duotone"
                    className="h-8 w-8 text-purple-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Promedio Avance</p>
                  <p className="text-2xl font-bold text-gray-900">{promedioAvance.toFixed(1)}%</p>
                  <p className="text-sm text-purple-600">general</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    className="h-8 w-8 text-orange-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Equipos Activos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {objetivos.filter((o) => o.estado === 'Activo').length}
                  </p>
                  <p className="text-sm text-orange-600">objetivos grupales</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filtros */}
        <div className="col-span-12">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                  <div className="flex gap-2">
                    <Select
                      value={filtros.periodo.split('-')[1] || ''}
                      onChange={(e) => {
                        const month = e.target.value;
                        const year = filtros.periodo.split('-')[0];
                        setFiltros({ ...filtros, periodo: `${year}-${month}` });
                      }}
                      className="flex-1"
                    >
                      <option value="01">Ene</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Abr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Ago</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dic</option>
                    </Select>
                    <TextInput
                      type="number"
                      value={filtros.periodo.split('-')[0]}
                      onChange={(e) => {
                        const y = e.target.value || new Date().getFullYear();
                        const m = filtros.periodo.split('-')[1] || '01';
                        setFiltros({ ...filtros, periodo: `${y}-${m}` });
                      }}
                      className="w-20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usuario
                  </label>
                  <Select
                    value={filtros.asesor}
                    onChange={(e) => setFiltros({ ...filtros, asesor: e.target.value })}
                  >
                    <option value="">Todos</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.nombre}>
                        {u.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo
                  </label>
                  <Select
                    value={filtros.tipoMeta}
                    onChange={(e) => setFiltros({ ...filtros, tipoMeta: e.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="Primas">Primas</option>
                    <option value="Pólizas">Pólizas</option>
                    <option value="Comisiones">Comisiones</option>
                    <option value="Clientes">Clientes</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <Select
                    value={filtros.estado}
                    onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="En Progreso">En Progreso</option>
                    <option value="Cumplida">Cumplida</option>
                    <option value="Vencida">Vencida</option>
                    <option value="Pendiente">Pendiente</option>
                  </Select>
                </div>
              </div>
              {canCreate && (
                <Button onClick={() => setShowModalMeta(true)} data-testid="btn-nueva-meta">
                  <Icon icon="solar:add-circle-bold-duotone" className="mr-2 h-4 w-4" />
                  Nueva Meta
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Objetivos de Equipo */}
        <div className="col-span-12">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Objetivos de Equipo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {objetivos.map((objetivo) => (
                <Card key={objetivo.id}>
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-900">{objetivo.equipo}</h4>
                    <Badge color={objetivo.estado === 'Completado' ? 'success' : 'info'} size="sm">
                      {objetivo.estado}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{objetivo.descripcion}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span className="font-semibold">{objetivo.porcentajeEquipo.toFixed(1)}%</span>
                    </div>
                    <Progress
                      progress={objetivo.porcentajeEquipo}
                      color={getProgressColor(objetivo.porcentajeEquipo)}
                      size="lg"
                    />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>
                        {formatNumber(objetivo.avanceTotal)} de {formatNumber(objetivo.metaTotal)}
                      </span>
                      <span>{objetivo.miembros} miembros</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>

        {/* Tabla de Metas Individuales */}
        <div className="col-span-12">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Metas por Responsable
              </h3>
              <div className="flex gap-2">
                <Button color="light" size="sm" onClick={exportMetasCsv}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar Metas
                </Button>
                <Button color="light" size="sm" onClick={exportResumenCsv}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar Resumen
                </Button>
                <Button color="light" size="sm" onClick={exportMetasCsvSemicolon}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  CSV (;)
                </Button>
                <Button color="light" size="sm" onClick={exportMetasXls}>
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar XLS
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-b-[10px]">
              <Table striped>
                <Table.Head className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  <Table.HeadCell>Responsable</Table.HeadCell>
                  <Table.HeadCell>Tipo Meta</Table.HeadCell>
                  <Table.HeadCell>Meta</Table.HeadCell>
                  <Table.HeadCell>Actual</Table.HeadCell>
                  <Table.HeadCell>Progreso</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Período</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {metasFiltradas.map((meta) => (
                    <Table.Row
                      key={meta.id}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {meta.asesor}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={tipoColors[meta.tipoMeta]} size="sm">
                          {meta.tipoMeta}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="font-semibold">
                        {meta.tipoMeta === 'Primas' || meta.tipoMeta === 'Comisiones'
                          ? formatCurrency(meta.metaValor)
                          : formatNumber(meta.metaValor)}
                      </Table.Cell>
                      <Table.Cell className="font-semibold">
                        {meta.tipoMeta === 'Primas' || meta.tipoMeta === 'Comisiones'
                          ? formatCurrency(meta.valorActual)
                          : formatNumber(meta.valorActual)}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="w-24">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">
                              {meta.porcentajeCumplimiento.toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            progress={meta.porcentajeCumplimiento}
                            color={getProgressColor(meta.porcentajeCumplimiento)}
                            size="sm"
                          />
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={estadoColors[meta.estado]} size="sm">
                          {meta.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{meta.periodo}</Table.Cell>
                      <Table.Cell>
                        <div className="flex space-x-1">
                          {canEdit && (
                            <Button
                              size="sm"
                              color="light"
                              onClick={() => {
                                setEditarMeta({
                                  id: String(meta.id),
                                  tipoMeta: meta.tipoMeta,
                                  metaValor: String(meta.metaValor),
                                  fechaInicio: meta.fechaInicio,
                                  fechaFin: meta.fechaFin,
                                  observaciones: meta.observaciones,
                                  estado: meta.estado,
                                });
                                setShowModalEditar(true);
                              }}
                            >
                              <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              color="light"
                              onClick={async () => {
                                if (!confirm('¿Eliminar meta?')) return;
                                try {
                                  await goalsService.remove(Number(meta.id));
                                  const apiGoals = await goalsService.list({
                                    period: filtros.periodo,
                                    per_page: 100,
                                  });
                                  const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                                    id: String(g.id),
                                    asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
                                    periodo: g.period,
                                    tipoMeta: g.type,
                                    metaValor: Number(g.target_value || 0),
                                    valorActual: Number(g.current_value || 0),
                                    porcentajeCumplimiento:
                                      (Number(g.current_value || 0) /
                                        Math.max(1, Number(g.target_value || 0))) *
                                      100,
                                    estado: g.status || 'En Progreso',
                                    fechaInicio: g.starts_at || '',
                                    fechaFin: g.ends_at || '',
                                    observaciones: g.notes || '',
                                  }));
                                  setMetas(metasApi);
                                } catch (_) {}
                              }}
                            >
                              <Icon
                                icon="solar:trash-bin-minimalistic-bold-duotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {metasFiltradas.length === 0 && (
              <div className="text-center py-8">
                <Icon
                  icon="solar:target-bold-duotone"
                  className="h-12 w-12 text-gray-400 mx-auto mb-4"
                />
                <p className="text-gray-500">No se encontraron metas con los filtros aplicados</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal Nueva Meta */}
      <Modal show={showModalMeta} onClose={() => setShowModalMeta(false)}>
        <Modal.Header>Nueva Meta</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label>Asignación</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <Select
                    value={assignType}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setAssignType(v);
                      setSelectedTeamId('');
                      setSelectedResponsableId('');
                    }}
                  >
                    <option value="global">Global</option>
                    <option value="equipo">Equipo</option>
                    <option value="responsable">Responsable</option>
                  </Select>
                </div>
                {assignType === 'equipo' && (
                  <div className="md:col-span-2">
                    <Select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                      <option value="">Seleccionar equipo</option>
                      {teams.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {assignType === 'responsable' && (
                  <>
                    <div>
                      <Select
                        value={tipoResponsable}
                        onChange={(e) => {
                          setTipoResponsable(e.target.value as any);
                          setSelectedResponsableId('');
                        }}
                      >
                        <option value="vendedor">Vendedor</option>
                        <option value="empleado">Empleado</option>
                      </Select>
                    </div>
                    <div>
                      <Select
                        value={selectedResponsableId}
                        onChange={(e) => setSelectedResponsableId(e.target.value)}
                      >
                        <option value="">Seleccionar {tipoResponsable}</option>
                        {usuarios
                          .filter((u) => u.tipo === tipoResponsable)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre}
                            </option>
                          ))}
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="tipoMeta">Tipo de Meta</Label>
              <Select
                id="tipoMeta"
                value={nuevaMeta.tipoMeta}
                onChange={(e) => setNuevaMeta({ ...nuevaMeta, tipoMeta: e.target.value })}
              >
                <option value="Primas">Primas</option>
                <option value="Pólizas">Pólizas</option>
                <option value="Comisiones">Comisiones</option>
                <option value="Clientes">Clientes</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="metaValor">Valor de la Meta</Label>
              <TextInput
                id="metaValor"
                type="number"
                value={nuevaMeta.metaValor}
                onChange={(e) => setNuevaMeta({ ...nuevaMeta, metaValor: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                <TextInput
                  id="fechaInicio"
                  type="date"
                  value={nuevaMeta.fechaInicio}
                  onChange={(e) => setNuevaMeta({ ...nuevaMeta, fechaInicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fechaFin">Fecha Fin</Label>
                <TextInput
                  id="fechaFin"
                  type="date"
                  value={nuevaMeta.fechaFin}
                  onChange={(e) => setNuevaMeta({ ...nuevaMeta, fechaFin: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <TextInput
                id="observaciones"
                value={nuevaMeta.observaciones}
                onChange={(e) => setNuevaMeta({ ...nuevaMeta, observaciones: e.target.value })}
                placeholder="Observaciones adicionales"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {canCreate && (
            <Button
              onClick={async () => {
                try {
                  // Validaciones
                  if (!nuevaMeta.metaValor || parseFloat(nuevaMeta.metaValor) <= 0) {
                    alert('Debe ingresar un valor de meta válido');
                    return;
                  }
                  if (!nuevaMeta.fechaInicio || !nuevaMeta.fechaFin) {
                    alert('Debe seleccionar fechas de inicio y fin');
                    return;
                  }
                  if (new Date(nuevaMeta.fechaFin) < new Date(nuevaMeta.fechaInicio)) {
                    alert('La fecha de fin debe ser posterior a la fecha de inicio');
                    return;
                  }
                  if (assignType === 'equipo' && !selectedTeamId) {
                    alert('Debe seleccionar un equipo');
                    return;
                  }
                  if (assignType === 'responsable' && !selectedResponsableId) {
                    alert('Debe seleccionar un responsable');
                    return;
                  }

                  const start = new Date(nuevaMeta.fechaInicio);
                  const periodo = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
                    2,
                    '0',
                  )}`;

                  await goalsService.create({
                    period: periodo,
                    type: nuevaMeta.tipoMeta as any,
                    target_value: parseFloat(nuevaMeta.metaValor),
                    current_value: 0,
                    notes: nuevaMeta.observaciones,
                    starts_at: nuevaMeta.fechaInicio,
                    ends_at: nuevaMeta.fechaFin,
                    status: 'En Progreso',
                    team_id:
                      assignType === 'equipo' && selectedTeamId
                        ? Number(selectedTeamId)
                        : undefined,
                    user_id:
                      assignType === 'responsable' && selectedResponsableId
                        ? Number(selectedResponsableId)
                        : undefined,
                  });

                  const apiGoals = await goalsService.list({
                    period: filtros.periodo,
                    per_page: 100,
                  });
                  const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                    id: String(g.id),
                    asesor: g.user?.name || (g.team ? g.team.name : 'Global'),
                    periodo: g.period,
                    tipoMeta: g.type,
                    metaValor: Number(g.target_value || 0),
                    valorActual: Number(g.current_value || 0),
                    porcentajeCumplimiento:
                      (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) *
                      100,
                    estado: g.status || 'En Progreso',
                    fechaInicio: g.starts_at || '',
                    fechaFin: g.ends_at || '',
                    observaciones: g.notes || '',
                  }));
                  setMetas(metasApi);
                  setShowModalMeta(false);
                  setNuevaMeta({
                    asesor: '',
                    tipoMeta: 'Primas',
                    metaValor: '',
                    fechaInicio: '',
                    fechaFin: '',
                    observaciones: '',
                  });
                  setAssignType('global');
                  setSelectedTeamId('');
                  setSelectedResponsableId('');
                  setTipoResponsable('vendedor');
                } catch (err: any) {
                  alert(err?.response?.data?.message || 'Error al crear meta');
                }
              }}
            >
              Crear Meta
            </Button>
          )}
          <Button color="gray" onClick={() => setShowModalMeta(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Meta */}
      <Modal show={showModalEditar} onClose={() => setShowModalEditar(false)}>
        <Modal.Header>Editar Meta</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Meta</Label>
              <Select
                value={editarMeta.tipoMeta}
                onChange={(e) => setEditarMeta({ ...editarMeta, tipoMeta: e.target.value })}
              >
                <option value="Primas">Primas</option>
                <option value="Pólizas">Pólizas</option>
                <option value="Comisiones">Comisiones</option>
                <option value="Clientes">Clientes</option>
              </Select>
            </div>
            <div>
              <Label>Valor objetivo</Label>
              <TextInput
                type="number"
                value={editarMeta.metaValor}
                onChange={(e) => setEditarMeta({ ...editarMeta, metaValor: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Inicio</Label>
                <TextInput
                  type="date"
                  value={editarMeta.fechaInicio}
                  onChange={(e) => setEditarMeta({ ...editarMeta, fechaInicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <TextInput
                  type="date"
                  value={editarMeta.fechaFin}
                  onChange={(e) => setEditarMeta({ ...editarMeta, fechaFin: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <TextInput
                value={editarMeta.observaciones}
                onChange={(e) => setEditarMeta({ ...editarMeta, observaciones: e.target.value })}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={editarMeta.estado}
                onChange={(e) => setEditarMeta({ ...editarMeta, estado: e.target.value })}
              >
                <option value="En Progreso">En Progreso</option>
                <option value="Cumplida">Cumplida</option>
                <option value="Vencida">Vencida</option>
                <option value="Pendiente">Pendiente</option>
              </Select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={async () => {
              try {
                await goalsService.update(Number(editarMeta.id), {
                  type: editarMeta.tipoMeta as any,
                  target_value: parseFloat(editarMeta.metaValor || '0'),
                  notes: editarMeta.observaciones,
                  starts_at: editarMeta.fechaInicio || undefined,
                  ends_at: editarMeta.fechaFin || undefined,
                  status: editarMeta.estado,
                });
                const apiGoals = await goalsService.list({
                  period: filtros.periodo,
                  per_page: 100,
                });
                const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                  id: String(g.id),
                  asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
                  periodo: g.period,
                  tipoMeta: g.type,
                  metaValor: Number(g.target_value || 0),
                  valorActual: Number(g.current_value || 0),
                  porcentajeCumplimiento:
                    (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
                  estado: g.status || 'En Progreso',
                  fechaInicio: g.starts_at || '',
                  fechaFin: g.ends_at || '',
                  observaciones: g.notes || '',
                }));
                setMetas(metasApi);
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
    </PermissionGate>
  );
};

export default MetasObjetivos;

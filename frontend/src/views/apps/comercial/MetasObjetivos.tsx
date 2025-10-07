import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Alert, Spinner, Badge, Table, TextInput, Select, Progress, Modal, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { salesFunnelService } from 'src/services/salesFunnelService';
import goalsService from 'src/services/goalsService';
import salesTeamsService from 'src/services/salesTeamsService';

 

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
  const [metas, setMetas] = useState<Meta[]>(mockMetas);
  const [objetivos, setObjetivos] = useState<ObjetivoEquipo[]>(mockObjetivos);
  const [loading, setLoading] = useState(false);
  const [showModalMeta, setShowModalMeta] = useState(false);
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [filtros, setFiltros] = useState({
    asesor: '',
    tipoMeta: '',
    estado: '',
    periodo: '2024-06'
  });

  const [nuevaMeta, setNuevaMeta] = useState({
    asesor: '',
    tipoMeta: 'Primas',
    metaValor: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: ''
  });
  const [assignType, setAssignType] = useState<'global' | 'equipo' | 'asesor'>('global');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [teams, setTeams] = useState<Array<{ id: number; name: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: number; first_name: string; last_name: string }>>([]);

  const [editarMeta, setEditarMeta] = useState({
    id: '',
    tipoMeta: 'Primas',
    metaValor: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: '',
    estado: 'En Progreso'
  });

  const estadoColors = {
    'En Progreso': 'info',
    'Cumplida': 'success',
    'Vencida': 'failure',
    'Pendiente': 'warning'
  };

  const tipoColors = {
    'Primas': 'success',
    'Pólizas': 'info',
    'Comisiones': 'purple',
    'Clientes': 'warning'
  };

  const metasFiltradas = metas.filter(meta => {
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
      minimumFractionDigits: 0
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

  const metasCumplidas = metasFiltradas.filter(m => m.estado === 'Cumplida').length;
  const metasEnProgreso = metasFiltradas.filter(m => m.estado === 'En Progreso').length;
  const promedioAvance = metasFiltradas.reduce((sum, m) => sum + m.porcentajeCumplimiento, 0) / metasFiltradas.length || 0;

  // Resumen por asignación (agrupar por asesor/equipo/global)
  const resumenAsignacion = useMemo(() => {
    const map: Record<string, { meta: number; actual: number }> = {};
    metasFiltradas.forEach(m => {
      const key = m.asesor || 'Global';
      if (!map[key]) map[key] = { meta: 0, actual: 0 };
      map[key].meta += m.metaValor || 0;
      map[key].actual += m.valorActual || 0;
    });
    return Object.entries(map).map(([k, v]) => ({ asignacion: k, ...v, progreso: v.meta > 0 ? (v.actual / v.meta) * 100 : 0 }));
  }, [metasFiltradas]);

  // Exportadores CSV
  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMetasCsv = () => {
    const headers = ['Asignación','Periodo','Tipo','Meta','Actual','Progreso(%)','Estado','Inicio','Fin','Observaciones'];
    const rows = metasFiltradas.map(m => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || ''
    ]);
    downloadCsv(`metas_${filtros.periodo}.csv`, [headers, ...rows]);
  };

  const exportResumenCsv = () => {
    const headers = ['Asignación','Meta','Actual','Progreso(%)'];
    const rows = resumenAsignacion.map(r => [
      r.asignacion,
      String(r.meta),
      String(r.actual),
      r.progreso.toFixed(1)
    ]);
    downloadCsv(`metas_resumen_${filtros.periodo}.csv`, [headers, ...rows]);
  };

  // Exportadores CSV con ; y XLS (HTML table)
  const downloadCsvWithDelimiter = (filename: string, rows: string[][], delimiter: string) => {
    const csv = rows.map(r => r.map(cell => String(cell ?? '')).join(delimiter)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMetasCsvSemicolon = () => {
    const headers = ['Asignación','Periodo','Tipo','Meta','Actual','Progreso(%)','Estado','Inicio','Fin','Observaciones'];
    const rows = metasFiltradas.map(m => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || ''
    ]);
    downloadCsvWithDelimiter(`metas_${filtros.periodo}.csv`, [headers, ...rows], ';');
  };

  const exportXlsFromRows = (filename: string, headers: string[], rows: string[][]) => {
    const escapeHtml = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const thead = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
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
    const headers = ['Asignación','Periodo','Tipo','Meta','Actual','Progreso(%)','Estado','Inicio','Fin','Observaciones'];
    const rows = metasFiltradas.map(m => [
      m.asesor,
      m.periodo,
      m.tipoMeta,
      String(m.metaValor),
      String(m.valorActual),
      m.porcentajeCumplimiento.toFixed(1),
      m.estado,
      m.fechaInicio,
      m.fechaFin,
      m.observaciones || ''
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
      observaciones: nuevaMeta.observaciones
    };
    
    setMetas([nueva, ...metas]);
    setShowModalMeta(false);
    setNuevaMeta({
      asesor: '',
      tipoMeta: 'Primas',
      metaValor: '',
      fechaInicio: '',
      fechaFin: '',
      observaciones: ''
    });
  };

  // Cargar metas persistidas; si no hay, construir desde leads
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        try {
          const t = await salesTeamsService.list({ per_page: 100 });
          setTeams((t?.data || []).map((x: any) => ({ id: x.id, name: x.name })));
        } catch (_) {}
        try {
          const a = await salesFunnelService.getAvailableAgents();
          setAgents(a || []);
        } catch (_) {}
        const start = new Date();
        start.setDate(1);
        const periodo = filtros.periodo || `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`;
        // Intentar metas desde API
        try {
          const apiGoals = await goalsService.list({ period: periodo, per_page: 100 });
          if (apiGoals?.data && apiGoals.data.length > 0) {
            const metasApi: Meta[] = apiGoals.data.map((g: any) => ({
              id: String(g.id),
              asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
              periodo: g.period,
              tipoMeta: g.type,
              metaValor: Number(g.target_value || 0),
              valorActual: Number(g.current_value || 0),
              porcentajeCumplimiento: (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
              estado: g.status || 'En Progreso',
              fechaInicio: g.starts_at || '',
              fechaFin: g.ends_at || '',
              observaciones: g.notes || ''
            }));
            setMetas(metasApi);
            setObjetivos([{
              id: 'goals-agg',
              equipo: 'Objetivos Globales',
              descripcion: 'Metas agregadas del periodo',
              metaTotal: metasApi.reduce((s, m) => s + m.metaValor, 0),
              avanceTotal: metasApi.reduce((s, m) => s + m.valorActual, 0),
              porcentajeEquipo: (metasApi.reduce((s, m) => s + m.valorActual, 0) / Math.max(1, metasApi.reduce((s, m) => s + m.metaValor, 0))) * 100,
              miembros: metasApi.length,
              estado: 'Activo'
            }]);
            return;
          }
        } catch (_) {}
        const agents = await salesFunnelService.getAvailableAgents();
        const created_from = start.toISOString().slice(0,10);
        const end = new Date(start); end.setMonth(end.getMonth()+1); end.setDate(0);
        const created_to = end.toISOString().slice(0,10);

        const metasCalc: Meta[] = [];
        for (const a of agents) {
          try {
            const res = await salesFunnelService.getLeads({ assigned_agent_id: a.id, per_page: 200, created_from, created_to });
            const valorActual = (res.data || []).reduce((acc, l) => acc + (l.potential_value || 0), 0);
            const metaValor = Math.max(valorActual * 1.2, 1);
            const porcentajeCumplimiento = (valorActual / metaValor) * 100;
            metasCalc.push({
              id: String(a.id),
              asesor: `${a.first_name} ${a.last_name}`,
              periodo,
              tipoMeta: 'Primas',
              metaValor,
              valorActual,
              porcentajeCumplimiento,
              estado: porcentajeCumplimiento >= 100 ? 'Cumplida' : 'En Progreso',
              fechaInicio: created_from,
              fechaFin: created_to,
              observaciones: ''
            });
          } catch (_) {}
        }

        setMetas(metasCalc);
        setObjetivos([{
          id: 'team-1',
          equipo: 'Equipo Comercial',
          descripcion: 'Metas agregadas del equipo basadas en pipeline mensual',
          metaTotal: metasCalc.reduce((s, m) => s + m.metaValor, 0),
          avanceTotal: metasCalc.reduce((s, m) => s + m.valorActual, 0),
          porcentajeEquipo: (metasCalc.reduce((s, m) => s + m.valorActual, 0) / Math.max(1, metasCalc.reduce((s, m) => s + m.metaValor, 0))) * 100,
          miembros: metasCalc.length,
          estado: 'Activo'
        }]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filtros.periodo]);

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
            {/* Selector de periodo */}
            <Card>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-600 mb-2">Período</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filtros.periodo.split('-')[1] || ''} onChange={(e) => {
                    const month = e.target.value;
                    const year = filtros.periodo.split('-')[0];
                    setFiltros({ ...filtros, periodo: `${year}-${month}` });
                  }}>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                  <TextInput type="number" value={filtros.periodo.split('-')[0]} onChange={(e) => {
                    const y = e.target.value || new Date().getFullYear();
                    const m = filtros.periodo.split('-')[1] || '01';
                    setFiltros({ ...filtros, periodo: `${y}-${m}` });
                  }} />
                </div>
              </div>
            </Card>
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
                  <Icon icon="solar:chart-square-bold-duotone" className="h-8 w-8 text-purple-500" />
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
                  <Icon icon="solar:users-group-rounded-bold-duotone" className="h-8 w-8 text-orange-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Equipos Activos</p>
                  <p className="text-2xl font-bold text-gray-900">{objetivos.filter(o => o.estado === 'Activo').length}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                <Select
                  value={filtros.periodo}
                  onChange={(e) => setFiltros({...filtros, periodo: e.target.value})}
                >
                  <option value="2024-06">Junio 2024</option>
                  <option value="2024-05">Mayo 2024</option>
                  <option value="2024-04">Abril 2024</option>
                </Select>
                <Select
                  value={filtros.asesor}
                  onChange={(e) => setFiltros({...filtros, asesor: e.target.value})}
                >
                  <option value="">Todos los asesores</option>
                  <option value="María García">María García</option>
                  <option value="Carlos López">Carlos López</option>
                  <option value="Ana Rodríguez">Ana Rodríguez</option>
                </Select>
                <Select
                  value={filtros.tipoMeta}
                  onChange={(e) => setFiltros({...filtros, tipoMeta: e.target.value})}
                >
                  <option value="">Todos los tipos</option>
                  <option value="Primas">Primas</option>
                  <option value="Pólizas">Pólizas</option>
                  <option value="Comisiones">Comisiones</option>
                  <option value="Clientes">Clientes</option>
                </Select>
                <Select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                >
                  <option value="">Todos los estados</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Cumplida">Cumplida</option>
                  <option value="Vencida">Vencida</option>
                  <option value="Pendiente">Pendiente</option>
                </Select>
              </div>
              <Button onClick={() => setShowModalMeta(true)} data-testid="btn-nueva-meta">
                <Icon icon="solar:add-circle-bold-duotone" className="mr-2 h-4 w-4" />
                Nueva Meta
              </Button>
            </div>
          </Card>
        </div>

        {/* Resumen por asignación */}
        <div className="col-span-12">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              {resumenAsignacion.map(item => (
                <Card key={item.asignacion}>
                  <div className="p-4">
                    <p className="text-sm text-gray-600">{item.asignacion}</p>
                    <p className="text-xl font-bold text-dark dark:text-white">{formatCurrency(item.actual)} / {formatCurrency(item.meta)}</p>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, item.progreso).toFixed(1)}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.progreso.toFixed(1)}% de la meta</p>
                    </div>
                  </div>
                </Card>
              ))}
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
                      <span>{formatNumber(objetivo.avanceTotal)} de {formatNumber(objetivo.metaTotal)}</span>
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
                Metas Individuales
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
                  <Table.HeadCell>Asesor</Table.HeadCell>
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
                    <Table.Row key={meta.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
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
                          : formatNumber(meta.metaValor)
                        }
                      </Table.Cell>
                      <Table.Cell className="font-semibold">
                        {meta.tipoMeta === 'Primas' || meta.tipoMeta === 'Comisiones' 
                          ? formatCurrency(meta.valorActual)
                          : formatNumber(meta.valorActual)
                        }
                      </Table.Cell>
                      <Table.Cell>
                        <div className="w-24">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{meta.porcentajeCumplimiento.toFixed(1)}%</span>
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
                          <Button size="sm" color="light" onClick={() => {
                            setEditarMeta({
                              id: String(meta.id),
                              tipoMeta: meta.tipoMeta,
                              metaValor: String(meta.metaValor),
                              fechaInicio: meta.fechaInicio,
                              fechaFin: meta.fechaFin,
                              observaciones: meta.observaciones,
                              estado: meta.estado
                            });
                            setShowModalEditar(true);
                          }}>
                            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" />
                          </Button>
                          <Button size="sm" color="light" onClick={async () => {
                            if (!confirm('¿Eliminar meta?')) return;
                            try {
                              await goalsService.remove(Number(meta.id));
                              const apiGoals = await goalsService.list({ period: filtros.periodo, per_page: 100 });
                              const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                                id: String(g.id),
                                asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
                                periodo: g.period,
                                tipoMeta: g.type,
                                metaValor: Number(g.target_value || 0),
                                valorActual: Number(g.current_value || 0),
                                porcentajeCumplimiento: (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
                                estado: g.status || 'En Progreso',
                                fechaInicio: g.starts_at || '',
                                fechaFin: g.ends_at || '',
                                observaciones: g.notes || ''
                              }));
                              setMetas(metasApi);
                            } catch (_) {}
                          }}>
                            <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {metasFiltradas.length === 0 && (
              <div className="text-center py-8">
                <Icon icon="solar:target-bold-duotone" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
                  <Select value={assignType} onChange={(e) => { const v = e.target.value as any; setAssignType(v); setSelectedTeamId(''); setSelectedAgentId(''); }}>
                    <option value="global">Global</option>
                    <option value="equipo">Equipo</option>
                    <option value="asesor">Asesor</option>
                  </Select>
                </div>
                {assignType === 'equipo' && (
                  <div className="md:col-span-2">
                    <Select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                      <option value="">Seleccionar equipo</option>
                      {teams.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                      ))}
                    </Select>
                  </div>
                )}
                {assignType === 'asesor' && (
                  <div className="md:col-span-2">
                    <Select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                      <option value="">Seleccionar asesor</option>
                      {agents.map(a => (
                        <option key={a.id} value={String(a.id)}>{`${a.first_name} ${a.last_name}`}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="tipoMeta">Tipo de Meta</Label>
              <Select
                id="tipoMeta"
                value={nuevaMeta.tipoMeta}
                onChange={(e) => setNuevaMeta({...nuevaMeta, tipoMeta: e.target.value})}
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
                onChange={(e) => setNuevaMeta({...nuevaMeta, metaValor: e.target.value})}
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
                  onChange={(e) => setNuevaMeta({...nuevaMeta, fechaInicio: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="fechaFin">Fecha Fin</Label>
                <TextInput
                  id="fechaFin"
                  type="date"
                  value={nuevaMeta.fechaFin}
                  onChange={(e) => setNuevaMeta({...nuevaMeta, fechaFin: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <TextInput
                id="observaciones"
                value={nuevaMeta.observaciones}
                onChange={(e) => setNuevaMeta({...nuevaMeta, observaciones: e.target.value})}
                placeholder="Observaciones adicionales"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={async () => {
            try {
              const start = new Date(nuevaMeta.fechaInicio || (filtros.periodo + '-01'));
              const periodo = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`;
              await goalsService.create({
                period: periodo,
                type: nuevaMeta.tipoMeta as any,
                target_value: parseFloat(nuevaMeta.metaValor || '0'),
                current_value: 0,
                notes: nuevaMeta.observaciones,
                starts_at: nuevaMeta.fechaInicio || undefined,
                ends_at: nuevaMeta.fechaFin || undefined,
                status: 'En Progreso',
                team_id: assignType === 'equipo' && selectedTeamId ? Number(selectedTeamId) : undefined,
                user_id: assignType === 'asesor' && selectedAgentId ? Number(selectedAgentId) : undefined,
              });
              const apiGoals = await goalsService.list({ period: periodo, per_page: 100 });
              const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                id: String(g.id),
                asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
                periodo: g.period,
                tipoMeta: g.type,
                metaValor: Number(g.target_value || 0),
                valorActual: Number(g.current_value || 0),
                porcentajeCumplimiento: (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
                estado: g.status || 'En Progreso',
                fechaInicio: g.starts_at || '',
                fechaFin: g.ends_at || '',
                observaciones: g.notes || ''
              }));
              setMetas(metasApi);
              setShowModalMeta(false);
            } catch (_) {}
          }}>Crear Meta</Button>
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
              <Select value={editarMeta.tipoMeta} onChange={(e) => setEditarMeta({ ...editarMeta, tipoMeta: e.target.value })}>
                <option value="Primas">Primas</option>
                <option value="Pólizas">Pólizas</option>
                <option value="Comisiones">Comisiones</option>
                <option value="Clientes">Clientes</option>
              </Select>
            </div>
            <div>
              <Label>Valor objetivo</Label>
              <TextInput type="number" value={editarMeta.metaValor} onChange={(e) => setEditarMeta({ ...editarMeta, metaValor: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Inicio</Label>
                <TextInput type="date" value={editarMeta.fechaInicio} onChange={(e) => setEditarMeta({ ...editarMeta, fechaInicio: e.target.value })} />
              </div>
              <div>
                <Label>Fin</Label>
                <TextInput type="date" value={editarMeta.fechaFin} onChange={(e) => setEditarMeta({ ...editarMeta, fechaFin: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <TextInput value={editarMeta.observaciones} onChange={(e) => setEditarMeta({ ...editarMeta, observaciones: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editarMeta.estado} onChange={(e) => setEditarMeta({ ...editarMeta, estado: e.target.value })}>
                <option value="En Progreso">En Progreso</option>
                <option value="Cumplida">Cumplida</option>
                <option value="Vencida">Vencida</option>
                <option value="Pendiente">Pendiente</option>
              </Select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={async () => {
            try {
              await goalsService.update(Number(editarMeta.id), {
                type: editarMeta.tipoMeta as any,
                target_value: parseFloat(editarMeta.metaValor || '0'),
                notes: editarMeta.observaciones,
                starts_at: editarMeta.fechaInicio || undefined,
                ends_at: editarMeta.fechaFin || undefined,
                status: editarMeta.estado,
              });
              const apiGoals = await goalsService.list({ period: filtros.periodo, per_page: 100 });
              const metasApi: Meta[] = (apiGoals.data || []).map((g: any) => ({
                id: String(g.id),
                asesor: g.user?.name || (g.team ? g.team.name : 'Equipo'),
                periodo: g.period,
                tipoMeta: g.type,
                metaValor: Number(g.target_value || 0),
                valorActual: Number(g.current_value || 0),
                porcentajeCumplimiento: (Number(g.current_value || 0) / Math.max(1, Number(g.target_value || 0))) * 100,
                estado: g.status || 'En Progreso',
                fechaInicio: g.starts_at || '',
                fechaFin: g.ends_at || '',
                observaciones: g.notes || ''
              }));
              setMetas(metasApi);
              setShowModalEditar(false);
            } catch (_) {}
          }}>Guardar Cambios</Button>
          <Button color="gray" onClick={() => setShowModalEditar(false)}>Cancelar</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default MetasObjetivos; 
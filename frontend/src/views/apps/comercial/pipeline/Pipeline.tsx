import { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, Table } from 'flowbite-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useNavigate } from 'react-router-dom';
import { salesFunnelService } from 'src/services/salesFunnelService';

 

interface Oportunidad {
  id: string;
  cliente: string;
  producto: string;
  valor: number;
  etapa: string;
  probabilidad: number;
  fechaCreacion: string;
  fechaEstimadaCierre: string;
  vendedor: string;
  ultimaActividad: string;
  dias_en_etapa: number;
  temperatura: 'caliente' | 'tibio' | 'frio';
}

interface EtapaPipeline {
  nombre: string;
  color: string;
  oportunidades: number;
  valor_total: number;
  tasa_conversion: number;
}

const Pipeline = () => {
  const [loading, setLoading] = useState(true);
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroVendedorId, setFiltroVendedorId] = useState<string>('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [oportunidadSeleccionada, setOportunidadSeleccionada] = useState<Oportunidad | null>(null);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<keyof Oportunidad>('fechaEstimadaCierre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [agents, setAgents] = useState<Array<{ id: number; first_name: string; last_name: string }>>([]);
  const navigate = useNavigate();

  // Datos simulados del pipeline
  const [estadisticas, setEstadisticas] = useState({
    total_oportunidades: 0,
    valor_total_pipeline: 0,
    tasa_conversion_promedio: 0,
    tiempo_promedio_cierre: 0,
    oportunidades_mes: 0,
    ventas_cerradas_mes: 0
  });

  const [etapasPipeline, setEtapasPipeline] = useState<EtapaPipeline[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);

  useEffect(() => {
    const savedPerPage = Number(localStorage.getItem('pipeline_per_page') || '0');
    if (savedPerPage && !Number.isNaN(savedPerPage)) {
      setPerPage(savedPerPage);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        // Agentes disponibles para filtro
        const agentsResp = await salesFunnelService.getAvailableAgents();
        setAgents(agentsResp || []);

        // Estadísticas globales
        const stats = await salesFunnelService.getStatistics();
        setEstadisticas(prev => ({
          ...prev,
          total_oportunidades: (stats as any).total_leads ?? prev.total_oportunidades,
          valor_total_pipeline: (stats as any).total_potential_value ?? prev.valor_total_pipeline,
          tasa_conversion_promedio: (stats as any).conversion_rate_30d ?? prev.tasa_conversion_promedio,
          tiempo_promedio_cierre: (stats as any).average_days_to_close ?? prev.tiempo_promedio_cierre,
        }));

        // Leads paginados
        const res = await salesFunnelService.getLeads({
          stage: filtroEtapa || undefined,
          assigned_agent_id: filtroVendedorId ? Number(filtroVendedorId) : undefined,
          page: currentPage,
          per_page: perPage,
        });

        setTotalItems(res.total);

        const mapped: Oportunidad[] = res.data.map(l => ({
          id: String(l.id),
          cliente: l.full_name || `${l.first_name} ${l.last_name}`,
          producto: l.insurance_type_name || l.insurance_type || '-',
          valor: l.potential_value || 0,
          etapa: l.stage_name || l.stage,
          probabilidad: l.close_probability || 0,
          fechaCreacion: l.created_at ? new Date(l.created_at).toLocaleDateString('es-CO') : '-',
          fechaEstimadaCierre: l.expected_close_date ? new Date(l.expected_close_date).toLocaleDateString('es-CO') : '-',
          vendedor: l.assigned_agent ? `${l.assigned_agent.first_name} ${l.assigned_agent.last_name}` : '-',
          ultimaActividad: l.last_contact_at ? 'Último contacto' : (l.stage_changed_at ? 'Cambio de etapa' : ''),
          dias_en_etapa: l.days_in_current_stage || 0,
          temperatura: l.quality_rating === 'hot' ? 'caliente' : l.quality_rating === 'warm' ? 'tibio' : 'frio',
        }));
        setOportunidades(mapped);

        // Resumen por etapas (sobre la página actual)
        const stageMap: Record<string, { oportunidades: number; valor_total: number }> = {};
        mapped.forEach(m => {
          const key = m.etapa || 'Sin etapa';
          if (!stageMap[key]) stageMap[key] = { oportunidades: 0, valor_total: 0 };
          stageMap[key].oportunidades += 1;
          stageMap[key].valor_total += m.valor || 0;
        });
        const colorFor = (name: string) => {
          const map: Record<string, string> = {
            'Lead': 'bg-blue-500',
            'Contactado': 'bg-yellow-500',
            'Calificado': 'bg-indigo-500',
            'Presentación': 'bg-purple-500',
            'Propuesta': 'bg-orange-500',
            'Negociación': 'bg-pink-500',
            'Cerrado Ganado': 'bg-green-500',
            'Cerrado Perdido': 'bg-red-500',
          };
          return map[name] || 'bg-gray-500';
        };
        const etapas: EtapaPipeline[] = Object.entries(stageMap).map(([nombre, v]) => ({
          nombre,
          color: colorFor(nombre),
          oportunidades: v.oportunidades,
          valor_total: v.valor_total,
          tasa_conversion: 0,
        }));
        setEtapasPipeline(etapas);

      } catch (e: any) {
        setErrorMessage(e?.message || 'Error al cargar pipeline');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filtroEtapa, filtroVendedorId, currentPage, perPage]);

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  const obtenerColorTemperatura = (temperatura: string) => {
    switch (temperatura) {
      case 'caliente': return 'bg-red-100 text-red-800';
      case 'tibio': return 'bg-yellow-100 text-yellow-800';
      case 'frio': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const obtenerColorEtapa = (etapa: string) => {
    const etapaInfo = etapasPipeline.find(e => e.nombre === etapa);
    return etapaInfo ? etapaInfo.color : 'bg-gray-500';
  };

  const oportunidadesFiltradas = oportunidades.filter(opp => {
    const cumpleFiltroEtapa = filtroEtapa === '' || opp.etapa === filtroEtapa;
    const cumpleFiltroVendedor = filtroVendedorId === '' || Boolean(opp.vendedor) ;
    return cumpleFiltroEtapa && cumpleFiltroVendedor;
  });

  const oportunidadesOrdenadas = [...oportunidadesFiltradas].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    const va = a[sortField];
    const vb = b[sortField];
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  const total = totalItems;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startIdx = (currentPage - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const pageItems = oportunidadesOrdenadas; // ya vienen paginadas del backend

  // Export helpers
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

  const exportPipelineCsv = () => {
    const headers = ['ID','Cliente','Producto','Valor','Etapa','Probabilidad(%)','Vendedor','Temperatura','Dias en etapa','Cierre Estimado'];
    const rows = pageItems.map(o => [
      o.id,
      o.cliente,
      o.producto,
      String(o.valor),
      o.etapa,
      String(o.probabilidad),
      o.vendedor,
      o.temperatura,
      String(o.dias_en_etapa),
      o.fechaEstimadaCierre
    ]);
    downloadCsv(`pipeline_${currentPage}.csv`, [headers, ...rows]);
  };

  const exportPipelineXls = () => {
    const headers = ['ID','Cliente','Producto','Valor','Etapa','Probabilidad(%)','Vendedor','Temperatura','Dias en etapa','Cierre Estimado'];
    const rows = pageItems.map(o => [
      o.id,
      o.cliente,
      o.producto,
      String(o.valor),
      o.etapa,
      String(o.probabilidad),
      o.vendedor,
      o.temperatura,
      String(o.dias_en_etapa),
      o.fechaEstimadaCierre
    ]);
    const escapeHtml = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const thead = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${thead}${tbody}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline_${currentPage}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onChangePerPage = (value: string) => {
    const n = Number(value) || 10;
    localStorage.setItem('pipeline_per_page', String(n));
    setPerPage(n);
    setCurrentPage(1);
  };

  const toggleSort = (field: keyof Oportunidad) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '256px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)',
            borderTop: '2px solid rgba(99, 91, 255, 0.4)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Cargando pipeline de ventas...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Pipeline de Ventas</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona y monitorea el embudo de ventas con seguimiento detallado de oportunidades.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:target-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.total_oportunidades}</h3>
              <p className="text-xs text-gray-500">Oportunidades</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:dollar-minimalistic-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">{formatearMoneda(estadisticas.valor_total_pipeline)}</h3>
              <p className="text-xs text-gray-500">Valor Pipeline</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-2-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.tasa_conversion_promedio}%</h3>
              <p className="text-xs text-gray-500">Conversión</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.tiempo_promedio_cierre}</h3>
              <p className="text-xs text-gray-500">Días Promedio</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon="solar:add-circle-bold" className="text-purple-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.oportunidades_mes}</h3>
              <p className="text-xs text-gray-500">Nuevas (Mes)</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-green-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.ventas_cerradas_mes}</h3>
              <p className="text-xs text-gray-500">Cerradas (Mes)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Visualización del Pipeline */}
      <Card className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Etapas del Pipeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {etapasPipeline.map((etapa, index) => (
              <div key={index} className="text-center">
                <div className={`${etapa.color} text-white p-4 rounded-lg mb-2`}>
                  <h4 className="font-semibold text-sm">{etapa.nombre}</h4>
                  <p className="text-2xl font-bold">{etapa.oportunidades}</p>
                  <p className="text-xs opacity-90">{formatearMoneda(etapa.valor_total)}</p>
                </div>
                <div className="text-xs text-gray-600">
                  <p>Conversión: {etapa.tasa_conversion}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Filtros y Acciones */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Filtrar por Etapa</label>
                <Select value={filtroEtapa || ''} onValueChange={(v) => { setFiltroEtapa(v === 'all' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Array.from(new Set(oportunidades.map(o => o.etapa))).map(etapa => (
                      <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Filtrar por Vendedor</label>
                <Select value={filtroVendedorId || ''} onValueChange={(v) => { setFiltroVendedorId(v === 'all' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{`${a.first_name} ${a.last_name}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Por página</label>
                <Select value={String(perPage)} onValueChange={onChangePerPage}>
                  <SelectTrigger>
                    <SelectValue placeholder="10" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <HeroButton icon="solar:add-circle-bold" onClick={() => navigate('/apps/saas/sales-funnel/nuevo')} size="sm">Nueva Oportunidad</HeroButton>
              <Button color="gray" size="sm" onClick={exportPipelineCsv}>
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar CSV
              </Button>
              <Button color="gray" size="sm" onClick={exportPipelineXls}>
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar XLS
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Oportunidades */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Oportunidades de Negocio</h3>
            <Badge color="info">{oportunidadesFiltradas.length} oportunidades</Badge>
          </div>
          
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-b-[10px]">
            <Table>
              <Table.Head className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                <Table.HeadCell onClick={() => toggleSort('cliente')} className="cursor-pointer">Cliente</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('producto')} className="cursor-pointer">Producto</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('valor')} className="cursor-pointer">Valor</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('etapa')} className="cursor-pointer">Etapa</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('probabilidad')} className="cursor-pointer">Probabilidad</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('vendedor')} className="cursor-pointer">Vendedor</Table.HeadCell>
                <Table.HeadCell>Temperatura</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('dias_en_etapa')} className="cursor-pointer">Días en Etapa</Table.HeadCell>
                <Table.HeadCell onClick={() => toggleSort('fechaEstimadaCierre')} className="cursor-pointer">Cierre Estimado</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {pageItems.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={10} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="solar:target-bold" width={48} className="text-gray-300" />
                        <p className="text-gray-500">No hay oportunidades en esta vista</p>
                        <HeroButton icon="solar:add-circle-bold" size="sm">Nueva Oportunidad</HeroButton>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ) : pageItems.map((oportunidad) => (
                  <Table.Row key={oportunidad.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="font-medium">
                      <div>
                        <p className="font-semibold text-sm">{oportunidad.cliente}</p>
                        <p className="text-xs text-gray-500">{oportunidad.id}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{oportunidad.producto}</Table.Cell>
                    <Table.Cell className="font-semibold">{formatearMoneda(oportunidad.valor)}</Table.Cell>
                    <Table.Cell>
                      <Badge className={`${obtenerColorEtapa(oportunidad.etapa)} text-white`}>
                        {oportunidad.etapa}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${oportunidad.probabilidad}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{oportunidad.probabilidad}%</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{oportunidad.vendedor}</Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorTemperatura(oportunidad.temperatura)}>
                        {oportunidad.temperatura}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={oportunidad.dias_en_etapa > 7 ? 'text-red-600 font-semibold' : ''}>
                        {oportunidad.dias_en_etapa} días
                      </span>
                    </Table.Cell>
                    <Table.Cell>{oportunidad.fechaEstimadaCierre}</Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button 
                          size="xs" 
                          color="gray"
                          onClick={() => {
                            setOportunidadSeleccionada(oportunidad);
                            setMostrarModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={14} />
                        </Button>
                        <Button size="xs" color="primary">
                          <Icon icon="solar:pen-bold" width={14} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Mostrando {new Intl.NumberFormat('es-CO').format(startIdx + 1)} a {new Intl.NumberFormat('es-CO').format(endIdx)} de {new Intl.NumberFormat('es-CO').format(total)} oportunidades
          </div>
          <div className="flex gap-2">
            <Button color="gray" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Anterior</Button>
            <Button color="gray" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Modal de Detalle */}
      <Modal show={mostrarModal} onClose={() => setMostrarModal(false)} size="xl">
        <Modal.Header>Detalle de Oportunidad</Modal.Header>
        <Modal.Body>
          {oportunidadSeleccionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Información General</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>ID:</strong> {oportunidadSeleccionada.id}</p>
                    <p><strong>Cliente:</strong> {oportunidadSeleccionada.cliente}</p>
                    <p><strong>Producto:</strong> {oportunidadSeleccionada.producto}</p>
                    <p><strong>Valor:</strong> {formatearMoneda(oportunidadSeleccionada.valor)}</p>
                    <p><strong>Vendedor:</strong> {oportunidadSeleccionada.vendedor}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Estado Actual</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Etapa:</strong> {oportunidadSeleccionada.etapa}</p>
                    <p><strong>Probabilidad:</strong> {oportunidadSeleccionada.probabilidad}%</p>
                    <p><strong>Días en etapa:</strong> {oportunidadSeleccionada.dias_en_etapa}</p>
                    <p><strong>Temperatura:</strong> {oportunidadSeleccionada.temperatura}</p>
                    <p><strong>Última actividad:</strong> {oportunidadSeleccionada.ultimaActividad}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Fechas Importantes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <p><strong>Fecha de creación:</strong> {oportunidadSeleccionada.fechaCreacion}</p>
                  <p><strong>Cierre estimado:</strong> {oportunidadSeleccionada.fechaEstimadaCierre}</p>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          <Button color="primary">
            Editar Oportunidad
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Pipeline; 
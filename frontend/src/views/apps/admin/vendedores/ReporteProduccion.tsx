import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Label, Select, Spinner, Table, Badge, TextInput } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { saasApi } from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useTerminologia } from 'src/context/TerminologiaContext';

interface VendedorProduccion {
  vendedor_id: number | null;
  vendedor: string;
  total_polizas: number;
  prima_total: number;
  comision_total: number;
  comision_vendedor_total: number;
  polizas_activas: number;
  polizas_vencidas: number;
  polizas_canceladas: number;
  // Desglose por aseguradora
  por_aseguradora: Record<string, { count: number; prima: number; comision: number }>;
  // Desglose por ramo
  por_ramo: Record<string, { count: number; prima: number; comision: number }>;
}

const ReporteProduccion: React.FC = () => {
  const { toast } = useToast();
  const { tenant } = useUnifiedAuth();
  const { terminologia } = useTerminologia();

  // Data states
  const [loading, setLoading] = useState(false);
  const [polizas, setPolizas] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [aseguradoras, setAseguradoras] = useState<any[]>([]);
  const [ramos, setRamos] = useState<any[]>([]);

  // Filters
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedAseguradora, setSelectedAseguradora] = useState('');
  const [selectedRamo, setSelectedRamo] = useState('');
  const [selectedTipoPoliza, setSelectedTipoPoliza] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'resumen' | 'detalle'>('resumen');
  const [expandedVendedor, setExpandedVendedor] = useState<string | null>(null);

  const logoUrl = (tenant as any)?.logo_url || (tenant as any)?.branding?.logo || null;
  const nombreAgencia = (tenant as any)?.nombre || (tenant as any)?.branding?.nombre_comercial || 'Mi Agencia';

  // Load catalogs
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const headers = await saasApi.getAuthHeaders();
        const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

        // Vendedores
        const vRes = await fetch(`${baseUrl}/saas/vendedores?all=true`, { headers });
        const vData = await vRes.json();
        if (vData?.success) {
          const list = Array.isArray(vData.data) ? vData.data : (vData.data?.data || []);
          setVendedores(list);
        }

        // Aseguradoras
        const aRes = await fetch(`${baseUrl}/saas/aseguradoras?all=true`, { headers });
        const aData = await aRes.json();
        if (aData?.success) {
          const list = Array.isArray(aData.data) ? aData.data : (aData.data?.data || []);
          setAseguradoras(list);
        }

        // Ramos
        const rRes = await fetch(`${baseUrl}/saas/ramos?all=true`, { headers });
        const rData = await rRes.json();
        if (rData?.success) {
          const list = Array.isArray(rData.data) ? rData.data : (rData.data?.data || []);
          setRamos(list);
        }
      } catch (e) {
        console.error('Error loading catalogs:', e);
      }
    };
    loadCatalogs();
  }, []);

  // Tipos de póliza hardcoded (match backend values)
  const tiposPoliza = [
    { value: 'individual', label: 'Individual' },
    { value: 'colectiva', label: 'Colectiva' },
    { value: 'nueva', label: 'Nueva' },
    { value: 'renovacion', label: 'Renovación' },
  ];

  // Generate report
  const handleGenerateReport = async () => {
    setLoading(true);
    setPolizas([]);

    try {
      const headers = await saasApi.getAuthHeaders();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

      const params = new URLSearchParams();
      params.append('per_page', '20000');
      if (selectedVendedor) params.append('vendedor_id', selectedVendedor);
      if (selectedAseguradora) params.append('aseguradora_id', selectedAseguradora);
      if (selectedRamo) params.append('ramo_id', selectedRamo);
      if (selectedEstado) params.append('estado', selectedEstado);
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);

      const url = `${baseUrl}/saas/polizas?${params.toString()}`;
      const res = await fetch(url, { headers });
      const result = await res.json();

      let items: any[] = [];
      if (Array.isArray(result.data)) {
        items = result.data;
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        items = result.data.data;
      }

      // Filter by tipo_poliza client-side if needed
      if (selectedTipoPoliza) {
        items = items.filter(p => {
          const tp = (p.tipo_poliza_db || p.clasificacion_poliza || '').toLowerCase();
          return tp === selectedTipoPoliza.toLowerCase();
        });
      }

      setPolizas(items);

      if (items.length > 0) {
        toast({ title: 'Reporte generado', description: `${items.length} pólizas encontradas` });
      } else {
        toast({ title: 'Sin resultados', description: 'No se encontraron pólizas con los filtros seleccionados' });
      }
    } catch (e) {
      console.error('Error:', e);
      toast({ title: 'Error', description: 'Error al generar el reporte', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Group polizas by vendedor
  const produccionPorVendedor = useMemo<VendedorProduccion[]>(() => {
    if (polizas.length === 0) return [];

    const map = new Map<string, VendedorProduccion>();

    polizas.forEach(p => {
      const vendedorKey = p.vendedor || 'Sin asignar';
      const vendedorId = p.vendedor_id || null;

      if (!map.has(vendedorKey)) {
        map.set(vendedorKey, {
          vendedor_id: vendedorId,
          vendedor: vendedorKey,
          total_polizas: 0,
          prima_total: 0,
          comision_total: 0,
          comision_vendedor_total: 0,
          polizas_activas: 0,
          polizas_vencidas: 0,
          polizas_canceladas: 0,
          por_aseguradora: {},
          por_ramo: {},
        });
      }

      const v = map.get(vendedorKey)!;
      v.total_polizas++;
      v.prima_total += parseFloat(p.prima_neta) || 0;
      v.comision_total += parseFloat(p.comision) || 0;
      v.comision_vendedor_total += parseFloat(p.comision_vendedor) || 0;

      const estado = (p.estado || '').toLowerCase();
      if (estado === 'activa' || estado === 'active') v.polizas_activas++;
      else if (estado === 'vencida' || estado === 'expired') v.polizas_vencidas++;
      else if (estado === 'cancelada' || estado === 'cancelled') v.polizas_canceladas++;

      // Desglose por aseguradora
      const aseg = p.aseguradora_nombre || p.aseguradora || 'Sin aseguradora';
      if (!v.por_aseguradora[aseg]) v.por_aseguradora[aseg] = { count: 0, prima: 0, comision: 0 };
      v.por_aseguradora[aseg].count++;
      v.por_aseguradora[aseg].prima += parseFloat(p.prima_neta) || 0;
      v.por_aseguradora[aseg].comision += parseFloat(p.comision) || 0;

      // Desglose por ramo
      const ramo = p.ramo_nombre || p.ramo_principal || 'Sin ramo';
      if (!v.por_ramo[ramo]) v.por_ramo[ramo] = { count: 0, prima: 0, comision: 0 };
      v.por_ramo[ramo].count++;
      v.por_ramo[ramo].prima += parseFloat(p.prima_neta) || 0;
      v.por_ramo[ramo].comision += parseFloat(p.comision) || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.prima_total - a.prima_total);
  }, [polizas]);

  // Totals
  const totales = useMemo(() => {
    return produccionPorVendedor.reduce(
      (acc, v) => ({
        polizas: acc.polizas + v.total_polizas,
        prima: acc.prima + v.prima_total,
        comision: acc.comision + v.comision_total,
        comision_vendedor: acc.comision_vendedor + v.comision_vendedor_total,
        activas: acc.activas + v.polizas_activas,
        vencidas: acc.vencidas + v.polizas_vencidas,
        canceladas: acc.canceladas + v.polizas_canceladas,
      }),
      { polizas: 0, prima: 0, comision: 0, comision_vendedor: 0, activas: 0, vencidas: 0, canceladas: 0 }
    );
  }, [produccionPorVendedor]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  // Export
  const handleExport = (format: 'excel' | 'csv') => {
    if (polizas.length === 0) {
      toast({ title: 'Sin datos', description: 'Genera el reporte primero', variant: 'destructive' });
      return;
    }

    const separator = format === 'csv' ? ',' : '\t';

    if (viewMode === 'resumen') {
      // Export summary
      const headers = [
        `"${terminologia.vendedor}"`, '"Total Pólizas"', '"Activas"', '"Vencidas"', '"Canceladas"',
        '"Prima Total"', '"Comisión Total"', '"Comisión Vendedor"'
      ].join(separator);

      const rows = produccionPorVendedor.map(v =>
        [
          `"${v.vendedor}"`, v.total_polizas, v.polizas_activas, v.polizas_vencidas, v.polizas_canceladas,
          Math.round(v.prima_total), Math.round(v.comision_total), Math.round(v.comision_vendedor_total)
        ].join(separator)
      );

      // Total row
      rows.push(
        [
          '"TOTAL"', totales.polizas, totales.activas, totales.vencidas, totales.canceladas,
          Math.round(totales.prima), Math.round(totales.comision), Math.round(totales.comision_vendedor)
        ].join(separator)
      );

      const content = `${headers}\n${rows.join('\n')}`;
      downloadFile(content, `reporte_produccion_resumen_${new Date().toISOString().slice(0, 10)}`, format);
    } else {
      // Export detail
      const headers = [
        '"Póliza"', '"Aseguradora"', '"Ramo"', '"Cliente"', `"${terminologia.vendedor}"`,
        '"Estado"', '"Fecha Inicio"', '"Fecha Fin"', '"Prima Neta"', '"Comisión"',
        '"Comisión Vendedor"', '"Tipo"'
      ].join(separator);

      const rows = polizas.map(p =>
        [
          `"${p.numero_poliza || ''}"`,
          `"${p.aseguradora_nombre || p.aseguradora || ''}"`,
          `"${p.ramo_nombre || p.ramo_principal || ''}"`,
          `"${p.nombres_cliente || ''} ${p.apellidos_cliente || ''}".trim()`,
          `"${p.vendedor || ''}"`,
          `"${p.estado || ''}"`,
          `"${p.fecha_inicio || ''}"`,
          `"${p.fecha_fin || ''}"`,
          Math.round(parseFloat(p.prima_neta) || 0),
          Math.round(parseFloat(p.comision) || 0),
          Math.round(parseFloat(p.comision_vendedor) || 0),
          `"${p.tipo_poliza_db || p.clasificacion_poliza || ''}"`
        ].join(separator)
      );

      const content = `${headers}\n${rows.join('\n')}`;
      downloadFile(content, `reporte_produccion_detalle_${new Date().toISOString().slice(0, 10)}`, format);
    }

    toast({ title: 'Exportado', description: `Reporte exportado correctamente` });
  };

  const downloadFile = (content: string, filename: string, format: 'excel' | 'csv') => {
    const BOM = '\uFEFF';
    const ext = format === 'csv' ? 'csv' : 'xls';
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8';
    const blob = new Blob([BOM + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSelectedVendedor('');
    setSelectedAseguradora('');
    setSelectedRamo('');
    setSelectedTipoPoliza('');
    setSelectedEstado('');
    setFechaInicio('');
    setFechaFin('');
  };

  const activeFiltersCount = [
    selectedVendedor, selectedAseguradora, selectedRamo, selectedTipoPoliza,
    selectedEstado, fechaInicio, fechaFin
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-none">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
          ) : (
            <div className="h-14 w-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <Icon icon="solar:chart-bold-duotone" className="w-8 h-8 text-indigo-600" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{nombreAgencia}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Reporte de Producción por {terminologia.vendedor}
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Icon icon="solar:filter-bold" className="w-5 h-5 text-indigo-600" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge color="indigo" size="sm">{activeFiltersCount} activos</Badge>
            )}
          </h4>
          {activeFiltersCount > 0 && (
            <Button color="light" size="xs" onClick={resetFilters}>
              <Icon icon="solar:restart-bold" className="w-4 h-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vendedor */}
          <div>
            <Label htmlFor="vendedor" value={terminologia.vendedor} />
            <Select id="vendedor" value={selectedVendedor} onChange={e => setSelectedVendedor(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id}>{v.nombres}</option>
              ))}
            </Select>
          </div>

          {/* Aseguradora */}
          <div>
            <Label htmlFor="aseguradora" value="Compañía / Aseguradora" />
            <Select id="aseguradora" value={selectedAseguradora} onChange={e => setSelectedAseguradora(e.target.value)}>
              <option value="">Todas</option>
              {aseguradoras.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </Select>
          </div>

          {/* Ramo */}
          <div>
            <Label htmlFor="ramo" value="Ramo" />
            <Select id="ramo" value={selectedRamo} onChange={e => setSelectedRamo(e.target.value)}>
              <option value="">Todos</option>
              {ramos.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}{r.subramo ? ` - ${r.subramo}` : ''}</option>
              ))}
            </Select>
          </div>

          {/* Tipo de póliza */}
          <div>
            <Label htmlFor="tipoPoliza" value="Tipo de Póliza" />
            <Select id="tipoPoliza" value={selectedTipoPoliza} onChange={e => setSelectedTipoPoliza(e.target.value)}>
              <option value="">Todos</option>
              {tiposPoliza.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          {/* Estado */}
          <div>
            <Label htmlFor="estado" value="Estado" />
            <Select id="estado" value={selectedEstado} onChange={e => setSelectedEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Activa</option>
              <option value="pending">Pendiente</option>
              <option value="expired">Vencida</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </div>

          {/* Fecha Inicio */}
          <div>
            <Label htmlFor="fechaInicio" value="Vigencia desde" />
            <TextInput
              id="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <Label htmlFor="fechaFin" value="Vigencia hasta" />
            <TextInput
              id="fechaFin"
              type="date"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
            />
          </div>

          {/* Generate */}
          <div className="flex items-end">
            <Button className="w-full" onClick={handleGenerateReport} disabled={loading}>
              {loading ? (
                <><Spinner size="sm" className="mr-2" /> Generando...</>
              ) : (
                <><Icon icon="solar:play-bold" className="w-4 h-4 mr-2" /> Generar Reporte</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {polizas.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Pólizas</p>
              <p className="text-2xl font-bold text-indigo-600">{totales.polizas}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Activas</p>
              <p className="text-2xl font-bold text-green-600">{totales.activas}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Vencidas</p>
              <p className="text-2xl font-bold text-orange-500">{totales.vencidas}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Canceladas</p>
              <p className="text-2xl font-bold text-red-500">{totales.canceladas}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Prima Total</p>
              <p className="text-lg font-bold text-blue-600">{fmt(totales.prima)}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Comisión</p>
              <p className="text-lg font-bold text-emerald-600">{fmt(totales.comision)}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">{terminologia.vendedorPlural}</p>
              <p className="text-2xl font-bold text-purple-600">{produccionPorVendedor.length}</p>
            </Card>
          </div>

          {/* View toggle + Export */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color={viewMode === 'resumen' ? 'blue' : 'gray'}
                  onClick={() => setViewMode('resumen')}
                >
                  <Icon icon="solar:chart-square-bold" className="w-4 h-4 mr-1" />
                  Resumen
                </Button>
                <Button
                  size="sm"
                  color={viewMode === 'detalle' ? 'blue' : 'gray'}
                  onClick={() => setViewMode('detalle')}
                >
                  <Icon icon="solar:list-bold" className="w-4 h-4 mr-1" />
                  Detalle
                </Button>
              </div>
              <div className="flex gap-2">
                <Button color="success" size="sm" onClick={() => handleExport('excel')}>
                  <Icon icon="solar:file-download-bold" className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button color="light" size="sm" onClick={() => handleExport('csv')}>
                  <Icon icon="solar:document-text-bold" className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary view */}
          {viewMode === 'resumen' && (
            <Card>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-indigo-600" />
                Producción por {terminologia.vendedor}
              </h4>
              <div className="overflow-x-auto">
                <Table striped>
                  <Table.Head>
                    <Table.HeadCell>{terminologia.vendedor}</Table.HeadCell>
                    <Table.HeadCell className="text-right">Pólizas</Table.HeadCell>
                    <Table.HeadCell className="text-right">Activas</Table.HeadCell>
                    <Table.HeadCell className="text-right">Vencidas</Table.HeadCell>
                    <Table.HeadCell className="text-right">Prima Total</Table.HeadCell>
                    <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                    <Table.HeadCell className="text-right">Com. {terminologia.vendedor}</Table.HeadCell>
                    <Table.HeadCell className="text-center">Desglose</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {produccionPorVendedor.map((v) => (
                      <React.Fragment key={v.vendedor}>
                        <Table.Row className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <Table.Cell className="font-medium text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:user-bold" className="w-4 h-4 text-indigo-500" />
                              {v.vendedor}
                            </div>
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium">{v.total_polizas}</Table.Cell>
                          <Table.Cell className="text-right">
                            <Badge color="success" size="sm">{v.polizas_activas}</Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Badge color="warning" size="sm">{v.polizas_vencidas}</Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium text-blue-600">
                            {fmt(v.prima_total)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium text-emerald-600">
                            {fmt(v.comision_total)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium text-purple-600">
                            {fmt(v.comision_vendedor_total)}
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <Button
                              size="xs"
                              color="light"
                              onClick={() => setExpandedVendedor(
                                expandedVendedor === v.vendedor ? null : v.vendedor
                              )}
                            >
                              <Icon
                                icon={expandedVendedor === v.vendedor ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                                className="w-4 h-4"
                              />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                        {/* Expanded row with breakdown */}
                        {expandedVendedor === v.vendedor && (
                          <Table.Row>
                            <Table.Cell colSpan={8} className="!p-0">
                              <div className="bg-gray-50 dark:bg-gray-900 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* By aseguradora */}
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                                      <Icon icon="solar:buildings-bold" className="w-4 h-4" />
                                      Por Aseguradora
                                    </h5>
                                    <div className="space-y-1">
                                      {Object.entries(v.por_aseguradora)
                                        .sort(([,a], [,b]) => b.prima - a.prima)
                                        .map(([name, data]) => (
                                          <div key={name} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-1.5">
                                            <span className="text-gray-700 dark:text-gray-300">{name}</span>
                                            <div className="flex items-center gap-3">
                                              <Badge color="gray" size="sm">{data.count}</Badge>
                                              <span className="text-blue-600 font-medium w-28 text-right">{fmt(data.prima)}</span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                  {/* By ramo */}
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                                      <Icon icon="solar:shield-check-bold" className="w-4 h-4" />
                                      Por Ramo
                                    </h5>
                                    <div className="space-y-1">
                                      {Object.entries(v.por_ramo)
                                        .sort(([,a], [,b]) => b.prima - a.prima)
                                        .map(([name, data]) => (
                                          <div key={name} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-1.5">
                                            <span className="text-gray-700 dark:text-gray-300">{name}</span>
                                            <div className="flex items-center gap-3">
                                              <Badge color="gray" size="sm">{data.count}</Badge>
                                              <span className="text-blue-600 font-medium w-28 text-right">{fmt(data.prima)}</span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </React.Fragment>
                    ))}
                    {/* Totals row */}
                    <Table.Row className="!bg-indigo-50 dark:!bg-indigo-900/20 font-bold">
                      <Table.Cell className="font-bold text-gray-900 dark:text-white">TOTAL</Table.Cell>
                      <Table.Cell className="text-right font-bold">{totales.polizas}</Table.Cell>
                      <Table.Cell className="text-right font-bold text-green-700">{totales.activas}</Table.Cell>
                      <Table.Cell className="text-right font-bold text-orange-600">{totales.vencidas}</Table.Cell>
                      <Table.Cell className="text-right font-bold text-blue-700">{fmt(totales.prima)}</Table.Cell>
                      <Table.Cell className="text-right font-bold text-emerald-700">{fmt(totales.comision)}</Table.Cell>
                      <Table.Cell className="text-right font-bold text-purple-700">{fmt(totales.comision_vendedor)}</Table.Cell>
                      <Table.Cell></Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              </div>
            </Card>
          )}

          {/* Detail view */}
          {viewMode === 'detalle' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Icon icon="solar:list-bold" className="w-5 h-5 text-indigo-600" />
                  Detalle de Pólizas
                  <Badge color="indigo">{polizas.length} registros</Badge>
                </h4>
              </div>
              <div className="overflow-x-auto">
                <Table striped>
                  <Table.Head>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Aseguradora</Table.HeadCell>
                    <Table.HeadCell>Ramo</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>{terminologia.vendedor}</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                    <Table.HeadCell className="text-right">Prima</Table.HeadCell>
                    <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {polizas.slice(0, 200).map((p, idx) => {
                      const estado = (p.estado || '').toLowerCase();
                      const estadoColor = estado === 'activa' || estado === 'active' ? 'success'
                        : estado === 'vencida' || estado === 'expired' ? 'warning'
                        : estado === 'cancelada' || estado === 'cancelled' ? 'failure' : 'gray';
                      return (
                        <Table.Row key={idx} className="bg-white dark:bg-gray-800">
                          <Table.Cell className="font-medium whitespace-nowrap">{p.numero_poliza}</Table.Cell>
                          <Table.Cell className="whitespace-nowrap text-sm">{p.aseguradora_nombre || p.aseguradora}</Table.Cell>
                          <Table.Cell className="whitespace-nowrap text-sm">{p.ramo_nombre || p.ramo_principal}</Table.Cell>
                          <Table.Cell className="whitespace-nowrap text-sm">
                            {`${p.nombres_cliente || ''} ${p.apellidos_cliente || ''}`.trim()}
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap text-sm">{p.vendedor}</Table.Cell>
                          <Table.Cell>
                            <Badge color={estadoColor} size="sm">{p.estado}</Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium text-blue-600">
                            {fmt(parseFloat(p.prima_neta) || 0)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium text-emerald-600">
                            {fmt(parseFloat(p.comision) || 0)}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
                {polizas.length > 200 && (
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    Mostrando 200 de {polizas.length} registros. Exporta para ver todos.
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && polizas.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Icon icon="solar:chart-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Reporte de Producción
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Selecciona los filtros deseados y haz clic en "Generar Reporte" para ver la producción
              agrupada por {terminologia.vendedor.toLowerCase()}.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReporteProduccion;

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Spinner, Badge, Table, TextInput, Select, Modal, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import anticiposAjustesService, { Movimiento, CrearMovimientoInput } from '../../../services/anticiposAjustesService';
import saasApi from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';
import ventasCruzadasService, { OportunidadVentasCruzadas, EstadisticasVentasCruzadas } from '../../../services/ventasCruzadasService';

interface Estadisticas {
  totalAnticipos: number;
  totalAjustes: number;
  totalDescuentos: number;
  pendientesAprobacion: number;
  totalMovimientos: number;
}

const AnticiposAjustes = () => {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);
  const { toast } = useToast();
  
  const [filtros, setFiltros] = useState({
    busqueda: '',
    tipo: '',
    estado: '',
    vendedor_id: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  const [nuevoMovimiento, setNuevoMovimiento] = useState<{
    tipo: string;
    vendedor_id: string;
    concepto: string;
    valor: string;
    observaciones: string;
    poliza_id: string;
  }>({
    tipo: 'anticipo',
    vendedor_id: '',
    concepto: '',
    valor: '',
    observaciones: '',
    poliza_id: ''
  });

  const [vendedores, setVendedores] = useState<any[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    totalAnticipos: 0,
    totalAjustes: 0,
    totalDescuentos: 0,
    pendientesAprobacion: 0,
    totalMovimientos: 0
  });

  const estadoColors = {
    'pendiente': 'warning',
    'aprobado': 'success',
    'rechazado': 'failure'
  };

  const tipoColors = {
    'anticipo': 'info',
    'ajuste': 'purple',
    'descuento': 'failure'
  };


  // Cargar vendedores
  useEffect(() => {
    const loadVendedores = async () => {
      try {
        console.log('🔄 Cargando vendedores...');
        const vendRes = await saasApi.getVendedores();
        console.log('📋 Respuesta completa vendedores:', vendRes);
        console.log('📋 vendRes.success:', vendRes.success);
        console.log('📋 vendRes.data:', vendRes.data);
        console.log('📋 vendRes.data?.data:', vendRes.data?.data);

        if (vendRes.success && vendRes.data?.data) {
          console.log('✅ Vendedores cargados:', vendRes.data.data.length);
          console.log('✅ Primer vendedor COMPLETO:', JSON.stringify(vendRes.data.data[0], null, 2));
          console.log('✅ Campos del primer vendedor:', Object.keys(vendRes.data.data[0] || {}));
          setVendedores(vendRes.data.data);
        } else if (Array.isArray(vendRes.data)) {
          console.log('✅ Vendedores en array directo:', vendRes.data.length);
          console.log('✅ Primer vendedor COMPLETO:', JSON.stringify(vendRes.data[0], null, 2));
          setVendedores(vendRes.data);
        } else {
          console.warn('⚠️ No se encontraron vendedores. Estructura:', vendRes);
          setVendedores([]);
        }
      } catch (e) {
        console.error('❌ Error cargando vendedores:', e);
        setVendedores([]);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los vendedores',
          variant: 'destructive'
        });
      }
    };
    loadVendedores();
  }, []);

  // Cargar movimientos y estadísticas
  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const filtrosApi: any = {};
      if (filtros.tipo) filtrosApi.tipo = filtros.tipo;
      if (filtros.estado) filtrosApi.estado = filtros.estado;
      if (filtros.vendedor_id) filtrosApi.vendedor_id = parseInt(filtros.vendedor_id);
      if (filtros.fecha_desde) filtrosApi.fecha_desde = filtros.fecha_desde;
      if (filtros.fecha_hasta) filtrosApi.fecha_hasta = filtros.fecha_hasta;
      if (filtros.busqueda) filtrosApi.search = filtros.busqueda;

      const [movs, stats] = await Promise.all([
        anticiposAjustesService.getMovimientos(filtrosApi),
        anticiposAjustesService.getEstadisticas({
          fecha_desde: filtros.fecha_desde,
          fecha_hasta: filtros.fecha_hasta
        })
      ]);

      setMovimientos(movs);
      setEstadisticas(stats);
    } catch (e) {
      console.error('Error cargando datos:', e);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los movimientos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtros.tipo, filtros.estado, filtros.vendedor_id, filtros.fecha_desde, filtros.fecha_hasta]);

  // Filtrar en frontend por búsqueda
  const movimientosFiltrados = useMemo(() => {
    if (!filtros.busqueda) return movimientos;

    const busqueda = filtros.busqueda.toLowerCase();
    return movimientos.filter(m => {
      const vendedorNombre = vendedores.find(v => String(v.id) === String(m.vendedor_id))?.nombres || '';
      return m.concepto?.toLowerCase().includes(busqueda) ||
             vendedorNombre.toLowerCase().includes(busqueda) ||
             m.numero_poliza?.toLowerCase().includes(busqueda);
    });
  }, [movimientos, filtros.busqueda, vendedores]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const handleCrearMovimiento = async () => {
    try {
      if (!nuevoMovimiento.vendedor_id || !nuevoMovimiento.concepto || !nuevoMovimiento.valor) {
        toast({
          title: 'Error',
          description: 'Por favor completa todos los campos requeridos',
          variant: 'destructive'
        });
        return;
      }

      const input: CrearMovimientoInput = {
        tipo: nuevoMovimiento.tipo as 'anticipo' | 'ajuste' | 'descuento',
        vendedor_id: parseInt(nuevoMovimiento.vendedor_id),
        concepto: nuevoMovimiento.concepto,
        valor: parseFloat(nuevoMovimiento.valor),
        observaciones: nuevoMovimiento.observaciones || undefined,
        poliza_id: nuevoMovimiento.poliza_id ? parseInt(nuevoMovimiento.poliza_id) : undefined
      };

      await anticiposAjustesService.crearMovimiento(input);
      
      toast({
        title: 'Movimiento creado',
        description: 'El movimiento ha sido creado exitosamente',
      });

      setShowModal(false);
      setNuevoMovimiento({
        tipo: 'anticipo',
        vendedor_id: '',
        concepto: '',
        valor: '',
        observaciones: '',
        poliza_id: ''
      });
      
      await cargarDatos();
    } catch (error) {
      console.error('Error creando movimiento:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el movimiento',
        variant: 'destructive'
      });
    }
  };

  const handleAprobar = async (id: number) => {
    try {
      await anticiposAjustesService.aprobarMovimiento(id);
      toast({
        title: 'Movimiento aprobado',
        description: 'El movimiento ha sido aprobado exitosamente',
      });
      await cargarDatos();
    } catch (error) {
      console.error('Error aprobando movimiento:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar el movimiento',
        variant: 'destructive'
      });
    }
  };

  const handleRechazar = async (id: number) => {
    try {
      await anticiposAjustesService.rechazarMovimiento(id);
      toast({
        title: 'Movimiento rechazado',
        description: 'El movimiento ha sido rechazado',
      });
      await cargarDatos();
    } catch (error) {
      console.error('Error rechazando movimiento:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar el movimiento',
        variant: 'destructive'
      });
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este movimiento?')) return;
    
    try {
      await anticiposAjustesService.eliminarMovimiento(id);
      toast({
        title: 'Movimiento eliminado',
        description: 'El movimiento ha sido eliminado',
      });
      await cargarDatos();
    } catch (error) {
      console.error('Error eliminando movimiento:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el movimiento',
        variant: 'destructive'
      });
    }
  };

  const exportarExcel = () => {
    try {
      let csv = 'Anticipos y Ajustes\n';
      csv += `Fecha de generación: ${new Date().toLocaleString('es-CO')}\n\n`;
      csv += 'Fecha,Tipo,Asesor,Concepto,Valor,Estado,Observaciones\n';

      movimientosFiltrados.forEach(m => {
        const vendedorNombre = vendedores.find(v => String(v.id) === String(m.vendedor_id))?.nombres || '';
        csv += `${formatDate(m.fecha)},${m.tipo},${vendedorNombre},${m.concepto},${m.valor},${m.estado},${m.observaciones || ''}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anticipos-ajustes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando:', error);
      toast({
        title: 'Error',
        description: 'No se pudo exportar el archivo',
        variant: 'destructive'
      });
    }
  };

  if (loading && movimientos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando movimientos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Estadísticas */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:card-transfer-bold-duotone" className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Anticipos</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(estadisticas.totalAnticipos)}</p>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:settings-bold-duotone" className="h-8 w-8 text-purple-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Ajustes</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(estadisticas.totalAjustes)}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:minus-circle-bold-duotone" className="h-8 w-8 text-red-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Descuentos</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(estadisticas.totalDescuentos)}</p>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:clock-circle-bold-duotone" className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pendientes</p>
                  <p className="text-lg font-semibold text-gray-900">{estadisticas.pendientesAprobacion}</p>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:document-text-bold-duotone" className="h-8 w-8 text-gray-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Movimientos</p>
                  <p className="text-lg font-semibold text-gray-900">{estadisticas.totalMovimientos}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filtros y Acciones */}
        <div className="col-span-12">
          <Card>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
                <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setShowModal(true)}>Nuevo Movimiento</HeroButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <TextInput
                  placeholder="Buscar concepto, asesor o póliza..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros({...filtros, busqueda: e.target.value})}
                  icon={() => <Icon icon="solar:magnifer-bold-duotone" />}
                />
                
                <Select
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
                >
                  <option value="">Todos los tipos</option>
                  <option value="anticipo">Anticipo</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="descuento">Descuento</option>
                </Select>
                
                <Select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </Select>
                
                <Select
                  value={filtros.vendedor_id}
                  onChange={(e) => setFiltros({...filtros, vendedor_id: e.target.value})}
                >
                  <option value="">Todos los asesores</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombres}
                    </option>
                  ))}
                </Select>

                <TextInput
                  type="date"
                  value={filtros.fecha_desde}
                  onChange={(e) => setFiltros({...filtros, fecha_desde: e.target.value})}
                  placeholder="Fecha desde"
                />

                <TextInput
                  type="date"
                  value={filtros.fecha_hasta}
                  onChange={(e) => setFiltros({...filtros, fecha_hasta: e.target.value})}
                  placeholder="Fecha hasta"
                  min={filtros.fecha_desde}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabla de Movimientos */}
        <div className="col-span-12">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Anticipos y Ajustes ({movimientosFiltrados.length})
              </h3>
              <Button color="light" size="sm" onClick={exportarExcel}>
                <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table striped>
                <Table.Head>
                  <Table.HeadCell>Fecha</Table.HeadCell>
                  <Table.HeadCell>Tipo</Table.HeadCell>
                  <Table.HeadCell>Asesor</Table.HeadCell>
                  <Table.HeadCell>Concepto</Table.HeadCell>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell className="text-right">Valor</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {movimientosFiltrados.map((movimiento) => (
                    <Table.Row key={movimiento.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {formatDate(movimiento.fecha)}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={tipoColors[movimiento.tipo]} size="sm">
                          {movimiento.tipo.charAt(0).toUpperCase() + movimiento.tipo.slice(1)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{vendedores.find(v => String(v.id) === String(movimiento.vendedor_id))?.nombres || `Vendedor ${movimiento.vendedor_id}`}</Table.Cell>
                      <Table.Cell className="max-w-xs">{movimiento.concepto}</Table.Cell>
                      <Table.Cell>{movimiento.numero_poliza || '-'}</Table.Cell>
                      <Table.Cell className={`font-semibold text-right ${movimiento.valor < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(movimiento.valor)}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={estadoColors[movimiento.estado]} size="sm">
                          {movimiento.estado.charAt(0).toUpperCase() + movimiento.estado.slice(1)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            color="light"
                            onClick={() => {
                              setMovimientoSeleccionado(movimiento);
                              setShowDetalleModal(true);
                            }}
                          >
                            <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" />
                          </Button>
                          {movimiento.estado === 'pendiente' && (
                            <>
                              <Button size="sm" color="success" onClick={() => handleAprobar(movimiento.id)}>
                                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" />
                              </Button>
                              <Button size="sm" color="failure" onClick={() => handleRechazar(movimiento.id)}>
                                <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {movimiento.estado === 'rechazado' && (
                            <Button size="sm" color="gray" onClick={() => handleEliminar(movimiento.id)}>
                              <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {movimientosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Icon icon="solar:document-text-bold-duotone" className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No se encontraron movimientos</p>
                <p className="text-sm text-gray-400 mt-2">Crea un nuevo movimiento o ajusta los filtros</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal Nuevo Movimiento */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Nuevo Movimiento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tipo">Tipo de Movimiento *</Label>
              <Select
                id="tipo"
                value={nuevoMovimiento.tipo}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, tipo: e.target.value})}
              >
                <option value="anticipo">Anticipo</option>
                <option value="ajuste">Ajuste</option>
                <option value="descuento">Descuento</option>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="vendedor">Asesor *</Label>
              <Select
                id="vendedor"
                value={nuevoMovimiento.vendedor_id}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, vendedor_id: e.target.value})}
              >
                <option value="">Seleccionar asesor</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombres}
                  </option>
                ))}
              </Select>
            </div>
            
            <div>
              <Label htmlFor="concepto">Concepto *</Label>
              <TextInput
                id="concepto"
                value={nuevoMovimiento.concepto}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, concepto: e.target.value})}
                placeholder="Descripción del movimiento"
              />
            </div>
            
            <div>
              <Label htmlFor="valor">Valor *</Label>
              <TextInput
                id="valor"
                type="number"
                value={nuevoMovimiento.valor}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, valor: e.target.value})}
                placeholder="0"
                helperText="Para descuentos, ingresa un valor negativo"
              />
            </div>

            <div>
              <Label htmlFor="poliza_id">Póliza (Opcional)</Label>
              <TextInput
                id="poliza_id"
                value={nuevoMovimiento.poliza_id}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, poliza_id: e.target.value})}
                placeholder="ID de la póliza relacionada"
              />
            </div>
            
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <textarea
                id="observaciones"
                value={nuevoMovimiento.observaciones}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, observaciones: e.target.value})}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleCrearMovimiento}>Crear Movimiento</Button>
          <Button color="gray" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Detalle */}
      <Modal show={showDetalleModal} onClose={() => setShowDetalleModal(false)} size="md">
        <Modal.Header>Detalle del Movimiento</Modal.Header>
        <Modal.Body>
          {movimientoSeleccionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tipo</p>
                  <Badge color={tipoColors[movimientoSeleccionado.tipo]}>
                    {movimientoSeleccionado.tipo.charAt(0).toUpperCase() + movimientoSeleccionado.tipo.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge color={estadoColors[movimientoSeleccionado.estado]}>
                    {movimientoSeleccionado.estado.charAt(0).toUpperCase() + movimientoSeleccionado.estado.slice(1)}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Asesor</p>
                <p className="font-medium">{vendedores.find(v => String(v.id) === String(movimientoSeleccionado.vendedor_id))?.nombres || `Vendedor ${movimientoSeleccionado.vendedor_id}`}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Concepto</p>
                <p className="font-medium">{movimientoSeleccionado.concepto}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Valor</p>
                <p className={`text-xl font-bold ${movimientoSeleccionado.valor < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(movimientoSeleccionado.valor)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <p className="font-medium">{formatDate(movimientoSeleccionado.fecha)}</p>
              </div>

              {movimientoSeleccionado.numero_poliza && (
                <div>
                  <p className="text-sm text-gray-500">Póliza</p>
                  <p className="font-medium">{movimientoSeleccionado.numero_poliza}</p>
                </div>
              )}

              {movimientoSeleccionado.observaciones && (
                <div>
                  <p className="text-sm text-gray-500">Observaciones</p>
                  <p className="font-medium">{movimientoSeleccionado.observaciones}</p>
                </div>
              )}

              {movimientoSeleccionado.aprobado_por && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">Aprobado por</p>
                  <p className="font-medium">{movimientoSeleccionado.aprobado_por}</p>
                  <p className="text-sm text-gray-500 mt-2">Fecha de aprobación</p>
                  <p className="font-medium">{formatDate(movimientoSeleccionado.fecha_aprobacion || '')}</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowDetalleModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AnticiposAjustes;
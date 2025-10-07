import React, { useState } from 'react';
import { Card, Button, Alert, Spinner, Badge, Table, TextInput, Select, Modal, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from '../../../layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: '/',
    title: 'Inicio',
  },
  {
    title: 'Comisiones y Cartera',
  },
  {
    title: 'Anticipos / Ajustes',
  },
];

interface Movimiento {
  id: string;
  tipo: 'Anticipo' | 'Ajuste' | 'Descuento';
  asesor: string;
  concepto: string;
  valor: number;
  fecha: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  observaciones: string;
  aprobadoPor?: string;
  fechaAprobacion?: string;
}

const mockMovimientos: Movimiento[] = [
  {
    id: '1',
    tipo: 'Anticipo',
    asesor: 'María García',
    concepto: 'Anticipo comisiones diciembre',
    valor: 500000,
    fecha: '2024-06-15',
    estado: 'Pendiente',
    observaciones: 'Anticipo solicitado para gastos personales'
  },
  {
    id: '2',
    tipo: 'Ajuste',
    asesor: 'Carlos López',
    concepto: 'Corrección comisión POL-2024-001',
    valor: 25000,
    fecha: '2024-06-10',
    estado: 'Aprobado',
    observaciones: 'Error en cálculo de porcentaje',
    aprobadoPor: 'Admin',
    fechaAprobacion: '2024-06-11'
  },
  {
    id: '3',
    tipo: 'Descuento',
    asesor: 'Ana Rodríguez',
    concepto: 'Descuento por siniestralidad',
    valor: -75000,
    fecha: '2024-06-08',
    estado: 'Aprobado',
    observaciones: 'Descuento aplicado por alta siniestralidad',
    aprobadoPor: 'Admin',
    fechaAprobacion: '2024-06-09'
  }
];

const AnticiposAjustes = () => {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(mockMovimientos);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filtros, setFiltros] = useState({
    busqueda: '',
    tipo: '',
    estado: '',
    asesor: ''
  });

  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    tipo: 'Anticipo',
    asesor: '',
    concepto: '',
    valor: '',
    observaciones: ''
  });

  const estadoColors = {
    'Pendiente': 'warning',
    'Aprobado': 'success',
    'Rechazado': 'failure'
  };

  const tipoColors = {
    'Anticipo': 'info',
    'Ajuste': 'purple',
    'Descuento': 'failure'
  };

  const movimientosFiltrados = movimientos.filter(movimiento => {
    return (
      (filtros.busqueda === '' || 
       movimiento.concepto.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
       movimiento.asesor.toLowerCase().includes(filtros.busqueda.toLowerCase())) &&
      (filtros.tipo === '' || movimiento.tipo === filtros.tipo) &&
      (filtros.estado === '' || movimiento.estado === filtros.estado) &&
      (filtros.asesor === '' || movimiento.asesor === filtros.asesor)
    );
  });

  const totalAnticipos = movimientos.filter(m => m.tipo === 'Anticipo' && m.estado === 'Aprobado').reduce((sum, m) => sum + m.valor, 0);
  const totalAjustes = movimientos.filter(m => m.tipo === 'Ajuste' && m.estado === 'Aprobado').reduce((sum, m) => sum + m.valor, 0);
  const pendientesAprobacion = movimientos.filter(m => m.estado === 'Pendiente').length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleCrearMovimiento = () => {
    const nuevo: Movimiento = {
      id: Date.now().toString(),
      tipo: nuevoMovimiento.tipo as 'Anticipo' | 'Ajuste' | 'Descuento',
      asesor: nuevoMovimiento.asesor,
      concepto: nuevoMovimiento.concepto,
      valor: parseFloat(nuevoMovimiento.valor),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Pendiente',
      observaciones: nuevoMovimiento.observaciones
    };
    
    setMovimientos([nuevo, ...movimientos]);
    setShowModal(false);
    setNuevoMovimiento({
      tipo: 'Anticipo',
      asesor: '',
      concepto: '',
      valor: '',
      observaciones: ''
    });
  };

  const handleAprobar = (id: string) => {
    setMovimientos(movimientos.map(m => 
      m.id === id 
        ? { ...m, estado: 'Aprobado' as const, aprobadoPor: 'Admin', fechaAprobacion: new Date().toISOString().split('T')[0] }
        : m
    ));
  };

  const handleRechazar = (id: string) => {
    setMovimientos(movimientos.map(m => 
      m.id === id 
        ? { ...m, estado: 'Rechazado' as const, aprobadoPor: 'Admin', fechaAprobacion: new Date().toISOString().split('T')[0] }
        : m
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Anticipos / Ajustes" items={BCrumb} />
      
      <div className="grid grid-cols-12 gap-6">
        {/* Estadísticas */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:card-transfer-bold-duotone" className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Anticipos</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalAnticipos)}</p>
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
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalAjustes)}</p>
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
                  <p className="text-lg font-semibold text-gray-900">{pendientesAprobacion}</p>
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
                  <p className="text-lg font-semibold text-gray-900">{movimientosFiltrados.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filtros y Acciones */}
        <div className="col-span-12">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                <TextInput
                  placeholder="Buscar concepto o asesor..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros({...filtros, busqueda: e.target.value})}
                />
                <Select
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
                >
                  <option value="">Todos los tipos</option>
                  <option value="Anticipo">Anticipo</option>
                  <option value="Ajuste">Ajuste</option>
                  <option value="Descuento">Descuento</option>
                </Select>
                <Select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                >
                  <option value="">Todos los estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
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
              </div>
              <Button onClick={() => setShowModal(true)}>
                <Icon icon="solar:add-circle-bold-duotone" className="mr-2 h-4 w-4" />
                Nuevo Movimiento
              </Button>
            </div>
          </Card>
        </div>

        {/* Tabla de Movimientos */}
        <div className="col-span-12">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Anticipos y Ajustes
              </h3>
              <Button color="light" size="sm">
                <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table striped>
                <Table.Head>
                  <Table.HeadCell>Fecha</Table.HeadCell>
                  <Table.HeadCell>Tipo</Table.HeadCell>
                  <Table.HeadCell>Asesor</Table.HeadCell>
                  <Table.HeadCell>Concepto</Table.HeadCell>
                  <Table.HeadCell>Valor</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Observaciones</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {movimientosFiltrados.map((movimiento) => (
                    <Table.Row key={movimiento.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {movimiento.fecha}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={tipoColors[movimiento.tipo]} size="sm">
                          {movimiento.tipo}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{movimiento.asesor}</Table.Cell>
                      <Table.Cell>{movimiento.concepto}</Table.Cell>
                      <Table.Cell className={`font-semibold ${movimiento.valor < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(movimiento.valor)}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={estadoColors[movimiento.estado]} size="sm">
                          {movimiento.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="max-w-xs truncate">
                        {movimiento.observaciones}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex space-x-1">
                          <Button size="sm" color="light">
                            <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" />
                          </Button>
                          {movimiento.estado === 'Pendiente' && (
                            <>
                              <Button size="sm" color="success" onClick={() => handleAprobar(movimiento.id)}>
                                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" />
                              </Button>
                              <Button size="sm" color="failure" onClick={() => handleRechazar(movimiento.id)}>
                                <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {movimientosFiltrados.length === 0 && (
              <div className="text-center py-8">
                <Icon icon="solar:document-text-bold-duotone" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No se encontraron movimientos con los filtros aplicados</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal Nuevo Movimiento */}
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>Nuevo Movimiento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tipo">Tipo de Movimiento</Label>
              <Select
                id="tipo"
                value={nuevoMovimiento.tipo}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, tipo: e.target.value})}
              >
                <option value="Anticipo">Anticipo</option>
                <option value="Ajuste">Ajuste</option>
                <option value="Descuento">Descuento</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="asesor">Asesor</Label>
              <Select
                id="asesor"
                value={nuevoMovimiento.asesor}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, asesor: e.target.value})}
              >
                <option value="">Seleccionar asesor</option>
                <option value="María García">María García</option>
                <option value="Carlos López">Carlos López</option>
                <option value="Ana Rodríguez">Ana Rodríguez</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="concepto">Concepto</Label>
              <TextInput
                id="concepto"
                value={nuevoMovimiento.concepto}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, concepto: e.target.value})}
                placeholder="Descripción del movimiento"
              />
            </div>
            <div>
              <Label htmlFor="valor">Valor</Label>
              <TextInput
                id="valor"
                type="number"
                value={nuevoMovimiento.valor}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, valor: e.target.value})}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <TextInput
                id="observaciones"
                value={nuevoMovimiento.observaciones}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, observaciones: e.target.value})}
                placeholder="Observaciones adicionales"
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
    </>
  );
};

export default AnticiposAjustes; 
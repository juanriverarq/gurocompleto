import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Table, TextInput, Dropdown } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import contratosService from 'src/services/contratosService';

const BCrumb = [
  {
    to: '/',
    title: 'Dashboard',
  },
  {
    to: '/apps/legal',
    title: 'Gestión Legal',
  },
  {
    title: 'Contratos de Intermediación',
  },
];

interface Contrato {
  id: string;
  numero_contrato: string;
  aseguradora: string;
  tipo_contrato: 'intermediacion' | 'comision' | 'exclusividad' | 'marco';
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: 'activo' | 'vencido' | 'por_vencer' | 'cancelado' | 'borrador';
  comision_base: number;
  comision_adicional?: number;
  productos_autorizados: string[];
  territorio: string;
  responsable: string;
  archivo_url?: string;
  fecha_firma: string;
  firmado_digitalmente: boolean;
  renovacion_automatica: boolean;
  dias_para_vencer: number;
  valor_estimado_anual: number;
  clausulas_especiales: string[];
  observaciones: string;
}

interface PlantillaContrato {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string;
  archivo_url: string;
  variables: string[];
  activa: boolean;
}

const Contratos = () => {
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroAseguradora, setFiltroAseguradora] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [contratoSeleccionado, setContratoSeleccionado] = useState<Contrato | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [estadisticas, setEstadisticas] = useState({
    total_contratos: 0,
    contratos_activos: 0,
    por_vencer_30_dias: 0,
    vencidos: 0,
    valor_total_estimado: 0,
  });

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [nuevoContrato, setNuevoContrato] = useState({
    numero_contrato: '',
    aseguradora: '',
    tipo_contrato: 'intermediacion' as Contrato['tipo_contrato'],
    fecha_inicio: '',
    fecha_vencimiento: '',
    estado: 'borrador' as Contrato['estado'],
    comision_base: 0,
    comision_adicional: 0,
    territorio: '',
    responsable: '',
    valor_estimado_anual: 0,
  });
  const [editarContrato, setEditarContrato] = useState({
    id: '',
    numero_contrato: '',
    aseguradora: '',
    tipo_contrato: 'intermediacion' as Contrato['tipo_contrato'],
    fecha_inicio: '',
    fecha_vencimiento: '',
    estado: 'borrador' as Contrato['estado'],
    comision_base: 0,
    comision_adicional: 0,
    territorio: '',
    responsable: '',
    valor_estimado_anual: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await contratosService.list({ per_page: 100 });
        const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
        setContratos(
          rows.map((r: any) => ({
            id: String(r.id),
            numero_contrato: r.numero_contrato,
            aseguradora: r.aseguradora,
            tipo_contrato: r.tipo_contrato,
            fecha_inicio: (r.fecha_inicio || '').split('T')[0] || '',
            fecha_vencimiento: (r.fecha_vencimiento || '').split('T')[0] || '',
            estado: r.estado,
            comision_base: Number(r.comision_base || 0),
            comision_adicional: r.comision_adicional ? Number(r.comision_adicional) : undefined,
            productos_autorizados: r.productos_autorizados || [],
            territorio: r.territorio || '',
            responsable: r.responsable || '',
            archivo_url: r.archivo_url || undefined,
            fecha_firma: (r.fecha_firma || '').split('T')[0] || '',
            firmado_digitalmente: !!r.firmado_digitalmente,
            renovacion_automatica: !!r.renovacion_automatica,
            dias_para_vencer: 0,
            valor_estimado_anual: Number(r.valor_estimado_anual || 0),
            clausulas_especiales: r.clausulas_especiales || [],
            observaciones: r.observaciones || '',
          })),
        );
        // Estadísticas simples
        setEstadisticas((s) => ({
          ...s,
          total_contratos: rows.length,
          contratos_activos: rows.filter((x: any) => x.estado === 'activo').length,
          vencidos: rows.filter((x: any) => x.estado === 'vencido').length,
        }));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(valor);
  };

  const obtenerColorEstado = (estado: string) => {
    const colores = {
      activo: 'bg-green-100 text-green-800',
      vencido: 'bg-red-100 text-red-800',
      por_vencer: 'bg-yellow-100 text-yellow-800',
      cancelado: 'bg-gray-100 text-gray-800',
      borrador: 'bg-blue-100 text-blue-800',
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorTipo = (tipo: string) => {
    const colores = {
      intermediacion: 'bg-blue-100 text-blue-800',
      comision: 'bg-purple-100 text-purple-800',
      exclusividad: 'bg-orange-100 text-orange-800',
      marco: 'bg-indigo-100 text-indigo-800',
    };
    return colores[tipo as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const contratosFiltrados = contratos.filter((contrato) => {
    const cumpleEstado = filtroEstado === 'todos' || contrato.estado === filtroEstado;
    const cumpleAseguradora =
      filtroAseguradora === 'todos' || contrato.aseguradora === filtroAseguradora;
    const cumpleTipo = filtroTipo === 'todos' || contrato.tipo_contrato === filtroTipo;
    const cumpleBusqueda =
      contrato.numero_contrato.toLowerCase().includes(busqueda.toLowerCase()) ||
      contrato.aseguradora.toLowerCase().includes(busqueda.toLowerCase());

    return cumpleEstado && cumpleAseguradora && cumpleTipo && cumpleBusqueda;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Contratos de Intermediación" items={BCrumb} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
          Contratos de Intermediación
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona contratos con aseguradoras, seguimiento de vencimientos y documentación legal.
        </p>
      </div>

      {/* Alertas de Vencimientos */}
      {estadisticas.por_vencer_30_dias > 0 && (
        <Alert color="warning" className="mb-6">
          <Icon icon="solar:warning-triangle-bold" className="mr-2" width={20} />
          <span>
            <strong>{estadisticas.por_vencer_30_dias} contratos</strong> vencen en los próximos 30
            días. Revisa y gestiona las renovaciones.
          </span>
        </Alert>
      )}

      {estadisticas.vencidos > 0 && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-triangle-bold" className="mr-2" width={20} />
          <span>
            <strong>{estadisticas.vencidos} contratos vencidos</strong> requieren atención
            inmediata.
          </span>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:document-text-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">
                {estadisticas.total_contratos}
              </h3>
              <p className="text-xs text-gray-500">Total Contratos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">
                {estadisticas.contratos_activos}
              </h3>
              <p className="text-xs text-gray-500">Activos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">
                {estadisticas.por_vencer_30_dias}
              </h3>
              <p className="text-xs text-gray-500">Por Vencer</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Icon icon="solar:danger-triangle-bold" className="text-red-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">
                {estadisticas.vencidos}
              </h3>
              <p className="text-xs text-gray-500">Vencidos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:dollar-minimalistic-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">
                {formatearMoneda(estadisticas.valor_total_estimado)}
              </h3>
              <p className="text-xs text-gray-500">Valor Estimado</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros y Acciones */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Buscar Contrato</label>
              <TextInput
                placeholder="Número o aseguradora..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icon={() => <Icon icon="solar:magnifer-bold" width={16} />}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">Activo</option>
                <option value="por_vencer">Por Vencer</option>
                <option value="vencido">Vencido</option>
                <option value="borrador">Borrador</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Aseguradora</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroAseguradora}
                onChange={(e) => setFiltroAseguradora(e.target.value)}
              >
                <option value="todos">Todas las Aseguradoras</option>
                <option value="Seguros Bolívar">Seguros Bolívar</option>
                <option value="Mapfre Colombia">Mapfre Colombia</option>
                <option value="Allianz Seguros">Allianz Seguros</option>
                <option value="La Previsora">La Previsora</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos los Tipos</option>
                <option value="intermediacion">Intermediación</option>
                <option value="comision">Comisión</option>
                <option value="exclusividad">Exclusividad</option>
                <option value="marco">Marco</option>
              </select>
            </div>

            <div className="flex gap-2">
              <HeroButton icon="solar:add-circle-bold" onClick={() => setMostrarCrear(true)}>Nuevo Contrato</HeroButton>
              <Button color="gray" size="sm" onClick={() => setMostrarPlantillas(true)}>
                <Icon icon="solar:document-add-bold" className="mr-2" width={16} />
                Plantillas
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Contratos */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Contratos ({contratosFiltrados.length})</h3>
            <Button color="gray" size="sm">
              <Icon icon="solar:export-bold" className="mr-2" width={16} />
              Exportar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Contrato</Table.HeadCell>
                <Table.HeadCell>Aseguradora</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Vigencia</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Comisión</Table.HeadCell>
                <Table.HeadCell>Valor Estimado</Table.HeadCell>
                <Table.HeadCell>Responsable</Table.HeadCell>
                <Table.HeadCell>Firma Digital</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {contratosFiltrados.map((contrato) => (
                  <Table.Row
                    key={contrato.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell>
                      <div>
                        <p className="font-semibold text-sm">{contrato.numero_contrato}</p>
                        <p className="text-xs text-gray-500">ID: {contrato.id}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-medium">{contrato.aseguradora}</Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorTipo(contrato.tipo_contrato)} size="sm">
                        {contrato.tipo_contrato}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p>
                          {contrato.fecha_inicio} - {contrato.fecha_vencimiento}
                        </p>
                        {contrato.dias_para_vencer > 0 && contrato.dias_para_vencer <= 30 && (
                          <p className="text-yellow-600 font-semibold">
                            Vence en {contrato.dias_para_vencer} días
                          </p>
                        )}
                        {contrato.dias_para_vencer < 0 && (
                          <p className="text-red-600 font-semibold">
                            Vencido hace {Math.abs(contrato.dias_para_vencer)} días
                          </p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorEstado(contrato.estado)} size="sm">
                        {contrato.estado.replace('_', ' ')}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{contrato.comision_base}%</p>
                        {contrato.comision_adicional && (
                          <p className="text-green-600">+{contrato.comision_adicional}%</p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-semibold text-green-600">
                      {formatearMoneda(contrato.valor_estimado_anual)}
                    </Table.Cell>
                    <Table.Cell>{contrato.responsable}</Table.Cell>
                    <Table.Cell>
                      {contrato.firmado_digitalmente ? (
                        <Badge color="success" size="sm">
                          <Icon icon="solar:check-circle-bold" className="mr-1" width={12} />
                          Firmado
                        </Badge>
                      ) : (
                        <Badge color="warning" size="sm">
                          <Icon icon="solar:clock-circle-bold" className="mr-1" width={12} />
                          Pendiente
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button
                          size="xs"
                          color="gray"
                          onClick={() => {
                            setContratoSeleccionado(contrato);
                            setMostrarModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={14} />
                        </Button>
                        <Button
                          size="xs"
                          color="primary"
                          onClick={() => {
                            setEditarContrato({
                              id: contrato.id,
                              numero_contrato: contrato.numero_contrato,
                              aseguradora: contrato.aseguradora,
                              tipo_contrato: contrato.tipo_contrato,
                              fecha_inicio: contrato.fecha_inicio,
                              fecha_vencimiento: contrato.fecha_vencimiento,
                              estado: contrato.estado,
                              comision_base: contrato.comision_base,
                              comision_adicional: contrato.comision_adicional || 0,
                              territorio: contrato.territorio,
                              responsable: contrato.responsable,
                              valor_estimado_anual: contrato.valor_estimado_anual,
                            });
                            setMostrarEditar(true);
                          }}
                        >
                          <Icon icon="solar:pen-bold" width={14} />
                        </Button>
                        {contrato.archivo_url && (
                          <Button size="xs" color="info">
                            <Icon icon="solar:download-bold" width={14} />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Card>

      {/* Modal de Detalle */}
      <Modal show={mostrarModal} onClose={() => setMostrarModal(false)} size="xl">
        <Modal.Header>Detalle del Contrato</Modal.Header>
        <Modal.Body>
          {contratoSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Información General</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Número:</strong> {contratoSeleccionado.numero_contrato}
                    </p>
                    <p>
                      <strong>Aseguradora:</strong> {contratoSeleccionado.aseguradora}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {contratoSeleccionado.tipo_contrato}
                    </p>
                    <p>
                      <strong>Estado:</strong>
                      <Badge className={`ml-2 ${obtenerColorEstado(contratoSeleccionado.estado)}`}>
                        {contratoSeleccionado.estado}
                      </Badge>
                    </p>
                    <p>
                      <strong>Responsable:</strong> {contratoSeleccionado.responsable}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Condiciones Comerciales</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Comisión Base:</strong> {contratoSeleccionado.comision_base}%
                    </p>
                    {contratoSeleccionado.comision_adicional && (
                      <p>
                        <strong>Comisión Adicional:</strong>{' '}
                        {contratoSeleccionado.comision_adicional}%
                      </p>
                    )}
                    <p>
                      <strong>Territorio:</strong> {contratoSeleccionado.territorio}
                    </p>
                    <p>
                      <strong>Valor Estimado Anual:</strong>{' '}
                      {formatearMoneda(contratoSeleccionado.valor_estimado_anual)}
                    </p>
                    <p>
                      <strong>Renovación Automática:</strong>{' '}
                      {contratoSeleccionado.renovacion_automatica ? 'Sí' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Vigencia y Firma</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>
                      <strong>Fecha de Inicio:</strong> {contratoSeleccionado.fecha_inicio}
                    </p>
                    <p>
                      <strong>Fecha de Vencimiento:</strong>{' '}
                      {contratoSeleccionado.fecha_vencimiento}
                    </p>
                    <p>
                      <strong>Fecha de Firma:</strong> {contratoSeleccionado.fecha_firma}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Firmado Digitalmente:</strong>{' '}
                      {contratoSeleccionado.firmado_digitalmente ? 'Sí' : 'No'}
                    </p>
                    {contratoSeleccionado.dias_para_vencer > 0 ? (
                      <p>
                        <strong>Días para Vencer:</strong> {contratoSeleccionado.dias_para_vencer}
                      </p>
                    ) : (
                      <p className="text-red-600">
                        <strong>Vencido hace:</strong>{' '}
                        {Math.abs(contratoSeleccionado.dias_para_vencer)} días
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Productos Autorizados</h4>
                <div className="flex flex-wrap gap-2">
                  {contratoSeleccionado.productos_autorizados.map((producto, index) => (
                    <Badge key={index} color="info" size="sm">
                      {producto}
                    </Badge>
                  ))}
                </div>
              </div>

              {contratoSeleccionado.clausulas_especiales.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Cláusulas Especiales</h4>
                  <div className="flex flex-wrap gap-2">
                    {contratoSeleccionado.clausulas_especiales.map((clausula, index) => (
                      <Badge key={index} color="warning" size="sm">
                        {clausula}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {contratoSeleccionado.observaciones && (
                <div>
                  <h4 className="font-semibold mb-3">Observaciones</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">
                    {contratoSeleccionado.observaciones}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          {contratoSeleccionado?.archivo_url && (
            <Button color="info">
              <Icon icon="solar:download-bold" className="mr-2" width={16} />
              Descargar
            </Button>
          )}
          <Button color="primary">
            <Icon icon="solar:pen-bold" className="mr-2" width={16} />
            Editar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Crear Contrato */}
      <Modal show={mostrarCrear} onClose={() => setMostrarCrear(false)}>
        <Modal.Header>Nuevo Contrato</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Número de Contrato</label>
              <TextInput
                value={nuevoContrato.numero_contrato}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, numero_contrato: e.target.value })
                }
                placeholder="INT-2025-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Aseguradora</label>
              <TextInput
                value={nuevoContrato.aseguradora}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, aseguradora: e.target.value })
                }
                placeholder="Nombre aseguradora"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Contrato</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={nuevoContrato.tipo_contrato}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, tipo_contrato: e.target.value as any })
                }
              >
                <option value="intermediacion">Intermediación</option>
                <option value="comision">Comisión</option>
                <option value="exclusividad">Exclusividad</option>
                <option value="marco">Marco</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={nuevoContrato.estado}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, estado: e.target.value as any })
                }
              >
                <option value="borrador">Borrador</option>
                <option value="activo">Activo</option>
                <option value="por_vencer">Por Vencer</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
              <TextInput
                type="date"
                value={nuevoContrato.fecha_inicio}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, fecha_inicio: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Vencimiento</label>
              <TextInput
                type="date"
                value={nuevoContrato.fecha_vencimiento}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, fecha_vencimiento: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comisión Base (%)</label>
              <TextInput
                type="number"
                value={String(nuevoContrato.comision_base)}
                onChange={(e) =>
                  setNuevoContrato({
                    ...nuevoContrato,
                    comision_base: parseFloat(e.target.value || '0'),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comisión Adicional (%)</label>
              <TextInput
                type="number"
                value={String(nuevoContrato.comision_adicional)}
                onChange={(e) =>
                  setNuevoContrato({
                    ...nuevoContrato,
                    comision_adicional: parseFloat(e.target.value || '0'),
                  })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Territorio</label>
              <TextInput
                value={nuevoContrato.territorio}
                onChange={(e) => setNuevoContrato({ ...nuevoContrato, territorio: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Responsable</label>
              <TextInput
                value={nuevoContrato.responsable}
                onChange={(e) =>
                  setNuevoContrato({ ...nuevoContrato, responsable: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Estimado Anual</label>
              <TextInput
                type="number"
                value={String(nuevoContrato.valor_estimado_anual)}
                onChange={(e) =>
                  setNuevoContrato({
                    ...nuevoContrato,
                    valor_estimado_anual: parseInt(e.target.value || '0', 10),
                  })
                }
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarCrear(false)}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              if (
                !nuevoContrato.numero_contrato.trim() ||
                !nuevoContrato.aseguradora.trim() ||
                !nuevoContrato.fecha_inicio ||
                !nuevoContrato.fecha_vencimiento
              ) {
                alert('Completa los campos requeridos');
                return;
              }
              try {
                setLoading(true);
                await contratosService.create({
                  numero_contrato: nuevoContrato.numero_contrato,
                  aseguradora: nuevoContrato.aseguradora,
                  tipo_contrato: nuevoContrato.tipo_contrato,
                  fecha_inicio: nuevoContrato.fecha_inicio,
                  fecha_vencimiento: nuevoContrato.fecha_vencimiento,
                  estado: nuevoContrato.estado,
                  comision_base: nuevoContrato.comision_base,
                  comision_adicional: nuevoContrato.comision_adicional,
                  territorio: nuevoContrato.territorio,
                  responsable: nuevoContrato.responsable,
                  valor_estimado_anual: nuevoContrato.valor_estimado_anual,
                });
                const res = await contratosService.list({ per_page: 100 });
                const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
                setContratos(
                  rows.map((r: any) => ({
                    id: String(r.id),
                    numero_contrato: r.numero_contrato,
                    aseguradora: r.aseguradora,
                    tipo_contrato: r.tipo_contrato,
                    fecha_inicio: (r.fecha_inicio || '').split('T')[0] || '',
                    fecha_vencimiento: (r.fecha_vencimiento || '').split('T')[0] || '',
                    estado: r.estado,
                    comision_base: Number(r.comision_base || 0),
                    comision_adicional: r.comision_adicional
                      ? Number(r.comision_adicional)
                      : undefined,
                    productos_autorizados: r.productos_autorizados || [],
                    territorio: r.territorio || '',
                    responsable: r.responsable || '',
                    archivo_url: r.archivo_url || undefined,
                    fecha_firma: (r.fecha_firma || '').split('T')[0] || '',
                    firmado_digitalmente: !!r.firmado_digitalmente,
                    renovacion_automatica: !!r.renovacion_automatica,
                    dias_para_vencer: 0,
                    valor_estimado_anual: Number(r.valor_estimado_anual || 0),
                    clausulas_especiales: r.clausulas_especiales || [],
                    observaciones: r.observaciones || '',
                  })),
                );
                setMostrarCrear(false);
                setNuevoContrato({
                  numero_contrato: '',
                  aseguradora: '',
                  tipo_contrato: 'intermediacion',
                  fecha_inicio: '',
                  fecha_vencimiento: '',
                  estado: 'borrador',
                  comision_base: 0,
                  comision_adicional: 0,
                  territorio: '',
                  responsable: '',
                  valor_estimado_anual: 0,
                });
              } catch (e) {
                console.error(e);
                alert('Error creando contrato');
              } finally {
                setLoading(false);
              }
            }}
          >
            Crear
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Contrato */}
      <Modal show={mostrarEditar} onClose={() => setMostrarEditar(false)}>
        <Modal.Header>Editar Contrato</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Número de Contrato</label>
              <TextInput
                value={editarContrato.numero_contrato}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, numero_contrato: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Aseguradora</label>
              <TextInput
                value={editarContrato.aseguradora}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, aseguradora: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Contrato</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={editarContrato.tipo_contrato}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, tipo_contrato: e.target.value as any })
                }
              >
                <option value="intermediacion">Intermediación</option>
                <option value="comision">Comisión</option>
                <option value="exclusividad">Exclusividad</option>
                <option value="marco">Marco</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={editarContrato.estado}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, estado: e.target.value as any })
                }
              >
                <option value="borrador">Borrador</option>
                <option value="activo">Activo</option>
                <option value="por_vencer">Por Vencer</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
              <TextInput
                type="date"
                value={editarContrato.fecha_inicio}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, fecha_inicio: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Vencimiento</label>
              <TextInput
                type="date"
                value={editarContrato.fecha_vencimiento}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, fecha_vencimiento: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comisión Base (%)</label>
              <TextInput
                type="number"
                value={String(editarContrato.comision_base)}
                onChange={(e) =>
                  setEditarContrato({
                    ...editarContrato,
                    comision_base: parseFloat(e.target.value || '0'),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comisión Adicional (%)</label>
              <TextInput
                type="number"
                value={String(editarContrato.comision_adicional)}
                onChange={(e) =>
                  setEditarContrato({
                    ...editarContrato,
                    comision_adicional: parseFloat(e.target.value || '0'),
                  })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Territorio</label>
              <TextInput
                value={editarContrato.territorio}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, territorio: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Responsable</label>
              <TextInput
                value={editarContrato.responsable}
                onChange={(e) =>
                  setEditarContrato({ ...editarContrato, responsable: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Estimado Anual</label>
              <TextInput
                type="number"
                value={String(editarContrato.valor_estimado_anual)}
                onChange={(e) =>
                  setEditarContrato({
                    ...editarContrato,
                    valor_estimado_anual: parseInt(e.target.value || '0', 10),
                  })
                }
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarEditar(false)}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              try {
                setLoading(true);
                await contratosService.update(Number(editarContrato.id), {
                  numero_contrato: editarContrato.numero_contrato,
                  aseguradora: editarContrato.aseguradora,
                  tipo_contrato: editarContrato.tipo_contrato,
                  fecha_inicio: editarContrato.fecha_inicio,
                  fecha_vencimiento: editarContrato.fecha_vencimiento,
                  estado: editarContrato.estado,
                  comision_base: editarContrato.comision_base,
                  comision_adicional: editarContrato.comision_adicional,
                  territorio: editarContrato.territorio,
                  responsable: editarContrato.responsable,
                  valor_estimado_anual: editarContrato.valor_estimado_anual,
                });
                const res = await contratosService.list({ per_page: 100 });
                const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
                setContratos(
                  rows.map((r: any) => ({
                    id: String(r.id),
                    numero_contrato: r.numero_contrato,
                    aseguradora: r.aseguradora,
                    tipo_contrato: r.tipo_contrato,
                    fecha_inicio: (r.fecha_inicio || '').split('T')[0] || '',
                    fecha_vencimiento: (r.fecha_vencimiento || '').split('T')[0] || '',
                    estado: r.estado,
                    comision_base: Number(r.comision_base || 0),
                    comision_adicional: r.comision_adicional
                      ? Number(r.comision_adicional)
                      : undefined,
                    productos_autorizados: r.productos_autorizados || [],
                    territorio: r.territorio || '',
                    responsable: r.responsable || '',
                    archivo_url: r.archivo_url || undefined,
                    fecha_firma: (r.fecha_firma || '').split('T')[0] || '',
                    firmado_digitalmente: !!r.firmado_digitalmente,
                    renovacion_automatica: !!r.renovacion_automatica,
                    dias_para_vencer: 0,
                    valor_estimado_anual: Number(r.valor_estimado_anual || 0),
                    clausulas_especiales: r.clausulas_especiales || [],
                    observaciones: r.observaciones || '',
                  })),
                );
                setMostrarEditar(false);
              } catch (e) {
                console.error(e);
                alert('Error actualizando contrato');
              } finally {
                setLoading(false);
              }
            }}
          >
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Plantillas */}
      <Modal show={mostrarPlantillas} onClose={() => setMostrarPlantillas(false)} size="lg">
        <Modal.Header>Plantillas de Contratos</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {plantillas.map((plantilla) => (
              <div key={plantilla.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{plantilla.nombre}</h4>
                  <Badge color={plantilla.activa ? 'success' : 'gray'} size="sm">
                    {plantilla.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{plantilla.descripcion}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {plantilla.variables.map((variable, index) => (
                      <Badge key={index} color="gray" size="sm">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" color="primary">
                      <Icon icon="solar:copy-bold" className="mr-1" width={12} />
                      Usar
                    </Button>
                    <Button size="xs" color="gray">
                      <Icon icon="solar:download-bold" className="mr-1" width={12} />
                      Descargar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarPlantillas(false)}>
            Cerrar
          </Button>
          <Button color="primary">
            <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
            Nueva Plantilla
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Contratos;

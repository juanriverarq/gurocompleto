import { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Button,
  Alert,
  Modal,
  TextInput,
  Select,
  ToggleSwitch,
  Spinner,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import enlacesService from 'src/services/enlacesCotizacionService';

const BCrumb = [
  {
    to: '/',
    title: 'Dashboard',
  },
  {
    to: '/apps/marketing',
    title: 'Marketing',
  },
  {
    title: 'Enlaces',
  },
  {
    title: 'Crear Enlaces',
  },
];

const enlacesData: any[] = [];

const tiposSeguro = [
  {
    value: 'vida',
    label: 'Seguro de Vida',
    icon: 'solar:heart-bold-duotone',
    color: 'text-red-500',
  },
  {
    value: 'autos',
    label: 'Seguro de Autos',
    icon: 'solar:car-bold-duotone',
    color: 'text-blue-500',
  },
  {
    value: 'hogar',
    label: 'Seguro Hogar',
    icon: 'solar:home-bold-duotone',
    color: 'text-green-500',
  },
  {
    value: 'empresarial',
    label: 'Empresarial',
    icon: 'solar:buildings-bold-duotone',
    color: 'text-purple-500',
  },
];

const getTipoInfo = (tipo: string) => {
  return tiposSeguro.find((t) => t.value === tipo) || tiposSeguro[0];
};

const EnlacesCotizacion = () => {
  const [enlaces, setEnlaces] = useState<any[]>(enlacesData);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtroTipo] = useState('todos');
  const [nuevoEnlace, setNuevoEnlace] = useState({
    nombre: '',
    tipo: 'vida',
    descripcion: '',
    mensaje_bienvenida: '',
  });

  const enlacesFiltrados =
    filtroTipo === 'todos' ? enlaces : enlaces.filter((e) => e.tipo === filtroTipo);

  const totalEnlaces = enlaces.length;
  const enlacesActivos = enlaces.filter((e) => e.activo).length;
  const totalVisitas = enlaces.reduce((acc, e) => acc + e.visitas, 0);
  const totalCotizaciones = enlaces.reduce((acc, e) => acc + e.cotizaciones, 0);

  const copiarEnlace = (enlace: string) => {
    navigator.clipboard.writeText(`https://${enlace}`);
  };

  const generarEnlace = (tipo: string, nombre: string) => {
    const slug = nombre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `fgr.link/latamseguros/co/${tipo}/${slug}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await enlacesService.list({ per_page: 100 });
        const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
        setEnlaces(rows);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <BreadcrumbComp title="Crear Enlaces de Cotización" items={BCrumb} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
          Crear Enlaces de Cotización
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Crea y administra enlaces personalizados de cotización para tus productos.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:link-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalEnlaces}</h3>
              <p className="text-sm text-gray-500">Enlaces Totales</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{enlacesActivos}</h3>
              <p className="text-sm text-gray-500">Enlaces Activos</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:eye-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalVisitas}</h3>
              <p className="text-sm text-gray-500">Visitas Totales</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:document-text-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalCotizaciones}</h3>
              <p className="text-sm text-gray-500">Cotizaciones</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerta informativa */}
      <Alert color="info" className="mb-6">
        <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
        <span>
          <strong>Enlaces Personalizados:</strong> Crea enlaces únicos para cada tipo de seguro. Los
          clientes podrán cotizar directamente desde estos enlaces.
        </span>
      </Alert>

      {/* Sección Enlaces Activos */}
      <Card className="mb-6">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon icon="solar:link-bold" className="text-primary" width={24} />
              <h3 className="text-xl font-semibold text-dark dark:text-white">Enlaces Activos</h3>
              <Badge color="success" className="ml-2">
                {enlacesActivos} Productos
              </Badge>
            </div>
            <Button color="primary" onClick={() => setShowModal(true)}>
              <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
              Nuevo Enlace
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enlacesFiltrados
              .filter((e) => e.activo)
              .map((enlace) => {
                const tipoInfo = getTipoInfo(enlace.tipo);
                return (
                  <div
                    key={enlace.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          <Icon icon={tipoInfo.icon} className={tipoInfo.color} width={24} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-dark dark:text-white">
                            {enlace.nombre}
                          </h4>
                          <p className="text-sm text-gray-500">{enlace.descripcion}</p>
                        </div>
                      </div>

                      <ToggleSwitch
                        checked={!!enlace.activo}
                        onChange={async () => {
                          try {
                            await enlacesService.toggle(Number(enlace.id));
                            const res = await enlacesService.list({ per_page: 100 });
                            const rows =
                              (res?.data || res?.data?.data || res || []).data || res?.data || [];
                            setEnlaces(rows);
                          } catch (_) {}
                        }}
                      />
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon icon="solar:link-bold" className="text-gray-500" width={16} />
                        <code className="text-primary font-mono">{enlace.enlace}</code>
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => copiarEnlace(enlace.enlace)}
                          title="Copiar enlace"
                        >
                          <Icon icon="solar:copy-bold" width={14} />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Visitas:</span>
                        <span className="font-medium text-dark dark:text-white ml-1">
                          {enlace.visitas}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cotizaciones:</span>
                        <span className="font-medium text-dark dark:text-white ml-1">
                          {enlace.cotizaciones}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="xs" color="primary" className="flex-1">
                        <Icon icon="solar:share-bold" className="mr-1" width={12} />
                        Compartir
                      </Button>
                      <Button size="xs" color="info">
                        <Icon icon="solar:chart-bold" width={12} />
                      </Button>
                      <Button
                        size="xs"
                        color="light"
                        className="!text-gray-500"
                        onClick={async () => {
                          try {
                            await enlacesService.remove(Number(enlace.id));
                            const res = await enlacesService.list({ per_page: 100 });
                            const rows =
                              (res?.data || res?.data?.data || res || []).data || res?.data || [];
                            setEnlaces(rows);
                          } catch (_) {}
                        }}
                      >
                        <Icon icon="solar:settings-bold" width={12} />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>

      {/* Modal Nuevo Enlace */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Crear Nuevo Enlace de Cotización</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Enlace
              </label>
              <TextInput
                placeholder="Ej: Seguro de Auto Premium"
                value={nuevoEnlace.nombre}
                onChange={(e) => setNuevoEnlace({ ...nuevoEnlace, nombre: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Seguro
              </label>
              <Select
                value={nuevoEnlace.tipo}
                onChange={(e) => setNuevoEnlace({ ...nuevoEnlace, tipo: e.target.value })}
              >
                {tiposSeguro.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <TextInput
                placeholder="Descripción breve del producto"
                value={nuevoEnlace.descripcion}
                onChange={(e) => setNuevoEnlace({ ...nuevoEnlace, descripcion: e.target.value })}
              />
            </div>

            {nuevoEnlace.nombre && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enlace Generado
                </label>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-primary font-mono text-sm">
                    https://{generarEnlace(nuevoEnlace.tipo, nuevoEnlace.nombre)}
                  </code>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              if (!nuevoEnlace.nombre.trim()) return;
              try {
                setLoading(true);
                await enlacesService.create({
                  nombre: nuevoEnlace.nombre,
                  tipo: nuevoEnlace.tipo,
                  descripcion: nuevoEnlace.descripcion,
                  mensaje_bienvenida: nuevoEnlace.mensaje_bienvenida,
                });
                const res = await enlacesService.list({ per_page: 100 });
                const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
                setEnlaces(rows);
                setShowModal(false);
                setNuevoEnlace({
                  nombre: '',
                  tipo: 'vida',
                  descripcion: '',
                  mensaje_bienvenida: '',
                });
              } catch (_) {
              } finally {
                setLoading(false);
              }
            }}
          >
            <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
            Crear Enlace
          </Button>
        </Modal.Footer>
      </Modal>

      {loading && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </>
  );
};

export default EnlacesCotizacion;

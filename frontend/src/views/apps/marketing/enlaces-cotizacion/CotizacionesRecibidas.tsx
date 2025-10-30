import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Badge,
  Table,
  Alert,
  Spinner,
  Modal,
  TextInput,
  Label,
  Select,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { INSURANCE_PRODUCTS } from 'src/data/insuranceProducts';


interface Cotizacion {
  id: string;
  slug: string;
  tipo: string;
  data: Record<string, any>;
  created_at: string;
  status: 'nueva' | 'contactada' | 'cerrada' | 'descartada';
}

const CotizacionesRecibidas: React.FC = () => {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Cargar cotizaciones desde localStorage (fallback)
  useEffect(() => {
    const loadCotizaciones = () => {
      try {
        const raw = localStorage.getItem('quotes_submissions');
        if (raw) {
          const submissions = JSON.parse(raw);
          const formatted: Cotizacion[] = submissions.map((sub: any, idx: number) => ({
            id: `local-${idx}`,
            slug: sub.slug,
            tipo: sub.tipo,
            data: sub.data,
            created_at: new Date().toISOString(), // Simulado
            status: 'nueva' as const,
          }));
          setCotizaciones(formatted);
        }
      } catch (error) {
        console.error('Error loading cotizaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCotizaciones();
  }, []);

  const cotizacionesFiltradas = cotizaciones.filter((c) => {
    const tipoMatch = filtroTipo === 'todos' || c.tipo === filtroTipo;
    const statusMatch = filtroStatus === 'todos' || c.status === filtroStatus;
    return tipoMatch && statusMatch;
  });

  const getTipoInfo = (tipo: string) => {
    return INSURANCE_PRODUCTS.find((p) => p.value === tipo) || INSURANCE_PRODUCTS[0];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nueva': return 'info';
      case 'contactada': return 'warning';
      case 'cerrada': return 'success';
      case 'descartada': return 'failure';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'nueva': return 'Nueva';
      case 'contactada': return 'Contactada';
      case 'cerrada': return 'Cerrada';
      case 'descartada': return 'Descartada';
      default: return status;
    }
  };

  const handleStatusChange = (cotizacionId: string, newStatus: string) => {
    setCotizaciones((prev) =>
      prev.map((c) =>
        c.id === cotizacionId ? { ...c, status: newStatus as Cotizacion['status'] } : c
      )
    );
  };

  const totalCotizaciones = cotizaciones.length;
  const nuevasCotizaciones = cotizaciones.filter((c) => c.status === 'nueva').length;
  const contactadasCotizaciones = cotizaciones.filter((c) => c.status === 'contactada').length;
  const cerradasCotizaciones = cotizaciones.filter((c) => c.status === 'cerrada').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
          Cotizaciones Recibidas
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona las cotizaciones recibidas desde tus enlaces de cotización.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:document-text-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalCotizaciones}</h3>
              <p className="text-sm text-gray-500">Total Cotizaciones</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:add-circle-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{nuevasCotizaciones}</h3>
              <p className="text-sm text-gray-500">Nuevas</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:phone-calling-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{contactadasCotizaciones}</h3>
              <p className="text-sm text-gray-500">Contactadas</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{cerradasCotizaciones}</h3>
              <p className="text-sm text-gray-500">Cerradas</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label value="Tipo de Seguro" />
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos los tipos</option>
              {INSURANCE_PRODUCTS.map((prod) => (
                <option key={prod.value} value={prod.value}>
                  {prod.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <Label value="Estado" />
            <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="nueva">Nueva</option>
              <option value="contactada">Contactada</option>
              <option value="cerrada">Cerrada</option>
              <option value="descartada">Descartada</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabla de cotizaciones */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Fecha</Table.HeadCell>
              <Table.HeadCell>Tipo</Table.HeadCell>
              <Table.HeadCell>Enlace</Table.HeadCell>
              <Table.HeadCell>Nombre</Table.HeadCell>
              <Table.HeadCell>Teléfono</Table.HeadCell>
              <Table.HeadCell>Email</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {cotizacionesFiltradas.map((cotizacion) => {
                const tipoInfo = getTipoInfo(cotizacion.tipo);
                return (
                  <Table.Row key={cotizacion.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="font-medium text-gray-900 dark:text-white">
                      {new Date(cotizacion.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Icon icon={tipoInfo.icon} className={tipoInfo.color} width={16} />
                        <span>{tipoInfo.label}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="light" className="text-xs">
                        {cotizacion.slug}/{cotizacion.tipo}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{cotizacion.data.nombre || 'N/A'}</Table.Cell>
                    <Table.Cell>{cotizacion.data.telefono || 'N/A'}</Table.Cell>
                    <Table.Cell>{cotizacion.data.email || 'N/A'}</Table.Cell>
                    <Table.Cell>
                      <Badge color={getStatusColor(cotizacion.status)}>
                        {getStatusLabel(cotizacion.status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          color="gray"
                          onClick={() => {
                            setSelectedCotizacion(cotizacion);
                            setShowModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={12} />
                        </Button>
                        <Select
                          size="xs"
                          value={cotizacion.status}
                          onChange={(e) => handleStatusChange(cotizacion.id, e.target.value)}
                          className="w-32"
                        >
                          <option value="nueva">Nueva</option>
                          <option value="contactada">Contactada</option>
                          <option value="cerrada">Cerrada</option>
                          <option value="descartada">Descartada</option>
                        </Select>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>

        {cotizacionesFiltradas.length === 0 && (
          <div className="text-center py-8">
            <Icon icon="solar:document-text-bold" className="text-gray-400 w-16 h-16 mx-auto mb-4" />
            <p className="text-gray-500">No hay cotizaciones que coincidan con los filtros.</p>
          </div>
        )}
      </Card>

      {/* Modal de detalles */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Detalles de Cotización</Modal.Header>
        <Modal.Body>
          {selectedCotizacion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label value="Tipo de Seguro" />
                  <div className="flex items-center gap-2 mt-1">
                    <Icon icon={getTipoInfo(selectedCotizacion.tipo).icon} width={16} />
                    <span>{getTipoInfo(selectedCotizacion.tipo).label}</span>
                  </div>
                </div>
                <div>
                  <Label value="Fecha" />
                  <p className="mt-1">{new Date(selectedCotizacion.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Información del Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedCotizacion.data).map(([key, value]) => (
                    <div key={key}>
                      <Label value={key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')} />
                      <p className="mt-1 text-gray-700 dark:text-gray-300">{String(value) || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CotizacionesRecibidas;
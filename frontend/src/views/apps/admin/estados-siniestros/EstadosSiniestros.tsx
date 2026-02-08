import React, { useState } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Table,
  Modal,
  TextInput,
  Label,
  Badge,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useEstadosSiniestros } from 'src/hooks/useAdminCrudApi';
import type {
  EstadoSiniestro as EstadoSiniestroType,
  EstadoSiniestroCreate,
} from 'src/types/admin';
import { PermissionGate } from 'src/components/PermissionGate';

const EstadosSiniestros = () => {
  const {
    estadosSiniestros,
    loading,
    error,
    createEstadoSiniestro,
    updateEstadoSiniestro,
    deleteEstadoSiniestro,
  } = useEstadosSiniestros();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EstadoSiniestroType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EstadoSiniestroCreate>({ nombre: '', color: '#3B82F6' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ nombre: '', color: '#3B82F6' });
    setShowModal(true);
  };

  const handleEdit = (item: EstadoSiniestroType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({ nombre: item.nombre, color: item.color });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateEstadoSiniestro(selectedItem.id, formData);
      } else {
        await createEstadoSiniestro(formData);
      }
      setShowModal(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este estado de siniestro?')) {
      try {
        await deleteEstadoSiniestro(id);
      } catch (error) {}
    }
  };

  return (
    <PermissionGate
      route="/apps/admin/estados-siniestros"
      action="ver"
      fallback={
        <div className="flex justify-center items-center h-64">
          <Alert color="warning">No tienes permisos para ver Estados de Siniestros.</Alert>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Estados de Siniestros
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configura los estados disponibles para los siniestros.
            </p>
          </div>
          <PermissionGate route="/apps/admin/estados-siniestros" action="crear">
            <HeroButton icon="solar:add-circle-bold" onClick={handleCreate}>Nuevo Estado</HeroButton>
          </PermissionGate>
        </div>
      </div>

      {/* Contenido principal */}
      {error && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-circle-bold" className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      ) : estadosSiniestros.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay estados de siniestros definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza creando estados para organizar tus siniestros.
            </p>
            <div className="flex justify-center">
              <PermissionGate route="/apps/admin/estados-siniestros" action="crear">
                <HeroButton icon="solar:add-circle-bold" onClick={handleCreate} size="lg">Crear Primer Estado</HeroButton>
              </PermissionGate>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Color</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {estadosSiniestros.map((item) => (
                  <Table.Row
                    key={item.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        {item.nombre}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="indigo" style={{ backgroundColor: item.color, color: '#fff' }}>
                        {item.color}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <PermissionGate route="/apps/admin/estados-siniestros" action="editar">
                          <Button size="sm" color="gray" onClick={() => handleEdit(item)}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate route="/apps/admin/estados-siniestros" action="eliminar">
                          <Button size="sm" color="failure" onClick={() => handleDelete(item.id)}>
                            <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal de formulario */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="md">
        <Modal.Header>
          {isEditing ? 'Editar Estado de Siniestro' : 'Crear Estado de Siniestro.'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre" value="Nombre *" />
                <TextInput
                  id="nombre"
                  type="text"
                  placeholder="Nombre estado siniestro"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="color" value="Color" />
                <div className="flex items-center gap-3">
                  <input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <TextInput
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-2 ml-auto">
              <Button color="gray" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              {isEditing ? (
                <PermissionGate route="/apps/admin/estados-siniestros" action="editar">
                  <Button type="submit" disabled={isSubmitting || !formData.nombre.trim()}>
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Guardando...
                      </>
                    ) : (
                      'Actualizar'
                    )}
                  </Button>
                </PermissionGate>
              ) : (
                <PermissionGate route="/apps/admin/estados-siniestros" action="crear">
                  <Button type="submit" disabled={isSubmitting || !formData.nombre.trim()}>
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Guardando...
                      </>
                    ) : (
                      'Crear'
                    )}
                  </Button>
                </PermissionGate>
              )}
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </PermissionGate>
  );
};

export default EstadosSiniestros;

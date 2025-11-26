import React, { useState } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useTiposAfiliacion } from 'src/hooks/useAdminCrudApi';
import type { TipoAfiliacion as TipoAfiliacionType, TipoAfiliacionCreate } from 'src/types/admin';
import { PermissionGate } from 'src/components/PermissionGate';

const TipoAfiliacion = () => {
  const {
    tiposAfiliacion,
    loading,
    error,
    createTipoAfiliacion,
    updateTipoAfiliacion,
    deleteTipoAfiliacion,
  } = useTiposAfiliacion();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TipoAfiliacionType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<TipoAfiliacionCreate>({ nombre: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ nombre: '' });
    setShowModal(true);
  };

  const handleEdit = (item: TipoAfiliacionType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({ nombre: item.nombre });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateTipoAfiliacion(selectedItem.id, formData);
      } else {
        await createTipoAfiliacion(formData);
      }
      setShowModal(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este tipo de afiliación?')) {
      try {
        await deleteTipoAfiliacion(id);
      } catch (error) {}
    }
  };

  return (
    <PermissionGate
      route="/apps/admin/tipo-afiliacion"
      action="ver"
      fallback={
        <div className="flex justify-center items-center h-64">
          <Alert color="warning">No tienes permisos para ver Tipos de Afiliación.</Alert>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Tipos de Afiliación
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configura los tipos de afiliación disponibles.
            </p>
          </div>
          <PermissionGate route="/apps/admin/tipo-afiliacion" action="crear">
            <Button onClick={handleCreate} className="flex items-center">
              <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
              Nuevo Tipo
            </Button>
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
      ) : tiposAfiliacion.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon
              icon="solar:card-2-bold-duotone"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay tipos de afiliación definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza creando tipos de afiliación para organizar tu sistema.
            </p>
            <div className="flex justify-center">
              <PermissionGate route="/apps/admin/tipo-afiliacion" action="crear">
                <Button onClick={handleCreate}>
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                  Crear Primer Tipo
                </Button>
              </PermissionGate>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Nombre</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {tiposAfiliacion.map((item) => (
                  <Table.Row
                    key={item.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {item.nombre}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <PermissionGate route="/apps/admin/tipo-afiliacion" action="editar">
                          <Button size="sm" color="gray" onClick={() => handleEdit(item)}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate route="/apps/admin/tipo-afiliacion" action="eliminar">
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
          {isEditing ? 'Editar Tipo de Afiliación' : 'Crear tipo de afiliación.'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre" value="Nombre *" />
                <TextInput
                  id="nombre"
                  type="text"
                  placeholder="Nombre tipo de afiliación"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-2 ml-auto">
              <Button color="gray" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              {isEditing ? (
                <PermissionGate route="/apps/admin/tipo-afiliacion" action="editar">
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
                <PermissionGate route="/apps/admin/tipo-afiliacion" action="crear">
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

export default TipoAfiliacion;

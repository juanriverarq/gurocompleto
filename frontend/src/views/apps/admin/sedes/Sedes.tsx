import React, { useState } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useSedes } from 'src/hooks/useAdminCrudApi';
import type { Sede as SedeType, SedeCreate } from 'src/types/admin';

const Sedes = () => {
  const { sedes, loading, error, createSede, updateSede, deleteSede } = useSedes();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SedeType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SedeCreate>({ 
    nombre: '', 
    email: '', 
    direccion: '', 
    telefono: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ nombre: '', email: '', direccion: '', telefono: '' });
    setShowModal(true);
  };

  const handleEdit = (item: SedeType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({ 
      nombre: item.nombre, 
      email: item.email, 
      direccion: item.direccion, 
      telefono: item.telefono 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateSede(selectedItem.id, formData);
      } else {
        await createSede(formData);
      }
      setShowModal(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta sede?')) {
      try {
        await deleteSede(id);
      } catch (error) {
      }
    }
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Gestión de Sedes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra las sedes de tu agencia de seguros.
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center">
            <Icon icon="solar:buildings-bold" className="w-4 h-4 mr-2" />
            Nueva Sede
          </Button>
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
      ) : sedes.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon icon="solar:buildings-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay sedes definidas
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza creando sedes para organizar tu agencia.
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCreate}>
                <Icon icon="solar:buildings-bold" className="w-4 h-4 mr-2" />
                Crear Primera Sede
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Nombre</Table.HeadCell>
                <Table.HeadCell>Email</Table.HeadCell>
                <Table.HeadCell>Dirección</Table.HeadCell>
                <Table.HeadCell>Teléfono</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {sedes.map((item) => (
                  <Table.Row key={item.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:buildings-bold" className="w-4 h-4 text-blue-600" />
                        {item.nombre}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {item.email}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {item.direccion}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {item.telefono}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          color="gray"
                          onClick={() => handleEdit(item)}
                        >
                          <Icon icon="solar:pen-bold" className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="failure"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </Button>
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
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>
          {isEditing ? 'Editar Sede' : 'Crear Sede.'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre" value="Nombre *" />
                <TextInput
                  id="nombre"
                  type="text"
                  placeholder="Nombre de nueva sede"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email" value="Email" />
                <TextInput
                  id="email"
                  type="email"
                  placeholder="Email de nueva sede"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="direccion" value="Dirección" />
                <TextInput
                  id="direccion"
                  type="text"
                  placeholder="Dirección de nueva sede"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="telefono" value="Teléfono" />
                <TextInput
                  id="telefono"
                  type="tel"
                  placeholder="Teléfono de nueva sede"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-2 ml-auto">
              <Button
                color="gray"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.nombre.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
};

export default Sedes; 
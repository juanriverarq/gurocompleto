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
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Icon } from '@iconify/react';
import { useMotivosEstadosPoliza } from 'src/hooks/useAdminCrudApi';
import type {
  MotivoEstadoPoliza as MotivoEstadoPolizaType,
  MotivoEstadoPolizaCreate,
} from 'src/types/admin';
import { PermissionGate } from 'src/components/PermissionGate';

const MotivosEstadosPoliza = () => {
  const {
    motivosEstadosPoliza,
    loading,
    error,
    createMotivoEstadoPoliza,
    updateMotivoEstadoPoliza,
    deleteMotivoEstadoPoliza,
  } = useMotivosEstadosPoliza();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MotivoEstadoPolizaType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MotivoEstadoPolizaCreate>({
    nombre: '',
    cancelacion: false,
    no_renovacion: false,
    creacion_anexo: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ nombre: '', cancelacion: false, no_renovacion: false, creacion_anexo: false });
    setShowModal(true);
  };

  const handleEdit = (item: MotivoEstadoPolizaType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({
      nombre: item.nombre,
      cancelacion: item.cancelacion,
      no_renovacion: item.no_renovacion,
      creacion_anexo: item.creacion_anexo,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateMotivoEstadoPoliza(selectedItem.id, formData);
      } else {
        await createMotivoEstadoPoliza(formData);
      }
      setShowModal(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este motivo de estado de póliza?')) {
      try {
        await deleteMotivoEstadoPoliza(id);
      } catch (error) {}
    }
  };

  const renderTipos = (item: MotivoEstadoPolizaType) => {
    const tipos = [];
    if (item.cancelacion) tipos.push('Cancelación');
    if (item.no_renovacion) tipos.push('No renovación');
    if (item.creacion_anexo) tipos.push('Creación Anexo');

    return tipos.map((tipo, index) => (
      <Badge key={index} color="blue" size="sm" className="mr-1">
        {tipo}
      </Badge>
    ));
  };

  return (
    <PermissionGate
      route="/apps/admin/motivos-estados-poliza"
      action="ver"
      fallback={
        <div className="flex justify-center items-center h-64">
          <Alert color="warning">No tienes permisos para ver Motivos Estados Póliza.</Alert>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Motivos Estados Póliza
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configura los motivos para los cambios de estado de pólizas.
            </p>
          </div>
          <PermissionGate route="/apps/admin/motivos-estados-poliza" action="crear">
            <Button onClick={handleCreate} className="flex items-center">
              <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
              Nuevo Motivo
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
      ) : motivosEstadosPoliza.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon
              icon="solar:file-text-bold-duotone"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay motivos de estados definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza creando motivos para organizar los estados de pólizas.
            </p>
            <div className="flex justify-center">
              <PermissionGate route="/apps/admin/motivos-estados-poliza" action="crear">
                <Button onClick={handleCreate}>
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                  Crear Primer Motivo
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
                <Table.HeadCell>Nombre del Motivo</Table.HeadCell>
                <Table.HeadCell>Tipos Aplicables</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {motivosEstadosPoliza.map((item) => (
                  <Table.Row
                    key={item.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {item.nombre}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">{renderTipos(item)}</div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <PermissionGate route="/apps/admin/motivos-estados-poliza" action="editar">
                          <Button size="sm" color="gray" onClick={() => handleEdit(item)}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate
                          route="/apps/admin/motivos-estados-poliza"
                          action="eliminar"
                        >
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
          {isEditing ? 'Editar Motivo Estado Póliza' : 'Crear Motivo estado póliza.'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre" value="Nombre *" />
                <TextInput
                  id="nombre"
                  type="text"
                  placeholder="Nombre motivo estado póliza"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label value="Tipos aplicables:" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cancelacion"
                      checked={formData.cancelacion}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, cancelacion: !!checked })
                      }
                    />
                    <Label htmlFor="cancelacion">Cancelación</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="no_renovacion"
                      checked={formData.no_renovacion}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, no_renovacion: !!checked })
                      }
                    />
                    <Label htmlFor="no_renovacion">No renovación</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="creacion_anexo"
                      checked={formData.creacion_anexo}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, creacion_anexo: !!checked })
                      }
                    />
                    <Label htmlFor="creacion_anexo">Creación Anexo</Label>
                  </div>
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
                <PermissionGate route="/apps/admin/motivos-estados-poliza" action="editar">
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
                <PermissionGate route="/apps/admin/motivos-estados-poliza" action="crear">
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

export default MotivosEstadosPoliza;

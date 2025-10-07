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
  Select,
  Textarea,
  ToggleSwitch,
  Badge,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useMensajeros } from 'src/hooks/useAdminCrudApi';
import type { Mensajero as MensajeroType, MensajeroCreate } from 'src/types/admin';

const tiposVehiculo = [
  { value: 'moto', label: 'Motocicleta' },
  { value: 'carro', label: 'Automóvil' },
  { value: 'bicicleta', label: 'Bicicleta' },
  { value: 'pie', label: 'A pie' },
  { value: 'otro', label: 'Otro' },
];

const Mensajeros = () => {
  const { mensajeros, loading, error, createMensajero, updateMensajero, deleteMensajero } =
    useMensajeros();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MensajeroType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MensajeroCreate>({
    nombre: '',
    telefono: '',
    celular: '',
    email: '',
    direccion: '',
    ciudad: '',
    vehiculo: '',
    activo: true,
    tarifa_base: 0,
    observaciones: '',
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof MensajeroCreate, string>> & { general?: string }
  >({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof MensajeroCreate, string>> = {};

    // nombre (requerido, max 255)
    if (!formData.nombre || !formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    } else if (formData.nombre.length > 255) {
      newErrors.nombre = 'Máximo 255 caracteres';
    }

    // teléfono y celular (max 50)
    if (formData.telefono && formData.telefono.length > 50) {
      newErrors.telefono = 'Máximo 50 caracteres';
    }
    if (formData.celular && formData.celular.length > 50) {
      newErrors.celular = 'Máximo 50 caracteres';
    }

    // email (formato y max 255 si viene)
    if (formData.email) {
      if (formData.email.length > 255) {
        newErrors.email = 'Máximo 255 caracteres';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          newErrors.email = 'Formato de email inválido';
        }
      }
    }

    // ciudad (max 255)
    if (formData.ciudad && formData.ciudad.length > 255) {
      newErrors.ciudad = 'Máximo 255 caracteres';
    }

    // vehiculo (si viene debe ser válido)
    if (formData.vehiculo) {
      const allowed = tiposVehiculo.map((t) => t.value);
      if (!allowed.includes(formData.vehiculo)) {
        newErrors.vehiculo = 'Tipo de vehículo inválido';
      }
    }

    // tarifa_base (si viene debe ser número >= 0)
    if (formData.tarifa_base !== undefined && formData.tarifa_base !== null) {
      const num = Number(formData.tarifa_base);
      if (Number.isNaN(num)) {
        newErrors.tarifa_base = 'Debe ser un número';
      } else if (num < 0) {
        newErrors.tarifa_base = 'Debe ser mayor o igual a 0';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({
      nombre: '',
      telefono: '',
      celular: '',
      email: '',
      direccion: '',
      ciudad: '',
      vehiculo: '',
      activo: true,
      tarifa_base: 0,
      observaciones: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEdit = (item: MensajeroType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({
      nombre: item.nombre,
      telefono: item.telefono || '',
      celular: item.celular || '',
      email: item.email || '',
      direccion: item.direccion || '',
      ciudad: item.ciudad || '',
      vehiculo: item.vehiculo || '',
      activo: item.activo,
      tarifa_base: item.tarifa_base || 0,
      observaciones: item.observaciones || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let success = false;

      if (isEditing && selectedItem) {
        success = await updateMensajero(selectedItem.id, formData);
      } else {
        success = await createMensajero(formData);
      }

      if (success) {
        setShowModal(false);
        setFormErrors({});
      }
    } catch (error) {}
  };

  const handleDelete = async (item: MensajeroType) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a ${item.nombre}?`)) {
      await deleteMensajero(item.id);
    }
  };

  if (loading && mensajeros.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white">Gestión de Mensajeros</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra los mensajeros para entrega de documentos.
            </p>
          </div>
          <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
            <Icon icon="solar:add-circle-bold-duotone" className="mr-2" width={20} />
            Nuevo Mensajero
          </Button>
        </div>

        {error && (
          <Alert color="failure" className="mb-4">
            <Icon icon="solar:danger-bold-duotone" className="mr-2" />
            {error}
          </Alert>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Nombre</Table.HeadCell>
              <Table.HeadCell>Contacto</Table.HeadCell>
              <Table.HeadCell>Ciudad</Table.HeadCell>
              <Table.HeadCell>Vehículo</Table.HeadCell>
              <Table.HeadCell>Tarifa Base</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {mensajeros.map((mensajero) => (
                <Table.Row
                  key={mensajero.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <Table.Cell className="font-medium text-gray-900 dark:text-white">
                    {mensajero.nombre}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm">
                      {mensajero.celular && <div>📱 {mensajero.celular}</div>}
                      {mensajero.telefono && <div>📞 {mensajero.telefono}</div>}
                      {mensajero.email && <div>✉️ {mensajero.email}</div>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{mensajero.ciudad || 'No especificada'}</Table.Cell>
                  <Table.Cell>{mensajero.vehiculo_nombre || 'No especificado'}</Table.Cell>
                  <Table.Cell>
                    {mensajero.tarifa_base
                      ? `$${mensajero.tarifa_base.toLocaleString()}`
                      : 'No definida'}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={mensajero.activo ? 'success' : 'failure'}>
                      {mensajero.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="gray"
                        onClick={() => handleEdit(mensajero)}
                        title="Editar"
                      >
                        <Icon icon="solar:pen-bold-duotone" width={16} />
                      </Button>
                      <Button
                        size="sm"
                        color="failure"
                        onClick={() => handleDelete(mensajero)}
                        title="Eliminar"
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" width={16} />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
              {mensajeros.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Icon icon="solar:delivery-bold-duotone" width={48} className="mb-2" />
                      <p>No hay mensajeros registrados</p>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Modal para crear/editar */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>{isEditing ? 'Editar Mensajero' : 'Nuevo Mensajero'}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre" value="Nombre *" />
                <TextInput
                  id="nombre"
                  value={formData.nombre}
                  color={formErrors.nombre ? 'failure' : undefined}
                  helperText={formErrors.nombre}
                  onChange={(e) => {
                    setFormData({ ...formData, nombre: e.target.value });
                    if (formErrors.nombre) setFormErrors({ ...formErrors, nombre: undefined });
                  }}
                  required
                  placeholder="Nombre completo del mensajero"
                />
              </div>

              <div>
                <Label htmlFor="ciudad" value="Ciudad" />
                <TextInput
                  id="ciudad"
                  value={formData.ciudad}
                  color={formErrors.ciudad ? 'failure' : undefined}
                  helperText={formErrors.ciudad}
                  onChange={(e) => {
                    setFormData({ ...formData, ciudad: e.target.value });
                    if (formErrors.ciudad) setFormErrors({ ...formErrors, ciudad: undefined });
                  }}
                  placeholder="Ciudad donde opera"
                />
              </div>

              <div>
                <Label htmlFor="telefono" value="Teléfono" />
                <TextInput
                  id="telefono"
                  value={formData.telefono}
                  color={formErrors.telefono ? 'failure' : undefined}
                  helperText={formErrors.telefono}
                  onChange={(e) => {
                    setFormData({ ...formData, telefono: e.target.value });
                    if (formErrors.telefono) setFormErrors({ ...formErrors, telefono: undefined });
                  }}
                  placeholder="Teléfono fijo"
                />
              </div>

              <div>
                <Label htmlFor="celular" value="Celular" />
                <TextInput
                  id="celular"
                  value={formData.celular}
                  color={formErrors.celular ? 'failure' : undefined}
                  helperText={formErrors.celular}
                  onChange={(e) => {
                    setFormData({ ...formData, celular: e.target.value });
                    if (formErrors.celular) setFormErrors({ ...formErrors, celular: undefined });
                  }}
                  placeholder="Teléfono celular"
                />
              </div>

              <div>
                <Label htmlFor="email" value="Email" />
                <TextInput
                  id="email"
                  type="email"
                  value={formData.email}
                  color={formErrors.email ? 'failure' : undefined}
                  helperText={formErrors.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <Label htmlFor="vehiculo" value="Tipo de Vehículo" />
                <Select
                  id="vehiculo"
                  value={formData.vehiculo}
                  color={formErrors.vehiculo ? 'failure' : undefined}
                  helperText={formErrors.vehiculo}
                  onChange={(e) => {
                    setFormData({ ...formData, vehiculo: e.target.value });
                    if (formErrors.vehiculo) setFormErrors({ ...formErrors, vehiculo: undefined });
                  }}
                >
                  <option value="">Seleccionar vehículo</option>
                  {tiposVehiculo.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="tarifa_base" value="Tarifa Base" />
                <TextInput
                  id="tarifa_base"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tarifa_base}
                  color={formErrors.tarifa_base ? 'failure' : undefined}
                  helperText={formErrors.tarifa_base}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = val === '' ? 0 : parseFloat(val);
                    setFormData({ ...formData, tarifa_base: Number.isNaN(parsed) ? 0 : parsed });
                    if (formErrors.tarifa_base)
                      setFormErrors({ ...formErrors, tarifa_base: undefined });
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center">
                <Label htmlFor="activo" value="Estado Activo" className="mr-2" />
                <ToggleSwitch
                  id="activo"
                  checked={formData.activo}
                  onChange={(checked) => {
                    setFormData({ ...formData, activo: checked });
                    if (formErrors.activo) setFormErrors({ ...formErrors, activo: undefined });
                  }}
                />
                {formErrors.activo ? (
                  <span className="ml-2 text-sm text-red-600">{formErrors.activo}</span>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="direccion" value="Dirección" />
              <Textarea
                id="direccion"
                rows={2}
                value={formData.direccion}
                color={formErrors.direccion ? 'failure' : undefined}
                helperText={formErrors.direccion}
                onChange={(e) => {
                  setFormData({ ...formData, direccion: e.target.value });
                  if (formErrors.direccion) setFormErrors({ ...formErrors, direccion: undefined });
                }}
                placeholder="Dirección completa"
              />
            </div>

            <div>
              <Label htmlFor="observaciones" value="Observaciones" />
              <Textarea
                id="observaciones"
                rows={3}
                value={formData.observaciones}
                color={formErrors.observaciones ? 'failure' : undefined}
                helperText={formErrors.observaciones}
                onChange={(e) => {
                  setFormData({ ...formData, observaciones: e.target.value });
                  if (formErrors.observaciones)
                    setFormErrors({ ...formErrors, observaciones: undefined });
                }}
                placeholder="Observaciones adicionales"
              />
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size="sm" className="mr-2" /> : null}
            {isEditing ? 'Actualizar' : 'Crear'}
          </Button>
          <Button color="gray" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Mensajeros;

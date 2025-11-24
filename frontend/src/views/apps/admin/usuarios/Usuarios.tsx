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
import { useEmpleadosBroker, useRolesBroker } from 'src/hooks/useAdminCrudApi';
import type { EmpleadoBroker as EmpleadoBrokerType, EmpleadoBrokerCreate } from 'src/types/admin';
import {
  usePagePermissions,
  PermissionGate,
  PermissionButton,
} from 'src/components/PermissionGate';
import { useLocation } from 'react-router-dom';

const tiposDocumento = [
  { value: 'cedula', label: 'Cédula de Ciudadanía' },
  { value: 'cedula_extranjeria', label: 'Cédula de Extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'tarjeta_identidad', label: 'Tarjeta de Identidad' },
];

const estados = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'retirado', label: 'Retirado' },
];

const tiposVinculacion = [
  { value: 'empleado', label: 'Empleado' },
  { value: 'contratista', label: 'Contratista' },
  { value: 'practicante', label: 'Practicante' },
  { value: 'temporal', label: 'Temporal' },
];

const Usuarios = () => {
  const location = useLocation();
  const currentRoute = location.pathname;

  // Verificar permisos para esta página
  const { canView, canCreate, canEdit, canDelete } = usePagePermissions(currentRoute);

  const { empleados, loading, error, createEmpleado, updateEmpleado, deleteEmpleado } =
    useEmpleadosBroker();
  const { roles } = useRolesBroker();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EmpleadoBrokerType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EmpleadoBrokerCreate>({
    nombres: '',
    apellidos: '',
    tipo_documento: 'cedula',
    numero_documento: '',
    email: '',
    usuario: '',
    telefono: '',
    celular: '',
    fecha_nacimiento: '',
    direccion: '',
    ciudad: '',
    cargo: '',
    departamento: '',
    fecha_ingreso: '',
    estado: 'activo',
    tipo_vinculacion: 'empleado',
    salario: 0,
    acceso_activo: true,
    rol_id: undefined,
    observaciones: '',
    // Credenciales (opcionales)
    password: '',
    password_confirmation: '',
    requiere_cambio_password: true,
  });

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({
      nombres: '',
      apellidos: '',
      tipo_documento: 'cedula',
      numero_documento: '',
      email: '',
      usuario: '',
      telefono: '',
      celular: '',
      fecha_nacimiento: '',
      direccion: '',
      ciudad: '',
      cargo: '',
      departamento: '',
      fecha_ingreso: '',
      estado: 'activo',
      tipo_vinculacion: 'empleado',
      salario: 0,
      acceso_activo: true,
      rol_id: undefined,
      observaciones: '',
      password: '',
      password_confirmation: '',
      requiere_cambio_password: true,
    });
    setShowModal(true);
  };

  const handleEdit = (item: EmpleadoBrokerType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({
      nombres: item.nombres,
      apellidos: item.apellidos,
      tipo_documento: item.tipo_documento,
      numero_documento: item.numero_documento,
      email: item.email,
      usuario: item.usuario,
      telefono: item.telefono || '',
      celular: item.celular || '',
      fecha_nacimiento: item.fecha_nacimiento || '',
      direccion: item.direccion || '',
      ciudad: item.ciudad || '',
      cargo: item.cargo || '',
      departamento: item.departamento || '',
      fecha_ingreso: item.fecha_ingreso || '',
      estado: item.estado,
      tipo_vinculacion: item.tipo_vinculacion,
      salario: item.salario || 0,
      acceso_activo: item.acceso_activo,
      rol_id: item.rol_id,
      observaciones: item.observaciones || '',
      password: '',
      password_confirmation: '',
      requiere_cambio_password: item.requiere_cambio_password,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let success = false;

      if (isEditing && selectedItem) {
        // En edición, si password está vacío no lo enviamos
        const payload = { ...formData };
        if (!payload.password) {
          delete (payload as any).password;
          delete (payload as any).password_confirmation;
        }
        success = await updateEmpleado(selectedItem.id, payload);
      } else {
        // En creación, password es opcional; si viene lo enviamos
        const payload = { ...formData };
        if (!payload.password) {
          delete (payload as any).password;
          delete (payload as any).password_confirmation;
        }
        success = await createEmpleado(payload);

        // Si se creó exitosamente, generar contraseña temporal
        if (success) {
          try {
            const response = await fetch(
              `http://127.0.0.1:8001/api/empleado-auth/generar-password-temporal`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usuario: formData.usuario }),
              },
            );

            const data = await response.json();

            if (data.success) {
              alert(
                `Usuario creado exitosamente.\nContraseña temporal: ${data.password}\n\nEl empleado deberá cambiar esta contraseña en su primer acceso.`,
              );
            }
          } catch (error) {}
        }
      }

      if (success) {
        setShowModal(false);
      }
    } catch (error) {}
  };

  const handleDelete = async (item: EmpleadoBrokerType) => {
    if (
      window.confirm(`¿Estás seguro de que quieres eliminar a ${item.nombres} ${item.apellidos}?`)
    ) {
      await deleteEmpleado(item.id);
    }
  };

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'activo':
        return 'success';
      case 'inactivo':
        return 'gray';
      case 'suspendido':
        return 'warning';
      case 'retirado':
        return 'failure';
      default:
        return 'gray';
    }
  };

  if (loading && empleados.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Si no puede ver la página, mostrar mensaje
  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert color="warning">
          <Icon icon="solar:shield-warning-bold" className="mr-2" />
          No tienes permisos para acceder a esta página.
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white">Gestión de Usuarios</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra los empleados y sus accesos al sistema.
            </p>
          </div>
          <PermissionButton
            route={currentRoute}
            action="crear"
            onClick={handleCreate}
            variant="primary"
            icon={<Icon icon="solar:add-circle-bold-duotone" width={20} />}
          >
            Nuevo Usuario
          </PermissionButton>
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
              <Table.HeadCell>Empleado</Table.HeadCell>
              <Table.HeadCell>Contacto</Table.HeadCell>
              <Table.HeadCell>Cargo</Table.HeadCell>
              <Table.HeadCell>Rol</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Acceso</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {empleados.map((empleado) => (
                <Table.Row
                  key={empleado.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <Table.Cell>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {empleado.nombres} {empleado.apellidos}
                      </div>
                      <div className="text-sm text-gray-500">
                        {empleado.numero_documento} • @{empleado.usuario}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm">
                      <div>📧 {empleado.email}</div>
                      {empleado.celular && <div>📱 {empleado.celular}</div>}
                      {empleado.telefono && <div>📞 {empleado.telefono}</div>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm">
                      <div className="font-medium">{empleado.cargo || 'Sin cargo'}</div>
                      {empleado.departamento && (
                        <div className="text-gray-500">{empleado.departamento}</div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {empleado.rol ? (
                      <Badge color="info">{empleado.rol.nombre}</Badge>
                    ) : (
                      <span className="text-gray-500">Sin rol</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={getEstadoBadgeColor(empleado.estado)}>{empleado.estado}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={empleado.acceso_activo ? 'success' : 'failure'}>
                      {empleado.acceso_activo ? 'Activo' : 'Bloqueado'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <PermissionButton
                        route={currentRoute}
                        action="editar"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(empleado)}
                        icon={<Icon icon="solar:pen-bold-duotone" width={16} />}
                        buttonProps={{ title: 'Editar' }}
                      >
                        Editar
                      </PermissionButton>
                      <PermissionButton
                        route={currentRoute}
                        action="eliminar"
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(empleado)}
                        icon={<Icon icon="solar:trash-bin-trash-bold-duotone" width={16} />}
                        buttonProps={{ title: 'Eliminar' }}
                      >
                        Eliminar
                      </PermissionButton>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
              {empleados.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Icon
                        icon="solar:users-group-two-rounded-bold-duotone"
                        width={48}
                        className="mb-2"
                      />
                      <p>No hay usuarios registrados</p>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Modal para crear/editar */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="2xl">
        <Modal.Header>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información Personal */}
            <div>
              <h3 className="text-lg font-medium mb-3">Información Personal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nombres" value="Nombres *" />
                  <TextInput
                    id="nombres"
                    value={formData.nombres}
                    onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                    required
                    placeholder="Nombres"
                  />
                </div>

                <div>
                  <Label htmlFor="apellidos" value="Apellidos *" />
                  <TextInput
                    id="apellidos"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    required
                    placeholder="Apellidos"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_documento" value="Tipo de Documento *" />
                  <Select
                    id="tipo_documento"
                    value={formData.tipo_documento}
                    onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                    required
                  >
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="numero_documento" value="Número de Documento *" />
                  <TextInput
                    id="numero_documento"
                    value={formData.numero_documento}
                    onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                    required
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <Label htmlFor="email" value="Email *" />
                  <TextInput
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="usuario@ejemplo.com"
                  />
                </div>

                <div>
                  <Label htmlFor="usuario" value="Usuario *" />
                  <TextInput
                    id="usuario"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    required
                    placeholder="nombreusuario"
                  />
                </div>

                <div>
                  <Label htmlFor="telefono" value="Teléfono" />
                  <TextInput
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Teléfono fijo"
                  />
                </div>

                <div>
                  <Label htmlFor="celular" value="Celular" />
                  <TextInput
                    id="celular"
                    value={formData.celular}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    placeholder="Teléfono celular"
                  />
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div>
              <h3 className="text-lg font-medium mb-3">Información Laboral</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usuario" value="Usuario *" />
                  <TextInput
                    id="usuario"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    required
                    placeholder="nombreusuario"
                  />
                </div>

                <div>
                  <Label htmlFor="cargo" value="Cargo" />
                  <TextInput
                    id="cargo"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Cargo del empleado"
                  />
                </div>

                <div>
                  <Label htmlFor="departamento" value="Departamento" />
                  <TextInput
                    id="departamento"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    placeholder="Departamento"
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_ingreso" value="Fecha de Ingreso" />
                  <TextInput
                    id="fecha_ingreso"
                    type="date"
                    value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="salario" value="Salario" />
                  <TextInput
                    id="salario"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.salario}
                    onChange={(e) =>
                      setFormData({ ...formData, salario: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_vinculacion" value="Tipo de Vinculación *" />
                  <Select
                    id="tipo_vinculacion"
                    value={formData.tipo_vinculacion}
                    onChange={(e) => setFormData({ ...formData, tipo_vinculacion: e.target.value })}
                    required
                  >
                    {tiposVinculacion.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estado" value="Estado *" />
                  <Select
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    required
                  >
                    {estados.map((estado) => (
                      <option key={estado.value} value={estado.value}>
                        {estado.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rol_id" value="Rol" />
                  <Select
                    id="rol_id"
                    value={formData.rol_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rol_id: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">Sin rol asignado</option>
                    {roles
                      .filter((rol) => rol.activo)
                      .map((rol) => (
                        <option key={rol.id} value={rol.id}>
                          {rol.nombre}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="flex items-center">
                  <Label htmlFor="acceso_activo" value="Acceso Activo" className="mr-2" />
                  <ToggleSwitch
                    id="acceso_activo"
                    checked={formData.acceso_activo}
                    onChange={(checked) => setFormData({ ...formData, acceso_activo: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Credenciales */}
            <div>
              <h3 className="text-lg font-medium mb-3">Credenciales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="password"
                    value={`${isEditing ? 'Nueva contraseña' : 'Contraseña'} ${
                      isEditing ? '(opcional)' : ''
                    }`}
                  />
                  <TextInput
                    id="password"
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={
                      isEditing ? 'Deja en blanco para no cambiar' : 'Mínimo 8 caracteres'
                    }
                  />
                </div>
                <div>
                  <Label
                    htmlFor="password_confirmation"
                    value={`${isEditing ? 'Confirmar nueva contraseña' : 'Confirmar contraseña'}`}
                  />
                  <TextInput
                    id="password_confirmation"
                    type="password"
                    value={formData.password_confirmation || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, password_confirmation: e.target.value })
                    }
                    placeholder="Repite la contraseña"
                  />
                </div>
                <div className="flex items-center">
                  <Label
                    htmlFor="requiere_cambio_password"
                    value="Requerir cambio de contraseña al ingresar"
                    className="mr-2"
                  />
                  <ToggleSwitch
                    id="requiere_cambio_password"
                    checked={!!formData.requiere_cambio_password}
                    onChange={(checked) =>
                      setFormData({ ...formData, requiere_cambio_password: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="observaciones" value="Observaciones" />
              <Textarea
                id="observaciones"
                rows={3}
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
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

export default Usuarios;

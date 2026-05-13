import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Table,
  Modal,
  TextInput,
  Label,
  Textarea,
  Select,
  ToggleSwitch,
  Badge,
} from 'flowbite-react';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { useRolesBroker } from 'src/hooks/useAdminCrudApi';
import type { RolBroker as RolBrokerType, RolBrokerCreate } from 'src/types/admin';
import { usePagePermissions, PermissionGate } from 'src/components/PermissionGate';
import { useLocation } from 'react-router-dom';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const colorsOptions = [
  { value: '#6B7280', label: 'Gris', color: '#6B7280' },
  { value: '#EF4444', label: 'Rojo', color: '#EF4444' },
  { value: '#F59E0B', label: 'Amarillo', color: '#F59E0B' },
  { value: '#10B981', label: 'Verde', color: '#10B981' },
  { value: '#3B82F6', label: 'Azul', color: '#3B82F6' },
  { value: '#8B5CF6', label: 'Púrpura', color: '#8B5CF6' },
  { value: '#F97316', label: 'Naranja', color: '#F97316' },
  { value: '#EC4899', label: 'Rosa', color: '#EC4899' },
];

const nivelesAcceso = [
  { value: 1, label: 'Básico' },
  { value: 2, label: 'Intermedio' },
  { value: 3, label: 'Avanzado' },
  { value: 4, label: 'Administrador' },
];

// Estructura completa de módulos y permisos (fuente de verdad dinámica desde backend; fallback local)
// Módulos alineados 1:1 con el sidebar activo (Sidebaritems.ts)
const defaultModulosDisponibles = {
  // ── Inicio ──
  dashboard: { label: 'Dashboard', icon: 'solar:widget-2-bold-duotone', permisos: ['ver'] },

  // ── Seguros ──
  clientes: {
    label: 'Clientes',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'importar'],
  },
  polizas: {
    label: 'Pólizas',
    icon: 'solar:shield-check-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'emitir', 'renovar', 'anular'],
  },
  renovaciones: {
    label: 'Renovaciones',
    icon: 'solar:refresh-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'procesar'],
  },
  automoviles: {
    label: 'Automóviles',
    icon: 'solar:car-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  siniestros: {
    label: 'Siniestros',
    icon: 'solar:danger-triangle-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'reportar', 'procesar', 'cerrar'],
  },

  // ── Comercial ──
  embudo_ventas: {
    label: 'Embudo de Ventas',
    icon: 'solar:chart-2-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  seguimiento_comercial: {
    label: 'Seguimiento',
    icon: 'solar:clipboard-check-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  metas_objetivos: {
    label: 'Metas y Objetivos',
    icon: 'solar:target-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  analisis_rendimiento: {
    label: 'Rendimiento',
    icon: 'solar:graph-up-bold-duotone',
    permisos: ['ver', 'exportar'],
  },

  // ── Finanzas ──
  cartera: {
    label: 'Cartera (Resumen)',
    icon: 'solar:wallet-money-bold-duotone',
    permisos: ['ver', 'exportar'],
  },
  cartera_aseguradoras: {
    label: 'Cartera Aseguradoras',
    icon: 'solar:case-round-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  cartera_clientes: {
    label: 'Cartera Clientes',
    icon: 'solar:wallet-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'importar', 'exportar'],
  },
  estados_cuenta: {
    label: 'Estados de Cuenta',
    icon: 'solar:document-text-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  recibos_caja: {
    label: 'Recibos de Caja',
    icon: 'solar:bill-list-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'anular', 'imprimir'],
  },
  comisiones: {
    label: 'Comisiones',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'calcular', 'pagar'],
  },
  liquidar_vendedores: {
    label: 'Liquidar Vendedor / Asesor',
    icon: 'solar:money-bag-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  reportes_financieros: {
    label: 'Reportes Financieros',
    icon: 'solar:chart-square-bold-duotone',
    permisos: ['ver', 'generar', 'exportar'],
  },

  // ── Comunicaciones ──
  whatsapp_business: {
    label: 'WhatsApp',
    icon: 'solar:chat-round-dots-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'enviar'],
  },
  email_marketing: {
    label: 'Email Marketing',
    icon: 'solar:letter-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'enviar'],
  },
  enlaces_cotizacion: {
    label: 'Enlaces de Cotización',
    icon: 'solar:link-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  mini_web: {
    label: 'Mini Web',
    icon: 'solar:smartphone-2-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  pagina_web: {
    label: 'Mi Página Web',
    icon: 'solar:globe-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  creador_contenido: {
    label: 'Creador de Contenido',
    icon: 'solar:pallete-2-bold-duotone',
    permisos: ['ver', 'usar'],
  },

  // ── Inteligencia Artificial ──
  asistentes_ia: {
    label: 'Asistente IA',
    icon: 'solar:cpu-bolt-bold-duotone',
    permisos: ['ver', 'usar', 'configurar'],
  },
  voice_ai: {
    label: 'Call Center IA',
    icon: 'solar:phone-calling-rounded-outline',
    permisos: ['ver', 'usar', 'configurar'],
  },
  analytics_predictivo: {
    label: 'Ventas Cruzadas',
    icon: 'solar:graph-up-bold-duotone',
    permisos: ['ver', 'usar'],
  },

  // ── Documentos ──
  documentos_clientes: {
    label: 'De Clientes',
    icon: 'solar:folder-with-files-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'],
  },
  documentos_poliza: {
    label: 'De Pólizas',
    icon: 'solar:folder-with-files-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'],
  },
  documentos_siniestro: {
    label: 'De Siniestros',
    icon: 'solar:folder-with-files-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'],
  },
  cumplimiento_legal: {
    label: 'Internos',
    icon: 'solar:archive-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },

  // ── Configuración: Mi Agencia ──
  informacion_agencia: {
    label: 'Información de Agencia',
    icon: 'solar:buildings-3-bold-duotone',
    permisos: ['ver', 'editar'],
  },
  sedes: {
    label: 'Sedes',
    icon: 'solar:buildings-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  aseguradoras: {
    label: 'Aseguradoras',
    icon: 'solar:buildings-2-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  ramos: {
    label: 'Ramos',
    icon: 'solar:widget-3-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },

  // ── Configuración: Usuarios y Roles ──
  gestion_usuarios: {
    label: 'Usuarios',
    icon: 'solar:users-group-rounded-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'asignar_roles'],
  },
  roles_permisos: {
    label: 'Roles y Permisos',
    icon: 'solar:shield-user-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'asignar'],
  },
  papelera: {
    label: 'Papelera',
    icon: 'solar:trash-bin-trash-bold-duotone',
    permisos: ['ver', 'restaurar', 'eliminar_definitivo', 'exportar'],
  },

  // ── Configuración: Catálogos ──
  vendedores: {
    label: 'Vendedor / Asesor',
    icon: 'solar:user-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  coberturas: {
    label: 'Coberturas',
    icon: 'solar:shield-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  tipos_afiliacion: {
    label: 'Tipos de Afiliación',
    icon: 'solar:user-plus-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  estados_siniestros: {
    label: 'Estados de Siniestros',
    icon: 'solar:flag-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  motivos_estados_poliza: {
    label: 'Motivos Estados Póliza',
    icon: 'solar:question-circle-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },
  mensajeros: {
    label: 'Mensajeros',
    icon: 'solar:delivery-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar'],
  },

  // ── Configuración: Integraciones ──
  integraciones_externas: {
    label: 'Conectores API',
    icon: 'solar:programming-bold-duotone',
    permisos: ['ver', 'crear', 'editar', 'eliminar', 'configurar'],
  },
  sincronizacion: {
    label: 'Sincronización',
    icon: 'solar:refresh-bold-duotone',
    permisos: ['ver', 'ejecutar', 'configurar'],
  },

  // ── Configuración: Sistema ──
  configuracion_sistema: {
    label: 'Sistema',
    icon: 'solar:settings-bold-duotone',
    permisos: ['ver', 'editar'],
  },
} as const;

// Si backend expone permisosDisponibles, preferirlos
// (useRolesBroker ya expone permisosDisponibles; aquí tomamos ese valor en tiempo de render)

// Categorías alineadas 1:1 con las secciones del sidebar (Sidebaritems.ts)
const buildCategorias = (
  mods: Record<string, { label: string; icon?: string; permisos: string[] }>,
): Record<string, string[]> => {
  const groups: [string, string[]][] = [
    ['Inicio', ['dashboard']],
    ['Seguros', ['clientes', 'polizas', 'renovaciones', 'automoviles', 'siniestros']],
    ['Comercial', ['embudo_ventas', 'seguimiento_comercial', 'metas_objetivos', 'analisis_rendimiento']],
    ['Finanzas', ['cartera', 'cartera_aseguradoras', 'cartera_clientes', 'estados_cuenta', 'recibos_caja', 'comisiones', 'liquidar_vendedores', 'reportes_financieros']],
    ['Comunicaciones', ['whatsapp_business', 'email_marketing', 'enlaces_cotizacion', 'mini_web', 'pagina_web', 'creador_contenido']],
    ['Inteligencia Artificial', ['asistentes_ia', 'voice_ai', 'analytics_predictivo']],
    ['Documentos', ['documentos_clientes', 'documentos_poliza', 'documentos_siniestro', 'cumplimiento_legal']],
    ['Mi Agencia', ['informacion_agencia', 'sedes', 'aseguradoras', 'ramos']],
    ['Usuarios y Roles', ['gestion_usuarios', 'roles_permisos', 'papelera']],
    ['Catálogos', ['vendedores', 'coberturas', 'tipos_afiliacion', 'estados_siniestros', 'motivos_estados_poliza', 'mensajeros']],
    ['Integraciones', ['integraciones_externas', 'sincronizacion']],
    ['Sistema', ['configuracion_sistema']],
  ];

  const result: Record<string, string[]> = {};
  for (const [groupName, keys] of groups) {
    const present = keys.filter((k) => Object.prototype.hasOwnProperty.call(mods, k));
    if (present.length > 0) {
      result[groupName] = present;
    }
  }
  return result;
};

// Las labels ya están correctas en defaultModulosDisponibles; este map es solo para overrides puntuales
const LABEL_OVERRIDES: Record<string, string> = {};

const Roles: React.FC = () => {
  const location = useLocation();
  const currentRoute = location.pathname;
  const { user, empleado } = useUnifiedAuth();

  // Verificar permisos para esta página
  const permissions = usePagePermissions(currentRoute);

  const {
    roles,
    loading,
    error,
    createRol,
    updateRol,
    deleteRol,
    refreshRoles,
    permisosDisponibles,
    nivelesAcceso: nivelesFromApi,
  } = useRolesBroker();
  // Siempre usar el fallback local alineado con el sidebar; el backend puede tener módulos extra que no están en la UI
  const modulosDisponibles: Record<string, { label: string; icon?: string; permisos: string[] }> =
    defaultModulosDisponibles as any;

  // Construir categorías dinámicamente en base a los módulos disponibles
  const categorias = React.useMemo(() => buildCategorias(modulosDisponibles), [modulosDisponibles]);

  const [showModal, setShowModal] = useState(false);
  const [editingRol, setEditingRol] = useState<RolBrokerType | null>(null);
  const [formData, setFormData] = useState<RolBrokerCreate>({
    nombre: '',
    descripcion: '',
    permisos: [],
    color: '#6B7280',
    activo: true,
    nivel_acceso: 1,
    es_admin: false,
  });

  const [permisosSeleccionados, setPermisosSeleccionados] = useState<{ [key: string]: string[] }>(
    {},
  );
  const [activeCategory, setActiveCategory] = useState<string>('Panel de Control');

  // Asegurar que la pestaña activa exista; si cambia el set de categorías, seleccionar la primera
  useEffect(() => {
    const keys = Object.keys(categorias);
    if (keys.length > 0 && !keys.includes(activeCategory)) {
      setActiveCategory(keys[0]);
    }
  }, [categorias]);

  useEffect(() => {
    // fetchPermisosDisponibles(); // This line was removed as per the edit hint
  }, []);

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      permisos: [],
      color: '#6B7280',
      activo: true,
      nivel_acceso: 1,
      es_admin: false,
    });
    setPermisosSeleccionados({});
    setEditingRol(null);
  };

  const openModal = (rol?: RolBrokerType) => {
    if (rol) {
      setEditingRol(rol);
      setFormData({
        nombre: rol.nombre,
        descripcion: rol.descripcion || '',
        permisos: rol.permisos || [],
        color: rol.color,
        activo: rol.activo,
        nivel_acceso: rol.nivel_acceso,
        es_admin: rol.es_admin,
      });

      // Parsear permisos existentes
      const permisosActuales: { [key: string]: string[] } = {};
      (rol.permisos || []).forEach((permiso) => {
        if (permiso === '*') {
          // Si tiene todos los permisos
          Object.keys(modulosDisponibles).forEach((modulo) => {
            permisosActuales[modulo] =
              modulosDisponibles[modulo as keyof typeof modulosDisponibles].permisos;
          });
        } else if (permiso.includes('.')) {
          const [modulo, accion] = permiso.split('.');
          if (!permisosActuales[modulo]) {
            permisosActuales[modulo] = [];
          }
          if (accion === '*') {
            permisosActuales[modulo] =
              modulosDisponibles[modulo as keyof typeof modulosDisponibles]?.permisos || [];
          } else {
            permisosActuales[modulo].push(accion);
          }
        }
      });
      setPermisosSeleccionados(permisosActuales);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handlePermisoChange = (modulo: string, permiso: string, checked: boolean) => {
    setPermisosSeleccionados((prev) => {
      const newPermisos = { ...prev };
      if (!newPermisos[modulo]) {
        newPermisos[modulo] = [];
      }

      if (checked) {
        if (!newPermisos[modulo].includes(permiso)) {
          newPermisos[modulo].push(permiso);
        }
      } else {
        newPermisos[modulo] = newPermisos[modulo].filter((p) => p !== permiso);
        if (newPermisos[modulo].length === 0) {
          delete newPermisos[modulo];
        }
      }

      return newPermisos;
    });
  };

  const handleModuloCompleteChange = (modulo: string, checked: boolean) => {
    const moduloInfo = modulosDisponibles[modulo as keyof typeof modulosDisponibles];
    if (!moduloInfo) return;

    setPermisosSeleccionados((prev) => {
      const newPermisos = { ...prev };

      if (checked) {
        newPermisos[modulo] = [...moduloInfo.permisos];
      } else {
        delete newPermisos[modulo];
      }

      return newPermisos;
    });
  };

  const convertirPermisosAArray = (): string[] => {
    const permisosArray: string[] = [];

    Object.entries(permisosSeleccionados).forEach(([modulo, permisos]) => {
      const moduloInfo = modulosDisponibles[modulo as keyof typeof modulosDisponibles];
      if (!moduloInfo) return;

      if (permisos.length === moduloInfo.permisos.length) {
        // Si tiene todos los permisos del módulo, usar wildcard
        permisosArray.push(`${modulo}.*`);
      } else {
        // Agregar permisos específicos
        permisos.forEach((permiso) => {
          permisosArray.push(`${modulo}.${permiso}`);
        });
      }
    });

    return permisosArray;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const permisosArray = convertirPermisosAArray();
      const rolData = {
        ...formData,
        permisos: permisosArray,
      };

      if (editingRol) {
        const ok = await updateRol(editingRol.id, rolData);
        // Si actualizamos el rol que usa el empleado activo, refrescar su contexto sin reloguear
        if (ok && empleado?.rol?.id === editingRol.id && user) {
          try {
            const token = await user.getIdToken();
            const resp = await fetch('http://127.0.0.1:8001/api/empleado-auth/contexto', {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });
            if (resp.ok) {
              const ctx = await resp.json();
              if (ctx.success && ctx.data) {
                const nuevo = {
                  empleado: ctx.data.empleado,
                  broker: ctx.data.broker,
                  permisos: ctx.data.permisos,
                };
                localStorage.setItem('empleado_data', JSON.stringify(nuevo));
                // Disparar evento storage para que el contexto se reactive
                window.dispatchEvent(
                  new StorageEvent('storage', {
                    key: 'empleado_data',
                    newValue: JSON.stringify(nuevo),
                  }),
                );
              }
            }
          } catch {}
        }
      } else {
        await createRol(rolData);
      }

      closeModal();
    } catch (error) {}
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este rol?')) {
      try {
        await deleteRol(id);
      } catch (error) {}
    }
  };

  if (!permissions.canAccess || !permissions.canView) {
    return (
      <div className="flex justify-center items-center h-64">
        <Alert color="warning">No tienes permisos para ver esta página.</Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Roles</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Administra los roles y permisos del sistema
          </p>
        </div>
        <PermissionGate route={currentRoute} action="crear">
          <Button onClick={() => openModal()}>Crear Nuevo Rol</Button>
        </PermissionGate>
      </div>

      {error && <Alert color="failure">{error}</Alert>}

      <Card>
        <div className="guro-table-wrap">
          <table className="guro-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Descripción</th>
                <th>Nivel de Acceso</th>
                <th>Empleados</th>
                <th>Estado</th>
                <th className="sticky-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((rol) => (
                <tr key={rol.id} className="group">
                  <td className="font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: rol.color }}
                      />
                      <span>{rol.nombre}</span>
                      {rol.es_admin && (
                        <Badge color="info" size="sm">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td>{rol.descripcion}</td>
                  <td>
                    <Badge
                      color={
                        rol.nivel_acceso === 4
                          ? 'success'
                          : rol.nivel_acceso === 3
                          ? 'warning'
                          : rol.nivel_acceso === 2
                          ? 'info'
                          : 'gray'
                      }
                    >
                      {nivelesAcceso.find((n) => n.value === rol.nivel_acceso)?.label}
                    </Badge>
                  </td>
                  <td>
                    <Badge color="gray">{rol.empleados_count || 0} empleado(s)</Badge>
                  </td>
                  <td>
                    <Badge color={rol.activo ? 'success' : 'failure'}>
                      {rol.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="sticky-right">
                    <div className="flex space-x-2">
                      <PermissionGate route={currentRoute} action="editar">
                        <Button size="sm" color="gray" onClick={() => openModal(rol)}>
                          Editar
                        </Button>
                      </PermissionGate>
                      <PermissionGate route={currentRoute} action="eliminar">
                        <Button size="sm" color="failure" onClick={() => handleDelete(rol.id)}>
                          Eliminar
                        </Button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para crear/editar roles */}
      <Modal show={showModal} onClose={closeModal} size="7xl">
        <Modal.Header>{editingRol ? 'Editar Rol' : 'Crear Nuevo Rol'}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre" value="Nombre del Rol" />
                <TextInput
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="nivel_acceso" value="Nivel de Acceso" />
                <Select
                  id="nivel_acceso"
                  value={formData.nivel_acceso}
                  onChange={(e) =>
                    setFormData({ ...formData, nivel_acceso: parseInt(e.target.value) })
                  }
                >
                  {nivelesAcceso.map((nivel) => (
                    <option key={nivel.value} value={nivel.value}>
                      {nivel.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="descripcion" value="Descripción" />
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="color" value="Color" />
                <Select
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                >
                  {colorsOptions.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <ToggleSwitch
                  checked={formData.activo}
                  onChange={(checked) => setFormData({ ...formData, activo: checked })}
                />
                <Label value="Activo" />
              </div>

              <div className="flex items-center space-x-2">
                <ToggleSwitch
                  checked={formData.es_admin}
                  onChange={(checked) => setFormData({ ...formData, es_admin: checked })}
                />
                <Label value="Es Administrador" />
              </div>
            </div>

            {/* Sección de Permisos */}
            <div>
              <Label value="Permisos por Módulo" />
              <div className="mt-4 border rounded-lg p-4 max-h-96 overflow-y-auto">
                {/* Tabs de categorías */}
                <div className="flex flex-wrap gap-2 mb-4 border-b">
                  {Object.keys(categorias).map((categoria) => (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() => setActiveCategory(categoria)}
                      className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
                        activeCategory === categoria
                          ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {categoria}
                    </button>
                  ))}
                </div>

                {/* Módulos de la categoría activa */}
                <div className="space-y-4">
                  {categorias[activeCategory as keyof typeof categorias]?.map((modulo) => {
                    const moduloInfo =
                      modulosDisponibles[modulo as keyof typeof modulosDisponibles];
                    if (!moduloInfo) return null;

                    const permisosModulo = permisosSeleccionados[modulo] || [];
                    const todosMarcados = permisosModulo.length === moduloInfo.permisos.length;
                    const algunosMarcados = permisosModulo.length > 0 && !todosMarcados;

                    return (
                      <div key={modulo} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={todosMarcados}
                              onCheckedChange={(checked) =>
                                handleModuloCompleteChange(modulo, !!checked)
                              }
                            />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {LABEL_OVERRIDES[modulo] ?? moduloInfo.label}
                            </span>
                          </div>
                          <Badge
                            color={todosMarcados ? 'success' : algunosMarcados ? 'warning' : 'gray'}
                          >
                            {permisosModulo.length}/{moduloInfo.permisos.length}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-6">
                          {moduloInfo.permisos.map((permiso: string) => (
                            <div key={permiso} className="flex items-center space-x-2">
                              <Checkbox
                                checked={permisosModulo.includes(permiso)}
                                onCheckedChange={(checked) =>
                                  handlePermisoChange(modulo, permiso, !!checked)
                                }
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                {permiso.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" color="gray" onClick={closeModal}>
                Cancelar
              </Button>
              {editingRol ? (
                <PermissionGate route={currentRoute} action="editar">
                  <Button type="submit">Actualizar Rol</Button>
                </PermissionGate>
              ) : (
                <PermissionGate route={currentRoute} action="crear">
                  <Button type="submit">Crear Rol</Button>
                </PermissionGate>
              )}
            </div>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Roles;

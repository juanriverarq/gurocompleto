import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label, Textarea, Select, ToggleSwitch, Badge } from 'flowbite-react';
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
const defaultModulosDisponibles = {
  dashboard: { label: 'Dashboard', icon: 'solar:widget-2-bold-duotone', permisos: ['ver'] },
  clientes: { label: 'Clientes', icon: 'solar:users-group-two-rounded-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'importar'] },
  seguimiento_comercial: { label: 'Seguimiento Comercial', icon: 'solar:target-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  embudo_ventas: { label: 'Embudo de Conversión', icon: 'solar:chart-2-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  polizas: { label: 'Pólizas', icon: 'solar:shield-check-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'emitir', 'renovar', 'anular'] },
  automoviles: { label: 'Automóviles', icon: 'solar:car-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  renovaciones: { label: 'Renovaciones', icon: 'solar:refresh-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'procesar'] },
  siniestros: { label: 'Siniestros', icon: 'solar:danger-triangle-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'reportar', 'procesar', 'cerrar'] },
  metas_objetivos: { label: 'Metas y Objetivos', icon: 'solar:target-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  equipos_ventas: { label: 'Equipos de Ventas', icon: 'solar:users-group-rounded-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'asignar'] },
  analisis_rendimiento: { label: 'Análisis de Rendimiento', icon: 'solar:graph-up-bold-duotone', permisos: ['ver', 'exportar'] },
  whatsapp_business: { label: 'WhatsApp Business', icon: 'solar:chat-round-dots-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'enviar'] },
  sms_marketing: { label: 'SMS Marketing', icon: 'solar:phone-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'enviar'] },
  enlaces_cotizacion: { label: 'Enlaces de Cotización', icon: 'solar:link-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  plantillas_campana: { label: 'Plantillas de Campaña', icon: 'solar:document-text-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  configuracion_masiva: { label: 'Configuración Masiva', icon: 'solar:chat-round-dots-bold-duotone', permisos: ['ver', 'ejecutar'] },
  asistentes_ia: { label: 'Asistentes IA', icon: 'solar:cpu-bolt-bold-duotone', permisos: ['ver', 'usar', 'configurar'] },
  voice_ai: { label: 'Voice AI (ElevenLabs)', icon: 'solar:microphone-bold-duotone', permisos: ['ver', 'usar', 'configurar'] },
  analytics_predictivo: { label: 'Analytics Predictivo', icon: 'solar:chart-square-bold-duotone', permisos: ['ver', 'usar', 'configurar'] },
  comisiones: { label: 'Comisiones', icon: 'solar:dollar-minimalistic-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'calcular', 'pagar'] },
  cartera_clientes: { label: 'Cartera de Clientes', icon: 'solar:users-group-rounded-bold-duotone', permisos: ['ver', 'gestionar'] },
  estados_cuenta: { label: 'Estados de Cuenta', icon: 'solar:document-text-bold-duotone', permisos: ['ver', 'generar', 'enviar'] },
  reportes_financieros: { label: 'Reportes Financieros', icon: 'solar:chart-square-bold-duotone', permisos: ['ver', 'generar', 'exportar'] },
  contratos: { label: 'Contratos', icon: 'solar:document-medicine-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'firmar'] },
  documentos_poliza: { label: 'Documentos de Póliza', icon: 'solar:folder-with-files-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'] },
  documentos_siniestro: { label: 'Documentos de Siniestro', icon: 'solar:folder-with-files-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'] },
  proteccion_datos: { label: 'Protección de Datos', icon: 'solar:shield-user-bold-duotone', permisos: ['ver', 'gestionar'] },
  documentos_clientes: { label: 'Documentos', icon: 'solar:folder-with-files-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'descargar'] },
  cumplimiento_legal: { label: 'Cumplimiento Legal', icon: 'solar:security-safe-bold-duotone', permisos: ['ver', 'gestionar'] },
  integraciones_externas: { label: 'Integraciones Externas', icon: 'solar:programming-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'configurar'] },
  sincronizacion: { label: 'Sincronización', icon: 'solar:refresh-bold-duotone', permisos: ['ver', 'ejecutar', 'configurar'] },
  gestion_usuarios: { label: 'Gestión de Usuarios', icon: 'solar:users-group-rounded-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'asignar_roles'] },
  roles_permisos: { label: 'Roles y Permisos', icon: 'solar:shield-user-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar', 'asignar'] },
  auditoria_accesos: { label: 'Auditoría de Accesos', icon: 'solar:eye-bold-duotone', permisos: ['ver', 'exportar'] },
  informacion_agencia: { label: 'Información de Agencia', icon: 'solar:buildings-3-bold-duotone', permisos: ['ver', 'editar'] },
  sedes: { label: 'Sedes', icon: 'solar:buildings-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  aseguradoras: { label: 'Aseguradoras', icon: 'solar:buildings-2-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  ramos: { label: 'Ramos', icon: 'solar:widget-3-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  vendedores: { label: 'Vendedores', icon: 'solar:user-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  coberturas: { label: 'Coberturas', icon: 'solar:shield-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  tipos_afiliacion: { label: 'Tipos de Afiliación', icon: 'solar:user-plus-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  estados_siniestros: { label: 'Estados de Siniestros', icon: 'solar:flag-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  motivos_estados_poliza: { label: 'Motivos Estados Póliza', icon: 'solar:question-circle-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  mensajeros: { label: 'Mensajeros', icon: 'solar:delivery-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] },
  configuracion_sistema: { label: 'Configuración del Sistema', icon: 'solar:settings-bold-duotone', permisos: ['ver', 'editar'] },
  monitoreo_logs: { label: 'Monitoreo y Logs', icon: 'solar:chart-square-bold-duotone', permisos: ['ver', 'exportar'] },
  rrhh: { label: 'Recursos Humanos', icon: 'solar:users-group-two-rounded-bold-duotone', permisos: ['ver', 'crear', 'editar', 'eliminar'] }
} as const;

// Si backend expone permisosDisponibles, preferirlos
// (useRolesBroker ya expone permisosDisponibles; aquí tomamos ese valor en tiempo de render)

// Construcción dinámica de categorías a partir de módulos permitidos (whitelist del master)
// Solo se muestran los módulos presentes en modulosDisponibles (backend o fallback local)
const buildCategorias = (mods: Record<string, { label: string; icon?: string; permisos: string[] }>): Record<string, string[]> => {
  const groups: [string, string[]][] = [
    // Dashboard
    ['Panel de Control', ['dashboard']],

    // Operaciones de Seguros (solo los indicados)
    ['Operaciones de Seguros', ['clientes', 'polizas', 'automoviles', 'siniestros']],

    // Gestión Comercial
    ['Gestión Comercial', ['embudo_ventas', 'seguimiento_comercial', 'metas_objetivos', 'equipos_ventas', 'analisis_rendimiento']],

    // Marketing Digital
    ['Marketing Digital', ['whatsapp_business', 'email_marketing', 'sms_marketing', 'enlaces_cotizacion']],

    // Inteligencia Artificial
    ['Inteligencia Artificial', ['asistentes_ia', 'voice_ai', 'analytics_predictivo']],

    // Gestión Financiera
    ['Gestión Financiera', ['comisiones', 'cartera_clientes', 'estados_cuenta', 'reportes_financieros']],

    // Gestión Documental
    ['Gestión Documental', ['contratos', 'documentos_clientes', 'documentos_poliza', 'documentos_siniestro', 'cumplimiento_legal']],

    // Integraciones
    ['Integraciones', ['integraciones_externas', 'sincronizacion']],

    // Administración
    ['Administración', ['gestion_usuarios', 'roles_permisos', 'auditoria_accesos', 'informacion_agencia', 'sedes', 'aseguradoras', 'ramos', 'vendedores', 'coberturas', 'tipos_afiliacion', 'estados_siniestros', 'motivos_estados_poliza', 'mensajeros', 'configuracion_sistema', 'monitoreo_logs']],
  ];

  const result: Record<string, string[]> = {};
  const covered = new Set<string>();

  for (const [groupName, keys] of groups) {
    const present = keys.filter((k) => Object.prototype.hasOwnProperty.call(mods, k));
    if (present.length > 0) {
      result[groupName] = present;
      present.forEach((k) => covered.add(k));
    }
  }

  // No agregar extras: eliminar todo lo que no esté en la whitelist del master

  return result;
};

// Overrides de etiquetas para que coincidan con los títulos del master
const LABEL_OVERRIDES: Record<string, string> = {
  // Operaciones
  clientes: 'Clientes',
  polizas: 'Polizas',
  automoviles: 'Automoviles',
  siniestros: 'Siniestros',

  // Gestión Comercial
  embudo_ventas: 'Negocios',
  seguimiento_comercial: 'Seguimiento comercial',
  metas_objetivos: 'Metas y objetivos',
  equipos_ventas: 'Equipo de ventas',
  analisis_rendimiento: 'Analisis de rendimiento',

  // Marketing Digital
  whatsapp_business: 'WhatsApp Marketing',
  email_marketing: 'Email Marketing',
  sms_marketing: 'SMS Marketing',
  enlaces_cotizacion: 'Enlaces de Cotización',

  // IA
  asistentes_ia: 'Chatbot',
  voice_ai: 'Call center IA',
  analytics_predictivo: 'Predicciones de venta',

  // Gestión Documental
  contratos: 'Contratos',
  documentos_clientes: 'Clientes',
  documentos_poliza: 'Pólizas',
  documentos_siniestro: 'Siniestros',
  cumplimiento_legal: 'Internos',

  // Integraciones
  integraciones_externas: 'Integraciones Externas',
  sincronizacion: 'Sincronización',

  // Administración
  gestion_usuarios: 'Gestión de Usuarios',
  roles_permisos: 'Roles y Permisos',
  auditoria_accesos: 'Auditoría de Accesos',
  informacion_agencia: 'Información de Agencia',
  sedes: 'Sedes',
  aseguradoras: 'Aseguradoras',
  ramos: 'Ramos',
  vendedores: 'Vendedores',
  coberturas: 'Coberturas',
  tipos_afiliacion: 'Tipos de Afiliación',
  estados_siniestros: 'Estados de Siniestros',
  motivos_estados_poliza: 'Motivos Estados Póliza',
  mensajeros: 'Mensajeros',
  configuracion_sistema: 'Configuración del Sistema',
  monitoreo_logs: 'Monitoreo y Logs',
};

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
    nivelesAcceso: nivelesFromApi
  } = useRolesBroker();
  // Fuente de verdad de módulos: si backend trae permisosDisponibles, usarlo; si no, fallback local
  const modulosDisponibles: Record<string, { label: string; icon?: string; permisos: string[] }> =
    (permisosDisponibles && Object.keys(permisosDisponibles).length > 0)
      ? (permisosDisponibles as any)
      : (defaultModulosDisponibles as any);

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
    es_admin: false
  });

  const [permisosSeleccionados, setPermisosSeleccionados] = useState<{[key: string]: string[]}>({});
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
      es_admin: false
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
        es_admin: rol.es_admin
      });
      
      // Parsear permisos existentes
      const permisosActuales: {[key: string]: string[]} = {};
      (rol.permisos || []).forEach(permiso => {
        if (permiso === '*') {
          // Si tiene todos los permisos
          Object.keys(modulosDisponibles).forEach(modulo => {
            permisosActuales[modulo] = modulosDisponibles[modulo as keyof typeof modulosDisponibles].permisos;
          });
        } else if (permiso.includes('.')) {
          const [modulo, accion] = permiso.split('.');
          if (!permisosActuales[modulo]) {
            permisosActuales[modulo] = [];
          }
          if (accion === '*') {
            permisosActuales[modulo] = modulosDisponibles[modulo as keyof typeof modulosDisponibles]?.permisos || [];
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
    setPermisosSeleccionados(prev => {
      const newPermisos = { ...prev };
      if (!newPermisos[modulo]) {
        newPermisos[modulo] = [];
      }

      if (checked) {
        if (!newPermisos[modulo].includes(permiso)) {
          newPermisos[modulo].push(permiso);
        }
      } else {
        newPermisos[modulo] = newPermisos[modulo].filter(p => p !== permiso);
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

    setPermisosSeleccionados(prev => {
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
        permisos.forEach(permiso => {
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
        permisos: permisosArray
      };

      if (editingRol) {
        const ok = await updateRol(editingRol.id, rolData);
        // Si actualizamos el rol que usa el empleado activo, refrescar su contexto sin reloguear
        if (ok && empleado?.rol?.id === editingRol.id && user) {
          try {
            const token = await user.getIdToken();
            const resp = await fetch('http://127.0.0.1:8001/api/empleado-auth/contexto', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            if (resp.ok) {
              const ctx = await resp.json();
              if (ctx.success && ctx.data) {
                const nuevo = { empleado: ctx.data.empleado, broker: ctx.data.broker, permisos: ctx.data.permisos };
                localStorage.setItem('empleado_data', JSON.stringify(nuevo));
                // Disparar evento storage para que el contexto se reactive
                window.dispatchEvent(new StorageEvent('storage', { key: 'empleado_data', newValue: JSON.stringify(nuevo) }));
              }
            }
          } catch {}
        }
      } else {
        await createRol(rolData);
      }
      
      closeModal();
    } catch (error) {
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este rol?')) {
      try {
        await deleteRol(id);
      } catch (error) {
      }
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
          <Button onClick={() => openModal()}>
            Crear Nuevo Rol
          </Button>
        </PermissionGate>
      </div>

      {error && (
        <Alert color="failure">
          {error}
        </Alert>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Rol</Table.HeadCell>
              <Table.HeadCell>Descripción</Table.HeadCell>
              <Table.HeadCell>Nivel de Acceso</Table.HeadCell>
              <Table.HeadCell>Empleados</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {roles.map((rol) => (
                <Table.Row key={rol.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: rol.color }}
                      />
                      <span>{rol.nombre}</span>
                      {rol.es_admin && (
                        <Badge color="info" size="sm">Admin</Badge>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{rol.descripcion}</Table.Cell>
                  <Table.Cell>
                    <Badge color={
                      rol.nivel_acceso === 4 ? 'success' :
                      rol.nivel_acceso === 3 ? 'warning' :
                      rol.nivel_acceso === 2 ? 'info' : 'gray'
                    }>
                      {nivelesAcceso.find(n => n.value === rol.nivel_acceso)?.label}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="gray">
                      {rol.empleados_count || 0} empleado(s)
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={rol.activo ? 'success' : 'failure'}>
                      {rol.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex space-x-2">
                      <PermissionGate route={currentRoute} action="editar">
                        <Button 
                          size="sm" 
                          color="gray"
                          onClick={() => openModal(rol)}
                        >
                          Editar
                        </Button>
                      </PermissionGate>
                      <PermissionGate route={currentRoute} action="eliminar">
                        <Button 
                          size="sm" 
                          color="failure"
                          onClick={() => handleDelete(rol.id)}
                        >
                          Eliminar
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

      {/* Modal para crear/editar roles */}
      <Modal show={showModal} onClose={closeModal} size="7xl">
        <Modal.Header>
          {editingRol ? 'Editar Rol' : 'Crear Nuevo Rol'}
        </Modal.Header>
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
                  onChange={(e) => setFormData({ ...formData, nivel_acceso: parseInt(e.target.value) })}
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
                    const moduloInfo = modulosDisponibles[modulo as keyof typeof modulosDisponibles];
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
                              onCheckedChange={(checked) => handleModuloCompleteChange(modulo, !!checked)}
                            />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {LABEL_OVERRIDES[modulo] ?? moduloInfo.label}
                            </span>
                          </div>
                          <Badge color={todosMarcados ? 'success' : algunosMarcados ? 'warning' : 'gray'}>
                            {permisosModulo.length}/{moduloInfo.permisos.length}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-6">
                          {moduloInfo.permisos.map((permiso: string) => (
                            <div key={permiso} className="flex items-center space-x-2">
                              <Checkbox
                                checked={permisosModulo.includes(permiso)}
                                onCheckedChange={(checked) => handlePermisoChange(modulo, permiso, !!checked)}
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
              <Button type="submit">
                {editingRol ? 'Actualizar' : 'Crear'} Rol
              </Button>
            </div>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Roles;
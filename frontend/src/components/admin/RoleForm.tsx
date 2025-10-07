import React, { useState, useEffect } from 'react';
import { Modal, Button, Label, TextInput, Textarea, Checkbox, Alert, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Role, CreateRoleForm, MODULOS_SISTEMA, PERMISOS_BASE } from '../../types/admin';

interface RoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roleData: CreateRoleForm) => Promise<void>;
  role?: Role | null;
  title: string;
}

const getPermisoDescription = (permiso: string): string => {
  const descriptions: Record<string, string> = {
    'VER_POLIZAS': 'Visualizar información de pólizas',
    'EDITAR_POLIZAS': 'Crear y modificar pólizas',
    'CREAR_SINIESTROS': 'Registrar nuevos siniestros',
    'APROBAR_SINIESTROS': 'Aprobar y procesar siniestros',
    'VER_REPORTES': 'Acceso a reportes básicos',
    'ACCESO_REPORTES_FINANCIEROS': 'Reportes financieros y comisiones',
    'CONFIGURACION_SISTEMA': 'Configurar parámetros del sistema',
    'VER_COMISIONES': 'Visualizar comisiones y pagos',
    'GESTION_USUARIOS': 'Administrar usuarios y roles'
  };
  return descriptions[permiso] || 'Permiso del sistema';
};

const getModuloDescription = (modulo: string): string => {
  const descriptions: Record<string, string> = {
    'CLIENTES': 'Gestión de clientes y prospectos',
    'SINIESTROS': 'Manejo de siniestros y reclamaciones',
    'RENOVACIONES': 'Proceso de renovación de pólizas',
    'CRM': 'Sistema de gestión de relaciones',
    'COMISIONES': 'Cálculo y pago de comisiones',
    'CONFIGURACION': 'Configuración general del sistema',
    'BI': 'Business Intelligence y analytics',
    'AUDITORIA': 'Logs y auditoría del sistema'
  };
  return descriptions[modulo] || 'Módulo del sistema';
};

const RoleForm: React.FC<RoleFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  role,
  title
}) => {
  const [formData, setFormData] = useState<CreateRoleForm>({
    nombre: '',
    descripcion: '',
    permisos: [],
    modulos_acceso: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (role && isOpen) {
      setFormData({
        nombre: role.nombre,
        descripcion: role.descripcion,
        permisos: role.permisos.map(p => p.id),
        modulos_acceso: role.modulos_acceso
      });
    } else if (!role && isOpen) {
      setFormData({
        nombre: '',
        descripcion: '',
        permisos: [],
        modulos_acceso: []
      });
    }
    setErrors({});
  }, [role, isOpen]);

  const handleInputChange = (field: keyof CreateRoleForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePermisoChange = (permiso: string, checked: boolean) => {
    const newPermisos = checked
      ? [...formData.permisos, permiso]
      : formData.permisos.filter(p => p !== permiso);
    
    handleInputChange('permisos', newPermisos);
  };

  const handleModuloChange = (modulo: string, checked: boolean) => {
    const newModulos = checked
      ? [...formData.modulos_acceso, modulo]
      : formData.modulos_acceso.filter(m => m !== modulo);
    
    handleInputChange('modulos_acceso', newModulos);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre del rol es requerido';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (formData.permisos.length === 0) {
      newErrors.permisos = 'Debe seleccionar al menos un permiso';
    }

    if (formData.modulos_acceso.length === 0) {
      newErrors.modulos_acceso = 'Debe seleccionar al menos un módulo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyRoleTemplate = (template: string) => {
    const templates: Record<string, Partial<CreateRoleForm>> = {
      'ADMINISTRADOR': {
        nombre: 'Administrador General',
        descripcion: 'Acceso completo a todas las funcionalidades del sistema',
        permisos: [...PERMISOS_BASE],
        modulos_acceso: [...MODULOS_SISTEMA]
      },
      'AGENTE': {
        nombre: 'Agente de Seguros',
        descripcion: 'Gestión de clientes, pólizas y siniestros básicos',
        permisos: ['VER_POLIZAS', 'EDITAR_POLIZAS', 'CREAR_SINIESTROS', 'VER_REPORTES', 'VER_COMISIONES'],
        modulos_acceso: ['CLIENTES', 'SINIESTROS', 'RENOVACIONES', 'CRM']
      },
      'SUPERVISOR': {
        nombre: 'Supervisor',
        descripcion: 'Supervisión de agentes y aprobación de siniestros',
        permisos: ['VER_POLIZAS', 'EDITAR_POLIZAS', 'CREAR_SINIESTROS', 'APROBAR_SINIESTROS', 'VER_REPORTES', 'ACCESO_REPORTES_FINANCIEROS', 'VER_COMISIONES'],
        modulos_acceso: ['CLIENTES', 'SINIESTROS', 'RENOVACIONES', 'CRM', 'COMISIONES', 'BI']
      },
      'AUDITOR': {
        nombre: 'Auditor',
        descripcion: 'Revisión y auditoría de procesos',
        permisos: ['VER_POLIZAS', 'VER_REPORTES', 'ACCESO_REPORTES_FINANCIEROS'],
        modulos_acceso: ['AUDITORIA', 'BI']
      }
    };

    const template_data = templates[template];
    if (template_data) {
      setFormData(prev => ({
        ...prev,
        ...template_data
      }));
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="3xl">
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre" value="Nombre del Rol *" />
              <TextInput
                id="nombre"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                color={errors.nombre ? 'failure' : undefined}
                helperText={errors.nombre}
                placeholder="Ej: Administrador General, Agente de Seguros..."
              />
            </div>

            <div>
              <Label htmlFor="descripcion" value="Descripción *" />
              <Textarea
                id="descripcion"
                rows={3}
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                color={errors.descripcion ? 'failure' : undefined}
                helperText={errors.descripcion}
                placeholder="Describe las responsabilidades y alcance de este rol..."
              />
            </div>
          </div>

          {/* Permisos */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <Label value="Permisos del Sistema *" />
              {errors.permisos && (
                <p className="text-red-600 text-sm mt-1">{errors.permisos}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PERMISOS_BASE.map((permiso) => (
                <div key={permiso} className="flex items-center space-x-2">
                  <Checkbox
                    id={`permiso-${permiso}`}
                    checked={formData.permisos.includes(permiso)}
                    onChange={(e) => handlePermisoChange(permiso, e.target.checked)}
                  />
                  <Label htmlFor={`permiso-${permiso}`} className="flex-1">
                    <span className="font-medium">{permiso.replace(/_/g, ' ')}</span>
                    <p className="text-sm text-gray-500">
                      {getPermisoDescription(permiso)}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Módulos de acceso */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <Label value="Módulos de Acceso *" />
              {errors.modulos_acceso && (
                <p className="text-red-600 text-sm mt-1">{errors.modulos_acceso}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MODULOS_SISTEMA.map((modulo) => (
                <div key={modulo} className="flex items-center space-x-2">
                  <Checkbox
                    id={`modulo-${modulo}`}
                    checked={formData.modulos_acceso.includes(modulo)}
                    onChange={(e) => handleModuloChange(modulo, e.target.checked)}
                  />
                  <Label htmlFor={`modulo-${modulo}`} className="flex-1">
                    <span className="font-medium">{modulo.replace(/_/g, ' ')}</span>
                    <p className="text-sm text-gray-500">
                      {getModuloDescription(modulo)}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Roles predefinidos */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <Label value="Plantillas de Roles" />
              <p className="text-sm text-gray-500">
                Puedes usar estas plantillas como punto de partida
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Button
                type="button"
                color="gray"
                size="sm"
                onClick={() => applyRoleTemplate('ADMINISTRADOR')}
              >
                <Icon icon="solar:crown-bold" className="w-4 h-4 mr-2" />
                Administrador
              </Button>
              <Button
                type="button"
                color="gray"
                size="sm"
                onClick={() => applyRoleTemplate('AGENTE')}
              >
                <Icon icon="solar:user-bold" className="w-4 h-4 mr-2" />
                Agente/Asesor
              </Button>
              <Button
                type="button"
                color="gray"
                size="sm"
                onClick={() => applyRoleTemplate('SUPERVISOR')}
              >
                <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 mr-2" />
                Supervisor
              </Button>
              <Button
                type="button"
                color="gray"
                size="sm"
                onClick={() => applyRoleTemplate('AUDITOR')}
              >
                <Icon icon="solar:eye-bold" className="w-4 h-4 mr-2" />
                Auditor
              </Button>
            </div>
          </div>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end space-x-2 w-full">
          <Button color="gray" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex items-center"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                {role ? 'Actualizar' : 'Crear'} Rol
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default RoleForm; 
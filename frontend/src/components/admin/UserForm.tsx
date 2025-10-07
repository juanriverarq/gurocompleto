import React, { useState, useEffect } from 'react';
import { Modal, Button, Label, TextInput, Select, Textarea, FileInput, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { User, CreateUserForm } from '../../types/admin';
import { useRoles, useCompanies, useSucursales } from '../../hooks/useAdminApi';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: CreateUserForm) => Promise<void>;
  user?: User | null;
  title: string;
}

const UserForm: React.FC<UserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user,
  title
}) => {
  const { roles, loading: rolesLoading } = useRoles();
  const { companies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const { sucursales, loading: sucursalesLoading } = useSucursales(selectedCompanyId);

  const [formData, setFormData] = useState<CreateUserForm>({
    nombre_completo: '',
    tipo_documento: 'CC',
    numero_documento: '',
    correo_corporativo: '',
    telefono_movil: '',
    telefono_fijo: '',
    direccion: '',
    ciudad: '',
    departamento: '',
    rol_id: '',
    tipo_vinculacion: 'PLANTA',
    aseguradoras_permitidas: [],
    sucursal_id: '',
    supervisor_id: '',
    foto_perfil: undefined
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Cargar datos del usuario si estamos editando
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        nombre_completo: user.nombre_completo,
        tipo_documento: user.tipo_documento,
        numero_documento: user.numero_documento,
        correo_corporativo: user.correo_corporativo,
        telefono_movil: user.telefono_movil,
        telefono_fijo: user.telefono_fijo || '',
        direccion: user.direccion,
        ciudad: user.ciudad,
        departamento: user.departamento,
        rol_id: user.rol_id,
        tipo_vinculacion: user.tipo_vinculacion,
        aseguradoras_permitidas: user.aseguradoras_permitidas || [],
        sucursal_id: user.sucursal_id || '',
        supervisor_id: user.supervisor_id || '',
        foto_perfil: undefined
      });
      setSelectedCompanyId(user.compania_id);
      if (user.foto_perfil) {
        setPreviewImage(user.foto_perfil);
      }
    } else if (!user && isOpen) {
      // Reset form for new user
      setFormData({
        nombre_completo: '',
        tipo_documento: 'CC',
        numero_documento: '',
        correo_corporativo: '',
        telefono_movil: '',
        telefono_fijo: '',
        direccion: '',
        ciudad: '',
        departamento: '',
        rol_id: '',
        tipo_vinculacion: 'PLANTA',
        aseguradoras_permitidas: [],
        sucursal_id: '',
        supervisor_id: '',
        foto_perfil: undefined
      });
      setSelectedCompanyId('');
      setPreviewImage(null);
    }
    setErrors({});
  }, [user, isOpen]);

  const handleInputChange = (field: keyof CreateUserForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, foto_perfil: 'Solo se permiten archivos de imagen' }));
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, foto_perfil: 'El archivo no puede superar los 5MB' }));
        return;
      }

      setFormData(prev => ({ ...prev, foto_perfil: file }));
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      if (errors.foto_perfil) {
        setErrors(prev => ({ ...prev, foto_perfil: '' }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre_completo.trim()) {
      newErrors.nombre_completo = 'El nombre completo es requerido';
    }

    if (!formData.numero_documento.trim()) {
      newErrors.numero_documento = 'El número de documento es requerido';
    }

    if (!formData.correo_corporativo.trim()) {
      newErrors.correo_corporativo = 'El correo corporativo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo_corporativo)) {
      newErrors.correo_corporativo = 'El formato del correo no es válido';
    }

    if (!formData.telefono_movil.trim()) {
      newErrors.telefono_movil = 'El teléfono móvil es requerido';
    }

    if (!formData.direccion.trim()) {
      newErrors.direccion = 'La dirección es requerida';
    }

    if (!formData.ciudad.trim()) {
      newErrors.ciudad = 'La ciudad es requerida';
    }

    if (!formData.departamento.trim()) {
      newErrors.departamento = 'El departamento es requerido';
    }

    if (!formData.rol_id) {
      newErrors.rol_id = 'El rol es requerido';
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

  const departamentosColombia = [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas',
    'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
    'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
    'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
    'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
  ];

  const aseguradorasDisponibles = [
    'Suramericana', 'Bolivar', 'Mapfre', 'AXA Colpatria', 'Liberty', 'Previsora',
    'HDI', 'Equidad', 'Mundial', 'Solidaria', 'BBVA Seguros', 'Allianz'
  ];

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl">
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Personal */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Icon icon="solar:user-bold" className="w-5 h-5 mr-2" />
              Información Personal
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre_completo" value="Nombre Completo *" />
                <TextInput
                  id="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={(e) => handleInputChange('nombre_completo', e.target.value)}
                  color={errors.nombre_completo ? 'failure' : undefined}
                  helperText={errors.nombre_completo}
                />
              </div>

              <div>
                <Label htmlFor="tipo_documento" value="Tipo de Documento *" />
                <Select
                  id="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={(e) => handleInputChange('tipo_documento', e.target.value)}
                >
                  <option value="CC">Cédula de Ciudadanía</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">Cédula de Extranjería</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="numero_documento" value="Número de Documento *" />
                <TextInput
                  id="numero_documento"
                  value={formData.numero_documento}
                  onChange={(e) => handleInputChange('numero_documento', e.target.value)}
                  color={errors.numero_documento ? 'failure' : undefined}
                  helperText={errors.numero_documento}
                />
              </div>

              <div>
                <Label htmlFor="correo_corporativo" value="Correo Corporativo *" />
                <TextInput
                  id="correo_corporativo"
                  type="email"
                  value={formData.correo_corporativo}
                  onChange={(e) => handleInputChange('correo_corporativo', e.target.value)}
                  color={errors.correo_corporativo ? 'failure' : undefined}
                  helperText={errors.correo_corporativo}
                />
              </div>

              <div>
                <Label htmlFor="telefono_movil" value="Teléfono Móvil *" />
                <TextInput
                  id="telefono_movil"
                  value={formData.telefono_movil}
                  onChange={(e) => handleInputChange('telefono_movil', e.target.value)}
                  color={errors.telefono_movil ? 'failure' : undefined}
                  helperText={errors.telefono_movil}
                />
              </div>

              <div>
                <Label htmlFor="telefono_fijo" value="Teléfono Fijo" />
                <TextInput
                  id="telefono_fijo"
                  value={formData.telefono_fijo}
                  onChange={(e) => handleInputChange('telefono_fijo', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="direccion" value="Dirección *" />
              <Textarea
                id="direccion"
                rows={2}
                value={formData.direccion}
                onChange={(e) => handleInputChange('direccion', e.target.value)}
                color={errors.direccion ? 'failure' : undefined}
                helperText={errors.direccion}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="ciudad" value="Ciudad *" />
                <TextInput
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={(e) => handleInputChange('ciudad', e.target.value)}
                  color={errors.ciudad ? 'failure' : undefined}
                  helperText={errors.ciudad}
                />
              </div>

              <div>
                <Label htmlFor="departamento" value="Departamento *" />
                <Select
                  id="departamento"
                  value={formData.departamento}
                  onChange={(e) => handleInputChange('departamento', e.target.value)}
                  color={errors.departamento ? 'failure' : undefined}
                >
                  <option value="">Seleccionar departamento</option>
                  {departamentosColombia.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Select>
                {errors.departamento && (
                  <p className="text-red-600 text-sm mt-1">{errors.departamento}</p>
                )}
              </div>
            </div>
          </div>

          {/* Información Laboral */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Icon icon="solar:briefcase-bold" className="w-5 h-5 mr-2" />
              Información Laboral
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rol_id" value="Rol *" />
                <Select
                  id="rol_id"
                  value={formData.rol_id}
                  onChange={(e) => handleInputChange('rol_id', e.target.value)}
                  color={errors.rol_id ? 'failure' : undefined}
                  disabled={rolesLoading}
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.nombre}</option>
                  ))}
                </Select>
                {errors.rol_id && (
                  <p className="text-red-600 text-sm mt-1">{errors.rol_id}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tipo_vinculacion" value="Tipo de Vinculación *" />
                <Select
                  id="tipo_vinculacion"
                  value={formData.tipo_vinculacion}
                  onChange={(e) => handleInputChange('tipo_vinculacion', e.target.value)}
                >
                  <option value="PLANTA">Planta</option>
                  <option value="INDEPENDIENTE">Independiente</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="EXTERNO">Externo</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="sucursal_id" value="Sucursal" />
                <Select
                  id="sucursal_id"
                  value={formData.sucursal_id}
                  onChange={(e) => handleInputChange('sucursal_id', e.target.value)}
                  disabled={sucursalesLoading}
                >
                  <option value="">Sin sucursal asignada</option>
                  {sucursales.map(sucursal => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre} - {sucursal.ciudad}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="supervisor_id" value="Supervisor" />
                <Select
                  id="supervisor_id"
                  value={formData.supervisor_id}
                  onChange={(e) => handleInputChange('supervisor_id', e.target.value)}
                >
                  <option value="">Sin supervisor</option>
                  {/* Aquí cargarías la lista de supervisores */}
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Label value="Aseguradoras Permitidas" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {aseguradorasDisponibles.map(aseguradora => (
                  <label key={aseguradora} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.aseguradoras_permitidas?.includes(aseguradora) || false}
                      onChange={(e) => {
                        const current = formData.aseguradoras_permitidas || [];
                        if (e.target.checked) {
                          handleInputChange('aseguradoras_permitidas', [...current, aseguradora]);
                        } else {
                          handleInputChange('aseguradoras_permitidas', current.filter(a => a !== aseguradora));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{aseguradora}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Foto de Perfil */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Icon icon="solar:camera-bold" className="w-5 h-5 mr-2" />
              Foto de Perfil
            </h3>

            <div className="flex items-center space-x-4">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              )}
              <div className="flex-1">
                <FileInput
                  id="foto_perfil"
                  accept="image/*"
                  onChange={handleFileChange}
                  helperText="PNG, JPG o JPEG (máximo 5MB)"
                />
                {errors.foto_perfil && (
                  <p className="text-red-600 text-sm mt-1">{errors.foto_perfil}</p>
                )}
              </div>
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
                {user ? 'Actualizar' : 'Crear'} Usuario
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default UserForm; 